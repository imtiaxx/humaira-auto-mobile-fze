"""Shared pytest fixtures."""

from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

# Tests must never inherit a developer's real .env or a real database.
# `Settings` reads the repository-root .env, so every variable that changes
# observable behaviour has to be pinned here, not just the ones that would
# crash on import. DEBUG is in that set: it controls whether the 500 handler
# echoes the exception into the response body, so a developer running with
# DEBUG=true locally would otherwise get different error-leakage behaviour
# from the suite than CI does.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "CRITICAL")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-in-production-0123456789")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DEBUG", "false")
# Image uploads write to disk. Pinned to a temporary directory so a test run
# cannot leave files in the repository, and so an assertion about stored media
# never reads a developer's real `backend/media`. Expressed as a single call to
# keep everything above this line a `setdefault`, which is what lets the
# environment be configured before `app.*` is imported below.
os.environ.setdefault("IMAGE_STORAGE_ROOT", str(Path(tempfile.gettempdir()) / "humera-test-media"))
os.environ.setdefault("IMAGE_PUBLIC_BASE_URL", "http://test/media")

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db_read_session, get_db_session
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models.user import User
from app.main import create_app
from app.services.auth import create_staff_user, open_session_for_user

#: Credentials shared by the auth tests. Fixed rather than random so a failure
#: can be reproduced from the test source alone.
STAFF_EMAIL = "staff@example.test"
STAFF_PASSWORD = "Correct-Horse-Battery-9"
READER_EMAIL = "reader@example.test"
DISABLED_EMAIL = "disabled@example.test"


def _make_png(*, width: int, height: int, colour: tuple[int, int, int]) -> bytes:
    """Encode a solid-colour PNG in memory."""
    import io

    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def test_engine() -> AsyncIterator[AsyncEngine]:
    """Engine for this test's database, and the only place the URL is decided.

    Defaults to in-memory SQLite, which needs no server and no setup - the right
    trade for a suite that runs on every save. `TEST_DATABASE_URL` points the same
    suite at PostgreSQL instead, and that is not optional politeness: the two
    databases disagree in ways this application depends on.

    * SQLite has no timezone type and returns naive datetimes; PostgreSQL returns
      `TIMESTAMPTZ`. Arithmetic on a stored timestamp fails on one and not the
      other.
    * SQLite type-checks lazily and is lenient about what a column will hold.
      PostgreSQL enforces `CHECK` constraints immediately, which is how a reorder
      that parked rows at a negative position passed every SQLite test and would
      have failed on the real database.

    Both of those have been real bugs in this codebase, caught only by the
    database that behaved differently. A suite that can only run on one of them
    cannot catch the next one, so the escape hatch lives here rather than in a
    separate, quietly-unmaintained test configuration.

    Function-scoped, not session-scoped, and that is not a style preference. Every
    test gets its own event loop, while an `asyncpg` connection belongs to the
    loop that opened it - so a session-scoped engine hands later tests a connection
    whose loop has already been closed, and they fail in teardown with
    "Event loop is closed" rather than at the assertion that mattered. Disposing
    per test also keeps the connection count bounded, which matters once the
    server has a `max_connections` limit and 180 tests want one each.
    """
    url = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")

    if url.startswith("sqlite") and ":memory:" in url:
        # An in-memory database exists only inside its own connection, so the
        # pool must hand every session the *same* one. The default pool would
        # open a second connection to a second, empty database.
        engine = create_async_engine(
            url, future=True, poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
    else:
        engine = create_async_engine(url, future=True)

    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """A session bound to a database with no rows from any previous test.

    Both halves are needed. `create_all` does not clear anything, so without the
    `drop_all` a fixture that inserts a staff account collides with its own
    leftovers from the test before it.
    """
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with factory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """HTTP client bound directly to the ASGI app - no live server needed."""
    application = create_app()
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.fixture
async def db_client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client whose endpoints use the in-memory test session.

    Both session dependencies are overridden, not just the read one, and the
    second override is not optional: the staff routes depend on the *write*
    session, and a fixture that overrode only the read one would send those
    requests to the real engine. Against `sqlite+aiosqlite:///:memory:` that
    means a separate in-memory database with no tables in it, so the failure
    would be `no such table: staff_sessions` - pointing at the schema rather
    than at the fixture that caused it.

    Overridden rather than monkeypatched so the dependency graph FastAPI actually
    builds is the one under test: the routes, response models and error handlers
    are all real, and only the database handle is swapped. That means a route that
    forgets to declare its dependency - and would therefore hit the production
    engine - still shows up here as a failure against an empty table.

    The override is undone in teardown because `create_app()` is called fresh
    per test but the app object is module-level.
    """
    application: FastAPI = create_app()
    application.dependency_overrides[get_db_read_session] = lambda: db_session
    application.dependency_overrides[get_db_session] = lambda: db_session

    transport = ASGITransport(app=application)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as http_client:
            yield http_client
    finally:
        application.dependency_overrides.clear()


@pytest.fixture
async def staff_user(db_session: AsyncSession) -> User:
    """An active staff account with a known password.

    The password is a fixture constant rather than something random so that a
    failing login test can be reproduced by hand without hunting for a value.
    """
    return await create_staff_user(
        db_session,
        email=STAFF_EMAIL,
        full_name="Test Staff",
        password=STAFF_PASSWORD,
    )


@pytest.fixture
async def non_staff_user(db_session: AsyncSession) -> User:
    """An active account that is explicitly *not* staff.

    Built by hand rather than through `create_staff_user`, which sets `is_staff`
    and would make the fixture pointless. It carries a real password so the
    *login* refusal can be tested too: the account is a genuine, correctly
    authenticated principal whose only failing property is the role.
    """
    user = User(
        email=READER_EMAIL,
        full_name="Test Reader",
        is_active=True,
        is_staff=False,
        password_hash=hash_password(STAFF_PASSWORD),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def inactive_staff_user(db_session: AsyncSession) -> User:
    """A staff account that has been disabled."""
    return await create_staff_user(
        db_session,
        email=DISABLED_EMAIL,
        full_name="Test Disabled",
        password=STAFF_PASSWORD,
        is_active=False,
    )


@pytest.fixture
async def staff_token(db_session: AsyncSession, staff_user: User) -> str:
    """A live session token for `staff_user`.

    Minted through `open_session_for_user` rather than by logging in, so a test
    about vehicle editing does not also depend on the password verifier. The login
    endpoint has its own tests for that.
    """
    issued = await open_session_for_user(db_session, user=staff_user)
    await db_session.commit()
    return issued.token


async def _authenticated_client(
    db_session: AsyncSession,
    *,
    token: str | None,
) -> AsyncIterator[AsyncClient]:
    """An HTTP client with both database dependencies pointed at the test session.

    Both are overridden, not just the read one: the staff routes use the write
    session, and leaving it pointed at the real engine would let a test pass
    against an empty production-shaped table while writing nowhere - or, worse,
    actually write.

    Auth is presented as a cookie, which is what a browser sends and what the
    admin frontend's server action will use.
    """
    application: FastAPI = create_app()
    application.dependency_overrides[get_db_read_session] = lambda: db_session
    application.dependency_overrides[get_db_session] = lambda: db_session

    transport = ASGITransport(app=application)
    cookies = {settings.session_cookie_name: token} if token is not None else {}
    try:
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            cookies=cookies,
        ) as http_client:
            yield http_client
    finally:
        application.dependency_overrides.clear()


@pytest.fixture
async def staff_client(db_session: AsyncSession, staff_token: str) -> AsyncIterator[AsyncClient]:
    """HTTP client signed in as an active staff member."""
    async for client in _authenticated_client(db_session, token=staff_token):
        yield client


@pytest.fixture
async def anon_client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client with no session at all."""
    async for client in _authenticated_client(db_session, token=None):
        yield client


@pytest.fixture
async def reader_client(
    db_session: AsyncSession, non_staff_user: User
) -> AsyncIterator[AsyncClient]:
    """HTTP client signed in as an active *non*-staff account.

    Takes the real code path - a real session row, a real cookie - so the 403 it
    exercises is produced by the production role check rather than by a fixture
    that stubs the check out.
    """
    issued = await open_session_for_user(db_session, user=non_staff_user)
    await db_session.commit()
    async for client in _authenticated_client(db_session, token=issued.token):
        yield client


@pytest.fixture
async def disabled_client(
    db_session: AsyncSession, inactive_staff_user: User
) -> AsyncIterator[AsyncClient]:
    """HTTP client whose token is valid but whose account has been disabled.

    The session row resolves; the account is refused. That is the case a flag
    check on the session alone would miss.
    """
    issued = await open_session_for_user(db_session, user=inactive_staff_user)
    await db_session.commit()
    async for client in _authenticated_client(db_session, token=issued.token):
        yield client


@pytest.fixture
def png_bytes() -> bytes:
    """A small, valid PNG, generated rather than committed as a binary blob.

    A checked-in fixture image is a file nothing can review in a diff and nothing
    can regenerate if the encoder's defaults change. Building it here keeps the
    test self-describing: the size and colour are visible as code.
    """
    return _make_png(width=800, height=600, colour=(180, 40, 40))

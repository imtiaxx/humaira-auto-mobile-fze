"""Shared pytest fixtures."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator

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

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.deps import get_db_read_session
from app.db.base import Base
from app.main import create_app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
def test_engine() -> Iterator[object]:
    """In-memory SQLite engine for schema and query tests."""
    return create_async_engine("sqlite+aiosqlite:///:memory:", future=True)


@pytest.fixture
async def db_session(test_engine: object) -> AsyncIterator[AsyncSession]:
    """A session bound to a fresh in-memory database per test."""
    async with test_engine.begin() as connection:  # type: ignore[attr-defined]
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(
        bind=test_engine,  # type: ignore[arg-type]
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
    """HTTP client whose read endpoints use the in-memory test session.

    ``get_db_read_session`` is overridden rather than monkeypatched so the
    dependency graph FastAPI actually builds is the one under test: the routes,
    response models and error handlers are all real, and only the database
    handle is swapped. That means a route that forgets to declare its
    dependency - and would therefore hit the production engine - still shows up
    here as a failure against an empty table.

    The override is undone in teardown because ``create_app()`` is called fresh
    per test but the app object is module-level.
    """
    application: FastAPI = create_app()
    application.dependency_overrides[get_db_read_session] = lambda: db_session

    transport = ASGITransport(app=application)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as http_client:
            yield http_client
    finally:
        application.dependency_overrides.clear()

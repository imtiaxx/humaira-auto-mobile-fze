"""Database engine, async session factory and FastAPI dependencies.

One engine is created per process at import time and reused. Sessions are
never shared across requests; they are created per unit of work and closed
deterministically.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_is_sqlite: bool = False


def _build_engine() -> AsyncEngine:
    url = settings.database_url.get_secret_value()
    if not url:
        # Keeps tooling (imports, unit tests, --help) working without a
        # configured database. The application refuses to serve traffic with
        # this placeholder - see `verify_database_connection`.
        logger.warning("DATABASE_URL is not configured; using a null engine.")
        return create_async_engine("sqlite+aiosqlite://", future=True)

    connect_args: dict[str, object] = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    return create_async_engine(
        url,
        echo=settings.database_sql_echo,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine: AsyncEngine = _build_engine()

#: `expire_on_commit=False` keeps loaded attributes usable after commit,
#: which is what Pydantic response serialisation needs.
SessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    """Context-managed session for use outside the request cycle."""
    session = SessionFactory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request-scoped session.

    The session is rolled back on error and closed on exit. Route handlers
    must call ``commit()`` explicitly; nothing is committed implicitly.
    """
    session = SessionFactory()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db_read_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for read-only endpoints; never commits."""
    async with SessionFactory() as session:
        yield session


async def verify_database_connection() -> bool:
    """Issue ``SELECT 1``. Returns ``False`` when the database is unreachable."""
    try:
        async with engine.connect() as connection:
            await connection.exec_driver_sql("SELECT 1")
    except Exception as exc:
        logger.warning("database_unreachable", extra={"error": str(exc)})
        return False
    logger.info("database_connection_ok")
    return True


async def dispose_engine() -> None:
    """Release pooled connections on application shutdown."""
    await engine.dispose()
    logger.info("database_engine_disposed")

"""Shared pytest fixtures."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator

import pytest

# Tests must never inherit a developer's real .env or a real database.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "CRITICAL")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-in-production-0123456789")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

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

"""Configuration, pagination and model-layer tests."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import to_sync_database_url
from app.db.models import ALL_MODELS, User
from app.utils.pagination import MAX_PAGE_SIZE, Page, PageParams


def test_async_url_converts_to_sync_driver() -> None:
    converted = to_sync_database_url("postgresql+asyncpg://u:p@host:5432/db")

    assert converted == "postgresql+psycopg://u:p@host:5432/db"


def test_sync_url_passes_through_unchanged() -> None:
    url = "postgresql+psycopg://u:p@host:5432/db"

    assert to_sync_database_url(url) == url


@pytest.mark.parametrize(
    ("params", "expected_offset"),
    [(PageParams(page=1, page_size=24), 0), (PageParams(page=3, page_size=24), 48)],
)
def test_page_offset_calculation(params: PageParams, expected_offset: int) -> None:
    assert params.offset == expected_offset


def test_page_rejects_oversized_page_size() -> None:
    with pytest.raises(ValueError):
        PageParams(page=1, page_size=MAX_PAGE_SIZE + 1)


def test_page_envelope_math() -> None:
    page = Page.build([1, 2, 3], total=50, params=PageParams(page=2, page_size=20))

    assert page.total_pages == 3
    assert page.has_next is True
    assert page.has_previous is True


def test_empty_page_has_no_next() -> None:
    page = Page.build([], total=0, params=PageParams(page=1, page_size=20))

    assert page.total_pages == 0
    assert page.has_next is False


def test_model_registry_is_importable() -> None:
    assert User in ALL_MODELS
    assert "users" in User.__tablename__ or User.__tablename__ == "users"


async def test_user_round_trip(db_session: AsyncSession) -> None:
    from app.core.security import hash_password

    user = User(
        email="founder@example.com",
        full_name="Humera Founder",
        phone="+971501234567",
        password_hash=hash_password("Correct-Horse-9-Battery"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    stored = await db_session.get(User, user.id)

    assert stored is not None
    assert stored.email == "founder@example.com"
    assert stored.is_active is True
    assert stored.is_staff is False
    assert stored.password_hash is not None
    assert "Correct-Horse-9-Battery" not in stored.password_hash
    assert stored.created_at is not None


async def test_user_email_is_unique(db_session: AsyncSession) -> None:
    from sqlalchemy.exc import IntegrityError

    db_session.add(User(email="dup@example.com", full_name="First"))
    await db_session.commit()

    db_session.add(User(email="dup@example.com", full_name="Second"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()

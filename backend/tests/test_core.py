"""Configuration, pagination and model-layer tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import REPOSITORY_ROOT, Settings, to_sync_database_url
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


# ---------------------------------------------------------------------------
# CORS origins
# ---------------------------------------------------------------------------
#
# These exist because a wrong CORS setting fails silently. The value parses, the
# middleware is configured, the app boots, and every request from the real
# frontend is rejected at the preflight - with the only clue a CORS error in a
# browser console pointing somewhere other than the config file that is wrong.
#
# `_env_file=None` on every construction below. `Settings` reads the repository's
# real `.env` by design, so without it these tests would assert against whatever
# the developer's machine happens to be configured with, and pass or fail
# depending on whose laptop they ran on.


def _settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[arg-type]


def _origins(raw: str) -> list[str]:
    return _settings(cors_origins=raw).cors_origins  # type: ignore[arg-type]


def test_cors_accepts_a_comma_separated_list() -> None:
    """The documented form."""
    assert _origins("http://localhost:3000,https://humera.example") == [
        "http://localhost:3000",
        "https://humera.example",
    ]


def test_cors_accepts_a_json_array() -> None:
    """Also the form most people reach for, and `.env.example` uses."""
    assert _origins('["http://localhost:3000", "https://humera.example"]') == [
        "http://localhost:3000",
        "https://humera.example",
    ]


def test_cors_tolerates_surrounding_whitespace() -> None:
    """A trailing comma or a stray space should not become part of an origin.

    Origin comparison is exact string matching, so `" http://x"` is not `http://x`
    and produces a preflight failure with no other symptom.
    """
    assert _origins(" http://localhost:3000 , https://humera.example ,") == [
        "http://localhost:3000",
        "https://humera.example",
    ]


def test_cors_rejects_a_malformed_json_array_loudly() -> None:
    """A typo must fail at start-up, not silently disable the admin UI.

    Splitting on commas would otherwise produce a single "origin" that is a
    fragment of JSON, and the resulting list looks perfectly plausible.
    """
    with pytest.raises(ValidationError):
        _origins('["http://localhost:3000", ]')
    with pytest.raises(ValidationError):
        _origins("[not json at all")


def test_cors_rejects_a_json_array_of_non_strings() -> None:
    """`[1, 2]` is not an origin list, and must not become one."""
    with pytest.raises(ValidationError):
        _origins("[1, 2]")


def test_cors_passes_through_an_empty_value() -> None:
    """No origins configured is a valid development default, not an error."""
    assert _origins("") == []
    assert _settings().cors_origins == []


def test_production_refuses_a_wildcard_origin() -> None:
    """`allow_origins=["*"]` with credentials is rejected by browsers anyway.

    Failing at start-up turns a confusing runtime rejection into a clear message.
    """
    problems = _settings(
        app_env="production", cors_origins=["*"], secret_key="x" * 32
    ).assert_production_ready()
    assert any("wildcard" in problem for problem in problems)


def test_production_refuses_an_empty_origin_list() -> None:
    """Otherwise the admin UI loads, cannot sign in, and gives no server-side clue."""
    problems = _settings(
        app_env="production", cors_origins=[], secret_key="x" * 32
    ).assert_production_ready()
    assert any("CORS_ORIGINS" in problem for problem in problems)


def test_the_env_example_template_is_valid() -> None:
    """The committed template must actually load.

    `.env.example` is the first thing anyone copies, and it drifts from the
    settings object silently - nothing imports it, so a stale key or a syntax the
    parser does not accept is only discovered by a new developer, on their
    machine, after a failed deploy.

    This caught a real one: the template documented `CORS_ORIGINS` as a JSON array
    while the parser split on commas, so a copied template produced one malformed
    "origin" and every preflight from the admin UI failed - in a browser console,
    pointing at the frontend rather than at the config file.
    """
    template = REPOSITORY_ROOT / "backend" / ".env.example"
    assert template.exists(), ".env.example is missing; it is the setup instructions"

    parsed = Settings(_env_file=template)  # type: ignore[arg-type]

    assert parsed.cors_origins, "the template must show a working CORS_ORIGINS"
    for origin in parsed.cors_origins:
        assert origin == origin.strip()
        assert not origin.startswith("["), (
            f"CORS origin {origin!r} is a fragment of JSON, not an origin"
        )


def test_the_env_example_does_not_ship_a_secret_key() -> None:
    """The template is committed, so it must not carry a usable key.

    `SECRET_KEY` signs staff session cookies. A real one in a committed file is
    the same as no authentication at all, and it is the kind of thing that gets
    added "just to get it working" and never removed.

    Read from the file's text rather than through `Settings`, whose precedence
    would let an ambient `SECRET_KEY` from the developer's own environment answer
    the question instead of the template.
    """
    template = REPOSITORY_ROOT / "backend" / ".env.example"
    assigned = {
        line.split("=", 1)[0].strip().lower(): line.split("=", 1)[1].strip()
        for line in template.read_text(encoding="utf-8").splitlines()
        if "=" in line and not line.strip().startswith("#")
    }

    assert assigned.get("secret_key", "") == "", (
        ".env.example must leave SECRET_KEY empty; it is a committed file"
    )


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

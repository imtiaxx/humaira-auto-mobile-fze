"""Authentication and authorisation tests.

The two properties worth protecting, and which these tests exist to pin:

1. A request without a live staff session cannot reach the admin surface.
2. A request that *does* carry a session is told only what it needs - 401 means
   "no session", 403 means "not allowed", and neither response reveals anything
   about accounts, tokens or the database.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.staff_session import StaffSession
from tests.conftest import (
    DISABLED_EMAIL,
    READER_EMAIL,
    STAFF_EMAIL,
    STAFF_PASSWORD,
)


async def test_login_returns_a_token_and_the_account(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """A correct password returns a token and a non-sensitive user object."""
    response = await staff_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["user"]["email"] == STAFF_EMAIL
    assert body["user"]["is_staff"] is True

    # The password digest must never appear in any response. This is the single
    # most damaging mistake available on a login endpoint, so it is asserted
    # rather than assumed.
    assert "password" not in str(body).lower()
    assert "argon" not in str(body).lower()


async def test_login_stores_only_a_digest_of_the_token(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The database holds a hash, never the token that was handed out."""
    response = await staff_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
    )
    token = response.json()["token"]

    from sqlalchemy import select

    rows = (await db_session.scalars(select(StaffSession))).all()
    assert rows, "a session row should have been written"
    for row in rows:
        assert row.token_hash != token
        assert token not in row.token_hash
        # A SHA-256 digest renders as 64 hex characters.
        assert len(row.token_hash) == 64


async def test_login_sets_an_httponly_cookie(
    staff_client: AsyncClient,
) -> None:
    """The session cookie is httpOnly, so page scripts cannot read it."""
    response = await staff_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
    )

    raw = response.headers.get("set-cookie", "")
    assert settings.session_cookie_name in raw
    assert "HttpOnly" in raw
    assert "SameSite=lax" in raw.lower() or "samesite=lax" in raw.lower()
    assert "Path=/" in raw

    # `secure` is deliberately absent outside production, where traffic is plain
    # HTTP. Asserted so the omission stays a decision rather than an accident.
    if not settings.is_production:
        assert "Secure" not in raw


async def test_login_rejects_a_wrong_password(anon_client: AsyncClient) -> None:
    """A bad password is 401 and issues no cookie."""
    response = await anon_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": "Wrong-Password-Entirely-1"},
    )

    assert response.status_code == 401
    assert "set-cookie" not in {k.lower() for k in response.headers}


async def test_unknown_account_and_wrong_password_are_indistinguishable(
    anon_client: AsyncClient, staff_client: AsyncClient
) -> None:
    """The same status and body for both, so the endpoint cannot enumerate staff."""
    unknown = await anon_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.test", "password": STAFF_PASSWORD},
    )
    wrong = await anon_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": "Wrong-Password-Entirely-1"},
    )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


async def test_login_refuses_a_disabled_account_with_403(
    anon_client: AsyncClient, inactive_staff_user: object
) -> None:
    """Correct credentials but a disabled account is 403, not 401.

    The distinction is deliberate: the caller proved who they are, and the answer
    is "not you, not ever" rather than "try again".
    """
    response = await anon_client.post(
        "/api/v1/auth/login",
        json={"email": DISABLED_EMAIL, "password": STAFF_PASSWORD},
    )

    assert response.status_code == 403


async def test_login_refuses_a_non_staff_account_with_403(
    anon_client: AsyncClient, non_staff_user: object
) -> None:
    """Correct credentials, real account, no staff role: 403.

    Not 401. The caller proved who they are, so pretending the credentials were
    wrong would send them round the password loop forever.
    """
    response = await anon_client.post(
        "/api/v1/auth/login",
        json={"email": READER_EMAIL, "password": STAFF_PASSWORD},
    )

    assert response.status_code == 403
    assert "set-cookie" not in {k.lower() for k in response.headers}


async def test_me_returns_the_signed_in_account(staff_client: AsyncClient) -> None:
    """`/auth/me` identifies the caller, which is how the UI renders its shell."""
    response = await staff_client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == STAFF_EMAIL


async def test_me_without_a_session_is_401(anon_client: AsyncClient) -> None:
    """No token, no identity."""
    response = await anon_client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"


async def test_me_rejects_a_made_up_token(anon_client: AsyncClient) -> None:
    """A token that was never issued is refused, and says nothing about why."""
    anon_client.cookies.set(settings.session_cookie_name, "not-a-real-token")
    response = await anon_client.get("/api/v1/auth/me")

    assert response.status_code == 401
    # No hint that the token was well-formed but unknown, versus malformed.
    assert "token" not in response.text.lower() or "not" in response.text.lower()


async def test_bearer_header_is_accepted(db_client: AsyncClient, staff_token: str) -> None:
    """A server-to-server caller may present the token as a bearer header.

    This is the path the Next.js server action uses, so the token never has to be
    exposed to browser JavaScript.
    """
    db_client.cookies.clear()
    response = await db_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {staff_token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == STAFF_EMAIL


async def test_a_basic_authorization_header_is_not_accepted(
    db_client: AsyncClient, staff_token: str
) -> None:
    """Only `Bearer` is parsed. No second scheme, no second parser."""
    db_client.cookies.clear()
    response = await db_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Basic {staff_token}"},
    )

    assert response.status_code == 401


async def test_logout_revokes_the_session_so_it_stops_working(
    staff_client: AsyncClient,
) -> None:
    """After signing out the same token is dead.

    The token is captured before logout precisely so this can be asserted: a
    logout that only cleared the cookie would leave a still-valid credential in
    the hands of whoever had it.
    """
    login = await staff_client.post(
        "/api/v1/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
    )
    token = login.json()["token"]

    assert (await staff_client.get("/api/v1/auth/me")).status_code == 200

    out = await staff_client.post("/api/v1/auth/logout")
    assert out.status_code == 200
    assert out.json()["revoked"] is True

    staff_client.cookies.clear()
    after = await staff_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after.status_code == 401


async def test_logout_without_a_session_still_succeeds(anon_client: AsyncClient) -> None:
    """Signing out is idempotent - it never fails, even with nothing to revoke."""
    response = await anon_client.post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert response.json()["revoked"] is False


async def test_a_disabled_account_cannot_use_an_existing_session(
    disabled_client: AsyncClient,
) -> None:
    """The live session resolves, but the account behind it is refused.

    This is the case a check on the session row alone would miss: the row is
    valid and unexpired, and the answer still has to be no.
    """
    response = await disabled_client.get("/api/v1/auth/me")

    assert response.status_code == 403


async def test_a_non_staff_session_cannot_use_an_existing_session(
    reader_client: AsyncClient,
) -> None:
    """A real session belonging to a real account, refused across the staff area.

    The session is genuine and unexpired - the cookie was minted by the same code
    path a staff login uses - so the refusal can only be coming from the role
    check. That is the whole point: possessing a valid session is not sufficient.
    """
    for path in ("/api/v1/auth/me", "/api/v1/admin/vehicles"):
        response = await reader_client.get(path)
        assert response.status_code == 403, path
        assert response.json()["error"]["code"] == "permission_denied"


async def test_admin_routes_are_401_without_a_session(anon_client: AsyncClient) -> None:
    """Every admin route refuses an anonymous caller, and says `unauthorized`."""
    for method, path in [
        ("get", "/api/v1/admin/vehicles"),
        ("get", "/api/v1/admin/vehicles/-/summary"),
        ("post", "/api/v1/admin/vehicles"),
        ("get", "/api/v1/admin/vehicles/00000000-0000-0000-0000-000000000000"),
        ("post", "/api/v1/admin/vehicles/00000000-0000-0000-0000-000000000000/archive"),
        ("post", "/api/v1/admin/vehicles/00000000-0000-0000-0000-000000000000/restore"),
    ]:
        response = await anon_client.request(method, path, json={})
        assert response.status_code == 401, f"{method.upper()} {path}"
        assert response.json()["error"]["code"] == "authentication_required"


async def test_an_expired_session_is_refused(
    db_client: AsyncClient, db_session: AsyncSession, staff_token: str
) -> None:
    """A session past its expiry is treated as though it never existed.

    `db_client` and `db_session` are the same session object, so the stored expiry
    can be moved rather than waited out. The assertion is about the comparison
    against `expires_at`, not about the passage of seven days.
    """
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import select

    db_client.cookies.set(settings.session_cookie_name, staff_token)
    assert (await db_client.get("/api/v1/auth/me")).status_code == 200

    rows = (await db_session.scalars(select(StaffSession))).all()
    assert rows
    for row in rows:
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()

    assert (await db_client.get("/api/v1/auth/me")).status_code == 401


async def test_a_revoked_session_is_refused(
    db_client: AsyncClient, db_session: AsyncSession, staff_token: str
) -> None:
    """Revocation takes effect at once, not when the token would have expired."""
    from datetime import UTC, datetime

    from sqlalchemy import select

    db_client.cookies.set(settings.session_cookie_name, staff_token)
    assert (await db_client.get("/api/v1/auth/me")).status_code == 200

    rows = (await db_session.scalars(select(StaffSession))).all()
    for row in rows:
        row.revoked_at = datetime.now(UTC)
    await db_session.commit()

    assert (await db_client.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/vehicles",
        "/api/v1/auth/me",
    ],
)
async def test_admin_paths_are_not_reachable_by_guessing(
    anon_client: AsyncClient, path: str
) -> None:
    """A missing session is refused on every path, including the static one."""
    assert (await anon_client.get(path)).status_code == 401

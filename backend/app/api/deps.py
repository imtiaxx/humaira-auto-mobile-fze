"""Reusable FastAPI dependencies.

Anything injected via ``Depends`` that is not request/response plumbing belongs
here, so that route signatures stay short and dependencies are easy to override
in tests.

The two database dependencies are re-exported from `app.db.database` rather than
redefined, so there is exactly one session factory and one definition of what
"read-only" means.

`require_staff` is the gate for the whole admin surface. A route that declares it
cannot be reached without a live session belonging to an active staff account,
and - because the dependency is what resolves the user - a route cannot forget to
check the role: it never receives an unauthenticated principal in the first
place.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.logging import get_logger
from app.db.database import get_db_read_session, get_db_session
from app.db.models.user import User
from app.services.auth import resolve_session

logger = get_logger(__name__)

__all__ = [
    "CurrentStaff",
    "DbReadSession",
    "DbWriteSession",
    "get_db_read_session",
    "get_db_session",
    "require_staff",
]

#: `Bearer` is the only accepted scheme. `Basic` is not offered, because the only
#: thing this API authenticates with is a session token, and accepting a second
#: scheme would be one more parser to keep correct for no benefit.
_BEARER_PREFIX = "bearer "


def extract_session_token(request: Request) -> str | None:
    """Return the session token from the cookie or the Authorization header.

    The cookie is what the browser sends, and it is `httpOnly` so no script can
    read it. The header is what a server-to-server caller - the Next.js server
    action, curl, a test - uses, and it keeps the token off the browser entirely:
    the frontend never holds it, so a cross-site scripting bug has nothing to
    steal.

    Cookie first, because that is what a browser presents, and a request carrying
    both is answered from the cookie rather than from a header an attacker's page
    could have added.
    """
    cookie = request.cookies.get(settings.session_cookie_name)
    if cookie:
        return cookie

    header = request.headers.get("Authorization", "")
    if header.lower().startswith(_BEARER_PREFIX):
        candidate = header[len(_BEARER_PREFIX) :].strip()
        return candidate or None
    return None


async def require_staff(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    """Resolve the signed-in staff member, or refuse.

    401 for a token that is absent, unknown, expired or revoked - one answer for
    all four, because distinguishing them would disclose how much longer a token
    the caller already holds remains valid.

    403 for a token that resolves to a disabled or non-staff account. That is a
    different question with a different answer: the caller proved who they are,
    and the response is "not you" rather than "try again". Collapsing it into a
    401 would leave a disabled employee re-authenticating in a loop with no way
    to learn why.

    Uses the **write** session, not the read one, for one reason: refreshing
    `last_used_at` is a write, and the throttle in `resolve_session` means it
    happens at most once every few minutes. The commit below is conditional on
    the session actually being dirty, so the common case costs no round trip.
    """
    user = await resolve_session(
        session,
        token=extract_session_token(request),
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
    )
    if user is None:
        raise AuthenticationError("Sign in to continue.")

    # Revoking the session rows is the primary lockout mechanism (see
    # `revoke_all_for_user`); checking the flags as well means a session that
    # outlived the revocation - a token minted moments earlier, an operator who
    # disabled an account without revoking - still cannot get in.
    if not user.is_active or not user.is_staff:
        logger.warning(
            "staff_request_refused",
            extra={
                "user_id": str(user.id),
                "reason": "inactive" if not user.is_active else "not_staff",
            },
        )
        raise PermissionDeniedError("This account cannot administer the site.")

    if session.dirty or session.new:
        await session.commit()
    return user


def _client_ip(request: Request) -> str | None:
    """Best-effort client address for the session audit fields.

    `request.client.host` only. `X-Forwarded-For` is attacker-controlled unless a
    proxy in front of this app overwrites it, and the main application comment
    says trust nothing implicitly - so a forwarded header is recorded as nothing
    rather than as a spoofable address.
    """
    client = request.client
    return client.host if client is not None else None


#: Injected session handles, named for intent at the call site.
DbReadSession = Annotated[AsyncSession, Depends(get_db_read_session)]
DbWriteSession = Annotated[AsyncSession, Depends(get_db_session)]

#: The signed-in staff member. Handlers that take this cannot be reached by a
#: non-staff caller, so none of them needs to re-check the role.
CurrentStaff = Annotated[User, Depends(require_staff)]

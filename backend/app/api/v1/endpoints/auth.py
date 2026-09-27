"""Staff authentication endpoints.

Three routes: sign in, sign out, and "who am I". There is no registration, no
password reset and no email verification, and that is a decision rather than an
omission - see `docs/api.md`.

The session token is issued in two places at once: in the JSON body, for a
server-to-server caller, and as an `httpOnly` cookie, for a direct browser
client. The Next.js server action reads the body value and installs the cookie on
its own response, which keeps the token out of browser JavaScript entirely - the
property `localStorage` cannot give and the reason the admin surface is built on
server actions rather than a client-side fetch.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentStaff, DbWriteSession, extract_session_token
from app.core.config import settings
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, StaffUserResponse
from app.services.auth import authenticate, revoke_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Sign in as staff",
    description=(
        "Exchanges an email address and password for a session token.\n\n"
        "This endpoint is **staff-only**: an account that exists but is not "
        "staff is refused with `403`, and there is no public registration - "
        "accounts are created by an operator, not by a visitor.\n\n"
        "An unknown address and a wrong password both return `401` with the "
        "same message and take comparable time, so the endpoint cannot be used "
        "to discover which addresses are staff.\n\n"
        "The token is returned in the body **and** set as an `httpOnly` cookie. "
        "Browser JavaScript cannot read the cookie; send the token in an "
        "`Authorization: Bearer` header if you are calling the API directly."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Unknown address or wrong password."},
        status.HTTP_403_FORBIDDEN: {"description": "The account is disabled or is not staff."},
    },
)
async def login(
    payload: LoginRequest,
    response: Response,
    session: DbWriteSession,
) -> LoginResponse:
    """Authenticate a staff member and open a session."""
    issued = await authenticate(session, email=payload.email, password=payload.password)
    await session.commit()

    _set_session_cookie(response, issued.token, max_age=settings.session_expire_minutes * 60)
    return LoginResponse.model_validate(
        {
            "token": issued.token,
            "expires_at": issued.session.expires_at,
            "user": issued.user,
        }
    )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Sign out",
    description=(
        "Revokes the current session and clears the cookie.\n\n"
        "Always succeeds, including when the presented token is unknown or "
        "already revoked. A sign-out that reported failure would only teach a "
        "client to retry something that already worked, and the caller's intent - "
        "end this session - is satisfied either way."
    ),
)
async def logout(response: Response, request: Request, session: DbWriteSession) -> LogoutResponse:
    """Revoke the current session and clear the cookie."""
    revoked = await revoke_session(session, token=extract_session_token(request))
    if revoked:
        await session.commit()
    _clear_session_cookie(response)
    return LogoutResponse(revoked=revoked)


@router.get(
    "/me",
    response_model=StaffUserResponse,
    summary="The signed-in staff member",
    description=(
        "Returns the staff account the presented session belongs to.\n\n"
        "Returns `401` for an absent, unknown, expired or revoked session. The "
        "admin UI calls this on load to decide whether to render the signed-in "
        "shell or the login form."
    ),
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."}},
)
async def current_staff(staff: CurrentStaff) -> StaffUserResponse:
    """Return the signed-in staff member."""
    return StaffUserResponse.model_validate(staff)


def _set_session_cookie(response: Response, token: str, *, max_age: int) -> None:
    """Install the session cookie.

    `httponly` because a token readable from JavaScript is a token an XSS bug can
    exfiltrate. `samesite=lax` because the admin area only ever issues its own
    cross-site requests - a `strict` cookie would break a staff member arriving
    from a bookmark or a link, and buys nothing here. `secure` follows the
    environment, so it is present in production and absent on plain-HTTP
    localhost, where forcing it would make the cookie silently unusable.
    """
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    """Remove the session cookie.

    The attribute set must match the one used when it was set, or the browser
    keeps the original - which is why the two helpers share `settings` rather
    than repeating literals.
    """
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )

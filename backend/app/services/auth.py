"""Staff authentication.

Session-based, and the token is an opaque random string rather than a JWT. The
signed-in user's own security module already provided every primitive this needs -
`generate_session_id`, `hash_token`, `verify_password` - and none of them had a
caller. This module is where they stop being dead code.

The flow
--------
1. `authenticate` looks the user up by lower-cased email and verifies the
   password against the stored Argon2id digest.
2. On success it mints an opaque 48-byte token, stores only its SHA-256 digest,
   and returns the plaintext exactly once.
3. `resolve_session` looks a presented token up by digest on every subsequent
   request, and answers with the `User` or `None`.

Why the plaintext appears exactly once
--------------------------------------
Storing a digest means a database disclosure yields nothing replayable. It also
means the plaintext can only ever be returned at issue time, so it is never
logged, never written to a column, and never included in an error message.

What this module refuses to do
------------------------------
- It does not distinguish "no such user" from "wrong password" to the caller.
  Both produce the same 401 and the same message, so the endpoint cannot be used
  to enumerate staff email addresses.
- It never logs a password, a token, or a token digest.
- It has no registration path. Accounts come from `app.cli.create_staff`.
- It does not exempt a disabled or non-staff account silently: both are refused,
  and the reason is recorded without disclosing which of the two it was.
"""

from __future__ import annotations

import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthenticationError, ConflictError, PermissionDeniedError
from app.core.logging import get_logger
from app.core.security import (
    generate_session_id,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
)
from app.db.models.staff_session import StaffSession
from app.db.models.user import User
from app.repositories.staff_session import StaffSessionRepository
from app.utils.time import as_utc

logger = get_logger(__name__)

#: One message for every failed sign-in. See the module docstring: the
#: distinction between an unknown address and a wrong password is an
#: enumeration oracle, and it is not a distinction worth having.
INVALID_CREDENTIALS = "Email or password is incorrect."


@dataclass(frozen=True, slots=True)
class IssuedSession:
    """A freshly minted session: the plaintext token and its row."""

    token: str
    session: StaffSession
    user: User


async def authenticate(session: AsyncSession, *, email: str, password: str) -> IssuedSession:
    """Verify credentials and open a session, or raise `AuthenticationError`.

    A disabled account and a non-staff account are both refused. The refusal is
    reported as a permission failure rather than a credential failure, because
    the credentials were in fact correct - the account simply may not use this
    surface - and because that distinction is only visible to someone who already
    has the password.
    """
    now = _utcnow()
    repository = StaffSessionRepository(session)

    result = await session.scalars(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )
    user = result.first()

    if user is None:
        # Hash anyway, so that a request for a non-existent address costs the
        # same time as one for a real address. Without this, response latency
        # alone discloses which addresses exist.
        _burn_password_verification(password)
        logger.info("staff_login_rejected", extra={"reason": "unknown_account"})
        raise AuthenticationError(INVALID_CREDENTIALS)

    # A missing or empty digest and a wrong password are the same refusal. Not
    # merely the same message: the same code path, so an account that was
    # invited but never set a password is indistinguishable from a mistyped one.
    password_hash = user.password_hash
    if not password_hash or not verify_password(password, password_hash):
        logger.info(
            "staff_login_rejected",
            extra={"user_id": str(user.id), "reason": "bad_credentials"},
        )
        raise AuthenticationError(INVALID_CREDENTIALS)

    if not user.is_active:
        logger.warning(
            "staff_login_blocked",
            extra={"user_id": str(user.id), "reason": "inactive"},
        )
        raise PermissionDeniedError("This account has been disabled.")

    if not user.is_staff:
        logger.warning(
            "staff_login_blocked",
            extra={"user_id": str(user.id), "reason": "not_staff"},
        )
        raise PermissionDeniedError("This account may not access staff areas.")

    # Upgrade a digest that used weaker Argon2 parameters, but only now that the
    # password is known to be correct - never before, or a bad password would
    # rewrite the stored hash.
    upgraded = password_needs_rehash(password, password_hash)
    if upgraded is not None:
        user.password_hash = upgraded
        logger.info("staff_password_hash_upgraded", extra={"user_id": str(user.id)})

    issued = await _open_session(
        session,
        repository,
        user=user,
        now=now,
        user_agent=None,
        ip_address=None,
    )
    user.last_login_at = now
    return issued


async def resolve_session(
    session: AsyncSession,
    *,
    token: str | None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> User | None:
    """Return the staff member a session token belongs to, or `None`.

    `None` means the *token* is no good: absent, unknown, expired, or revoked.
    The caller turns that into a single 401, and distinguishing the four here
    would let a caller learn how much longer a token it already holds remains
    valid - information an attacker is not otherwise missing.

    A token that resolves to an account which is disabled, or which is not staff,
    returns *that account* rather than `None`, and the HTTP layer answers 403.
    Two reasons that is not a disclosure:

    * The caller already holds the token, so it already knows the token is real.
      Confirming it tells them nothing they did not have.
    * A 401 would be actively harmful. A disabled employee would be shown
      "your session expired", would sign in again, and would be refused again,
      forever, with no way to discover that their account had been turned off.

    Deciding the role here instead would also put an HTTP-shaped judgement in a
    function that is also called by the CLI and by tests.
    """
    if not token:
        return None

    now = _utcnow()
    repository = StaffSessionRepository(session)
    stored = await repository.get_live_by_token_hash(hash_token(token), now=now)
    if stored is None:
        return None

    # `stored.user` cannot be absent: `staff_sessions.user_id` is NOT NULL with
    # ON DELETE CASCADE, so a session row implies a live user row. An
    # `isinstance` guard here would be a check against a state the schema makes
    # impossible, and mypy is right to call it unreachable.
    user = stored.user

    if _should_refresh_last_used(stored.last_used_at, now):
        stored.last_used_at = now

    return user


async def open_session_for_user(
    session: AsyncSession,
    *,
    user: User,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> IssuedSession:
    """Open a session for an already-authenticated user.

    Exposed for the operator CLI and for tests that need a live session without
    a password. The public entry point is still `authenticate`.
    """
    repository = StaffSessionRepository(session)
    return await _open_session(
        session,
        repository,
        user=user,
        now=_utcnow(),
        user_agent=user_agent,
        ip_address=ip_address,
    )


async def revoke_session(session: AsyncSession, *, token: str | None) -> bool:
    """Revoke the session a token belongs to. Returns whether one was revoked.

    Idempotent by design: signing out twice, or signing out with a stale cookie,
    is a success from the caller's point of view, and reporting failure would
    only teach the client to retry something that already worked.
    """
    if not token:
        return False

    now = _utcnow()
    result = await session.scalars(
        select(StaffSession).where(StaffSession.token_hash == hash_token(token))
    )
    stored = result.first()
    if stored is None or stored.revoked_at is not None:
        return False

    stored.revoked_at = now
    await session.flush()
    logger.info("staff_session_revoked", extra={"session_id": str(stored.id)})
    return True


async def create_staff_user(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    password: str,
    is_active: bool = True,
) -> User:
    """Create a staff account. Used only by the operator CLI.

    Hashes with `hash_password`, which enforces the project's length and
    character-class rules and raises `ValidationError` on a weak password. There
    is no default password, no generated-and-logged password, and no code path
    that creates an account without one.
    """
    normalised_email = email.strip().lower()
    result = await session.scalars(
        select(User.id).where(func.lower(User.email) == normalised_email)
    )
    if result.first() is not None:
        raise ConflictError("An account with that email already exists.")

    user = User(
        email=normalised_email,
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        is_active=is_active,
        is_staff=True,
    )
    session.add(user)
    await session.flush()
    logger.info("staff_user_created", extra={"user_id": str(user.id)})
    return user


async def _open_session(
    session: AsyncSession,
    repository: StaffSessionRepository,
    *,
    user: User,
    now: datetime,
    user_agent: str | None,
    ip_address: str | None,
) -> IssuedSession:
    """Mint a token, store its digest, and return both the token and the row."""
    token = generate_session_id()
    lifetime = timedelta(minutes=settings.session_expire_minutes)
    stored = StaffSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=repository.expiry_from(lifetime, now=now),
        last_used_at=now,
        user_agent=_truncate(user_agent, 256),
        ip_address=_truncate(ip_address, 45),
    )
    session.add(stored)
    await session.flush()

    logger.info(
        "staff_session_opened",
        extra={"user_id": str(user.id), "session_id": str(stored.id)},
    )
    return IssuedSession(token=token, session=stored, user=user)


async def list_staff_accounts(session: AsyncSession) -> Sequence[User]:
    """Every account, active or not. Operator tooling only.

    Ordered by email so `list_staff` prints the same order twice. Not exposed over
    HTTP: there is deliberately no "list the staff" endpoint, because the set of
    staff addresses is not something a signed-in staff member needs to read, and
    an endpoint that exists is an endpoint that can leak.
    """
    result = await session.scalars(select(User).order_by(User.email))
    return result.all()


async def find_account_by_email(session: AsyncSession, email: str) -> User | None:
    """One account by address, case-insensitively. Operator tooling only.

    The same comparison `authenticate` uses, so `create_staff` refusing a
    duplicate and this lookup agreeing on which addresses exist cannot drift.
    """
    result = await session.scalars(
        select(User).where(func.lower(User.email) == email.strip().lower())
    )
    return result.first()


async def set_account_active(session: AsyncSession, *, user: User, active: bool) -> int:
    """Enable or disable an account, and revoke its sessions when disabling.

    Returns the number of sessions revoked. The revocation is not optional
    decoration: an account an operator has just disabled has to be locked out
    now, not when its current session happens to expire, and a session token
    presented afterwards would otherwise still resolve.
    """
    user.is_active = active
    if active:
        return 0

    revoked = await StaffSessionRepository(session).revoke_all_for_user(user.id, now=_utcnow())
    logger.info(
        "staff_account_disabled",
        extra={"user_id": str(user.id), "revoked_sessions": revoked},
    )
    return revoked


async def revoke_every_session(session: AsyncSession, *, user_id: object) -> int:
    """End every live session for one account. Operator tooling only.

    The "log out everywhere" button, for a password suspected of having leaked.
    """
    revoked = await StaffSessionRepository(session).revoke_all_for_user(user_id, now=_utcnow())
    logger.info("staff_sessions_revoked", extra={"user_id": str(user_id), "revoked": revoked})
    return revoked


async def purge_inactive_sessions(session: AsyncSession) -> int:
    """Delete session rows that can no longer authenticate anyone.

    Safe to run at any time. The table holds only digests, and a row that is
    neither live nor worth keeping is clutter; deleting it cannot lock anyone out
    because those sessions already fail to resolve.
    """
    return await StaffSessionRepository(session).purge_expired(now=_utcnow())


def _should_refresh_last_used(last_used_at: datetime, now: datetime) -> bool:
    """Whether to rewrite `last_used_at`.

    Throttled, because otherwise every authenticated request writes a row - a
    steady stream of updates to a hot table in exchange for a timestamp nobody
    reads. A coarse `last_used_at` is still an honest one; claiming exactness
    would cost a write per request.
    """
    elapsed = as_utc(now) - as_utc(last_used_at)
    return elapsed.total_seconds() >= settings.session_last_used_refresh_seconds


def _burn_password_verification(password: str) -> None:
    """Spend the time a real verification would, for an unknown account.

    Argon2id is deliberately slow. Skipping verification when the address is
    unknown would make "no such user" answer in microseconds and "wrong
    password" in tens of milliseconds, which is an enumeration oracle built out
    of nothing but a timing difference.

    The decoy digest is a real Argon2id hash of random bytes, built once on
    first use and cached. Hashing the *supplied* password here instead would
    fail outright for anything under 12 characters, because `hash_password`
    enforces the project's strength rules - and turning a timing defence into a
    crash is worse than no defence at all.
    """
    verify_password(password, _decoy_digest())


#: Lazily built, then reused. Module-level rather than computed at import so
#: that a process which never sees a failed sign-in - the CLI, a migration, a
#: health check - never pays for it.
_decoy_digest_cache: str | None = None


def _decoy_digest() -> str:
    """Return a throwaway Argon2id digest that authenticates nothing."""
    global _decoy_digest_cache
    if _decoy_digest_cache is None:
        _decoy_digest_cache = hash_password(secrets.token_urlsafe(24))
    return _decoy_digest_cache


def _truncate(value: str | None, limit: int) -> str | None:
    """Clip an audit field to its column width."""
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped[:limit]


def _utcnow() -> datetime:
    """Timezone-aware now, in one place so tests can reason about it."""
    return datetime.now(UTC)

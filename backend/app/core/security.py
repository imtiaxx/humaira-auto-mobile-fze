"""Security primitives.

The full authentication flow is intentionally **not** implemented at this
stage. What lives here is the verified-safe foundation that later steps build
on: Argon2id password hashing, random session identifiers and short-lived
signed tokens. There are no plaintext-password paths anywhere in this module.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Final, Literal

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings
from app.core.errors import AuthenticationError, ValidationError

TokenType = Literal["access", "refresh"]

#: Argon2id parameters. Stored here (not hard-coded at call sites) so that a
#: future cost increase can be applied centrally and re-hashed on next login.
_password_hash: Final[PasswordHash] = PasswordHash(
    (
        Argon2Hasher(
            time_cost=settings.argon2_time_cost,
            memory_cost=settings.argon2_memory_cost,
            parallelism=settings.argon2_parallelism,
        ),
    )
)

JWT_ALGORITHM: Final[str] = "HS256"
MIN_PASSWORD_LENGTH: Final[int] = 12
MAX_PASSWORD_LENGTH: Final[int] = 128


def hash_password(password: str) -> str:
    """Hash a password with Argon2id. The plaintext is never stored or logged."""
    _validate_password_strength(password)
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash in constant time."""
    if not password or not password_hash:
        return False
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:
        return False


def password_needs_rehash(password: str, password_hash: str) -> str | None:
    """Return a stronger hash when the stored one used weaker parameters.

    pwdlib returns ``(password_matches, updated_hash)``; a non-``None``
    ``updated_hash`` means the stored digest was produced with outdated
    parameters and should be replaced. Callers should only overwrite the
    stored value when this returns a string, and only after verifying the
    password matches.
    """
    try:
        matches, updated_hash = _password_hash.verify_and_update(password, password_hash)
    except Exception:
        return None
    return updated_hash if matches else None


def _validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValidationError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters long.")
    character_classes = sum(
        (
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        )
    )
    if character_classes < 3:
        raise ValidationError(
            "Password must combine at least three of: lowercase, uppercase, digits, symbols."
        )


def generate_session_id() -> str:
    """Return an opaque, cryptographically random session identifier."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Return the SHA-256 digest used to look up a session or token row.

    Tokens are stored as digests so that a database disclosure does not hand
    an attacker usable credentials.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    """Timing-safe string comparison for secret material."""
    return hmac.compare_digest(left, right)


def create_token(
    subject: str,
    token_type: TokenType,
    *,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT.

    Reserved for the authentication feature. Not reachable from any endpoint in
    this step; there is deliberately no login route yet.
    """
    secret = settings.secret_key.get_secret_value()
    if not secret:
        raise RuntimeError("SECRET_KEY is not configured; cannot issue tokens.")

    if expires_delta is None:
        expires_delta = (
            timedelta(minutes=settings.access_token_expire_minutes)
            if token_type == "access"  # noqa: S105 - literal, not a credential
            else timedelta(days=settings.refresh_token_expire_days)
        )

    issued_at = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": issued_at,
        "nbf": issued_at,
        "exp": issued_at + expires_delta,
        "jti": uuid.uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str, *, expected_type: TokenType | None = None) -> dict[str, Any]:
    """Decode and validate a signed JWT, raising :class:`AuthenticationError`."""
    secret = settings.secret_key.get_secret_value()
    if not secret:
        raise AuthenticationError("Token validation is not configured.")
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("The token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("The token is invalid.") from exc

    if expected_type is not None and payload.get("type") != expected_type:
        raise AuthenticationError("Unexpected token type.")
    return payload

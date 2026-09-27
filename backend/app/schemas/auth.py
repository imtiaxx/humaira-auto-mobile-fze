"""Staff authentication schemas.

Sign-in is the only way to obtain a session, and it is staff-only by
construction: there is no registration schema here, and `docs/api.md` records
that as deliberate. Accounts are created by an operator running
`python -m app.cli.create_staff`, which prompts for the password so no
credential is ever typed into a shell argument, a config file or this repository.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import MAX_PASSWORD_LENGTH

#: Matches the `users.email` column: RFC 5321's 320-character maximum, stored
#: lower-cased and unique.
#:
#: A constrained `str` rather than Pydantic's `EmailStr`, because `EmailStr`
#: requires `email-validator` - a third dependency, for one field, in a project
#: that has just gained two it genuinely cannot work without. This pattern
#: rejects the shapes that are certainly wrong (no `@`, embedded whitespace, no
#: domain dot); it is not a full RFC 5322 parser, and it does not need to be,
#: because the address is compared against a stored row rather than used to send
#: mail. The database constraint remains the authority.
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
StaffEmail = Annotated[str, Field(min_length=3, max_length=320, pattern=_EMAIL_PATTERN)]


class LoginRequest(BaseModel):
    """Body of `POST /api/v1/auth/login`."""

    model_config = ConfigDict(extra="forbid")

    email: StaffEmail = Field(description="Staff email address. Matched case-insensitively.")
    password: str = Field(
        min_length=1,
        max_length=MAX_PASSWORD_LENGTH,
        description="Staff password. Never logged and never returned.",
    )


class StaffUserResponse(BaseModel):
    """The signed-in staff member, as the admin UI needs them.

    Deliberately narrow: an id, a name, a role. No email-verification state, no
    `last_login_at`, no internal flags. The admin header needs to say who is
    signed in, and every field beyond that is an unnecessary disclosure.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    is_staff: bool = Field(description="Always true here; the endpoint is staff-only.")


class LoginResponse(BaseModel):
    """Body of a successful sign-in.

    `token` is returned **for server-to-server callers only** - the Next.js
    server action reads it and moves it straight into an `httpOnly` cookie, so it
    is never exposed to browser JavaScript. The backend also sets the same
    value as a cookie for direct API consumers and curl. A browser-reachable
    admin surface must not hold a token in `localStorage`, where any XSS reads
    it; the cookie is unreadable from script by design.
    """

    token: str = Field(description="Opaque session token. Store as an httpOnly cookie.")
    expires_at: datetime
    user: StaffUserResponse


class LogoutResponse(BaseModel):
    """Acknowledgement of a sign-out."""

    revoked: bool = Field(
        description="True when a live session was revoked. False when there was none to revoke."
    )

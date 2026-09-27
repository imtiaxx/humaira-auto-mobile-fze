"""Server-side staff session storage.

A staff sign-in produces one row here. The API looks a session up by the SHA-256
digest of the token it was handed, so this table never contains a credential
that could be replayed: an attacker who reads the table by any means - a
dump, a backup, a careless replica - holds a set of hashes, not a set of live
sessions.

Why a table at all, when a signed JWT would need none
-----------------------------------------------------
Revocation. A leaver's access has to stop the moment their account is disabled,
not seven days later when an unverifiable token finally expires. A stateless
token cannot be withdrawn; a row can, by deletion. For an internal staff surface
that is the property worth the extra table.

The plaintext token exists in exactly two places: the `httpOnly` cookie the
browser holds, and the response that issued it. Neither is written to a log, and
neither is reachable from JavaScript, so an XSS bug cannot read it.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class StaffSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One authenticated staff browser session."""

    __tablename__ = "staff_sessions"
    __table_args__ = (
        # Every authenticated request resolves a session by token digest, so the
        # column is both unique and indexed - `unique=True` supplies the index
        # in PostgreSQL, but the explicit declaration states the intent and keeps
        # the generated name stable.
        Index("ix_staff_sessions_token_hash", "token_hash", unique=True),
        # Sweeping expired rows is a range scan on this column.
        Index("ix_staff_sessions_expires_at", "expires_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The signed-in staff member. Cascaded on delete: a session outlives nobody.",
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="SHA-256 hex digest of the session token. The token itself is never stored.",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="Hard expiry. Enforced on every request, not by a sweeper.",
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="Last time this session authenticated a request.",
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Set on explicit sign-out. NULL for a live session.",
    )
    #: Recorded for the audit trail - "which browser signed in to the admin
    #: area" is the first question asked after a suspicious change. Not
    #: security-relevant, so it is capped and nullable rather than required.
    user_agent: Mapped[str | None] = mapped_column(
        String(256),
        nullable=True,
        doc="Client user agent at sign-in, truncated.",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        doc="Client IP at sign-in. 45 characters is the longest possible IPv6 address.",
    )

    user: Mapped[User] = relationship("User", back_populates="sessions", lazy="selectin")

    def is_live(self, *, now: datetime) -> bool:
        """Whether this session may authenticate a request at `now`."""
        return self.revoked_at is None and self.expires_at > now

    def __repr__(self) -> str:  # pragma: no cover - developer convenience
        return f"<StaffSession id={self.id} user_id={self.user_id} expires_at={self.expires_at}>"

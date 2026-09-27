"""ORM identity model.

This is the **only** table defined in Step 1. It exists so that the full
chain - model, migration, real PostgreSQL round trip - can be verified before
business entities are added. It carries no authorisation logic: role
assignment belongs to a later step.

Never store a plaintext password. ``password_hash`` holds an Argon2id digest
produced by :func:`app.core.security.hash_password`.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.staff_session import StaffSession


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A person who can sign in to the platform.

    Covers both future audiences: customer accounts and internal staff. The
    distinction is made by ``is_staff``, not by a separate table.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
        doc="RFC 5321 maximum length. Unique, stored lower-cased.",
    )
    phone: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        doc="E.164 format, e.g. +971501234567. Used for WhatsApp enquiries.",
    )
    full_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        doc="Display name shown to staff in the CRM.",
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc=(
            "Argon2id digest. Nullable so that staff-invited and "
            "WhatsApp-first users can exist before they set a password."
        ),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        doc="Inactive users are blocked at sign-in but retained for audit.",
    )
    is_staff: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        doc="Staff may reach the admin surface. Customers must stay false.",
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Set once ownership of the address is proven.",
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Last successful authentication. Drives inactive-account reports.",
    )
    sessions: Mapped[list[StaffSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
        doc="Server-side staff sessions. `raise` because a page must never lazy-load these.",
    )

    def __repr__(self) -> str:  # pragma: no cover - developer convenience
        return f"<User id={self.id} email={self.email!r} staff={self.is_staff}>"

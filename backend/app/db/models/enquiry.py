"""ORM model for website enquiries about a vehicle.

`Enquiry` is the one table a member of the public can write to. It belongs to
`Vehicle` by foreign key rather than by a denormalised copy of the vehicle's
specification, because an enquiry records interest in *one* car and that car's
specification is already stored.

`vehicle_slug` alongside `vehicle_id`
-------------------------------------
`vehicle_id` is the authority; the slug is stored so a staff list can be read
without a join, and so the record still names a recognisable vehicle after the
row is rendered in a list of URLs. It is written from the same lookup that
resolves `vehicle_id`, never from request input, so the pair cannot disagree.

`UNIQUE (vehicle_id, customer_email)`
-------------------------------------
One person asking about one car once. A repeat submission is refused rather than
opening a second thread, because two rows for the same car and the same address
are indistinguishable to the person answering them and read as a double lead.
The same address asking about a *different* car is a different enquiry and is
accepted.

Statuses
--------
`pending` -> `answered` -> `closed`, constrained in the database as well as the
schema layer, so a bad write through raw SQL cannot invent a fourth state.
"""

from __future__ import annotations

import uuid
from typing import Literal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.vehicle import Vehicle

#: The enquiry lifecycle, mirrored by `EnquiryStatusUpdate` in
#: `app.schemas.enquiry`. Listed here so the CHECK constraint and the schema
#: validator quote the same list rather than each keeping its own copy.
ENQUIRY_STATUS_VALUES: tuple[str, ...] = ("pending", "answered", "closed")
EnquiryStatus = Literal["pending", "answered", "closed"]


class Enquiry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One website enquiry about one vehicle."""

    __tablename__ = "enquiries"
    __table_args__ = (
        # Unnamed: the convention derives `uq_enquiries_vehicle_id_customer_email`
        # from the table and both columns, which is the name worth having.
        sa.UniqueConstraint("vehicle_id", "customer_email"),
        # Bare name, as in `app.db.models.vehicle`; the convention supplies the
        # `ck_enquiries_` prefix.
        sa.CheckConstraint(
            "status IN ('pending', 'answered', 'closed')",
            name="status",
        ),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(),
        sa.ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Referenced vehicle. Cascaded on delete: an enquiry has no meaning alone.",
    )
    vehicle_slug: Mapped[str] = mapped_column(
        sa.String(200),
        nullable=False,
        doc="Slug of the vehicle, denormalised for staff lists.",
    )
    customer_name: Mapped[str] = mapped_column(
        sa.String(200),
        nullable=False,
        doc="Full name of the enquirer.",
    )
    customer_email: Mapped[str] = mapped_column(
        sa.String(320),
        nullable=False,
        doc="Email address the reply goes to.",
    )
    customer_phone: Mapped[str] = mapped_column(
        sa.String(50),
        nullable=False,
        doc="Phone number the dealership can call back on.",
    )
    #: Free text from the public form. Stored as written, apart from the trimming
    #: the schema layer applies; it is not HTML and is never rendered as HTML.
    message: Mapped[str] = mapped_column(
        sa.Text,
        nullable=False,
        doc="Enquiry message text.",
    )
    status: Mapped[str] = mapped_column(
        sa.String(20),
        nullable=False,
        default="pending",
        server_default=sa.text("'pending'"),
        doc="One of: pending, answered, closed.",
    )

    vehicle: Mapped[Vehicle] = relationship(back_populates="enquiries")

    def __repr__(self) -> str:  # pragma: no cover - developer convenience
        return f"<Enquiry id={self.id} vehicle={self.vehicle_slug} status={self.status}>"

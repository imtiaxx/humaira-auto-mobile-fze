"""ORM vehicle inventory model.

`Vehicle` is the aggregate root of public inventory and the first business
entity in this schema. It holds the specification a customer reads; nothing
here is derived at render time, and no field is a placeholder.

Two tables, deliberately:

- ``vehicles`` - the specification, pricing and availability of one car.
- ``vehicle_images`` - an ordered child set of photographs.

`VehicleFeature` is **not** a table in this step. The architecture plan named
it as a key/value specification set, but the frontend contract carries features
as an object that is only ever rendered as rows - never filtered, joined or
aggregated - so a JSONB column is the honest representation and a third table
would buy nothing but a join. Revisit it if features ever become queryable.

A note on `brand` and `availability`
--------------------------------------
The columns are named ``brand`` and ``availability`` because that is what
`docs/architecture.md` specifies and what the business reads. The public API
serialises them as ``make`` and ``status``, because that is what
`frontend/types/vehicle.ts` and every customer-facing string in the frontend
use. The translation happens in exactly one place -
`app/schemas/vehicle.py`, via a Pydantic `serialization_alias` - so the
database keeps business vocabulary and the wire keeps display vocabulary
without a mapper spread across two repositories. That was the arrangement
Step 9 recorded in `docs/architecture.md`, and this is where it is applied.

USD only
--------
Vehicle pricing is quoted in US dollars and nothing else. `currency` carries a
CHECK constraint, and the model refuses a non-USD value outright, so the rule
cannot be violated by a bad write, a bad migration or a hand-edited row.

There is no conversion anywhere in this repository. Converting would mean
inventing an exchange rate, and an invented rate is an invented price.

A price is either positive or `NULL`. `NULL` means "not yet agreed, ask us" and
the frontend renders that as "Price on request". Zero is rejected rather than
stored, because a stored `0` renders as "$0" on a car that has simply not been
priced, and that is a lie told to a customer.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

#: The only currency customer-facing vehicle prices may be quoted in.
SUPPORTED_VEHICLE_CURRENCY: Literal["USD"] = "USD"

#: Availability states the frontend knows how to render, mirroring
#: `VehicleStatus` in `frontend/types/vehicle.ts`. Kept in lockstep with that
#: union: a fourth state added here without a matching badge on the frontend
#: would produce a vehicle the site cannot describe.
VehicleAvailability = Literal["available", "reserved", "sold"]
VEHICLE_AVAILABILITY_VALUES: tuple[str, ...] = ("available", "reserved", "sold")

#: The VIN alphabet excludes I, O and Q because they are confusable with 1 and 0
#: in a hand-transcribed value, so a "VIN" containing one is a misreading, and a
#: misread VIN would let a customer look up the wrong car.
VIN_PATTERN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$", re.IGNORECASE)

#: Slugs are lowercase, hyphen-separated and start and end alphanumerically.
#: Enforced in the model so every stored slug is a usable URL path segment and
#: `/inventory/<slug>` never needs percent-encoding.
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

#: First year a motor vehicle could plausibly carry as a model year. The upper
#: bound is a moving target and is enforced in the schema layer instead.
EARLIEST_MODEL_YEAR = 1900

#: Precision for money. `NUMERIC` rather than float, so a price is stored
#: exactly as agreed - binary floating point cannot represent most decimal
#: fractions, and a price that rounds is a price that is wrong.
PRICE_NUMERIC_PRECISION = 12
PRICE_NUMERIC_SCALE = 2


class VehicleImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One photograph of a vehicle.

    Ordered by `position` rather than flagged as primary. A separate
    `is_primary` boolean invites the two states that break a gallery: two
    images both marked primary, and none. Position 0 is the primary image by
    definition, which cannot disagree with itself.
    """

    __tablename__ = "vehicle_images"
    __table_args__ = (
        # Named explicitly: the convention would derive
        # `uq_vehicle_images_vehicle_id` from the first column alone, which
        # describes the constraint less precisely than the pair does.
        UniqueConstraint("vehicle_id", "position", name="uq_vehicle_images_vehicle_position"),
        CheckConstraint("position >= 0", name="non_negative_position"),
        CheckConstraint("width > 0", name="positive_width"),
        CheckConstraint("height > 0", name="positive_height"),
        CheckConstraint("length(alt) > 0", name="alt_required"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Owning vehicle. Cascaded on delete: a photograph has no meaning alone.",
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Ascending display order within one vehicle. 0 is the primary image.",
    )
    #: An absolute https URL or a root-relative path, decided at deployment
    #: time. No binary data is stored: the photograph lives on a CDN.
    src: Mapped[str] = mapped_column(
        String(2048),
        nullable=False,
        doc="Image URL. Image bytes are never stored in the database.",
    )
    #: Required, with no server-side default. A photograph with no description is
    #: inaccessible, and deriving a description from the vehicle's name would be
    #: a claim about an image nobody looked at.
    alt: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        doc="Description of the photograph for a sighted reader.",
    )
    width: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Intrinsic width in pixels, so a grid can reserve the box before load.",
    )
    height: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Intrinsic height in pixels, paired with `width`.",
    )

    vehicle: Mapped[Vehicle] = relationship(back_populates="images")

    def __repr__(self) -> str:  # pragma: no cover - developer convenience
        return f"<VehicleImage id={self.id} vehicle_id={self.vehicle_id} pos={self.position}>"


class Vehicle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One vehicle offered for sale, reserved or sold.

    Every specification field the customer sees is stored rather than derived,
    including `slug`: a stored slug is chosen once and never changes, which is
    what keeps `/inventory/<slug>` and its canonical tag stable when a make is
    later corrected from "Mercedes-Benz" to "Mercedes".

    The table ships empty and stays that way until real Humaira stock is
    entered. There is no seed data, no demo car and no illustrative price in
    this repository, and an empty inventory is rendered honestly rather than
    padded.

    Indexed columns are exactly the four the current queries use: the unique
    ``slug`` and ``vin``, the ``created_at`` the listing order sorts by, and
    ``vehicle_images.vehicle_id`` for the child join. The filtering indexes
    named in `docs/architecture.md` - make, body type, fuel, transmission,
    price range, year range, and a make/model text search - are deliberately
    **not** created here: no query filters on them yet, and an index nothing
    reads costs write throughput and storage forever. They belong in the step
    that adds filtering, chosen from the queries that step actually runs.
    """

    __tablename__ = "vehicles"
    __table_args__ = (
        # Unnamed: the naming convention derives `uq_vehicles_slug` from the
        # table and column, which is exactly the name worth having.
        UniqueConstraint("slug"),
        # Check constraint names are given bare. The convention
        # (`ck_%(table_name)s_%(constraint_name)s`) supplies the prefix, so
        # `ck_vehicles_usd_only` is the result of naming it `usd_only`.
        CheckConstraint(f"currency = '{SUPPORTED_VEHICLE_CURRENCY}'", name="usd_only"),
        CheckConstraint("price IS NULL OR price > 0", name="positive_price"),
        CheckConstraint("mileage_km IS NULL OR mileage_km >= 0", name="non_negative_mileage"),
        CheckConstraint(f"year >= {EARLIEST_MODEL_YEAR}", name="plausible_year"),
        CheckConstraint(
            "availability IN ('available', 'reserved', 'sold')",
            name="availability",
        ),
        CheckConstraint("vin IS NULL OR length(vin) = 17", name="vin_length"),
        # Default listing order for GET /vehicles, made explicit so the index
        # matches the query instead of being an accident of insertion order.
        # Named in full: the convention derives this same name from the column,
        # and passing a bare column string would be read as the index *name*,
        # producing an index with no columns at all.
        Index("ix_vehicles_created_at", "created_at"),
        # Partial index for the public listing, which reads
        # `WHERE archived_at IS NULL`. Partial because the archived rows are the
        # ones nothing queries by default: keeping them out of the index makes
        # it no larger than the live inventory, and archiving a vehicle does not
        # touch it at all.
        Index(
            "ix_vehicles_active_created_at",
            "created_at",
            postgresql_where=text("archived_at IS NULL"),
            sqlite_where=text("archived_at IS NULL"),
        ),
    )

    slug: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        doc="Stable URL segment: /inventory/<slug>. Lowercase, hyphen-separated.",
    )
    #: Business vocabulary. Serialised to the API as `make`.
    brand: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        doc="Manufacturer, e.g. 'Toyota'. Called `make` in customer-facing copy.",
    )
    model: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        doc="Model name, e.g. 'Land Cruiser'.",
    )
    variant: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        doc="Trim level, e.g. 'L Limited'. NULL when not recorded.",
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Model year.",
    )
    body_type: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
        doc="e.g. 'SUV'. NULL when not recorded.",
    )
    transmission: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
        doc="e.g. 'Automatic'. NULL when not recorded.",
    )
    fuel: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
        doc="e.g. 'Petrol', 'Diesel', 'Hybrid', 'Electric'. NULL when not recorded.",
    )
    colour: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
        doc="Exterior colour. NULL when not recorded.",
    )
    #: Carries its unit in the column name. An unqualified `mileage` number is a
    #: unit bug waiting to happen: 60000 must never be renderable as 60000 miles.
    mileage_km: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Odometer reading in kilometres. NULL when not recorded, never 0.",
    )
    vin: Mapped[str | None] = mapped_column(
        String(17),
        nullable=True,
        unique=True,
        doc="17-character VIN. NULL until a specific car is allocated. Unique.",
    )
    price: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=PRICE_NUMERIC_PRECISION, scale=PRICE_NUMERIC_SCALE),
        nullable=True,
        doc="Asking price in whole US dollars. NULL means 'Price on request'.",
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default=SUPPORTED_VEHICLE_CURRENCY,
        server_default=text("'USD'"),
        doc="Always 'USD'. Constrained, and never converted.",
    )
    #: Business vocabulary. Serialised to the API as `status`.
    availability: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="available",
        server_default=text("'available'"),
        doc="One of: available, reserved, sold.",
    )
    #: Set when staff withdraw a vehicle from sale, `NULL` while it is live.
    #:
    #: Archiving rather than deleting is the whole point of this column. A
    #: published vehicle has a live URL, may appear in a search engine index, a
    #: WhatsApp message or a bookmark, and a hard delete turns all of those into
    #: 404s. Archiving keeps the row, its images and its history intact while
    #: removing it from every public surface, and restoring it is a single
    #: update. `availability` is deliberately *not* reused for this: "sold" is a
    #: fact about a car, while archived is a decision about whether we are
    #: currently offering it, and the two can disagree.
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Withdrawn from public sale. NULL means the vehicle is published.",
    )
    location: Mapped[str | None] = mapped_column(
        String(160),
        nullable=True,
        doc="Where the vehicle is, e.g. the Ras Al Khor showroom. NULL when unconfirmed.",
    )
    features: Mapped[dict[str, str] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
        doc=(
            "Free-form key/value specification rows. JSONB rather than a table: "
            "these are rendered as rows, never filtered or joined."
        ),
    )

    images: Mapped[list[VehicleImage]] = relationship(
        back_populates="vehicle",
        cascade="all, delete-orphan",
        # `selectin` issues one extra query for the whole page instead of one
        # per row, which matters twice over: a query per vehicle is a latency
        # problem, and an implicit lazy load inside async SQLAlchemy raises.
        lazy="selectin",
        order_by="VehicleImage.position",
    )

    # -- Write-time invariants ------------------------------------------------
    # These run on attribute assignment, so an invalid value fails at the point
    # of the mistake rather than as an opaque IntegrityError at flush time. The
    # CHECK constraints remain, because a constraint is the only thing that also
    # protects against a raw SQL write or a hand-edited migration.

    @validates("slug")
    def _validate_slug(self, _key: str, value: str) -> str:
        normalised = value.strip().lower()
        if not SLUG_PATTERN.fullmatch(normalised):
            raise ValueError("slug must be lowercase alphanumeric text separated by hyphens.")
        return normalised

    @validates("currency")
    def _validate_currency(self, _key: str, value: str) -> str:
        normalised = value.strip().upper()
        if normalised != SUPPORTED_VEHICLE_CURRENCY:
            raise ValueError(
                f"Vehicle pricing must be {SUPPORTED_VEHICLE_CURRENCY}; got {value!r}."
            )
        return normalised

    @validates("price")
    def _validate_price(self, _key: str, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("price must be positive, or NULL to mean 'Price on request'.")
        return value

    @validates("availability")
    def _validate_availability(self, _key: str, value: str) -> str:
        normalised = value.strip().lower()
        if normalised not in VEHICLE_AVAILABILITY_VALUES:
            raise ValueError(
                f"availability must be one of {VEHICLE_AVAILABILITY_VALUES}; got {value!r}."
            )
        return normalised

    @validates("vin")
    def _validate_vin(self, _key: str, value: str | None) -> str | None:
        if value is None:
            return None
        candidate = value.strip().upper()
        if not VIN_PATTERN.fullmatch(candidate):
            raise ValueError("vin must be 17 characters from the VIN alphabet (no I, O or Q).")
        return candidate

    def __repr__(self) -> str:  # pragma: no cover - developer convenience
        return f"<Vehicle id={self.id} slug={self.slug!r} availability={self.availability!r}>"

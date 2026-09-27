"""Public vehicle response schemas.

This module is the **only** place the database's vocabulary and the API's
vocabulary are reconciled. Everything downstream - the OpenAPI document, the
frontend's `VehicleRecord`, the JSON on the wire - speaks the API's words.

Why there is a rename at all
----------------------------
The columns are ``brand`` and ``availability``; the wire is ``make`` and
``status`. ``docs/architecture.md`` and the business use the former, every
customer-facing string in the frontend uses the latter, and Step 9 recorded
that the translation belongs here rather than in a frontend mapper.

A field renamed on the way through the seam is a field that can be renamed
*wrong*, and the only symptom is a blank specification row that nobody
notices. So the rename is declared once, as a Pydantic
``serialization_alias``, and covered by this project's own backend tests.

What is deliberately absent
--------------------------
No ``created_at``, no ``updated_at``, no ``is_primary``, no internal
identifiers beyond the public ``id``, and no database column names leak
through. FastAPI serialises only the fields declared here, so a column added
to the table later is invisible to the public API until someone deliberately
exposes it. That is the property worth having on a public endpoint.

Price shape
-----------
``price`` is declared ``float``, not ``Decimal``. The column is ``NUMERIC`` and
asyncpg returns a ``Decimal``, and Pydantic serialises ``Decimal`` as a JSON
*string* by default - which the frontend boundary would reject, because it
treats a numeric string as untrusted rather than guessing at it. Declaring
``float`` keeps the JSON a number, which is what ``VehicleRecord.price``
promises. A test pins that.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.vehicle import (
    EARLIEST_MODEL_YEAR,
    SUPPORTED_VEHICLE_CURRENCY,
    VEHICLE_AVAILABILITY_VALUES,
)

#: Matches `earliestPlausibleModelYear()` in the frontend boundary: a model
#: year is rejected if it could not describe a car that exists or is about to.
LATEST_MODEL_YEAR_OFFSET = 1


def latest_plausible_model_year() -> int:
    """Upper bound for a model year, evaluated per call rather than at import.

    Computed lazily so a long-running process does not pin last year's value.
    """
    return datetime.now(UTC).year + LATEST_MODEL_YEAR_OFFSET


class VehicleImageResponse(BaseModel):
    """One photograph.

    ``alt`` is required rather than optional, matching `VehicleImage` in
    `frontend/types/vehicle.ts`: the frontend boundary drops an undescribed
    photograph rather than inventing a caption, so a nullable ``alt`` here
    would only ever produce a silently missing image.
    """

    model_config = ConfigDict(from_attributes=True)

    src: str = Field(description="Absolute https URL or root-relative path.")
    alt: str = Field(description="Description of the photograph for a sighted reader.")
    width: int = Field(gt=0, description="Intrinsic width in pixels.")
    height: int = Field(gt=0, description="Intrinsic height in pixels.")


class VehicleResponse(BaseModel):
    """A vehicle as the public website may see it.

    Mirrors `VehicleRecord` in `frontend/lib/api/vehicles.ts` field for field.
    That interface was written in Step 9 against a planned schema; this is that
    schema, and the backend test suite compares the two so a change to either
    half surfaces as a failing test rather than as a blank card.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(description="Stable internal identifier. Never displayed.")
    slug: str = Field(description="URL segment for /inventory/<slug>. Lowercase, hyphenated.")
    # Database `brand`, serialised as `make`.
    brand: str = Field(serialization_alias="make", description="Manufacturer, e.g. 'Toyota'.")
    model: str = Field(description="Model name, e.g. 'Land Cruiser'.")
    variant: str | None = Field(default=None, description="Trim level. NULL when not recorded.")
    year: int = Field(description="Model year.")
    body_type: str | None = Field(default=None, description="e.g. 'SUV'. NULL when not recorded.")
    transmission: str | None = Field(default=None, description="e.g. 'Automatic'.")
    fuel: str | None = Field(default=None, description="e.g. 'Diesel'.")
    colour: str | None = Field(default=None, description="Exterior colour.")
    #: Unit carried in the name on both sides. See the model for why.
    mileage_km: int | None = Field(
        default=None,
        ge=0,
        description="Odometer reading in kilometres. NULL when not recorded, never 0.",
    )
    vin: str | None = Field(default=None, description="17-character VIN. NULL until allocated.")
    #: `float`, not `Decimal` - see the module docstring on price shape.
    price: float | None = Field(
        default=None,
        description="Asking price in whole US dollars. NULL means 'Price on request'.",
    )
    currency: str = Field(description="Always 'USD'. This API quotes no other currency.")
    # Database `availability`, serialised as `status`.
    availability: str = Field(
        serialization_alias="status", description="available | reserved | sold."
    )
    location: str | None = Field(default=None, description="e.g. the Ras Al Khor showroom.")
    images: list[VehicleImageResponse] = Field(
        default_factory=list,
        description="Ordered photographs, primary first. Empty until real photography exists.",
    )
    features: dict[str, str] | None = Field(
        default=None,
        description="Key/value specification rows. NULL when none are recorded.",
    )

    @field_validator("currency")
    @classmethod
    def _reject_non_usd(cls, value: str) -> str:
        """Refuse to serialise a price this site cannot quote.

        The column carries a CHECK constraint, so an AED row should be
        impossible. This is the second lock on the same door: a check constraint
        is bypassed by a bad migration or a hand-edited row, and a validation
        error is caught by the service, which drops the record and logs it,
        rather than by a customer being shown a second currency.
        """
        if value != SUPPORTED_VEHICLE_CURRENCY:
            raise ValueError(f"Vehicle pricing must be {SUPPORTED_VEHICLE_CURRENCY}.")
        return value

    @field_validator("price")
    @classmethod
    def _reject_non_positive_price(cls, value: float | None) -> float | None:
        """`NULL` is "not agreed yet"; `0` is a price nobody means.

        Rejecting rather than coercing keeps the two meanings distinct. The
        frontend renders `null` as "Price on request" and would render `0` as
        "$0", which is a false claim about the vehicle.
        """
        if value is not None and value <= 0:
            raise ValueError("price must be positive, or NULL to mean 'Price on request'.")
        return value

    @field_validator("availability")
    @classmethod
    def _reject_unknown_availability(cls, value: str) -> str:
        """A state the frontend cannot render is a bug, not something to default.

        Defaulting an unrecognised value to `available` would tell a customer a
        car is for sale on the strength of a value neither end of the system
        understood.
        """
        if value not in VEHICLE_AVAILABILITY_VALUES:
            raise ValueError(f"availability must be one of {VEHICLE_AVAILABILITY_VALUES}.")
        return value

    @field_validator("year")
    @classmethod
    def _reject_implausible_year(cls, value: int) -> int:
        """A year outside the plausible range describes no real vehicle."""
        if not EARLIEST_MODEL_YEAR <= value <= latest_plausible_model_year():
            raise ValueError(f"year must be between {EARLIEST_MODEL_YEAR} and the next model year.")
        return value

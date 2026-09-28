"""Public vehicle response schemas.

This module is the **only** place the database's vocabulary and the API's
vocabulary are reconciled. Everything downstream - the OpenAPI document, the
frontend's `VehicleRecord`, the JSON on the wire - speaks the API's words.

Filtering input lives here too
-------------------------------
`VehicleFilterQuery` is the request-side half of that same reconciliation: the
caller says `make=` and `status=`, the database is queried on `brand` and
`availability`, and the two names never meet. It mirrors the `VehicleFilters`
interface already declared in `frontend/types/vehicle.ts`, which Step 9 wrote
before any control existed so the query-string shape would be decided while it
was still cheap to change. Field names are identical on both sides, so the
binding that eventually consumes them is a pass-through with no renaming.

What filtering deliberately does not do
---------------------------------------
There is no sorting, no free-text ranking and no `VehicleFeature` query. Features
stay in the JSONB column because the first filter that needs to query a feature
is the trigger for promoting that column to a table, and that trigger has not
been pulled. Ordering is unchanged from the unfiltered list, so a filtered page
is a subset of the same listing rather than a second, differently-ordered view
of the same cars.

Facet semantics worth stating, because SQL's defaults are not what a customer
expects:

- Facet equality is case-insensitive, and a vehicle whose facet is `NULL` is
  **excluded** by any filter on that facet. `NULL` means "not recorded", and a
  car whose fuel type was never entered is not a diesel.
- A price filter **excludes** vehicles with no agreed price. `NULL` means "price
  on request", and a customer who asked for "under 40,000" is not being shown a
  car whose price nobody will state.
- Free text is a substring match over make and model, not a fuzzy or
  tokenised search. "cruis" finds "Cruiser"; "land cru" does not match
  "Land Cruiser" as a phrase, because the words are searched independently.

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
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

#: Longest facet value accepted. The widest column these compare against is
#: `vehicles.brand` at 120 characters; the others are 60. A longer value cannot
#: match any stored row, so rejecting it names the mistake instead of returning
#: an empty page the caller has to interpret.
MAX_FACET_LENGTH = 120

#: Longest free-text term accepted. This is the bound that matters most: the term
#: is interpolated into a `LIKE` pattern, so an unbounded one is a free way to
#: ask the database to scan the whole table on every keystroke of a search box.
MAX_QUERY_LENGTH = 120

#: Upper bound on a price filter, in USD. Not a business limit - the point is to
#: reject a nonsense value (`min_price=1e308`) at the edge rather than letting it
#: reach a NUMERIC comparison. The column holds 12 digits of precision, so this
#: is comfortably above any price the business could quote.
MAX_FILTER_PRICE = Decimal(10**9)


def _normalise_optional_facet(value: str | None) -> str | None:
    """Trim a facet, treating a blank value as absent rather than as a filter.

    A hand-edited or machine-built URL carries `?make=` far more often than it
    carries nothing at all, and `make=` means "no filter" to a human. Matching
    on the empty string instead would return an empty inventory and read as
    "there are no Toyotas", which is a materially different and wrong claim.
    """
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class VehicleFilterQuery(BaseModel):
    """Validated filter input for `GET /api/v1/vehicles`.

    Field-for-field mirror of `VehicleFilters` in
    `frontend/types/vehicle.ts`. Every field is optional and every field is
    absent-by-default, so the unfiltered request is byte-identical to the one
    this endpoint answered before filtering existed.

    Not frozen, and deliberately: it is constructed once per request by the
    route's dependency and then only read, so immutability would buy nothing
    here, and `PageParams` - the other query model in this project - is plain
    too.
    """

    query: str | None = Field(
        default=None,
        max_length=MAX_QUERY_LENGTH,
        description=(
            "Free text matched case-insensitively against make and model, as a "
            "substring. Omit for no text search."
        ),
    )
    make: str | None = Field(
        default=None,
        max_length=MAX_FACET_LENGTH,
        description="Exact make, matched case-insensitively. e.g. 'Toyota'.",
    )
    body_type: str | None = Field(
        default=None,
        max_length=MAX_FACET_LENGTH,
        description="Exact body type, case-insensitive. e.g. 'SUV'.",
    )
    fuel: str | None = Field(
        default=None,
        max_length=MAX_FACET_LENGTH,
        description="Exact fuel type, case-insensitive. e.g. 'Diesel'.",
    )
    transmission: str | None = Field(
        default=None,
        max_length=MAX_FACET_LENGTH,
        description="Exact transmission, case-insensitive. e.g. 'Automatic'.",
    )
    min_price: Decimal | None = Field(
        default=None,
        gt=0,
        le=MAX_FILTER_PRICE,
        description="Lowest asking price in USD, inclusive. Excludes 'price on request'.",
    )
    max_price: Decimal | None = Field(
        default=None,
        gt=0,
        le=MAX_FILTER_PRICE,
        description="Highest asking price in USD, inclusive. Excludes 'price on request'.",
    )
    min_year: int | None = Field(
        default=None,
        ge=EARLIEST_MODEL_YEAR,
        description="Earliest model year, inclusive.",
    )
    max_year: int | None = Field(
        default=None,
        ge=EARLIEST_MODEL_YEAR,
        description="Latest model year, inclusive.",
    )
    status: str | None = Field(
        default=None,
        description="Restrict to one availability state: available, reserved or sold.",
    )

    @field_validator("query", "make", "body_type", "fuel", "transmission")
    @classmethod
    def _blank_facet_is_absent(cls, value: str | None) -> str | None:
        return _normalise_optional_facet(value)

    @field_validator("status")
    @classmethod
    def _reject_unknown_status(cls, value: str | None) -> str | None:
        """An unknown state is a 422, never a silent empty result.

        Defaulting an unrecognised status to "no filter" would answer a request
        for `?status=avaliable` (note the typo) with the entire inventory,
        presenting a broken link as a working filter. Refusing names the mistake.
        """
        if value is None:
            return None
        normalised = value.strip().lower()
        if normalised == "":
            return None
        if normalised not in VEHICLE_AVAILABILITY_VALUES:
            raise ValueError(f"status must be one of {VEHICLE_AVAILABILITY_VALUES}.")
        return normalised

    def validated(self) -> VehicleFilterQuery:
        """Return self, for a caller that wants the cross-field checks run.

        Preferred path is `model_validator` below, which Pydantic turns into a
        `ValidationError` that FastAPI reports as a 422 like every other bad
        request. This method exists for a caller that already holds a validated
        instance and wants the ordering rules applied without going back through
        validation.
        """
        _check_filter_ranges(self)
        return self

    @model_validator(mode="after")
    def _check_ranges(self) -> VehicleFilterQuery:
        """Cross-field checks a `field_validator` cannot express.

        Pydantic validates one field at a time, so "min_price is greater than
        max_price" has nowhere to live in a `field_validator`. It lives here, and
        raising `ValueError` from a model validator is what lets Pydantic wrap it
        into the same `ValidationError` - and so the same `422` with the same
        `request_validation_error` envelope - as an out-of-range bound. A bare
        `ValueError` escaping a dependency would instead be a `500`, which is the
        wrong answer to a badly typed query string.
        """
        _check_filter_ranges(self)
        return self


def _check_filter_ranges(filters: VehicleFilterQuery) -> None:
    """Reject a minimum above its maximum, in both directions.

    Both are checked because `min_price=90000&max_price=` is the same mistake
    typed the other way round, and a filter that silently matches nothing is
    indistinguishable from a business that stocks nothing.
    """
    if (
        filters.min_price is not None
        and filters.max_price is not None
        and filters.min_price > filters.max_price
    ):
        raise ValueError("min_price cannot be greater than max_price.")

    if (
        filters.min_year is not None
        and filters.max_year is not None
        and filters.min_year > filters.max_year
    ):
        raise ValueError("min_year cannot be greater than max_year.")

    # The same plausibility bound `VehicleResponse` enforces on the way out,
    # applied on the way in, so a filter cannot ask for a year no vehicle has.
    latest = latest_plausible_model_year()
    if filters.min_year is not None and filters.min_year > latest:
        raise ValueError(f"min_year cannot be later than the next model year ({latest}).")

    if filters.max_year is not None and filters.max_year > latest:
        raise ValueError(f"max_year cannot be later than the next model year ({latest}).")

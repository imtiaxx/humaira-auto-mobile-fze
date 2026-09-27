"""Vehicle write schemas - staff-only request bodies.

Public responses live in :mod:`app.schemas.vehicle`. This module is their
mirror for the other direction: what a staff member may submit.

One set of rules, referenced not copied
---------------------------------------
Every rule here is expressed in terms of the constants the *model* already
declares - `SUPPORTED_VEHICLE_CURRENCY`, `VEHICLE_AVAILABILITY_VALUES`,
`EARLIEST_MODEL_YEAR` - and not by retyping `"USD"` or the three availability
strings. The alternative is two files that agree today and disagree after
someone adds a fourth availability state, at which point the write path accepts
a value the read path refuses to serialise and the vehicle vanishes from the
public site with no error anywhere.

The model still validates on assignment, and the CHECK constraints still fire on
flush. This layer exists to turn a mistake into a `422` with a useful message
before it reaches the database, not to be the only line of defence.

Two deliberate strictnesses
---------------------------
`extra="forbid"` rejects unknown fields outright, so a client cannot smuggle
`archived_at` or a future column through a create call. Mass assignment is not
an abstract concern here: `archived_at` *is* a column, and a form that posted it
would let an archived vehicle be resurrected by a create request.

`currency` is accepted but must be `USD`. It is deliberately *not* omitted from
the schema: an omitted field is silently ignored by Pydantic, so a client
posting `{"currency": "AED"}` would appear to succeed while quietly storing USD.
Accepting the field and refusing every value except USD turns that into an
explicit `422` - and the admin form does not render the control at all, because
there is one currency and a dropdown offering one option is a lie about choice.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, TypedDict

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
)

from app.db.models.vehicle import (
    EARLIEST_MODEL_YEAR,
    SUPPORTED_VEHICLE_CURRENCY,
    VEHICLE_AVAILABILITY_VALUES,
)
from app.schemas.vehicle import latest_plausible_model_year
from app.utils.time import as_utc

Slug = Annotated[str, Field(min_length=1, max_length=200)]
RequiredText = Annotated[str, Field(min_length=1, max_length=120)]
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
CurrencyLiteral = Literal["USD"]
AvailabilityLiteral = Literal["available", "reserved", "sold"]

#: Per-field length limits for the optional text columns, in one place so the
#: validator below has no per-field branching and the limits sit beside the
#: column definitions they mirror.
_OPTIONAL_LIMITS: dict[str, int] = {
    "variant": 120,
    "body_type": 60,
    "transmission": 60,
    "fuel": 60,
    "colour": 60,
    "location": 160,
}


def _collapse(value: str) -> str:
    """Strip and collapse internal runs of whitespace to single spaces."""
    return " ".join(value.split())


def _optional_collapsed(value: str | None, limit: int) -> str | None:
    """Collapse whitespace, and treat an all-whitespace value as absent.

    An HTML form posts `""` for a field the user cleared. Storing `""` would put
    an empty string where the schema promises `NULL` means "not recorded", and
    the frontend would render a blank specification row instead of omitting it.
    """
    if value is None:
        return None
    collapsed = _collapse(value)
    if not collapsed:
        return None
    if len(collapsed) > limit:
        raise ValueError(f"Must be {limit} characters or fewer.")
    return collapsed


class VehicleWriteBase(BaseModel):
    """Fields shared by create and update.

    `populate_by_name` lets a client post either `make`/`status` (the wire
    names) or `brand`/`availability` (the column names). The aliases are
    declared once here and the model validators normalise again on the way in,
    so the database is unaffected either way.
    """

    model_config = ConfigDict(populate_by_name=True, extra="forbid", str_strip_whitespace=True)

    slug: Slug
    # `make`/`status` are the wire names the frontend uses everywhere else;
    # `brand`/`availability` are the column names. Both are accepted on the way
    # in, because `serialization_alias` alone only renames the *output* - a
    # request posting `make` would be rejected as an unknown field unless the
    # input side is given an explicit `AliasChoices`.
    brand: RequiredText = Field(
        validation_alias=AliasChoices("brand", "make"),
        serialization_alias="make",
    )
    model: RequiredText
    variant: Annotated[str | None, Field(max_length=120)] = None
    year: int
    body_type: Annotated[str | None, Field(max_length=60)] = None
    transmission: Annotated[str | None, Field(max_length=60)] = None
    fuel: Annotated[str | None, Field(max_length=60)] = None
    colour: Annotated[str | None, Field(max_length=60)] = None
    mileage_km: Annotated[int | None, Field(ge=0)] = None
    vin: Annotated[str | None, Field(min_length=17, max_length=17)] = None
    price: Money | None = None
    currency: CurrencyLiteral = SUPPORTED_VEHICLE_CURRENCY
    availability: AvailabilityLiteral = Field(
        default="available",
        validation_alias=AliasChoices("availability", "status"),
        serialization_alias="status",
    )
    location: Annotated[str | None, Field(max_length=160)] = None
    features: Annotated[dict[str, str] | None, Field(max_length=60)] = None

    @field_validator("brand", "model")
    @classmethod
    def _require_non_blank(cls, value: str) -> str:
        collapsed = _collapse(value)
        if not collapsed:
            raise ValueError("This field is required and cannot be blank.")
        return collapsed

    @field_validator("variant", "body_type", "transmission", "fuel", "colour", "location")
    @classmethod
    def _normalise_optional_text(cls, value: str | None, info: ValidationInfo) -> str | None:
        return _optional_collapsed(value, _OPTIONAL_LIMITS.get(info.field_name or "", 120))

    @field_validator("year")
    @classmethod
    def _reject_implausible_year(cls, value: int) -> int:
        """Reject a year outside the range a real car could carry.

        Tracked against the calendar rather than pinned at import, so a form
        posted in 2027 cannot record a 2099 model year.
        """
        latest = latest_plausible_model_year()
        if not EARLIEST_MODEL_YEAR <= value <= latest:
            raise ValueError(f"Model year must be between {EARLIEST_MODEL_YEAR} and {latest}.")
        return value

    @field_validator("vin")
    @classmethod
    def _upper_vin(cls, value: str | None) -> str | None:
        return value.strip().upper() if value else None

    @field_validator("features")
    @classmethod
    def _clean_features(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        """Every feature row needs a label and a value, or it renders as blank.

        Rejecting beats filtering: silently dropping a row the user typed would
        look like a save that lost data.
        """
        if value is None:
            return None
        cleaned: dict[str, str] = {}
        for key, item in value.items():
            label = _collapse(key)
            if not label:
                raise ValueError("A feature row cannot have a blank name.")
            if len(label) > 60:
                raise ValueError("A feature name must be 60 characters or fewer.")
            content = _collapse(item)
            if not content:
                raise ValueError(f"Feature '{label}' needs a value.")
            if len(content) > 200:
                raise ValueError(f"Feature '{label}' must be 200 characters or fewer.")
            cleaned[label] = content
        return cleaned or None

    @field_validator("availability")
    @classmethod
    def _reject_unknown_availability(cls, value: str) -> str:
        """A state the frontend cannot render is rejected, never defaulted.

        The `Literal` already restricts this; the explicit check reads the value
        against the model constant so the two definitions cannot drift.
        """
        if value not in VEHICLE_AVAILABILITY_VALUES:
            raise ValueError(f"Availability must be one of {VEHICLE_AVAILABILITY_VALUES}.")
        return value


class VehicleCreate(VehicleWriteBase):
    """Body of `POST /api/v1/admin/vehicles`."""


class VehicleUpdate(VehicleWriteBase):
    """Body of `PATCH /api/v1/admin/vehicles/{id}`.

    Every field is required, exactly as on create. This is deliberate: an edit
    form always submits the complete record, so a partial update would only
    invite a caller to believe it can change one field and silently blank the
    rest. A genuinely partial edit is a future endpoint with its own contract,
    not a flag on this one.
    """


class VehicleImageAdminResponse(BaseModel):
    """A photograph, with the identifiers and ordering staff need."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    src: str
    alt: str
    width: int
    height: int
    position: int = Field(description="Display order. Position 0 is the primary image.")


class VehicleAdminResponse(BaseModel):
    """A vehicle as the staff surface sees it.

    The public response, plus what staff need and customers must not have: the
    archive timestamp, write timestamps, and the images with their positions and
    ids so the gallery can be reordered by identifier.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    brand: str = Field(serialization_alias="make")
    model: str
    variant: str | None = None
    year: int
    body_type: str | None = None
    transmission: str | None = None
    fuel: str | None = None
    colour: str | None = None
    mileage_km: Annotated[int | None, Field(ge=0)] = None
    vin: str | None = None
    price: float | None = None
    currency: str
    availability: str = Field(serialization_alias="status")
    location: str | None = None
    archived_at: datetime | None = Field(
        default=None, description="When the vehicle was withdrawn, or null while published."
    )
    created_at: datetime
    updated_at: datetime
    images: list[VehicleImageAdminResponse] = Field(default_factory=list)
    features: dict[str, str] | None = None

    @field_validator("archived_at", "created_at", "updated_at")
    @classmethod
    def _always_utc(cls, value: datetime | None) -> datetime | None:
        """Serialise every timestamp as UTC with an offset.

        Same reason as `VehicleArchiveResult._always_utc`: the value read back
        from SQLite has lost its offset, and a client should not have to accept
        two shapes for one field.
        """
        return as_utc(value) if value is not None else None

    @field_validator("currency")
    @classmethod
    def _reject_non_usd(cls, value: str) -> str:
        """Refuse to hand a staff client a row in a currency it cannot edit.

        The column carries a CHECK constraint, so this should be unreachable.
        It stays because the admin surface is the one place a bad row would be
        edited and re-saved rather than merely displayed.
        """
        if value != SUPPORTED_VEHICLE_CURRENCY:
            raise ValueError(f"Vehicle pricing must be {SUPPORTED_VEHICLE_CURRENCY}.")
        return value


class ImageOrderRequest(BaseModel):
    """Body of `PATCH /api/v1/admin/vehicles/{id}/images/order`.

    The complete new order, as a list of image ids. A full list rather than a
    move instruction because a partial one is ambiguous the moment two staff
    members reorder the same gallery at once: the second request would be
    resolving a move against an order the first had already replaced.
    """

    model_config = ConfigDict(extra="forbid")

    image_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=100)] = Field(
        description="Every image id for this vehicle, in the desired display order."
    )

    @field_validator("image_ids")
    @classmethod
    def _reject_duplicates(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        """A repeated id cannot be ordered.

        Rejected with a message rather than deduplicated, because a client that
        sends one twice has a bug, and quietly collapsing it would persist an
        order the caller did not ask for.
        """
        if len(set(value)) != len(value):
            raise ValueError("Each image may appear only once in the order.")
        return value


class ImageReorderResult(BaseModel):
    """The gallery after a reorder or a primary-image change."""

    images: list[VehicleImageAdminResponse]


class ImageUploadResult(BaseModel):
    """The gallery after one or more images were appended."""

    images: list[VehicleImageAdminResponse]
    created: int = Field(description="How many images this request added.")


class ImageDeleteResult(BaseModel):
    """Acknowledgement of an image deletion."""

    deleted: uuid.UUID
    images: list[VehicleImageAdminResponse] = Field(
        description="The remaining gallery, renumbered contiguously from 0."
    )


class VehicleArchiveResult(BaseModel):
    """Acknowledgement of an archive or restore."""

    # From attributes so the service can hand back the ORM row it just changed,
    # rather than reassembling the same five fields by hand.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    archived_at: datetime | None = None
    availability: str = Field(serialization_alias="status")

    @field_validator("archived_at")
    @classmethod
    def _always_utc(cls, value: datetime | None) -> datetime | None:
        """Serialise as UTC with an offset, whichever database produced it.

        Without this the same field arrives as `...Z` on the request that set it
        and as a bare `...` on the next one that reads it back, because SQLite
        drops the offset. A client would then have to accept two shapes for one
        field and guess whether a missing offset meant UTC or local time.
        """
        return as_utc(value) if value is not None else None


class InventorySummary(BaseModel):
    """Real counts for the staff dashboard.

    Every number is a `COUNT` over a table. No trend, no comparison and no
    percentage, because each of those needs history this schema does not have -
    and an invented trend line is a fabricated claim about the business.
    """

    total_published: int
    archived: int
    by_availability: dict[str, int]
    image_count: int


class VehicleColumns(TypedDict):
    """Exactly the `vehicles` columns a staff write is allowed to touch.

    A `TypedDict` rather than `dict[str, object]` so that indexing a field
    yields its real type - `price` is a `Decimal`, `vin` is `str | None` - and a
    rename or retyping in `VehicleWriteBase` becomes a type error at the call
    site rather than an `object` that needs casting at every use.

    `id`, `created_at`, `updated_at` and `archived_at` are absent by design.
    Archiving has its own endpoints, so a create or update body cannot set it,
    and `extra="forbid"` on the schema stops the field reaching this mapping at
    all.
    """

    slug: str
    brand: str
    model: str
    variant: str | None
    year: int
    body_type: str | None
    transmission: str | None
    fuel: str | None
    colour: str | None
    mileage_km: int | None
    vin: str | None
    price: Decimal | None
    currency: str
    availability: str
    location: str | None
    features: dict[str, str] | None

"""Staff-facing vehicle write operations.

Every rule that also applies to the public read path - USD only, positive price
or "on request", a real model year, a known availability state, a stable slug -
is enforced by the write schemas, the model validators and the CHECK
constraints. This module does not restate any of them. What it owns is the
things only a writer has to think about: uniqueness, the archive lifecycle, and
translating a constraint violation into an honest status code.

Archive rather than delete
--------------------------
There is no destructive operation here, deliberately. A published vehicle has a
live URL that may be in a search index, a WhatsApp thread and a bookmark, and
`vehicles` is the root of a tree that will grow inquiries and export requests
under it. Archiving hides it from the public API, keeps it editable, and
reverses in one update. Deleting a real business record should be a deliberate
decision with its own endpoint, its own confirmation and its own audit trail -
not a by-product of a button in an admin table.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.db.models.vehicle import Vehicle
from app.repositories.vehicle import VehicleRepository
from app.repositories.vehicle_image import VehicleImageRepository
from app.schemas.vehicle_write import (
    InventorySummary,
    VehicleAdminResponse,
    VehicleArchiveResult,
    VehicleColumns,
    VehicleCreate,
    VehicleUpdate,
)
from app.utils.pagination import Page, PageParams

logger = get_logger(__name__)

#: The columns a create or update is allowed to touch.
#:
#: An explicit allow-list rather than iterating the schema's own fields. It
#: means a column added to the model later - `archived_at` was added in this
#: same step, and it is the obvious example - is *not* writable through this
#: function until someone names it here. `id`, `created_at` and `updated_at` are
#: absent for the same reason.
_WRITABLE_COLUMNS: frozenset[str] = frozenset(
    {
        "slug",
        "brand",
        "model",
        "variant",
        "year",
        "body_type",
        "transmission",
        "fuel",
        "colour",
        "mileage_km",
        "vin",
        "price",
        "currency",
        "availability",
        "location",
        "features",
    }
)


async def create_vehicle(session: AsyncSession, payload: VehicleCreate) -> VehicleAdminResponse:
    """Add one vehicle, or raise `ConflictError` / `ValidationError`."""
    repository = VehicleRepository(session)
    values = _to_column_values(payload)

    await _assert_slug_available(repository, values["slug"])
    await _assert_vin_available(repository, values["vin"])

    vehicle = Vehicle(**values)
    repository.add(vehicle)
    await _flush_or_conflict(session, action="create")
    await _reload_vehicle(session, vehicle)

    logger.info("vehicle_created", extra={"vehicle_id": str(vehicle.id), "slug": vehicle.slug})
    return VehicleAdminResponse.model_validate(vehicle)


async def update_vehicle(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    payload: VehicleUpdate,
) -> VehicleAdminResponse:
    """Replace a vehicle's editable fields, including if it is archived.

    Archived vehicles remain fully editable, because the most common reason to
    edit one is to fix the thing that made it unsellable.
    """
    repository = VehicleRepository(session)
    vehicle = await repository.get_by_id(vehicle_id)
    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")

    values = _to_column_values(payload)
    await _assert_slug_available(repository, values["slug"], exclude_id=vehicle_id)
    await _assert_vin_available(repository, values["vin"], exclude_id=vehicle_id)

    try:
        await repository.update(vehicle, values)
    except IntegrityError as exc:
        # The pre-checks above close the common case; this closes the race
        # between two concurrent saves that both passed them.
        logger.warning("vehicle_update_conflict", extra={"vehicle_id": str(vehicle_id)})
        raise ConflictError("Another vehicle already uses that slug or VIN.") from exc

    await _reload_vehicle(session, vehicle)
    logger.info("vehicle_updated", extra={"vehicle_id": str(vehicle_id), "slug": vehicle.slug})
    return VehicleAdminResponse.model_validate(vehicle)


async def _reload_vehicle(session: AsyncSession, vehicle: Vehicle) -> None:
    """Re-read a vehicle row after a write, so it is safe to serialise.

    A flush leaves the ORM object in a state that cannot be read from inside
    `model_validate`:

    * `updated_at` is an `onupdate` column, so the flush expires it. Reading it
      triggers a query.
    * A vehicle **constructed** in Python and flushed has had no loader run for
      it at all, so `images` is unloaded too.
    * SQLAlchemy expires a `selectin`-loaded collection when the parent row
      changes, because it cannot know the child rows were untouched.

    In async SQLAlchemy any of those raises `MissingGreenlet` rather than
    quietly yielding a default - so without this, "edit a vehicle" is a 500 on
    every single save, and the failure points at a response model rather than at
    the flush that caused it.

    A full `refresh` rather than a targeted attribute list, precisely because a
    targeted list is what let `updated_at` through the first time.

    One extra query per write, and only on writes; reads rely on `selectin`.
    """
    await session.refresh(vehicle)


async def archive_vehicle(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    now: datetime | None = None,
) -> VehicleArchiveResult:
    """Withdraw a vehicle from public sale.

    Idempotent: archiving an already-archived vehicle reports the existing
    timestamp rather than moving it. A second click on an "Archive" button, or a
    retry after a dropped connection, should not silently restamp the record and
    make it look like a fresh decision.
    """
    repository = VehicleRepository(session)
    vehicle = await repository.get_by_id(vehicle_id)
    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")

    if vehicle.archived_at is None:
        vehicle.archived_at = now or datetime.now(UTC)
        await repository.flush()
        logger.info("vehicle_archived", extra={"vehicle_id": str(vehicle_id)})

    return VehicleArchiveResult.model_validate(vehicle)


async def restore_vehicle(session: AsyncSession, *, vehicle_id: uuid.UUID) -> VehicleArchiveResult:
    """Return an archived vehicle to public sale.

    Idempotent, for the same reason `archive_vehicle` is.
    """
    repository = VehicleRepository(session)
    vehicle = await repository.get_by_id(vehicle_id)
    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")

    if vehicle.archived_at is not None:
        vehicle.archived_at = None
        await repository.flush()
        logger.info("vehicle_restored", extra={"vehicle_id": str(vehicle_id)})

    return VehicleArchiveResult.model_validate(vehicle)


async def get_vehicle_for_staff(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
) -> VehicleAdminResponse:
    """One vehicle for the admin surface, archived or not, or `NotFoundError`."""
    repository = VehicleRepository(session)
    vehicle = await repository.get_by_id(vehicle_id)
    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")
    return VehicleAdminResponse.model_validate(vehicle)


async def summarise_inventory(session: AsyncSession) -> InventorySummary:
    """Real row counts for the dashboard.

    Every value here is a `COUNT`. There is no growth figure and no
    period-over-period comparison, because the schema has no history to compute
    one from - and a chart of invented numbers on a business dashboard is worse
    than no chart.
    """
    repository = VehicleRepository(session)
    images = VehicleImageRepository(session)

    return InventorySummary(
        total_published=await repository.count_published(),
        archived=await repository.count_archived(),
        by_availability=await repository.count_by_availability(include_archived=False),
        image_count=await images.count_all(),
    )


async def list_vehicles_for_staff_page(
    session: AsyncSession,
    params: PageParams | None = None,
) -> Page[VehicleAdminResponse]:
    """One page of vehicles for the staff list, archived included.

    The only difference from `app.services.vehicles.list_vehicles` is
    `include_archived=True` and the wider response shape. Both go through the
    same repository predicate switch rather than a second query written here, so
    "what staff see" and "what the public sees" cannot drift apart - the
    difference is one argument, in one place.

    Staff need archived rows in the list because the most common reason to open
    one is to restore it, or to fix whatever made it unsellable.
    """
    pagination = params or PageParams()
    repository = VehicleRepository(session)
    vehicles, total = await repository.list_paginated(pagination, include_archived=True)

    return Page.build(
        [VehicleAdminResponse.model_validate(vehicle) for vehicle in vehicles],
        total=total,
        params=pagination,
    )


def _to_column_values(payload: VehicleCreate | VehicleUpdate) -> VehicleColumns:
    """Map the request body onto model columns, refusing anything not allowed.

    Written out field by field rather than `dict(payload)`. That verbosity is the
    point: it is a whitelist, so a column added to the model later is not
    writable through this function until someone adds it here deliberately.
    `archived_at` is the concrete example - it exists on the model and is
    reachable from neither this function nor any request body.
    """
    values: VehicleColumns = {
        "slug": payload.slug,
        "brand": payload.brand,
        "model": payload.model,
        "variant": payload.variant,
        "year": payload.year,
        "body_type": payload.body_type,
        "transmission": payload.transmission,
        "fuel": payload.fuel,
        "colour": payload.colour,
        "mileage_km": payload.mileage_km,
        "vin": payload.vin,
        "price": payload.price,
        "currency": payload.currency,
        "availability": payload.availability,
        "location": payload.location,
        "features": payload.features,
    }
    if set(values) != _WRITABLE_COLUMNS:  # pragma: no cover - guards a future edit
        raise ValueError(
            "The vehicle writer and its whitelist disagree: "
            f"{sorted(set(values) ^ _WRITABLE_COLUMNS)}"
        )
    return values


async def _assert_slug_available(
    repository: VehicleRepository,
    slug: str,
    *,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Reject a slug that is already in use.

    The slug is a public URL, so a duplicate would make one of the two vehicles
    unreachable - and which one wins would depend on query order. `UNIQUE` on
    the column is the real guarantee; this turns it into a `409` with a message
    a staff member can act on.
    """
    if await repository.slug_exists(slug, exclude_id=exclude_id):
        raise ConflictError(
            f"The URL '{slug}' is already used by another vehicle. Choose a different one."
        )


async def _assert_vin_available(
    repository: VehicleRepository,
    vin: str | None,
    *,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Reject a VIN already recorded against another vehicle.

    A VIN identifies one physical car. Two vehicles claiming the same one means
    the data is wrong, whichever row is the liar.
    """
    if vin and await repository.vin_exists(vin, exclude_id=exclude_id):
        raise ConflictError("That VIN is already recorded against another vehicle.")


async def _flush_or_conflict(session: AsyncSession, *, action: str) -> None:
    """Flush, converting a uniqueness violation into a `ConflictError`."""
    try:
        await session.flush()
    except IntegrityError as exc:
        logger.warning("vehicle_write_conflict", extra={"action": action})
        raise ConflictError("Another vehicle already uses that slug or VIN.") from exc

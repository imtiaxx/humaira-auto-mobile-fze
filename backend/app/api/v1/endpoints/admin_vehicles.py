"""Staff vehicle management endpoints.

Every route here requires `CurrentStaff`, so none of them is reachable without a
live session belonging to an active staff account. An anonymous caller gets
`401`; a signed-in non-staff caller gets `403`. Neither response contains a
database detail, and neither says which of the two conditions applied to a caller
who is neither.

Why a separate `/admin` namespace
---------------------------------
Step 10 made `GET /api/v1/vehicles` strictly read-only, and its test suite pins
that a `POST` to that path returns `405` with `Allow: GET`. Extending the public
resource with `PATCH` and `DELETE` would have been a smaller URL surface, but it
would have put a privileged write on the same path as a public read - so a
mistake in a single route decorator would put a write in front of the public
internet. Keeping privileged operations under `/admin` means the public resource
stays read-only by construction, and the two families can be reasoned about
separately. This is the arrangement `docs/architecture.md` planned.

No destructive delete
---------------------
There is no `DELETE /vehicles/{id}`. Withdrawing a vehicle is
`POST /{id}/archive`, and reversing it is `POST /{id}/restore`. A `DELETE` that
silently archives is a lie in the HTTP contract, and a `DELETE` that really
deletes is a decision that belongs behind its own confirmation and audit trail -
see the module docstring in `app.services.vehicle_admin`.

Route order matters here
------------------------
`/-/summary` is declared **before** `/{vehicle_id}`. FastAPI matches in
declaration order, so a `/{uuid}` route declared first would capture the literal
segment `summary` and reject it as an invalid UUID with a `422`, and the
dashboard would appear broken. The `/-/` prefix is a further guard: no UUID can
ever begin with `-`, so the two can never be confused.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, status

from app.api.deps import CurrentStaff, DbWriteSession
from app.schemas.vehicle_write import (
    InventorySummary,
    VehicleAdminResponse,
    VehicleArchiveResult,
    VehicleCreate,
    VehicleUpdate,
)
from app.services.vehicle_admin import (
    archive_vehicle,
    create_vehicle,
    get_vehicle_for_staff,
    list_vehicles_for_staff_page,
    restore_vehicle,
    summarise_inventory,
    update_vehicle,
)
from app.utils.pagination import Page, PageParams, page_params

router = APIRouter(prefix="/admin/vehicles", tags=["admin:vehicles"])

VehicleIdPath = Annotated[
    uuid.UUID,
    Path(description="Identifier of the vehicle."),
]

# Annotated rather than left to inference: FastAPI's `responses` parameter is
# `dict[int | str, dict[str, Any]]`, and an inferred `dict[int, dict[str, str]]`
# is too narrow to unpack into a per-route dict that adds a 404 or 409.
_Responses = dict[int | str, dict[str, Any]]

_UNAUTHORISED: _Responses = {
    status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."},
    status.HTTP_403_FORBIDDEN: {"description": "The account is not staff."},
}
_NOT_FOUND: _Responses = {status.HTTP_404_NOT_FOUND: {"description": "No such vehicle."}}


@router.get(
    "",
    response_model=Page[VehicleAdminResponse],
    summary="List vehicles for staff, including archived",
    description=(
        "Returns one page of vehicles in the shared `Page<T>` envelope, "
        "**including archived ones** - unlike the public list, which hides them.\n\n"
        "Staff need to see archived vehicles because the most common reason to "
        "open one is to restore it, or to fix whatever made it unsellable."
    ),
    responses=_UNAUTHORISED,
)
async def list_vehicles_for_staff(
    params: Annotated[PageParams, Depends(page_params)],
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> Page[VehicleAdminResponse]:
    """One page of vehicles, archived included."""
    return await list_vehicles_for_staff_page(session, params)


@router.get(
    "/-/summary",
    response_model=InventorySummary,
    summary="Inventory counts for the dashboard",
    description=(
        "Real `COUNT` queries: how many vehicles are published, how many are "
        "archived, a breakdown by availability, and how many images exist in "
        "total.\n\n"
        "There is no trend, no growth figure and no percentage here, because the "
        "schema keeps no history to compute one from. An invented number on a "
        "business dashboard is worse than a missing one."
    ),
    responses=_UNAUTHORISED,
)
async def get_summary(_staff: CurrentStaff, session: DbWriteSession) -> InventorySummary:
    """Counts for the staff dashboard."""
    return await summarise_inventory(session)


@router.get(
    "/{vehicle_id}",
    response_model=VehicleAdminResponse,
    summary="Get one vehicle for staff",
    description="Returns a vehicle whether or not it is archived.",
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def get_vehicle(
    vehicle_id: VehicleIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> VehicleAdminResponse:
    """One vehicle, archived or not."""
    return await get_vehicle_for_staff(session, vehicle_id=vehicle_id)


@router.post(
    "",
    response_model=VehicleAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a vehicle",
    description=(
        "Creates one vehicle.\n\n"
        "Prices are **USD only**: the request is rejected unless `currency` is "
        "`USD`, and a `price` of `0` is rejected rather than stored - use `null` "
        'for "price on request". A model year outside a plausible range, a '
        "negative odometer reading and an unknown availability state are all "
        "rejected.\n\n"
        "A `slug` or `vin` already in use returns `409`. The slug is the public "
        "URL, so two vehicles sharing one would make one of them unreachable.\n\n"
        "Images are managed separately, through this vehicle's `/images` routes."
    ),
    responses={
        **_UNAUTHORISED,
        **_NOT_FOUND,
        status.HTTP_409_CONFLICT: {"description": "Slug or VIN already in use."},
    },
)
async def post_vehicle(
    payload: VehicleCreate,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> VehicleAdminResponse:
    """Create a vehicle."""
    created = await create_vehicle(session, payload)
    await session.commit()
    return created


@router.patch(
    "/{vehicle_id}",
    response_model=VehicleAdminResponse,
    summary="Edit a vehicle",
    description=(
        "Replaces a vehicle's editable fields.\n\n"
        "Every field is required, exactly as on create, because the admin form "
        "always submits the whole record. Archived vehicles remain editable.\n\n"
        "Validation is identical to creation: USD only, no zero price, a "
        "plausible model year, a non-negative odometer reading, and a slug or "
        "VIN not already used by another vehicle."
    ),
    responses={
        **_UNAUTHORISED,
        **_NOT_FOUND,
        status.HTTP_409_CONFLICT: {"description": "Slug or VIN already in use."},
    },
)
async def patch_vehicle(
    vehicle_id: VehicleIdPath,
    payload: VehicleUpdate,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> VehicleAdminResponse:
    """Update a vehicle."""
    updated = await update_vehicle(session, vehicle_id=vehicle_id, payload=payload)
    await session.commit()
    return updated


@router.post(
    "/{vehicle_id}/archive",
    response_model=VehicleArchiveResult,
    summary="Withdraw a vehicle from public sale",
    description=(
        "Marks a vehicle as archived. It disappears from the public list and its "
        "public page returns `404`, while the record, its images and its history "
        "are kept and remain editable here.\n\n"
        "Idempotent: archiving an already-archived vehicle keeps the original "
        "timestamp rather than restamping it."
    ),
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def post_archive(
    vehicle_id: VehicleIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> VehicleArchiveResult:
    """Archive a vehicle."""
    result = await archive_vehicle(session, vehicle_id=vehicle_id)
    await session.commit()
    return result


@router.post(
    "/{vehicle_id}/restore",
    response_model=VehicleArchiveResult,
    summary="Return an archived vehicle to public sale",
    description=(
        "Clears the archive timestamp, putting the vehicle back in the public "
        "list and restoring its public page. Idempotent."
    ),
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def post_restore(
    vehicle_id: VehicleIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> VehicleArchiveResult:
    """Restore a vehicle."""
    result = await restore_vehicle(session, vehicle_id=vehicle_id)
    await session.commit()
    return result

"""Public vehicle inventory endpoints.

Read-only by design. This step publishes what Humaira Automobile actually has
in stock and nothing else: there is no POST, PUT or PATCH here, no admin
router, and no way to create a vehicle over HTTP. Inventory is entered through
the database by staff, which is the correct shape for a step with no
authenticated surface yet - an unauthenticated write endpoint on a public API
would be an invitation, not a feature.

Both routes return the shapes the frontend declared in Step 9, before this
endpoint existed: `Page<VehicleRecord>` and a single `VehicleRecord`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_read_session
from app.schemas.vehicle import VehicleResponse
from app.services.vehicles import get_vehicle_by_slug, list_vehicles
from app.utils.pagination import Page, PageParams, page_params

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

#: Bound on the slug path segment.
#:
#: 422 rather than 404 for an over-long segment, which is the honest answer: the
#: request is malformed, not merely unmatched. A cap is here so an unbounded
#: string cannot be used to probe the index. Everything shorter reaches the
#: repository and 404s normally, because a mistyped slug is a missing vehicle,
#: not a bad request.
SLUG_MAX_LENGTH = 200

DbReadSession = Annotated[AsyncSession, Depends(get_db_read_session)]

SlugPath = Annotated[
    str,
    Path(
        max_length=SLUG_MAX_LENGTH,
        description="URL segment of the vehicle, e.g. `toyota-land-cruiser`.",
        examples=["toyota-land-cruiser"],
    ),
]


@router.get(
    "",
    response_model=Page[VehicleResponse],
    summary="List vehicles",
    description=(
        "Returns one page of vehicles, newest listings first, in the shared "
        "`Page<T>` envelope.\n\n"
        "An empty inventory is a normal response: `items` is `[]` and `total` "
        "is `0`. It is not an error, and it is what the public site renders as "
        "its empty state.\n\n"
        "Prices are quoted in **USD only** and are never converted. A vehicle "
        "whose price has not been agreed returns `price: null`, which the "
        'frontend renders as "Price on request".\n\n'
        "There is no filtering, sorting or search parameter. The inventory page "
        "renders every vehicle in the response, so one page is always the whole "
        "published inventory."
    ),
)
async def get_vehicles(
    params: Annotated[PageParams, Depends(page_params)],
    session: DbReadSession,
) -> Page[VehicleResponse]:
    return await list_vehicles(session, params)


@router.get(
    "/{slug}",
    response_model=VehicleResponse,
    summary="Get one vehicle by slug",
    description=(
        "Returns a single vehicle identified by the same slug used in the "
        "public URL `/inventory/<slug>`. Matching is case-insensitive.\n\n"
        "An unknown slug returns `404` with the standard error envelope and a "
        "`not_found` code. No internal detail is included: the response says "
        "the vehicle was not found and nothing else."
    ),
    responses={status.HTTP_404_NOT_FOUND: {"description": "No vehicle matches that slug."}},
)
async def get_vehicle(slug: SlugPath, session: DbReadSession) -> VehicleResponse:
    return await get_vehicle_by_slug(session, slug)

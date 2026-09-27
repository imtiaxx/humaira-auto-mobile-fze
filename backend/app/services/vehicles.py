"""Vehicle inventory business logic.

Separated from the route for the same reason `app/services/health.py` is: the
same read can be called from a management command, a cache warmer or a future
export job without an HTTP request, and it can be tested without spinning up
the ASGI app.

The one behaviour worth reading carefully is `list_vehicles`. A single row that
cannot be represented honestly is dropped rather than served, and the endpoint
answers with the rest of the page.
"""

from __future__ import annotations

from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.db.models.vehicle import Vehicle
from app.repositories.vehicle import VehicleRepository
from app.schemas.vehicle import VehicleResponse
from app.utils.pagination import Page, PageParams

logger = get_logger(__name__)


def _to_responses(vehicles: Sequence[Vehicle]) -> tuple[list[VehicleResponse], int]:
    """Serialise rows, dropping any that fail the response contract.

    The database constrains currency, price, availability, year and mileage, so
    a row that cannot be serialised should be close to impossible. It is still
    handled, and handled the way the frontend boundary handles the same problem:
    one unusable record costs one vehicle, not the page.

    Failing the whole request instead would be worse for a customer and better
    for nobody - it would turn a single corrupt row into an empty inventory
    plus an incident. The count is logged so the disagreement is visible to an
    operator rather than silently absorbed.
    """
    responses: list[VehicleResponse] = []
    rejected = 0

    for vehicle in vehicles:
        try:
            responses.append(VehicleResponse.model_validate(vehicle))
        except ValidationError as exc:
            rejected += 1
            logger.warning(
                "vehicle_row_rejected",
                extra={"vehicle_id": str(vehicle.id), "slug": vehicle.slug, "detail": exc.errors()},
            )

    if rejected:
        logger.warning("vehicle_rows_rejected", extra={"rejected": rejected})

    return responses, rejected


async def list_vehicles(
    session: AsyncSession,
    params: PageParams | None = None,
) -> Page[VehicleResponse]:
    """One page of vehicles in the shared `Page<T>` envelope.

    An empty table is not an error and not a special case: it returns the same
    envelope with `items: []` and `total: 0`, which is the shape the frontend's
    empty state already expects and the only truthful representation of a
    business that has not published stock yet.
    """
    pagination = params or PageParams()
    repository = VehicleRepository(session)
    vehicles, total = await repository.list_paginated(pagination)
    responses, _rejected = _to_responses(vehicles)

    return Page.build(responses, total=total, params=pagination)


async def get_vehicle_by_slug(session: AsyncSession, slug: str) -> VehicleResponse:
    """One vehicle, or `NotFoundError`.

    Raising the shared `NotFoundError` rather than returning `None` keeps the
    404 body identical to every other missing resource in this API - same
    envelope, same `not_found` code, same request id - so the frontend's
    `ApiError` path needs no special case for vehicles.
    """
    repository = VehicleRepository(session)
    vehicle = await repository.get_by_slug(slug)

    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")

    try:
        return VehicleResponse.model_validate(vehicle)
    except ValidationError as exc:
        # Reachable only if a row is corrupt in a way the database does not
        # constrain. Reported as 404 rather than 500: a vehicle this API cannot
        # describe honestly does not exist as far as a customer is concerned,
        # and a 500 would be a false claim that the site is malfunctioning.
        logger.error(
            "vehicle_row_unserialisable",
            extra={"vehicle_id": str(vehicle.id), "slug": vehicle.slug, "detail": exc.errors()},
        )
        raise NotFoundError("No vehicle matches that identifier.") from exc

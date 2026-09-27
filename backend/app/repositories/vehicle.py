"""Vehicle repository.

The first concrete repository in the project. It exists because the vehicle
list query has real behaviour to encapsulate - deterministic ordering, a
case-insensitive slug lookup and images loaded in one extra query rather than
one per row - and putting that in a route handler would make it untestable
without HTTP.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import asc, desc, func, select

from app.db.models.vehicle import Vehicle
from app.repositories.base import BaseRepository
from app.utils.pagination import PageParams


def listing_order() -> tuple[Any, ...]:
    """Newest listings first, with a deterministic tie-break.

    Ordering by `created_at` alone would be ambiguous: two vehicles inserted in
    the same transaction share a timestamp, and a page boundary falling between
    two rows of the same timestamp can repeat or skip a vehicle. The primary key
    breaks the tie, so page N is stable for a given dataset.

    "Newest first" is the order a dealer adds stock in and the order a customer
    expects to see new arrivals. It is a presentation decision, so it lives here
    rather than being left to whatever order the table happens to return.

    Typed as `tuple[Any, ...]` because SQLAlchemy's `order_by` accepts a mix of
    `UnaryExpression` and `ColumnElement` and a narrower annotation is not
    accurate across versions.
    """
    return (desc(Vehicle.created_at), asc(Vehicle.id))


class VehicleRepository(BaseRepository[Vehicle]):
    """Read access to public vehicle inventory.

    The write methods inherited from `BaseRepository` are unused. This step adds
    no admin surface and no way to create a vehicle over HTTP, so nothing in the
    running application can insert a row.
    """

    model = Vehicle

    async def list_paginated(self, params: PageParams) -> tuple[Sequence[Vehicle], int]:
        """One page of vehicles, plus the total matching count.

        The count is a second query rather than a window function so the same
        code path works on every supported database, and it is paid once per
        request.

        With no filters this reads in whatever order the table is scanned,
        bounded by `LIMIT`. That is correct at the current scale of zero rows;
        the filter indexes named in `docs/architecture.md` belong with the
        filtering step, not before it.
        """
        result = await self._session.scalars(
            select(Vehicle).order_by(*listing_order()).limit(params.limit).offset(params.offset)
        )
        vehicles = result.all()

        total_result = await self._session.execute(select(func.count()).select_from(Vehicle))
        total = int(total_result.scalar_one())

        return vehicles, total

    async def get_by_slug(self, slug: str) -> Vehicle | None:
        """One vehicle by its URL slug, matched case-insensitively.

        Slugs are stored lowercase by the model validator, but URLs get typed,
        copied and upper-cased by visitors, and `getVehicleBySlug()` on the
        frontend already compares lower-cased on both sides. Matching that way
        here too means a hand-typed address resolves instead of 404ing.

        The comparison uses `lower()` rather than normalising the input, so a
        stored slug that somehow contains an upper-case character is still found
        rather than becoming unreachable.
        """
        result = await self._session.scalars(
            select(Vehicle).where(func.lower(Vehicle.slug) == slug.strip().lower())
        )
        return result.first()

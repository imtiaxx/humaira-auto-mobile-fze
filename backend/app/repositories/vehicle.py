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

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.db.models.vehicle import Vehicle
from app.repositories.base import BaseRepository
from app.schemas.vehicle import VehicleFilterQuery
from app.utils.pagination import PageParams

#: Escape character for the `LIKE`/`ILIKE` patterns built from user text.
#:
#: SQLAlchemy's `ilike()` emits `ILIKE` on PostgreSQL and `lower(x) LIKE lower(y)`
#: on SQLite, which is what lets one expression serve the application and the
#: SQLite-backed test suite. Both honour an `ESCAPE` clause, and both need one:
#: without escaping, a visitor typing `%` gets a pattern that matches every row,
#: and `_` matches any single character. That is a search box that reports
#: "everything matches" for a keystroke, and an unindexed scan behind it.
LIKE_ESCAPE = "\\"


def _like_term(value: str) -> str:
    """Wrap a value in `%` wildcards with its own wildcards neutralised."""
    escaped = (
        value.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", f"{LIKE_ESCAPE}%")
        .replace("_", f"{LIKE_ESCAPE}_")
    )
    return f"%{escaped}%"


def vehicle_filter_clauses(filters: VehicleFilterQuery | None) -> list[ColumnElement[bool]]:
    """Translate validated filters into WHERE predicates.

    A list rather than a single expression so the caller composes it with its own
    visibility predicate and, critically, hands the *same* list to the row query
    and the count query. A total that counts a different set than the page
    returns is how a paginator ends up advertising vehicles that never appear.

    Every predicate is skipped when its filter is absent, so an all-`None`
    `VehicleFilterQuery` produces an empty list and the unfiltered query is
    byte-identical to the one this repository ran before filtering existed.

    Facet comparisons are case-insensitive equality rather than substring
    matching, because these columns are an enumeration in all but name and a
    substring match on "Petrol" would also match a hypothetical "Petrol-Electric"
    when the caller asked for petrol. Free text is the opposite case and is
    deliberately a substring match, because that is what a search box is for.
    """
    if filters is None:
        return []

    clauses: list[ColumnElement[bool]] = []

    if filters.query:
        term = _like_term(filters.query)
        clauses.append(
            or_(
                Vehicle.brand.ilike(term, escape=LIKE_ESCAPE),
                Vehicle.model.ilike(term, escape=LIKE_ESCAPE),
            )
        )

    # `lower()` on both sides rather than `ilike()` with no wildcard: this is an
    # equality test, and expressing it as one keeps the index usable. `ilike` with
    # a bare value would be a case-insensitive equality in PostgreSQL but a
    # `lower() LIKE` comparison in SQLite, which will not use a plain btree
    # index on the raw column.
    for value, column in (
        (filters.make, Vehicle.brand),
        (filters.body_type, Vehicle.body_type),
        (filters.fuel, Vehicle.fuel),
        (filters.transmission, Vehicle.transmission),
    ):
        if value:
            clauses.append(func.lower(column) == value.lower())

    if filters.status:
        clauses.append(Vehicle.availability == filters.status)

    # `IS NULL` is never matched by a comparison, so a price or year bound
    # excludes an unpriced vehicle rather than accidentally including it. That is
    # the documented behaviour, and the module docstring on filtering says so.
    if filters.min_price is not None:
        clauses.append(Vehicle.price >= filters.min_price)
    if filters.max_price is not None:
        clauses.append(Vehicle.price <= filters.max_price)
    if filters.min_year is not None:
        clauses.append(Vehicle.year >= filters.min_year)
    if filters.max_year is not None:
        clauses.append(Vehicle.year <= filters.max_year)

    return clauses


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
    """Read access to vehicle inventory, public and staff-only.

    `include_archived` is the single switch between the two audiences. It is a
    parameter rather than two near-duplicate methods because the difference
    between them *is* one predicate, and a duplicated query would be free to
    drift away from it.
    """

    model = Vehicle

    async def list_paginated(
        self,
        params: PageParams,
        *,
        include_archived: bool = False,
        filters: VehicleFilterQuery | None = None,
    ) -> tuple[Sequence[Vehicle], int]:
        """One page of vehicles, plus the total matching count.

        The count is a second query rather than a window function so the same
        code path works on every supported database, and it is paid once per
        request.

        `filters` narrows both the rows and the count, from one predicate list
        built by `vehicle_filter_clauses`, so the two cannot disagree.

        `include_archived=False` is the public behaviour and the default: an
        archived vehicle has been withdrawn from sale, and a customer browsing
        inventory must not be offered a car the business is not selling. The
        count applies the same predicate as the rows, because a total that
        includes hidden rows would make the paginator advertise vehicles that
        never appear.

        The staff list passes `include_archived=True` and no filters: an editor
        looking for a car to restore must be able to find it by whatever they
        remember about it, including the parts that no longer match the published
        data.
        """
        clauses: list[ColumnElement[bool]] = []
        if not include_archived:
            clauses.append(Vehicle.archived_at.is_(None))
        clauses.extend(vehicle_filter_clauses(filters))

        result = await self._session.scalars(
            select(Vehicle)
            .where(*clauses)
            .order_by(*listing_order())
            .limit(params.limit)
            .offset(params.offset)
        )
        vehicles = result.all()

        total_result = await self._session.execute(
            select(func.count()).select_from(Vehicle).where(*clauses)
        )
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

        Archived vehicles are still returned. The public service filters them
        out on purpose - see `list_paginated` - but staff must still be able to
        open an archived vehicle to restore it.
        """
        result = await self._session.scalars(
            select(Vehicle).where(func.lower(Vehicle.slug) == slug.strip().lower())
        )
        return result.first()

    async def get_live_by_slug(self, slug: str) -> Vehicle | None:
        """One published vehicle by slug, or `None` if absent or archived."""
        result = await self._session.scalars(
            select(Vehicle).where(
                func.lower(Vehicle.slug) == slug.strip().lower(),
                Vehicle.archived_at.is_(None),
            )
        )
        return result.first()

    async def slug_exists(self, slug: str, *, exclude_id: object | None = None) -> bool:
        """Whether a slug is already taken.

        Checked before insert so a duplicate slug returns a clean 409 instead of
        surfacing as an `IntegrityError` and a 500. The unique constraint stays:
        this check closes the common case, the constraint closes the race
        between two concurrent requests both passing the check.
        """
        statement = select(Vehicle.id).where(func.lower(Vehicle.slug) == slug.strip().lower())
        if exclude_id is not None:
            statement = statement.where(Vehicle.id != exclude_id)
        result = await self._session.scalars(statement.limit(1))
        return result.first() is not None

    async def vin_exists(self, vin: str, *, exclude_id: object | None = None) -> bool:
        """Whether a VIN is already recorded. See `slug_exists` for the rationale."""
        statement = select(Vehicle.id).where(Vehicle.vin == vin.strip().upper())
        if exclude_id is not None:
            statement = statement.where(Vehicle.id != exclude_id)
        result = await self._session.scalars(statement.limit(1))
        return result.first() is not None

    async def count_by_availability(self, *, include_archived: bool = False) -> dict[str, int]:
        """Row counts grouped by availability, for the staff dashboard.

        Returns only the states that exist, so a caller iterating the result
        shows a real zero rather than a fabricated one.
        """
        filters = [] if include_archived else [Vehicle.archived_at.is_(None)]
        rows = await self._session.execute(
            select(Vehicle.availability, func.count())
            .where(*filters)
            .group_by(Vehicle.availability)
        )
        return {str(availability): int(count) for availability, count in rows.all()}

    async def count_published(self) -> int:
        """How many vehicles are visible to the public.

        Distinct from the inherited `count()`, which counts every row. The
        dashboard needs the live number, and "published" is not "total" - once
        archiving exists, the difference is exactly what an operator is trying to
        read off the screen.
        """
        result = await self._session.execute(
            select(func.count()).select_from(Vehicle).where(Vehicle.archived_at.is_(None))
        )
        return int(result.scalar_one())

    async def count_archived(self) -> int:
        """How many vehicles are withdrawn from public sale."""
        result = await self._session.execute(
            select(func.count()).select_from(Vehicle).where(Vehicle.archived_at.is_not(None))
        )
        return int(result.scalar_one())

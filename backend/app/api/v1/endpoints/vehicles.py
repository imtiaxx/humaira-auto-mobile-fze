"""Public vehicle inventory endpoints.

Read-only by design. This step publishes what Humaira Automobile actually has
in stock and nothing else: there is no POST, PUT or PATCH here, no admin
router, and no way to create a vehicle over HTTP. Inventory is entered through
the database by staff, which is the correct shape for a step with no
authenticated surface yet - an unauthenticated write endpoint on a public API
would be an invitation, not a feature.

Both routes return the shapes the frontend declared in Step 9, before this
endpoint existed: `Page<VehicleRecord>` and a single `VehicleRecord`.

Filtering was added later, as query parameters on the list route only. The
detail route is deliberately unfiltered: a slug addresses exactly one vehicle, so
a filter beside it could only ever return an empty result for a car that
demonstrably exists.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_read_session
from app.core.errors import ValidationError
from app.db.models.vehicle import EARLIEST_MODEL_YEAR
from app.schemas.vehicle import (
    MAX_FACET_LENGTH,
    MAX_FILTER_PRICE,
    MAX_QUERY_LENGTH,
    VehicleFilterQuery,
    VehicleResponse,
)
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


def vehicle_filters(
    query: Annotated[
        str | None,
        Query(
            max_length=MAX_QUERY_LENGTH,
            description=(
                "Free text matched case-insensitively against make and model, as a substring."
            ),
        ),
    ] = None,
    make: Annotated[
        str | None, Query(max_length=MAX_FACET_LENGTH, description="Exact make, e.g. 'Toyota'.")
    ] = None,
    body_type: Annotated[
        str | None, Query(max_length=MAX_FACET_LENGTH, description="Exact body type, e.g. 'SUV'.")
    ] = None,
    fuel: Annotated[
        str | None,
        Query(max_length=MAX_FACET_LENGTH, description="Exact fuel type, e.g. 'Diesel'."),
    ] = None,
    transmission: Annotated[
        str | None,
        Query(max_length=MAX_FACET_LENGTH, description="Exact transmission, e.g. 'Automatic'."),
    ] = None,
    min_price: Annotated[
        Decimal | None,
        Query(gt=0, le=MAX_FILTER_PRICE, description="Lowest asking price in USD, inclusive."),
    ] = None,
    max_price: Annotated[
        Decimal | None,
        Query(gt=0, le=MAX_FILTER_PRICE, description="Highest asking price in USD, inclusive."),
    ] = None,
    min_year: Annotated[
        int | None, Query(ge=EARLIEST_MODEL_YEAR, description="Earliest model year, inclusive.")
    ] = None,
    max_year: Annotated[
        int | None, Query(ge=EARLIEST_MODEL_YEAR, description="Latest model year, inclusive.")
    ] = None,
    status: Annotated[
        str | None,
        Query(description="Restrict to one availability state: available, reserved or sold."),
    ] = None,
) -> VehicleFilterQuery:
    """FastAPI dependency assembling the list filters.

    Explicit `Query` parameters rather than a bare
    `Annotated[VehicleFilterQuery, Query()]`, for a reason that is not stylistic.
    The model form does flatten into per-field parameters - but only while the
    route has no *other* parameter that is a `Depends` returning a Pydantic
    model, and `PageParams` is exactly that. With both present, FastAPI collapses
    the whole group into a single opaque `filters` parameter with no description
    and no per-field bounds, which is a worse API than the one before filtering.

    So the split is deliberate:

    - Per-field bounds live on these `Query` parameters. FastAPI enforces them
      before the handler runs and reports them as `request_validation_error`,
      the same code every other malformed request in this API already returns.
    - The rules that span fields - a minimum above its maximum, a year past the
      next model year - cannot be expressed as a per-parameter bound, so they run
      when the model is constructed here. A Pydantic `ValidationError` escaping
      a dependency is *not* mapped to a 422 by FastAPI; it would surface as a
      `500`, which is the wrong answer to a badly typed query string. It is
      therefore translated into this project's own `ValidationError`, which the
      central handler renders as a `422` carrying `validation_error`.

    Two codes for one status is intentional and both are 422 with the same
    envelope: `request_validation_error` means a single parameter was out of
    range, `validation_error` means the combination was contradictory. Collapsing
    them would mean either losing the per-parameter documentation above or
    letting a contradictory filter become a server error.
    """
    try:
        return VehicleFilterQuery(
            query=query,
            make=make,
            body_type=body_type,
            fuel=fuel,
            transmission=transmission,
            min_price=min_price,
            max_price=max_price,
            min_year=min_year,
            max_year=max_year,
            status=status,
        )
    except PydanticValidationError as exc:
        # Only the human sentence travels. Pydantic's own error payload carries a
        # `ctx` holding the raised `ValueError` object, which is not JSON
        # serialisable - passing it through as `details` would turn a 422 into a
        # 500 at serialisation time, and would risk putting an internal type name
        # into a response body. The message already names the field, which is the
        # only part a caller can act on.
        problems = exc.errors()
        raise ValidationError(
            problems[0]["msg"] if problems else "The submitted filters are not valid."
        ) from exc


@router.get(
    "",
    response_model=Page[VehicleResponse],
    summary="List vehicles",
    description=(
        "Returns one page of vehicles, newest listings first, in the shared "
        "`Page<T>` envelope.\n\n"
        "An empty inventory is a normal response: `items` is `[]` and `total` "
        "is `0`. It is not an error, and it is what the public site renders as "
        "its empty state. A filter that matches nothing returns the same empty "
        "envelope, for the same reason.\n\n"
        "Prices are quoted in **USD only** and are never converted. A vehicle "
        "whose price has not been agreed returns `price: null`, which the "
        'frontend renders as "Price on request".\n\n'
        "### Filtering\n\n"
        "Every filter is optional and the defaults reproduce the unfiltered "
        "list exactly. They combine with AND.\n\n"
        "Facets (`make`, `body_type`, `fuel`, `transmission`) are exact, "
        "case-insensitive matches. A vehicle with that facet unrecorded is "
        '**excluded** by a filter on it - `NULL` means "not recorded", and a '
        "car whose fuel type was never entered is not a diesel.\n\n"
        "`query` is a case-insensitive substring match over make and model, so "
        '"cruis" finds "Cruiser". It is not a phrase search and not fuzzy.\n\n'
        "A price filter **excludes** vehicles priced on request, because a "
        'customer who asked for "under 40,000" is not being shown a car whose '
        "price nobody will state. `status` is validated against "
        "`available | reserved | sold`; an unrecognised value is a `422` rather "
        "than a silently empty page, so a mistyped filter link is visible.\n\n"
        "There is no sorting parameter. A filtered page is a subset of the same "
        "newest-first listing, not a second ordering of the same cars."
    ),
)
async def get_vehicles(
    params: Annotated[PageParams, Depends(page_params)],
    session: DbReadSession,
    filters: Annotated[VehicleFilterQuery, Depends(vehicle_filters)],
) -> Page[VehicleResponse]:
    return await list_vehicles(session, params, filters=filters)


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

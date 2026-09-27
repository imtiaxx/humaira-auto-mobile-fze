"""Vehicle inventory model, schema, service and endpoint tests.

No real vehicle data appears in this file, and none should ever be added. The
records below are throwaway rows that exist to be read, rejected or counted
inside a transaction that is rolled back; they are not Humaira stock, they are
not representative of it, and nothing here is seed data - `tests/` is never
loaded by the application or by any migration.

The two values worth calling out, because they are the ones most likely to be
mistaken for real data:

- ``price`` is a round number chosen so an assertion can state an expectation,
  and it is meaningless outside this transaction.
- ``vin`` uses a value that satisfies the format check and identifies nothing.

If you need to recognise a fabricated vehicle record, this file is the only
place in the repository where one exists.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.vehicle import Vehicle, VehicleImage
from app.main import create_app
from app.schemas.vehicle import VehicleResponse
from app.services.vehicles import get_vehicle_by_slug, list_vehicles
from app.utils.pagination import MAX_PAGE_SIZE, Page, PageParams

#: Field names on the public wire, mirroring `VehicleRecord` in
#: `frontend/lib/api/vehicles.ts`. Duplicated here on purpose: the frontend
#: interface is a TypeScript type that no Python test can read, and the two
#: halves of the repository can only be kept honest by an assertion that
#: fails when one side moves without the other. If this set changes, the
#: frontend interface must change in the same commit.
EXPECTED_VEHICLE_WIRE_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "slug",
        "make",
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
        "status",
        "location",
        "images",
        "features",
    }
)

#: Database columns that must never appear on a public response. Timestamps
#: describe when a row was edited, which is operational information about
#: staff activity rather than anything a customer needs.
INTERNAL_FIELDS: frozenset[str] = frozenset(
    {"created_at", "updated_at", "vehicle_id", "position", "is_primary", "brand", "availability"}
)

VEHICLES_URL = f"{settings.api_v1_prefix}/vehicles"


async def _make_vehicle(session: AsyncSession, **overrides: Any) -> Vehicle:
    """Insert a throwaway vehicle and return it with its generated id."""
    fields: dict[str, Any] = {
        "slug": "test-vehicle-one",
        "brand": "Testbrand",
        "model": "Testmodel",
        "year": 2024,
        "currency": "USD",
        "availability": "available",
    }
    fields.update(overrides)

    vehicle = Vehicle(**fields)
    session.add(vehicle)
    await session.flush()

    return vehicle


async def _add_image(session: AsyncSession, vehicle: Vehicle, position: int) -> None:
    """Attach a throwaway photograph without touching ``vehicle.images``.

    The relationship is ``lazy="selectin"``, which loads at query time. Reading
    the attribute on a row created in this session instead triggers a load
    outside async SQLAlchemy's greenlet context, which raises rather than
    returning. Attaching children by `vehicle_id` sidesteps that, and the
    re-query in :func:`_reload_with_images` exercises the loader for real.
    """
    session.add(
        VehicleImage(
            vehicle_id=vehicle.id,
            position=position,
            src=f"/media/vehicle-{position}.jpg",
            alt=f"Throwaway test photograph number {position}",
            width=1600,
            height=1200,
        )
    )
    await session.flush()


async def _reload_with_images(session: AsyncSession, slug: str) -> Vehicle:
    """Re-read a vehicle from the database with its photographs loaded.

    The session identity map is cleared first so the `selectin` loader runs
    during a real query. This is the same path `GET /vehicles` takes, so
    ordering and eager loading are verified as the API sees them.
    """
    session.expunge_all()
    result = await session.scalars(select(Vehicle).where(Vehicle.slug == slug))

    return result.unique().one()


# ---------------------------------------------------------------------------
# Model-level invariants
# ---------------------------------------------------------------------------


def test_model_rejects_non_usd_currency() -> None:
    """The USD rule is enforced by the model, not left to a caller."""
    with pytest.raises(ValueError, match="must be USD"):
        Vehicle(slug="s", brand="b", model="m", year=2024, currency="AED", availability="available")


def test_model_normalises_lowercase_currency() -> None:
    """A legitimate write is normalised rather than refused.

    The database CHECK is case-sensitive (`currency = 'USD'`), so a caller who
    types `usd` would be rejected by a CHECK violation they cannot interpret.
    Normalising here is friendlier without weakening the rule.
    """
    vehicle = Vehicle(
        slug="s", brand="b", model="m", year=2024, currency="usd", availability="available"
    )

    assert vehicle.currency == "USD"


def test_model_normalises_slug_case_and_spacing() -> None:
    """A stored slug is always a usable URL path segment."""
    vehicle = Vehicle(
        slug="  Test-Vehicle-One ", brand="b", model="m", year=2024, availability="available"
    )

    assert vehicle.slug == "test-vehicle-one"


def test_model_rejects_slug_with_spaces() -> None:
    with pytest.raises(ValueError, match="lowercase alphanumeric"):
        Vehicle(slug="two words", brand="b", model="m", year=2024, availability="available")


def test_model_rejects_zero_price() -> None:
    """A stored 0 would render as "$0" on an unpriced car."""
    with pytest.raises(ValueError, match="must be positive"):
        Vehicle(
            slug="s", brand="b", model="m", year=2024, price=Decimal("0"), availability="available"
        )


def test_model_rejects_negative_price() -> None:
    with pytest.raises(ValueError, match="must be positive"):
        Vehicle(
            slug="s", brand="b", model="m", year=2024, price=Decimal("-1"), availability="available"
        )


def test_model_allows_null_price() -> None:
    """`NULL` is the documented encoding of "Price on request"."""
    vehicle = Vehicle(
        slug="s", brand="b", model="m", year=2024, price=None, availability="available"
    )

    assert vehicle.price is None


def test_model_rejects_unknown_availability() -> None:
    with pytest.raises(ValueError, match="availability must be one of"):
        Vehicle(slug="s", brand="b", model="m", year=2024, availability="in_transit")


def test_model_rejects_vin_containing_confusable_letters() -> None:
    """I, O and Q are excluded from the VIN alphabet by the standard."""
    with pytest.raises(ValueError, match="no I, O or Q"):
        Vehicle(
            slug="s",
            brand="b",
            model="m",
            year=2024,
            vin="JTDBR3FC0LD00000I",
            availability="available",
        )


def test_model_normalises_vin_case() -> None:
    vehicle = Vehicle(
        slug="s",
        brand="b",
        model="m",
        year=2024,
        vin="jtdbr3fc0ld000001",
        availability="available",
    )

    assert vehicle.vin == "JTDBR3FC0LD000001"


def test_vehicle_tables_are_registered_for_migrations() -> None:
    """A model missing from the registry is invisible to Alembic."""
    from app.db.models import ALL_MODELS

    assert Vehicle in ALL_MODELS
    assert VehicleImage in ALL_MODELS


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


def _vehicle(**overrides: Any) -> Vehicle:
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "slug": "test-vehicle-one",
        "brand": "Testbrand",
        "model": "Testmodel",
        "year": 2024,
        "currency": "USD",
        "availability": "available",
    }
    fields.update(overrides)
    return Vehicle(**fields)


def test_response_exposes_exactly_the_wire_contract() -> None:
    """A field added to the schema without the frontend is a breaking change."""
    payload = VehicleResponse.model_validate(_vehicle()).model_dump(mode="json", by_alias=True)

    assert set(payload) == EXPECTED_VEHICLE_WIRE_FIELDS


def test_response_never_exposes_internal_fields() -> None:
    payload = VehicleResponse.model_validate(_vehicle()).model_dump(mode="json", by_alias=True)

    assert not set(payload) & INTERNAL_FIELDS


def test_response_renames_brand_to_make_and_availability_to_status() -> None:
    """The one place database vocabulary meets wire vocabulary."""
    payload = VehicleResponse.model_validate(_vehicle()).model_dump(mode="json", by_alias=True)

    assert payload["make"] == "Testbrand"
    assert payload["status"] == "available"
    assert "brand" not in payload
    assert "availability" not in payload


def test_response_serialises_price_as_a_json_number() -> None:
    """A stringified price would be rejected by the frontend boundary.

    `NUMERIC` reaches Python as a `Decimal`, and Pydantic serialises `Decimal`
    as a JSON string by default. `VehicleRecord.price` promises a number, and
    the boundary treats a numeric string as untrusted, so this is a real
    contract break rather than a cosmetic one.
    """
    import json

    payload = VehicleResponse.model_validate(_vehicle(price=Decimal("34500.50"))).model_dump(
        mode="json", by_alias=True
    )

    assert isinstance(payload["price"], float)
    assert json.dumps(payload["price"]) == "34500.5"


def _row(**overrides: Any) -> SimpleNamespace:
    """A row-shaped object carrying the columns of `vehicles`.

    Used only to test the *response* validators, which exist as a second lock
    behind the write-time validators and the database CHECK constraints. Both
    of those make a bad row unreachable through the ORM, and the CHECK
    constraints are not deferrable, so the only honest way to prove the schema
    refuses such a row is to hand it one directly.
    """
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "slug": "test-vehicle-one",
        "brand": "Testbrand",
        "model": "Testmodel",
        "variant": None,
        "year": 2024,
        "body_type": None,
        "transmission": None,
        "fuel": None,
        "colour": None,
        "mileage_km": None,
        "vin": None,
        "price": None,
        "currency": "USD",
        "availability": "available",
        "location": None,
        "features": None,
        "images": [],
    }
    fields.update(overrides)

    return SimpleNamespace(**fields)


def test_response_rejects_non_usd_currency() -> None:
    """Second lock on the USD door, for a row the constraints did not catch."""
    with pytest.raises(ValidationError, match="must be USD"):
        VehicleResponse.model_validate(_row(currency="AED"))


def test_response_rejects_non_positive_price() -> None:
    with pytest.raises(ValidationError, match="must be positive"):
        VehicleResponse.model_validate(_row(price=0.0))


def test_response_rejects_unknown_availability() -> None:
    with pytest.raises(ValidationError, match="availability must be one of"):
        VehicleResponse.model_validate(_row(availability="in_transit"))


def test_response_rejects_implausible_future_year() -> None:
    """The database allows year >= 1900; the response layer also caps the top.

    A typo such as 2100 passes every CHECK constraint and describes no vehicle
    that exists, so the schema layer is where the moving upper bound belongs.
    """
    with pytest.raises(ValidationError, match="year must be between"):
        VehicleResponse.model_validate(_vehicle(year=2100))


def test_response_allows_null_price() -> None:
    payload = VehicleResponse.model_validate(_vehicle(price=None)).model_dump(
        mode="json", by_alias=True
    )

    assert payload["price"] is None
    assert payload["currency"] == "USD"


async def test_response_orders_images_by_position(db_session: AsyncSession) -> None:
    """The API promises primary-first order; the loader has to deliver it."""
    vehicle = await _make_vehicle(db_session, slug="ordered-images")
    for position in (2, 0, 1):
        await _add_image(db_session, vehicle, position)

    ordered = await _reload_with_images(db_session, "ordered-images")
    payload = VehicleResponse.model_validate(ordered).model_dump(mode="json", by_alias=True)

    assert [image["src"] for image in payload["images"]] == [
        "/media/vehicle-0.jpg",
        "/media/vehicle-1.jpg",
        "/media/vehicle-2.jpg",
    ]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


async def test_service_returns_empty_page_for_empty_table(db_session: AsyncSession) -> None:
    """An empty inventory is a normal result, not an error."""
    page = await list_vehicles(db_session)

    assert page.items == []
    assert page.total == 0
    assert page.total_pages == 0
    assert page.has_next is False


async def test_service_drops_one_unserialisable_row(db_session: AsyncSession) -> None:
    """One corrupt row costs one vehicle, not the whole page.

    `year=2100` satisfies every CHECK constraint and is still not a real model
    year, so it stands in for any row that survives the database and fails the
    response contract.
    """
    await _make_vehicle(db_session, slug="good-row")
    await _make_vehicle(db_session, slug="impossible-year", year=2100)

    page = await list_vehicles(db_session)

    assert page.total == 2
    assert [item.slug for item in page.items] == ["good-row"]


async def test_service_lookup_is_case_insensitive(db_session: AsyncSession) -> None:
    """A hand-typed or copied URL should resolve rather than 404."""
    await _make_vehicle(db_session, slug="mixed-case-vehicle")

    assert await get_vehicle_by_slug(db_session, "MIXED-CASE-VEHICLE") is not None
    assert await get_vehicle_by_slug(db_session, "  mixed-case-vehicle  ") is not None


async def test_service_raises_not_found_for_unknown_slug(db_session: AsyncSession) -> None:
    from app.core.errors import NotFoundError

    with pytest.raises(NotFoundError):
        await get_vehicle_by_slug(db_session, "no-such-vehicle")


async def test_service_paginates(db_session: AsyncSession) -> None:
    for index in range(5):
        await _make_vehicle(db_session, slug=f"paged-{index}")

    page = await list_vehicles(db_session, PageParams(page=2, page_size=2))

    assert page.total == 5
    assert page.total_pages == 3
    assert page.page == 2
    assert len(page.items) == 2
    assert page.has_next is True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


async def test_list_returns_empty_envelope(db_client: AsyncClient) -> None:
    """The shape the frontend empty state already expects."""
    response = await db_client.get(VEHICLES_URL)

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 24,
        "total_pages": 0,
    }


async def test_list_returns_a_vehicle(db_client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_vehicle(db_session, slug="listed-vehicle", price=Decimal("34500.50"))

    response = await db_client.get(VEHICLES_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert set(item) == EXPECTED_VEHICLE_WIRE_FIELDS
    assert item["slug"] == "listed-vehicle"
    assert item["make"] == "Testbrand"
    assert item["status"] == "available"
    assert item["currency"] == "USD"
    assert item["price"] == 34500.5
    assert not set(item) & INTERNAL_FIELDS


async def test_list_serialises_null_price_as_null(
    db_client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_vehicle(db_session, slug="unpriced-vehicle", price=None)

    response = await db_client.get(VEHICLES_URL)

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["price"] is None
    assert item["currency"] == "USD"


async def test_list_serialises_images(db_client: AsyncClient, db_session: AsyncSession) -> None:
    vehicle = await _make_vehicle(db_session, slug="photographed-vehicle")
    await _add_image(db_session, vehicle, 0)

    response = await db_client.get(VEHICLES_URL)

    assert response.status_code == 200
    assert response.json()["items"][0]["images"] == [
        {
            "src": "/media/vehicle-0.jpg",
            "alt": "Throwaway test photograph number 0",
            "width": 1600,
            "height": 1200,
        }
    ]


async def test_list_rejects_oversized_page_size(db_client: AsyncClient) -> None:
    """A hostile or buggy client cannot exhaust server memory."""
    response = await db_client.get(VEHICLES_URL, params={"page_size": MAX_PAGE_SIZE + 1})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


@pytest.mark.parametrize("page", [0, -1, "abc"])
async def test_list_rejects_malformed_pagination(db_client: AsyncClient, page: Any) -> None:
    response = await db_client.get(VEHICLES_URL, params={"page": page})

    assert response.status_code == 422


async def test_get_one_vehicle_by_slug(db_client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_vehicle(db_session, slug="single-vehicle", year=2023)

    response = await db_client.get(f"{VEHICLES_URL}/single-vehicle")

    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "single-vehicle"
    assert body["year"] == 2023
    assert set(body) == EXPECTED_VEHICLE_WIRE_FIELDS


async def test_get_one_vehicle_is_case_insensitive(
    db_client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_vehicle(db_session, slug="case-insensitive")

    response = await db_client.get(f"{VEHICLES_URL}/CASE-INSENSITIVE")

    assert response.status_code == 200
    assert response.json()["slug"] == "case-insensitive"


async def test_get_unknown_vehicle_returns_404(db_client: AsyncClient) -> None:
    response = await db_client.get(f"{VEHICLES_URL}/no-such-vehicle")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert body["error"]["request_id"]


async def test_get_vehicle_rejects_oversized_slug(db_client: AsyncClient) -> None:
    response = await db_client.get(f"{VEHICLES_URL}/{'a' * 201}")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


async def test_get_slug_with_illegal_characters_returns_404_not_500(
    db_client: AsyncClient,
) -> None:
    """A mistyped URL is a missing vehicle, not a server fault.

    Anything within the length cap reaches the repository, so a slug full of
    punctuation or uppercase resolves to `None` and becomes a clean 404.
    """
    response = await db_client.get(f"{VEHICLES_URL}/NOT-A-Real-Slug!!")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_vehicles_endpoints_are_read_only(db_client: AsyncClient) -> None:
    """No write verb is exposed, so there is no unauthenticated write path."""
    for method in ("POST", "PUT", "PATCH", "DELETE"):
        response = await db_client.request(method, VEHICLES_URL, json={})

        assert response.status_code == 405, f"{method} was not rejected"


async def test_database_failure_does_not_leak_internals(monkeypatch: pytest.MonkeyPatch) -> None:
    """A database outage is a 500 with no traceback and no query text.

    The frontend turns any failure into its professional empty state, so the
    only thing this response must get right is refusing to say anything about
    the database.

    Two details make this test work. The patch target is the *endpoint* module,
    because the route imported `list_vehicles` by name at import time and
    patching the service would leave the route calling the original. And the
    client sets `raise_app_exceptions=False`, because httpx's ASGI transport
    re-raises by default while a real server returns the 500 the exception
    handler produced - the behaviour being asserted here.
    """

    async def _explode(*args: object, **kwargs: object) -> Page[VehicleResponse]:
        raise DBAPIError(
            "select vehicles from the humera_automobile.vehicles table", {}, Exception("boom")
        )

    monkeypatch.setattr("app.api.v1.endpoints.vehicles.list_vehicles", _explode)

    application = create_app()
    transport = ASGITransport(app=application, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        response = await http_client.get(VEHICLES_URL)

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    serialised = str(body)
    assert "Traceback" not in serialised
    assert "humera_automobile" not in serialised
    assert "select" not in serialised.lower()
    assert "password" not in serialised.lower()


async def test_debug_mode_never_reaches_production() -> None:
    """Verbose 500 bodies are a development affordance, and only that.

    With `DEBUG` on, `register_exception_handlers` deliberately echoes
    `type(exc): exc` into the 500 body - which for a database error includes the
    failing SQL statement and the database name. That is genuinely useful when
    developing and unacceptable in production, so production start-up is what
    has to refuse it rather than the handler deciding at runtime.
    """
    problems = settings.model_copy(
        update={"app_env": "production", "debug": True, "cors_origins": ["https://example.com"]}
    ).assert_production_ready()

    assert any("DEBUG" in problem for problem in problems)


async def test_verbose_error_bodies_are_disabled_when_debug_is_off() -> None:
    """The default posture: a 500 says nothing about the database."""
    from app.core.errors import _error_payload

    with_verbosity = settings.debug

    try:
        settings.debug = False
        payload = str(
            _error_payload(code="internal_error", message="An unexpected error occurred.")
        )
    finally:
        settings.debug = with_verbosity

    assert "Traceback" not in payload
    assert "select" not in payload.lower()


async def test_error_responses_never_contain_credentials(db_client: AsyncClient) -> None:
    """A cheap guard against a connection string reaching a response body."""
    response = await db_client.get(f"{VEHICLES_URL}/no-such-vehicle")

    serialised = str(response.json()).lower()
    for secret_marker in ("postgresql", "asyncpg", "password", "secret", "://"):
        assert secret_marker not in serialised

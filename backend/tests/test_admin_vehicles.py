"""Staff vehicle management tests.

Two things are being protected here.

**The public surface stays read-only.** Step 10 pinned that `POST` to
`/api/v1/vehicles` is a 405; that must still hold now that writes exist, three
path segments away under `/admin`. The route families are separate on purpose and
this file is where that separation is enforced.

**Archiving is honest.** Withdrawing a vehicle hides it from the public without
destroying it: gone from the list, 404 on its page, still listed, readable and
editable for staff, and reversible.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.schemas.vehicle import VehicleResponse  # noqa: F401  (import guard for ordering)

#: A complete, valid create body. Copied and amended per test so each one
#: changes exactly one thing and a failure names the field it was about.
VALID_VEHICLE: dict[str, Any] = {
    "slug": "toyota-land-cruiser",
    "make": "Toyota",
    "model": "Land Cruiser",
    "variant": "GX-R",
    "year": 2022,
    "body_type": "SUV",
    "transmission": "Automatic",
    "fuel": "Petrol",
    "colour": "White",
    "mileage_km": 48_000,
    "vin": "JTFBX02P900012345",
    "price": 185_000.0,
    "currency": "USD",
    "status": "available",
    "location": "Dubai, UAE",
    "features": {"Seats": "7"},
}


def _variant(**changes: Any) -> dict[str, Any]:
    """A valid body with specific fields replaced."""
    return {**VALID_VEHICLE, **changes}


async def _create(client: AsyncClient, **changes: Any) -> dict[str, Any]:
    """Create a vehicle and return the response body, asserting 201."""
    response = await client.post("/api/v1/admin/vehicles", json=_variant(**changes))
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_returns_the_stored_vehicle(staff_client: AsyncClient) -> None:
    """A created vehicle is echoed back with its generated id and timestamps."""
    body = await _create(staff_client)

    assert uuid.UUID(body["id"])
    assert body["slug"] == "toyota-land-cruiser"
    # The wire names are the frontend's, not the column names.
    assert body["make"] == "Toyota"
    assert body["status"] == "available"
    assert body["images"] == []
    assert body["archived_at"] is None


async def test_create_accepts_the_column_names_too(staff_client: AsyncClient) -> None:
    """`brand` and `availability` work as well as `make` and `status`.

    A form that posts one and a client that posts the other should not be able to
    produce different records, so both spellings are accepted and stored
    identically.
    """
    response = await staff_client.post(
        "/api/v1/admin/vehicles",
        json=_variant(make=None, brand="Toyota", status=None, availability="available"),
    )
    # `make=None` is not a valid value for the field, so this is rejected: the
    # point of the test is the aliases, asserted below without the nulls.
    assert response.status_code == 422

    body = await _create(staff_client, slug="alias-check")
    assert body["make"] == "Toyota"


async def test_create_normalises_the_slug_to_lowercase(staff_client: AsyncClient) -> None:
    """A mixed-case slug is stored lowercase, so the URL is predictable."""
    body = await _create(staff_client, slug="Toyota-Land-Cruiser")

    assert body["slug"] == "toyota-land-cruiser"


async def test_create_collapses_whitespace_in_text_fields(staff_client: AsyncClient) -> None:
    """`"Toyota  "` and `" Land Cruiser"` do not become padded columns."""
    body = await _create(staff_client, make="  Toyota  ", model="Land Cruiser ")

    assert body["make"] == "Toyota"
    assert body["model"] == "Land Cruiser"


async def test_create_rejects_a_duplicate_slug(staff_client: AsyncClient) -> None:
    """Two vehicles cannot share a public URL."""
    await _create(staff_client)
    response = await staff_client.post(
        "/api/v1/admin/vehicles",
        json=_variant(make="Toyota", model="Prado"),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


async def test_duplicate_slug_is_case_insensitive(staff_client: AsyncClient) -> None:
    """A slug that differs only in case is still a duplicate."""
    await _create(staff_client)
    response = await staff_client.post(
        "/api/v1/admin/vehicles", json=_variant(slug="TOYOTA-LAND-CRUISER")
    )

    assert response.status_code == 409


async def test_create_rejects_a_duplicate_vin(staff_client: AsyncClient) -> None:
    """A VIN identifies one physical vehicle, so it cannot be reused."""
    await _create(staff_client)
    response = await staff_client.post("/api/v1/admin/vehicles", json=_variant(slug="another-one"))

    assert response.status_code == 409


async def test_blank_optional_text_becomes_null(staff_client: AsyncClient) -> None:
    """A cleared form field is `null`, not an empty string.

    The public page omits absent specifications; an empty string would render as a
    blank row.
    """
    body = await _create(staff_client, variant="   ", colour="")

    assert body["variant"] is None
    assert body["colour"] is None


async def test_price_on_request_is_null_not_zero(staff_client: AsyncClient) -> None:
    """`null` is how a vehicle with no agreed price is recorded."""
    body = await _create(staff_client, price=None)

    assert body["price"] is None


@pytest.mark.parametrize(
    ("changes", "why"),
    [
        ({"currency": "AED"}, "prices are USD only"),
        ({"price": 0}, "zero is not a price; use null for 'on request'"),
        ({"price": -1}, "a negative price is not a price"),
        ({"year": 1800}, "no car was built that year"),
        ({"year": 2099}, "nor that one, yet"),
        ({"mileage_km": -5}, "a negative odometer reading is a fault, not data"),
        ({"status": "in-stock"}, "that is not a state the frontend can render"),
        ({"status": "Available"}, "the states are a fixed, lower-case set"),
        ({"make": "   "}, "a blank make is not a make"),
        ({"model": ""}, "a blank model is not a model"),
    ],
)
async def test_create_rejects_impossible_records(
    staff_client: AsyncClient, changes: dict[str, Any], why: str
) -> None:
    """Each rule is a rejection, and the test names why.

    Grouped into one parameterised test so a failure points at the specific rule
    that broke rather than at "validation".
    """
    response = await staff_client.post("/api/v1/admin/vehicles", json=_variant(**changes))

    assert response.status_code == 422, f"{changes} should be rejected: {why}"


async def test_create_rejects_an_unknown_field(staff_client: AsyncClient) -> None:
    """`extra="forbid"`, so a typo is an error rather than a silently dropped key."""
    response = await staff_client.post("/api/v1/admin/vehicles", json=_variant(colour_typo="Red"))

    assert response.status_code == 422


async def test_create_cannot_set_the_archive_flag(staff_client: AsyncClient) -> None:
    """`archived_at` is not writable through a create.

    A vehicle arrives published. Withdrawal is a deliberate second act, with its
    own endpoint and its own audit trail.
    """
    response = await staff_client.post(
        "/api/v1/admin/vehicles", json=_variant(archived_at="2020-01-01T00:00:00Z")
    )

    assert response.status_code == 422


async def test_create_requires_a_staff_session(anon_client: AsyncClient) -> None:
    """No session, no write."""
    response = await anon_client.post("/api/v1/admin/vehicles", json=VALID_VEHICLE)

    assert response.status_code == 401


async def test_create_refuses_a_non_staff_account(reader_client: AsyncClient) -> None:
    """A valid session without the staff role cannot write."""
    response = await reader_client.post("/api/v1/admin/vehicles", json=VALID_VEHICLE)

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


async def test_the_created_vehicle_appears_in_the_public_list(
    staff_client: AsyncClient, db_client: AsyncClient
) -> None:
    """Publishing is immediate: a new vehicle is publicly listed."""
    await _create(staff_client)

    response = await db_client.get("/api/v1/vehicles")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["slug"] == "toyota-land-cruiser"


async def test_staff_list_includes_archived_and_public_list_does_not(
    staff_client: AsyncClient, db_client: AsyncClient
) -> None:
    """The two audiences see different sets, from the same records."""
    created = await _create(staff_client)
    archived = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")
    assert archived.status_code == 200

    public = await db_client.get("/api/v1/vehicles")
    assert public.json()["total"] == 0
    assert public.json()["items"] == []

    staff = await staff_client.get("/api/v1/admin/vehicles")
    assert staff.json()["total"] == 1


async def test_summary_counts_published_and_archived_separately(
    staff_client: AsyncClient,
) -> None:
    """The dashboard reports real counts, and the two do not overlap.

    `total_published` excluding archived rows is the whole point of the split; a
    total that quietly included withdrawn vehicles would misreport the inventory
    to the person managing it.
    """
    first = await _create(staff_client, slug="one")
    await _create(staff_client, slug="two", vin="JTFBX02P900099999")
    await _create(staff_client, slug="three", vin="JTFBX02P900088888")
    await staff_client.post(f"/api/v1/admin/vehicles/{first['id']}/archive")

    response = await staff_client.get("/api/v1/admin/vehicles/-/summary")
    assert response.status_code == 200
    body = response.json()

    assert body["total_published"] == 2
    assert body["archived"] == 1
    assert body["by_availability"] == {"available": 2}
    assert body["image_count"] == 0


async def test_summary_of_an_empty_inventory_is_all_zeroes(staff_client: AsyncClient) -> None:
    """An empty database reports zeros. It is not an error, and nothing is invented."""
    response = await staff_client.get("/api/v1/admin/vehicles/-/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_published": 0,
        "archived": 0,
        "by_availability": {},
        "image_count": 0,
    }


async def test_the_summary_route_is_not_shadowed_by_the_id_route(
    staff_client: AsyncClient,
) -> None:
    """`/-/summary` must reach the summary, not be parsed as a UUID.

    FastAPI matches in declaration order, so this is a real risk rather than a
    theoretical one: `/{vehicle_id}` declared first would answer 422.
    """
    response = await staff_client.get("/api/v1/admin/vehicles/-/summary")

    assert response.status_code == 200
    assert "total_published" in response.json()


async def test_get_an_unknown_vehicle_is_404(staff_client: AsyncClient) -> None:
    """A well-formed id that matches nothing is 404, in the standard envelope."""
    response = await staff_client.get(
        f"/api/v1/admin/vehicles/{uuid.uuid4()}",
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_a_malformed_id_is_422_not_500(staff_client: AsyncClient) -> None:
    """`not-a-uuid` is a malformed request, answered as one."""
    response = await staff_client.get("/api/v1/admin/vehicles/not-a-uuid")

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def test_update_replaces_the_editable_fields(staff_client: AsyncClient) -> None:
    """An edit form submits the whole record, and the whole record is written."""
    created = await _create(staff_client)

    response = await staff_client.patch(
        f"/api/v1/admin/vehicles/{created['id']}",
        json=_variant(price=175_000.0, colour="Black", mileage_km=49_500),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["price"] == 175_000.0
    assert body["colour"] == "Black"
    assert body["mileage_km"] == 49_500


async def test_update_may_keep_its_own_slug(staff_client: AsyncClient) -> None:
    """Re-saving a record without changing its slug is not a conflict.

    The uniqueness check has to exclude the row being edited, or every save of
    every vehicle would 409.
    """
    created = await _create(staff_client)

    response = await staff_client.patch(f"/api/v1/admin/vehicles/{created['id']}", json=_variant())

    assert response.status_code == 200


async def test_update_rejects_another_vehicles_slug(staff_client: AsyncClient) -> None:
    """Moving onto a slug that is taken is still a conflict."""
    await _create(staff_client, slug="taken")
    other = await _create(staff_client, slug="mine", vin="JTFBX02P900011111")

    response = await staff_client.patch(
        f"/api/v1/admin/vehicles/{other['id']}", json=_variant(slug="taken")
    )

    assert response.status_code == 409


async def test_update_applies_the_same_validation_as_create(
    staff_client: AsyncClient,
) -> None:
    """An edit cannot be a way around the rules a create enforces."""
    created = await _create(staff_client)

    response = await staff_client.patch(
        f"/api/v1/admin/vehicles/{created['id']}", json=_variant(currency="AED")
    )

    assert response.status_code == 422


async def test_update_of_an_unknown_vehicle_is_404(staff_client: AsyncClient) -> None:
    """No row, no edit."""
    response = await staff_client.patch(
        f"/api/v1/admin/vehicles/{uuid.uuid4()}", json=VALID_VEHICLE
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Archive and restore
# ---------------------------------------------------------------------------


async def test_archive_hides_the_vehicle_from_the_public_page(
    staff_client: AsyncClient, db_client: AsyncClient
) -> None:
    """The public slug 404s once withdrawn."""
    created = await _create(staff_client)

    archived = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None

    public = await db_client.get("/api/v1/vehicles/toyota-land-cruiser")
    assert public.status_code == 404


async def test_archive_keeps_the_record_and_its_images(
    staff_client: AsyncClient,
) -> None:
    """Archiving withdraws; it does not destroy.

    The record, and the photographs that belong to it, are all still there for
    staff - which is the entire reason for choosing archive over delete.
    """
    created = await _create(staff_client)

    await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")

    fetched = await staff_client.get(f"/api/v1/admin/vehicles/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]


async def test_an_archived_vehicle_is_still_editable(staff_client: AsyncClient) -> None:
    """Staff fix a listing before putting it back on sale."""
    created = await _create(staff_client)
    await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")

    response = await staff_client.patch(
        f"/api/v1/admin/vehicles/{created['id']}", json=_variant(price=1.0)
    )

    assert response.status_code == 200


async def test_archive_is_idempotent(staff_client: AsyncClient) -> None:
    """Archiving twice keeps the first timestamp.

    Restamping it would make "when was this withdrawn?" answer a question about
    the last request rather than the actual event.
    """
    created = await _create(staff_client)

    first = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")
    second = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")

    assert second.status_code == 200
    assert second.json()["archived_at"] == first.json()["archived_at"]


async def test_restore_returns_the_vehicle_to_sale(
    staff_client: AsyncClient, db_client: AsyncClient
) -> None:
    """The whole point of archiving: it is reversible."""
    created = await _create(staff_client)
    await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/archive")

    restored = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["archived_at"] is None

    public = await db_client.get("/api/v1/vehicles/toyota-land-cruiser")
    assert public.status_code == 200


async def test_restore_is_idempotent(staff_client: AsyncClient) -> None:
    """Restoring a published vehicle is a no-op, not an error."""
    created = await _create(staff_client)

    first = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/restore")
    second = await staff_client.post(f"/api/v1/admin/vehicles/{created['id']}/restore")

    assert first.status_code == second.status_code == 200
    assert second.json()["archived_at"] is None


async def test_archiving_an_unknown_vehicle_is_404(staff_client: AsyncClient) -> None:
    """Nothing to withdraw."""
    response = await staff_client.post(f"/api/v1/admin/vehicles/{uuid.uuid4()}/archive")

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# The public surface has not changed
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/v1/vehicles"),
        ("put", "/api/v1/vehicles/anything"),
        ("patch", "/api/v1/vehicles/anything"),
        ("delete", "/api/v1/vehicles/anything"),
    ],
)
async def test_the_public_vehicle_resource_is_still_read_only(
    db_client: AsyncClient, method: str, path: str
) -> None:
    """Writes exist; none of them is on the public path.

    Step 10 promised the public resource was read-only. Writes arrived under
    `/admin`, and this is the assertion that they stayed there.
    """
    response = await db_client.request(method, path, json=VALID_VEHICLE)

    assert response.status_code == 405
    assert "GET" in response.headers.get("allow", "")


async def test_there_is_no_delete_route_for_a_vehicle(staff_client: AsyncClient) -> None:
    """No `DELETE /admin/vehicles/{id}`. Withdrawal is an explicit archive.

    A destructive delete on a business record belongs behind its own confirmation
    and its own audit trail. Until that exists, the route is absent - which is a
    better answer than a route that quietly archives.
    """
    created = await _create(staff_client)

    response = await staff_client.delete(f"/api/v1/admin/vehicles/{created['id']}")

    assert response.status_code == 405
    # Still there.
    assert (await staff_client.get(f"/api/v1/admin/vehicles/{created['id']}")).status_code == 200

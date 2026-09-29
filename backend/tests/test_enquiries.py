"""Enquiry tests - public submission and staff management.

Three things are being protected here, in descending order of how much damage
getting them wrong would do.

**The public surface cannot be abused.** `POST /vehicles/{slug}/enquiry` is the
only endpoint in this project a member of the public can write through, so it
carries the most attack surface per line of code. The vehicle comes from the path
and never from the body, every field is bounded, and a message is stored as
whatever the visitor typed rather than being filtered into uselessness.

**The staff surface is genuinely closed.** Anonymous gets 401, a signed-in
non-staff account gets 403, and neither response says which condition applied.
An enquiry list is a directory of everybody who has asked about a car.

**The public read surface is still read-only.** Step 10 pinned that `POST` to
`/api/v1/vehicles` is a 405. That has to hold now that a write exists one path
segment below it, and the test lives in this file because that is the adjacency
it is protecting.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enquiry import Enquiry

#: A complete, valid public submission. Copied and amended per test so each one
#: changes exactly one thing and a failure names the field it was about.
VALID_ENQUIRY: dict[str, Any] = {
    "customer_name": "Amina Al-Farsi",
    "customer_email": "amina@example.ae",
    "customer_phone": "+971 50 123 4567",
    "message": "Is this still available, and can I arrange a viewing on Saturday?",
}

#: The vehicle every public test is written against. Created through the staff API
#: rather than by inserting a row, so the fixture exercises the same path a real
#: vehicle arrives by - a test that hand-inserts a vehicle can pass against a
#: schema the application would never produce.
VEHICLE_SLUG = "toyota-land-cruiser"

VEHICLE_BODY: dict[str, Any] = {
    "slug": VEHICLE_SLUG,
    "make": "Toyota",
    "model": "Land Cruiser",
    "year": 2022,
    "body_type": "SUV",
    "transmission": "Automatic",
    "fuel": "Petrol",
    "mileage_km": 48_000,
    "vin": "JTFBX02P900012345",
    "price": 185_000.0,
    "currency": "USD",
    "status": "available",
}


def _variant(**changes: Any) -> dict[str, Any]:
    """A valid submission with specific fields replaced."""
    return {**VALID_ENQUIRY, **changes}


async def _make_vehicle(client: AsyncClient, **changes: Any) -> dict[str, Any]:
    """Create a vehicle and return its body, asserting 201."""
    response = await client.post("/api/v1/admin/vehicles", json={**VEHICLE_BODY, **changes})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _vehicle(staff_client: AsyncClient, **changes: Any) -> dict[str, Any]:
    """The one vehicle the public tests share."""
    return await _make_vehicle(staff_client, **changes)


async def _submit(
    client: AsyncClient,
    *,
    slug: str = VEHICLE_SLUG,
    **changes: Any,
) -> Any:
    """POST an enquiry, returning the response for the caller to assert on."""
    return await client.post(f"/api/v1/vehicles/{slug}/enquiry", json=_variant(**changes))


async def _insert_enquiry(
    session: AsyncSession,
    vehicle_id: str,
    *,
    created_at: datetime,
    customer_email: str,
) -> str:
    """Insert an enquiry row directly, with a chosen `created_at`, and return its id.

    Used only by the ordering tests. Going through the API cannot produce rows with
    known, distinct or deliberately equal timestamps - `created_at` is a server
    default, and on SQLite `now()` has second resolution, so three submissions in
    a test all land in the same second. The ordering rules therefore cannot be
    tested through the public endpoint at all; they need timestamps the test
    chooses.

    The rest of the suite submits through the API on purpose, because the write
    path is what most of it is about.
    """
    enquiry = Enquiry(
        vehicle_id=uuid.UUID(vehicle_id),
        vehicle_slug=VEHICLE_SLUG,
        customer_name="Amina Al-Farsi",
        customer_email=customer_email,
        customer_phone="+971 50 123 4567",
        message="Is this still available?",
        status="pending",
        created_at=created_at,
    )
    session.add(enquiry)
    await session.flush()
    return str(enquiry.id)


# ---------------------------------------------------------------------------
# Public submission
# ---------------------------------------------------------------------------


class TestPublicSubmission:
    async def test_records_the_enquiry(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A valid submission is stored and echoed back, with status `pending`."""
        await _vehicle(staff_client)

        response = await _submit(anon_client)
        assert response.status_code == 201, response.text
        body = response.json()

        assert uuid.UUID(body["id"])
        assert body["customer_name"] == "Amina Al-Farsi"
        assert body["customer_email"] == "amina@example.ae"
        assert body["customer_phone"] == "+971 50 123 4567"
        assert (
            body["message"] == "Is this still available, and can I arrange a viewing on Saturday?"
        )
        # The vehicle is the one named in the path, taken from the database row.
        assert body["vehicle_slug"] == VEHICLE_SLUG
        # A public form cannot choose a status, so this is pinned: it is the one
        # field a visitor has no legitimate opinion about, and a form that let
        # them post `closed` would be a way to make an enquiry disappear.
        assert body["status"] == "pending"
        assert body["created_at"]
        assert body["updated_at"]

    async def test_does_not_require_authentication(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """No session is needed, and none is harmed if one is offered.

        The public endpoint must not depend on `CurrentStaff`; a visitor who
        happens to carry a stale staff cookie still gets their enquiry recorded.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client)).status_code == 201
        # A second enquiry from a different address, over the same client, so the
        # cookie-present path is genuinely different from the anonymous one.
        response = await _submit(anon_client, customer_email="second@example.ae")
        assert response.status_code == 201, response.text

    async def test_vehicle_is_taken_from_the_path_not_the_body(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`extra="forbid"` turns a caller naming the vehicle into a 422.

        This is the security property of the whole endpoint. A body that carried
        `vehicle_id` would let anybody file an enquiry about any car - including
        ones not on the site - while the form they used was on a different page.
        Rejecting beats silently ignoring, because a client that keeps sending the
        field then finds out.
        """
        await _vehicle(staff_client)

        response = await anon_client.post(
            f"/api/v1/vehicles/{VEHICLE_SLUG}/enquiry",
            json=_variant(vehicle_id=str(uuid.uuid4())),
        )
        assert response.status_code == 422, response.text

    async def test_rejects_vehicle_slug_in_the_body(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The same for `vehicle_slug`, the field a form would most plausibly add."""
        await _vehicle(staff_client)

        response = await _submit(anon_client, vehicle_slug="some-other-car")
        assert response.status_code == 422, response.text

    async def test_unknown_vehicle_is_a_404(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A slug with no vehicle is 404, not 500 and not 422."""
        await _vehicle(staff_client)

        response = await _submit(anon_client, slug="no-such-vehicle")
        assert response.status_code == 404, response.text
        assert response.json()["error"]["code"] == "not_found"

    async def test_archived_vehicle_is_a_404(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """An enquiry cannot be filed against a car that is no longer on sale.

        `get_vehicle_by_slug` reads through `get_live_by_slug`, so this falls out
        of the shared lookup rather than needing a check here. Pinned because the
        alternative - accepting enquiries for archived cars - would be a silent
        behaviour nobody chose: the staff UI says the car is withdrawn.
        """
        vehicle = await _vehicle(staff_client)
        archived = await staff_client.post(f"/api/v1/admin/vehicles/{vehicle['id']}/archive")
        assert archived.status_code == 200, archived.text

        assert (await _submit(anon_client)).status_code == 404

    async def test_sold_vehicle_still_accepts_an_enquiry(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`sold` is for sale history, not withdrawal.

        Someone who wants a sold car is a genuine sourcing lead, and the detail
        page's copy says so and offers a form. A `sold` vehicle is still live for
        public lookups, so this must not 404.
        """
        await _vehicle(staff_client, status="sold")

        assert (await _submit(anon_client)).status_code == 201


# ---------------------------------------------------------------------------
# Duplicate enquiries
# ---------------------------------------------------------------------------


class TestDuplicates:
    async def test_same_customer_same_vehicle_is_a_409(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A repeat submission is refused, and this is the regression test for it.

        Without the `IntegrityError` handling in `create_enquiry`, the second
        request reaches the generic handler and returns 500 - telling a visitor
        the site is broken when their *first* enquiry was recorded perfectly well.
        409 is the honest answer and is what the frontend's form is written
        against.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client)).status_code == 201

        second = await _submit(anon_client)
        assert second.status_code == 409, second.text
        assert second.json()["error"]["code"] == "conflict"

    async def test_the_first_enquiry_survives_the_duplicate(
        self, staff_client: AsyncClient, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """A refused duplicate must not damage or replace the original.

        The 409 comes from a failed flush part-way through the transaction, which
        is the dangerous moment: a careless implementation commits anyway, or
        half-applies. The original has to still be there, unchanged, when staff
        look.

        The rollback below is the test's job, not the application's. A real
        request gets its own session and `get_db_session` closes it in a `finally`,
        so the failed transaction dies with the request. Here every request shares
        one `db_session`, so the failed transaction is still open and the next
        request would hit `PendingRollbackError` - which is precisely why the
        duplicate path must not need a second round trip to recover.
        """
        await _vehicle(staff_client)
        first = (await _submit(anon_client)).json()

        assert (
            await _submit(anon_client, message="A completely different question")
        ).status_code == 409
        await db_session.rollback()

        listing = await staff_client.get("/api/v1/enquiries")
        assert listing.status_code == 200, listing.text
        items = listing.json()["items"]
        assert len(items) == 1, f"expected exactly one enquiry, found {len(items)}"
        assert items[0]["id"] == first["id"]
        assert items[0]["message"] == VALID_ENQUIRY["message"]

    async def test_different_customer_same_vehicle_is_allowed(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The constraint is per `(vehicle_id, customer_email)`, not per vehicle.

        Ten people asking about one popular car is the normal case, and a
        constraint on the vehicle alone would make the second enquiry impossible.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client, customer_email="first@example.ae")).status_code == 201
        assert (await _submit(anon_client, customer_email="second@example.ae")).status_code == 201
        assert (await _submit(anon_client, customer_email="third@example.ae")).status_code == 201

    async def test_same_customer_different_vehicle_is_allowed(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """One person can ask about several cars, which is the common case.

        Pinned with the other half of the constraint, because a test that only
        proves "two enquiries cannot collide" would also pass if the constraint
        were accidentally on `vehicle_id` alone.
        """
        await _vehicle(staff_client)
        await _make_vehicle(staff_client, slug="range-rover", vin="SAL1ABAA7MA123456")

        assert (await _submit(anon_client)).status_code == 201
        response = await _submit(anon_client, slug="range-rover")
        assert response.status_code == 201, response.text

    async def test_the_same_customer_can_enquire_again_after_the_address_changes(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """Email case does not merge two enquiries into a false duplicate.

        SQLite compares text case-sensitively and PostgreSQL does not for `TEXT`,
        so a test written as "same address in different case" would pass on one
        database and fail on the other. This pins the behaviour that is actually
        the same on both: a genuinely different address is a different person as
        far as the constraint is concerned.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client, customer_email="amina@example.ae")).status_code == 201
        response = await _submit(anon_client, customer_email="amina.alfarsi@example.ae")
        assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    async def test_rejects_each_invalid_field(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """One amendment per case, so a failure names the field."""
        await _vehicle(staff_client)

        cases: dict[str, Any] = {
            "customer_name": "",
            "customer_email": "not-an-email",
            "customer_phone": "123",
            "message": "too short",
        }
        for field, bad in cases.items():
            response = await _submit(anon_client, **{field: bad})
            assert response.status_code == 422, f"{field} should have been rejected"
            # The detail must name the field, so the form can highlight it. This is
            # what `fieldErrorsFromDetail` on the frontend parses.
            locations = [entry["loc"][-1] for entry in response.json()["error"]["details"]]
            assert field in locations, f"expected {field} in {locations}"

    async def test_rejects_a_missing_field_entirely(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """An absent field is a 422, not a crash.

        `customer_phone` is the field a naive implementation makes optional
        because "phone numbers are hard to type". It is required here, and a
        request that omits it entirely must be refused rather than stored as
        `None` against a `NOT NULL` column - which would otherwise surface as a
        500 from the database rather than a 422 from the schema.
        """
        await _vehicle(staff_client)

        body = dict(VALID_ENQUIRY)
        del body["customer_phone"]
        response = await anon_client.post(f"/api/v1/vehicles/{VEHICLE_SLUG}/enquiry", json=body)
        assert response.status_code == 422, response.text

    async def test_rejects_an_over_long_message(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The 2000-character bound is enforced.

        A text column is effectively unbounded, so without this a single visitor
        could store a megabyte in the staff backlog and push the real enquiries
        onto page two.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client, message="a" * 2001)).status_code == 422
        assert (await _submit(anon_client, message="a" * 2000)).status_code == 201

    async def test_rejects_a_phone_of_punctuation_only(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`+ () - .` with no digits behind them is not a phone number.

        The pattern alone permits it, because it forces a leading and trailing
        digit but says nothing about the interior. This is the validator that
        closes that gap, and a dealership calling `+ ( ) - -` learns nothing.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client, customer_phone="+ () - ----.")).status_code == 422

    async def test_rejects_control_characters_in_a_name(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A name may not carry a control character or an angle bracket.

        Defence in depth rather than the security boundary - `message` accepts
        anything, because escaping at render time is what makes text safe. A name
        is filtered because it is short and predictable, so the filter is cheap
        here and nowhere else.
        """
        await _vehicle(staff_client)

        assert (await _submit(anon_client, customer_name="Amina\x00Al-Farsi")).status_code == 422
        assert (
            await _submit(anon_client, customer_name="<script>alert(1)</script>")
        ).status_code == 422

    async def test_accepts_names_in_any_script(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The name pattern is an allowlist of *excluded* characters, not alphabets.

        A test that only used ASCII names would pass against a `^[A-Za-z ]+$`
        pattern too, and that pattern would reject real customers in Dubai. This
        is the test that distinguishes the two designs.

        Each name gets its own address because the unique constraint is on
        `(vehicle_id, customer_email)` - reusing one address would make the second
        submission a 409 and the test would be measuring the constraint instead.
        """
        await _vehicle(staff_client)

        for index, name in enumerate(["علي الحسن", "李伟", "Ólafur Þórsson", "Jean-Luc O'Brien"]):
            response = await _submit(
                anon_client, customer_name=name, customer_email=f"visitor{index}@example.ae"
            )
            assert response.status_code == 201, f"{name} should have been accepted: {response.text}"

    async def test_trims_surrounding_whitespace(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`str_strip_whitespace` means the stored value is the trimmed one.

        A leading newline in a name would otherwise reach the staff list as
        leading whitespace, and a whitespace-only phone number would satisfy
        `min_length` while containing no digits at all.
        """
        await _vehicle(staff_client)

        response = await _submit(
            anon_client,
            customer_name="  Amina Al-Farsi  ",
            customer_phone="  +971 50 123 4567  ",
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["customer_name"] == "Amina Al-Farsi"
        assert body["customer_phone"] == "+971 50 123 4567"


# ---------------------------------------------------------------------------
# What a visitor controls
# ---------------------------------------------------------------------------


class TestVisitorControlledText:
    async def test_stores_a_message_that_looks_like_an_attack_verbatim(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The message is stored exactly as typed, including SQL and HTML.

        This is the design, not a gap. The answer to "should we validate their
        words" is that escaping at render time is what makes them safe, and
        filtering a customer's question for containing `<` loses a real enquiry
        while protecting nothing. The test exists so that a future "helpful"
        sanitiser which strips angle brackets is caught.
        """
        await _vehicle(staff_client)

        hostile = "Robert'); DROP TABLE enquiries;-- <img src=x onerror=alert(1)>"
        response = await _submit(anon_client, message=hostile)
        assert response.status_code == 201, response.text
        assert response.json()["message"] == hostile

        # And the table is still there, which is the part that would actually matter.
        listing = await staff_client.get("/api/v1/enquiries")
        assert listing.status_code == 200, listing.text
        assert len(listing.json()["items"]) == 1

    async def test_sql_metacharacters_in_a_name_are_inert(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A quote in a name cannot break the query that stored it.

        The path the value travels is the ORM's, so this is really a test that
        nothing in the enquiry stack was written to interpolate a string. A
        regression that built the insert by hand would fail here.
        """
        await _vehicle(staff_client)

        response = await _submit(anon_client, customer_name="O'Brien")
        assert response.status_code == 201, response.text
        assert response.json()["customer_name"] == "O'Brien"

    async def test_a_very_long_single_word_message_is_accepted(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """No character-class rules on the message, because there is nothing to enforce.

        Every other field is bounded and constrained; the message is bounded only.
        A test that asserted "no long words" would be pinning a rule that does not
        exist and would reject a legitimate question containing a VIN.
        """
        await _vehicle(staff_client)

        message = "A" * 2000
        response = await _submit(anon_client, message=message)
        assert response.status_code == 201, response.text
        assert response.json()["message"] == message


# ---------------------------------------------------------------------------
# The public surface stays read-only
# ---------------------------------------------------------------------------


class TestPublicSurfaceUnchanged:
    async def test_vehicles_list_still_refuses_a_post(self, anon_client: AsyncClient) -> None:
        """`POST /api/v1/vehicles` is still 405.

        Step 10 pinned this before any write existed. Now that a write lives one
        segment below, the rule is load-bearing rather than theoretical: the
        public vehicle resource must stay read-only so a mistaken decorator cannot
        put a public write in front of a public read.
        """
        assert (await anon_client.post("/api/v1/vehicles", json=VEHICLE_BODY)).status_code == 405

    async def test_vehicle_detail_still_refuses_a_post(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`POST /api/v1/vehicles/{slug}` is 405 too, and the enquiry is a child path."""
        await _vehicle(staff_client)

        assert (
            await anon_client.post(f"/api/v1/vehicles/{VEHICLE_SLUG}", json=VEHICLE_BODY)
        ).status_code == 405

    async def test_enquiries_cannot_be_written_without_a_vehicle_path(
        self, anon_client: AsyncClient
    ) -> None:
        """There is no `POST /api/v1/enquiries` for the public to use.

        A public collection-level write would have no vehicle to resolve, which is
        the whole reason the route is nested under `/vehicles/{slug}`.
        """
        assert (await anon_client.post("/api/v1/enquiries", json=VALID_ENQUIRY)).status_code in (
            401,
            405,
        )


# ---------------------------------------------------------------------------
# Staff authorisation
# ---------------------------------------------------------------------------


class TestStaffAuthorisation:
    @pytest.mark.parametrize(
        ("method", "path", "kwargs"),
        [
            ("get", "/api/v1/enquiries", {}),
            ("get", "/api/v1/enquiries/3f6c1e2a-9b4d-4a1f-8c7e-2d5b0a9e1c33", {}),
            (
                "patch",
                "/api/v1/enquiries/3f6c1e2a-9b4d-4a1f-8c7e-2d5b0a9e1c33/status",
                {"json": {"status": "closed"}},
            ),
        ],
    )
    async def test_anonymous_is_refused(
        self, anon_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]
    ) -> None:
        """Every staff route is 401 without a session - the PATCH included.

        The PATCH case is the one worth parameterising. A read-only guard is the
        usual mistake here: someone protects the list and forgets that the status
        endpoint also requires `CurrentStaff`, and the result is an unauthenticated
        way to close every enquiry in the backlog.
        """
        response = await getattr(anon_client, method)(path, **kwargs)
        assert response.status_code == 401, response.text

    @pytest.mark.parametrize(
        ("method", "path", "kwargs"),
        [
            ("get", "/api/v1/enquiries", {}),
            ("get", "/api/v1/enquiries/3f6c1e2a-9b4d-4a1f-8c7e-2d5b0a9e1c33", {}),
            (
                "patch",
                "/api/v1/enquiries/3f6c1e2a-9b4d-4a1f-8c7e-2d5b0a9e1c33/status",
                {"json": {"status": "closed"}},
            ),
        ],
    )
    async def test_a_signed_in_non_staff_account_is_forbidden(
        self, reader_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]
    ) -> None:
        """A real, correctly authenticated non-staff principal gets 403, not 401.

        `reader_client` carries a genuine session row and a genuine cookie, so the
        403 comes from the production role check rather than from a fixture that
        stubs the check out.
        """
        response = await getattr(reader_client, method)(path, **kwargs)
        assert response.status_code == 403, response.text

    async def test_a_disabled_staff_account_is_refused(self, disabled_client: AsyncClient) -> None:
        """A valid session belonging to a disabled account does not grant access.

        The session row resolves; the account is refused. A check on the session
        alone would miss this.

        403, not 401, and that matches `test_auth.py`: a disabled account is a
        caller who proved who they are, which is a different situation from
        arriving with no session at all. Reusing 401 here would contradict the
        convention the auth tests already pin.
        """
        assert (await disabled_client.get("/api/v1/enquiries")).status_code == 403

    async def test_401_and_403_do_not_say_which_condition_applied(
        self, anon_client: AsyncClient, reader_client: AsyncClient
    ) -> None:
        """Both refusals carry the same shape.

        Distinguishing "no session" from "not staff" tells an attacker which of
        the two they have solved, and there is no product reason for the
        difference - neither is actionable by the caller.
        """
        anonymous = await anon_client.get("/api/v1/enquiries")
        forbidden = await reader_client.get("/api/v1/enquiries")

        assert anonymous.status_code == 403 or anonymous.status_code == 401
        assert set(anonymous.json()["error"]) == set(forbidden.json()["error"])


# ---------------------------------------------------------------------------
# Staff list
# ---------------------------------------------------------------------------


class TestStaffList:
    async def test_starts_empty(self, staff_client: AsyncClient) -> None:
        """A fresh database is an empty list, not a 404 or an error."""
        response = await staff_client.get("/api/v1/enquiries")
        assert response.status_code == 200, response.text
        body = response.json()

        assert body["items"] == []
        assert body["total"] == 0
        assert body["page"] == 1
        assert body["per_page"] == 20

    async def test_returns_newest_first(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """Whatever timestamps the database gave them, the list is newest first.

        Written as a property rather than as exact positions on purpose. The
        submissions happen milliseconds apart and `created_at` is
        `server_default=func.now()`; on SQLite `now()` is `CURRENT_TIMESTAMP`,
        which has second resolution, so all three rows land on the same second and
        the database is entitled to return them in any order. Asserting exact
        identities here would be a test that passes or fails depending on the
        clock.

        The two tests below pin the actual ordering rules deterministically.
        """
        await _vehicle(staff_client)
        for index in range(3):
            response = await _submit(anon_client, customer_email=f"visitor{index}@example.ae")
            assert response.status_code == 201, response.text

        items = (await staff_client.get("/api/v1/enquiries")).json()["items"]
        assert len(items) == 3
        assert [item["created_at"] for item in items] == sorted(
            (item["created_at"] for item in items), reverse=True
        )

    async def test_orders_by_created_at_descending(
        self, staff_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """A submission newer than another is listed first, whichever id it has.

        The rows are inserted directly, with `created_at` set explicitly, so the
        ordering rule can be tested without depending on clock resolution. Going
        through the HTTP API instead would mean either sleeping between
        submissions or asserting a tie, and neither tests the rule.
        """
        vehicle = await _vehicle(staff_client)
        moment = datetime(2026, 3, 14, 15, 9, 26, tzinfo=UTC)

        # Inserted oldest-last, and with ids deliberately uncorrelated to the
        # timestamps, so neither the insertion order nor the id order can produce
        # the expected result by accident.
        older = await _insert_enquiry(
            db_session, vehicle["id"], created_at=moment, customer_email="older@example.ae"
        )
        newer = await _insert_enquiry(
            db_session,
            vehicle["id"],
            created_at=moment + timedelta(minutes=5),
            customer_email="newer@example.ae",
        )
        await db_session.commit()

        items = (await staff_client.get("/api/v1/enquiries")).json()["items"]
        assert [item["id"] for item in items] == [newer, older]

    async def test_breaks_timestamp_ties_by_id(
        self, staff_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Equal `created_at` sorts by id ascending, making the order total.

        This is the regression test for the missing secondary sort key. With only
        `created_at` in the `ORDER BY`, tied rows may come back in any order - and
        because the list is paginated with `OFFSET`/`LIMIT`, that means the same
        enquiry can appear on two pages, or on none. The vehicle listing already
        documents this hazard and sorts the same way.

        Ids are not predictable, so the expectation is computed with the same key
        the query uses. That still makes the test decisive: any order other than
        ascending id is a failure, rather than one of three equally valid
        permutations.
        """
        vehicle = await _vehicle(staff_client)
        moment = datetime(2026, 3, 14, 15, 9, 26, tzinfo=UTC)

        created = [
            await _insert_enquiry(
                db_session,
                vehicle["id"],
                created_at=moment,
                customer_email=f"tie{index}@example.ae",
            )
            for index in range(4)
        ]
        await db_session.commit()

        items = (await staff_client.get("/api/v1/enquiries")).json()["items"]
        assert [item["id"] for item in items] == sorted(created)

    async def test_paging_does_not_repeat_or_skip_a_tied_enquiry(
        self, staff_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Walking a tied dataset page by page visits every enquiry exactly once.

        The user-visible consequence of an unstable sort, and the reason the
        tie-break is worth a test rather than a comment. Paging the whole set and
        concatenating the pages must reproduce the full, duplicate-free list; a
        second identical request for the same page must return the same rows in the
        same order.
        """
        vehicle = await _vehicle(staff_client)
        moment = datetime(2026, 3, 14, 15, 9, 26, tzinfo=UTC)

        created = [
            await _insert_enquiry(
                db_session,
                vehicle["id"],
                created_at=moment,
                customer_email=f"paged{index}@example.ae",
            )
            for index in range(7)
        ]
        await db_session.commit()

        walked: list[str] = []
        for page in (1, 2, 3, 4):
            body = (await staff_client.get(f"/api/v1/enquiries?page={page}&per_page=2")).json()
            walked.extend(item["id"] for item in body["items"])

        assert walked == sorted(created), "paging a tied set repeated or skipped a row"

        # And the same page twice is the same answer, so a staff member clicking
        # "next" and then "previous" sees the list they were looking at.
        first = (await staff_client.get("/api/v1/enquiries?page=2&per_page=2")).json()
        again = (await staff_client.get("/api/v1/enquiries?page=2&per_page=2")).json()
        assert first["items"] == again["items"]

    async def test_filters_by_status(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The filter works, and `total` reflects the filter rather than the page.

        A `total` that counted every enquiry while `items` showed one status would
        make the pager lie - a member of staff would keep paging through nothing.
        """
        await _vehicle(staff_client)
        first = (await _submit(anon_client)).json()
        await _submit(anon_client, customer_email="second@example.ae")

        target = first["id"]
        assert (
            await staff_client.patch(
                f"/api/v1/enquiries/{target}/status", json={"status": "closed"}
            )
        ).status_code == 200

        pending = (await staff_client.get("/api/v1/enquiries?status=pending")).json()
        assert pending["total"] == 1
        assert [item["status"] for item in pending["items"]] == ["pending"]

        closed = (await staff_client.get("/api/v1/enquiries?status=closed")).json()
        assert closed["total"] == 1
        assert [item["status"] for item in closed["items"]] == ["closed"]

    async def test_an_unknown_status_filter_returns_an_empty_list(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`?status=archived` is 200 with nothing, not a 422.

        The filter is a query parameter, not a validated body, and the frontend
        does its own membership check before forwarding one. Refusing an
        unrecognised filter would be defensible too, but an empty list is what a
        typo produces and it must not be an error page in the middle of working a
        backlog.
        """
        await _vehicle(staff_client)
        await _submit(anon_client)

        response = await staff_client.get("/api/v1/enquiries?status=archived")
        assert response.status_code == 200, response.text
        assert response.json()["items"] == []

    async def test_paginates_and_reports_the_unpaged_total(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`page` and `per_page` work, and `total` counts every match.

        A total of `len(items)` would make "this page is the last one" and "this
        page is empty because there are none" indistinguishable - different facts
        for someone paging a backlog.
        """
        await _vehicle(staff_client)
        for index in range(5):
            await _submit(anon_client, customer_email=f"visitor{index}@example.ae")

        first = (await staff_client.get("/api/v1/enquiries?page=1&per_page=2")).json()
        assert len(first["items"]) == 2
        assert first["total"] == 5
        assert first["per_page"] == 2

        last = (await staff_client.get("/api/v1/enquiries?page=3&per_page=2")).json()
        assert len(last["items"]) == 1
        assert last["total"] == 5

    async def test_a_page_past_the_end_is_empty_not_an_error(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """Asking for page 9 of 2 is 200 with no items.

        The frontend computes the last page and never links past it, so this is the
        stale-link case - a bookmark from a shorter backlog, or a hand-edited URL.
        It must not be a 500, and it must not quietly return page 1.
        """
        await _vehicle(staff_client)
        await _submit(anon_client)

        response = await staff_client.get("/api/v1/enquiries?page=9")
        assert response.status_code == 200, response.text
        assert response.json()["items"] == []
        assert response.json()["total"] == 1

    @pytest.mark.parametrize(
        "query", ["page=0", "page=-1", "per_page=0", "per_page=101", "page=abc"]
    )
    async def test_out_of_range_paging_is_refused(
        self, staff_client: AsyncClient, query: str
    ) -> None:
        """`page=0` and `per_page=101` are 422, not silently corrected.

        A clamp would hide a bug in the caller, and `page=0` reaching the service
        would mean `offset(-per_page)`, which PostgreSQL treats as "the last rows"
        - a list that silently runs backwards.
        """
        response = await staff_client.get(f"/api/v1/enquiries?{query}")
        assert response.status_code == 422, response.text


# ---------------------------------------------------------------------------
# Staff detail
# ---------------------------------------------------------------------------


class TestStaffDetail:
    async def test_returns_the_full_record(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The message is here, because this is the page a reply is written from."""
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        response = await staff_client.get(f"/api/v1/enquiries/{created['id']}")
        assert response.status_code == 200, response.text
        body = response.json()

        assert body["id"] == created["id"]
        assert body["message"] == VALID_ENQUIRY["message"]
        assert body["customer_phone"] == VALID_ENQUIRY["customer_phone"]
        assert body["vehicle_slug"] == VEHICLE_SLUG

    async def test_a_missing_enquiry_is_a_404(self, staff_client: AsyncClient) -> None:
        """A well-formed id that matches nothing is 404, not 500."""
        response = await staff_client.get(f"/api/v1/enquiries/{uuid.uuid4()}")
        assert response.status_code == 404, response.text

    async def test_a_malformed_id_is_a_422(self, staff_client: AsyncClient) -> None:
        """A non-UUID is 422 from the path parameter, not a database error.

        `enquiry_id` is typed `uuid.UUID`, so FastAPI rejects it before the service
        runs. Without that, `session.get` would be handed a string and would
        produce a driver error - a 500 for what is a malformed request.
        """
        response = await staff_client.get("/api/v1/enquiries/not-a-uuid")
        assert response.status_code == 422, response.text

    async def test_reading_an_enquiry_does_not_change_it(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A GET is a read; `updated_at` must not move.

        Pinned because the status update path is the only thing that should touch
        it, and a `touch`-on-read would make "last updated" meaningless as an
        answer to "when did we deal with this?".
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        before = created["updated_at"]
        for _ in range(3):
            assert (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).status_code == 200

        after = (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).json()
        assert after["updated_at"] == before


# ---------------------------------------------------------------------------
# Staff status updates
# ---------------------------------------------------------------------------


class TestStatusUpdates:
    async def test_moves_between_every_status(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """All six transitions work, forwards and backwards.

        The backend leaves the transitions unconstrained so a mis-click is
        undoable, and a business wants a record of the conversation rather than a
        state machine. Pinning all six is what stops someone "tidying" it into
        one-directional and making `reopen` - which the detail page offers - a 422.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()
        enquiry_id = created["id"]

        for status in ["answered", "closed", "pending", "closed", "answered", "pending"]:
            response = await staff_client.patch(
                f"/api/v1/enquiries/{enquiry_id}/status", json={"status": status}
            )
            assert response.status_code == 200, f"{status}: {response.text}"
            # The response carries what was *stored*, not what was asked for, so a
            # caller renders the database's answer.
            assert response.json()["status"] == status

    async def test_the_change_is_persisted_and_visible_to_a_later_read(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A status change is committed, not left in a session that is discarded.

        The route calls `session.commit()` after the service. Without it the write
        would be rolled back when the request ended, and the UI would show the new
        badge until the next page load reverted it - the single most confusing
        failure available here, because the write appears to succeed.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        await staff_client.patch(
            f"/api/v1/enquiries/{created['id']}/status", json={"status": "answered"}
        )

        reread = (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).json()
        assert reread["status"] == "answered"

    async def test_advances_updated_at(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`updated_at` moves, so "last updated" answers something.

        Driven by `TimestampMixin.onupdate` on the UPDATE itself rather than by
        the application setting a field, so it is correct even if a future
        service forgets to.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        await staff_client.patch(
            f"/api/v1/enquiries/{created['id']}/status", json={"status": "closed"}
        )

        after = (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).json()
        assert after["updated_at"] >= created["updated_at"]

    async def test_rejects_an_unknown_status(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`"responded"` is 422 and changes nothing.

        This is the status validation the frontend's `EnquiryStatus` union assumes.
        The route would be a plain `str` without the `Literal`, and a typo would be
        stored - producing a value outside `ck_enquiries_status` that the staff
        list's filters could not find.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        response = await staff_client.patch(
            f"/api/v1/enquiries/{created['id']}/status", json={"status": "responded"}
        )
        assert response.status_code == 422, response.text

        after = (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).json()
        assert after["status"] == "pending", "a rejected status must not be applied"

    async def test_rejects_a_status_with_a_wrong_case(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """`"Pending"` is 422.

        A database-level `CHECK` on a `TEXT` column would accept it on
        PostgreSQL and reject it on SQLite, so this test is the reason the
        application-level `Literal` matters: the two databases agree because the
        rule is in Python.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        response = await staff_client.patch(
            f"/api/v1/enquiries/{created['id']}/status", json={"status": "Pending"}
        )
        assert response.status_code == 422, response.text

    async def test_rejects_extra_fields_in_the_status_body(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """A status update cannot smuggle in a customer field.

        `extra="forbid"` on `EnquiryStatusUpdate` means a caller cannot set
        `customer_email` to redirect a reply - the one write on this resource that
        would be a privilege escalation rather than a status change.
        """
        await _vehicle(staff_client)
        created = (await _submit(anon_client)).json()

        response = await staff_client.patch(
            f"/api/v1/enquiries/{created['id']}/status",
            json={"status": "closed", "customer_email": "attacker@example.ae"},
        )
        assert response.status_code == 422, response.text

        after = (await staff_client.get(f"/api/v1/enquiries/{created['id']}")).json()
        assert after["customer_email"] == VALID_ENQUIRY["customer_email"]
        assert after["status"] == "pending"

    async def test_a_missing_enquiry_is_a_404(self, staff_client: AsyncClient) -> None:
        """Updating something that does not exist is 404, not a 200 with a null body."""
        response = await staff_client.patch(
            f"/api/v1/enquiries/{uuid.uuid4()}/status", json={"status": "closed"}
        )
        assert response.status_code == 404, response.text


# ---------------------------------------------------------------------------
# The two surfaces agree
# ---------------------------------------------------------------------------


class TestPublicAndStaffAgree:
    async def test_what_the_public_sends_is_what_staff_reads(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """The public echo and the staff record describe the same enquiry.

        Both are `EnquiryRead`, so a field that drifts between them would be a
        schema bug rather than a mapping bug - and the frontend's
        `EnquiryCreated` and `EnquiryRecord` are separate types, so this is the
        test that catches a divergence a TypeScript assertion would paper over.
        """
        await _vehicle(staff_client)
        public = (await _submit(anon_client)).json()
        staff = (await staff_client.get(f"/api/v1/enquiries/{public['id']}")).json()

        assert public == staff

    async def test_staff_cannot_see_another_vehicle_s_enquiry_under_its_own(
        self, staff_client: AsyncClient, anon_client: AsyncClient
    ) -> None:
        """Each enquiry keeps the vehicle it was actually filed against.

        The slug is denormalised onto the enquiry row for the staff list to render
        without a join. This pins that it is copied from the vehicle row and not
        from the request, so the two cannot disagree.
        """
        await _vehicle(staff_client)
        await _make_vehicle(staff_client, slug="range-rover", vin="SAL1ABAA7MA123456")

        first = (await _submit(anon_client)).json()
        second = (await _submit(anon_client, slug="range-rover")).json()

        assert first["vehicle_slug"] == VEHICLE_SLUG
        assert second["vehicle_slug"] == "range-rover"
        assert first["vehicle_id"] != second["vehicle_id"]

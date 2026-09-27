"""Image upload, ordering and deletion tests.

The property that matters most here is that an upload is **all or nothing** and
that what is stored is genuinely an image. Everything else - ordering, the
primary image, deleting one - follows from those two.

A file that merely *claims* to be a JPEG is the case worth being paranoid about.
A staff upload is an authenticated request, but a staff account is a human with a
laptop and a browser, and a `.jpg` that is really a script is what an
authenticated attacker uploads. The validator is therefore tested against
polyglots and renamed files, not just against a clean happy path.
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.vehicle import VehicleImage
from app.services.images import delete_image, unlink_deleted_image
from tests.conftest import _make_png

VEHICLE: dict[str, Any] = {
    "slug": "image-target",
    "make": "Toyota",
    "model": "Hilux",
    "year": 2021,
    "price": 90_000.0,
    "currency": "USD",
    "status": "available",
}


def _jpeg(width: int = 900, height: int = 700) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (20, 90, 160)).save(buffer, format="JPEG")
    return buffer.getvalue()


async def _vehicle(client: AsyncClient) -> str:
    """Create a vehicle to hang images on, and return its id.

    The slug is unique per call because several tests create two vehicles - a
    test about scoping one vehicle's images away from another's is the whole
    point of them.
    """
    response = await client.post(
        "/api/v1/admin/vehicles", json={**VEHICLE, "slug": f"image-target-{uuid.uuid4().hex[:12]}"}
    )
    assert response.status_code == 201, response.text
    id_: str = response.json()["id"]
    return id_


def _three_files() -> list[tuple[str, bytes, str]]:
    """Three distinct valid images, as `(filename, bytes, content_type)` parts."""
    return [
        (
            f"{index}.png",
            _make_png(width=400, height=300, colour=(index, index, index)),
            "image/png",
        )
        for index in (31, 32, 33)
    ]


async def _upload(
    client: AsyncClient,
    vehicle_id: str,
    files: list[tuple[str, bytes, str]],
) -> Any:
    """POST an image batch. `files` is `(filename, bytes, content_type)` per part."""
    payload: list[tuple[str, tuple[str, bytes, str]]] = []
    alts: list[str] = []
    for filename, data, content_type in files:
        payload.append(("files", (filename, data, content_type)))
        alts.append(f"Photograph {filename}")
    return await client.post(
        f"/api/v1/admin/vehicles/{vehicle_id}/images",
        data={"alts": alts},
        files=payload,
    )


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


async def test_upload_stores_the_image_and_returns_it(
    staff_client: AsyncClient,
) -> None:
    """A valid PNG lands on disk, is recorded, and comes back with its order."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("front.png", _make_png(width=800, height=600, colour=(10, 10, 10)), "image/png")],
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["created"] == 1
    assert len(body["images"]) == 1

    image = body["images"][0]
    assert image["position"] == 0
    assert image["width"] == 800
    assert image["height"] == 600
    assert image["alt"]
    # The stored URL points at the media mount, so the bytes are fetchable at
    # exactly the address recorded in the database.
    assert image["src"].endswith(".png")
    assert "/media/" in image["src"]


async def test_the_stored_file_exists_at_the_recorded_url(
    staff_client: AsyncClient, client: AsyncClient
) -> None:
    """The `src` in the response is not a promise; the file is really there.

    Read back through the plain unauthenticated `client`, which is the honest
    test: photographs are on the public marketing site, so serving them must not
    require a staff session.
    """
    vehicle_id = await _vehicle(staff_client)
    response = await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=640, height=480, colour=(1, 2, 3)), "image/png")],
    )
    src = response.json()["images"][0]["src"]

    fetched = await client.get(src.removeprefix("http://test"))

    assert fetched.status_code == 200
    assert len(fetched.content) > 0
    # It is still a real image, not the bytes that were uploaded.
    assert Image.open(io.BytesIO(fetched.content)).format == "PNG"


async def test_the_upload_response_counts_only_the_new_files(
    staff_client: AsyncClient,
) -> None:
    """`created` is this request's count, not the size of the gallery.

    The response carries both numbers, and they are different: `images` is the
    whole gallery so the editor can re-render without a second request, while
    `created` tells the caller how many of its files were accepted. Reporting the
    gallery size as `created` makes a second upload claim it created two photos
    when the caller sent one, so a client tracking a total adds phantom images.
    """
    vehicle_id = await _vehicle(staff_client)
    await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=400, height=300, colour=(21, 21, 21)), "image/png")],
    )

    response = await _upload(
        staff_client,
        vehicle_id,
        [("b.png", _make_png(width=400, height=300, colour=(22, 22, 22)), "image/png")],
    )

    body = response.json()
    assert body["created"] == 1
    assert len(body["images"]) == 2


async def test_a_batch_of_three_reports_three_created(
    staff_client: AsyncClient,
) -> None:
    """The count tracks a multi-file request."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(staff_client, vehicle_id, _three_files())

    body = response.json()
    assert body["created"] == 3
    assert len(body["images"]) == 3


async def test_the_first_image_is_primary(staff_client: AsyncClient) -> None:
    """Position 0 is the primary image, so the first upload must land there."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=640, height=480, colour=(4, 5, 6)), "image/png")],
    )

    assert response.json()["images"][0]["position"] == 0


async def test_a_later_upload_is_appended_not_inserted(
    staff_client: AsyncClient,
) -> None:
    """Uploading must not silently change which photo leads the listing.

    A staff member adding a second photograph to a live listing would not expect
    the hero image to change underneath it.
    """
    vehicle_id = await _vehicle(staff_client)
    first = await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=640, height=480, colour=(7, 7, 7)), "image/png")],
    )
    original_id = first.json()["images"][0]["id"]

    second = await _upload(staff_client, vehicle_id, [("b.jpg", _jpeg(), "image/jpeg")])

    images = second.json()["images"]
    assert [i["position"] for i in images] == [0, 1]
    assert images[0]["id"] == original_id


async def test_a_renamed_png_is_accepted(staff_client: AsyncClient) -> None:
    """The bytes decide the format; the filename does not.

    Rejecting a PNG that arrived as `.jpg` would fail honest uploads from
    perfectly ordinary tools, for no security gain - the bytes are verified.
    """
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("photo.jpg", _make_png(width=640, height=480, colour=(8, 8, 8)), "image/jpeg")],
    )

    assert response.status_code == 201
    assert response.json()["images"][0]["src"].endswith(".png")


async def test_exif_is_stripped_from_the_stored_file(
    staff_client: AsyncClient, client: AsyncClient
) -> None:
    """A photograph must not carry a location or a device serial to the public site."""
    source = io.BytesIO()
    image = Image.new("RGB", (800, 600), (30, 30, 30))
    exif = Image.Exif()
    exif[0x010F] = "Humera Test Camera"  # Make
    exif[0x0110] = "PRIVATE-SERIAL-1234"  # Model
    image.save(source, format="JPEG", exif=exif)

    vehicle_id = await _vehicle(staff_client)
    response = await _upload(staff_client, vehicle_id, [("x.jpg", source.getvalue(), "image/jpeg")])
    assert response.status_code == 201

    fetched = await client.get(response.json()["images"][0]["src"].removeprefix("http://test"))

    stored = Image.open(io.BytesIO(fetched.content))
    assert "PRIVATE-SERIAL-1234" not in str(stored.info)
    # EXIF re-encoded in place, not merely copied.
    assert not stored.getexif()


# ---------------------------------------------------------------------------
# What is refused
# ---------------------------------------------------------------------------


async def test_a_text_file_named_as_a_jpeg_is_rejected(staff_client: AsyncClient) -> None:
    """Bytes that are not an image are refused whatever the filename says."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("evil.jpg", b"<?php system($_GET['c']); ?>", "image/jpeg")],
    )

    assert response.status_code == 422


async def test_a_gif_php_polyglot_is_rejected(staff_client: AsyncClient) -> None:
    """A file that is a valid GIF *and* carries PHP is not a photograph.

    The classic upload bypass: the decoder is happy, and a misconfigured server
    later runs the trailing script. Rejecting any format outside the three
    allowed ones closes it at the door.
    """
    polyglot = b"GIF89a" + b"<?php system($_GET['c']); ?>"
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(staff_client, vehicle_id, [("shell.gif", polyglot, "image/gif")])

    assert response.status_code == 422


async def test_a_declared_jpeg_content_type_cannot_lie(staff_client: AsyncClient) -> None:
    """The declared content type is not evidence, and is not trusted."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("notes.png", b"just some text pretending", "image/png")],
    )

    assert response.status_code == 422


async def test_an_image_too_small_to_be_a_listing_photo_is_rejected(
    staff_client: AsyncClient,
) -> None:
    """A tracking pixel is not a car photograph."""
    vehicle_id = await _vehicle(staff_client)

    response = await _upload(
        staff_client,
        vehicle_id,
        [("tiny.png", _make_png(width=64, height=64, colour=(0, 0, 0)), "image/png")],
    )

    assert response.status_code == 422


async def test_an_oversized_file_is_rejected(staff_client: AsyncClient) -> None:
    """The byte ceiling is enforced, not merely documented."""
    vehicle_id = await _vehicle(staff_client)
    oversized = b"\x89PNG\r\n\x1a\n" + b"\x00" * (settings.image_max_bytes + 1)

    response = await _upload(staff_client, vehicle_id, [("huge.png", oversized, "image/png")])

    assert response.status_code == 422


async def test_an_image_without_a_description_is_rejected(
    staff_client: AsyncClient,
) -> None:
    """Alt text is required. Inventing one from the vehicle's name would be a lie."""
    vehicle_id = await _vehicle(staff_client)

    response = await staff_client.post(
        f"/api/v1/admin/vehicles/{vehicle_id}/images",
        data={"alts": ["   "]},
        files=[
            ("files", ("a.png", _make_png(width=640, height=480, colour=(9, 9, 9)), "image/png"))
        ],
    )

    assert response.status_code == 422


async def test_one_bad_file_rejects_the_whole_batch(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Four good photographs and one bad one store *nothing*.

    Storing the good three would leave the caller believing the upload failed
    while the gallery had silently changed - and would leave four orphaned files
    on disk with no rows pointing at them.
    """
    vehicle_id = await _vehicle(staff_client)
    good = _make_png(width=640, height=480, colour=(11, 12, 13))

    response = await _upload(
        staff_client,
        vehicle_id,
        [
            ("a.png", good, "image/png"),
            ("b.png", good, "image/png"),
            ("bad.png", b"not an image at all", "image/png"),
        ],
    )

    assert response.status_code == 422
    rows = (await db_session.scalars(select(VehicleImage))).all()
    assert rows == [], "no row should have been written"


async def test_too_many_files_in_one_request_is_rejected(
    staff_client: AsyncClient,
) -> None:
    """The per-request cap is a real limit."""
    vehicle_id = await _vehicle(staff_client)
    data = _make_png(width=400, height=300, colour=(2, 2, 2))
    batch = [
        (f"{index}.png", data, "image/png")
        for index in range(settings.image_max_files_per_request + 1)
    ]

    response = await _upload(staff_client, vehicle_id, batch)

    assert response.status_code == 422


async def test_uploading_to_an_unknown_vehicle_is_404(staff_client: AsyncClient) -> None:
    """No vehicle, no gallery."""
    response = await _upload(
        staff_client,
        str(uuid.uuid4()),
        [("a.png", _make_png(width=400, height=300, colour=(3, 3, 3)), "image/png")],
    )

    assert response.status_code == 404


async def test_uploading_requires_a_staff_session(anon_client: AsyncClient) -> None:
    """No session, no write."""
    response = await _upload(
        anon_client,
        str(uuid.uuid4()),
        [("a.png", _make_png(width=400, height=300, colour=(3, 3, 3)), "image/png")],
    )

    assert response.status_code == 401


async def test_uploading_refuses_a_non_staff_account(reader_client: AsyncClient) -> None:
    """A valid session without the staff role cannot write."""
    response = await _upload(
        reader_client,
        str(uuid.uuid4()),
        [("a.png", _make_png(width=400, height=300, colour=(3, 3, 3)), "image/png")],
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------


async def _three_images(client: AsyncClient, vehicle_id: str) -> list[str]:
    """Upload three photographs and return their ids, in order."""
    response = await _upload(
        client,
        vehicle_id,
        [
            ("a.png", _make_png(width=400, height=300, colour=(1, 1, 1)), "image/png"),
            ("b.png", _make_png(width=400, height=300, colour=(2, 2, 2)), "image/png"),
            ("c.png", _make_png(width=400, height=300, colour=(3, 3, 3)), "image/png"),
        ],
    )
    assert response.status_code == 201, response.text
    return [image["id"] for image in response.json()["images"]]


async def test_reordering_sets_the_display_order(staff_client: AsyncClient) -> None:
    """The supplied order is the new order, and the first entry is the hero."""
    vehicle_id = await _vehicle(staff_client)
    first, second, third = await _three_images(staff_client, vehicle_id)

    response = await staff_client.put(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/order",
        json={"image_ids": [third, first, second]},
    )

    assert response.status_code == 200, response.text
    images = response.json()["images"]
    assert [i["id"] for i in images] == [third, first, second]
    assert [i["position"] for i in images] == [0, 1, 2]


async def test_reordering_must_list_every_image(staff_client: AsyncClient) -> None:
    """A partial list is rejected, not merged.

    A partial order is ambiguous the moment two people reorder the same gallery
    at once: the second request would be resolving a move against an order the
    first had already replaced.
    """
    vehicle_id = await _vehicle(staff_client)
    ids = await _three_images(staff_client, vehicle_id)

    response = await staff_client.put(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/order",
        json={"image_ids": ids[:2]},
    )

    assert response.status_code == 422


async def test_reordering_rejects_a_repeated_id(staff_client: AsyncClient) -> None:
    """A duplicate would make one image occupy two positions."""
    vehicle_id = await _vehicle(staff_client)
    first, second, third = await _three_images(staff_client, vehicle_id)

    response = await staff_client.put(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/order",
        json={"image_ids": [first, first, second, third]},
    )

    assert response.status_code == 422


async def test_reordering_cannot_reach_another_vehicles_image(
    staff_client: AsyncClient,
) -> None:
    """An image from another vehicle is not part of this gallery."""
    mine = await _vehicle(staff_client)
    theirs = await _vehicle(staff_client)
    assert theirs != mine

    my_ids = await _three_images(staff_client, mine)
    their_ids = await _three_images(staff_client, theirs)

    response = await staff_client.put(
        f"/api/v1/admin/vehicles/{mine}/images/order",
        json={"image_ids": [their_ids[0], *my_ids]},
    )

    # Four ids for a three-image gallery, one of them a stranger's.
    assert response.status_code == 422


async def test_setting_a_primary_image_shifts_the_rest_down(
    staff_client: AsyncClient,
) -> None:
    """Promoting the third image keeps the other two in their relative order."""
    vehicle_id = await _vehicle(staff_client)
    first, second, third = await _three_images(staff_client, vehicle_id)

    response = await staff_client.post(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/{third}/primary"
    )

    assert response.status_code == 200, response.text
    images = response.json()["images"]
    assert [i["id"] for i in images] == [third, first, second]
    assert images[0]["position"] == 0


async def test_setting_a_primary_image_that_is_already_primary_is_a_no_op(
    staff_client: AsyncClient,
) -> None:
    """Promoting the current hero changes nothing, and says so quietly."""
    vehicle_id = await _vehicle(staff_client)
    first, _, _ = await _three_images(staff_client, vehicle_id)

    response = await staff_client.post(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/{first}/primary"
    )

    assert response.status_code == 200
    assert response.json()["images"][0]["id"] == first


async def test_promoting_another_vehicles_image_is_404(
    staff_client: AsyncClient,
) -> None:
    """Scoping is by both ids, so a known id from elsewhere does not exist here."""
    mine = await _vehicle(staff_client)
    theirs = await _vehicle(staff_client)
    their_ids = await _three_images(staff_client, theirs)

    response = await staff_client.post(
        f"/api/v1/admin/vehicles/{mine}/images/{their_ids[0]}/primary"
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------


async def test_the_file_outlives_the_row_until_the_transaction_commits(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Deleting a row must not delete the file before the commit.

    Tested at the service boundary rather than through HTTP, because the failure
    this guards against is a *crash between two steps* and a passing HTTP request
    cannot show it. The ordering is the whole claim; asserting only the end state
    would pass just as happily with the unsafe order.

    The dangerous sequence, if the file went first:

        DELETE row -> unlink file -> [crash, or commit fails] -> rollback

    ...leaving a committed row pointing at bytes that no longer exist, which is a
    broken image on a live listing. Reverse it and the worst case is an invisible
    orphaned file.
    """
    vehicle_id = await _vehicle(staff_client)
    await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=400, height=300, colour=(41, 41, 41)), "image/png")],
    )
    listing = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    image = listing.json()["images"][0]
    key = image["src"].rsplit("/media/", 1)[1]
    on_disk = Path(settings.image_storage_root) / key
    assert on_disk.exists()

    deletion = await delete_image(
        db_session, vehicle_id=uuid.UUID(vehicle_id), image_id=uuid.UUID(image["id"])
    )

    # The row is gone in the transaction, the bytes are untouched.
    assert deletion.storage_key == key
    assert on_disk.exists(), "file removed before the row was committed"

    await db_session.commit()
    await unlink_deleted_image(uuid.UUID(vehicle_id), uuid.UUID(image["id"]), deletion.storage_key)

    assert not on_disk.exists()


async def test_a_committed_row_survives_a_failed_file_removal(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """An unlinkable file does not resurrect the row or fail the request.

    The row is already gone and committed; refusing to finish would tell staff
    the photograph is still there. The file is left behind to be swept up, which
    is invisible to visitors.
    """
    vehicle_id = await _vehicle(staff_client)
    await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=400, height=300, colour=(42, 42, 42)), "image/png")],
    )
    listing = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    image = listing.json()["images"][0]

    deletion = await delete_image(
        db_session, vehicle_id=uuid.UUID(vehicle_id), image_id=uuid.UUID(image["id"])
    )
    await db_session.commit()

    class RefusesToDelete:
        async def delete(self, key: str) -> None:
            raise PermissionError("read-only filesystem")

    removed = await unlink_deleted_image(
        uuid.UUID(vehicle_id),
        uuid.UUID(image["id"]),
        deletion.storage_key,
        storage=RefusesToDelete(),
    )

    assert removed is False
    # Still gone from the gallery - the request did not fail.
    remaining = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert remaining.json()["images"] == []


async def test_a_failed_commit_leaves_the_file_in_place(
    staff_client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The end-to-end version of the ordering guarantee, on the real endpoint.

    The service-level test above only proves `delete_image` does not touch the
    filesystem. This proves the *route* does the two steps in the right order, by
    making the commit fail and checking nothing was unlinked on the way:

    * commit-then-unlink: the commit raises, the unlink never runs, bytes remain.
    * unlink-then-commit: the commit raises, the bytes are already gone, and the
      rolled-back row now points at a file that is not there.

    The request is allowed to blow up here - a 500 is the honest outcome of a
    database that refuses to commit - and the test is about the filesystem.
    """
    vehicle_id = await _vehicle(staff_client)
    await _upload(
        staff_client,
        vehicle_id,
        [("a.png", _make_png(width=400, height=300, colour=(43, 43, 43)), "image/png")],
    )
    listing = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    image = listing.json()["images"][0]
    on_disk = Path(settings.image_storage_root) / image["src"].rsplit("/media/", 1)[1]
    assert on_disk.exists()

    async def refuse_to_commit() -> None:
        raise OperationalError("DELETE", {}, Exception("disk I/O error"))

    monkeypatch.setattr(db_session, "commit", refuse_to_commit)

    with pytest.raises(Exception):
        await staff_client.delete(f"/api/v1/admin/vehicles/{vehicle_id}/images/{image['id']}")

    assert on_disk.exists(), "file unlinked before a commit that never happened"


async def test_deleting_closes_the_gap_it_leaves(staff_client: AsyncClient) -> None:
    """Positions stay contiguous from 0, because position 0 is the hero."""
    vehicle_id = await _vehicle(staff_client)
    first, second, third = await _three_images(staff_client, vehicle_id)

    response = await staff_client.delete(f"/api/v1/admin/vehicles/{vehicle_id}/images/{first}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deleted"] == first
    assert [i["id"] for i in body["images"]] == [second, third]
    assert [i["position"] for i in body["images"]] == [0, 1]


async def test_deleting_the_primary_promotes_the_next(staff_client: AsyncClient) -> None:
    """A hole at position 0 would mean the hero image is a gap."""
    vehicle_id = await _vehicle(staff_client)
    first, second, _ = await _three_images(staff_client, vehicle_id)

    response = await staff_client.delete(f"/api/v1/admin/vehicles/{vehicle_id}/images/{first}")

    assert response.json()["images"][0]["id"] == second


async def test_deleting_another_vehicles_image_is_404(
    staff_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The image from another vehicle survives, and the caller's does not change."""
    mine = await _vehicle(staff_client)
    theirs = await _vehicle(staff_client)
    their_ids = await _three_images(staff_client, theirs)

    response = await staff_client.delete(f"/api/v1/admin/vehicles/{mine}/images/{their_ids[0]}")

    assert response.status_code == 404
    remaining = (await db_session.scalars(select(VehicleImage))).all()
    assert len(remaining) == 3


async def test_a_vehicle_can_end_up_with_no_images(staff_client: AsyncClient) -> None:
    """A car awaiting photography is a legitimate state, not a broken one."""
    vehicle_id = await _vehicle(staff_client)
    ids = await _three_images(staff_client, vehicle_id)

    for image_id in ids:
        response = await staff_client.delete(
            f"/api/v1/admin/vehicles/{vehicle_id}/images/{image_id}"
        )
        assert response.status_code == 200

    assert response.json()["images"] == []
    # The vehicle itself is still published, with no images.
    fetched = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert fetched.status_code == 200
    assert fetched.json()["images"] == []


async def test_deleting_requires_a_staff_session(
    staff_client: AsyncClient, anon_client: AsyncClient, db_session: AsyncSession
) -> None:
    """No session, no delete."""
    vehicle_id = await _vehicle(staff_client)
    ids = await _three_images(staff_client, vehicle_id)

    response = await anon_client.delete(f"/api/v1/admin/vehicles/{vehicle_id}/images/{ids[0]}")

    assert response.status_code == 401


async def test_deleting_an_unknown_image_is_404(staff_client: AsyncClient) -> None:
    """Nothing to delete."""
    vehicle_id = await _vehicle(staff_client)

    response = await staff_client.delete(
        f"/api/v1/admin/vehicles/{vehicle_id}/images/{uuid.uuid4()}"
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# The gallery on the vehicle record
# ---------------------------------------------------------------------------


async def test_the_vehicle_response_carries_its_images_in_order(
    staff_client: AsyncClient,
) -> None:
    """One request gives the editor everything it needs to render the gallery."""
    vehicle_id = await _vehicle(staff_client)
    ids = await _three_images(staff_client, vehicle_id)

    fetched = await staff_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")

    images = fetched.json()["images"]
    assert [i["id"] for i in images] == ids
    assert [i["position"] for i in images] == [0, 1, 2]


@pytest.mark.parametrize("method", ["get", "put", "post", "delete", "patch"])
async def test_image_routes_require_a_staff_session(anon_client: AsyncClient, method: str) -> None:
    """Every route on the image surface refuses an anonymous caller."""
    vehicle_id = str(uuid.uuid4())
    image_id = str(uuid.uuid4())
    paths = {
        "get": f"/api/v1/admin/vehicles/{vehicle_id}/images",
        "put": f"/api/v1/admin/vehicles/{vehicle_id}/images/order",
        "post": f"/api/v1/admin/vehicles/{vehicle_id}/images",
        "delete": f"/api/v1/admin/vehicles/{vehicle_id}/images/{image_id}",
        "patch": f"/api/v1/admin/vehicles/{vehicle_id}/images/{image_id}",
    }

    response = await anon_client.request(method, paths[method])

    # 405 for a verb with no matching route, 401 for one that exists. Either way
    # the request did not reach a handler that could act on it.
    assert response.status_code in {401, 405}

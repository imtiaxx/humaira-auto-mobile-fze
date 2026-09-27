"""Vehicle image management: append, reorder, choose primary, delete.

The ordering problem
--------------------
`vehicle_images` carries `UNIQUE(vehicle_id, position)`. That constraint is the
entire reason position 0 can be trusted as "the primary image" - but it also
means a naive reorder fails, because swapping two rows requires the second write
to occupy a position the first still holds. Writing `A->1, B->0` against a
`(0=A, 1=B)` gallery violates the constraint on its first statement.

So every operation that changes order does it in **two phases**: park every
affected row at a negative offset that cannot collide, then write the final
positions. It is two round trips instead of one and it cannot deadlock or trip
the constraint. Positions are non-negative by CHECK constraint, which is what
makes the parking offsets safe: the database itself guarantees the temporary
space is unused.

The primary image
-----------------
Position 0 is primary, and there is no `is_primary` flag. `set_primary` is
therefore a reorder that moves one image to the front, and "exactly one primary"
is a property the unique constraint enforces rather than a rule this module
tries to maintain. The alternative - a boolean alongside the ordering - is the
two-sources-of-truth bug documented on the model.

Storage and the database cannot drift apart
-------------------------------------------
A file is written before its row, and a row is deleted before its file. If the
process dies between the two, the result is an orphan file on disk (invisible,
harmless, reclaimable) rather than a database row pointing at bytes that were
never written (a broken image on a live vehicle page). The asymmetry is
deliberate: the bad state is one nobody sees.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.db.models.vehicle import VehicleImage
from app.repositories.vehicle import VehicleRepository
from app.repositories.vehicle_image import VehicleImageRepository
from app.schemas.vehicle_write import VehicleImageAdminResponse
from app.services.image_validation import validate_image
from app.storage import ImageStorage, build_image_key, get_image_storage

logger = get_logger(__name__)

#: Parking offset for a two-phase reorder. Permuting positions in place would trip
#: `uq_vehicle_images_vehicle_position` the moment two rows swapped, so rows are
#: first moved to a range no live row occupies and only then given their real
#: positions.
#:
#: *Above* the live range, not below it. The obvious choice is a large negative
#: number, on the reasoning that a position that can never be real must be safe -
#: and the database says otherwise: `non_negative_position` forbids negatives
#: outright, so parking there fails every reorder, promote and delete-with-survivors
#: with a CHECK violation. Positive and above `image_max_per_vehicle` is the
#: genuinely empty region: it satisfies the CHECK, and no real row can be there
#: because a vehicle is capped at that many images.
_PARKING_OFFSET = settings.image_max_per_vehicle


@dataclass(frozen=True, slots=True)
class ImageUploadCandidate:
    """One file as it arrived: untrusted bytes, a claimed type, and an alt.

    Deliberately holds the *raw* upload rather than a validated image. The
    service validates the whole batch before storing any of it, so this type must
    not imply the bytes have already been checked.
    """

    data: bytes
    alt: str
    declared_content_type: str | None = None


async def add_images(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    candidates: Sequence[ImageUploadCandidate],
    storage: ImageStorage | None = None,
) -> list[VehicleImageAdminResponse]:
    """Append one or more images to a vehicle's gallery.

    Appended, never inserted: a new photograph goes to the end of the gallery,
    so uploading does not silently change which image is the hero on a vehicle
    someone is currently looking at. Making an image primary is a separate,
    explicit act.

    The first image uploaded for a vehicle becomes primary, because position 0 is
    primary by definition and an empty gallery has no primary to contradict.

    Validates every file before writing any of them. A request carrying four
    photographs and a corrupt fifth stores nothing, rather than leaving three
    orphans on disk and a half-finished gallery - the caller gets one error and
    one clean retry.
    """
    if not candidates:
        raise ValidationError("No images were provided.")

    if len(candidates) > settings.image_max_files_per_request:
        raise ValidationError(
            f"Upload at most {settings.image_max_files_per_request} images at a time."
        )

    repository = VehicleRepository(session)
    images = VehicleImageRepository(session)
    vehicle = await repository.get_by_id(vehicle_id)
    if vehicle is None:
        raise NotFoundError("No vehicle matches that identifier.")

    existing_count = await images.count_for_vehicle(vehicle_id)
    if existing_count + len(candidates) > settings.image_max_per_vehicle:
        raise ValidationError(
            f"A vehicle can hold at most {settings.image_max_per_vehicle} images. "
            f"This vehicle already has {existing_count}. Remove one before adding more."
        )

    # Validate every file before storing any of them, so a bad file in the batch
    # cannot leave the gallery half-updated or leave orphaned bytes on disk.
    validated: list[tuple[str, str, bytes, int, int]] = []
    for index, candidate in enumerate(candidates):
        image = validate_image(
            candidate.data,
            declared_content_type=candidate.declared_content_type,
        )
        validated.append(
            (
                image.extension,
                _clean_alt(candidate.alt, index=index),
                image.data,
                image.width,
                image.height,
            )
        )

    target = storage or get_image_storage()
    start_position = await images.next_position(vehicle_id)

    created: list[VehicleImage] = []
    for offset, (extension, alt, data, width, height) in enumerate(validated):
        key = build_image_key(extension)
        # File first, row second - see the module docstring.
        public_url = await target.save(key, data)
        record = VehicleImage(
            vehicle_id=vehicle_id,
            position=start_position + offset,
            src=public_url,
            alt=alt,
            width=width,
            height=height,
        )
        images.add(record)
        created.append(record)
    await images.flush()
    logger.info(
        "vehicle_images_added",
        extra={"vehicle_id": str(vehicle_id), "count": len(created)},
    )
    return [
        VehicleImageAdminResponse.model_validate(record)
        for record in await images.list_for_vehicle(vehicle_id)
    ]


async def reorder_images(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    image_ids: Sequence[uuid.UUID],
) -> list[VehicleImageAdminResponse]:
    """Set the gallery's complete order, primary first.

    The request must list **every** image belonging to the vehicle. A partial
    list would be ambiguous the moment two people reorder the same gallery at
    once: the second request would resolve against an order the first had
    already replaced, and one of them would silently lose.
    """
    repository = VehicleRepository(session)
    images = VehicleImageRepository(session)
    if await repository.get_by_id(vehicle_id) is None:
        raise NotFoundError("No vehicle matches that identifier.")

    current = await images.list_for_vehicle(vehicle_id)
    current_ids = [record.id for record in current]

    if len(image_ids) != len(current_ids):
        raise ValidationError(
            "The order must list every image on this vehicle "
            f"({len(current_ids)} expected, {len(image_ids)} received)."
        )
    if set(image_ids) != set(current_ids):
        raise ValidationError("The order must list this vehicle's own images and no others.")

    await _apply_order(session, current, image_ids)
    logger.info("vehicle_images_reordered", extra={"vehicle_id": str(vehicle_id)})
    return [
        VehicleImageAdminResponse.model_validate(record)
        for record in await images.list_for_vehicle(vehicle_id)
    ]


async def set_primary_image(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    image_id: uuid.UUID,
) -> list[VehicleImageAdminResponse]:
    """Make one image the primary, i.e. move it to position 0.

    Implemented as a reorder rather than a flag update, so the rule stays
    "position 0 is the primary image" everywhere - in the database, in the API
    and in the frontend - with no second column to fall out of step.
    """
    repository = VehicleRepository(session)
    images = VehicleImageRepository(session)
    if await repository.get_by_id(vehicle_id) is None:
        raise NotFoundError("No vehicle matches that identifier.")

    target = await images.get_for_vehicle(vehicle_id, image_id)
    if target is None:
        raise NotFoundError("That image does not belong to this vehicle.")

    current = await images.list_for_vehicle(vehicle_id)
    reordered = [target, *(record for record in current if record.id != image_id)]
    await _apply_order(session, current, [record.id for record in reordered])
    logger.info(
        "vehicle_primary_image_set",
        extra={"vehicle_id": str(vehicle_id), "image_id": str(image_id)},
    )
    return [
        VehicleImageAdminResponse.model_validate(record)
        for record in await images.list_for_vehicle(vehicle_id)
    ]


@dataclass(frozen=True, slots=True)
class ImageDeletion:
    """A row deletion, plus the file now safe to remove once it has committed.

    The file is deliberately *not* removed by `delete_image`. The ordering is the
    entire point of the operation, and it cannot be honoured from inside the
    service: the caller owns the transaction and commits after this returns.

    Unlinking here would put the file's deletion *before* the commit, so a crash
    in between - or a commit that fails outright - would roll the row back and
    leave it pointing at bytes that no longer exist. That is a broken image on a
    live listing, which is the one outcome worth spending an extra step to avoid.
    The opposite ordering, a committed row with no file behind it, is merely an
    invisible orphan and can be swept up later.
    """

    images: list[VehicleImageAdminResponse]
    storage_key: str | None


async def unlink_deleted_image(
    vehicle_id: uuid.UUID,
    image_id: uuid.UUID,
    key: str | None,
    *,
    storage: ImageStorage | None = None,
) -> bool:
    """Remove the bytes behind a row that has already been committed as deleted.

    Call only after the commit. Returns whether the file was actually removed.

    Never raises: at this point the row is gone, so a file that cannot be
    unlinked is an operational cleanup rather than a failed request. Reporting
    an error here would tell staff the photograph is still on the vehicle when it
    is not, and would invite a retry that deletes a different, live image.
    """
    if key is None:
        return False

    target = storage or get_image_storage()
    try:
        await target.delete(key)
    except Exception as exc:
        logger.error(
            "vehicle_image_file_orphaned",
            extra={"vehicle_id": str(vehicle_id), "image_id": str(image_id), "error": str(exc)},
        )
        return False
    return True


async def delete_image(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    image_id: uuid.UUID,
) -> ImageDeletion:
    """Remove one image and close the gap it leaves.

    Positions are renumbered contiguously from 0, which matters: the gallery's
    first image is the hero, and leaving a hole at position 0 after a deletion
    would mean the primary image is a hole rather than a photograph.

    A vehicle may end up with no images. That is a legitimate state - a car
    awaiting photography - and the public page already renders that honestly
    instead of substituting a placeholder picture of a car that is not theirs.

    The row is deleted here but not committed, and the file is not touched. Pass
    the returned key to `unlink_deleted_image` after committing.
    """
    images = VehicleImageRepository(session)
    record = await images.get_for_vehicle(vehicle_id, image_id)
    if record is None:
        raise NotFoundError("That image does not belong to this vehicle.")

    key = _storage_key_from_url(record.src)

    await images.delete(record)
    remaining = await images.list_for_vehicle(vehicle_id)
    await _apply_order(session, remaining, [item.id for item in remaining])

    logger.info("vehicle_image_deleted", extra={"vehicle_id": str(vehicle_id)})
    return ImageDeletion(
        images=[
            VehicleImageAdminResponse.model_validate(item)
            for item in await images.list_for_vehicle(vehicle_id)
        ],
        storage_key=key,
    )


async def _apply_order(
    session: AsyncSession,
    current: Sequence[VehicleImage],
    ordered_ids: Sequence[uuid.UUID],
) -> None:
    """Rewrite positions in two phases so the unique constraint never trips."""
    by_id = {record.id: record for record in current}
    if not ordered_ids:
        return

    # Phase one: park everything out of the way. A strictly increasing ramp, so
    # the parked rows do not collide with each other either.
    for offset, record_id in enumerate(ordered_ids):
        record = by_id[record_id]
        record.position = _PARKING_OFFSET + offset

    # Let SQLAlchemy emit the parked positions before the real ones, so the
    # database never sees a final position that a parked row still holds.
    await session.flush()

    # Phase two: write the real positions.
    for position, record_id in enumerate(ordered_ids):
        by_id[record_id].position = position

    await session.flush()


def _clean_alt(alt: str, *, index: int) -> str:
    """Normalise and bound alt text.

    Alt text is required, not optional. A photograph with no description is
    invisible to a screen reader, and the alternative - inventing a caption from
    the vehicle's name - would be a claim about an image nobody looked at.
    """
    collapsed = " ".join((alt or "").split())
    if not collapsed:
        raise ValidationError(
            f"Image {index + 1} needs a description. Describe what the photo shows."
        )
    if len(collapsed) > 300:
        raise ValidationError(
            f"Image {index + 1} description is too long. Keep it under 300 characters."
        )
    return collapsed


def _storage_key_from_url(public_url: str) -> str | None:
    """Recover the storage key from a stored public URL.

    Returns `None` when the URL was not produced by this project's storage - for
    instance a row pointing at an existing CDN image from before the media
    directory existed. Such a row is still deletable; there is simply no local
    file to remove, and inventing a path to delete would be worse than not
    trying.
    """
    # The prefix comes from settings rather than a literal so that changing
    # `image_media_prefix` cannot leave this method deleting the wrong path while
    # the storage class resolves against a different root.
    marker = f"{settings.image_media_prefix.rstrip('/')}/"
    path = urlparse(public_url).path
    index = path.find(marker)
    if index == -1:
        logger.warning("vehicle_image_url_not_local", extra={"url": public_url[:200]})
        return None
    return path[index + len(marker) :]

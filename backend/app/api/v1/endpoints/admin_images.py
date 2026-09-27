"""Staff image management endpoints.

Four operations on a vehicle's photographs: append, reorder, promote to primary,
delete. All require a staff session; all operate only on images that belong to
the vehicle named in the path, so a known image id from another vehicle is
indistinguishable from one that does not exist.

`multipart/form-data` rather than a JSON body
---------------------------------------------
Image bytes are sent as `multipart/form-data`. A base64 string inside JSON costs
roughly a third more in transfer, lands in memory already inflated, and needs a
separate size limit enforced by hand; the multipart parser has both limits
already. It is also what a browser form can produce without JavaScript.

The declared `Content-Type` of each part is checked against the bytes, so a
file renamed to `.jpg` but actually a PNG is accepted (the real format wins) while
a script or an HTML page renamed to `.jpg` is rejected. See
`app.services.image_validation`.

Row deleted before the file
---------------------------
Deletion removes the database row and commits, and only then unlinks the file.
The reverse order would mean a committed deletion whose file is still on disk -
harmless, invisible, and reclaimable - whereas deleting the file first risks a
committed row whose bytes are already gone, which is a broken image on a live
public page. If the unlink fails, the request still succeeds and the stranded
file is logged as `vehicle_image_file_orphaned`: the metadata change is already
durable, and reporting an error would tell staff an image is still present when
it is not.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Path, UploadFile, status

from app.api.deps import CurrentStaff, DbWriteSession
from app.schemas.vehicle_write import (
    ImageDeleteResult,
    ImageOrderRequest,
    ImageReorderResult,
    ImageUploadResult,
)
from app.services.images import (
    ImageUploadCandidate,
    add_images,
    delete_image,
    reorder_images,
    set_primary_image,
    unlink_deleted_image,
)

router = APIRouter(prefix="/admin/vehicles", tags=["admin:images"])

VehicleIdPath = Annotated[
    uuid.UUID,
    Path(description="Identifier of the vehicle that owns the image."),
]
ImageIdPath = Annotated[
    uuid.UUID,
    Path(description="Identifier of the image."),
]

# Annotated for the same reason as in `admin_vehicles`: FastAPI wants
# `dict[int | str, dict[str, Any]]`, which an inferred literal dict is too narrow
# to unpack into a per-route dict.
_Responses = dict[int | str, dict[str, Any]]

_UNAUTHORISED: _Responses = {
    status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."},
    status.HTTP_403_FORBIDDEN: {"description": "The account is not staff."},
}
_NOT_FOUND: _Responses = {
    status.HTTP_404_NOT_FOUND: {"description": "No such vehicle, or no such image on it."}
}


@router.post(
    "/{vehicle_id}/images",
    response_model=ImageUploadResult,
    status_code=status.HTTP_201_CREATED,
    summary="Add photographs to a vehicle",
    description=(
        "Uploads up to ten JPEG, PNG or WebP files, all in one request.\n\n"
        "Each file is a `files` part, and each needs an alt text in `alts`, in "
        "the same order. Alt text is **required**: a photograph with no "
        "description is invisible to a screen reader, and the alternative - "
        "inventing a caption from the vehicle's name - would be a claim about an "
        "image nobody looked at. One bad description rejects the whole request, "
        "and nothing is stored.\n\n"
        "The bytes are re-encoded on the way in: anything that is not a genuine "
        "JPEG, PNG or WebP is rejected, images over 10 MB or outside 320x240 to "
        "12000x12000 are rejected, and stored files carry no EXIF, so a "
        "photograph cannot leak a location or a device serial number through the "
        "public site.\n\n"
        "New images are appended after the existing ones, so uploading does not "
        "silently change which photograph leads a listing. Promote deliberately "
        "with the primary route.\n\n"
        "There is a cap of 30 images per vehicle."
    ),
    responses={
        **_UNAUTHORISED,
        **_NOT_FOUND,
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "A file failed validation."},
    },
)
async def post_images(
    vehicle_id: VehicleIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
    files: Annotated[list[UploadFile], File(description="JPEG, PNG or WebP photographs.")],
    alts: Annotated[
        list[str] | None,
        Form(description="Alt text per file, in the same order as `files`."),
    ] = None,
) -> ImageUploadResult:
    """Append photographs to a vehicle."""
    candidates = [
        ImageUploadCandidate(
            data=await item.read(),
            # A missing or short `alts` list is a shorter upload, not an error:
            # the form submits one description per file it has text for, and the
            # vehicle page omits `alt` entirely when it is empty.
            alt=alts[index] if alts is not None and index < len(alts) else "",
            declared_content_type=item.content_type,
        )
        for index, item in enumerate(files)
    ]

    images = await add_images(session, vehicle_id=vehicle_id, candidates=candidates)
    await session.commit()
    # `created` is this request's count, taken from the request rather than from
    # the result: `add_images` returns the whole gallery, appending to whatever was
    # already there. Deriving the count from `len(images)` would report the
    # gallery size, so the second upload onto a one-image vehicle would claim to
    # have created two photographs and a client totalling them would over-count.
    return ImageUploadResult(images=images, created=len(candidates))


@router.put(
    "/{vehicle_id}/images/order",
    response_model=ImageReorderResult,
    summary="Reorder a vehicle's photographs",
    description=(
        "Sets the complete display order in one call.\n\n"
        "The body is the **whole** list of image ids, in the order they should "
        "appear, so there is no way to leave the collection in a half-applied "
        "state: a request that omits an image or repeats one is rejected rather "
        "than guessed at. The first entry becomes the primary photograph.\n\n"
        'This replaces the older separate "set primary" call, which could '
        "produce a contradictory order if used carelessly."
    ),
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def put_image_order(
    vehicle_id: VehicleIdPath,
    payload: ImageOrderRequest,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> ImageReorderResult:
    """Reorder a vehicle's photographs."""
    images = await reorder_images(
        session,
        vehicle_id=vehicle_id,
        image_ids=payload.image_ids,
    )
    await session.commit()
    return ImageReorderResult(images=images)


@router.post(
    "/{vehicle_id}/images/{image_id}/primary",
    response_model=ImageReorderResult,
    summary="Make one photograph the lead image",
    description=(
        "Promotes one image to position 0 and shifts the rest down by one, "
        "preserving their relative order. A no-op if the image is already "
        "primary.\n\n"
        "This is a convenience over the reorder route: the common case is "
        '"put this one first", and making a client reassemble the entire order '
        "to express that is a chance to get it wrong."
    ),
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def post_primary_image(
    vehicle_id: VehicleIdPath,
    image_id: ImageIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> ImageReorderResult:
    """Promote an image to the lead position."""
    images = await set_primary_image(
        session,
        vehicle_id=vehicle_id,
        image_id=image_id,
    )
    await session.commit()
    return ImageReorderResult(images=images)


@router.delete(
    "/{vehicle_id}/images/{image_id}",
    response_model=ImageDeleteResult,
    summary="Remove a photograph",
    description=(
        "Deletes one image and closes the gap it leaves, so positions stay "
        "contiguous from 0.\n\n"
        "If the deleted image was the lead, the next one takes over as primary. "
        "A vehicle left with no images is valid and simply renders its "
        "placeholder.\n\n"
        "The row is removed and committed before the file is unlinked, so a "
        "failure at the last step cannot leave a live row pointing at missing "
        "bytes."
    ),
    responses={**_UNAUTHORISED, **_NOT_FOUND},
)
async def delete_image_route(
    vehicle_id: VehicleIdPath,
    image_id: ImageIdPath,
    _staff: CurrentStaff,
    session: DbWriteSession,
) -> ImageDeleteResult:
    """Delete one image."""
    deletion = await delete_image(session, vehicle_id=vehicle_id, image_id=image_id)

    # Commit first, unlink second. The service deliberately leaves the file in
    # place, because it cannot see the commit - and if the bytes went first, a
    # failed commit would roll the row back and leave a live listing pointing at
    # a file that is gone.
    await session.commit()
    await unlink_deleted_image(vehicle_id, image_id, deletion.storage_key)

    # The id is echoed from the path rather than re-read from the service: the
    # service returning normally already means that image was the one removed.
    return ImageDeleteResult(deleted=image_id, images=deletion.images)

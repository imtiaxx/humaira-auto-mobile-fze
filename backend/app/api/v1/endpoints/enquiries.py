"""Public enquiry submission.

`POST /api/v1/vehicles/{slug}/enquiry` is the one endpoint in this project that
a member of the public can write through. Everything else under `/vehicles` is
read-only, and the privileged half of enquiries lives under `/enquiries` behind
`CurrentStaff`.

Why the vehicle is resolved here
--------------------------------
The form posts to the detail page's own URL and sends only customer fields. The
vehicle is therefore looked up from the slug in the path, and `vehicle_id` is
never read from the request. A caller cannot file an enquiry about a car the
form is not on, and cannot choose the `vehicle_id` that gets stored.

The lookup and the insert share one write-capable transaction, so an enquiry
cannot be attached to a vehicle that was archived between the two statements.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import DbWriteSession
from app.schemas.enquiry import EnquiryRead, EnquiryWrite
from app.services.enquiry import create_enquiry
from app.services.vehicles import get_vehicle_by_slug

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post(
    "/{slug}/enquiry",
    response_model=EnquiryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a website enquiry about a vehicle",
    description=(
        "Creates one enquiry against the vehicle named by `slug`.\n\n"
        "The vehicle is resolved from the path; the request body carries customer "
        "fields only, and `vehicle_id` or `vehicle_slug` supplied by the caller are "
        "rejected rather than ignored.\n\n"
        "The new enquiry is always created with status `pending`. Public form, no "
        "authentication required."
    ),
    responses={
        status.HTTP_201_CREATED: {"description": "Enquiry recorded."},
        status.HTTP_404_NOT_FOUND: {"description": "No vehicle matches that slug."},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"description": "Validation error."},
    },
)
async def submit_enquiry(
    slug: str,
    payload: EnquiryWrite,
    session: DbWriteSession,
) -> EnquiryRead:
    """Record an enquiry about the vehicle identified by ``slug``.

    ---------------------------------------------------------------------------
    Why there is no "vehicle is None" check here
    ---------------------------------------------------------------------------
    `get_vehicle_by_slug` does not return `None` for a missing or archived
    vehicle - it raises `NotFoundError`. An earlier version of this function
    tested the result against `None` anyway, and that check could never be true,
    so it read as though a missing vehicle would fall through to `create_enquiry`
    with `None`.

    It would not have fallen through, because the raise happens first: the 404 was
    always correct by accident. But the dead branch was a trap. A reader who
    believed `None` was a possible return would reasonably conclude the guard was
    load-bearing, and the obvious "tidy-up" is to delete it - which removes the
    reader's evidence that the 404 comes from the raise, and the next change to
    this function that touches the error path turns a 404 into a 500.
    """
    vehicle = await get_vehicle_by_slug(session, slug)

    enquiry = await create_enquiry(
        session,
        vehicle_id=vehicle.id,
        vehicle_slug=vehicle.slug,
        payload=payload,
    )
    await session.commit()
    return enquiry

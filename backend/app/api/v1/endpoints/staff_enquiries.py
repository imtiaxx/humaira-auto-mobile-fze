"""Staff enquiry management.

Every route requires `CurrentStaff`, so none is reachable without a live session
belonging to an active staff account: anonymous gets 401, a signed-in non-staff
account gets 403, and neither response says which condition applied.

Why a separate namespace
------------------------
`GET /api/v1/vehicles` is strictly read-only and its tests pin that a `POST` to
that path returns 405. Putting a privileged write on the same path as a public
read would mean a single mistaken decorator put a write in front of the public
internet. Keeping privileged operations under `/enquiries` leaves the public
resource read-only by construction.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.api.deps import CurrentStaff, DbReadSession, DbWriteSession
from app.core.errors import NotFoundError
from app.schemas.enquiry import EnquiryListResponse, EnquiryRead, EnquiryStatusUpdate
from app.services.enquiry import get_enquiry, list_enquiries, update_enquiry_status

router = APIRouter(prefix="/enquiries", tags=["staff:enquiries"])


@router.get(
    "",
    response_model=EnquiryListResponse,
    summary="List enquiries",
    description=(
        "One page of enquiries, newest first.\n\n"
        "Filter with `status` to work a single column of the backlog, and page "
        "with `page` / `per_page`. `total` counts every matching enquiry, not the "
        "page, so a caller can tell an empty page from the last page."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."},
        status.HTTP_403_FORBIDDEN: {"description": "The account is not staff."},
    },
)
async def list_staff_enquiries(
    session: DbReadSession,
    _staff: CurrentStaff,
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="pending, answered or closed."),
    ] = None,
    page: Annotated[int, Query(ge=1, description="1-indexed page number.")] = 1,
    per_page: Annotated[int, Query(ge=1, le=100, description="Items per page.")] = 20,
) -> EnquiryListResponse:
    items, total = await list_enquiries(session, status=status_filter, page=page, per_page=per_page)
    return EnquiryListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get(
    "/{enquiry_id}",
    response_model=EnquiryRead,
    summary="Get one enquiry",
    description="The full record, including the message and both timestamps.",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."},
        status.HTTP_403_FORBIDDEN: {"description": "The account is not staff."},
        status.HTTP_404_NOT_FOUND: {"description": "No enquiry matches that id."},
    },
)
async def get_staff_enquiry(
    enquiry_id: Annotated[uuid.UUID, Path(description="Enquiry identifier.")],
    session: DbReadSession,
    _staff: CurrentStaff,
) -> EnquiryRead:
    enquiry = await get_enquiry(session, enquiry_id)
    if enquiry is None:
        raise NotFoundError("No enquiry matches that identifier.")
    return enquiry


@router.patch(
    "/{enquiry_id}/status",
    response_model=EnquiryRead,
    summary="Update an enquiry's status",
    description=(
        "Moves an enquiry between `pending`, `answered` and `closed`.\n\n"
        "The transition is unconstrained in both directions - a member of staff "
        "who mis-clicks can undo it - because the value a business wants is a "
        "record of the conversation, not a state machine. Returns the updated "
        "record so the caller renders what was stored rather than what it asked "
        "for."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "No live staff session."},
        status.HTTP_403_FORBIDDEN: {"description": "The account is not staff."},
        status.HTTP_404_NOT_FOUND: {"description": "No enquiry matches that id."},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"description": "Unknown status."},
    },
)
async def update_staff_enquiry_status(
    enquiry_id: Annotated[uuid.UUID, Path(description="Enquiry identifier.")],
    payload: EnquiryStatusUpdate,
    session: DbWriteSession,
    _staff: CurrentStaff,
) -> EnquiryRead:
    enquiry = await update_enquiry_status(session, enquiry_id, payload.status)
    if enquiry is None:
        raise NotFoundError("No enquiry matches that identifier.")
    await session.commit()
    return enquiry

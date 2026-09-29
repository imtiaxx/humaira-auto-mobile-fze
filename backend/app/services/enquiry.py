"""Enquiry business logic.

Kept out of the route so the same persistence can be called from tests and from
the staff endpoints without going through ASGI. Both callers pass a
**write-capable** session: an enquiry is a public write, and resolving the
vehicle is a read inside the same transaction so the row cannot outlive a
vehicle that was withdrawn between the two statements.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError
from app.core.logging import get_logger
from app.db.models.enquiry import Enquiry
from app.db.models.vehicle import Vehicle
from app.schemas.enquiry import EnquiryRead, EnquiryWrite

logger = get_logger(__name__)


async def create_enquiry(
    session: AsyncSession,
    *,
    vehicle_id: uuid.UUID,
    vehicle_slug: str,
    payload: EnquiryWrite,
) -> EnquiryRead:
    """Record one enquiry against a vehicle already resolved from its slug.

    The vehicle is re-checked here rather than trusted from the route. The route
    resolved it a statement earlier in the same transaction, so this is a guard
    against a caller that reaches the service directly - not a second round trip
    for the common path.

    `vehicle_id` and `vehicle_slug` come from the resolved vehicle, never from
    the request body: the form carries customer fields only. The slug is read off
    the vehicle row so the denormalised copy cannot be told to disagree with the
    foreign key.

    Raises
    ------
    ConflictError
        This customer has already enquired about this vehicle. See
        `_flush_or_conflict` for why that is a 409 and not a 500.
    """
    vehicle = await session.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise LookupError(f"No vehicle with id {vehicle_id}.")

    enquiry = Enquiry(
        vehicle_id=vehicle.id,
        vehicle_slug=vehicle.slug,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        message=payload.message,
    )

    session.add(enquiry)
    await _flush_or_conflict(session, vehicle_id=vehicle.id)

    return EnquiryRead.model_validate(enquiry)


async def _flush_or_conflict(session: AsyncSession, *, vehicle_id: uuid.UUID) -> None:
    """Flush, converting the duplicate-enquiry violation into a `ConflictError`.

    ---------------------------------------------------------------------------
    Why this needs handling at all
    ---------------------------------------------------------------------------
    `uq_enquiries_vehicle_id_customer_email` is doing its job. A visitor who
    double-taps Send on a phone, or retries after a request that timed out *on the
    way back* but reached the server, produces a second identical submission - and
    without this, `flush()` raises a bare `IntegrityError` that reaches the generic
    handler and comes back as a 500.

    A 500 is the wrong answer in both directions. It tells the visitor the
    dealership has a fault when in fact their enquiry *was* recorded, and it tells
    the staff nothing useful, because the whole point of the 500 handler is that it
    does not leak what went wrong. A 409 says what actually happened.

    The trade is deliberate: a genuine repeat submission gets a refusal rather than
    a second row. The dealership is not losing an enquiry - the first one is in the
    backlog, with the same message - and an unbounded duplicate list is a
    moderation problem that makes the backlog useless.

    Mirrors `_flush_or_conflict` in `app/services/vehicle_admin.py` deliberately.
    The two routes do different things, but "a uniqueness constraint fired" is the
    same situation and should read the same way in a log.

    ---------------------------------------------------------------------------
    Why the session is not rolled back here
    ---------------------------------------------------------------------------
    The dependency that provided this session rolls it back, and `IntegrityError`
    leaves the transaction unusable rather than merely empty. Adding a `rollback()`
    here would be harmless today and wrong tomorrow: it would discard the vehicle
    lookup this transaction did, so a caller that had resolved a vehicle and then
    hit a duplicate would have to resolve it again for no benefit. The lifecycle
    belongs to whoever opened the session.
    """
    try:
        await session.flush()
    except IntegrityError as exc:
        # The vehicle id, never the exception. An `IntegrityError`'s string form
        # contains the failed INSERT, which means the customer's name, email,
        # phone number and message - a copy of somebody's enquiry written to the
        # log file. A duplicate is a normal occurrence, not an incident, and the
        # only thing worth knowing about one operationally is which vehicle is
        # collecting them.
        logger.warning("enquiry_duplicate", extra={"vehicle_id": str(vehicle_id)})
        raise ConflictError(
            "You have already enquired about this vehicle. The dealership will be in touch."
        ) from exc


async def list_enquiries(
    session: AsyncSession,
    *,
    status: str | None,
    page: int,
    per_page: int,
) -> tuple[list[EnquiryRead], int]:
    """Return one page of enquiries, newest first, plus the unpaged total.

    The total is a separate `COUNT` rather than `len(items)` so a caller can tell
    "this page is the last one" from "this page is empty because there are none",
    which are different facts for a staff member paging through a backlog.

    Ordering is by `created_at` *and* the primary key, for the reason the vehicle
    listing documents: `created_at` is `server_default=func.now()`, and `now()` is
    the transaction timestamp, so two enquiries written in one transaction - or
    two that land in the same clock tick on a database whose `now()` is only
    second-resolution - have equal `created_at`. Ordering by it alone leaves the
    database free to return tied rows in any order, and `OFFSET`/`LIMIT` paging
    over an order that is not total repeats or skips rows between pages. The
    secondary key makes the order total, so page N is stable for a given dataset.
    """
    filters = []
    if status is not None:
        filters.append(Enquiry.status == status)

    count_query = select(func.count()).select_from(Enquiry).where(*filters)
    total = (await session.execute(count_query)).scalar_one()

    query = select(Enquiry).where(*filters).order_by(Enquiry.created_at.desc(), Enquiry.id.asc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    rows = (await session.execute(query)).scalars().all()
    return [EnquiryRead.model_validate(row) for row in rows], total


async def get_enquiry(session: AsyncSession, enquiry_id: uuid.UUID) -> EnquiryRead | None:
    """One enquiry by id, or `None`."""
    row = await session.get(Enquiry, enquiry_id)
    if row is None:
        return None
    return EnquiryRead.model_validate(row)


async def update_enquiry_status(
    session: AsyncSession,
    enquiry_id: uuid.UUID,
    new_status: str,
) -> EnquiryRead | None:
    """Move an enquiry to a new status, or return `None` if it does not exist.

    `updated_at` is refreshed by `TimestampMixin.onupdate` on the UPDATE itself,
    so the change is visible to anything reading the row afterwards rather than
    only to the response body.
    """
    row = await session.get(Enquiry, enquiry_id)
    if row is None:
        return None

    row.status = new_status
    await session.flush()
    await session.refresh(row)
    return EnquiryRead.model_validate(row)

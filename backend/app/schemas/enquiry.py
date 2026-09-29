"""Enquiry schemas - public submission, staff reads, and status updates.

`EnquiryWrite` is the public body. It carries **no** vehicle fields: the vehicle
comes from the path slug, so a caller cannot submit an enquiry about a car the
form is not on. `extra="forbid"` turns that into a hard rejection rather than a
silently ignored field.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: Same constraint as `app.schemas.auth.StaffEmail`, and for the same reason: a
#: constrained `str` rather than Pydantic's `EmailStr`, because `EmailStr` pulls
#: in `email-validator` for one field. This rejects the shapes that are
#: certainly wrong; it is not an RFC 5322 parser, and does not need to be,
#: because the address is stored for a human to reply to, not used to route mail.
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

#: A name may contain letters from any script, marks, spaces, apostrophes,
#: periods and hyphens. What it may not contain is a control character or an
#: angle bracket: neither belongs in a person's name, and refusing them here
#: means a name can never open a tag if some future renderer ever treats it as
#: markup. The list is an allowlist, not a denylist, so a script this pattern
#: does not know about still works - a wrong rejection of a real name is a worse
#: failure than a permissive character.
#:
#: Note this is defence in depth, not the security boundary. `message` is the
#: field a visitor controls freely and it deliberately accepts any text, because
#: the answer to "should we validate their words" is that escaping at render time
#: is what makes them safe. A name is filtered because a name is short and has a
#: predictable shape, which makes a filter cheap here and nowhere else.
NAME_PATTERN = re.compile(r"^[^\x00-\x1f\x7f<>]+$")

EnquiryEmail = Annotated[str, Field(min_length=3, max_length=320, pattern=EMAIL_PATTERN)]

#: The three states an enquiry moves through. `Literal` rather than a validator
#: over `str` so the OpenAPI schema advertises the enum to any client.
EnquiryStatusLiteral = Literal["pending", "answered", "closed"]


class EnquiryWrite(BaseModel):
    """Body of `POST /api/v1/vehicles/{slug}/enquiry`.

    The vehicle is taken from the path. `vehicle_id` and `vehicle_slug` are
    deliberately absent, and `extra="forbid"` means a client that sends them
    anyway gets a 422 rather than having them quietly dropped.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    customer_name: Annotated[
        str,
        Field(min_length=2, max_length=200, pattern=NAME_PATTERN),
    ] = Field(description="Full name of the person enquiring.")
    customer_email: EnquiryEmail = Field(description="Email address a reply should go to.")
    customer_phone: Annotated[
        str,
        Field(min_length=7, max_length=50, pattern=r"^[+0-9][0-9\s\-().]{5,48}[0-9]$"),
    ] = Field(description="Phone number the dealership can call back on.")
    message: Annotated[str, Field(min_length=10, max_length=2000)] = Field(
        description="What the enquirer wants to know about the vehicle."
    )

    @field_validator("customer_phone")
    @classmethod
    def _phone_digit_count(cls, value: str) -> str:
        """Reject a number of punctuation with no digits behind it.

        The pattern already forces a leading and trailing digit, so this only
        has to rule out the shape where every interior character is a separator.
        """
        if not any(char.isdigit() for char in value[1:-1]):
            raise ValueError("Phone number must contain digits.")
        return value


class EnquiryRead(BaseModel):
    """One enquiry, as the public confirmation and the staff UI both read it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicle_id: uuid.UUID
    vehicle_slug: str
    customer_name: str
    customer_email: str
    customer_phone: str
    message: str
    status: EnquiryStatusLiteral
    created_at: datetime
    updated_at: datetime


class EnquiryListResponse(BaseModel):
    """A page of enquiries for the staff list."""

    model_config = ConfigDict(from_attributes=True)

    items: list[EnquiryRead]
    total: int
    page: int
    per_page: int


class EnquiryStatusUpdate(BaseModel):
    """Body of `PATCH /api/v1/enquiries/{enquiry_id}/status`."""

    model_config = ConfigDict(extra="forbid")

    status: EnquiryStatusLiteral = Field(description="New status: pending, answered or closed.")

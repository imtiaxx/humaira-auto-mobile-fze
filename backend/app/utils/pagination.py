"""Pagination contract.

Every future list endpoint (inventory, enquiries, leads) returns the same
envelope, so the frontend can build one reusable paginated table and one
"load more" control instead of bespoke logic per screen.
"""

from __future__ import annotations

import math
from typing import TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")

#: Hard ceiling. Beyond this, responses get slow enough to hurt Core Web Vitals
#: and the callers should be using filters instead of a bigger page.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 24


class PageParams(BaseModel):
    """Validated ``?page=&page_size=`` query parameters."""

    page: int = Field(default=1, ge=1, description="1-indexed page number.")
    page_size: int = Field(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Items per page."
    )

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-indexed page number."),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Items per page. Maximum {MAX_PAGE_SIZE}.",
    ),
) -> PageParams:
    """FastAPI dependency yielding validated pagination input.

    Enforcing the bounds here means a hostile or buggy client cannot request
    ``page_size=100000`` and exhaust server memory.
    """
    return PageParams(page=page, page_size=page_size)


class Page[T](BaseModel):
    """Paginated response envelope."""

    items: list[T] = Field(default_factory=list)
    total: int = Field(ge=0, description="Total matching rows across all pages.")
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=0)

    @classmethod
    def build(cls, items: list[T], *, total: int, params: PageParams) -> Page[T]:
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=math.ceil(total / params.page_size) if params.page_size else 0,
        )

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_previous(self) -> bool:
        return self.page > 1

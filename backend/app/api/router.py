"""Top-level API router.

Aggregates every API version. ``main.py`` mounts exactly this router under the
configured prefix, so adding ``v2`` later requires no change here beyond one
include statement.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.router import api_router as v1_router

api_router = APIRouter()
api_router.include_router(v1_router)

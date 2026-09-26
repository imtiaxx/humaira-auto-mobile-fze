"""Version 1 of the public API.

Adding an endpoint here is an API contract change. Breaking changes require a
new version module (``v2``) so that existing clients - including the deployed
frontend - keep working.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()
# The health router already declares its own `/health` path.
api_router.include_router(health.router)

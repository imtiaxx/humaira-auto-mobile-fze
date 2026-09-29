"""Version 1 of the API.

Adding an endpoint here is an API contract change. Breaking changes require a
new version module (``v2``) so that existing clients - including the deployed
frontend - keep working.

The split between the two families below is deliberate and load-bearing.
`vehicles` is the public, read-only resource; `admin_vehicles` and
`admin_images` are the privileged staff surface. They are separate routers with
separate prefixes so that a privileged write can never be one decorator away from
a public read - see the module docstring in `endpoints/admin_vehicles.py`.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_images,
    admin_vehicles,
    auth,
    enquiries,
    health,
    staff_enquiries,
    vehicles,
)

api_router = APIRouter()
# The health router already declares its own `/health` path.
api_router.include_router(health.router)
# `/vehicles` and `/vehicles/{slug}`. Declared after health so the static
# `/health` paths keep matching before any parameterised route is considered.
api_router.include_router(vehicles.router)
# Staff-only. Every route in these two routers depends on `require_staff`, so
# there is no per-route guard to forget here - importing a router is enough to
# expose it, and the dependency is what protects it.
api_router.include_router(auth.router)
api_router.include_router(admin_vehicles.router)
api_router.include_router(admin_images.router)
# Public enquiry submission - any visitor can submit an enquiry about a vehicle.
api_router.include_router(enquiries.router)
# Staff enquiry management - protected by CurrentStaff.
api_router.include_router(staff_enquiries.router)

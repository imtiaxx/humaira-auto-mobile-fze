"""Health endpoints.

The only endpoints that exist in Step 1. Liveness is dependency-free so that a
database outage never causes an orchestrator to restart a healthy process.
"""

from __future__ import annotations

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.health import check_liveness, check_readiness

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    description=(
        "Confirms the API process is running and able to serve requests. "
        "Performs no downstream I/O."
    ),
)
async def health() -> HealthResponse:
    return check_liveness()


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe",
    description=(
        "Confirms the API can serve traffic by checking database connectivity. "
        "Returns 503 when a configured database is unreachable."
    ),
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ReadinessResponse,
            "description": "A downstream dependency is unavailable.",
        }
    },
)
async def readiness() -> HealthResponse | ReadinessResponse | JSONResponse:
    result = await check_readiness()
    if result.status == "not_ready":
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=result.model_dump(mode="json"),
        )
    return result

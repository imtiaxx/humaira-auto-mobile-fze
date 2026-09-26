"""Health-check business logic.

Separated from the route so that the same checks can be called from a
management command or a future scheduler without an HTTP request.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.config import settings
from app.schemas.health import HealthResponse, ReadinessResponse

#: Literal values accepted by ``ReadinessResponse.database``.
type ReadinessResponseDatabaseState = str


def check_liveness() -> HealthResponse:
    """Process-level liveness. Cheap, synchronous, dependency-free."""
    return HealthResponse(
        status="ok",
        service="humera-automobile-api",
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(UTC),
    )


async def check_readiness() -> ReadinessResponse:
    """Readiness including database connectivity.

    A missing ``DATABASE_URL`` is reported as ``not_configured`` rather than
    ``unavailable``: the distinction matters during local setup, where a
    developer has not created the database yet.
    """
    from app.db.database import verify_database_connection  # local: avoids cycle

    if not settings.database_url.get_secret_value():
        state: ReadinessResponseDatabaseState = "not_configured"
    elif await verify_database_connection():
        state = "ok"
    else:
        state = "unavailable"

    return ReadinessResponse(
        status="ready" if state in {"ok", "not_configured"} else "not_ready",
        database=state,  # type: ignore[arg-type]
        checked_at=datetime.now(UTC),
    )

"""Health-check response schema."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Payload returned by ``GET /api/v1/health``.

    Every field is produced by the running backend. Nothing here is mocked or
    hard-coded.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "ok",
                "service": "humera-automobile-api",
                "version": "0.1.0",
                "environment": "development",
                "timestamp": "2026-01-01T00:00:00Z",
            }
        }
    )

    status: Literal["ok", "degraded"] = Field(description="Overall service state.")
    service: str = Field(description="Service identifier.")
    version: str = Field(description="Deployed application version.")
    environment: str = Field(description="Active environment name.")
    timestamp: datetime = Field(description="UTC time the check was produced.")


class ReadinessResponse(BaseModel):
    """Payload returned by ``GET /api/v1/health/ready``.

    Reports whether a downstream dependency is reachable. Unlike the liveness
    probe, a failure here means the process is up but cannot serve traffic.
    """

    status: Literal["ready", "not_ready"] = Field(
        description="Whether the service can serve traffic."
    )
    database: Literal["ok", "unavailable", "not_configured"] = Field(
        description="Database connectivity state."
    )
    checked_at: datetime = Field(description="UTC time the check was produced.")

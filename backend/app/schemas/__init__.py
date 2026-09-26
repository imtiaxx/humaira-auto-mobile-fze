"""Pydantic response/request schemas.

Schemas are the public contract of the API. They live outside ``endpoints`` so
that services and tests can depend on them without importing route modules.
"""

from app.schemas.health import HealthResponse

__all__ = ["HealthResponse"]

"""FastAPI application factory and ASGI entry point.

Run locally with:

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware

logger = get_logger(__name__)

DESCRIPTION = """
Backend API for Humera Automobile, a Dubai-based vehicle sales and export
business.

### Current status (Step 1 - foundation)
Only the health endpoints are implemented. Vehicle inventory, enquiries, export
workflows and authentication are **not** available yet and are planned for
later steps.
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start-up and shut-down lifecycle.

    Failures during start-up are logged and re-raised: a process that cannot
    satisfy its configuration must not begin serving traffic.
    """
    configure_logging()

    problems = settings.assert_production_ready()
    if problems:
        for problem in problems:
            logger.error("configuration_problem", extra={"detail": problem})
        raise RuntimeError(
            "Refusing to start with an unsafe production configuration: " + "; ".join(problems)
        )

    logger.info(
        "application_starting",
        extra={
            "app": settings.app_name,
            "version": settings.app_version,
            "env": settings.app_env,
        },
    )
    try:
        yield
    finally:
        from app.db.database import dispose_engine

        await dispose_engine()
        logger.info("application_stopped")


def create_app() -> FastAPI:
    """Build and configure the ASGI application."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
        # Trust nothing implicitly; X-Forwarded-* is only honoured behind a
        # proxy that overwrites these headers.
        root_path="",
    )

    # Middleware executes bottom-up: the request-context middleware is added
    # last so that it wraps logging and CORS handling.
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Response-Time-ms"],
        max_age=600,
    )
    application.add_middleware(RequestContextMiddleware)

    register_exception_handlers(application)
    application.include_router(api_router, prefix=settings.api_v1_prefix)

    @application.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        """Root discovery document. The real API lives under the version prefix."""
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "api": settings.api_v1_prefix,
            "health": f"{settings.api_v1_prefix}/health",
        }

    return application


app = create_app()

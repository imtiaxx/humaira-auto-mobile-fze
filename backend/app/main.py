"""FastAPI application factory and ASGI entry point.

Run locally with:

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.services.image_validation import configure_pillow_limits

logger = get_logger(__name__)

DESCRIPTION = """
Backend API for Humera Automobile, a Dubai-based vehicle sales and export
business.

### Public, read-only
* `GET /api/v1/health` and `GET /api/v1/health/ready` - liveness and readiness.
* `GET /api/v1/vehicles` - public vehicle inventory, paginated, newest first.
* `GET /api/v1/vehicles/{slug}` - one vehicle by its public slug.

The vehicle endpoints are **read-only**. Any other verb on that path returns
405: the public resource describes what is for sale and nothing more.

### Staff only
* `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
* `/api/v1/admin/vehicles` - add, edit, archive and restore vehicles.
* `/api/v1/admin/vehicles/{id}/images` - upload, reorder and remove photographs.

Every one of these requires a session belonging to an active staff account.
There is no registration: accounts are created by an operator with
`python -m app.cli create_staff`, never over HTTP.

A withdrawn vehicle is archived, not deleted. It leaves the public list and its
public page 404s, but the record and its photographs are kept and stay editable
in the admin area.

### Not yet available
Enquiries, export workflows and inventory filtering are **not** available yet and
are planned for later steps.

The inventory tables exist but are empty - the business has not published stock
yet, so an empty list is a correct response, not a fault. See `docs/api.md`.
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Start-up and shut-down lifecycle.

    Failures during start-up are logged and re-raised: a process that cannot
    satisfy its configuration must not begin serving traffic.
    """
    configure_logging()
    configure_pillow_limits()

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
    _mount_local_media(application)

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


def _mount_local_media(application: FastAPI) -> None:
    """Serve vehicle photographs when the local storage backend is in use.

    Mounted at `/media`, the same prefix `image_public_base_url` defaults to, so
    an upload is immediately fetchable at the URL stored in its `src` column with
    no extra configuration in development.

    Only mounted for the local backend. When `image_storage_backend` is something
    else, images live in object storage behind a CDN and this mount would be a
    second, wrong source of truth - and the local directory would not even exist.

    `check_dir=False` because the directory is created on first upload, not at
    import time; creating it during app construction would make a read-only
    container filesystem fatal at start-up rather than at first write.
    """
    # Widened to `str` before comparing. `image_storage_backend` is typed
    # `Literal["local"]`, so mypy can prove this branch is currently unreachable
    # and would reject the `return` outright - but the moment a second backend is
    # added to that Literal the guard becomes live, and it has to be live, because
    # serving stale local bytes for object-storage uploads is a correctness bug
    # rather than a cosmetic one. Reading it into a plain `str` keeps the runtime
    # check without a `type: ignore` that would hide the moment it starts
    # mattering.
    backend: str = settings.image_storage_backend
    if backend != "local":
        return

    application.mount(
        settings.image_media_prefix,
        StaticFiles(directory=settings.image_storage_root, check_dir=False),
        name="media",
    )
    logger.info(
        "local_media_mounted",
        extra={"prefix": settings.image_media_prefix, "root": str(settings.image_storage_root)},
    )


app = create_app()

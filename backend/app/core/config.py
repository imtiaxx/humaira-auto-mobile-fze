"""Application configuration.

Settings are loaded once, from the environment, using ``pydantic-settings``.
The single source of truth is :class:`Settings`; every other module imports
``settings`` from here rather than reading ``os.environ`` directly.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/core/config.py -> backend/
BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]
# backend/
PROJECT_BACKEND_ROOT: Path = BACKEND_ROOT
# repository root (contains .env)
REPOSITORY_ROOT: Path = BACKEND_ROOT.parent

AppEnvironment = Literal["development", "test", "staging", "production"]
LogFormat = Literal["console", "json"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Typed, validated application settings."""

    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application ------------------------------------------------------
    app_name: str = "Humera Automobile API"
    app_env: AppEnvironment = "development"
    app_version: str = "0.1.0"
    debug: bool = False

    # --- Database ---------------------------------------------------------
    database_url: SecretStr = Field(
        default=SecretStr(""),
        description="SQLAlchemy async database URL. Must use an async driver.",
    )
    database_sql_echo: bool = False
    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=10, ge=0)
    db_pool_recycle_seconds: int = Field(default=1800, ge=-1)

    # --- Security ---------------------------------------------------------
    secret_key: SecretStr = Field(default=SecretStr(""))
    session_expire_minutes: int = Field(default=60 * 24 * 7, ge=1)
    access_token_expire_minutes: int = Field(default=15, ge=1)
    refresh_token_expire_days: int = Field(default=7, ge=1)
    argon2_time_cost: int = Field(default=3, ge=1)
    argon2_memory_cost: int = Field(default=65536, ge=8192)
    argon2_parallelism: int = Field(default=4, ge=1)

    # --- Staff session ----------------------------------------------------
    # The admin surface is session-authenticated. `session_expire_minutes`
    # (above, 7 days by default) is the authoritative session lifetime; the
    # cookie name lives here so the browser, the API and the frontend agree on
    # one value instead of three string literals.
    session_cookie_name: str = "humera_staff_session"
    #: Sessions are stored as SHA-256 digests, so a database disclosure yields
    #: no usable credential. This is not configurable on purpose: choosing a
    #: weaker digest to "store a session id" would be a downgrade.
    session_last_used_refresh_seconds: int = Field(default=300, ge=0)

    # --- Image storage ----------------------------------------------------
    # Only a local-disk backend ships. It is behind an interface
    # (`app/storage/base.py`), so a future S3/GCS/Azure implementation is a new
    # class rather than a rewrite - but no provider is pre-wired, and no cloud
    # credential is ever read from this file.
    image_storage_backend: Literal["local"] = "local"
    #: Where image bytes live. Never PostgreSQL, which stores metadata only.
    image_storage_root: Path = Field(default=BACKEND_ROOT / "media")
    #: URL prefix the local storage backend is mounted at. A single setting
    #: because it appears in two places that must agree - the `StaticFiles` mount
    #: and the derived public URL - and two independently edited literals would
    #: eventually point uploads at a path that serves 404s.
    image_media_prefix: str = "/media"
    #: Public URL prefix for stored images. Empty means "derive it from
    #: `next_public_api_url`", so a deployment that already publishes the API
    #: does not have to repeat the origin here.
    image_public_base_url: str = ""
    #: Hard ceiling on a single upload. Enforced while streaming, so an
    #: oversized file is refused rather than read into memory first.
    image_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1024)
    #: Pixel bounds. The floor rejects tracking pixels and placeholder art; the
    #: ceiling bounds decode memory and is well under Pillow's own bomb limit.
    image_min_width: int = Field(default=320, ge=1)
    image_min_height: int = Field(default=240, ge=1)
    image_max_width: int = Field(default=12000, ge=1)
    image_max_height: int = Field(default=12000, ge=1)
    #: One request may carry at most this many files...
    image_max_files_per_request: int = Field(default=10, ge=1)
    #: ...and one vehicle may hold at most this many images in total.
    image_max_per_vehicle: int = Field(default=30, ge=1)

    # --- CORS / API -------------------------------------------------------
    # `NoDecode` stops pydantic-settings from JSON-parsing this field, so the
    # comma-separated form below reaches the validator intact.
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    api_v1_prefix: str = "/api/v1"
    docs_enabled: bool = True

    # --- Logging ----------------------------------------------------------
    log_level: LogLevel = "INFO"
    log_format: LogFormat = "console"

    # --- Frontend-facing public configuration -----------------------------
    next_public_api_url: str = "http://localhost:8000"
    next_public_site_url: str = "http://localhost:3000"

    # --- Computed ---------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def sync_database_url(self) -> str:
        """Alembic and other sync tooling cannot use an async driver."""
        return to_sync_database_url(self.database_url.get_secret_value())

    @property
    def resolved_image_public_base_url(self) -> str:
        """Public URL prefix for stored images, without a trailing slash.

        Derived from `next_public_api_url` when unset, so the media origin is
        defined once. `next_public_api_url` is the API origin the frontend
        already talks to, and images are served by that same process.

        The `image_media_prefix` tail is the same value the app mounts the local
        backend at, so the URL stored in `src` is exactly the path that serves
        the bytes.
        """
        configured = self.image_public_base_url.strip()
        if configured:
            return configured.rstrip("/")
        return f"{self.next_public_api_url.rstrip('/')}{self.image_media_prefix}"

    @property
    def session_cookie_secure(self) -> bool:
        """Whether the session cookie may carry the `Secure` attribute.

        True in production, where traffic is HTTPS. Left to the deployment in
        every other environment: forcing it on plain-HTTP localhost would make
        the cookie silently unusable in development.
        """
        return self.is_production

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Accept a comma-separated list *or* a JSON array from the environment.

        Comma-separated is the documented form. JSON is accepted too because it
        is what most people write by reflex when they see a list-typed setting,
        and because pydantic-settings users expect it.

        Accepting both is not fussiness. The failure for getting it wrong is
        silent and remote: the value parses, `allow_origins` gets a list
        containing one malformed entry, every preflight fails, and the only
        symptom is a CORS error in a browser console pointing at the frontend
        rather than at the config file that is wrong. A clear parse error here
        is worth more than the tidiness of a single supported syntax.
        """
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    decoded = json.loads(text)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"CORS_ORIGINS looks like a JSON array but is not valid JSON: {exc}"
                    ) from exc
                if not isinstance(decoded, list) or not all(
                    isinstance(origin, str) for origin in decoded
                ):
                    raise ValueError("CORS_ORIGINS as JSON must be an array of strings.")
                return [origin.strip() for origin in decoded if origin.strip()]
            return [origin.strip() for origin in text.split(",") if origin.strip()]
        return value

    @field_validator("api_v1_prefix")
    @classmethod
    def _normalise_prefix(cls, value: str) -> str:
        prefix = value.strip().rstrip("/")
        if not prefix.startswith("/"):
            prefix = f"/{prefix}"
        return prefix

    def assert_production_ready(self) -> list[str]:
        """Return a list of configuration problems that block production.

        Called during application start-up so misconfiguration fails loudly
        instead of silently running insecurely.
        """
        problems: list[str] = []
        if not self.is_production:
            return problems

        if not self.secret_key.get_secret_value():
            problems.append("SECRET_KEY must be set in production.")
        elif len(self.secret_key.get_secret_value()) < 32:
            problems.append("SECRET_KEY must be at least 32 characters in production.")

        if "*" in self.cors_origins:
            problems.append("CORS_ORIGINS must not contain a wildcard in production.")
        if not self.cors_origins:
            problems.append("CORS_ORIGINS must list explicit origins in production.")
        if self.debug:
            problems.append("DEBUG must be false in production.")
        if not self.database_url.get_secret_value():
            problems.append("DATABASE_URL must be set in production.")
        if not self.image_storage_root.is_absolute():
            problems.append("IMAGE_STORAGE_ROOT must be an absolute path in production.")
        if self.image_public_base_url.strip() and not self.image_public_base_url.startswith(
            "https://"
        ):
            problems.append("IMAGE_PUBLIC_BASE_URL must use https:// in production.")
        return problems


#: async driver -> synchronous driver, for Alembic and CLI tooling.
_ASYNC_TO_SYNC_DRIVERS: dict[str, str] = {
    "postgresql+asyncpg": "postgresql+psycopg",
    "postgresql+psycopg_async": "postgresql+psycopg",
    "sqlite+aiosqlite": "sqlite",
    "mysql+aiomysql": "mysql+pymysql",
}


def to_sync_database_url(async_url: str) -> str:
    """Convert an async SQLAlchemy URL to its synchronous equivalent."""
    for async_driver, sync_driver in _ASYNC_TO_SYNC_DRIVERS.items():
        prefix = f"{async_driver}://"
        if async_url.startswith(prefix):
            return f"{sync_driver}://{async_url[len(prefix) :]}"
    return async_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()


settings: Settings = get_settings()

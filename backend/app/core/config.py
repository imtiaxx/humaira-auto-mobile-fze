"""Application configuration.

Settings are loaded once, from the environment, using ``pydantic-settings``.
The single source of truth is :class:`Settings`; every other module imports
``settings`` from here rather than reading ``os.environ`` directly.
"""

from __future__ import annotations

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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Accept a comma-separated string from the environment."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
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

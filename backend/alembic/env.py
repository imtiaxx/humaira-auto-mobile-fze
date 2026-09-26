"""Alembic environment.

The database URL is taken from application settings rather than ``alembic.ini``
so that migrations, the running application and the tests can never disagree
about which database is authoritative.

Migrations run against a *synchronous* driver: Alembic's transactional DDL is
simpler and more portable when it is not competing with the event loop.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Ensure `app` is importable when alembic is invoked from the backend root.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.models import (
    Base,
    import_models,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

configure_logging()

# Populates Base.metadata with every mapped class.
import_models()

target_metadata = Base.metadata


def _database_url() -> str:
    """Resolve the migration URL, refusing to run without configuration."""
    url = config.get_main_option("sqlalchemy.url") or settings.sync_database_url
    if not url:
        raise RuntimeError(
            "No database configured. Set DATABASE_URL in the environment "
            "(see .env.example) before running migrations."
        )
    return url


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to a database.

    Used to review what a migration would do: ``alembic upgrade head --sql``.
    """
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against a live connection."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            # Required for SQLite; harmless elsewhere.
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

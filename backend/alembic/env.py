"""
Alembic Migration Environment
──────────────────────────────
This file configures Alembic to use our async SQLAlchemy engine.

WHY ALEMBIC?
────────────
Alembic tracks database schema changes as versioned migration files.
Instead of manually running ALTER TABLE statements, we:
1. Modify the SQLAlchemy model
2. Run: alembic revision --autogenerate -m "description"
3. Run: alembic upgrade head

This means the schema is always in version control and reproducible.
"""

import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import Base and all models so Alembic can detect changes
from app.core.database import Base
import app.models  # noqa: F401 — side effect import registers all models

# Alembic Config object
config = context.config

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata

# Override sqlalchemy.url from environment (not from alembic.ini)
def get_url() -> str:
    """
    Get database URL from environment.
    Use sync URL for migrations (asyncpg doesn't work with Alembic directly).
    """
    url = os.environ.get("DATABASE_URL_SYNC", "")
    if not url:
        # Fall back: convert async URL to sync
        async_url = os.environ.get("DATABASE_URL", "")
        url = async_url.replace("postgresql+asyncpg://", "postgresql://")
    return url


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    Generates SQL scripts without connecting to the database.
    Useful for reviewing migrations before applying them.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations using the async engine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to DB)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

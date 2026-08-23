"""
CrimeLink Database Connection
──────────────────────────────
SQLAlchemy async engine + session factory.
Supports both PostgreSQL (production) and SQLite (local dev / no-DB-server setup).
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Engine ─────────────────────────────────────────────────────────────────
_db_url = settings.resolved_database_url
_is_sqlite = _db_url.startswith("sqlite")

# SQLite needs connect_args check_same_thread=False
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

# SQLite doesn't support pool_size / max_overflow
_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "connect_args": _connect_args,
}
if not _is_sqlite:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_async_engine(_db_url, **_engine_kwargs)

# ── Session Factory ──────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Base Model ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency ──────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Health Check ──────────────────────────────────────────────────────
async def check_database_health() -> bool:
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception:
        return False


# ── Create all tables (used for SQLite dev — Alembic used for Postgres) ──
async def create_all_tables() -> None:
    """Create all tables directly from models. Used for SQLite dev setup."""
    import app.models  # noqa — register all models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

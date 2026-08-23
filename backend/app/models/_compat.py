"""
Database-agnostic type helpers.
Use these instead of postgresql-specific types so the same models
work with both SQLite (dev) and PostgreSQL (production).
"""
from sqlalchemy import JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB, UUID as PG_UUID, INET as PG_INET


def get_json_type():
    """JSONB on PostgreSQL, JSON on SQLite."""
    return JSON()


def get_uuid_type():
    """PostgreSQL UUID on Postgres, String(36) on SQLite."""
    return String(36)


def get_inet_type():
    """INET on PostgreSQL, String(45) on SQLite."""
    return String(45)


# Convenience aliases
JSONType = JSON
UUIDStr = String(36)
IPStr = String(45)

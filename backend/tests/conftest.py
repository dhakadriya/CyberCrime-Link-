"""
Shared test fixtures for CrimeLink test suite.
Uses an in-memory SQLite database — isolated per test session.
"""
import asyncio
import os
import pytest
import pytest_asyncio

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 64
os.environ["SEED_DEFAULT_PASSWORD"] = "TestPassword@123!"

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # Apply SQLite patches
from app.core.database import Base, get_db
from app.main import app
from app.core.security import hash_password
from app.models.user import User, Role, Permission, RolePermission, UserRole


# ── In-memory test engine ──────────────────────────────────────────────────
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_setup():
    """Create all tables once per test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(db_setup):
    """Provide a fresh DB session per test, rolled back after each test."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def seeded_db(db_session):
    """Seed minimal data needed for most tests."""
    from app.models.user import Permission, Role, RolePermission, UserRole

    # Create permissions
    perms = {}
    perm_names = [
        "CASE_CREATE", "CASE_READ", "CASE_UPDATE", "CASE_ASSIGN",
        "PERSON_CREATE", "PERSON_READ", "PERSON_UPDATE",
        "EVIDENCE_UPLOAD", "EVIDENCE_READ", "EVIDENCE_DOWNLOAD", "EVIDENCE_TRANSFER",
        "AUDIT_READ", "SECURITY_READ", "USER_MANAGE", "REPORT_GENERATE",
    ]
    for name in perm_names:
        p = Permission(name=name, description=name)
        db_session.add(p)
        await db_session.flush()
        perms[name] = p

    # Create roles
    admin_role = Role(name="SUPER_ADMIN", description="Super Admin")
    officer_role = Role(name="INVESTIGATION_OFFICER", description="Officer")
    auditor_role = Role(name="VIEWER_AUDITOR", description="Auditor")
    db_session.add_all([admin_role, officer_role, auditor_role])
    await db_session.flush()

    # Assign all permissions to SUPER_ADMIN
    for perm in perms.values():
        db_session.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

    # Assign limited permissions to INVESTIGATION_OFFICER
    for pname in ["CASE_CREATE", "CASE_READ", "CASE_UPDATE", "PERSON_CREATE", "PERSON_READ",
                  "EVIDENCE_UPLOAD", "EVIDENCE_READ", "EVIDENCE_DOWNLOAD", "REPORT_GENERATE"]:
        db_session.add(RolePermission(role_id=officer_role.id, permission_id=perms[pname].id))

    # VIEWER_AUDITOR: read only
    for pname in ["CASE_READ", "PERSON_READ", "EVIDENCE_READ", "AUDIT_READ", "SECURITY_READ"]:
        db_session.add(RolePermission(role_id=auditor_role.id, permission_id=perms[pname].id))

    await db_session.flush()

    # Create users
    admin = User(
        username="admin", email="admin@test.com",
        password_hash=hash_password("Admin@Password123!"),
        full_name="Test Admin",
    )
    officer = User(
        username="officer", email="officer@test.com",
        password_hash=hash_password("Officer@Password123!"),
        full_name="Test Officer",
    )
    auditor = User(
        username="auditor", email="auditor@test.com",
        password_hash=hash_password("Auditor@Password123!"),
        full_name="Test Auditor",
    )
    db_session.add_all([admin, officer, auditor])
    await db_session.flush()

    db_session.add(UserRole(user_id=admin.id, role_id=admin_role.id))
    db_session.add(UserRole(user_id=officer.id, role_id=officer_role.id))
    db_session.add(UserRole(user_id=auditor.id, role_id=auditor_role.id))
    await db_session.commit()

    return {
        "admin": admin, "officer": officer, "auditor": auditor,
        "admin_role": admin_role, "officer_role": officer_role,
        "perms": perms,
    }


@pytest_asyncio.fixture
async def client(db_setup):
    """Async HTTP test client with test DB override."""
    async def override_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

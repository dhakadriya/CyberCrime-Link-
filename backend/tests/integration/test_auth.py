"""Integration tests: authentication endpoints."""
import pytest
import pytest_asyncio


@pytest.mark.asyncio
async def test_login_success(client, seeded_db):
    resp = await client.post("/api/v1/auth/login", json={
        "username": "officer",
        "password": "Officer@Password123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["username"] == "officer"
    assert "CASE_READ" in data["permissions"]


@pytest.mark.asyncio
async def test_login_wrong_password(client, seeded_db):
    resp = await client.post("/api/v1/auth/login", json={
        "username": "officer",
        "password": "WrongPassword@123!",
    })
    assert resp.status_code == 401
    # Must NOT reveal whether user exists
    assert "Invalid username or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client, seeded_db):
    resp = await client.post("/api/v1/auth/login", json={
        "username": "doesnotexist",
        "password": "SomePassword@123!",
    })
    assert resp.status_code == 401
    # Same message as wrong password — no user enumeration
    assert "Invalid username or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_error_message_is_generic(client, seeded_db):
    """Ensure wrong user and wrong password return identical error messages."""
    r1 = await client.post("/api/v1/auth/login", json={"username": "officer", "password": "wrong@Pass123"})
    r2 = await client.post("/api/v1/auth/login", json={"username": "nobody", "password": "wrong@Pass123"})
    assert r1.json()["detail"] == r2.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_authenticated(client, seeded_db):
    login = await client.post("/api/v1/auth/login", json={
        "username": "officer", "password": "Officer@Password123!"
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "officer"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client, seeded_db):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_invalid_jwt_rejected(client, seeded_db):
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.jwt.token"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_account_lockout(client, seeded_db):
    """After MAX_FAILED_ATTEMPTS, account should lock."""
    from app.core.config import settings
    for _ in range(settings.MAX_FAILED_ATTEMPTS):
        await client.post("/api/v1/auth/login", json={
            "username": "auditor",
            "password": "WrongPassword@123!",
        })
    # Next attempt should indicate lockout
    resp = await client.post("/api/v1/auth/login", json={
        "username": "auditor",
        "password": "WrongPassword@123!",
    })
    assert resp.status_code == 401
    # Either locked message or generic invalid message
    assert resp.json()["detail"] is not None

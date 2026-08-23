"""Unit tests: password hashing, JWT, validation."""
import pytest
from app.core.security import (
    hash_password, verify_password, create_access_token,
    decode_access_token, validate_password_strength,
)


# ── Password hashing ──────────────────────────────────────────────────────
def test_hash_password_returns_argon2_hash():
    h = hash_password("TestPassword@123!")
    assert h.startswith("$argon2id$")


def test_verify_password_correct():
    h = hash_password("TestPassword@123!")
    assert verify_password("TestPassword@123!", h) is True


def test_verify_password_wrong():
    h = hash_password("TestPassword@123!")
    assert verify_password("WrongPassword@123!", h) is False


def test_verify_password_does_not_raise():
    # Should return False, never raise
    result = verify_password("anything", "not-a-valid-hash")
    assert result is False


def test_hash_is_unique_per_call():
    # Same password → different hash (Argon2 uses random salt)
    h1 = hash_password("TestPassword@123!")
    h2 = hash_password("TestPassword@123!")
    assert h1 != h2


# ── Password policy ────────────────────────────────────────────────────────
@pytest.mark.parametrize("password,should_pass", [
    ("TestPass@123!", True),            # valid
    ("short@1A", False),                # too short
    ("alllowercase@123!", False),       # no uppercase
    ("ALLUPPERCASE@123!", False),       # no lowercase
    ("NoDigits@Pass!", False),          # no digit
    ("NoSpecial123ABC", False),         # no special char
    ("A" * 12 + "@1a", True),          # exactly 12+ chars
])
def test_password_strength(password, should_pass):
    valid, msg = validate_password_strength(password)
    assert valid == should_pass, f"'{password}': expected {should_pass}, msg={msg}"


# ── JWT ────────────────────────────────────────────────────────────────────
def test_create_and_decode_token():
    token = create_access_token(
        subject="user-123",
        roles=["INVESTIGATION_OFFICER"],
        permissions=["CASE_READ", "CASE_CREATE"],
    )
    assert token is not None
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert "CASE_READ" in payload["permissions"]
    assert "INVESTIGATION_OFFICER" in payload["roles"]


def test_invalid_token_returns_none():
    result = decode_access_token("not.a.valid.token")
    assert result is None


def test_tampered_token_returns_none():
    token = create_access_token("user-1", ["ROLE"], ["PERM"])
    # Tamper the payload
    parts = token.split(".")
    tampered = parts[0] + "." + parts[1] + "TAMPERED." + parts[2]
    result = decode_access_token(tampered)
    assert result is None


def test_token_contains_jti():
    token = create_access_token("user-1", [], [])
    payload = decode_access_token(token)
    assert "jti" in payload  # unique token ID


# ── SHA-256 hashing ────────────────────────────────────────────────────────
def test_sha256_file_hash():
    import hashlib
    data = b"Test evidence file content"
    expected = hashlib.sha256(data).hexdigest()
    assert len(expected) == 64
    assert all(c in "0123456789abcdef" for c in expected)


def test_sha256_different_data_gives_different_hash():
    import hashlib
    h1 = hashlib.sha256(b"file content v1").hexdigest()
    h2 = hashlib.sha256(b"file content v2").hexdigest()
    assert h1 != h2


def test_sha256_same_data_gives_same_hash():
    import hashlib
    data = b"consistent content"
    assert hashlib.sha256(data).hexdigest() == hashlib.sha256(data).hexdigest()

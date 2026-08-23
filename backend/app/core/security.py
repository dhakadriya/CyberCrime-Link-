"""
CrimeLink Security Utilities
──────────────────────────────
Password hashing (Argon2id) and JWT token creation/verification.

WHY ARGON2id?
─────────────
Argon2id is the winner of the Password Hashing Competition (2015).
It's memory-hard (resistant to GPU/ASIC attacks) and combines
Argon2i (side-channel resistance) + Argon2d (GPU resistance).
It's recommended by OWASP over bcrypt and scrypt.

WHY NOT MD5/SHA-256 FOR PASSWORDS?
───────────────────────────────────
SHA-256 is a fast hash — an attacker can compute billions per second.
Argon2id is intentionally slow and memory-intensive, making brute-force
attacks computationally infeasible.

WHY JWT?
────────
JSON Web Tokens let the server be stateless — we don't need a session
table. The token contains signed claims (user ID, roles, permissions).
The server verifies the signature on every request without a DB lookup.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password Hashing ────────────────────────────────────────────────────────
# argon2 scheme with sensible defaults for security vs. performance
# deprecated="auto" means old hashes get flagged for re-hashing on next login
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password with Argon2id.
    Returns a string like: $argon2id$v=19$m=65536,t=3,p=4$...
    
    This is the ONLY place passwords should be hashed in CrimeLink.
    Never hash passwords anywhere else.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against an Argon2id hash.
    
    passlib uses constant-time comparison internally,
    which prevents timing attacks that could reveal whether
    a password is "close" to correct.
    
    Returns True if match, False otherwise.
    Never raises an exception for wrong password — always returns bool.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def password_needs_rehash(hashed_password: str) -> bool:
    """
    Check if an existing hash needs to be upgraded.
    Useful when we change hashing parameters over time.
    """
    return pwd_context.needs_update(hashed_password)


# ── Password Policy ─────────────────────────────────────────────────────────
def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Enforce password policy:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    
    Returns (is_valid: bool, error_message: str)
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    special_chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character"
    return True, ""


# ── JWT ─────────────────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    roles: list[str],
    permissions: list[str],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.
    
    Claims:
    - sub: user ID (standard JWT subject claim)
    - roles: list of role names
    - permissions: list of permission names
    - exp: expiration timestamp
    - iat: issued-at timestamp
    - jti: unique token ID (for future revocation support)
    
    The token is signed with HMAC-SHA256 using the JWT_SECRET.
    Anyone with the secret can verify it — keep it secret!
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "roles": roles,
        "permissions": permissions,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid4()),  # Unique token ID
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a JWT token.
    
    Returns the payload dict if valid, None if invalid/expired.
    
    jose library automatically checks:
    - Signature validity (tamper detection)
    - Expiration (exp claim)
    - Algorithm
    
    We return None instead of raising to let the caller
    return a proper HTTP 401 response.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None

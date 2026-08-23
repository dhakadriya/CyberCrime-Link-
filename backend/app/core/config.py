"""
CrimeLink Core Configuration
─────────────────────────────
Uses pydantic-settings to load environment variables with type validation.
All configuration comes from environment variables or .env file.
NEVER hardcode secrets here.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find .env file — check current dir, parent dir, and project root
def _find_env_file() -> str:
    for candidate in [
        Path(".env"),
        Path("../.env"),
        Path(__file__).resolve().parent.parent.parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]:
        if candidate.exists():
            return str(candidate)
    return ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "CrimeLink"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- Database ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./crimelink.db"
    DATABASE_URL_SYNC: str = "sqlite:///./crimelink.db"

    @property
    def resolved_database_url(self) -> str:
        """Make SQLite paths absolute so they work from any working directory."""
        if self.DATABASE_URL.startswith("sqlite"):
            # Make the path absolute relative to project root
            db_file = self.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "").lstrip("./")
            project_root = Path(__file__).resolve().parent.parent.parent.parent
            abs_path = project_root / db_file
            return f"sqlite+aiosqlite:///{abs_path}"
        return self.DATABASE_URL

    # --- JWT ---
    JWT_SECRET: str = "dev_secret_change_me_in_production_must_be_32_chars_min_xxxxx"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- Security ---
    MAX_FAILED_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 30

    # --- File Upload ---
    MAX_UPLOAD_SIZE: int = 52_428_800  # 50MB default
    UPLOAD_DIRECTORY: str = str(Path(__file__).resolve().parent.parent.parent / "evidence_storage")

    # Allowed file extensions (allowlist — reject everything else)
    ALLOWED_EXTENSIONS: List[str] = [
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
        ".mp4", ".avi", ".mov", ".mkv",
        ".pdf", ".docx", ".doc", ".txt", ".csv", ".xlsx",
        ".mp3", ".wav", ".aac",
    ]

    # Allowed MIME types (server-side validation)
    ALLOWED_MIME_TYPES: List[str] = [
        "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp",
        "video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain", "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "audio/mpeg", "audio/wav", "audio/aac",
    ]

    # --- CORS ---
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated origins into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # --- Seed ---
    SEED_DEFAULT_PASSWORD: str = ""

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters. "
                "Generate with: python -c \"import secrets; print(secrets.token_hex(64))\""
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_url_must_exist(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set in environment")
        return v


@lru_cache()
def get_settings() -> Settings:
    """
    Returns cached settings instance.
    lru_cache means this function only runs once per process,
    so we don't re-read .env on every request.
    """
    return Settings()


# Convenience export
settings = get_settings()

"""
Secure File Handler
────────────────────
Handles evidence file upload with full security pipeline:
1. Size validation
2. Extension allowlist
3. MIME type validation (magic bytes)
4. Secure filename generation
5. Safe storage outside web root
6. SHA-256 calculation

WHY MAGIC BYTES?
────────────────
A file named "malware.jpg" with Content-Type: image/jpeg
can actually be a Python script. We read the first bytes
of the file (magic bytes / file signature) to verify
the ACTUAL file type regardless of what the client claims.

Example magic bytes:
- JPEG: FF D8 FF
- PNG:  89 50 4E 47
- PDF:  25 50 44 46 (%PDF)
- ZIP:  50 4B 03 04 (which is also .docx, .xlsx!)
"""

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

import aiofiles
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import app_logger

# MIME type to evidence type mapping
MIME_TO_EVIDENCE_TYPE = {
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "image/gif": "IMAGE",
    "image/bmp": "IMAGE",
    "image/webp": "IMAGE",
    "video/mp4": "VIDEO",
    "video/x-msvideo": "VIDEO",
    "video/quicktime": "VIDEO",
    "video/x-matroska": "VIDEO",
    "application/pdf": "DOCUMENT",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
    "application/msword": "DOCUMENT",
    "text/plain": "DOCUMENT",
    "text/csv": "DOCUMENT",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "DOCUMENT",
    "audio/mpeg": "AUDIO",
    "audio/wav": "AUDIO",
    "audio/aac": "AUDIO",
}


def _get_extension(filename: str) -> str:
    """Get lowercase extension from filename."""
    return Path(filename).suffix.lower()


def _is_allowed_extension(filename: str) -> bool:
    ext = _get_extension(filename)
    return ext in settings.ALLOWED_EXTENSIONS


def _detect_mime_type(file_bytes: bytes) -> str:
    """
    Detect MIME type from file magic bytes.
    Falls back to 'application/octet-stream' if detection fails.
    
    Uses python-magic which reads actual file signatures,
    not trusting the filename or Content-Type header.
    """
    try:
        import magic
        mime = magic.from_buffer(file_bytes[:8192], mime=True)
        return mime
    except Exception:
        # If magic detection fails, return unknown
        return "application/octet-stream"


def _generate_safe_filename(original_filename: str) -> str:
    """
    Generate a cryptographically random storage filename.
    
    Format: {uuid4}_{timestamp}{safe_extension}
    
    WHY random filename?
    - Prevents path traversal attacks (../../etc/passwd)
    - Prevents overwriting existing files
    - Prevents filename-based information disclosure
    - The original filename is stored in DB, never used for storage
    """
    ext = _get_extension(original_filename)
    # Double-check extension is in allowlist
    if ext not in settings.ALLOWED_EXTENSIONS:
        ext = ".bin"  # Fallback to safe extension

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    random_id = str(uuid.uuid4()).replace("-", "")
    return f"{random_id}_{timestamp}{ext}"


def _calculate_sha256(file_bytes: bytes) -> str:
    """
    Calculate SHA-256 hash of file contents.
    
    WHY SHA-256?
    SHA-256 produces a 256-bit (64 hex char) fingerprint.
    Any change to the file — even one byte — produces a completely
    different hash. This is how we detect evidence tampering.
    
    Returns: 64-character lowercase hex string
    """
    return hashlib.sha256(file_bytes).hexdigest()


async def verify_file_integrity(storage_path: str, stored_hash: str) -> Tuple[bool, str]:
    """
    Re-read file from disk and compare SHA-256 to stored hash.
    
    Returns: (is_intact: bool, current_hash: str)
    
    If is_intact is False, the file has been modified since upload —
    this is a CRITICAL security event.
    """
    try:
        async with aiofiles.open(storage_path, "rb") as f:
            file_bytes = await f.read()
        current_hash = _calculate_sha256(file_bytes)
        return current_hash == stored_hash, current_hash
    except FileNotFoundError:
        app_logger.error("integrity_check_file_missing", path=storage_path)
        return False, ""
    except Exception as e:
        app_logger.error("integrity_check_failed", error=str(e))
        return False, ""


async def save_evidence_file(
    upload_file: UploadFile,
) -> Tuple[str, str, str, int, str, str]:
    """
    Full secure evidence upload pipeline.
    
    Returns tuple:
        (original_filename, stored_filename, storage_path, 
         file_size, mime_type, sha256_hash)
    
    Raises HTTPException on any security violation.
    """
    original_filename = upload_file.filename or "unknown"

    # 1. Extension allowlist check
    if not _is_allowed_extension(original_filename):
        ext = _get_extension(original_filename)
        app_logger.warning(
            "upload_rejected_extension",
            filename=original_filename,
            extension=ext,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' is not allowed",
        )

    # 2. Read file contents
    file_bytes = await upload_file.read()

    # 3. File size check
    file_size = len(file_bytes)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file not allowed",
        )
    if file_size > settings.MAX_UPLOAD_SIZE:
        max_mb = settings.MAX_UPLOAD_SIZE // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_mb}MB",
        )

    # 4. MIME type detection from magic bytes
    detected_mime = _detect_mime_type(file_bytes)

    if detected_mime not in settings.ALLOWED_MIME_TYPES:
        app_logger.warning(
            "upload_rejected_mime",
            filename=original_filename,
            detected_mime=detected_mime,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File content type '{detected_mime}' is not allowed",
        )

    # 5. Generate secure storage filename (never use original)
    stored_filename = _generate_safe_filename(original_filename)

    # 6. Ensure storage directory exists
    storage_dir = Path(settings.UPLOAD_DIRECTORY).resolve()
    storage_dir.mkdir(parents=True, exist_ok=True)

    # 7. Build storage path — resolve to prevent path traversal
    storage_path = (storage_dir / stored_filename).resolve()

    # Security: ensure path is still inside storage directory
    if not str(storage_path).startswith(str(storage_dir)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path",
        )

    # 8. Write file to disk
    async with aiofiles.open(storage_path, "wb") as f:
        await f.write(file_bytes)

    # 9. Calculate SHA-256
    sha256_hash = _calculate_sha256(file_bytes)

    app_logger.info(
        "evidence_file_saved",
        original_filename=original_filename,
        stored_filename=stored_filename,
        size=file_size,
        mime=detected_mime,
        sha256=sha256_hash[:16] + "...",  # Log only prefix, not full hash
    )

    return (
        original_filename,
        stored_filename,
        str(storage_path),
        file_size,
        detected_mime,
        sha256_hash,
    )


async def delete_evidence_file(storage_path: str) -> bool:
    """Securely delete a file. Returns True if deleted."""
    try:
        path = Path(storage_path)
        if path.exists():
            path.unlink()
            return True
        return False
    except Exception as e:
        app_logger.error("file_delete_failed", path=storage_path, error=str(e))
        return False

"""
Evidence Router
────────────────
Secure evidence upload, download, integrity verification,
and chain of custody management.
"""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Query, Request, UploadFile, status
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_permission
from app.models.evidence import Evidence, EvidenceCustody
from app.models.case import Case, CaseAssignment
from app.models.user import User
from app.schemas.evidence import (
    EvidenceResponse, EvidenceListResponse, EvidenceTransferRequest,
    EvidenceIntegrityResult, CustodyResponse,
)
from app.services.audit_service import log_action, log_security_event
from app.utils.file_handler import save_evidence_file, verify_file_integrity

router = APIRouter(prefix="/evidence", tags=["Evidence"])


async def _generate_evidence_number(db: AsyncSession, case_id: str) -> str:
    """Generate: EVD-{CASE_NUMBER}-{SEQ}"""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    case_num = case.case_number if case else "UNK"

    count_result = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case_id)
    )
    count = count_result.scalar() or 0
    return f"EVD-{case_num.replace('CASE-', '')}-{count + 1:03d}"


async def _check_evidence_access(
    evidence_id: str, db: AsyncSession, user: User
) -> Evidence:
    """Load evidence and check case access."""
    result = await db.execute(
        select(Evidence)
        .options(
            selectinload(Evidence.uploader),
            selectinload(Evidence.custodian),
            selectinload(Evidence.case),
        )
        .where(Evidence.id == evidence_id)
    )
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Check case access
    user_roles = set(user.roles)
    if "SUPER_ADMIN" not in user_roles and "CASE_SUPERVISOR" not in user_roles:
        assignment = await db.execute(
            select(CaseAssignment).where(
                CaseAssignment.case_id == evidence.case_id,
                CaseAssignment.user_id == user.id,
                CaseAssignment.is_active == True,
            )
        )
        if not assignment.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Evidence not found")

    return evidence


def _build_evidence_response(evidence: Evidence) -> EvidenceResponse:
    return EvidenceResponse(
        id=evidence.id,
        case_id=evidence.case_id,
        evidence_number=evidence.evidence_number,
        evidence_type=evidence.evidence_type,
        description=evidence.description,
        original_filename=evidence.original_filename,
        stored_filename=evidence.stored_filename,
        mime_type=evidence.mime_type,
        file_size=evidence.file_size,
        sha256_hash=evidence.sha256_hash,
        status=evidence.status,
        current_custodian_id=evidence.current_custodian,
        current_custodian_name=evidence.custodian.full_name if evidence.custodian else None,
        uploaded_by_id=evidence.uploaded_by,
        uploaded_by_name=evidence.uploader.full_name if evidence.uploader else "Unknown",
        uploaded_at=evidence.uploaded_at,
        updated_at=evidence.updated_at,
    )


@router.get("", response_model=EvidenceListResponse, summary="List evidence", include_in_schema=False)
@router.get("/", response_model=EvidenceListResponse, summary="List evidence")
async def list_evidence(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    case_id: Optional[str] = Query(default=None),
    evidence_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_READ")),
) -> EvidenceListResponse:
    query = select(Evidence).options(
        selectinload(Evidence.uploader),
        selectinload(Evidence.custodian),
    )

    user_roles = set(current_user.roles)
    if "SUPER_ADMIN" not in user_roles and "CASE_SUPERVISOR" not in user_roles:
        # Only see evidence from assigned cases
        query = query.join(CaseAssignment, CaseAssignment.case_id == Evidence.case_id).where(
            CaseAssignment.user_id == current_user.id,
            CaseAssignment.is_active == True,
        )

    if case_id:
        query = query.where(Evidence.case_id == case_id)
    if evidence_type:
        query = query.where(Evidence.evidence_type == evidence_type.upper())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * size
    query = query.order_by(Evidence.uploaded_at.desc()).offset(offset).limit(size)
    items = (await db.execute(query)).scalars().unique().all()

    return EvidenceListResponse(
        items=[_build_evidence_response(e) for e in items],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post(
    "/upload",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload evidence file",
)
async def upload_evidence(
    request: Request,
    case_id: str = Form(...),
    description: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_UPLOAD")),
) -> EvidenceResponse:
    """
    Secure evidence upload pipeline.
    Validates extension, MIME type, size, calculates SHA-256.
    """
    # Verify case exists and user has access
    case = (await db.execute(
        select(Case).where(Case.id == case_id)
    )).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    user_roles = set(current_user.roles)
    if "SUPER_ADMIN" not in user_roles and "CASE_SUPERVISOR" not in user_roles:
        assignment = await db.execute(
            select(CaseAssignment).where(
                CaseAssignment.case_id == case_id,
                CaseAssignment.user_id == current_user.id,
                CaseAssignment.is_active == True,
            )
        )
        if not assignment.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized for this case")

    # Run secure file pipeline
    (
        original_filename,
        stored_filename,
        storage_path,
        file_size,
        mime_type,
        sha256_hash,
    ) = await save_evidence_file(file)

    # Determine evidence type from MIME
    from app.utils.file_handler import MIME_TO_EVIDENCE_TYPE
    evidence_type = MIME_TO_EVIDENCE_TYPE.get(mime_type, "DIGITAL")

    evidence_number = await _generate_evidence_number(db, case_id)

    evidence = Evidence(
        case_id=case_id,
        evidence_number=evidence_number,
        evidence_type=evidence_type,
        description=description,
        original_filename=original_filename,
        stored_filename=stored_filename,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size=file_size,
        sha256_hash=sha256_hash,
        status="ACTIVE",
        current_custodian=current_user.id,
        uploaded_by=current_user.id,
    )
    db.add(evidence)
    await db.flush()

    # Initial custody record
    custody = EvidenceCustody(
        evidence_id=evidence.id,
        previous_custodian=None,
        new_custodian=current_user.id,
        transferred_by=current_user.id,
        action="CREATED",
        remarks=f"Evidence uploaded: {original_filename}",
        sha256_at_transfer=sha256_hash,
    )
    db.add(custody)

    # Timeline event
    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case_id,
        event_type="EVIDENCE_UPLOADED",
        title=f"Evidence uploaded: {evidence_number}",
        description=f"File: {original_filename} ({evidence_type})",
        created_by=current_user.id,
        related_evidence=evidence.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(evidence)

    # Load relationships
    await db.refresh(evidence, ["uploader", "custodian"])

    await log_action(
        db, "EVIDENCE_UPLOADED",
        user_id=current_user.id, username=current_user.username,
        resource_type="EVIDENCE", resource_id=evidence.id,
        details={
            "evidence_number": evidence_number,
            "evidence_type": evidence_type,
            "file_size": file_size,
            "sha256": sha256_hash[:16] + "...",
        },
        request=request,
    )

    return _build_evidence_response(evidence)


@router.get("/{evidence_id}", response_model=EvidenceResponse, summary="Get evidence details")
async def get_evidence(
    request: Request,
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_READ")),
) -> EvidenceResponse:
    evidence = await _check_evidence_access(evidence_id, db, current_user)

    await log_action(
        db, "EVIDENCE_VIEWED",
        user_id=current_user.id, username=current_user.username,
        resource_type="EVIDENCE", resource_id=evidence_id,
        request=request,
    )

    return _build_evidence_response(evidence)


@router.get("/{evidence_id}/download", summary="Download evidence file")
async def download_evidence(
    request: Request,
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_DOWNLOAD")),
):
    """
    Authenticated, audited file download.
    Never serves files directly from web root.
    """
    evidence = await _check_evidence_access(evidence_id, db, current_user)

    import os
    if not os.path.exists(evidence.storage_path):
        raise HTTPException(status_code=404, detail="Evidence file not found on storage")

    await log_action(
        db, "EVIDENCE_DOWNLOADED",
        user_id=current_user.id, username=current_user.username,
        resource_type="EVIDENCE", resource_id=evidence_id,
        details={"evidence_number": evidence.evidence_number},
        request=request,
    )

    # Safe download filename — use evidence_number, not original filename
    safe_name = f"{evidence.evidence_number}{_get_extension(evidence.stored_filename)}"

    return FileResponse(
        path=evidence.storage_path,
        filename=safe_name,
        media_type=evidence.mime_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="{safe_name}"',
        },
    )


@router.post(
    "/{evidence_id}/verify",
    response_model=EvidenceIntegrityResult,
    summary="Verify evidence file integrity",
)
async def verify_evidence_integrity(
    request: Request,
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_READ")),
) -> EvidenceIntegrityResult:
    """
    Re-calculate SHA-256 and compare to stored hash.
    
    If hashes differ → file was tampered with → CRITICAL security event.
    """
    evidence = await _check_evidence_access(evidence_id, db, current_user)

    is_intact, current_hash = await verify_file_integrity(
        evidence.storage_path, evidence.sha256_hash
    )

    # Custody record for integrity check
    custody = EvidenceCustody(
        evidence_id=evidence_id,
        previous_custodian=evidence.current_custodian,
        new_custodian=evidence.current_custodian,
        transferred_by=current_user.id,
        action="INTEGRITY_CHECK",
        remarks=f"Integrity check by {current_user.username}. Result: {'PASSED' if is_intact else 'FAILED'}",
        sha256_at_transfer=current_hash,
    )
    db.add(custody)

    if not is_intact:
        # CRITICAL — evidence may have been tampered with
        evidence.status = "COMPROMISED"
        await log_security_event(
            db, "EVIDENCE_INTEGRITY_FAILED",
            f"Evidence integrity check FAILED for {evidence.evidence_number}",
            severity="CRITICAL",
            user_id=current_user.id,
            username=current_user.username,
            details={
                "evidence_id": evidence_id,
                "evidence_number": evidence.evidence_number,
                "stored_hash": evidence.sha256_hash,
                "current_hash": current_hash,
            },
            request=request,
        )

    await db.commit()

    await log_action(
        db, "EVIDENCE_INTEGRITY_CHECKED",
        user_id=current_user.id, username=current_user.username,
        resource_type="EVIDENCE", resource_id=evidence_id,
        result="SUCCESS" if is_intact else "FAILURE",
        details={"intact": is_intact},
        request=request,
    )

    return EvidenceIntegrityResult(
        evidence_id=evidence_id,
        evidence_number=evidence.evidence_number,
        is_intact=is_intact,
        stored_hash=evidence.sha256_hash,
        current_hash=current_hash,
        message="INTEGRITY VERIFIED" if is_intact else "INTEGRITY CHECK FAILED — File may have been tampered",
        checked_at=datetime.now(timezone.utc),
    )


@router.post(
    "/{evidence_id}/transfer",
    summary="Transfer evidence custody",
)
async def transfer_evidence_custody(
    request: Request,
    evidence_id: str,
    transfer_data: EvidenceTransferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_TRANSFER")),
) -> dict:
    evidence = await _check_evidence_access(evidence_id, db, current_user)

    # Verify new custodian exists
    new_custodian = (await db.execute(
        select(User).where(User.id == transfer_data.new_custodian_id)
    )).scalar_one_or_none()
    if not new_custodian:
        raise HTTPException(status_code=404, detail="New custodian user not found")

    old_custodian_id = evidence.current_custodian

    # Create custody record
    custody = EvidenceCustody(
        evidence_id=evidence_id,
        previous_custodian=old_custodian_id,
        new_custodian=transfer_data.new_custodian_id,
        transferred_by=current_user.id,
        action="TRANSFERRED",
        remarks=transfer_data.remarks,
        sha256_at_transfer=evidence.sha256_hash,
    )
    db.add(custody)

    evidence.current_custodian = transfer_data.new_custodian_id
    evidence.status = "TRANSFERRED"

    # Timeline event
    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=evidence.case_id,
        event_type="EVIDENCE_TRANSFERRED",
        title=f"Evidence {evidence.evidence_number} transferred",
        description=f"Transferred to {new_custodian.full_name}",
        created_by=current_user.id,
        related_evidence=evidence_id,
    )
    db.add(event)

    await db.commit()

    await log_action(
        db, "EVIDENCE_TRANSFERRED",
        user_id=current_user.id, username=current_user.username,
        resource_type="EVIDENCE", resource_id=evidence_id,
        details={
            "from_custodian": old_custodian_id,
            "to_custodian": transfer_data.new_custodian_id,
        },
        request=request,
    )

    return {"message": f"Evidence transferred to {new_custodian.full_name}"}


@router.get(
    "/{evidence_id}/custody",
    response_model=list[CustodyResponse],
    summary="Get chain of custody",
)
async def get_custody_chain(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("EVIDENCE_READ")),
) -> list[CustodyResponse]:
    evidence = await _check_evidence_access(evidence_id, db, current_user)

    result = await db.execute(
        select(EvidenceCustody)
        .options(
            selectinload(EvidenceCustody.prev_user),
            selectinload(EvidenceCustody.new_user),
            selectinload(EvidenceCustody.transfer_user),
        )
        .where(EvidenceCustody.evidence_id == evidence_id)
        .order_by(EvidenceCustody.transferred_at)
    )
    chain = result.scalars().all()

    return [
        CustodyResponse(
            id=c.id,
            evidence_id=c.evidence_id,
            previous_custodian_name=c.prev_user.full_name if c.prev_user else None,
            new_custodian_name=c.new_user.full_name if c.new_user else None,
            transferred_by_name=c.transfer_user.full_name if c.transfer_user else "Unknown",
            action=c.action,
            remarks=c.remarks,
            sha256_at_transfer=c.sha256_at_transfer,
            transferred_at=c.transferred_at,
        )
        for c in chain
    ]


def _get_extension(filename: str) -> str:
    from pathlib import Path
    return Path(filename).suffix.lower()


# ── Bulk Evidence Upload ─────────────────────────────────────────────────────

@router.post(
    "/bulk-upload",
    summary="Upload multiple evidence files at once",
    status_code=status.HTTP_201_CREATED,
)
async def bulk_upload_evidence(
    request: Request,
    case_id: str = Form(...),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("EVIDENCE_UPLOAD")),
) -> dict:
    """
    Upload multiple evidence files in one request.
    Each file goes through the same full security pipeline as single upload:
    - Extension allowlist
    - MIME validation
    - File size check
    - SHA-256 calculation
    - Duplicate detection
    - Audit logging per file

    Returns per-file results so the frontend can show progress.
    """
    from app.utils.file_handler import save_evidence_file, MIME_TO_EVIDENCE_TYPE

    # Verify case access
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    user_roles = set(current_user.roles)
    if "SUPER_ADMIN" not in user_roles and "CASE_SUPERVISOR" not in user_roles:
        assignment = await db.execute(
            select(CaseAssignment).where(
                CaseAssignment.case_id == case_id,
                CaseAssignment.user_id == current_user.id,
                CaseAssignment.is_active == True,
            )
        )
        if not assignment.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized for this case")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per bulk upload")

    results = []
    uploaded_count = 0
    failed_count = 0

    for upload_file in files:
        original_name = upload_file.filename or "unknown"
        try:
            (
                original_filename, stored_filename, storage_path,
                file_size, mime_type, sha256_hash,
            ) = await save_evidence_file(upload_file)

            # Duplicate hash check
            existing = (await db.execute(
                select(Evidence).where(Evidence.sha256_hash == sha256_hash)
            )).scalar_one_or_none()

            if existing:
                results.append({
                    "filename": original_name,
                    "status": "duplicate",
                    "message": f"File already exists as {existing.evidence_number}",
                    "evidence_number": existing.evidence_number,
                    "sha256": sha256_hash,
                })
                continue

            evidence_type = MIME_TO_EVIDENCE_TYPE.get(mime_type, "DIGITAL")
            evidence_number = await _generate_evidence_number(db, case_id)

            evidence = Evidence(
                case_id=case_id,
                evidence_number=evidence_number,
                evidence_type=evidence_type,
                description=f"Bulk uploaded: {original_name}",
                original_filename=original_filename,
                stored_filename=stored_filename,
                storage_path=storage_path,
                mime_type=mime_type,
                file_size=file_size,
                sha256_hash=sha256_hash,
                status="ACTIVE",
                current_custodian=current_user.id,
                uploaded_by=current_user.id,
            )
            db.add(evidence)
            await db.flush()

            db.add(EvidenceCustody(
                evidence_id=evidence.id,
                previous_custodian=None,
                new_custodian=current_user.id,
                transferred_by=current_user.id,
                action="CREATED",
                remarks=f"Bulk upload: {original_filename}",
                sha256_at_transfer=sha256_hash,
            ))

            from app.models.investigation import InvestigationEvent
            db.add(InvestigationEvent(
                case_id=case_id,
                event_type="EVIDENCE_UPLOADED",
                title=f"Evidence uploaded: {evidence_number}",
                description=f"Bulk upload — {original_filename}",
                created_by=current_user.id,
                related_evidence=evidence.id,
            ))

            await log_action(
                db, "EVIDENCE_UPLOADED",
                user_id=current_user.id, username=current_user.username,
                resource_type="EVIDENCE", resource_id=evidence.id,
                details={"evidence_number": evidence_number, "bulk": True},
                request=request,
            )

            results.append({
                "filename": original_name,
                "status": "success",
                "evidence_number": evidence_number,
                "evidence_id": evidence.id,
                "evidence_type": evidence_type,
                "file_size": file_size,
                "sha256": sha256_hash,
                "mime_type": mime_type,
            })
            uploaded_count += 1

        except HTTPException as e:
            results.append({
                "filename": original_name,
                "status": "failed",
                "message": e.detail,
            })
            failed_count += 1
        except Exception as e:
            results.append({
                "filename": original_name,
                "status": "failed",
                "message": f"Upload failed: {str(e)[:100]}",
            })
            failed_count += 1

    await db.commit()

    await log_action(
        db, "EVIDENCE_BULK_UPLOADED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case_id,
        details={"total": len(files), "success": uploaded_count, "failed": failed_count},
        request=request,
    )

    return {
        "case_id": case_id,
        "total_files": len(files),
        "uploaded": uploaded_count,
        "failed": failed_count,
        "results": results,
    }

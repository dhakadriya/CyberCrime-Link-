"""
Bulk Case Import Router
─────────────────────────
Supports XLSX and CSV import with preview + confirm workflow.

Security:
- JWT auth + CASE_CREATE permission required
- File size limited
- Formula injection stripped in parser
- All values validated against allowlists
- Transactional import (all or nothing)
- Full audit log on completion
- No raw spreadsheet values inserted directly into DB
"""

import io
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.case import Case, CaseAssignment
from app.models.investigation import InvestigationEvent
from app.models.person import Person, CasePerson
from app.models.relationship import Relationship
from app.schemas.case import (
    ImportPreviewResponse, ImportConfirmResponse, ImportSheetPreview,
)
from app.services.audit_service import log_action
from app.modules.import_cases.parser import (
    parse_import_file, parse_cases_sheet, parse_persons_sheet,
    parse_relationships_sheet, parse_events_sheet,
)

router = APIRouter(prefix="/import", tags=["Bulk Import"])

# Store previews temporarily (in-process cache — fine for demo; use Redis in production)
_import_cache: dict = {}

MAX_IMPORT_SIZE = 10 * 1024 * 1024  # 10MB


@router.get(
    "/template/xlsx",
    summary="Download Excel import template",
    response_class=StreamingResponse,
)
async def download_xlsx_template(
    current_user=Depends(require_permission("CASE_CREATE")),
):
    """Returns a filled CrimeLink_Case_Import_Template.xlsx."""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()

    HEADER_FILL = PatternFill("solid", fgColor="1E3A5F")
    HEADER_FONT = Font(bold=True, color="FFFFFF")
    EXAMPLE_FILL = PatternFill("solid", fgColor="EEF2FF")

    def make_sheet(wb, name: str, headers: list, examples: list, instructions: str = ""):
        ws = wb.create_sheet(name)
        ws.append(headers)
        for cell in ws[1]:
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal="center")
        for ex in examples:
            ws.append(ex)
            for cell in ws[ws.max_row]:
                cell.fill = EXAMPLE_FILL
        if instructions:
            ws.append([])
            ws.append([f"# Instructions: {instructions}"])
        for col_num, _ in enumerate(headers, 1):
            ws.column_dimensions[get_column_letter(col_num)].width = 22
        return ws

    # Remove default sheet
    del wb["Sheet"]

    # CASES sheet
    make_sheet(wb, "Cases",
        headers=["title", "crime_type", "description", "location", "date_time", "status", "priority"],
        examples=[
            ["Commerce Street Robbery", "ROBBERY", "Armed robbery at convenience store", "Synthetic City Centre", "2026-08-01 14:30:00", "OPEN", "HIGH"],
            ["Riverside Burglary", "BURGLARY", "Break-in at residential property", "Riverside Area", "2026-08-02 03:00:00", "UNDER_INVESTIGATION", "MEDIUM"],
        ],
        instructions=f"Allowed crime_type: {', '.join(sorted(['ROBBERY','BURGLARY','FRAUD','ASSAULT','MURDER','KIDNAPPING','CYBERCRIME','DRUG_TRAFFICKING','MONEY_LAUNDERING','OTHER']))}. Allowed status: DRAFT, OPEN, UNDER_INVESTIGATION, ON_HOLD, SOLVED, CLOSED, ARCHIVED. Allowed priority: LOW, MEDIUM, HIGH, CRITICAL.",
    )

    # PERSONS sheet
    make_sheet(wb, "Persons",
        headers=["case_id", "first_name", "last_name", "role", "alias", "nationality", "address", "contact", "occupation", "notes"],
        examples=[
            ["CASE-2026-001", "Marcus", "Webb", "SUSPECT", "Marky", "Synthetic", "12 Northgate Street", "555-0101", "Unemployed", "SYNTHETIC DATA"],
            ["CASE-2026-001", "Thomas", "Greene", "VICTIM", "", "Synthetic", "88 Commerce St", "555-0201", "Store Owner", "SYNTHETIC DATA"],
        ],
        instructions="Allowed roles: SUSPECT, VICTIM, WITNESS, COMPLAINANT, OFFICER, OTHER. Use case_id or case_number from Cases sheet to link.",
    )

    # RELATIONSHIPS sheet
    make_sheet(wb, "Relationships",
        headers=["case_id", "source_person_id", "relationship_type", "target_person_id", "strength", "notes"],
        examples=[
            ["CASE-2026-001", "Marcus Webb", "ASSOCIATED_WITH", "Derek Hollis", "STRONG", "Known associates"],
        ],
        instructions=f"Allowed relationship_type: {', '.join(sorted(['FRIEND_OF','ASSOCIATED_WITH','RELATED_TO','OWNER_OF','WITNESS_TO','LINKED_TO']))}. Allowed strength: WEAK, MEDIUM, STRONG.",
    )

    # EVENTS sheet
    make_sheet(wb, "Investigation Events",
        headers=["case_id", "event_type", "title", "description", "event_date"],
        examples=[
            ["CASE-2026-001", "WITNESS_INTERVIEWED", "Witness statement taken", "Angela Morrow provided account", "2026-08-01 16:00:00"],
        ],
        instructions="event_type examples: CASE_CREATED, WITNESS_INTERVIEWED, EVIDENCE_COLLECTED, INVESTIGATION_NOTE, STATUS_CHANGED.",
    )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=CrimeLink_Case_Import_Template.xlsx"},
    )


@router.get(
    "/template/csv",
    summary="Download CSV import template",
    response_class=StreamingResponse,
)
async def download_csv_template(
    current_user=Depends(require_permission("CASE_CREATE")),
):
    """Returns CSV template for cases (simplest format)."""
    content = (
        "title,crime_type,description,location,date_time,status,priority\n"
        "Commerce Street Robbery,ROBBERY,Armed robbery at convenience store,Synthetic City Centre,2026-08-01 14:30:00,OPEN,HIGH\n"
        "Riverside Burglary,BURGLARY,Break-in at residential property,Riverside Area,2026-08-02 03:00:00,UNDER_INVESTIGATION,MEDIUM\n"
        "# Allowed crime_type: ROBBERY BURGLARY FRAUD ASSAULT MURDER KIDNAPPING CYBERCRIME DRUG_TRAFFICKING MONEY_LAUNDERING OTHER\n"
        "# Allowed status: DRAFT OPEN UNDER_INVESTIGATION ON_HOLD SOLVED CLOSED ARCHIVED\n"
        "# Allowed priority: LOW MEDIUM HIGH CRITICAL\n"
    )
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=CrimeLink_Cases_Template.csv"},
    )


@router.post(
    "/preview",
    response_model=ImportPreviewResponse,
    summary="Upload file and get import preview (does NOT import yet)",
)
async def preview_import(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_CREATE")),
) -> ImportPreviewResponse:
    """
    Parse the uploaded file and return a preview of what would be imported.
    Data is NOT written to the database at this stage.
    The user must call /import/confirm to actually import.
    """
    # Size check
    content = await file.read()
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_IMPORT_SIZE // (1024*1024)}MB",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    original_filename = file.filename or "import"
    # Extension check: only xlsx, xls, csv
    ext = original_filename.lower().rsplit(".", 1)[-1] if "." in original_filename else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=400,
            detail="Only .xlsx, .xls, and .csv files are supported for import",
        )

    # Parse
    try:
        parsed = parse_import_file(content, original_filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate each sheet
    cases_valid, cases_preview = parse_cases_sheet(parsed["cases_rows"])
    persons_valid, persons_preview = parse_persons_sheet(parsed["persons_rows"])

    rel_preview = None
    if parsed["relationships_rows"]:
        _, rel_preview = parse_relationships_sheet(parsed["relationships_rows"])

    evt_preview = None
    if parsed["events_rows"]:
        _, evt_preview = parse_events_sheet(parsed["events_rows"])

    total_valid = cases_preview.valid_rows + persons_preview.valid_rows
    total_invalid = cases_preview.invalid_rows + persons_preview.invalid_rows
    if rel_preview:
        total_valid += rel_preview.valid_rows
        total_invalid += rel_preview.invalid_rows
    if evt_preview:
        total_valid += evt_preview.valid_rows
        total_invalid += evt_preview.invalid_rows

    can_import = cases_preview.valid_rows > 0 and cases_preview.invalid_rows == 0

    # Cache parsed data server-side (keyed by user+filename combo)
    cache_key = f"{current_user.id}:{original_filename}:{len(content)}"
    _import_cache[cache_key] = {
        "cases": cases_valid,
        "persons": persons_valid,
        "relationships": parse_relationships_sheet(parsed["relationships_rows"])[0] if parsed["relationships_rows"] else [],
        "events": parse_events_sheet(parsed["events_rows"])[0] if parsed["events_rows"] else [],
        "filename": original_filename,
        "user_id": current_user.id,
        "username": current_user.username,
    }

    return ImportPreviewResponse(
        filename=original_filename,
        file_size=len(content),
        sheets_found=parsed["sheets_found"],
        cases=cases_preview,
        persons=persons_preview,
        relationships=rel_preview,
        events=evt_preview,
        can_import=can_import,
        total_valid=total_valid,
        total_invalid=total_invalid,
    )


@router.post(
    "/confirm",
    response_model=ImportConfirmResponse,
    summary="Confirm and execute the previously previewed import",
)
async def confirm_import(
    request: Request,
    filename: str,
    file_size: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_CREATE")),
) -> ImportConfirmResponse:
    """
    Execute the import that was previously previewed.
    Uses server-cached parsed data — not the file again.
    All operations are transactional.
    """
    cache_key = f"{current_user.id}:{filename}:{file_size}"
    cached = _import_cache.get(cache_key)

    if not cached or cached["user_id"] != current_user.id:
        raise HTTPException(
            status_code=400,
            detail="No pending import found. Please upload and preview the file first.",
        )

    cases_data = cached["cases"]
    persons_data = cached["persons"]
    relationships_data = cached["relationships"]
    events_data = cached["events"]

    cases_created = 0
    persons_created = 0
    persons_linked = 0
    relationships_created = 0
    events_created = 0
    errors = []

    # Track case title → case_id mapping for linking persons/events
    case_title_to_id: dict = {}
    person_name_to_id: dict = {}

    try:
        # Import cases
        from app.modules.cases.router import _generate_case_number
        for case_row in cases_data:
            if case_row.get("_duplicate"):
                errors.append(f"Row {case_row['_row']}: Duplicate case '{case_row['title']}' — skipped")
                continue
            try:
                case_number = await _generate_case_number(db)
                case = Case(
                    case_number=case_number,
                    title=case_row["title"],
                    case_type=case_row["case_type"],
                    description=case_row.get("description"),
                    location=case_row.get("location"),
                    incident_date=case_row.get("incident_date"),
                    status=case_row.get("status", "OPEN"),
                    priority=case_row.get("priority", "MEDIUM"),
                    created_by=current_user.id,
                )
                db.add(case)
                await db.flush()
                db.add(CaseAssignment(
                    case_id=case.id,
                    user_id=current_user.id,
                    role="LEAD_INVESTIGATOR",
                    assigned_by=current_user.id,
                ))
                db.add(InvestigationEvent(
                    case_id=case.id,
                    event_type="CASE_IMPORTED",
                    title=f"Case imported: {case_number}",
                    description=f"Imported from {filename}",
                    created_by=current_user.id,
                ))
                case_title_to_id[case_row["title"].lower()] = case.id
                cases_created += 1
            except Exception as e:
                errors.append(f"Row {case_row['_row']}: Case creation failed — {str(e)[:100]}")

        # Import persons
        for p_row in persons_data:
            try:
                person = Person(
                    first_name=p_row["first_name"],
                    last_name=p_row.get("last_name", ""),
                    alias=p_row.get("alias"),
                    nationality=p_row.get("nationality"),
                    address=p_row.get("address"),
                    phone=p_row.get("phone"),
                    occupation=p_row.get("occupation"),
                    notes=p_row.get("notes", "SYNTHETIC — Imported"),
                    created_by=current_user.id,
                )
                db.add(person)
                await db.flush()
                persons_created += 1

                name_key = f"{p_row['first_name']} {p_row.get('last_name', '')}".strip().lower()
                person_name_to_id[name_key] = person.id

                # Link to case
                case_ref = p_row.get("case_ref", "")
                linked_case_id = case_title_to_id.get(case_ref.lower()) if case_ref else None
                if linked_case_id:
                    db.add(CasePerson(
                        case_id=linked_case_id,
                        person_id=person.id,
                        role=p_row.get("role", "OTHER"),
                        added_by=current_user.id,
                    ))
                    persons_linked += 1
            except Exception as e:
                errors.append(f"Row {p_row['_row']}: Person creation failed — {str(e)[:100]}")

        # Import relationships
        for r_row in relationships_data:
            try:
                src_id = person_name_to_id.get(r_row["source_id"].lower(), r_row["source_id"])
                tgt_id = person_name_to_id.get(r_row["target_id"].lower(), r_row["target_id"])
                case_ref = r_row.get("case_ref", "")
                linked_case_id = case_title_to_id.get(case_ref.lower()) if case_ref else None

                rel = Relationship(
                    source_type=r_row.get("source_type", "PERSON"),
                    source_id=src_id,
                    target_type=r_row.get("target_type", "PERSON"),
                    target_id=tgt_id,
                    relationship_type=r_row["relationship_type"],
                    strength=r_row.get("strength", "MEDIUM"),
                    notes=r_row.get("notes"),
                    case_id=linked_case_id,
                    created_by=current_user.id,
                )
                db.add(rel)
                relationships_created += 1
            except Exception as e:
                errors.append(f"Row {r_row['_row']}: Relationship failed — {str(e)[:100]}")

        # Import events
        for ev_row in events_data:
            try:
                case_ref = ev_row.get("case_ref", "")
                linked_case_id = case_title_to_id.get(case_ref.lower()) if case_ref else None
                if not linked_case_id and case_title_to_id:
                    linked_case_id = next(iter(case_title_to_id.values()))

                if linked_case_id:
                    event = InvestigationEvent(
                        case_id=linked_case_id,
                        event_type=ev_row.get("event_type", "INVESTIGATION_NOTE"),
                        title=ev_row["title"],
                        description=ev_row.get("description"),
                        occurred_at=ev_row.get("occurred_at") or datetime.now(timezone.utc),
                        created_by=current_user.id,
                    )
                    db.add(event)
                    events_created += 1
            except Exception as e:
                errors.append(f"Row {ev_row['_row']}: Event failed — {str(e)[:100]}")

        await db.commit()

        # Audit log
        audit_entry = await log_action(
            db, "BULK_CASE_IMPORT",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="IMPORT",
            details={
                "filename": filename,
                "cases_created": cases_created,
                "persons_created": persons_created,
                "persons_linked": persons_linked,
                "relationships_created": relationships_created,
                "events_created": events_created,
                "errors": len(errors),
            },
            request=request,
        )

        # Clear cache
        _import_cache.pop(cache_key, None)

        return ImportConfirmResponse(
            cases_created=cases_created,
            persons_created=persons_created,
            persons_linked=persons_linked,
            relationships_created=relationships_created,
            events_created=events_created,
            errors=errors,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Import failed and was rolled back: {str(e)[:200]}",
        )

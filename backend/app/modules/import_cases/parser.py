"""
Excel / CSV Parser for bulk case import.

Security rules applied here:
- Never execute formulas — strip any cell starting with = + - @
- Limit file size (checked upstream)
- Validate all enum values against allowlists
- Validate date formats
- Detect duplicates by case title + crime type
- Return row-level errors to caller
"""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# openpyxl is already installed
import openpyxl

from app.schemas.case import (
    VALID_STATUSES, VALID_PRIORITIES, VALID_TYPES, ImportRowError, ImportSheetPreview
)

VALID_PERSON_ROLES = {"SUSPECT", "VICTIM", "WITNESS", "COMPLAINANT", "OFFICER", "OTHER"}
VALID_REL_TYPES = {
    "FRIEND_OF", "ASSOCIATED_WITH", "RELATED_TO", "OWNER_OF",
    "WITNESS_TO", "LINKED_TO", "SUSPECT_IN", "VICTIM_IN"
}
VALID_STRENGTHS = {"WEAK", "MEDIUM", "STRONG"}
MAX_CELL_LENGTH = 5000
MAX_ROWS_PER_SHEET = 1000


def _sanitize_cell(value: Any) -> str:
    """
    Sanitize a spreadsheet cell value.
    
    Formula injection prevention:
    Any cell beginning with = + - @ is a potential spreadsheet formula.
    We strip these prefixes and treat the value as plain text.
    This prevents CSV injection / formula injection attacks.
    """
    if value is None:
        return ""
    text = str(value).strip()
    # Strip formula injection characters
    while text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        text = text[1:].strip()
    # Truncate oversized values
    return text[:MAX_CELL_LENGTH]


def _parse_date(value: str) -> Optional[datetime]:
    """Parse various date formats safely."""
    if not value:
        return None
    formats = [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y",
        "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            continue
    return None


def _row_to_dict(headers: List[str], row) -> Dict[str, str]:
    """Convert a spreadsheet row to a sanitized dict."""
    result = {}
    for i, header in enumerate(headers):
        try:
            if hasattr(row, '__iter__') and not isinstance(row, str):
                cells = list(row)
                val = cells[i].value if hasattr(cells[i], 'value') else cells[i]
            else:
                val = row[i] if i < len(row) else None
            result[header.strip().lower()] = _sanitize_cell(val)
        except (IndexError, AttributeError):
            result[header.strip().lower()] = ""
    return result


def parse_cases_sheet(rows: List[Dict]) -> Tuple[List[Dict], ImportSheetPreview]:
    """Validate and parse case rows."""
    valid = []
    errors = []
    seen_titles: set = set()

    REQUIRED = ["title", "crime_type"]

    for i, row in enumerate(rows[:MAX_ROWS_PER_SHEET], start=2):  # start=2 (row 1 = header)
        title = row.get("title", "").strip()
        crime_type = row.get("crime_type", "").upper().strip()
        status = row.get("status", "OPEN").upper().strip() or "OPEN"
        priority = row.get("priority", "MEDIUM").upper().strip() or "MEDIUM"

        # Required fields
        if not title:
            errors.append(ImportRowError(row=i, field="title", message="Title is required"))
            continue
        if not crime_type:
            errors.append(ImportRowError(row=i, field="crime_type", message="Crime type is required"))
            continue

        # Enum validation
        if crime_type not in VALID_TYPES:
            errors.append(ImportRowError(row=i, field="crime_type",
                message=f"Invalid crime_type '{crime_type}'. Expected: {sorted(VALID_TYPES)}"))
            continue
        if status not in VALID_STATUSES:
            errors.append(ImportRowError(row=i, field="status",
                message=f"Invalid status '{status}'. Expected: {sorted(VALID_STATUSES)}"))
            continue
        if priority not in VALID_PRIORITIES:
            errors.append(ImportRowError(row=i, field="priority",
                message=f"Invalid priority '{priority}'. Expected: {sorted(VALID_PRIORITIES)}"))
            continue

        # Date parsing
        date_raw = row.get("date_time", "") or row.get("incident_date", "")
        incident_date = _parse_date(date_raw)

        # Duplicate detection (within this import batch)
        key = f"{title.lower()}|{crime_type}"
        is_dup = key in seen_titles
        seen_titles.add(key)

        record = {
            "title": title,
            "case_type": crime_type,
            "description": row.get("description", "") or None,
            "location": row.get("location", "") or None,
            "incident_date": incident_date,
            "status": status,
            "priority": priority,
            "_duplicate": is_dup,
            "_row": i,
        }
        valid.append(record)

    dup_count = sum(1 for r in valid if r["_duplicate"])
    preview = ImportSheetPreview(
        sheet="cases",
        valid_rows=len(valid) - dup_count,
        invalid_rows=len(errors),
        duplicate_rows=dup_count,
        errors=errors,
    )
    return valid, preview


def parse_persons_sheet(rows: List[Dict]) -> Tuple[List[Dict], ImportSheetPreview]:
    """Validate and parse person rows."""
    valid = []
    errors = []

    for i, row in enumerate(rows[:MAX_ROWS_PER_SHEET], start=2):
        first = row.get("first_name", "") or row.get("name", "")
        last = row.get("last_name", "")

        # Handle "Full Name" column
        if not first and not last:
            full = row.get("name", "") or row.get("full_name", "")
            if full:
                parts = full.split(None, 1)
                first = parts[0]
                last = parts[1] if len(parts) > 1 else ""

        if not first:
            errors.append(ImportRowError(row=i, field="first_name/name", message="Name is required"))
            continue

        role = (row.get("role", "OTHER")).upper().strip() or "OTHER"
        if role not in VALID_PERSON_ROLES:
            errors.append(ImportRowError(row=i, field="role",
                message=f"Invalid role '{role}'. Expected: {sorted(VALID_PERSON_ROLES)}"))
            continue

        valid.append({
            "first_name": first,
            "last_name": last,
            "alias": row.get("alias", "") or None,
            "nationality": row.get("nationality", "") or None,
            "address": row.get("address", "") or None,
            "phone": row.get("contact", "") or row.get("phone", "") or None,
            "occupation": row.get("occupation", "") or None,
            "notes": row.get("notes", "") or "SYNTHETIC — Imported",
            "role": role,
            "case_ref": row.get("case_id", "") or row.get("case_title", "") or None,
            "_row": i,
        })

    preview = ImportSheetPreview(
        sheet="persons",
        valid_rows=len(valid),
        invalid_rows=len(errors),
        duplicate_rows=0,
        errors=errors,
    )
    return valid, preview


def parse_relationships_sheet(rows: List[Dict]) -> Tuple[List[Dict], ImportSheetPreview]:
    """Validate and parse relationship rows."""
    valid = []
    errors = []

    for i, row in enumerate(rows[:MAX_ROWS_PER_SHEET], start=2):
        rel_type = (row.get("relationship_type", "") or "ASSOCIATED_WITH").upper().strip()
        strength = (row.get("strength", "") or "MEDIUM").upper().strip()
        source = row.get("source_person_id", "") or row.get("source_id", "")
        target = row.get("target_person_id", "") or row.get("target_id", "")

        if not source or not target:
            errors.append(ImportRowError(row=i, message="source and target IDs required"))
            continue
        if rel_type not in VALID_REL_TYPES:
            errors.append(ImportRowError(row=i, field="relationship_type",
                message=f"Invalid type '{rel_type}'. Expected: {sorted(VALID_REL_TYPES)}"))
            continue
        if strength not in VALID_STRENGTHS:
            strength = "MEDIUM"

        valid.append({
            "source_type": "PERSON",
            "source_id": source,
            "target_type": "PERSON",
            "target_id": target,
            "relationship_type": rel_type,
            "strength": strength,
            "case_ref": row.get("case_id", "") or None,
            "_row": i,
        })

    preview = ImportSheetPreview(
        sheet="relationships",
        valid_rows=len(valid),
        invalid_rows=len(errors),
        duplicate_rows=0,
        errors=errors,
    )
    return valid, preview


def parse_events_sheet(rows: List[Dict]) -> Tuple[List[Dict], ImportSheetPreview]:
    """Validate and parse investigation event rows."""
    valid = []
    errors = []

    for i, row in enumerate(rows[:MAX_ROWS_PER_SHEET], start=2):
        title = row.get("title", "") or row.get("description", "")
        if not title:
            errors.append(ImportRowError(row=i, message="Event title/description required"))
            continue

        event_type = (row.get("event_type", "INVESTIGATION_NOTE")).upper().strip()
        event_date = _parse_date(row.get("event_date", "") or "")

        valid.append({
            "event_type": event_type[:100],
            "title": title[:500],
            "description": row.get("description", "") or None,
            "occurred_at": event_date,
            "case_ref": row.get("case_id", "") or None,
            "_row": i,
        })

    preview = ImportSheetPreview(
        sheet="events",
        valid_rows=len(valid),
        invalid_rows=len(errors),
        duplicate_rows=0,
        errors=errors,
    )
    return valid, preview


def _sheet_to_rows(ws) -> List[Dict]:
    """Convert openpyxl worksheet to list of sanitized dicts."""
    rows_iter = ws.iter_rows(values_only=True)
    headers_raw = next(rows_iter, None)
    if not headers_raw:
        return []
    headers = [_sanitize_cell(h).lower().replace(" ", "_") for h in headers_raw]
    result = []
    for row in rows_iter:
        d = {}
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else None
            d[h] = _sanitize_cell(val)
        result.append(d)
    return result


def _csv_to_rows(content: bytes) -> List[Dict]:
    """Parse CSV bytes to list of sanitized dicts."""
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        rows.append({k.strip().lower().replace(" ", "_"): _sanitize_cell(v)
                     for k, v in row.items()})
    return rows


def parse_import_file(
    content: bytes, filename: str
) -> Dict[str, Any]:
    """
    Parse an XLSX or CSV file and return structured data.
    Returns dict with keys: cases_rows, persons_rows, relationships_rows, events_rows, sheets_found
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    sheets_found = []
    cases_rows = persons_rows = relationships_rows = events_rows = []

    if ext in ("xlsx", "xls"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception as e:
            raise ValueError(f"Cannot read Excel file: {e}")

        sheet_names = [s.lower() for s in wb.sheetnames]
        sheets_found = list(wb.sheetnames)

        for sname in wb.sheetnames:
            sl = sname.lower()
            ws = wb[sname]
            rows = _sheet_to_rows(ws)
            if "case" in sl:
                cases_rows = rows
            elif "person" in sl:
                persons_rows = rows
            elif "relation" in sl:
                relationships_rows = rows
            elif "event" in sl or "investigat" in sl:
                events_rows = rows

        # If only one sheet, treat it as cases
        if not cases_rows and len(wb.sheetnames) == 1:
            cases_rows = _sheet_to_rows(wb[wb.sheetnames[0]])

        wb.close()

    elif ext == "csv":
        sheets_found = ["CSV Import"]
        cases_rows = _csv_to_rows(content)

    else:
        raise ValueError(f"Unsupported file format: .{ext}. Use .xlsx or .csv")

    return {
        "cases_rows": cases_rows,
        "persons_rows": persons_rows,
        "relationships_rows": relationships_rows,
        "events_rows": events_rows,
        "sheets_found": sheets_found,
    }

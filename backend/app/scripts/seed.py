"""
CrimeLink Database Seed Script
────────────────────────────────
Creates demo users, roles, permissions, and synthetic investigation data.

Run with:
    cd backend
    python -m app.scripts.seed

IMPORTANT:
- Uses SEED_DEFAULT_PASSWORD from environment
- All personal data is SYNTHETIC — no real individuals
- Clearly labelled as demo environment
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.core.security import hash_password, validate_password_strength
from app.models.user import User, Role, Permission, RolePermission, UserRole
from app.models.case import Case, CaseAssignment
from app.models.person import Person, CasePerson
from app.models.evidence import Evidence, EvidenceCustody
from app.models.investigation import InvestigationEvent
from app.models.relationship import Relationship
from app.models.audit import AuditLog
from app.models.security_event import SecurityEvent
from app.models import *  # noqa — ensure all models registered

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SEED_PASSWORD = os.environ.get("SEED_DEFAULT_PASSWORD", "")

# ── Permission definitions ──────────────────────────────────────────────────
ALL_PERMISSIONS = [
    ("CASE_CREATE", "Create new investigation cases"),
    ("CASE_READ", "View investigation cases"),
    ("CASE_UPDATE", "Update case details"),
    ("CASE_DELETE", "Delete cases"),
    ("CASE_ASSIGN", "Assign officers to cases"),
    ("PERSON_CREATE", "Create person records"),
    ("PERSON_READ", "View person records"),
    ("PERSON_UPDATE", "Update person records"),
    ("EVIDENCE_UPLOAD", "Upload evidence files"),
    ("EVIDENCE_READ", "View evidence"),
    ("EVIDENCE_DOWNLOAD", "Download evidence files"),
    ("EVIDENCE_TRANSFER", "Transfer evidence custody"),
    ("AUDIT_READ", "View audit logs"),
    ("SECURITY_READ", "View security events"),
    ("USER_MANAGE", "Manage user accounts"),
    ("REPORT_GENERATE", "Generate investigation reports"),
]

# ── Role-permission mapping ──────────────────────────────────────────────────
ROLE_PERMISSIONS = {
    "SUPER_ADMIN": [p[0] for p in ALL_PERMISSIONS],
    "CASE_SUPERVISOR": [
        "CASE_CREATE", "CASE_READ", "CASE_UPDATE", "CASE_ASSIGN",
        "PERSON_CREATE", "PERSON_READ", "PERSON_UPDATE",
        "EVIDENCE_READ", "EVIDENCE_DOWNLOAD", "EVIDENCE_TRANSFER",
        "AUDIT_READ", "REPORT_GENERATE",
    ],
    "INVESTIGATION_OFFICER": [
        "CASE_CREATE", "CASE_READ", "CASE_UPDATE",
        "PERSON_CREATE", "PERSON_READ", "PERSON_UPDATE",
        "EVIDENCE_UPLOAD", "EVIDENCE_READ", "EVIDENCE_DOWNLOAD",
        "REPORT_GENERATE",
    ],
    "EVIDENCE_OFFICER": [
        "CASE_READ", "PERSON_READ",
        "EVIDENCE_UPLOAD", "EVIDENCE_READ", "EVIDENCE_DOWNLOAD", "EVIDENCE_TRANSFER",
    ],
    "VIEWER_AUDITOR": [
        "CASE_READ", "PERSON_READ", "EVIDENCE_READ",
        "AUDIT_READ", "SECURITY_READ",
    ],
}

# ── Demo users ────────────────────────────────────────────────────────────────
DEMO_USERS = [
    {
        "username": "superadmin",
        "email": "superadmin@crimelink.demo",
        "full_name": "System Administrator",
        "badge_number": "ADMIN-001",
        "department": "IT Administration",
        "roles": ["SUPER_ADMIN"],
    },
    {
        "username": "supervisor",
        "email": "supervisor@crimelink.demo",
        "full_name": "Sarah Mitchell",
        "badge_number": "SUP-001",
        "department": "Criminal Investigation Division",
        "roles": ["CASE_SUPERVISOR"],
    },
    {
        "username": "officer",
        "email": "officer@crimelink.demo",
        "full_name": "James Harrington",
        "badge_number": "OFF-001",
        "department": "Criminal Investigation Division",
        "roles": ["INVESTIGATION_OFFICER"],
    },
    {
        "username": "evidence_officer",
        "email": "evidence@crimelink.demo",
        "full_name": "Priya Sharma",
        "badge_number": "EVO-001",
        "department": "Evidence Management Unit",
        "roles": ["EVIDENCE_OFFICER"],
    },
    {
        "username": "auditor",
        "email": "auditor@crimelink.demo",
        "full_name": "Robert Chen",
        "badge_number": "AUD-001",
        "department": "Internal Affairs",
        "roles": ["VIEWER_AUDITOR"],
    },
]


async def seed(db: AsyncSession) -> None:
    print("\n🔐 CRIMELINK SEED SCRIPT — SYNTHETIC DATA ONLY")
    print("=" * 60)

    if not SEED_PASSWORD:
        print("❌ SEED_DEFAULT_PASSWORD is not set in .env")
        print("   Set it to a password of at least 12 characters.")
        sys.exit(1)

    is_valid, error = validate_password_strength(SEED_PASSWORD)
    if not is_valid:
        print(f"❌ SEED_DEFAULT_PASSWORD is too weak: {error}")
        sys.exit(1)

    # ── 1. Create Permissions ─────────────────────────────────────────────
    print("\n[1/7] Creating permissions...")
    permission_map: dict[str, Permission] = {}
    for perm_name, perm_desc in ALL_PERMISSIONS:
        existing = (await db.execute(
            select(Permission).where(Permission.name == perm_name)
        )).scalar_one_or_none()
        if not existing:
            p = Permission(name=perm_name, description=perm_desc)
            db.add(p)
            await db.flush()
            permission_map[perm_name] = p
            print(f"  ✓ {perm_name}")
        else:
            permission_map[perm_name] = existing
    await db.commit()

    # ── 2. Create Roles ───────────────────────────────────────────────────
    print("\n[2/7] Creating roles...")
    role_map: dict[str, Role] = {}
    for role_name, perms in ROLE_PERMISSIONS.items():
        existing = (await db.execute(
            select(Role).where(Role.name == role_name)
        )).scalar_one_or_none()
        if not existing:
            role = Role(name=role_name, description=f"{role_name} role")
            db.add(role)
            await db.flush()
            for perm_name in perms:
                if perm_name in permission_map:
                    db.add(RolePermission(
                        role_id=role.id,
                        permission_id=permission_map[perm_name].id,
                    ))
            role_map[role_name] = role
            print(f"  ✓ {role_name} ({len(perms)} permissions)")
        else:
            role_map[role_name] = existing
    await db.commit()

    # ── 3. Create Demo Users ──────────────────────────────────────────────
    print("\n[3/7] Creating demo users...")
    user_map: dict[str, User] = {}
    password_hash = hash_password(SEED_PASSWORD)

    for ud in DEMO_USERS:
        existing = (await db.execute(
            select(User).where(User.username == ud["username"])
        )).scalar_one_or_none()
        if not existing:
            user = User(
                username=ud["username"],
                email=ud["email"],
                password_hash=password_hash,
                full_name=ud["full_name"],
                badge_number=ud["badge_number"],
                department=ud["department"],
            )
            db.add(user)
            await db.flush()

            for role_name in ud["roles"]:
                if role_name in role_map:
                    db.add(UserRole(
                        user_id=user.id,
                        role_id=role_map[role_name].id,
                    ))

            user_map[ud["username"]] = user
            print(f"  ✓ {ud['username']} ({', '.join(ud['roles'])})")
        else:
            user_map[ud["username"]] = existing
            print(f"  ↩ {ud['username']} (already exists)")
    await db.commit()

    # Reload users for foreign keys
    for username in list(user_map.keys()):
        result = await db.execute(select(User).where(User.username == username))
        user_map[username] = result.scalar_one()

    officer = user_map["officer"]
    supervisor = user_map["supervisor"]
    evidence_officer = user_map["evidence_officer"]

    # ── 4. Create Synthetic Persons ───────────────────────────────────────
    print("\n[4/7] Creating synthetic persons...")

    synthetic_persons = [
        # CASE-2026-001 suspects
        {
            "first_name": "Marcus", "last_name": "Webb",
            "alias": "Marky", "date_of_birth": "1988-03-15",
            "gender": "Male", "nationality": "Synthetic",
            "address": "12 Northgate Street, Synthetic City",
            "phone": "555-0101", "occupation": "Unemployed",
            "notes": "SYNTHETIC DATA — Not a real person",
        },
        {
            "first_name": "Derek", "last_name": "Hollis",
            "alias": "D-Man", "date_of_birth": "1992-07-22",
            "gender": "Male", "nationality": "Synthetic",
            "address": "7 Riverside Ave, Synthetic City",
            "phone": "555-0102", "occupation": "Mechanic",
            "notes": "SYNTHETIC DATA — Not a real person",
        },
        {
            "first_name": "Lena", "last_name": "Vasquez",
            "alias": None, "date_of_birth": "1995-11-08",
            "gender": "Female", "nationality": "Synthetic",
            "address": "45 Park Road, Synthetic City",
            "phone": "555-0103", "occupation": "Shop assistant",
            "notes": "SYNTHETIC DATA — Not a real person",
        },
        # Victim
        {
            "first_name": "Thomas", "last_name": "Greene",
            "alias": None, "date_of_birth": "1975-05-30",
            "gender": "Male", "nationality": "Synthetic",
            "address": "88 Commerce St, Synthetic City",
            "phone": "555-0201", "occupation": "Store owner",
            "notes": "SYNTHETIC DATA — Not a real person",
        },
        # Witness
        {
            "first_name": "Angela", "last_name": "Morrow",
            "alias": None, "date_of_birth": "1982-09-14",
            "gender": "Female", "nationality": "Synthetic",
            "address": "23 Oak Lane, Synthetic City",
            "phone": "555-0301", "occupation": "Teacher",
            "notes": "SYNTHETIC DATA — Not a real person",
        },
    ]

    person_objs = []
    for pd in synthetic_persons:
        existing = (await db.execute(
            select(Person).where(
                Person.first_name == pd["first_name"],
                Person.last_name == pd["last_name"],
            )
        )).scalar_one_or_none()
        if not existing:
            from datetime import date
            dob = date.fromisoformat(pd["date_of_birth"]) if pd.get("date_of_birth") else None
            person = Person(
                first_name=pd["first_name"],
                last_name=pd["last_name"],
                alias=pd.get("alias"),
                date_of_birth=dob,
                gender=pd.get("gender"),
                nationality=pd.get("nationality"),
                address=pd.get("address"),
                phone=pd.get("phone"),
                occupation=pd.get("occupation"),
                notes=pd.get("notes"),
                created_by=officer.id,
            )
            db.add(person)
            await db.flush()
            person_objs.append(person)
            print(f"  ✓ {pd['first_name']} {pd['last_name']}")
        else:
            person_objs.append(existing)
            print(f"  ↩ {pd['first_name']} {pd['last_name']} (exists)")
    await db.commit()

    # ── 5. Create Cases ───────────────────────────────────────────────────
    print("\n[5/7] Creating synthetic cases...")

    # Previous cases for suspects (historical associations)
    prev_cases_data = [
        {
            "case_number": "CASE-2024-018",
            "title": "Northgate Convenience Store Robbery",
            "case_type": "ROBBERY",
            "description": "SYNTHETIC: Armed robbery at convenience store. Case closed.",
            "location": "Northgate Street, Synthetic City",
            "status": "CLOSED",
            "priority": "HIGH",
        },
        {
            "case_number": "CASE-2025-007",
            "title": "Riverside Burglary",
            "case_type": "BURGLARY",
            "description": "SYNTHETIC: Break-in at residential property.",
            "location": "Riverside Ave, Synthetic City",
            "status": "SOLVED",
            "priority": "MEDIUM",
        },
    ]

    historical_cases = []
    for cd in prev_cases_data:
        existing = (await db.execute(
            select(Case).where(Case.case_number == cd["case_number"])
        )).scalar_one_or_none()
        if not existing:
            c = Case(
                case_number=cd["case_number"],
                title=cd["title"],
                case_type=cd["case_type"],
                description=cd["description"],
                location=cd.get("location"),
                status=cd["status"],
                priority=cd["priority"],
                created_by=supervisor.id,
                incident_date=datetime.now(timezone.utc) - timedelta(days=365),
            )
            db.add(c)
            await db.flush()
            historical_cases.append(c)
            print(f"  ✓ {cd['case_number']} (historical)")
        else:
            historical_cases.append(existing)
    await db.commit()

    # Assign suspects to historical cases
    if person_objs and historical_cases:
        webb = person_objs[0]  # Marcus Webb
        hollis = person_objs[1]  # Derek Hollis

        for hcase in historical_cases:
            for person in [webb, hollis]:
                existing_cp = (await db.execute(
                    select(CasePerson).where(
                        CasePerson.case_id == hcase.id,
                        CasePerson.person_id == person.id,
                        CasePerson.role == "SUSPECT",
                    )
                )).scalar_one_or_none()
                if not existing_cp:
                    db.add(CasePerson(
                        case_id=hcase.id,
                        person_id=person.id,
                        role="SUSPECT",
                        added_by=officer.id,
                    ))
        await db.commit()

    # Main demo case: CASE-2026-001
    main_case_existing = (await db.execute(
        select(Case).where(Case.case_number == "CASE-2026-001")
    )).scalar_one_or_none()

    if not main_case_existing:
        main_case = Case(
            case_number="CASE-2026-001",
            title="Commerce Street Armed Robbery",
            case_type="ROBBERY",
            description=(
                "SYNTHETIC DATA: Armed robbery reported at Greene Electronics on Commerce Street. "
                "Perpetrators fled in an unidentified vehicle. CCTV footage collected as evidence."
            ),
            location="88 Commerce Street, Synthetic City",
            incident_date=datetime.now(timezone.utc) - timedelta(days=5),
            status="UNDER_INVESTIGATION",
            priority="HIGH",
            created_by=officer.id,
        )
        db.add(main_case)
        await db.flush()

        # Assign officers
        db.add(CaseAssignment(
            case_id=main_case.id,
            user_id=officer.id,
            role="LEAD_INVESTIGATOR",
            assigned_by=supervisor.id,
        ))
        db.add(CaseAssignment(
            case_id=main_case.id,
            user_id=supervisor.id,
            role="SUPERVISOR",
            assigned_by=supervisor.id,
        ))

        # Assign persons to case
        person_roles = [
            (person_objs[0], "SUSPECT"),   # Marcus Webb
            (person_objs[1], "SUSPECT"),   # Derek Hollis
            (person_objs[2], "SUSPECT"),   # Lena Vasquez
            (person_objs[3], "VICTIM"),    # Thomas Greene
            (person_objs[4], "WITNESS"),   # Angela Morrow
        ]
        for person, role in person_roles:
            db.add(CasePerson(
                case_id=main_case.id,
                person_id=person.id,
                role=role,
                added_by=officer.id,
            ))

        await db.commit()
        await db.refresh(main_case)
        print(f"  ✓ CASE-2026-001 (main demo case)")
    else:
        main_case = main_case_existing
        print(f"  ↩ CASE-2026-001 (already exists)")

    # ── 6. Create Synthetic Evidence Metadata ─────────────────────────────
    print("\n[6/7] Creating synthetic evidence metadata...")

    evidence_items_data = [
        {
            "evidence_number": "EVD-2026-001-001",
            "evidence_type": "DOCUMENT",
            "description": "SYNTHETIC: CCTV footage request form from Commerce Street camera",
            "original_filename": "cctv_request_form.pdf",
            "stored_filename": f"seed_evd_001_{uuid4().hex[:8]}.pdf",
            "mime_type": "application/pdf",
            "file_size": 245760,
            "sha256_hash": "a" * 64,  # Synthetic hash for seeded records
        },
        {
            "evidence_number": "EVD-2026-001-002",
            "evidence_type": "IMAGE",
            "description": "SYNTHETIC: Suspect photo from CCTV — Marcus Webb",
            "original_filename": "suspect_cctv_frame.jpg",
            "stored_filename": f"seed_evd_002_{uuid4().hex[:8]}.jpg",
            "mime_type": "image/jpeg",
            "file_size": 1048576,
            "sha256_hash": "b" * 64,
        },
        {
            "evidence_number": "EVD-2026-001-003",
            "evidence_type": "DOCUMENT",
            "description": "SYNTHETIC: Witness statement from Angela Morrow",
            "original_filename": "witness_statement_morrow.pdf",
            "stored_filename": f"seed_evd_003_{uuid4().hex[:8]}.pdf",
            "mime_type": "application/pdf",
            "file_size": 51200,
            "sha256_hash": "c" * 64,
        },
    ]

    evidence_objs = []
    for ed in evidence_items_data:
        existing_evd = (await db.execute(
            select(Evidence).where(Evidence.evidence_number == ed["evidence_number"])
        )).scalar_one_or_none()
        if not existing_evd:
            storage_path = str(Path("./evidence_storage") / ed["stored_filename"])
            evd = Evidence(
                case_id=main_case.id,
                evidence_number=ed["evidence_number"],
                evidence_type=ed["evidence_type"],
                description=ed["description"],
                original_filename=ed["original_filename"],
                stored_filename=ed["stored_filename"],
                storage_path=storage_path,
                mime_type=ed["mime_type"],
                file_size=ed["file_size"],
                sha256_hash=ed["sha256_hash"],
                status="ACTIVE",
                current_custodian=evidence_officer.id,
                uploaded_by=officer.id,
            )
            db.add(evd)
            await db.flush()

            # Initial custody record
            db.add(EvidenceCustody(
                evidence_id=evd.id,
                new_custodian=officer.id,
                transferred_by=officer.id,
                action="CREATED",
                remarks=f"Seeded: {ed['original_filename']}",
                sha256_at_transfer=ed["sha256_hash"],
            ))
            evidence_objs.append(evd)
            print(f"  ✓ {ed['evidence_number']}")
        else:
            evidence_objs.append(existing_evd)
            print(f"  ↩ {ed['evidence_number']} (exists)")
    await db.commit()

    # ── 7. Create Investigation Events & Relationships ─────────────────────
    print("\n[7/7] Creating timeline events and relationships...")

    timeline_events = [
        ("CASE_CREATED", "Case CASE-2026-001 opened", "Commerce Street armed robbery reported"),
        ("EVIDENCE_UPLOADED", "CCTV request form submitted", "Document evidence collected"),
        ("PERSON_ADDED", "Suspect identified: Marcus Webb", "Added as primary suspect based on CCTV"),
        ("PERSON_ADDED", "Suspect identified: Derek Hollis", "Added as secondary suspect"),
        ("WITNESS_INTERVIEWED", "Witness statement taken: Angela Morrow", "Eyewitness account recorded"),
        ("EVIDENCE_UPLOADED", "CCTV frame extracted", "Still image captured from footage"),
        ("PERSON_ADDED", "Victim Thomas Greene interviewed", "Store owner statement obtained"),
        ("STATUS_CHANGED", "Case status updated to UNDER_INVESTIGATION", "Active investigation commenced"),
    ]

    # Check if events already exist
    existing_events = (await db.execute(
        select(InvestigationEvent).where(InvestigationEvent.case_id == main_case.id)
    )).scalars().all()

    if not existing_events:
        base_time = main_case.created_at if main_case.created_at else datetime.now(timezone.utc)
        for i, (etype, title, desc) in enumerate(timeline_events):
            evt = InvestigationEvent(
                case_id=main_case.id,
                event_type=etype,
                title=title,
                description=desc,
                occurred_at=base_time + timedelta(hours=i * 2),
                created_by=officer.id,
            )
            db.add(evt)
        print(f"  ✓ {len(timeline_events)} timeline events")

    # Relationships
    if person_objs and len(person_objs) >= 2:
        webb = person_objs[0]
        hollis = person_objs[1]

        existing_rel = (await db.execute(
            select(Relationship).where(Relationship.case_id == main_case.id)
        )).scalars().all()

        if not existing_rel:
            db.add(Relationship(
                source_type="PERSON", source_id=webb.id,
                target_type="PERSON", target_id=hollis.id,
                relationship_type="ASSOCIATED_WITH",
                strength="STRONG",
                notes="SYNTHETIC: Known associates based on previous case records",
                case_id=main_case.id,
                created_by=officer.id,
            ))
            if len(person_objs) >= 3:
                vasquez = person_objs[2]
                db.add(Relationship(
                    source_type="PERSON", source_id=hollis.id,
                    target_type="PERSON", target_id=vasquez.id,
                    relationship_type="LINKED_TO",
                    strength="MEDIUM",
                    notes="SYNTHETIC: Known through common acquaintance",
                    case_id=main_case.id,
                    created_by=officer.id,
                ))
            print("  ✓ Relationships created")

    # Sample audit logs
    sample_audits = [
        ("LOGIN_SUCCESS", "SUCCESS", officer.id, officer.username, None, None),
        ("CASE_CREATED", "SUCCESS", officer.id, officer.username, "CASE", main_case.id),
        ("PERSON_CREATED", "SUCCESS", officer.id, officer.username, "PERSON", person_objs[0].id if person_objs else None),
        ("LOGIN_FAILED", "FAILURE", None, "unknown_user", None, None),
        ("EVIDENCE_UPLOADED", "SUCCESS", officer.id, officer.username, "EVIDENCE",
         evidence_objs[0].id if evidence_objs else None),
    ]
    for action, result, uid, uname, rtype, rid in sample_audits:
        db.add(AuditLog(
            user_id=uid,
            username=uname,
            action=action,
            result=result,
            resource_type=rtype,
            resource_id=str(rid) if rid else None,
            ip_address="127.0.0.1",
            details={"seeded": True},
        ))

    # Sample security events
    sample_security = [
        ("FAILED_LOGIN", "MEDIUM", "Failed login for unknown_user from 192.168.1.100"),
        ("FAILED_LOGIN", "MEDIUM", "Failed login for unknown_user from 192.168.1.100"),
        ("ACCOUNT_LOCKED", "HIGH", "Account locked: 5 consecutive failures for test_user"),
        ("FAILED_LOGIN", "LOW", "Single failed login attempt"),
    ]
    for etype, severity, desc in sample_security:
        db.add(SecurityEvent(
            event_type=etype,
            severity=severity,
            description=desc,
            ip_address="192.168.1.100",
            details={"seeded": True},
        ))

    await db.commit()

    print("\n" + "=" * 60)
    print("✅ SEED COMPLETE")
    print("=" * 60)
    print("\n📋 DEMO ACCOUNTS (use SEED_DEFAULT_PASSWORD for all):")
    print(f"   superadmin  →  SUPER_ADMIN")
    print(f"   supervisor  →  CASE_SUPERVISOR")
    print(f"   officer     →  INVESTIGATION_OFFICER")
    print(f"   evidence_officer → EVIDENCE_OFFICER")
    print(f"   auditor     →  VIEWER_AUDITOR")
    print("\n⚠️  ALL DATA IS SYNTHETIC — DEMO ENVIRONMENT ONLY")
    print("=" * 60)


async def main():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession,
                                         autocommit=False, autoflush=False,
                                         expire_on_commit=False)

    async with session_factory() as session:
        await seed(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

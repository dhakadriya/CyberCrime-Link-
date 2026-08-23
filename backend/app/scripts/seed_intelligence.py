"""
CrimeLink Intelligence — Rich Demo Seed
─────────────────────────────────────────
Creates a multi-layered synthetic investigation dataset designed to
demonstrate ALL intelligence features:
- Network analysis (communities, bridge nodes, influencers)
- Anomaly detection (hub nodes, cross-community bridges)
- Timeline reconstruction
- Geospatial intelligence
- NLP entity review
- Prioritization scoring

ALL DATA IS SYNTHETIC — no real individuals or events.

Run: python -m app.scripts.seed_intelligence
"""
import asyncio, os, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.core.security import hash_password
from app.models.user import User, Role, Permission, RolePermission, UserRole
from app.models.case import Case, CaseAssignment
from app.models.person import Person, CasePerson
from app.models.evidence import Evidence, EvidenceCustody
from app.models.investigation import InvestigationEvent
from app.models.relationship import Relationship
from app.models.audit import AuditLog
from app.models.security_event import SecurityEvent
from app.models.scoring import SuspectScore
import app.models  # noqa

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./crimelink.db")
PASSWORD     = os.environ.get("SEED_DEFAULT_PASSWORD", "CrimeLink@Demo2026!")

UTC = timezone.utc
NOW = datetime.now(UTC)
def dt(days_ago=0, hours_ago=0): return NOW - timedelta(days=days_ago, hours=hours_ago)


# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC PERSONS — 3 network communities + bridge nodes
# ─────────────────────────────────────────────────────────────────────────────
PERSONS = [
    # COMMUNITY A — Financial Fraud ring
    {"first_name":"Victor",   "last_name":"Holloway",  "alias":"V-Man",    "occupation":"Accountant",     "phone":"555-1001","address":"14 Merchant Lane, Synthfield",   "notes":"SYNTHETIC. Community A hub."},
    {"first_name":"Diana",    "last_name":"Cross",     "alias":"Di",       "occupation":"Broker",         "phone":"555-1002","address":"8 Finance Street, Synthfield",    "notes":"SYNTHETIC. Community A."},
    {"first_name":"Marcus",   "last_name":"Trent",     "alias":"Trent",    "occupation":"Courier",        "phone":"555-1003","address":"22 Old Road, Synthfield",         "notes":"SYNTHETIC. Community A."},
    {"first_name":"Olivia",   "last_name":"Fane",      "alias":"Olive",    "occupation":"Shell Director", "phone":"555-1004","address":"3 Corporate Ave, Synthfield",     "notes":"SYNTHETIC. Community A."},
    {"first_name":"Nathan",   "last_name":"Cross",     "alias":"Nate",     "occupation":"Accountant",     "phone":"555-1005","address":"8 Finance Street, Synthfield",    "notes":"SYNTHETIC. Diana's associate."},
    # COMMUNITY B — Drug trafficking network
    {"first_name":"Rashid",   "last_name":"Malik",     "alias":"The Chef", "occupation":"Unemployed",     "phone":"555-2001","address":"77 Harbour Road, Portview",       "notes":"SYNTHETIC. Community B hub."},
    {"first_name":"Carmen",   "last_name":"Vega",      "alias":"Carm",     "occupation":"Club Manager",   "phone":"555-2002","address":"Club Row, Portview",              "notes":"SYNTHETIC. Community B."},
    {"first_name":"Terry",    "last_name":"Kwan",      "alias":"T",        "occupation":"Driver",         "phone":"555-2003","address":"19 Dockside Lane, Portview",      "notes":"SYNTHETIC. Community B."},
    {"first_name":"Priya",    "last_name":"Nair",      "alias":None,       "occupation":"Pharmacist",     "phone":"555-2004","address":"42 Health Street, Portview",      "notes":"SYNTHETIC. Community B. WITNESS."},
    {"first_name":"Ben",      "last_name":"Okafor",    "alias":"BigBen",   "occupation":"Bouncer",        "phone":"555-2005","address":"Club Row, Portview",              "notes":"SYNTHETIC. Community B."},
    # COMMUNITY C — Robbery / violent crime
    {"first_name":"Jake",     "last_name":"Mercer",    "alias":"Jackhammer","occupation":"Mechanic",      "phone":"555-3001","address":"5 Garage Lane, Irontown",         "notes":"SYNTHETIC. Community C hub."},
    {"first_name":"Sienna",   "last_name":"Wells",     "alias":"Si",       "occupation":"Unemployed",     "phone":"555-3002","address":"12 Back Street, Irontown",        "notes":"SYNTHETIC. Community C."},
    {"first_name":"Dean",     "last_name":"Foster",    "alias":"Foz",      "occupation":"Mechanic",       "phone":"555-3003","address":"5 Garage Lane, Irontown",         "notes":"SYNTHETIC. Community C."},
    {"first_name":"Hana",     "last_name":"Yilmaz",    "alias":None,       "occupation":"Nurse",          "phone":"555-3004","address":"34 Park Ave, Irontown",           "notes":"SYNTHETIC. VICTIM."},
    {"first_name":"Leon",     "last_name":"Bryce",     "alias":"LB",       "occupation":"Unemployed",     "phone":"555-3005","address":"18 Mill Road, Irontown",          "notes":"SYNTHETIC. Community C."},
    # BRIDGE NODES — connect communities (investigative red flags)
    {"first_name":"Felix",    "last_name":"Durand",    "alias":"The Bridge","occupation":"Logistics Manager","phone":"555-4001","address":"1 Central Hub, Synthfield",  "notes":"SYNTHETIC. BRIDGE — connects A+B+C communities."},
    {"first_name":"Sofia",    "last_name":"Markov",    "alias":"Sof",      "occupation":"Solicitor",      "phone":"555-4002","address":"Legal Quarter, Synthfield",       "notes":"SYNTHETIC. BRIDGE — connects A+B."},
    # VICTIMS / WITNESSES
    {"first_name":"Alan",     "last_name":"Greenwood", "alias":None,       "occupation":"Shop Owner",     "phone":"555-5001","address":"88 Commerce St, Synthfield",     "notes":"SYNTHETIC. VICTIM — Case 001."},
    {"first_name":"Mary",     "last_name":"Singh",     "alias":None,       "occupation":"Teacher",        "phone":"555-5002","address":"School Lane, Portview",           "notes":"SYNTHETIC. WITNESS — Case 003."},
    {"first_name":"Daniel",   "last_name":"Cho",       "alias":None,       "occupation":"Accountant",     "phone":"555-5003","address":"27 High Street, Irontown",        "notes":"SYNTHETIC. VICTIM — Case 005."},
]

# ─────────────────────────────────────────────────────────────────────────────
# CASES — 8 interconnected investigation cases
# ─────────────────────────────────────────────────────────────────────────────
CASES_DATA = [
    {
        "case_number":"CASE-2026-001","title":"Commerce Street Armed Robbery",
        "case_type":"ROBBERY","priority":"HIGH","status":"UNDER_INVESTIGATION",
        "location":"88 Commerce Street, Synthfield",
        "incident_date": dt(days_ago=30),
        "description":"SYNTHETIC: Armed robbery at Greenwood Electronics. Three suspects. CCTV captured vehicle MP09XX1234.",
    },
    {
        "case_number":"CASE-2026-002","title":"Synthfield Financial Fraud Network",
        "case_type":"FRAUD","priority":"CRITICAL","status":"UNDER_INVESTIGATION",
        "location":"Finance District, Synthfield",
        "incident_date": dt(days_ago=60),
        "description":"SYNTHETIC: Complex financial fraud involving shell companies and fictitious invoicing. Est. ₹4.2M diverted.",
    },
    {
        "case_number":"CASE-2026-003","title":"Portview Drug Trafficking Operation",
        "case_type":"DRUG_TRAFFICKING","priority":"CRITICAL","status":"UNDER_INVESTIGATION",
        "location":"Harbour Road, Portview",
        "incident_date": dt(days_ago=45),
        "description":"SYNTHETIC: Coordinated drug supply network operating through Portview nightclub circuit.",
    },
    {
        "case_number":"CASE-2026-004","title":"Irontown Vehicle Theft Ring",
        "case_type":"BURGLARY","priority":"HIGH","status":"OPEN",
        "location":"Garage Lane, Irontown",
        "incident_date": dt(days_ago=15),
        "description":"SYNTHETIC: Organised vehicle theft using chop shop on Garage Lane. Six vehicles recovered.",
    },
    {
        "case_number":"CASE-2026-005","title":"Accountant Extortion Case",
        "case_type":"ASSAULT","priority":"MEDIUM","status":"OPEN",
        "location":"27 High Street, Irontown",
        "incident_date": dt(days_ago=7),
        "description":"SYNTHETIC: Daniel Cho (accountant) targeted after refusing to falsify records.",
    },
    {
        "case_number":"CASE-2026-006","title":"Cross-Border Money Movement",
        "case_type":"MONEY_LAUNDERING","priority":"CRITICAL","status":"UNDER_INVESTIGATION",
        "location":"Multiple — Synthfield/Portview",
        "incident_date": dt(days_ago=90),
        "description":"SYNTHETIC: Funds tracing across shell company accounts linked to Communities A and B.",
    },
    {
        "case_number":"CASE-2025-018","title":"Portview Club Assault (Historic)",
        "case_type":"ASSAULT","priority":"MEDIUM","status":"CLOSED",
        "location":"Club Row, Portview",
        "incident_date": dt(days_ago=400),
        "description":"SYNTHETIC: Closed assault case. Rashid Malik and Ben Okafor previously known to police.",
    },
    {
        "case_number":"CASE-2024-042","title":"Synthfield Tax Evasion (Historic)",
        "case_type":"FRAUD","priority":"LOW","status":"SOLVED",
        "location":"Finance District, Synthfield",
        "incident_date": dt(days_ago=730),
        "description":"SYNTHETIC: Solved tax evasion case. Victor Holloway previously investigated.",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# RELATIONSHIP GRAPH — 70+ edges across 3 communities + bridges
# ─────────────────────────────────────────────────────────────────────────────
# Defined as (source_name, rel_type, target_name, strength, notes)
REL_DEFS = [
    # Community A internal
    ("Victor Holloway",  "ASSOCIATED_WITH",  "Diana Cross",    "STRONG",  "Director-nominee relationship"),
    ("Victor Holloway",  "ASSOCIATED_WITH",  "Marcus Trent",   "STRONG",  "Regular contact — CDR match"),
    ("Victor Holloway",  "ASSOCIATED_WITH",  "Olivia Fane",    "STRONG",  "Shell company director link"),
    ("Diana Cross",      "ASSOCIATED_WITH",  "Nathan Cross",   "STRONG",  "Family member — same address"),
    ("Diana Cross",      "ASSOCIATED_WITH",  "Olivia Fane",    "MEDIUM",  "Financial transfer pattern"),
    ("Nathan Cross",     "LINKED_TO",        "Marcus Trent",   "MEDIUM",  "Phone contact"),
    ("Marcus Trent",     "ASSOCIATED_WITH",  "Olivia Fane",    "WEAK",    "Indirect financial link"),

    # Community B internal
    ("Rashid Malik",     "ASSOCIATED_WITH",  "Carmen Vega",    "STRONG",  "Business partnership — nightclub"),
    ("Rashid Malik",     "ASSOCIATED_WITH",  "Terry Kwan",     "STRONG",  "Regular driver contact"),
    ("Rashid Malik",     "ASSOCIATED_WITH",  "Ben Okafor",     "STRONG",  "Club security — direct report"),
    ("Carmen Vega",      "ASSOCIATED_WITH",  "Terry Kwan",     "MEDIUM",  "Logistics coordination"),
    ("Carmen Vega",      "ASSOCIATED_WITH",  "Ben Okafor",     "MEDIUM",  "Employment relationship"),
    ("Terry Kwan",       "LINKED_TO",        "Ben Okafor",     "WEAK",    "Occasional contact"),

    # Community C internal
    ("Jake Mercer",      "ASSOCIATED_WITH",  "Sienna Wells",   "STRONG",  "Known relationship"),
    ("Jake Mercer",      "ASSOCIATED_WITH",  "Dean Foster",    "STRONG",  "Same workplace"),
    ("Jake Mercer",      "ASSOCIATED_WITH",  "Leon Bryce",     "MEDIUM",  "Neighbourhood contact"),
    ("Sienna Wells",     "ASSOCIATED_WITH",  "Dean Foster",    "MEDIUM",  "Known associates"),
    ("Sienna Wells",     "LINKED_TO",        "Leon Bryce",     "MEDIUM",  "Phone contact pattern"),
    ("Dean Foster",      "LINKED_TO",        "Leon Bryce",     "WEAK",    "Indirect"),

    # Bridge Felix — connects all three communities (HIGH PRIORITY)
    ("Felix Durand",     "ASSOCIATED_WITH",  "Victor Holloway","STRONG",  "Logistics contracts"),
    ("Felix Durand",     "ASSOCIATED_WITH",  "Rashid Malik",   "STRONG",  "Supply chain contact"),
    ("Felix Durand",     "ASSOCIATED_WITH",  "Jake Mercer",    "STRONG",  "Vehicle sourcing"),
    ("Felix Durand",     "LINKED_TO",        "Sofia Markov",   "MEDIUM",  "Professional contact"),
    ("Felix Durand",     "LINKED_TO",        "Diana Cross",    "MEDIUM",  "Financial advisory"),
    ("Felix Durand",     "LINKED_TO",        "Carmen Vega",    "MEDIUM",  "Club logistics"),

    # Bridge Sofia — connects A+B
    ("Sofia Markov",     "ASSOCIATED_WITH",  "Victor Holloway","MEDIUM",  "Legal representation"),
    ("Sofia Markov",     "ASSOCIATED_WITH",  "Rashid Malik",   "MEDIUM",  "Legal consultation"),
    ("Sofia Markov",     "LINKED_TO",        "Diana Cross",    "MEDIUM",  "Solicitor-client"),
    ("Sofia Markov",     "LINKED_TO",        "Carmen Vega",    "WEAK",    "Introduced through Felix"),

    # Cross-community connections
    ("Victor Holloway",  "LINKED_TO",        "Rashid Malik",   "WEAK",    "Indirect financial link"),
    ("Marcus Trent",     "LINKED_TO",        "Terry Kwan",     "MEDIUM",  "Courier overlap"),
    ("Olivia Fane",      "LINKED_TO",        "Carmen Vega",    "WEAK",    "Business contact"),
    ("Jake Mercer",      "LINKED_TO",        "Marcus Trent",   "MEDIUM",  "Vehicle related contact"),
    ("Leon Bryce",       "LINKED_TO",        "Ben Okafor",     "WEAK",    "Neighbourhood"),

    # Victim/witness connections
    ("Jake Mercer",      "WITNESS_TO",       "Alan Greenwood", "STRONG",  "Robbery suspect vs victim"),
    ("Sienna Wells",     "WITNESS_TO",       "Alan Greenwood", "MEDIUM",  "Identified at scene"),
    ("Priya Nair",       "WITNESS_TO",       "Mary Singh",     "MEDIUM",  "Both witnesses — Case 003"),
    ("Jake Mercer",      "LINKED_TO",        "Hana Yilmaz",    "STRONG",  "Assault case"),
    ("Victor Holloway",  "LINKED_TO",        "Daniel Cho",     "STRONG",  "Extortion — refused falsification"),
    ("Marcus Trent",     "LINKED_TO",        "Daniel Cho",     "MEDIUM",  "Messenger role"),
]

# Evidence metadata (no real files — metadata only for demo)
EVIDENCE_DEFS = [
    ("CASE-2026-001", "IMAGE",    "CCTV still frame — suspect vehicle MP09XX1234",   "cctv_vehicle_001.jpg"),
    ("CASE-2026-001", "DOCUMENT", "FIR — Alan Greenwood complaint",                   "fir_001_greenwood.pdf"),
    ("CASE-2026-001", "AUDIO",    "Emergency call recording",                          "999_call_20260801.mp3"),
    ("CASE-2026-002", "DOCUMENT", "Shell company incorporation records",               "shell_co_victor.pdf"),
    ("CASE-2026-002", "DOCUMENT", "Bank transaction ledger — Holloway account",        "ledger_holloway.xlsx"),
    ("CASE-2026-002", "DOCUMENT", "Fake invoices recovered — 127 documents",           "invoices_batch.zip"),
    ("CASE-2026-003", "IMAGE",    "Surveillance photo — Rashid Malik at harbour",      "surveillance_malik.jpg"),
    ("CASE-2026-003", "DOCUMENT", "CDR extract — Rashid Malik 90 days",                "cdr_malik_90d.csv"),
    ("CASE-2026-004", "DOCUMENT", "Vehicle registration intercept — 6 plates",         "vehicle_plates.pdf"),
    ("CASE-2026-004", "IMAGE",    "Chop shop aerial photograph",                        "aerial_garage.jpg"),
    ("CASE-2026-005", "DOCUMENT", "Medical report — Daniel Cho injuries",              "medical_cho.pdf"),
    ("CASE-2026-006", "DOCUMENT", "Financial intelligence report — cross-border flow", "fin_intel_001.pdf"),
]


async def seed(db: AsyncSession):
    print("\n🔬 CrimeLink Intelligence — Rich Demo Seed")
    print("="*60)

    # ── Existing roles/permissions (required) ──────────────────────────
    from app.models.user import Permission as Perm, Role, RolePermission, UserRole

    ALL_PERMS = [
        ("CASE_CREATE","Create cases"),("CASE_READ","View cases"),
        ("CASE_UPDATE","Update cases"),("CASE_DELETE","Delete cases"),
        ("CASE_ASSIGN","Assign officers"),
        ("PERSON_CREATE","Create persons"),("PERSON_READ","View persons"),
        ("PERSON_UPDATE","Update persons"),
        ("EVIDENCE_UPLOAD","Upload evidence"),("EVIDENCE_READ","View evidence"),
        ("EVIDENCE_DOWNLOAD","Download evidence"),("EVIDENCE_TRANSFER","Transfer evidence"),
        ("AUDIT_READ","View audit logs"),("SECURITY_READ","View security"),
        ("USER_MANAGE","Manage users"),("REPORT_GENERATE","Generate reports"),
    ]
    pmap: dict = {}
    for name, desc in ALL_PERMS:
        ex = (await db.execute(select(Perm).where(Perm.name==name))).scalar_one_or_none()
        if not ex:
            ex = Perm(name=name, description=desc); db.add(ex); await db.flush()
        pmap[name] = ex

    ROLE_PERMS = {
        "SUPER_ADMIN":           [p for p in pmap.keys()],
        "CASE_SUPERVISOR":       ["CASE_CREATE","CASE_READ","CASE_UPDATE","CASE_ASSIGN","PERSON_CREATE","PERSON_READ","PERSON_UPDATE","EVIDENCE_READ","EVIDENCE_DOWNLOAD","EVIDENCE_TRANSFER","AUDIT_READ","REPORT_GENERATE"],
        "INVESTIGATION_OFFICER": ["CASE_CREATE","CASE_READ","CASE_UPDATE","PERSON_CREATE","PERSON_READ","PERSON_UPDATE","EVIDENCE_UPLOAD","EVIDENCE_READ","EVIDENCE_DOWNLOAD","REPORT_GENERATE"],
        "EVIDENCE_OFFICER":      ["CASE_READ","PERSON_READ","EVIDENCE_UPLOAD","EVIDENCE_READ","EVIDENCE_DOWNLOAD","EVIDENCE_TRANSFER"],
        "VIEWER_AUDITOR":        ["CASE_READ","PERSON_READ","EVIDENCE_READ","AUDIT_READ","SECURITY_READ"],
    }
    rmap: dict = {}
    for rname, rperms in ROLE_PERMS.items():
        ex = (await db.execute(select(Role).where(Role.name==rname))).scalar_one_or_none()
        if not ex:
            ex = Role(name=rname, description=rname); db.add(ex); await db.flush()
        rmap[rname] = ex
        for pname in rperms:
            p = pmap.get(pname)
            if p:
                exists = (await db.execute(select(RolePermission).where(
                    RolePermission.role_id==ex.id, RolePermission.permission_id==p.id
                ))).scalar_one_or_none()
                if not exists:
                    db.add(RolePermission(role_id=ex.id, permission_id=p.id))

    await db.commit()
    print("[1/7] Roles & permissions OK")

    # ── Demo users ──────────────────────────────────────────────────────
    USERS = [
        {"username":"superadmin","email":"superadmin@crimelink.demo","full_name":"System Administrator","badge":"ADMIN-001","dept":"IT Administration","roles":["SUPER_ADMIN"]},
        {"username":"supervisor","email":"supervisor@crimelink.demo","full_name":"Sarah Mitchell","badge":"SUP-001","dept":"Criminal Investigation Division","roles":["CASE_SUPERVISOR"]},
        {"username":"officer","email":"officer@crimelink.demo","full_name":"James Harrington","badge":"OFF-001","dept":"Criminal Investigation Division","roles":["INVESTIGATION_OFFICER"]},
        {"username":"evidence_officer","email":"evidence@crimelink.demo","full_name":"Priya Sharma","badge":"EVO-001","dept":"Evidence Management Unit","roles":["EVIDENCE_OFFICER"]},
        {"username":"auditor","email":"auditor@crimelink.demo","full_name":"Robert Chen","badge":"AUD-001","dept":"Internal Affairs","roles":["VIEWER_AUDITOR"]},
    ]
    umap: dict = {}
    phash = hash_password(PASSWORD)
    for ud in USERS:
        ex = (await db.execute(select(User).where(User.username==ud["username"]))).scalar_one_or_none()
        if not ex:
            ex = User(username=ud["username"],email=ud["email"],password_hash=phash,
                      full_name=ud["full_name"],badge_number=ud["badge"],department=ud["dept"])
            db.add(ex); await db.flush()
            for rn in ud["roles"]:
                r = rmap.get(rn)
                if r: db.add(UserRole(user_id=ex.id, role_id=r.id))
        umap[ud["username"]] = ex
    await db.commit()
    # reload
    for un in umap: umap[un] = (await db.execute(select(User).where(User.username==un))).scalar_one()
    print(f"[2/7] {len(umap)} demo users OK")

    officer_id = umap["officer"].id
    sup_id     = umap["supervisor"].id

    # ── Persons ─────────────────────────────────────────────────────────
    pobj: dict = {}
    created_persons = 0
    for pd in PERSONS:
        full = f"{pd['first_name']} {pd['last_name']}"
        ex = (await db.execute(select(Person).where(
            Person.first_name==pd["first_name"], Person.last_name==pd["last_name"]
        ))).scalar_one_or_none()
        if not ex:
            ex = Person(
                first_name=pd["first_name"], last_name=pd["last_name"],
                alias=pd.get("alias"), phone=pd.get("phone"),
                address=pd.get("address"), occupation=pd.get("occupation"),
                notes=pd.get("notes","SYNTHETIC"),
                nationality="Synthetic",
                created_by=officer_id,
            )
            db.add(ex); await db.flush()
            created_persons += 1
        pobj[full] = ex
    await db.commit()
    print(f"[3/7] {len(pobj)} persons ({created_persons} new)")

    # ── Cases ────────────────────────────────────────────────────────────
    cobj: dict = {}
    created_cases = 0
    for cd in CASES_DATA:
        ex = (await db.execute(select(Case).where(Case.case_number==cd["case_number"]))).scalar_one_or_none()
        if not ex:
            ex = Case(
                case_number=cd["case_number"], title=cd["title"],
                case_type=cd["case_type"], priority=cd["priority"],
                status=cd["status"], location=cd.get("location"),
                incident_date=cd.get("incident_date"),
                description=cd.get("description","SYNTHETIC"),
                created_by=officer_id,
            )
            db.add(ex); await db.flush()
            db.add(CaseAssignment(case_id=ex.id, user_id=officer_id, role="LEAD_INVESTIGATOR", assigned_by=sup_id))
            db.add(CaseAssignment(case_id=ex.id, user_id=sup_id, role="SUPERVISOR", assigned_by=sup_id))
            db.add(InvestigationEvent(
                case_id=ex.id, event_type="CASE_CREATED",
                title=f"Case {cd['case_number']} opened",
                description=f"Investigation opened — {cd['title']}",
                created_by=officer_id,
            ))
            created_cases += 1
        cobj[cd["case_number"]] = ex
    await db.commit()
    print(f"[4/7] {len(cobj)} cases ({created_cases} new)")

    # ── Case-Person assignments ──────────────────────────────────────────
    CASE_PERSONS = [
        # Case 001 — Robbery
        ("CASE-2026-001","Jake Mercer",     "SUSPECT"),
        ("CASE-2026-001","Sienna Wells",    "SUSPECT"),
        ("CASE-2026-001","Leon Bryce",      "SUSPECT"),
        ("CASE-2026-001","Alan Greenwood",  "VICTIM"),
        ("CASE-2026-001","Mary Singh",      "WITNESS"),
        # Case 002 — Fraud
        ("CASE-2026-002","Victor Holloway", "SUSPECT"),
        ("CASE-2026-002","Diana Cross",     "SUSPECT"),
        ("CASE-2026-002","Olivia Fane",     "SUSPECT"),
        ("CASE-2026-002","Nathan Cross",    "SUSPECT"),
        ("CASE-2026-002","Sofia Markov",    "SUSPECT"),
        # Case 003 — Drugs
        ("CASE-2026-003","Rashid Malik",    "SUSPECT"),
        ("CASE-2026-003","Carmen Vega",     "SUSPECT"),
        ("CASE-2026-003","Terry Kwan",      "SUSPECT"),
        ("CASE-2026-003","Ben Okafor",      "SUSPECT"),
        ("CASE-2026-003","Priya Nair",      "WITNESS"),
        # Case 004 — Vehicle theft
        ("CASE-2026-004","Jake Mercer",     "SUSPECT"),
        ("CASE-2026-004","Dean Foster",     "SUSPECT"),
        ("CASE-2026-004","Marcus Trent",    "SUSPECT"),
        # Case 005 — Extortion
        ("CASE-2026-005","Victor Holloway", "SUSPECT"),
        ("CASE-2026-005","Marcus Trent",    "SUSPECT"),
        ("CASE-2026-005","Daniel Cho",      "VICTIM"),
        # Case 006 — Money laundering
        ("CASE-2026-006","Felix Durand",    "SUSPECT"),
        ("CASE-2026-006","Victor Holloway", "SUSPECT"),
        ("CASE-2026-006","Rashid Malik",    "SUSPECT"),
        ("CASE-2026-006","Sofia Markov",    "SUSPECT"),
        # Historical
        ("CASE-2025-018","Rashid Malik",    "SUSPECT"),
        ("CASE-2025-018","Ben Okafor",      "SUSPECT"),
        ("CASE-2025-018","Hana Yilmaz",     "VICTIM"),
        ("CASE-2024-042","Victor Holloway", "SUSPECT"),
        ("CASE-2024-042","Diana Cross",     "SUSPECT"),
    ]
    cp_added = 0
    for cnum, pname, role in CASE_PERSONS:
        case = cobj.get(cnum)
        person = pobj.get(pname)
        if not case or not person: continue
        ex = (await db.execute(select(CasePerson).where(
            CasePerson.case_id==case.id, CasePerson.person_id==person.id, CasePerson.role==role
        ))).scalar_one_or_none()
        if not ex:
            db.add(CasePerson(case_id=case.id, person_id=person.id, role=role, added_by=officer_id))
            cp_added += 1
    await db.commit()
    print(f"[5/7] {cp_added} case-person links added")

    # ── Relationships (the intelligence graph) ───────────────────────────
    # Find the main case for relationship context
    main_case = cobj.get("CASE-2026-006") or cobj.get("CASE-2026-001")
    rel_added = 0
    for src_name, rel_type, tgt_name, strength, notes in REL_DEFS:
        src = pobj.get(src_name)
        tgt = pobj.get(tgt_name)
        if not src or not tgt: continue
        ex = (await db.execute(select(Relationship).where(
            Relationship.source_id==src.id, Relationship.target_id==tgt.id,
            Relationship.relationship_type==rel_type,
        ))).scalar_one_or_none()
        if not ex:
            # Assign to the most relevant case
            case_id = main_case.id if main_case else None
            # find a more specific case
            for cnum, pname, _ in CASE_PERSONS:
                if pname == src_name and cnum in cobj:
                    case_id = cobj[cnum].id
                    break
            db.add(Relationship(
                source_type="PERSON", source_id=src.id,
                target_type="PERSON", target_id=tgt.id,
                relationship_type=rel_type, strength=strength,
                notes=f"SYNTHETIC: {notes}", case_id=case_id,
                created_by=officer_id,
            ))
            rel_added += 1
    await db.commit()
    print(f"[6/7] {rel_added} relationships created")

    # ── Evidence metadata + Investigation events ─────────────────────────
    evd_added = 0
    from uuid import uuid4
    import hashlib
    for cnum, etype, desc, fname in EVIDENCE_DEFS:
        case = cobj.get(cnum)
        if not case: continue
        ex = (await db.execute(select(Evidence).where(
            Evidence.case_id==case.id, Evidence.description==desc
        ))).scalar_one_or_none()
        if not ex:
            stored = f"seed_{uuid4().hex[:12]}_{fname}"
            fake_hash = hashlib.sha256(f"{cnum}{fname}".encode()).hexdigest()
            evid = Evidence(
                case_id=case.id,
                evidence_number=f"EVD-{cnum[5:]}-{evd_added+1:03d}",
                evidence_type=etype, description=desc,
                original_filename=fname, stored_filename=stored,
                storage_path=f"./evidence_storage/{stored}",
                mime_type={"IMAGE":"image/jpeg","DOCUMENT":"application/pdf",
                           "AUDIO":"audio/mpeg","VIDEO":"video/mp4"}.get(etype,"application/octet-stream"),
                file_size=102400 + evd_added * 51200,
                sha256_hash=fake_hash,
                status="ACTIVE",
                current_custodian=umap["evidence_officer"].id,
                uploaded_by=officer_id,
            )
            db.add(evid); await db.flush()
            db.add(EvidenceCustody(
                evidence_id=evid.id, new_custodian=officer_id,
                transferred_by=officer_id, action="CREATED",
                remarks=f"Seeded: {fname}", sha256_at_transfer=fake_hash,
            ))
            db.add(InvestigationEvent(
                case_id=case.id, event_type="EVIDENCE_UPLOADED",
                title=f"Evidence logged: {fname}",
                description=desc, created_by=officer_id,
                related_evidence=evid.id,
            ))
            evd_added += 1
    await db.commit()

    # Timeline events for main cases
    TIMELINE = [
        ("CASE-2026-001","WITNESS_INTERVIEWED",  "Witness statement — Mary Singh",    "Eyewitness account obtained. Corroborates CCTV timeline."),
        ("CASE-2026-001","EVIDENCE_COLLECTED",   "CCTV footage obtained",              "Footage from 3 cameras — 4h segment. Vehicle identified."),
        ("CASE-2026-001","STATUS_CHANGED",        "Case escalated to active investigation","Priority raised to HIGH following CCTV evidence."),
        ("CASE-2026-002","PERSON_IDENTIFIED",     "Victor Holloway identified as primary suspect","Bank records link Holloway to 4 shell companies."),
        ("CASE-2026-002","EVIDENCE_COLLECTED",    "Financial records seized",           "Court order obtained. 127 fake invoices recovered."),
        ("CASE-2026-003","SURVEILLANCE_STARTED",  "Surveillance operation commenced",   "24h observation of Harbour Road premises."),
        ("CASE-2026-003","PERSON_IDENTIFIED",     "Rashid Malik identified as network hub","CDR analysis reveals 340 calls to 23 contacts in 90 days."),
        ("CASE-2026-006","INVESTIGATION_NOTE",    "Felix Durand identified as network bridge","Appears in financial records for Cases 002, 003 and 004."),
        ("CASE-2026-006","INVESTIGATION_NOTE",    "Sofia Markov — legal representation review","Provided legal services to suspects across two cases."),
    ]
    ev_added = 0
    for cnum, etype, title, desc in TIMELINE:
        case = cobj.get(cnum)
        if not case: continue
        ex = (await db.execute(select(InvestigationEvent).where(
            InvestigationEvent.case_id==case.id, InvestigationEvent.title==title
        ))).scalar_one_or_none()
        if not ex:
            db.add(InvestigationEvent(
                case_id=case.id, event_type=etype,
                title=title, description=desc,
                occurred_at=dt(days_ago=len(TIMELINE)-ev_added),
                created_by=officer_id,
            ))
            ev_added += 1
    await db.commit()
    print(f"[7/7] {evd_added} evidence + {ev_added} timeline events added")

    # ── Audit + Security events ──────────────────────────────────────────
    AUDIT_EVENTS = [
        ("LOGIN_SUCCESS","SUCCESS","officer","CASE",None),
        ("CASE_CREATED","SUCCESS","officer","CASE",cobj.get("CASE-2026-001") and cobj["CASE-2026-001"].id),
        ("EVIDENCE_UPLOADED","SUCCESS","officer","EVIDENCE",None),
        ("CASE_ACCESSED","SUCCESS","supervisor","CASE",cobj.get("CASE-2026-002") and cobj["CASE-2026-002"].id),
        ("REPORT_GENERATED","SUCCESS","supervisor","CASE",None),
        ("LOGIN_FAILED","FAILURE",None,"AUTH",None),
        ("UNAUTHORIZED_ACCESS_ATTEMPT","DENIED","auditor","CASE",None),
        ("EVIDENCE_DOWNLOADED","SUCCESS","evidence_officer","EVIDENCE",None),
        ("GRAPH_ANALYSIS","SUCCESS","supervisor","NETWORK",None),
    ]
    for action, result, uname, rtype, rid in AUDIT_EVENTS:
        u = umap.get(uname) if uname else None
        db.add(AuditLog(
            user_id=u.id if u else None,
            username=uname or "unknown",
            action=action, result=result,
            resource_type=rtype,
            resource_id=str(rid) if rid else None,
            ip_address="127.0.0.1",
            details={"seeded": True},
        ))

    SEC_EVENTS = [
        ("FAILED_LOGIN","MEDIUM","Repeated failed login from 10.0.0.14"),
        ("UNAUTHORIZED_ACCESS_ATTEMPT","HIGH","Auditor attempted to access restricted case"),
        ("ACCOUNT_LOCKED","HIGH","Account locked: 5 consecutive failures for test_user"),
        ("SUSPICIOUS_QUERY","MEDIUM","Unusual graph traversal query detected"),
    ]
    for etype, sev, desc in SEC_EVENTS:
        db.add(SecurityEvent(event_type=etype, severity=sev, description=desc,
                             ip_address="10.0.0.14", details={"seeded":True}))

    await db.commit()

    print("\n" + "="*60)
    print("✅ INTELLIGENCE SEED COMPLETE")
    print(f"   Persons:       {len(pobj)}")
    print(f"   Cases:         {len(cobj)}")
    print(f"   Relationships: {rel_added}")
    print(f"   Evidence:      {evd_added}")
    print(f"   Network communities detected via NetworkX at runtime")
    print("\n⚠️  ALL DATA IS SYNTHETIC — DEMO ENVIRONMENT ONLY")
    print("="*60)


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession,
                                      autocommit=False, autoflush=False, expire_on_commit=False)
    async with SessionLocal() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

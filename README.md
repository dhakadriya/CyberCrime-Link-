# CrimeLink Intelligence
## AI-Powered Criminal Network Analysis & Investigator Intelligence Platform

> **DEMO ENVIRONMENT — SYNTHETIC INVESTIGATION DATA ONLY**
> No real criminal data is stored or processed.

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- `pip`, `npm`

### 1. Environment setup

```bash
cp .env.example .env
```

The `.env` file is pre-configured for SQLite (no PostgreSQL needed for dev):
```
DATABASE_URL=sqlite+aiosqlite:///./crimelink.db
JWT_SECRET=<already set in .env>
SEED_DEFAULT_PASSWORD=CrimeLink@Demo2026!
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
python -c "import asyncio; from app.core.database import create_all_tables; asyncio.run(create_all_tables())"
python -m app.scripts.seed_intelligence   # Rich demo data (20 persons, 8 cases, 40 relationships)
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/api/docs

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

---

## Demo Accounts

Password for all accounts: **`CrimeLink@Demo2026!`**

| Username | Role | Access |
|---|---|---|
| `superadmin` | SUPER_ADMIN | Full access to everything |
| `supervisor` | CASE_SUPERVISOR | Cases, persons, evidence, reports |
| `officer` | INVESTIGATION_OFFICER | Cases, persons, evidence, upload |
| `evidence_officer` | EVIDENCE_OFFICER | Evidence management only |
| `auditor` | VIEWER_AUDITOR | Read-only, audit logs, security |

---

## Feature Overview

### Navigation
| Section | Pages |
|---|---|
| Investigation | Dashboard, Cases, Persons, Entities, Evidence |
| Intelligence | Data Ingestion, Network Graph, Network Analysis, Communities, Anomalies, Timeline, Geospatial, Query Engine, Investigative Leads |
| Admin | Reports, Audit Logs, Security Events, User Management, Settings |

### Key Features
- **Network Graph** — Interactive ReactFlow visualization with community coloring
- **Network Analysis** — Degree/Betweenness/PageRank centrality with influencer detection
- **Community Detection** — Greedy modularity algorithm (4 communities in demo data)
- **Anomaly Detection** — Bridge nodes, high-degree nodes, community bridges
- **Data Ingestion** — XLSX/CSV bulk import + NLP text extraction (spaCy + regex)
- **Investigation Query** — Natural language intent detection → safe validated queries
- **Investigative Leads** — Auto-generated from network analysis, manageable workflow
- **Geospatial** — SVG map with case locations, person addresses, movement patterns
- **Evidence** — SHA-256 integrity verification, chain of custody
- **Reports** — Full JSON export of case investigation data
- **RBAC** — 5 roles, 16 permissions, server-side enforcement
- **Audit Logs** — Immutable append-only audit trail

### Demo Data (Synthetic)
- 20 persons in 3 network communities + bridge nodes
- 8 interconnected investigation cases
- 40 graph relationships
- 12 evidence items
- Bridge person: **Felix Durand** (connects all 3 communities)
- Top influencer: **Victor Holloway** (Community A hub)

---

## Docker (Full Stack)

```bash
docker compose up --build
docker compose exec backend python -m app.scripts.seed_intelligence
```

- Frontend: http://localhost:80
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

---

## Demo Workflow (5 minutes)

1. Login as `superadmin`
2. Dashboard → see 8 cases, 20 persons, 12 evidence items
3. Data Ingestion → NLP tab → paste: `"Felix Durand met Victor Holloway at Synthfield. Vehicle MP09XX1234. Phone 555-4001."`
4. Network Graph → select any case → see interactive relationship graph
5. Network Analysis → see Victor Holloway as top influencer
6. Communities → see 4 detected communities
7. Anomalies → see bridge node detection
8. Investigative Leads → click "Generate from Network" → see auto-detected leads
9. Query Engine → type: `"show network influencers"` or `"find Felix Durand"`
10. Reports → generate and download case report JSON
11. Audit Logs → see complete immutable activity trail

---

## Technical Stack

**Backend:** FastAPI · SQLAlchemy (async) · spaCy · NetworkX · Argon2id · JWT  
**Frontend:** React 18 · TypeScript · Tailwind CSS · ReactFlow · Recharts  
**Database:** PostgreSQL (prod) · SQLite (dev)  
**Security:** RBAC · Rate limiting · SHA-256 evidence hashing · Immutable audit logs

---

## Ethical Design

This platform is an **investigative decision-support tool**. It does NOT determine guilt.
- No protected characteristics used in any algorithm
- All scores include confidence levels and explicit limitations  
- Every result is explainable and traceable to source data
- Audit trail is immutable — no deletions permitted

"""
CrimeLink local dev startup script.
Creates tables, seeds data, then starts both servers.

Run from project root:
    python scripts/setup_and_run.py
"""
import asyncio
import os
import sys
import subprocess
import time

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Load .env
from dotenv import load_dotenv
load_dotenv()

async def setup():
    from app.core.database import create_all_tables, check_database_health
    from app.core.config import settings

    print(f"\n[1/3] Creating database tables ({settings.DATABASE_URL[:40]}...)...")
    await create_all_tables()
    ok = await check_database_health()
    print(f"      Database: {'OK' if ok else 'FAILED'}")

    print("\n[2/3] Seeding demo data...")
    from app.scripts.seed import seed
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await seed(session)

    print("\n[3/3] Ready to start servers")

if __name__ == "__main__":
    asyncio.run(setup())
    print("\n" + "="*60)
    print("SETUP COMPLETE")
    print("="*60)
    print("\nStart backend:  uvicorn app.main:app --reload --port 8000")
    print("Start frontend: npm run dev --prefix frontend")
    print("\nAPI docs:  http://localhost:8000/api/docs")
    print("Frontend:  http://localhost:5173")
    print("="*60)

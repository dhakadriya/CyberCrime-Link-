import sys, os
sys.path.insert(0, 'backend')
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./crimelink.db'
os.environ['JWT_SECRET'] = 'a' * 64

from app.main import app
routes = [(sorted(r.methods), r.path) for r in app.routes
          if hasattr(r, 'path') and hasattr(r, 'methods')]
for m, p in sorted(routes, key=lambda x: x[1]):
    print(f"  {str(m):<30} {p}")
print(f"\nTotal: {len(routes)}")

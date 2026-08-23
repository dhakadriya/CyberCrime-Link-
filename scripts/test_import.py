import sys, os
sys.path.insert(0, 'backend')
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./crimelink.db'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///./crimelink.db'
os.environ['JWT_SECRET'] = 'a' * 64

import app.models
print('models imported OK')

from app.main import app
routes = [r for r in app.routes if hasattr(r, 'path')]
print(f'app loaded OK — {len(routes)} routes registered')
print('IMPORT TEST PASSED')

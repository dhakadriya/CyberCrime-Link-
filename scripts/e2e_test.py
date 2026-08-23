"""Full end-to-end API test — run after both servers are up."""
import urllib.request
import urllib.error
import json
import sys

BASE = "http://localhost:8000"
PASS = []
FAIL = []


def get(url, token):
    req = urllib.request.Request(
        f"{BASE}{url}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return json.loads(urllib.request.urlopen(req).read())


def post(url, body, token):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{url}", data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    return json.loads(urllib.request.urlopen(req).read())


def check(name, fn):
    try:
        result = fn()
        PASS.append((name, result))
        print(f"  PASS  {name:<35}  {result}")
    except Exception as e:
        FAIL.append((name, str(e)))
        print(f"  FAIL  {name:<35}  {e}")


print("\n=== CrimeLink API End-to-End Test ===\n")

# --- Login ---
try:
    data = json.dumps({"username": "superadmin", "password": "CrimeLink@Demo2026!"}).encode()
    req = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    resp = json.loads(urllib.request.urlopen(req).read())
    token = resp["access_token"]
    print(f"  PASS  {'Login (superadmin)':<35}  roles={resp['roles']}")
    PASS.append(("Login", "OK"))
except Exception as e:
    print(f"  FAIL  Login: {e}")
    sys.exit(1)

# --- Health ---
check("Health check", lambda: json.loads(urllib.request.urlopen(f"{BASE}/health").read())["status"])

# --- Auth/me ---
check("Auth /me", lambda: get("/api/v1/auth/me", token)["username"])

# --- Dashboard ---
check("Dashboard stats", lambda: f"cases={get('/api/v1/dashboard/stats', token)['cases']['total']} persons={get('/api/v1/dashboard/stats', token)['persons']['total']}")
check("Dashboard charts", lambda: f"status_points={len(get('/api/v1/dashboard/charts', token)['cases_by_status'])}")

# --- Cases ---
cases = get("/api/v1/cases/", token)
case_id = cases["items"][0]["id"] if cases["items"] else None
check("Cases list", lambda: f"total={cases['total']}")

if case_id:
    check("Case detail", lambda: get(f"/api/v1/cases/{case_id}", token)["case_number"])
    check("Case timeline", lambda: f"events={get(f'/api/v1/cases/{case_id}/timeline', token)['total']}")
    check("Case persons", lambda: f"count={len(get(f'/api/v1/cases/{case_id}/persons', token))}")
    check("Relationship graph", lambda: f"nodes={len(get(f'/api/v1/cases/{case_id}/relationships/graph', token)['nodes'])}")
    check("Prioritization engine", lambda: f"candidates={post(f'/api/v1/cases/{case_id}/prioritize', {}, token)['total_candidates']}")
    check("Prioritization scores GET", lambda: f"candidates={get(f'/api/v1/cases/{case_id}/scores', token)['total_candidates']}")
    check("Report generation", lambda: post(f"/api/v1/reports/case/{case_id}", {}, token)["report_type"])

# --- Persons ---
check("Persons list", lambda: f"total={get('/api/v1/persons/', token)['total']}")

# --- Evidence ---
check("Evidence list", lambda: f"total={get('/api/v1/evidence/', token)['total']}")

# --- Users ---
check("Users list", lambda: f"total={get('/api/v1/users/', token)['total']}")

# --- Audit ---
check("Audit logs", lambda: f"total={get('/api/v1/audit/', token)['total']}")

# --- Security ---
check("Security events", lambda: f"total={get('/api/v1/security/events', token)['total']}")
check("Security dashboard", lambda: f"events={get('/api/v1/security/dashboard', token)['total_events']}")

# --- IDOR test ---
print("\n--- IDOR/BOLA Protection Test ---")
# Login as officer (limited access)
data2 = json.dumps({"username": "auditor", "password": "CrimeLink@Demo2026!"}).encode()
req2 = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=data2,
                               headers={"Content-Type": "application/json"}, method="POST")
auditor_resp = json.loads(urllib.request.urlopen(req2).read())
auditor_token = auditor_resp["access_token"]

# Auditor should NOT be able to create a case
try:
    post("/api/v1/cases/", {"title": "Test", "case_type": "ROBBERY"}, auditor_token)
    FAIL.append(("IDOR: auditor cannot create case", "DID NOT BLOCK"))
    print(f"  FAIL  {'IDOR: auditor blocked from create':<35}  NOT blocked!")
except urllib.error.HTTPError as e:
    if e.code == 403:
        PASS.append(("IDOR: auditor blocked from create", "403 Forbidden"))
        print(f"  PASS  {'IDOR: auditor blocked from create':<35}  403 Forbidden")
    else:
        print(f"  FAIL  IDOR test got unexpected {e.code}")

# Summary
total = len(PASS) + len(FAIL)
print(f"\n{'='*60}")
print(f"RESULTS: {len(PASS)}/{total} passed  |  {len(FAIL)} failed")
if FAIL:
    print("\nFailed:")
    for name, err in FAIL:
        print(f"  - {name}: {err}")
print(f"{'='*60}\n")
sys.exit(0 if not FAIL else 1)

import urllib.request, json, time

BASE = "http://localhost:8000"

# Login
data = json.dumps({"username": "superadmin", "password": "CrimeLink@Demo2026!"}).encode()
req = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=data,
                              headers={"Content-Type": "application/json"}, method="POST")
resp = json.loads(urllib.request.urlopen(req).read())
token = resp["access_token"]
H = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/v1/dashboard/stats",
    "/api/v1/cases/",
    "/api/v1/persons/",
    "/api/v1/evidence/",
    "/api/v1/users/",
    "/api/v1/audit/",
    "/api/v1/security/events",
]

print("\nResponse time test:")
for url in endpoints:
    t = time.time()
    r = urllib.request.Request(f"{BASE}{url}", headers=H)
    d = json.loads(urllib.request.urlopen(r).read())
    elapsed = (time.time() - t) * 1000
    total = d.get("total", d.get("total_events", d.get("cases", {}).get("total", "OK")))
    print(f"  {url:<40} {elapsed:>6.0f}ms  total={total}")

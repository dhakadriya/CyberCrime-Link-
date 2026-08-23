import httpx

r = httpx.get("http://localhost:5173/", timeout=5)
print(f"Frontend status: {r.status_code}")
print(f"Has CrimeLink title: {'CrimeLink' in r.text}")
print(f"Has React root div: {'id=\"root\"' in r.text}")
print(f"Has script tag: {'src/' in r.text}")

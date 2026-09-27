#!/usr/bin/env python3
"""App Store Connect yardımcıları: derleme durumu ve iç test grubuna bağlama.
Kimlik bilgileri ~/private_keys/asc.env, uygulama kimlikleri ~/private_keys/asc-tenis.env (depoya girmez)."""
import json, os, sys, time, glob, urllib.request
sys.path.insert(0, os.path.expanduser("~/.venvs/asc/lib/python3.14/site-packages"))
import jwt

def env(name="asc.env"):
    p = os.path.expanduser(f"~/private_keys/{name}")
    if not os.path.exists(p):
        return {}
    return dict(l.strip().split("=", 1) for l in open(p) if "=" in l and not l.startswith("#"))

E = env()
KEY_ID, ISSUER = E["ASC_KEY_ID"], E["ASC_ISSUER_ID"]
T = env("asc-tenis.env")
APP = os.environ.get("ASC_APP_ID", T.get("ASC_APP_ID", ""))
GROUP = os.environ.get("ASC_GROUP_ID", T.get("ASC_GROUP_ID", ""))
key = open(glob.glob(os.path.expanduser(f"~/private_keys/AuthKey_{KEY_ID}.p8"))[0]).read()

def token():
    return jwt.encode({"iss": ISSUER, "iat": int(time.time()), "exp": int(time.time()) + 900,
                       "aud": "appstoreconnect-v1"}, key, algorithm="ES256",
                      headers={"kid": KEY_ID, "typ": "JWT"})

def call(method, path, body=None):
    r = urllib.request.Request("https://api.appstoreconnect.apple.com" + path, method=method,
                               data=(json.dumps(body).encode() if body else None),
                               headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30) as x:
            return x.status, json.loads(x.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def builds(limit=5):
    st, d = call("GET", f"/v1/builds?filter[app]={APP}&limit={limit}&sort=-uploadedDate")
    return d.get("data", []) if st == 200 else []

def wait_valid(build_no, minutes=20):
    """Verilen derleme numarası VALID olana kadar bekler, sonra id döner."""
    for _ in range(minutes):
        for b in builds():
            if b["attributes"].get("version") == str(build_no):
                state = b["attributes"].get("processingState")
                print("derleme", build_no, "durum:", state, flush=True)
                if state == "VALID":
                    return b["id"]
                if state in ("FAILED", "INVALID"):
                    return None
        time.sleep(60)
    return None

def attach(build_id):
    st, _ = call("POST", f"/v1/betaGroups/{GROUP}/relationships/builds",
                 {"data": [{"type": "builds", "id": build_id}]})
    return st

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        for b in builds():
            a = b["attributes"]
            print(f"derleme {a.get('version')} | {a.get('processingState')} | {a.get('uploadedDate')}")
    elif cmd == "publish":          # publish <derleme_no>
        bid = wait_valid(sys.argv[2])
        if not bid:
            print("derleme geçerli hale gelmedi"); sys.exit(1)
        print("iç test grubuna bağlandı:", attach(bid))

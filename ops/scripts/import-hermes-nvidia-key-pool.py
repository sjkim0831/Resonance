#!/usr/bin/env python3
"""Atomically import NVIDIA keys from a mode-0600 file into Hermes auth.json."""
import hashlib, json, os, shutil, stat, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

source = Path(os.environ.get("NVIDIA_API_KEYS_FILE", "/etc/resonance/secrets/nvidia-api-keys"))
auth = Path(os.environ.get("HERMES_AUTH_FILE", str(Path.home() / ".hermes" / "auth.json")))
if not source.is_file():
    raise SystemExit(f"missing secret file: {source}")
mode = stat.S_IMODE(source.stat().st_mode)
if mode & 0o077:
    raise SystemExit(f"secret file must be mode 0600: {source} is {mode:04o}")
keys = list(dict.fromkeys(line.strip() for line in source.read_text().splitlines() if line.strip()))
if not keys or any(not key.startswith("nvapi-") for key in keys):
    raise SystemExit("secret file contains no keys or a non-NVIDIA key")
data = json.loads(auth.read_text()) if auth.exists() else {"version": 1, "providers": {}, "credential_pool": {}}
pool = data.setdefault("credential_pool", {})
existing = pool.get("nvidia", [])
by_token = {item.get("access_token"): item for item in existing if item.get("access_token")}
now = datetime.now(timezone.utc).isoformat()
items = []
for priority, key in enumerate(keys, 1):
    item = by_token.get(key, {})
    item.update({
        "id": "nvidia-" + hashlib.sha256(key.encode()).hexdigest()[:12],
        "label": f"nvidia-pool-{priority}", "source": "secure-file",
        "auth_type": "api_key", "access_token": key,
        "base_url": "https://integrate.api.nvidia.com/v1", "priority": priority,
        "last_status": None, "last_status_at": None, "last_error_code": None,
        "last_error_message": None, "last_error_reason": None,
        "last_error_reset_at": None, "request_count": int(item.get("request_count", 0))
    })
    items.append(item)
pool["nvidia"] = items
data["updated_at"] = now
auth.parent.mkdir(parents=True, exist_ok=True)
if auth.exists():
    shutil.copy2(auth, auth.with_suffix(f".json.backup-{datetime.now().strftime('%Y%m%d%H%M%S')}"))
fd, tmp = tempfile.mkstemp(prefix="auth.", dir=auth.parent)
try:
    with os.fdopen(fd, "w") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, auth)
finally:
    if os.path.exists(tmp): os.unlink(tmp)
print(f"PASS imported {len(items)} NVIDIA credentials into Hermes pool")

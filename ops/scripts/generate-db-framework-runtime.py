#!/usr/bin/env python3
import argparse, hashlib, json, os, re, tempfile, time
from pathlib import Path

SAFE = re.compile(r"[^A-Za-z0-9._-]+")

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def atomic_write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    data = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    root = Path(args.out)
    artifacts, generated, unchanged = [], 0, 0
    manifest_path = root / "manifest.json"
    existing = {}
    if manifest_path.exists():
        try:
            for item in json.loads(manifest_path.read_text(encoding="utf-8")).get("resources", []):
                existing[(item["kind"], item["scope"], item["key"])] = item
        except (OSError, ValueError, KeyError, TypeError):
            existing = {}
    for resource in data.get("resources", []):
        kind = SAFE.sub("-", resource["kind"].lower()).strip("-")
        scope = SAFE.sub("-", resource["scope"].lower()).strip("-")
        key_hash = hashlib.sha256(resource["key"].encode()).hexdigest()[:20]
        relative = Path(kind) / scope / f"{key_hash}.json"
        payload = canonical(resource) + "\n"
        target = root / relative
        status = "UNCHANGED"
        if not target.exists() or target.read_text(encoding="utf-8") != payload:
            atomic_write(target, payload)
            status = "GENERATED"
            generated += 1
        else:
            unchanged += 1
        artifacts.append({"resourceId": resource["resourceId"],
                          "sourceHash": resource["sourceHash"], "status": status})
        existing[(resource["kind"], resource["scope"], resource["key"])] = {
            "kind": resource["kind"], "scope": resource["scope"], "key": resource["key"],
            "revision": resource["revision"], "path": relative.as_posix(),
            "sourceHash": resource["sourceHash"], "active": resource["active"]}
    manifest = sorted(existing.values(), key=lambda x: (x["kind"], x["scope"], x["key"]))
    atomic_write(manifest_path, canonical({"schemaVersion": "1.0.0",
        "resources": manifest}) + "\n")
    result = {"success": True, "requested": len(artifacts), "generated": generated,
              "unchanged": unchanged, "failed": 0,
              "elapsedMillis": round((time.perf_counter() - started) * 1000),
              "artifacts": artifacts}
    print(canonical(result))

if __name__ == "__main__":
    main()

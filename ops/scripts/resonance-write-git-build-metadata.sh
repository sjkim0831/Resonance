#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
OUT_FILE="${OUT_FILE:-$ROOT_DIR/projects/carbonet-backend-metadata/git-build-monitoring-status.json}"
export ROOT_DIR
mkdir -p "$(dirname "$OUT_FILE")"

cd "$ROOT_DIR"

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip("\n")))'
}

git_value() {
  git "$@" 2>/dev/null || true
}

branch="$(git_value branch --show-current)"
head_full="$(git_value rev-parse HEAD)"
head_short="$(git_value rev-parse --short=12 HEAD)"
remote="$(git_value config --get remote.origin.url | sed -E 's#https://[^/@]+@#https://***@#')"
upstream="$(git_value rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
ahead_behind="$(git_value rev-list --left-right --count 'HEAD...@{u}')"
last_commit_at="$(git_value log -1 --format=%cI)"
last_commit_subject="$(git_value log -1 --format=%s)"
status_text="$(git_value status --short)"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 - "$OUT_FILE" <<'PY'
import json
import os
import subprocess
import sys
from pathlib import Path

out_file = Path(sys.argv[1])
root = Path(os.environ.get("ROOT_DIR", "/opt/Resonance"))

def run(args):
    try:
        return subprocess.check_output(args, cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""

def status_rows():
    rows = []
    for line in run(["git", "status", "--short"]).splitlines():
        if not line:
            continue
        rows.append({"status": line[:2].strip(), "path": line[3:] if len(line) > 3 else line})
        if len(rows) >= 120:
            break
    return rows

def commits():
    rows = []
    for line in run(["git", "log", "--oneline", "-15"]).splitlines():
        if " " in line:
            h, subject = line.split(" ", 1)
        else:
            h, subject = line, ""
        rows.append({"hash": h, "subject": subject})
    return rows

def file_fingerprint(path):
    p = root / path
    if not p.exists():
        return "missing"
    stat = p.stat()
    return f"{stat.st_size} bytes, {stat.st_mtime_ns}"

remote = run(["git", "config", "--get", "remote.origin.url"])
if remote.startswith("https://") and "@" in remote:
    scheme, rest = remote.split("://", 1)
    remote = scheme + "://***@" + rest.split("@", 1)[1]

payload = {
    "repository": str(root),
    "branch": run(["git", "branch", "--show-current"]),
    "head": run(["git", "rev-parse", "HEAD"]),
    "headShort": run(["git", "rev-parse", "--short=12", "HEAD"]),
    "remote": remote,
    "upstream": run(["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
    "aheadBehind": run(["git", "rev-list", "--left-right", "--count", "HEAD...@{u}"]),
    "lastCommitAt": run(["git", "log", "-1", "--format=%cI"]),
    "lastCommitSubject": run(["git", "log", "-1", "--format=%s"]),
    "statusText": run(["git", "status", "--short"]),
    "recentCommits": commits(),
    "changedFiles": status_rows(),
    "frontendSourceFingerprint": file_fingerprint("projects/carbonet-frontend/source/src/features/admin-monitoring/AdminMonitoringOperationsPages.tsx"),
    "backendSourceFingerprint": file_fingerprint("modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/admin/system/web/AdminSystemManagementController.java"),
    "overlayMarkerFingerprint": file_fingerprint("projects/carbonet-frontend/src/main/resources/static/react-app/.resonance-build.json"),
    "generatedAt": run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"]),
}
out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

echo "wrote $OUT_FILE"

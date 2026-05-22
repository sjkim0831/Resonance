#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="$ROOT_DIR/var/ai-runtime"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/incident-patterns.jsonl"
SUMMARY="$OUT_DIR/incident-patterns-summary.md"
PATTERN_SUMMARY_JSON="$OUT_DIR/incident-patterns-summary.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
scan() {
  grep -RInE --exclude='incident-patterns*' --exclude='qwen40-improvement*' --exclude='*.md' \
    '\[exit [1-9]|FAIL|WARN|error during build|EACCES|sudo:|KUBE_API_DOWN|KUBECTL_UNAVAILABLE|CUBRID_SERVICE_RESTART_FAILED|RUNTIME_HEALTH_FAILED|BROKER_CLOSE_WAIT_HIGH|permission denied|timed out waiting|container not found|CrashLoop|BackOff|ImagePull|read-only|Error assembling JAR' \
    "$ROOT_DIR/var/ai-runtime" "$ROOT_DIR/var/logs" /opt/util/k9s/web/logs 2>/dev/null || true
}
classify() {
  local line="$1" code="UNKNOWN" severity="WARN" repair="manual review"
  case "$line" in
    *EACCES*|*permission\ denied*) code="FRONTEND_OUTPUT_PERMISSION"; severity="FAIL"; repair="chown Vite/static output dirs to sjkim and rerun deploy" ;;
    *read-only*|*"Error assembling JAR"*) code="MAVEN_TARGET_READ_ONLY"; severity="FAIL"; repair="run resonance-ownership-normalize.service, chown Maven target dirs to sjkim, then rerun deploy" ;;
    *'sudo:'*) code="SUDO_NONINTERACTIVE"; severity="FAIL"; repair="ensure /etc/sudoers.d/resonance-ops allows required noninteractive commands" ;;
    *KUBE_API_DOWN*|*KUBECTL_UNAVAILABLE*) code="KUBE_API_UNAVAILABLE"; severity="FAIL"; repair="restart kubelet/containerd, wait for apiserver, then rerun resonance-up" ;;
    *CUBRID_SERVICE_RESTART_FAILED*|*'container not found ("cubrid")'*) code="CUBRID_CONTAINER_NOT_READY"; severity="FAIL"; repair="wait for cubrid pod ready and resolve actual container name before broker restart" ;;
    *BROKER_CLOSE_WAIT_HIGH*) code="BROKER_CLOSE_WAIT_HIGH"; severity="WARN"; repair="run broker doctor; if sustained, restart broker after checking runtime health" ;;
    *RUNTIME_HEALTH_FAILED*) code="RUNTIME_HEALTH_FAILED"; severity="WARN"; repair="check rollout status, pod logs, and health80; avoid rebuild until failure is sustained" ;;
    *'timed out waiting for the condition'*) code="ROLLOUT_TIMEOUT"; severity="FAIL"; repair="inspect new pod logs, rollback if readiness does not recover" ;;
    *'exit 127'*) code="MISSING_SCRIPT_OR_COMMAND"; severity="FAIL"; repair="fix ops web command mapping or install missing script" ;;
  esac
  python3 - "$line" "$code" "$severity" "$repair" <<'PY'
import json, sys, datetime, hashlib
line, code, severity, repair = sys.argv[1:]
print(json.dumps({
  "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "signature": hashlib.sha1((code+line[:220]).encode()).hexdigest()[:16],
  "code": code,
  "severity": severity,
  "repair": repair,
  "sample": line[-700:],
}, ensure_ascii=False))
PY
}
scan | tail -300 > "$TMP"
: > "$OUT.tmp"
while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  classify "$line" >> "$OUT.tmp"
done < "$TMP"
python3 - "$OUT" "$OUT.tmp" "$SUMMARY" "$PATTERN_SUMMARY_JSON" <<'PY'
import collections, datetime, json, pathlib, sys
src=pathlib.Path(sys.argv[1])
incoming=pathlib.Path(sys.argv[2])
summary=pathlib.Path(sys.argv[3])
summary_json=pathlib.Path(sys.argv[4])

existing=[]
seen=set()
if src.exists():
    for line in src.read_text(errors='ignore').splitlines():
        try:
            row=json.loads(line)
        except Exception:
            continue
        sig=row.get("signature")
        if sig:
            if sig in seen:
                continue
            seen.add(sig)
        existing.append(row)

new_rows=[]
for line in incoming.read_text(errors='ignore').splitlines():
    try:
        row=json.loads(line)
    except Exception:
        continue
    sig=row.get("signature")
    if sig and sig in seen:
        continue
    if sig:
        seen.add(sig)
    new_rows.append(row)

# Compact historical duplicate signatures so summaries reflect unique evidence.
with src.open("w", encoding="utf-8") as f:
    for row in existing + new_rows:
        f.write(json.dumps(row, ensure_ascii=False)+"\n")

rows=(existing + new_rows)[-5000:]
by_code={}
for row in rows:
    code=row.get("code") or "UNKNOWN"
    item=by_code.setdefault(code, {
        "code": code,
        "count": 0,
        "severity": row.get("severity") or "WARN",
        "repair": row.get("repair") or "",
        "firstSeen": row.get("ts") or "",
        "lastSeen": row.get("ts") or "",
        "latestSample": "",
    })
    item["count"] += 1
    ts=row.get("ts") or ""
    if ts and (not item["firstSeen"] or ts < item["firstSeen"]):
        item["firstSeen"]=ts
    if ts and (not item["lastSeen"] or ts > item["lastSeen"]):
        item["lastSeen"]=ts
        item["latestSample"]=row.get("sample") or ""
    if row.get("severity") == "FAIL":
        item["severity"]="FAIL"
    if row.get("repair"):
        item["repair"]=row.get("repair")

items=sorted(by_code.values(), key=lambda x: (-x["count"], x["code"]))
generated=datetime.datetime.now(datetime.timezone.utc).isoformat()
summary_json.write_text(json.dumps({
    "generatedAt": generated,
    "sourceFile": str(src),
    "newRows": len(new_rows),
    "items": items,
}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

lines=[
    "# Resonance Incident Pattern Summary",
    "",
    f"- generatedAt: {generated}",
    f"- new unique rows: {len(new_rows)}",
    "",
    "| code | count | severity | first seen | last seen | repair |",
    "|---|---:|---|---|---|---|",
]
for item in items:
    lines.append("| {code} | {count} | {severity} | {firstSeen} | {lastSeen} | {repair} |".format(
        code=item["code"], count=item["count"], severity=item["severity"],
        firstSeen=item["firstSeen"], lastSeen=item["lastSeen"],
        repair=(item["repair"] or " ").replace("|", "\\|"),
    ))
summary.write_text("\n".join(lines)+"\n", encoding="utf-8")
print(summary)
PY
rm -f "$OUT.tmp"

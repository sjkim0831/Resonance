#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="$ROOT_DIR/var/ai-runtime"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/incident-patterns.jsonl"
SUMMARY="$OUT_DIR/incident-patterns-summary.md"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
scan() {
  grep -RInE '\[exit [1-9]|FAIL|WARN|error during build|EACCES|sudo:|KUBE_API_DOWN|KUBECTL_UNAVAILABLE|CUBRID_SERVICE_RESTART_FAILED|RUNTIME_HEALTH_FAILED|BROKER_CLOSE_WAIT_HIGH|permission denied|timed out waiting|container not found|CrashLoop|BackOff|ImagePull' \
    "$ROOT_DIR/var/ai-runtime" "$ROOT_DIR/var/logs" /opt/util/k9s/web/logs 2>/dev/null || true
}
classify() {
  local line="$1" code="UNKNOWN" severity="WARN" repair="manual review"
  case "$line" in
    *EACCES*|*permission\ denied*) code="FRONTEND_OUTPUT_PERMISSION"; severity="FAIL"; repair="chown Vite/static output dirs to sjkim and rerun deploy" ;;
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
cat "$OUT.tmp" >> "$OUT"
rm -f "$OUT.tmp"
python3 - "$OUT" "$SUMMARY" <<'PY'
import json, sys, collections, pathlib
src=pathlib.Path(sys.argv[1]); dst=pathlib.Path(sys.argv[2])
rows=[]
for line in src.read_text(errors='ignore').splitlines()[-1000:]:
    try: rows.append(json.loads(line))
    except Exception: pass
counter=collections.Counter(r['code'] for r in rows)
repairs={}
for r in rows: repairs[r['code']]=r.get('repair','')
lines=['# Resonance Incident Pattern Summary','', '| code | count | repair |','|---|---:|---|']
for code,count in counter.most_common():
    lines.append(f'| {code} | {count} | {repairs.get(code," ")} |')
dst.write_text('\n'.join(lines)+'\n')
print(dst)
PY

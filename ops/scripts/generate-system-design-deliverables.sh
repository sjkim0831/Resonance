#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-generate}"
OUT_ROOT="${SYSTEM_DESIGN_OUT_ROOT:-$ROOT/var/ai-runtime/system-design-generator}"
TIME_BUDGET="${SYSTEM_DESIGN_TIME_BUDGET_SECONDS:-175}"
LOCK="$OUT_ROOT/generator.lock"
mkdir -p "$OUT_ROOT"
exec 9>"$LOCK"
flock -n 9 || { echo '[system-design] another generation is running' >&2; exit 75; }

validate_run() {
  local target="$1"
  python3 - "$target" <<'PY'
import json, sys, zipfile
from pathlib import Path
p=Path(sys.argv[1])
docs=list((p/'documents').glob('*.docx'))
manifest=json.loads((p/'development/development-manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(p/'system-design-documents.zip') as z: bad=z.testzip()
assert len(docs)==20, f'docx={len(docs)}'
assert manifest['contractCount'] > 0 and manifest['routeCount'] >= 1000, manifest
assert bad is None, bad
print(json.dumps({'valid':True,'docx':len(docs),'contracts':manifest['contractCount'],'routes':manifest['routeCount']},separators=(',',':')))
PY
}

if [[ "$MODE" == "check" ]]; then
  [[ -L "$OUT_ROOT/latest" ]] || { echo '[system-design] latest output missing' >&2; exit 2; }
  validate_run "$(readlink -f "$OUT_ROOT/latest")"
  exit
fi

[[ "$MODE" =~ ^(generate|force|dev-only)$ ]] || {
  echo 'usage: generate-system-design-deliverables.sh [generate|force|dev-only|check]' >&2
  exit 2
}

started_s="$(date +%s)"
run_with_budget() {
  local now remaining
  now="$(date +%s)"
  remaining="$(( TIME_BUDGET - (now - started_s) ))"
  (( remaining > 0 )) || { echo '[system-design] time budget exhausted; latest remains unchanged' >&2; exit 124; }
  timeout "$remaining" "$@"
}
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$OUT_ROOT/$run_id"
mkdir -p "$run_dir"

run_with_budget python3 "$ROOT/ops/scripts/generate-system-design-snapshot.py" \
  --out "$run_dir/system-design-snapshot.json"

signature="$(python3 - "$run_dir/system-design-snapshot.json" "$ROOT/ops/scripts/generate-full-system-docs.py" "$ROOT/ops/scripts/compile-design-development-packets.py" "$ROOT/ops/scripts/screen_layout_contracts.py" <<'PY'
import hashlib,json,sys
from pathlib import Path
snap=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
for key in ('captured_at','postgres_leader'): snap.pop(key,None)
snap.pop('report_files',None)
snap.pop('k8s_resources',None)
for table in snap.get('tables',[]): table.pop('estimated_rows',None)
h=hashlib.sha256(json.dumps(snap,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())
for name in sys.argv[2:]: h.update(Path(name).read_bytes())
print(h.hexdigest())
PY
)"

if [[ "$MODE" == "generate" && -L "$OUT_ROOT/latest" ]]; then
  previous="$(readlink -f "$OUT_ROOT/latest")"
  previous_signature="$(jq -r '.signature // empty' "$previous/meta.json" 2>/dev/null || true)"
  if [[ "$signature" == "$previous_signature" ]] && validate_run "$previous" >/dev/null; then
    [[ "$(realpath -m "$run_dir")" == "$(realpath "$OUT_ROOT")/"* ]] || { echo '[system-design] unsafe cache path' >&2; exit 70; }
    rm -r -- "$run_dir"
    echo "REUSED output=$previous signature=$signature elapsedMs=$(( ($(date +%s) - started_s) * 1000 ))"
    exit
  fi
fi

run_with_budget python3 "$ROOT/ops/scripts/compile-design-development-packets.py" \
  "$run_dir/system-design-snapshot.json" --out "$run_dir/development"
python3 "$ROOT/ops/scripts/compile-design-development-packets.py" \
  "$run_dir/system-design-snapshot.json" --out "$run_dir/development" --check >/dev/null

if [[ "$MODE" != "dev-only" ]]; then
  run_with_budget python3 "$ROOT/ops/scripts/generate-full-system-docs.py" \
    --snapshot "$run_dir/system-design-snapshot.json" \
    --out "$run_dir/documents" --zip "$run_dir/system-design-documents.zip"
else
  if [[ -L "$OUT_ROOT/latest" ]]; then
    cp -a "$(readlink -f "$OUT_ROOT/latest")/documents" "$run_dir/documents"
    cp -a "$(readlink -f "$OUT_ROOT/latest")/system-design-documents.zip" "$run_dir/system-design-documents.zip"
  else
    echo '[system-design] dev-only requires an existing full run' >&2; exit 3
  fi
fi

elapsed_ms="$(( ($(date +%s) - started_s) * 1000 ))"
(( elapsed_ms <= TIME_BUDGET * 1000 )) || {
  echo "[system-design] exceeded ${TIME_BUDGET}s; last-known-good remains active" >&2
  exit 124
}
validation="$(validate_run "$run_dir")"
jq -n --arg runId "$run_id" --arg signature "$signature" --argjson elapsedMs "$elapsed_ms" \
  --argjson validation "$validation" \
  '{schemaVersion:"1.0.0",runId:$runId,signature:$signature,elapsedMs:$elapsedMs,validation:$validation,status:"READY"}' \
  > "$run_dir/meta.json"
ln -sfn "$run_id" "$OUT_ROOT/latest.next"
mv -Tf "$OUT_ROOT/latest.next" "$OUT_ROOT/latest"
echo "PASS output=$run_dir signature=$signature elapsedMs=$elapsed_ms validation=$validation"

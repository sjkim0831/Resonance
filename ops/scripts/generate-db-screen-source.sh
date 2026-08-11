#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
FRONTEND="$ROOT/projects/carbonet-frontend/source"
GENERATED_REL="projects/carbonet-frontend/source/src/generated/screen-generation"
GENERATED="$ROOT/$GENERATED_REL"
STATE="$ROOT/projects/carbonet-backend-metadata/screen-runtime/db-source-export.sha256"
LOCK="${DB_SCREEN_SOURCE_LOCK:-/tmp/resonance-db-screen-source.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"success":true,"status":"ALREADY_RUNNING"}'; exit 0; }
snapshot="$(mktemp)"; import_json="$(mktemp)"; materialize="$(mktemp)"; result="$(mktemp)"
trap 'rm -f "$snapshot" "$import_json" "$materialize" "$result"' EXIT
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }
allowed="$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 \
  -U postgres -d carbonet -X -Atqc 'select framework_contract_generation_allowed()')"
if [[ "$allowed" != t ]]; then
  jq -cn '{success:true,status:"BLOCKED_BY_CONTRACT_COMPILER",requested:0,designGenerated:false}'
  exit 0
fi

kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 -c 'select framework_screen_blueprint_export(5000)' >"$snapshot"
next_hash="$(jq -c 'del(.batch.exportedAt)' "$snapshot"|sha256sum|awk '{print $1}')"
previous_hash="$(cat "$STATE" 2>/dev/null || true)"
generated=false
if [[ "$next_hash" != "$previous_hash" ]]; then
  (cd "$FRONTEND" && node scripts/generate-screen-blueprints.mjs --input "$snapshot" \
    --outDir src/generated/screen-generation --limit 5000 --concurrency auto) >/tmp/resonance-db-screen-codegen.json
  python3 - "$ROOT" "$GENERATED" "$GENERATED_REL" "$next_hash" >"$import_json" <<'PY'
import json,sys
from pathlib import Path
root,folder,relative,design_hash=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3],sys.argv[4]
items=[]
for path in sorted(folder.rglob("*")):
  if path.is_file() and path.suffix in {".ts",".tsx",".json"}:
    items.append({"sourcePath":str(Path(relative)/path.relative_to(folder)).replace("\\","/"),
      "artifactKind":"SCREEN_SOURCE","languageCode":"json" if path.suffix==".json" else "typescript",
      "sourceContent":path.read_text(encoding="utf-8"),"designHash":design_hash,
      "metadata":{"generator":"generate-screen-blueprints.mjs","dbFirst":True}})
print(json.dumps(items,ensure_ascii=False,separators=(",",":")))
PY
  encoded="$(base64 -w0 "$import_json")"
  kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
    -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_import_source_artifacts(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb,'DB_SCREEN_GENERATOR');
SQL
  mkdir -p "$(dirname "$STATE")"; printf '%s\n' "$next_hash" >"$STATE"; generated=true
fi

kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 \
  -c 'select framework_source_materialization_snapshot(5000)' >"$materialize"
count="$(jq -r '.artifactCount//0' "$materialize")"
if (( count > 0 )); then
  python3 "$ROOT/ops/scripts/materialize-db-source.py" "$materialize" --root "$ROOT" >"$result"
  encoded="$(base64 -w0 "$result")"
  kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
    -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_complete_source_materialization(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb);
SQL
  jq --argjson designGenerated "$generated" 'del(.artifacts)+{status:"GENERATED",designGenerated:$designGenerated}' "$result"
else
  jq -cn --argjson designGenerated "$generated" '{success:true,status:"UNCHANGED",requested:0,designGenerated:$designGenerated}'
fi

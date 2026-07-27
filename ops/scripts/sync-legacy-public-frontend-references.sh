#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
REFERENCE_ROOT="${LEGACY_PUBLIC_REFERENCE_ROOT:-/opt/reference/screen}"
REPORT_DIR="${LEGACY_PUBLIC_REPORT_DIR:-$ROOT_DIR/var/reports/legacy-public-frontend}"
EXPECTED_COUNT="${LEGACY_PUBLIC_EXPECTED_COUNT:-82}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
MIGRATION="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728110000__catalog_legacy_public_frontend_references.sql"
STAMP="$(date +%Y%m%d-%H%M%S)"
MANIFEST="$REPORT_DIR/$STAMP.json"
LATEST="$REPORT_DIR/latest.json"

mkdir -p "$REPORT_DIR"
exec 9>"${LEGACY_PUBLIC_REFERENCE_LOCK:-/tmp/resonance-legacy-public-reference.lock}"
flock -w 60 9 || {
  echo "[legacy-public-reference] another inventory is active" >&2
  exit 75
}

leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -Atqc \
    'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && {
      leader="$pod"
      break
    }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || {
  echo "[legacy-public-reference] writable PostgreSQL leader not found" >&2
  exit 1
}

psqlq() {
  kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" \
    -X -q -v ON_ERROR_STOP=1 -At "$@"
}

python3 "$ROOT_DIR/ops/scripts/catalog-legacy-public-frontend.py" \
  --root "$REFERENCE_ROOT" \
  --output "$MANIFEST" \
  --expected-count "$EXPECTED_COUNT" >/dev/null

# The migration is idempotent and applying it here supports the no-build
# metadata path. Flyway will execute the same definitions safely later.
psqlq <"$MIGRATION" >/dev/null

import_result="$(
  {
    printf "%s" "select framework_import_legacy_frontend_references(convert_from(decode('"
    base64 -w0 "$MANIFEST"
    printf "%s\n" "','base64'),'UTF8')::jsonb,'LEGACY_PUBLIC_FRONTEND_SYNC')::text;"
  } | psqlq
)"

verification="$(psqlq -c "
select jsonb_build_object(
  'total',count(*),
  'legacyReference',count(*) filter(where reference_status='LEGACY_REFERENCE'),
  'reviewRequired',count(*) filter(where reuse_decision='REVIEW_REQUIRED'),
  'adminSourceLeak',count(*) filter(where source_path like '%/관리자화면/%'
    or source_path like '%/일반관리자화면/%'),
  'backendDeclared',count(*) filter(
    where coalesce((extracted_contract->>'backendRequired')::boolean,false)
  ),
  'withProcessCandidate',count(*) filter(
    where exists(
      select 1 from framework_legacy_frontend_process_candidate c
      where c.reference_id=catalog.reference_id
    )
  ),
  'approvedProcessBinding',(
    select count(*) from framework_legacy_frontend_process_candidate
    where mapping_status='APPROVED'
  ),
  'families',jsonb_object_agg(source_family,family_count)
)::text
from (
  select r.*,count(*) over(partition by source_family) family_count
  from framework_legacy_frontend_reference r
) catalog;")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg manifest "$MANIFEST" \
  --argjson import "$import_result" \
  --argjson verification "$verification" \
  '{
    status:(
      if $verification.total == 82
        and $verification.adminSourceLeak == 0
        and $verification.backendDeclared == 0
        and $verification.withProcessCandidate == 82
      then "READY" else "BLOCKED" end
    ),
    generatedAt:$generatedAt,
    scope:{
      kind:"LEGACY_PUBLIC_HTML_FRONTEND",
      expectedCount:82,
      activatesRoutes:false,
      createsMenus:false,
      backendImplementation:false
    },
    manifest:$manifest,
    import:$import,
    verification:$verification
  }' >"$LATEST.tmp"
mv "$LATEST.tmp" "$LATEST"

jq -e '.status=="READY"' "$LATEST" >/dev/null
cat "$LATEST"

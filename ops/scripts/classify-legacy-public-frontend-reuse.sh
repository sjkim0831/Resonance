#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
REPORT_DIR="${LEGACY_PUBLIC_REPORT_DIR:-$ROOT_DIR/var/reports/legacy-public-frontend}"
MIGRATION="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728113000__classify_legacy_public_frontend_reuse.sql"

mkdir -p "$REPORT_DIR"
exec 9>"${LEGACY_PUBLIC_CLASSIFY_LOCK:-/tmp/resonance-legacy-public-classify.lock}"
flock -w 60 9 || exit 75

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
[[ -n "$leader" ]] || exit 1

psqlq() {
  kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" \
    -X -q -v ON_ERROR_STOP=1 -At "$@"
}

psqlq <"$MIGRATION" >/dev/null
classification="$(psqlq -c \
  "select framework_classify_legacy_frontend_reuse('LEGACY_PUBLIC_FRONTEND_CLASSIFIER')::text;")"
quality="$(psqlq -c "
select jsonb_build_object(
  'legacyReferences',(select count(*) from framework_legacy_frontend_reference),
  'mappedReferences',(select count(distinct reference_id)
    from framework_legacy_frontend_reuse_candidate),
  'topCandidatePerReference',(select count(*) from
    framework_legacy_frontend_reuse_candidate where candidate_rank=1),
  'adminRouteLeak',(select count(*) from framework_legacy_frontend_reuse_review
    where current_route like '/admin/%'),
  'routeActivated',false,
  'menuCreated',false,
  'humanApprovalRequired',true
)::text;")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson classification "$classification" \
  --argjson quality "$quality" \
  '{
    status:(
      if $quality.legacyReferences == 82
        and $quality.mappedReferences == 82
        and $quality.topCandidatePerReference == 82
        and $quality.adminRouteLeak == 0
      then "READY" else "BLOCKED" end
    ),
    generatedAt:$generatedAt,
    classification:$classification,
    quality:$quality
  }' >"$REPORT_DIR/classification-latest.json.tmp"
mv "$REPORT_DIR/classification-latest.json.tmp" \
  "$REPORT_DIR/classification-latest.json"
jq -e '.status=="READY"' "$REPORT_DIR/classification-latest.json" >/dev/null
cat "$REPORT_DIR/classification-latest.json"

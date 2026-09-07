#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
MIGRATION="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728123000__govern_legacy_section_review_and_adoption.sql"
OUTPUT_DIR="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app/api"
REPORT_DIR="$ROOT_DIR/var/reports/legacy-public-frontend"
JSON_FILE="$OUTPUT_DIR/legacy-public-section-review.json"
HTML_FILE="$OUTPUT_DIR/legacy-public-section-review.html"

mkdir -p "$OUTPUT_DIR" "$REPORT_DIR"
exec 9>"${LEGACY_SECTION_REVIEW_LOCK:-/tmp/resonance-legacy-section-review.lock}"
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
psqlq -c "
with item_rows as (
  select
    review.reference_id,review.source_family,review.screen_name,
    review.language_code,review.source_path,review.match_score,
    review.proposed_decision,review.current_route,
    review.current_screen_name,
    jsonb_agg(jsonb_build_object(
      'sectionId',review.section_id,
      'sectionName',review.section_name,
      'sectionType',review.section_type,
      'confidence',review.confidence,
      'componentIds',review.component_ids,
      'reuseStrategy',review.reuse_strategy,
      'reviewStatus',review.review_status
    ) order by review.confidence desc,review.section_id) sections
  from framework_legacy_section_adoption_review review
  group by review.reference_id,review.source_family,review.screen_name,
    review.language_code,review.source_path,review.match_score,
    review.proposed_decision,review.current_route,
    review.current_screen_name
)
select jsonb_build_object(
  'generatedAt',current_timestamp,
  'mode','DESIGN_LINK_REVIEW',
  'actualPageMutation',false,
  'secondApprovalRequired',true,
  'itemCount',(select count(*) from item_rows),
  'sectionCandidateCount',(select count(*) from
    framework_legacy_frontend_section_candidate),
  'approvedCount',(select count(*) from
    framework_legacy_frontend_section_candidate where review_status='APPROVED'),
  'appliedCount',(select count(*) from
    framework_legacy_section_adoption where applied_to_page),
  'items',coalesce((select jsonb_agg(to_jsonb(item_rows)
    order by source_family,screen_name) from item_rows),'[]'::jsonb)
)::text;" >"$JSON_FILE.tmp"
mv "$JSON_FILE.tmp" "$JSON_FILE"

python3 "$ROOT_DIR/ops/scripts/generate-legacy-section-review-page.py" \
  --input "$JSON_FILE" --output "$HTML_FILE"

report="$(jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg html "$HTML_FILE" --arg json "$JSON_FILE" \
  --argjson items "$(jq '.itemCount' "$JSON_FILE")" \
  --argjson sections "$(jq '.sectionCandidateCount' "$JSON_FILE")" \
  --argjson approved "$(jq '.approvedCount' "$JSON_FILE")" \
  --argjson applied "$(jq '.appliedCount' "$JSON_FILE")" \
  '{
    status:(if $items==47 and $sections==220 and $applied==0 then "READY" else "BLOCKED" end),
    generatedAt:$generatedAt,items:$items,sectionCandidates:$sections,
    approved:$approved,applied:$applied,html:$html,json:$json,
    actualPageMutation:false,secondApprovalRequired:true
  }')"
printf '%s\n' "$report" >"$REPORT_DIR/review-publication-latest.json"
jq -e '.status=="READY"' <<<"$report" >/dev/null
printf '%s\n' "$report"

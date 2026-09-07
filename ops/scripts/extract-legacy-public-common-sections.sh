#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
REPORT_DIR="${LEGACY_PUBLIC_REPORT_DIR:-$ROOT_DIR/var/reports/legacy-public-frontend}"
MIGRATION="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728120000__extract_legacy_public_common_sections.sql"

mkdir -p "$REPORT_DIR"
exec 9>"${LEGACY_PUBLIC_SECTION_LOCK:-/tmp/resonance-legacy-public-section.lock}"
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
extraction="$(psqlq -c \
  "select framework_extract_legacy_common_sections('LEGACY_PUBLIC_COMMON_SECTION_EXTRACTOR')::text;")"
quality="$(psqlq -c "
select jsonb_build_object(
  'referenceOnlySources',(select count(*) from
    framework_legacy_frontend_reuse_candidate
    where candidate_rank=1 and proposed_decision='REFERENCE_ONLY'),
  'mappedSources',(select count(distinct reference_id) from
    framework_legacy_frontend_section_candidate),
  'orphanSection',(select count(*) from
    framework_legacy_frontend_section_candidate candidate
    left join ui_section_registry section_asset using(section_id)
    where section_asset.section_id is null),
  'missingComponent',(select count(*) from (
    select distinct component.value component_id
    from framework_legacy_frontend_section_candidate candidate
    cross join lateral jsonb_array_elements_text(candidate.component_ids)
      component(value)
    left join ui_component_registry registry
      on registry.component_id=component.value and registry.active_yn='Y'
    where registry.component_id is null
  ) missing),
  'pageApplicationCount',0,
  'approvalRequired',true
)::text;")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson extraction "$extraction" \
  --argjson quality "$quality" \
  '{
    status:(
      if $quality.referenceOnlySources == 47
        and $quality.mappedSources == 47
        and $quality.orphanSection == 0
        and $quality.missingComponent == 0
        and $quality.pageApplicationCount == 0
      then "READY" else "BLOCKED" end
    ),
    generatedAt:$generatedAt,
    extraction:$extraction,
    quality:$quality
  }' >"$REPORT_DIR/section-extraction-latest.json.tmp"
mv "$REPORT_DIR/section-extraction-latest.json.tmp" \
  "$REPORT_DIR/section-extraction-latest.json"
jq -e '.status=="READY"' "$REPORT_DIR/section-extraction-latest.json" >/dev/null
cat "$REPORT_DIR/section-extraction-latest.json"

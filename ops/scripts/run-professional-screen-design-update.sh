#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
DESIGN_LIMIT="${PROFESSIONAL_SCREEN_DESIGN_LIMIT:-1000}"
REPORT_DIR="${PROFESSIONAL_SCREEN_DESIGN_REPORT_DIR:-$ROOT_DIR/var/reports/professional-screen-design}"
LOCK_FILE="${PROFESSIONAL_SCREEN_DESIGN_LOCK:-/tmp/resonance-professional-screen-design.lock}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORT_DIR/$STAMP.json"
LATEST_FILE="$REPORT_DIR/latest.json"

[[ "$DESIGN_LIMIT" =~ ^[0-9]+$ ]] && (( DESIGN_LIMIT >= 1 && DESIGN_LIMIT <= 1000 )) || {
  echo "[professional-screen-design] limit must be between 1 and 1000" >&2
  exit 2
}

mkdir -p "$REPORT_DIR"
exec 9>"$LOCK_FILE"
flock -w "${PROFESSIONAL_SCREEN_DESIGN_LOCK_WAIT_SECONDS:-3600}" 9 || {
  echo "[professional-screen-design] lock wait timed out" >&2
  exit 75
}
exec 8>"${DESIGN_METADATA_LOCK:-/tmp/resonance-design-metadata.lock}"
flock -w "${PROFESSIONAL_SCREEN_DESIGN_LOCK_WAIT_SECONDS:-3600}" 8 || {
  echo "[professional-screen-design] shared design lock wait timed out" >&2
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
  echo "[professional-screen-design] writable PostgreSQL leader not found" >&2
  exit 1
}

psqlq() {
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" \
    -X -q -v ON_ERROR_STOP=1 -At "$@"
}

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_epoch="$(date +%s)"

# A reviewed contract is immutable during mass preparation. The transaction is
# rolled back if any VERIFIED row changes, so bulk design can never silently
# degrade a screen that already has implementation evidence.
preparation_sql="$(cat <<SQL
begin;
create temporary table verified_contract_before on commit drop as
select contract_id,
       md5((to_jsonb(c)-'updated_at'-'created_at')::text) fingerprint
from framework_professional_screen_contract c
where contract_status='VERIFIED';

create temporary table mass_design_result on commit drop as
select framework_prepare_mass_professional_screens(
  $DESIGN_LIMIT,'PROFESSIONAL_SCREEN_DESIGN_UPDATE'
) result;

do \$\$
begin
  if exists (
    select 1
    from verified_contract_before before
    left join framework_professional_screen_contract after
      on after.contract_id=before.contract_id
    where after.contract_id is null
       or md5((to_jsonb(after)-'updated_at'-'created_at')::text)<>before.fingerprint
  ) then
    raise exception 'VERIFIED_SCREEN_CONTRACT_MUTATION_BLOCKED';
  end if;
end
\$\$;

select result::text from mass_design_result;
commit;
SQL
)"
preparation_json="$(psqlq -c "$preparation_sql")"

compilation_json="$(bash "$ROOT_DIR/ops/scripts/compile-cross-screen-contracts.sh" "$ROOT_DIR")"
audit_json="$(psqlq -c \
  "select framework_audit_executable_screen_designs('PROFESSIONAL_SCREEN_DESIGN_UPDATE')::text;")"

set +e
generation_output="$(
  ROOT_DIR="$ROOT_DIR" PGDATABASE="$DB" PGUSER="$DB_USER" \
  POSTGRES_POD="$leader" K8S_NAMESPACE="$NAMESPACE" \
  DESIGN_METADATA_LOCK_HELD=true \
  bash "$ROOT_DIR/ops/scripts/generate-incremental-screen-runtime.sh" "$ROOT_DIR" 2>&1
)"
generation_rc=$?
set -e
if (( generation_rc == 0 )) && jq -e . >/dev/null 2>&1 <<<"$generation_output"; then
  generation_json="$generation_output"
else
  generation_json="$(jq -cn --arg output "$generation_output" --argjson rc "$generation_rc" \
    '{status:"FAILED",exitCode:$rc,error:$output}')"
fi

quality_json="$(psqlq -c "
with status_counts as (
  select professional_status,count(*) total
  from framework_professional_screen_design_update_gate
  group by professional_status
), blocker_counts as (
  select blocker,count(*) total
  from framework_professional_screen_design_update_gate gate,
       unnest(gate.design_blocker_codes) blocker
  group by blocker
), coverage as (
  select
    (select count(*) from framework_page_design) page_designs,
    (select count(*) from framework_vertical_screen_design_map) ordered_pages,
    (select count(*) from framework_professional_screen_contract) screen_contracts,
    (select count(*) from framework_page_field_definition) fields,
    (select count(*) from framework_process_definition) processes,
    (select count(*) from framework_process_step) steps,
    (select count(*) from framework_simulation_case) tests,
    (select count(*) from framework_development_job) tasks
)
select jsonb_build_object(
  'coverage',(select to_jsonb(coverage) from coverage),
  'statusCounts',coalesce((
    select jsonb_object_agg(professional_status,total) from status_counts
  ),'{}'::jsonb),
  'blockerCounts',coalesce((
    select jsonb_object_agg(blocker,total) from blocker_counts
  ),'{}'::jsonb),
  'duplicateRoutes',(
    select count(*) from (
      select route_key from framework_executable_screen_design_gate
      group by route_key having count(*)>1
    ) duplicate
  ),
  'invalidRouteIdentities',(
    select count(*) from framework_professional_screen_design_update_gate
    where not route_identity_valid
  ),
  'designBlockedCount',(
    select count(*) from framework_professional_screen_design_update_gate
    where professional_status='DESIGN_BLOCKED'
  ),
  'designReadyCount',(
    select count(*) from framework_professional_screen_design_update_gate
    where professional_design_ready
  ),
  'verifiedContracts',(
    select count(*) from framework_professional_screen_contract
    where contract_status='VERIFIED'
  )
)::text;")"

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
elapsed_seconds="$(( $(date +%s) - start_epoch ))"
design_blocked_count="$(jq -r '.designBlockedCount // 0' <<<"$quality_json")"
generation_status="$(jq -r '.status // "GENERATED"' <<<"$generation_json")"
outcome="READY"
[[ "$design_blocked_count" != "0" ]] && outcome="DESIGN_BLOCKED"
[[ "$generation_status" == "FAILED" ]] && outcome="GENERATION_FAILED"

report_json="$(jq -cn \
  --arg startedAt "$started_at" \
  --arg finishedAt "$finished_at" \
  --arg outcome "$outcome" \
  --argjson elapsedSeconds "$elapsed_seconds" \
  --argjson limit "$DESIGN_LIMIT" \
  --argjson preparation "$preparation_json" \
  --argjson compilation "$compilation_json" \
  --argjson audit "$audit_json" \
  --argjson generation "$generation_json" \
  --argjson quality "$quality_json" \
  '{
    schemaVersion:1,
    command:"professional-screen-design-update",
    outcome:$outcome,
    startedAt:$startedAt,
    finishedAt:$finishedAt,
    elapsedSeconds:$elapsedSeconds,
    requestedLimit:$limit,
    verifiedContractPolicy:"IMMUTABLE_FAIL_CLOSED",
    preparation:$preparation,
    crossScreenCompilation:$compilation,
    executableDesignAudit:$audit,
    incrementalGeneration:$generation,
    quality:$quality
  }')"

printf '%s\n' "$report_json" | jq . >"$REPORT_FILE"
latest_tmp="$REPORT_DIR/.latest.$$.json"
cp "$REPORT_FILE" "$latest_tmp"
mv -f "$latest_tmp" "$LATEST_FILE"
printf '%s\n' "$report_json" | jq -c .

[[ "$outcome" != "GENERATION_FAILED" ]]

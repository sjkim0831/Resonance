#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -n "${CARBONET_DEPLOY_ROOT:-}" ]]; then
  ROOT="$CARBONET_DEPLOY_ROOT"
elif ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  ROOT="$SCRIPT_DIR"
fi
NODE_BIN="${NODE_BIN:-node}"

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
carbonet_qa_load_credentials \
  CARBONET_VALIDATE_USER CARBONET_VALIDATE_PASSWORD \
  "${CARBONET_VALIDATE_USER:-}" "${CARBONET_VALIDATE_PASSWORD:-}" \
  "${CARBONET_SCREEN_CONTRACT_AUTH_SECRET:-carbonet-screen-smoke}" \
  "${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
export CARBONET_VALIDATE_USER CARBONET_VALIDATE_PASSWORD

candidate_mode=false
preview_mode=false
[[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == "candidate" ]] && candidate_mode=true
[[ "$candidate_mode" == true || "${CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY:-}" == 1 ]] && preview_mode=true
if [[ "$preview_mode" != true ]]; then
  exec "$NODE_BIN" "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs"
fi

POSTGRES_ADAPTER="$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
[[ -f "$POSTGRES_ADAPTER" ]] || { echo '[screen-contract-runtime-save] PostgreSQL query adapter missing' >&2; exit 1; }
# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$POSTGRES_ADAPTER"
CARBONET_PG_NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}"
carbonet_postgres_query_init
SCREEN_ITEM_ID="${CARBONET_SCREEN_CONTRACT_ITEM_ID:-26}"
[[ "$SCREEN_ITEM_ID" =~ ^[1-9][0-9]*$ ]] || { echo '[screen-contract-runtime-save] item id is invalid' >&2; exit 1; }
TARGET_CONTRACT_ID="$(carbonet_postgres_query "select c.contract_id
  from framework_page_development_item item
  join framework_screen_resource screen using(screen_resource_id)
  join framework_professional_screen_contract c
    on lower(split_part(c.route_path,'?',1))=screen.route_key
 where item.item_id=$SCREEN_ITEM_ID
 order by c.process_code,c.step_code,c.audience,c.contract_id
 limit 1")"
[[ "$TARGET_CONTRACT_ID" =~ ^[1-9][0-9]*$ ]] || {
  echo "[screen-contract-runtime-save] target contract is unavailable for item=$SCREEN_ITEM_ID" >&2
  exit 1
}

# Hash only the exact preview target plus global cardinalities and the two
# sequences the runtime publication path could allocate. A concurrent design
# scheduler may update unrelated contract timestamps and consume contract IDs;
# those benign changes must not mask target mutation or fail this gate.
screen_target_state_digest() {
  carbonet_postgres_query "select encode(sha256(convert_to(jsonb_build_object(
    'targetContract',coalesce((select to_jsonb(c) from framework_professional_screen_contract c where c.contract_id=$TARGET_CONTRACT_ID),'null'::jsonb),
    'targetBindings',coalesce((select jsonb_agg(to_jsonb(b) order by b.screen_key) from framework_screen_contract_binding b where b.contract_id=$TARGET_CONTRACT_ID),'[]'::jsonb),
    'targetVersions',coalesce((select jsonb_agg(to_jsonb(v) order by v.version_id) from framework_screen_contract_version v where v.contract_id=$TARGET_CONTRACT_ID),'[]'::jsonb),
    'targetEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.event_id) from framework_screen_contract_event e where e.screen_key in(select b.screen_key from framework_screen_contract_binding b where b.contract_id=$TARGET_CONTRACT_ID)),'[]'::jsonb),
    'targetPageItem',coalesce((select to_jsonb(i) from framework_page_development_item i where i.item_id=$SCREEN_ITEM_ID),'null'::jsonb),
    'publicationSequences',coalesce((select jsonb_agg(jsonb_build_object('sequenceName',s.sequencename,'lastValue',s.last_value) order by s.sequencename)
      from pg_sequences s where s.schemaname=current_schema() and s.sequencename=any(array[
        regexp_replace(pg_get_serial_sequence('framework_screen_contract_version','version_id'),'^.*\\.',''),
        regexp_replace(pg_get_serial_sequence('framework_screen_contract_event','event_id'),'^.*\\.','')
      ])),'[]'::jsonb),
    'tableCounts',jsonb_build_object(
      'contracts',(select count(*) from framework_professional_screen_contract),
      'bindings',(select count(*) from framework_screen_contract_binding),
      'versions',(select count(*) from framework_screen_contract_version),
      'events',(select count(*) from framework_screen_contract_event),
      'pageItems',(select count(*) from framework_page_development_item)
    )
  )::text,'UTF8')),'hex')"
}

SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}"
[[ "$candidate_mode" != true || "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || {
  echo '[screen-contract-runtime-save] candidate source commit is missing or invalid' >&2
  exit 1
}
result_file="$(mktemp /tmp/screen-contract-runtime-preview.XXXXXX.json)"
enriched_file="$(mktemp /tmp/screen-contract-runtime-preview-enriched.XXXXXX.json)"
trap 'rm -f "$result_file" "$enriched_file"' EXIT
database_state_before="$(screen_target_state_digest)"
[[ "$database_state_before" =~ ^[0-9a-f]{64}$ ]] || { echo '[screen-contract-runtime-save] pre-preview DB digest invalid' >&2; exit 1; }
node_status=0
"$NODE_BIN" "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs" >"$result_file" || node_status=$?
database_state_after="$(screen_target_state_digest)"
[[ "$database_state_after" =~ ^[0-9a-f]{64}$ ]] || { echo '[screen-contract-runtime-save] post-preview DB digest invalid' >&2; exit 1; }
if [[ "$database_state_after" != "$database_state_before" ]]; then
  echo '[screen-contract-runtime-save] FAIL preview changed canonical rows or a PostgreSQL sequence' >&2
  cat "$result_file" >&2
  exit 1
fi
if (( node_status != 0 )); then
  cat "$result_file" >&2
  exit "$node_status"
fi
jq --arg before "$database_state_before" --arg after "$database_state_after" \
  --arg itemId "$SCREEN_ITEM_ID" --arg contractId "$TARGET_CONTRACT_ID" \
  '. + {databaseStateHashBefore:$before,databaseStateHashAfter:$after,databaseCurrentWrites:0,
    databaseTarget:{itemId:$itemId,contractId:$contractId}}' \
  "$result_file" >"$enriched_file"
mv -f "$enriched_file" "$result_file"
jq -e '
  .success==true and .previewMode==true and .previewCount==3 and .rolledBack==true
  and .databaseTarget.itemId==.itemId and .databaseTarget.contractId==.contractId
  and .canonicalStateUnchanged==true
  and .databaseCurrentWrites==0 and .databaseStateHashBefore==.databaseStateHashAfter
  and .contractHashBefore==.contractHashAfter and .runtimeHashBefore==.runtimeHashAfter
  and .prediction.stable==true and (.prediction.fingerprint|test("^[0-9a-f]{64}$"))
  and (.prediction.contractHash|test("^[0-9a-f]{32}$"))
  and (.prediction.versionNo>=1) and (.prediction.bindingCount>=1)
  and .prediction.published==false
  and ([.saves[]|select(
    .publication.predicted==true and .publication.applied==false
    and .publication.published==false
    and .publication.publicationMode=="PREDICTED_READ_ONLY"
    and ((.publication.reason=="UNCHANGED" and .publication.wouldPublish==false)
      or ((.publication.reason=="DESIGN_CHANGED" or .publication.reason=="HISTORICAL_VERSION_REUSED")
        and .publication.wouldPublish==true))
  )]|length)==3
  and ([.saves[]|select(.preview==true and .rolledBack==true and .committed==false
    and .mutationScope=="READ_ONLY_PREDICTION")]|length)==3
' "$result_file" >/dev/null || {
  echo '[screen-contract-runtime-save] candidate preview/rollback contract failed' >&2
  cat "$result_file" >&2
  exit 1
}
cat "$result_file"
if [[ "$candidate_mode" == true ]]; then
  jq -c '{itemId,contractId,target,databaseTarget,previewCount,rolledBack,prediction,canonicalStateUnchanged,databaseCurrentWrites,databaseStateHashBefore,databaseStateHashAfter,contractHashBefore,contractHashAfter,runtimeHashBefore,runtimeHashAfter,resolveMs,versionNo,screenKey,pageProbe}' "$result_file" |
    bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" \
      SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW __RELEASE__ RELEASE_GATE "$SOURCE_COMMIT"
fi

#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"; NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"; DB="${PGDATABASE:-carbonet}"; DB_USER="${PGUSER:-postgres}"; MAX_PARALLEL_WORKERS="${MAX_PARALLEL_WORKERS:-3}"
BUSINESS_E2E_RUNNER="${CURRENT_BUSINESS_E2E_RUNNER:-/opt/resonance-data/control-plane/bin/run-next-current-business-e2e.sh}"
BUSINESS_E2E_REGISTRY="${BUSINESS_E2E_RUNNER_REGISTRY:-/opt/resonance-data/control-plane/runtime-metadata/business-e2e-runner-registry.json}"
BUSINESS_E2E_RUNTIME_ROOT="${BUSINESS_E2E_RUNTIME_ROOT:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
PROJECT_WORK_RUNNER="${PROJECT_WORK_RUNNER:-$ROOT_DIR/ops/scripts/run-hermes-project-work.sh}"
PROCESS_DEVELOPMENT_DISPATCHER="${PROCESS_DEVELOPMENT_DISPATCHER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-process-development-dispatcher.sh}"
LOCK_FILE="${PROJECT_AUTO_COMPLETION_LOCK:-/tmp/resonance-project-auto-completion.lock}"
HEAVY_DB_LOCK_FILE="${RESONANCE_HEAVY_DB_LOCK_FILE:-/opt/resonance-data/control-plane/run/heavy-db-automation.lock}"
AUTOMATION_PGOPTIONS="${PROJECT_AUTO_COMPLETION_PGOPTIONS:--c work_mem=16MB -c maintenance_work_mem=128MB -c statement_timeout=180000 -c lock_timeout=10000}"

canonical_generation_decision() {
  local before="$1" after="$2" canonical="$3" active="$4" failed="$5" exact="$6" queued="$7"
  if (( failed > 0 && active == 0 )); then
    jq -cn --argjson before "$before" --argjson after "$after" \
      --argjson canonical "$canonical" --argjson failed "$failed" --argjson queued "$queued" \
      '{status:"FAILED",reason:"CANONICAL_EVIDENCE_JOB_FAILED",readyBefore:$before,readyAfter:$after,canonicalReady:$canonical,failedJobs:$failed,queuedJobs:$queued,elapsedMillis:0}'
  else
    jq -cn --argjson before "$before" --argjson after "$after" \
      --argjson canonical "$canonical" --argjson active "$active" \
      --argjson exact "$exact" --argjson queued "$queued" \
      '{status:"DEFERRED",reason:"CANONICAL_EVIDENCE_PUBLICATION_PENDING",readyBefore:$before,readyAfter:$after,canonicalReady:$canonical,activeJobs:$active,exactEvidenceJobs:$exact,queuedJobs:$queued,elapsedMillis:0}'
  fi
}

# This compiler adapter intentionally lives in the installed orchestrator.  It
# reuses the already-selected Patroni leader and psqlq() instead of loading code
# or credentials from a mutable checkout during a rolling deployment.
design_causality_compiler_result() {
  local phase="$1" result="$2" stage="$3" migration_ready="$4"
  local authorized="$5" attempts="$6" compiled="$7" semantic_noops="$8"
  local busy_retries="$9" database_retries="${10}" dirty_at_linearization="${11}"
  local revision_before="${12}" revision_after="${13}" current_event_id="${14}"
  local canonical_hash="${15}" canonical_schema_version="${16}"
  local codegen_input_hash="${17}" codegen_readiness="${18}"
  local codegen_readiness_reasons="${19}" active_binding_count="${20}"
  local elapsed_millis="${21}"
  printf '{"schema":"carbonet.design-causality-compiler-invocation/v2","phase":"%s","result":"%s","currentStage":"%s","migrationReady":%s,"authorized":%s,"attempts":%s,"compiledEvents":%s,"semanticNoops":%s,"busyRetries":%s,"databaseRetries":%s,"dirtyAtLinearization":%s,"revisionBefore":%s,"revisionAfter":%s,"currentEventId":%s,"canonicalHash":"%s","canonicalSchemaVersion":%s,"codegenInputHash":"%s","codegenReadiness":"%s","codegenReadinessReasons":%s,"activeBindingCount":%s,"elapsedMillis":%s}\n' \
    "$phase" "$result" "$stage" "$migration_ready" "$authorized" \
    "$attempts" "$compiled" "$semantic_noops" "$busy_retries" \
    "$database_retries" "$dirty_at_linearization" "$revision_before" \
    "$revision_after" "$current_event_id" "$canonical_hash" \
    "$canonical_schema_version" "$codegen_input_hash" "$codegen_readiness" \
    "$codegen_readiness_reasons" \
    "$active_binding_count" "$elapsed_millis"
}

design_causality_compiler_log() {
  printf '[design-causality-compiler] %s\n' "$*" >&2
}

run_design_causality_post_commit_compiler() {
  local phase="${1:-UNSPECIFIED}"
  local max_attempts="${DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS:-4}"
  local retry_delay="${DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS:-1}"
  local wall_timeout="${DESIGN_CAUSALITY_COMPILER_WALL_TIMEOUT_SECONDS:-2}"
  local readiness stage compile_status compiler_response compiler_error compiler_rc extra
  local before_revision head_revision canonical_schema_version current_event_id
  local dirty_signal_count canonical_hash codegen_input_hash codegen_readiness
  local codegen_readiness_reasons active_binding_count
  local reason_count reason_has_active reason_meta
  local revision_before=''
  local attempts=0 compiled=0 semantic_noops=0 busy_retries=0 database_retries=0
  local started_millis elapsed_millis
  started_millis="$(date +%s%3N)"

  if [[ ! "$phase" =~ ^[A-Z][A-Z0-9_]{0,31}$ ]] ||
     [[ ! "$max_attempts" =~ ^[1-4]$ ]] ||
     [[ ! "$retry_delay" =~ ^[0-1]$ ]] ||
     [[ "$wall_timeout" != 2 ]]; then
    design_causality_compiler_log \
      "phase=CONFIGURATION_ERROR result=REJECTED"
    return 64
  fi
  if ! declare -F psqlq >/dev/null 2>&1; then
    design_causality_compiler_log \
      "phase=$phase result=PSQLQ_ADAPTER_MISSING"
    return 69
  fi

  if ! readiness="$(PSQLQ_WALL_TIMEOUT_SECONDS="$wall_timeout" \
    psqlq -v VERBOSITY=terse -c "
    with objects as (
      select
        to_regrole('carbonet_design_compiler') role_oid,
        to_regprocedure(
          'public.framework_run_design_causality_compiler_worker()'
        ) worker_oid,
        to_regprocedure(
          'public.framework_compile_design_changes(character varying,bigint,character varying)'
        ) compiler_oid,
        to_regprocedure(
          'public.framework_design_causality_codegen_input_component()'
        ) codegen_component_oid,
        to_regprocedure(
          'public.framework_design_causality_codegen_readiness()'
        ) codegen_readiness_oid
    ), expected_trigger(trigger_name,relation_name,function_signature) as (values
      ('trg_design_causality_screen_blueprint_codegen_dirty','framework_screen_blueprint','framework_capture_design_causality_codegen_dirty()'),
      ('trg_design_causality_professional_screen_codegen_dirty','framework_professional_screen_contract','framework_capture_design_causality_codegen_dirty()'),
      ('trg_design_causality_step_execution_codegen_dirty','framework_step_execution_spec','framework_capture_design_causality_codegen_dirty()'),
      ('trg_design_causality_screen_blueprint_codegen_truncate_dirty','framework_screen_blueprint','framework_capture_design_causality_codegen_truncate_dirty()'),
      ('trg_design_causality_professional_screen_codegen_truncate_dirty','framework_professional_screen_contract','framework_capture_design_causality_codegen_truncate_dirty()'),
      ('trg_design_causality_step_execution_codegen_truncate_dirty','framework_step_execution_spec','framework_capture_design_causality_codegen_truncate_dirty()'),
      ('trg_design_causality_permission_requirement_cache_dirty','framework_permission_requirement_v1','framework_capture_design_permission_cache_dirty()'),
      ('trg_design_causality_menu_function_cache_dirty','comtnmenufunctioninfo','framework_capture_design_permission_cache_dirty()'),
      ('trg_design_causality_page_design_cache_dirty','framework_page_design','framework_capture_design_permission_cache_dirty()'),
      ('trg_design_causality_page_field_cache_dirty','framework_page_field_definition','framework_capture_design_permission_cache_dirty()'),
      ('trg_design_causality_mapping_cache_dirty','framework_permission_mapping_control_v1','framework_capture_design_permission_cache_dirty()'),
      ('trg_design_causality_process_step_raw_csv_dirty','framework_process_step','framework_capture_design_causality_process_step_raw_dirty()'),
      ('trg_design_causality_process_definition_truncate_dirty','framework_process_definition','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_process_step_truncate_dirty','framework_process_step','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_actor_truncate_dirty','framework_actor_definition','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_account_assignment_truncate_dirty','framework_account_actor_assignment','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_permission_requirement_truncate_dirty','framework_permission_requirement_v1','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_permission_grant_truncate_dirty','framework_permission_grant_v1','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_mapping_truncate_dirty','framework_permission_mapping_control_v1','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_page_design_truncate_dirty','framework_page_design','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_page_field_truncate_dirty','framework_page_field_definition','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_menu_function_truncate_dirty','comtnmenufunctioninfo','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_role_function_grant_truncate_dirty','comtnauthorfunctionrelate','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_user_override_grant_truncate_dirty','comtnuserfeatureoverride','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_account_role_grant_truncate_dirty','comtnemplyrscrtyestbs','framework_capture_design_causality_v2_truncate_dirty()'),
      ('trg_design_causality_source_classification_guard','framework_design_causality_stage','framework_enforce_design_causality_source_classification()')
    )
    select case
      when role_oid is null or worker_oid is null or compiler_oid is null
        or codegen_component_oid is null or codegen_readiness_oid is null
        or not exists(
          select 1 from information_schema.columns
          where table_schema='public' and table_name='framework_design_causality_head'
            and column_name='codegen_input_hash' and udt_name='varchar'
        ) or not exists(
          select 1 from information_schema.columns
          where table_schema='public' and table_name='framework_design_causality_event'
            and column_name='codegen_input_hash' and udt_name='varchar'
        ) or exists(
          select 1 from expected_trigger e
          left join pg_trigger t
            on t.tgname=e.trigger_name and not t.tgisinternal and t.tgenabled='A'
           and t.tgrelid=to_regclass('public.'||e.relation_name)
           and t.tgfoid=to_regprocedure('public.'||e.function_signature)
          where t.oid is null
        )
        then 'MIGRATION_NOT_READY'
      when exists(
        select 1 from pg_roles where oid=role_oid and (
          rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolcanlogin
          or rolreplication or rolbypassrls or rolconnlimit<>-1
          or rolvaliduntil is not null or rolconfig is not null
        )
      ) or exists(
        select 1 from pg_authid
        where oid=role_oid and rolpassword is not null
      ) or exists(select 1 from pg_auth_members where member=role_oid)
        then 'CONTRACT_INVALID'
      when (select count(*) from pg_auth_members where roleid=role_oid)<>1
        or not exists(
          select 1 from pg_auth_members
          where roleid=role_oid and member=(session_user::regrole)::oid
            and not admin_option and not inherit_option and set_option
        ) then 'NOT_AUTHORIZED'
      when not has_function_privilege(role_oid,worker_oid,'EXECUTE')
        or exists(
          select 1 from unnest(ARRAY[
            to_regprocedure('public.framework_mark_design_causality_dirty(integer)'),
            to_regprocedure('public.framework_capture_design_causality_dirty()'),
            to_regprocedure('public.framework_design_causality_snapshot()'),
            to_regprocedure('public.framework_design_causality_process_component()'),
            to_regprocedure('public.framework_design_causality_actor_component()'),
            to_regprocedure('public.framework_design_causality_account_component()'),
            to_regprocedure('public.framework_design_causality_permission_requirement_component()'),
            to_regprocedure('public.framework_design_causality_permission_grant_component()'),
            to_regprocedure('public.framework_design_causality_codegen_input_component()'),
            to_regprocedure('public.framework_design_causality_codegen_readiness()'),
            to_regprocedure('public.framework_design_causality_valid_inventory_item(jsonb)'),
            to_regprocedure('public.framework_design_causality_valid_incremental_item(jsonb)'),
            to_regprocedure('public.framework_design_causality_codegen_semantic_row(text,jsonb)'),
            to_regprocedure('public.framework_capture_design_causality_codegen_dirty()'),
            to_regprocedure('public.framework_capture_design_causality_codegen_truncate_dirty()'),
            to_regprocedure('public.framework_capture_design_permission_cache_dirty()'),
            to_regprocedure('public.framework_capture_design_causality_v2_truncate_dirty()'),
            to_regprocedure('public.framework_capture_design_causality_process_step_raw_dirty()'),
            to_regprocedure('public.framework_refresh_design_codegen_blueprint_leaf(bigint)'),
            to_regprocedure('public.framework_refresh_design_codegen_contract_leaf(bigint)'),
            to_regprocedure('public.framework_refresh_design_codegen_step_leaf(text,text)'),
            to_regprocedure('public.framework_refresh_design_permission_requirement_leaf(text,text,text,text)'),
            to_regprocedure('public.framework_refresh_design_permission_feature_leaf(text)'),
            to_regprocedure('public.framework_refresh_design_permission_field_leaf(bigint)'),
            to_regprocedure('public.framework_refresh_design_permission_page_leafs(bigint)'),
            to_regprocedure('public.framework_enforce_design_causality_source_classification()'),
            to_regprocedure('public.framework_compile_design_changes(character varying,bigint,character varying)'),
            to_regprocedure('public.framework_cas_design_causality_stage(bigint,character varying,bigint,character varying,character varying,jsonb)'),
            to_regprocedure('public.framework_design_causality_status()')
          ]) protected_oid
          where protected_oid is null or
            has_function_privilege(role_oid,protected_oid,'EXECUTE')
        )
        then 'CONTRACT_INVALID'
      when exists(
        select 1 from unnest(ARRAY[
          to_regclass('public.framework_permission_requirement_v1'),
          to_regclass('public.framework_permission_grant_v1'),
          to_regclass('public.framework_permission_mapping_control_v1'),
          to_regclass('public.framework_design_change_signal'),
          to_regclass('public.framework_design_causality_head'),
          to_regclass('public.framework_design_causality_event'),
          to_regclass('public.framework_design_causality_event_signal'),
          to_regclass('public.framework_design_causality_stage'),
          to_regclass('public.framework_design_causality_stage_transition'),
          to_regclass('public.framework_process_definition'),
          to_regclass('public.framework_process_step'),
          to_regclass('public.framework_actor_definition'),
          to_regclass('public.framework_account_actor_assignment'),
          to_regclass('public.framework_page_design'),
          to_regclass('public.framework_page_field_definition'),
          to_regclass('public.framework_screen_blueprint'),
          to_regclass('public.framework_step_execution_spec'),
          to_regclass('public.framework_professional_screen_contract'),
          to_regclass('public.framework_design_codegen_blueprint_leaf_cache'),
          to_regclass('public.framework_design_codegen_contract_leaf_cache'),
          to_regclass('public.framework_design_codegen_step_leaf_cache'),
          to_regclass('public.framework_design_permission_requirement_leaf_cache'),
          to_regclass('public.framework_design_permission_feature_leaf_cache'),
          to_regclass('public.framework_design_permission_field_leaf_cache'),
          to_regclass('public.framework_canonical_endpoint_upgrade_activation_event'),
          to_regclass('public.comtnmenufunctioninfo'),
          to_regclass('public.comtnauthorfunctionrelate'),
          to_regclass('public.comtnuserfeatureoverride'),
          to_regclass('public.comtnemplyrscrtyestbs')
        ]) relation_oid
        where relation_oid is null or has_table_privilege(
          role_oid,relation_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
      ) then 'CONTRACT_INVALID'
      when exists(
        select 1 from unnest(ARRAY[
          to_regclass('public.framework_design_change_signal_signal_id_seq'),
          to_regclass('public.framework_design_causality_event_event_id_seq')
        ]) sequence_oid
        where sequence_oid is null or has_sequence_privilege(
          role_oid,sequence_oid,'USAGE,SELECT,UPDATE'
        )
      ) or not has_schema_privilege(role_oid,'public','USAGE')
        or has_schema_privilege(role_oid,'public','CREATE')
        then 'CONTRACT_INVALID'
      when exists(
        select 1 from pg_proc worker join pg_proc compiler on compiler.oid=compiler_oid
        where worker.oid=worker_oid and (
          not worker.prosecdef or worker.proowner<>compiler.proowner or
          not coalesce(worker.proconfig,'{}'::text[]) @>
            ARRAY['search_path=pg_catalog, public']::text[]
        )
      ) then 'CONTRACT_INVALID'
      when exists(
        select 1 from pg_proc p
        cross join lateral aclexplode(
          coalesce(p.proacl,acldefault('f',p.proowner))
        ) acl
        where p.oid=worker_oid and acl.grantee=0
          and acl.privilege_type='EXECUTE'
      ) then 'CONTRACT_INVALID'
      when exists(select 1 from pg_class where relowner=role_oid)
        or exists(select 1 from pg_proc where proowner=role_oid)
        or exists(select 1 from pg_namespace where nspowner=role_oid)
        or exists(select 1 from pg_type where typowner=role_oid)
        then 'CONTRACT_INVALID'
      when to_regrole('carbonet_app') is not null and
        has_function_privilege(to_regrole('carbonet_app'),worker_oid,'EXECUTE')
        then 'CONTRACT_INVALID'
      else 'READY'
    end from objects;" 2>/dev/null)"; then
    design_causality_compiler_log \
      "phase=$phase result=READINESS_QUERY_FAILED"
    return 75
  fi
  readiness="${readiness//$'\r'/}"

  case "$readiness" in
    MIGRATION_NOT_READY)
      design_causality_compiler_log \
        "phase=$phase result=MIGRATION_NOT_READY"
      return 75
      ;;
    NOT_AUTHORIZED)
      design_causality_compiler_log \
        "phase=$phase result=NOT_AUTHORIZED"
      return 77
      ;;
    CONTRACT_INVALID)
      design_causality_compiler_log \
        "phase=$phase result=CONTRACT_INVALID"
      return 78
      ;;
    READY) ;;
    *)
      design_causality_compiler_log \
        "phase=$phase result=INVALID_READINESS_RESPONSE"
      return 70
      ;;
  esac

  while (( attempts < max_attempts )); do
    attempts=$((attempts+1))
    compiler_error=''
    if compiler_response="$(PSQLQ_WALL_TIMEOUT_SECONDS="$wall_timeout" \
      psqlq -v VERBOSITY=verbose -c "
      begin isolation level repeatable read;
      set local statement_timeout='2s';
      set local lock_timeout='1s';
      set local role carbonet_design_compiler;
      with invoked as materialized (
        select framework_run_design_causality_compiler_worker() result
      )
      select coalesce(result->>'status','INVALID')||'|'||
             coalesce(result->>'currentStage','INVALID')||'|'||
             coalesce(result->>'beforeRevision','INVALID')||'|'||
             coalesce(result->>'headRevision','INVALID')||'|'||
             coalesce(result->>'canonicalSchemaVersion','INVALID')||'|'||
             coalesce(result->>'currentEventId','null')||'|'||
             coalesce(result->>'dirtySignalCount','INVALID')||'|'||
             coalesce(result->>'canonicalHash','INVALID')||'|'||
             coalesce(result->>'codegenInputHash','null')||'|'||
             coalesce(result#>>'{codegenReadiness,status}','INVALID')||'|'||
             coalesce(result#>'{codegenReadiness,reasons}','[]'::jsonb)::text||'|'||
             coalesce(result#>>'{codegenReadiness,activeBindingCount}','null')
      from invoked;
      commit;" 2>&1)"; then
      compiler_response="${compiler_response//$'\r'/}"
      IFS='|' read -r compile_status stage before_revision head_revision \
        canonical_schema_version current_event_id dirty_signal_count canonical_hash \
        codegen_input_hash codegen_readiness codegen_readiness_reasons \
        active_binding_count extra <<<"$compiler_response"
      if [[ -n "${extra:-}" ]] || [[ ! "$stage" =~ ^[A-Z][A-Z_]{0,31}$ ]] ||
         [[ ! "$before_revision" =~ ^[0-9]+$ ]] ||
         [[ ! "$head_revision" =~ ^[0-9]+$ ]] ||
         [[ ! "$canonical_schema_version" =~ ^[12]$ ]] ||
         [[ ! "$current_event_id" =~ ^(null|[1-9][0-9]*)$ ]] ||
         [[ ! "$dirty_signal_count" =~ ^[0-9]+$ ]] ||
         [[ ! "$canonical_hash" =~ ^[0-9a-f]{64}$ ]] ||
         [[ ! "$codegen_input_hash" =~ ^(null|[0-9a-f]{64})$ ]] ||
         [[ ! "$codegen_readiness" =~ ^(READY|BLOCKED)$ ]] ||
         ! python3 -c 'import json,re,sys
x=json.loads(sys.argv[1]);sys.exit(0 if isinstance(x,list) and len(x)<=16 and all(isinstance(v,str) and re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}",v) for v in x) else 1)' \
           "$codegen_readiness_reasons" >/dev/null 2>&1 ||
         [[ ! "$active_binding_count" =~ ^(null|[0-9]+)$ ]]; then
        design_causality_compiler_log \
          "phase=$phase result=INVALID_COMPILER_RESPONSE attempts=$attempts"
        return 70
      fi
      reason_count="$(python3 -c 'import json,sys
print(len(json.loads(sys.argv[1])))' "$codegen_readiness_reasons")"
      if [[ "$codegen_readiness" == READY && "$reason_count" != 0 ]] ||
         [[ "$codegen_readiness" == BLOCKED && "$reason_count" == 0 ]]; then
        design_causality_compiler_log \
          "phase=$phase result=CONTRADICTORY_READINESS attempts=$attempts"
        return 70
      fi
      [[ -n "$revision_before" ]] || revision_before="$before_revision"
      case "$compile_status" in
        COMPILED)
          (( head_revision == before_revision + 1 )) || {
            design_causality_compiler_log \
              "phase=$phase result=INVALID_HEAD_ADVANCE attempts=$attempts"
            return 70
          }
          compiled=$((compiled+1))
          ;;
        NO_SEMANTIC_CHANGE)
          (( head_revision == before_revision )) || {
            design_causality_compiler_log \
              "phase=$phase result=INVALID_NOOP_HEAD attempts=$attempts"
            return 70
          }
          semantic_noops=$((semantic_noops+1))
          ;;
        NO_WORK)
          if (( head_revision != before_revision || dirty_signal_count != 0 )); then
            design_causality_compiler_log \
              "phase=$phase result=INVALID_NO_WORK_PROOF attempts=$attempts"
            return 70
          fi
          if [[ "$canonical_schema_version" != 2 ]] ||
             [[ ! "$codegen_input_hash" =~ ^[0-9a-f]{64}$ ]]; then
            design_causality_compiler_log \
              "phase=$phase result=SCHEMA_V2_NOT_READY attempts=$attempts"
            return 75
          fi
          # A captured v2 raw-source root may be BLOCKED while this orchestrator
          # repairs duplicate/incomplete source contracts. PRE_WORK proves the
          # immutable input snapshot; generation remains gated below on READY.
          elapsed_millis="$(( $(date +%s%3N) - started_millis ))"
          if (( attempts == 1 && compiled == 0 && semantic_noops == 0 )); then
            compile_status='NO_WORK'
          else
            compile_status='DRAINED'
          fi
          design_causality_compiler_log \
            "phase=$phase result=$compile_status currentStage=$stage attempts=$attempts dirtyAtLinearization=0 elapsedMillis=$elapsed_millis"
          design_causality_compiler_result \
            "$phase" "$compile_status" "$stage" true true "$attempts" \
            "$compiled" "$semantic_noops" "$busy_retries" "$database_retries" 0 \
            "$revision_before" "$head_revision" "$current_event_id" \
            "$canonical_hash" "$canonical_schema_version" \
            "$codegen_input_hash" "$codegen_readiness" \
            "$codegen_readiness_reasons" \
            "$active_binding_count" "$elapsed_millis"
          return 0
          ;;
        BUSY) busy_retries=$((busy_retries+1)) ;;
        *)
          design_causality_compiler_log \
            "phase=$phase result=INVALID_COMPILER_RESPONSE attempts=$attempts"
          return 70
          ;;
      esac
    else
      compiler_rc=$?
      compiler_error="$compiler_response"
      if (( compiler_rc == 2 || compiler_rc == 124 || compiler_rc == 137 || compiler_rc == 143 )) ||
         [[ "$compiler_error" =~ ERROR:[[:space:]]+(40001|40P01): ]]; then
        compile_status='DATABASE_RETRY'
        database_retries=$((database_retries+1))
      else
        # Never print the captured driver/function diagnostic. Contract/ACL
        # errors are fatal; only transport, serialization, and deadlock retry.
        : "$compiler_error"
        design_causality_compiler_log \
          "phase=$phase result=DATABASE_FATAL attempts=$attempts rc=$compiler_rc"
        return 70
      fi
    fi

    if (( attempts < max_attempts )); then
      design_causality_compiler_log \
        "phase=$phase result=$compile_status attempt=$attempts retrying=true"
      (( retry_delay == 0 )) || sleep "$retry_delay"
    fi
  done

  design_causality_compiler_log \
    "phase=$phase result=RETRY_BUDGET_EXHAUSTED attempts=$attempts"
  return 75
}

# Drain and persist the post-work compiler result exactly once for every path
# that can exit after project mutations.  The failure record is deliberately
# enum/count-only; captured database diagnostics never enter the run ledger.
finalize_design_causality_post_work() {
  local completion_run_id="${1:-}"
  local invocation='' persisted='' failure_invocation='' failure_reason='' compiler_rc=70
  if [[ ! "$completion_run_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    design_causality_compiler_log \
      'phase=POST_WORK result=INVALID_COMPLETION_RUN_ID'
    return 64
  fi

  if invocation="$(run_design_causality_post_commit_compiler POST_WORK)"; then
    if persisted="$(psqlq -c "update framework_project_completion_run
      set result_json=jsonb_set(
        coalesce(framework_try_jsonb(result_json),'{}'::jsonb),
        '{designCausality,compilerInvocation,postWork}',
        \$design_causality\$$invocation\$design_causality\$::jsonb,
        true
      )::text
      where run_id='$completion_run_id' and run_status='RUNNING'
      returning 1;" 2>/dev/null)" && [[ "$persisted" == 1 ]]; then
      printf '%s\n' "$invocation"
      return 0
    fi
    compiler_rc=70
    failure_reason='EVIDENCE_PERSIST_FAILED'
  else
    compiler_rc=$?
    failure_reason='COMPILER_FAILED'
  fi

  failure_invocation="$(printf \
    '{"schema":"carbonet.design-causality-compiler-invocation/v2","phase":"POST_WORK","result":"FAILED","reason":"%s","exitCode":%s}' \
    "$failure_reason" "$compiler_rc")"
  psqlq -c "update framework_project_completion_run
    set run_status='FAILED',completed_at=current_timestamp,
        result_json=jsonb_set(
          coalesce(framework_try_jsonb(result_json),'{}'::jsonb),
          '{designCausality,compilerInvocation,postWork}',
          \$design_causality\$$failure_invocation\$design_causality\$::jsonb,
          true
        )::text
    where run_id='$completion_run_id' and run_status='RUNNING';" >/dev/null 2>&1 || true
  printf '%s\n' "$failure_invocation"
  return "$compiler_rc"
}

finalize_hermes_policy_invalid_run() {
  local completion_run_id="${1:-}" selected_count="${2:-}"
  local executable_count="${3:-}" retried_count="${4:-}"
  local invocation='' persisted='' compiler_rc=70
  if [[ ! "$completion_run_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] ||
     [[ ! "$selected_count" =~ ^[0-9]+$ ]] ||
     [[ ! "$executable_count" =~ ^[0-9]+$ ]] ||
     [[ ! "$retried_count" =~ ^[0-9]+$ ]]; then
    return 64
  fi
  if invocation="$(finalize_design_causality_post_work "$completion_run_id")"; then
    :
  else
    compiler_rc=$?
    return "$compiler_rc"
  fi
  if persisted="$(psqlq -c "update framework_project_completion_run
    set run_status='ATTENTION_REQUIRED',selected_process_count=$selected_count,
        executable_job_count=$executable_count,retried_job_count=$retried_count,
        blocked_process_count=1,
        result_json=(coalesce(framework_try_jsonb(result_json),'{}'::jsonb)||
          jsonb_build_object('reason','HERMES_PROJECT_WORK_POLICY_INVALID'))::text,
        completed_at=current_timestamp
    where run_id='$completion_run_id' and run_status='RUNNING'
    returning 1;" 2>/dev/null)" && [[ "$persisted" == 1 ]]; then
    printf '%s\n' "$invocation"
    return 0
  fi
  psqlq -c "update framework_project_completion_run
    set run_status='FAILED',completed_at=current_timestamp,
        result_json=(coalesce(framework_try_jsonb(result_json),'{}'::jsonb)||
          jsonb_build_object('reason','HERMES_RESULT_PERSIST_FAILED'))::text
    where run_id='$completion_run_id';" >/dev/null 2>&1 || true
  return 70
}

# Signal/ERR handlers must not publish a partial snapshot or wait behind a
# compiler lock.  They preserve dirty signals for the next PRE_WORK gate and
# record that recovery obligation without overwriting an existing POST result.
record_design_causality_deferred_recovery() {
  local completion_run_id="${1:-}" reason="${2:-}" signal="${3:-null}"
  local exit_code="${4:-}" failed_line="${5:-null}" deferred_json='' persisted=''
  if [[ ! "$completion_run_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] ||
     [[ ! "$reason" =~ ^(ORCHESTRATOR_SIGNALLED|ORCHESTRATOR_ERROR)$ ]] ||
     [[ ! "$exit_code" =~ ^[1-9][0-9]{0,2}$ ]] || (( exit_code > 255 )) ||
     [[ ! "$failed_line" =~ ^(null|[1-9][0-9]*)$ ]]; then
    return 64
  fi
  if [[ "$reason" == ORCHESTRATOR_SIGNALLED ]]; then
    [[ "$signal" =~ ^(INT|TERM|HUP)$ && "$failed_line" == null ]] || return 64
  else
    [[ "$signal" == null && "$failed_line" =~ ^[1-9][0-9]*$ ]] || return 64
  fi
  deferred_json="$(printf \
    '{"schema":"carbonet.design-causality-compiler-invocation/v2","phase":"POST_WORK","result":"DEFERRED_RECOVERY_REQUIRED","invoked":false,"recoveryPhase":"NEXT_PRE_WORK","dirtyState":"PRESERVED_UNOBSERVED","reason":"%s","signal":%s,"exitCode":%s,"failedLine":%s}' \
    "$reason" "$(if [[ "$signal" == null ]]; then printf null; else printf '"%s"' "$signal"; fi)" \
    "$exit_code" "$failed_line")"
  persisted="$(psqlq -c "with current_run as materialized (
    select coalesce(framework_try_jsonb(result_json),'{}'::jsonb) result
    from framework_project_completion_run
    where run_id='$completion_run_id'
  ), updated as (
    update framework_project_completion_run r
    set run_status='FAILED',completed_at=current_timestamp,
        result_json=jsonb_set(
          c.result||jsonb_build_object(
            'failureReason','$reason','signal',
            $(if [[ "$signal" == null ]]; then printf null; else printf "'%s'" "$signal"; fi),
            'exitCode',$exit_code,'failedLine',$failed_line
          ),
          '{designCausality,compilerInvocation,postWork}',
          coalesce(
            c.result#>'{designCausality,compilerInvocation,postWork}',
            \$design_causality\$$deferred_json\$design_causality\$::jsonb
          ),true
        )::text
    from current_run c
    where r.run_id='$completion_run_id'
    returning 1
  ) select count(*) from updated;" 2>/dev/null)" || return 70
  [[ "$persisted" == 1 ]] || return 70
}

fail_design_causality_run_deferred() {
  local completion_run_id="${1:-}" failed_line="${2:-}" failed_rc="${3:-}"
  if [[ ! "$failed_line" =~ ^[1-9][0-9]*$ ]] ||
     [[ ! "$failed_rc" =~ ^[1-9][0-9]{0,2}$ ]] || (( failed_rc > 255 )); then
    return 64
  fi
  record_design_causality_deferred_recovery \
    "$completion_run_id" ORCHESTRATOR_ERROR null "$failed_rc" "$failed_line" \
    >/dev/null 2>&1 || true
  return "$failed_rc"
}

if [[ "${PROJECT_AUTO_COMPLETION_LIBRARY_ONLY:-false}" == "true" ]]; then
  return 0 2>/dev/null || exit 0
fi

if [[ "${1:-}" == "--canonical-generation-decision-contract" ]]; then
  canonical_generation_decision \
    "${CANONICAL_READY_BEFORE:?}" "${CANONICAL_READY_AFTER:?}" "${CANONICAL_READY_COUNT:?}" \
    "${CANONICAL_ACTIVE_JOBS:?}" "${CANONICAL_FAILED_JOBS:?}" \
    "${CANONICAL_EXACT_JOBS:?}" "${CANONICAL_QUEUED_JOBS:?}"
  exit
fi
exec 9>"$LOCK_FILE"
if [[ "${PROJECT_AUTO_COMPLETION_WAIT_FOR_LOCK:-false}" == "true" ]]; then
  flock -w "${PROJECT_AUTO_COMPLETION_LOCK_WAIT_SECONDS:-14400}" 9 || {
    echo "[project-auto-completion] lock wait timed out: $LOCK_FILE" >&2
    exit 75
  }
else
  flock -n 9 || exit 0
fi
exec 8>"${DESIGN_METADATA_LOCK:-/tmp/resonance-design-metadata.lock}"
flock -n 8 || exit 0
# PostgreSQL has a bounded memory cgroup. Keep the completion orchestrator and
# the full process-contract audit from materializing large result sets at the
# same time. A skipped timer run is safe because the timer retries after the
# post-run cooldown.
mkdir -p "$(dirname "$HEAVY_DB_LOCK_FILE")"
exec 7>"$HEAVY_DB_LOCK_FILE"
if ! flock -n 7; then
  echo "[project-auto-completion] heavy DB automation is already running; execution skipped" >&2
  exit 0
fi
# framework_development_job_event.event_type is varchar(30). Fail before any
# mutation if a newly added static recovery event exceeds that DB contract.
while IFS= read -r event_code; do
  if (( ${#event_code} > 30 )); then
    echo "[project-auto-completion] event code exceeds 30 characters: $event_code" >&2
    exit 2
  fi
done < <(sed -n "s/.*select job_id,'\([A-Z_][A-Z_]*\)'.*/\1/p" "$0" | sort -u)
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[project-auto-completion] writable PostgreSQL leader not found" >&2; exit 1; }
psqlq(){
  local wall_timeout="${PSQLQ_WALL_TIMEOUT_SECONDS:-0}"
  if [[ "$wall_timeout" =~ ^[1-9][0-9]*$ ]]; then
    timeout --signal=TERM --kill-after=1s "${wall_timeout}s" \
      kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
        env PGOPTIONS="$AUTOMATION_PGOPTIONS" \
        psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"
  else
    kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
      env PGOPTIONS="$AUTOMATION_PGOPTIONS" \
      psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"
  fi
}
design_causality_pre_invocation=''
if design_causality_pre_invocation="$(
  run_design_causality_post_commit_compiler PRE_WORK
)"; then
  jq -e '
    .schema=="carbonet.design-causality-compiler-invocation/v2" and
    .phase=="PRE_WORK" and .migrationReady and .authorized and
    .dirtyAtLinearization==0 and .canonicalSchemaVersion==2 and
    (.codegenInputHash|test("^[0-9a-f]{64}$")) and
    (.codegenReadiness=="READY" or .codegenReadiness=="BLOCKED") and
    (.activeBindingCount|type)=="number" and .activeBindingCount>=0
  ' <<<"$design_causality_pre_invocation" >/dev/null
else
  compiler_rc=$?
  echo "[project-auto-completion] design causality pre-work compiler failed: rc=$compiler_rc" >&2
  exit "$compiler_rc"
fi
run_id="$(cat /proc/sys/kernel/random/uuid)"
design_causality_initial_result="$(jq -cn \
  --argjson invocation "$design_causality_pre_invocation" \
  '{designCausality:{compilerInvocation:{preWork:$invocation}}}')"
psqlq -c "insert into framework_project_completion_run(run_id,result_json)
  values('$run_id',\$design_causality\$$design_causality_initial_result\$design_causality\$);" >/dev/null
mark_interrupted(){
  local signal="$1" exit_code="$2"
  trap - ERR INT TERM HUP
  record_design_causality_deferred_recovery \
    "$run_id" ORCHESTRATOR_SIGNALLED "$signal" "$exit_code" null >/dev/null 2>&1 || true
  exit "$exit_code"
}
mark_failed(){
  local failed_line="$1" failed_rc="$2"
  trap - ERR INT TERM HUP
  echo "[project-auto-completion] ERROR line=$failed_line" >&2
  fail_design_causality_run_deferred "$run_id" "$failed_line" "$failed_rc"
}
trap 'mark_interrupted INT 130' INT
trap 'mark_interrupted TERM 143' TERM
trap 'mark_interrupted HUP 129' HUP
trap 'failed_rc=$?; failed_line=$LINENO; mark_failed "$failed_line" "$failed_rc"' ERR
# A host reboot, operator stop, or OOM can terminate the shell without firing
# ERR. Reconcile only genuinely stale orchestration records; contract runs and
# development-job leases have their own lifecycles and are intentionally not
# touched here.
stale_completion_run_count="$(psqlq -c "
with recovered as (
  update framework_project_completion_run
     set run_status='FAILED',
         completed_at=(current_timestamp at time zone 'UTC'),
         result_json=(coalesce(framework_try_jsonb(result_json),'{}'::jsonb)||
           jsonb_build_object('reason','ORCHESTRATOR_TERMINATED_STALE_RECOVERY',
             'recoveredAt',(current_timestamp at time zone 'UTC'),'previousStatus','RUNNING'))::text
   where run_status='RUNNING'
     and started_at < (current_timestamp at time zone 'UTC')-interval '${PROJECT_COMPLETION_STALE_MINUTES:-10} minutes'
   returning run_id
)
select count(*) from recovered;")"
if [[ "$stale_completion_run_count" != "0" ]]; then
  echo "[project-auto-completion] recovered stale completion runs: $stale_completion_run_count" >&2
fi
contract_completion_result="$(psqlq -c "select framework_run_contract_completion('project-auto-completion',${CONTRACT_COMPLETION_BATCH_SIZE:-25},false);")"
host_worker_prefix="$(hostname)-hermes-"
while IFS='|' read -r orphan_job_id orphan_worker_id; do
  [[ -n "$orphan_job_id" && "$orphan_worker_id" == "$host_worker_prefix"* ]] || continue
  orphan_pid="${orphan_worker_id##*-}"
  [[ "$orphan_pid" =~ ^[0-9]+$ ]] || continue
  if kill -0 "$orphan_pid" 2>/dev/null; then
    orphan_cmd="$(tr '\0' ' ' <"/proc/$orphan_pid/cmdline" 2>/dev/null || true)"
    [[ "$orphan_cmd" == *run-process-development-worker.sh* && "$orphan_cmd" == *" $orphan_job_id "* ]] && continue
  fi
  psqlq -c "
    with recovered as (
      update framework_development_job
      set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
          attempt_count=greatest(0,attempt_count-1),
          last_error='orphan worker process disappeared',updated_at=current_timestamp
      where job_id=${orphan_job_id} and job_status='RUNNING' and worker_id='${orphan_worker_id}'
      returning job_id
    )
    insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
    select job_id,'ORPHAN_WORKER_RECOVERED','RUNNING','RETRY','project-auto-completion',
           jsonb_build_object('missingPid',${orphan_pid}) from recovered;" >/dev/null
done < <(psqlq -c "
  select job_id,worker_id from framework_development_job
  where job_status='RUNNING' and worker_id like '${host_worker_prefix}%'
    and updated_at < current_timestamp - interval '${ORPHAN_WORKER_GRACE_MINUTES:-5} minutes';")
selected="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
design_evidence_adopted="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status old_status,source_job.job_id source_job_id,
         source_job.evidence_ref,source_job.result_json
  from framework_development_job j
  join framework_step_execution_spec spec
    on spec.process_code=j.process_code and spec.step_code=j.step_code
   and spec.design_status='DESIGN_COMPLETE' and spec.approval_status='APPROVED'
  join lateral (
    select verified.job_id,verified.evidence_ref,verified.result_json
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_id<>j.job_id
      and verified.job_type in ('DESIGN','FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by case verified.job_type when 'DESIGN' then 0 else 1 end,verified.completed_at desc nulls last,verified.job_id desc
    limit 1
  ) source_job on true
  where j.job_type='DESIGN' and j.approval_status in ('PENDING','APPROVED')
    and j.job_status in ('PLANNED','RETRY')
), adopted as (
  update framework_development_job j
  set job_status='VERIFIED',quality_status='VERIFIED',approval_status='APPROVED',
      evidence_ref=c.evidence_ref,
      result_json=jsonb_build_object('strategy','VERIFIED_DESIGN_EVIDENCE_ADOPTION','sourceJobId',c.source_job_id,'sourceResult',framework_try_jsonb(c.result_json))::text,
      completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,
      last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.old_status,c.source_job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_EVIDENCE_ADOPTED',old_status,'VERIFIED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'reason','same approved process-step design already has verified evidence')
  from adopted returning 1
)
select count(*) from adopted;")"
not_applicable_completed="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status old_status,j.job_type,
         source_job.job_id source_job_id,source_job.evidence_ref
  from framework_development_job j
  join framework_process_step step
    on step.process_code=j.process_code and step.step_code=j.step_code
   and ((j.job_type='FRONTEND_USER' and step.requires_user_page=false)
     or (j.job_type='FRONTEND_ADMIN' and step.requires_admin_page=false))
  join lateral (
    select verified.job_id,verified.evidence_ref
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by verified.completed_at desc nulls last,verified.job_id desc limit 1
  ) source_job on true
  where j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.approval_status in ('PENDING','APPROVED')
    and j.job_status in ('PLANNED','RETRY','FAILED','BLOCKED')
), completed as (
  update framework_development_job j
  set job_status='COMPLETED',quality_status='VERIFIED',approval_status='APPROVED',
      evidence_ref=c.evidence_ref,
      result_json=jsonb_build_object('strategy','APPROVED_CONTRACT_NOT_APPLICABLE',
        'sourceJobId',c.source_job_id,'jobType',c.job_type,'requiredAudiencePage',false)::text,
      completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,
      last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.old_status,c.source_job_id,c.job_type
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'CONTRACT_NOT_APPLICABLE',old_status,'COMPLETED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'jobType',job_type,
           'reason','approved step contract does not require this audience page')
  from completed returning 1
)
select count(*) from completed;")"
# Generated requirement processes receive executable safety cases from the
# current process graph. Promote only cases whose ordered step, command, and
# actor contracts exactly match every current step and whose evidence contract
# is complete. A PASSED simulation run and repair audit are written in the same
# transaction; empty or stale generated cases remain fail-closed.
deterministic_safety_cases_approved="$(psqlq -c "
with eligible as (
  select c.case_code,c.process_code,p.process_version,c.case_status,c.case_type
  from framework_simulation_case c
  join framework_process_definition p using(process_code)
  where left(c.process_code,4)='REQ_'
    and c.case_status in ('DRAFT','READY','REVIEW_REQUIRED')
    and c.case_type in ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY')
    and c.automated
    and length(btrim(c.preconditions))>=30
    and jsonb_typeof(framework_try_jsonb(c.steps_json))='array'
    and jsonb_array_length(framework_try_jsonb(c.steps_json))=(
      select count(*) from framework_process_step s where s.process_code=c.process_code)
    and jsonb_typeof(framework_try_jsonb(c.assertions_json))='array'
    and jsonb_array_length(framework_try_jsonb(c.assertions_json))>=3
    and not exists (
      select 1 from framework_process_step s
      where s.process_code=c.process_code and not exists (
        select 1 from jsonb_array_elements(framework_try_jsonb(c.steps_json)) item
        where item->>'stepCode'=s.step_code
          and item->>'command'=s.command_code
          and item->>'actorCode'=s.actor_code
          and (item->>'order')::integer=s.step_order))
), runs as (
  insert into framework_simulation_run(
    case_code,process_version,result,failure_reason,evidence_json,executed_by)
  select case_code,process_version,'PASSED',null,
    jsonb_build_object('validator','CURRENT_PROCESS_GRAPH_EXACT_MATCH',
      'caseType',case_type,'checkedAt',current_timestamp)::text,
    'project-auto-completion'
  from eligible returning case_code
), audited as (
  insert into framework_deterministic_design_repair_audit(
    process_code,repair_type,before_value,after_value,repaired_by)
  select process_code,'SAFETY_TEST_APPROVAL',
    jsonb_build_object('caseCode',case_code,'status',case_status),
    jsonb_build_object('caseCode',case_code,'status','APPROVED',
      'validation','CURRENT_PROCESS_GRAPH_EXACT_MATCH'),
    'PROJECT_AUTO_COMPLETION'
  from eligible returning process_code
), changed as (
  update framework_simulation_case c
  set case_status='APPROVED',updated_at=current_timestamp
  from eligible e where c.case_code=e.case_code returning c.case_code
)
select count(*) from changed;")"
# Safety scenarios are stored independently so their approval can be audited
# without mutating an execution spec. Synchronize only exact case codes already
# approved by the deterministic scenario validator; no DRAFT case is promoted
# here.
embedded_tests_synced="$(psqlq -c "
with normalized as (
  select e.process_code,e.step_code,
    jsonb_agg(
      case when c.case_status='APPROVED'
        then jsonb_set(test_case,'{status}','\"APPROVED\"'::jsonb,true)
        else test_case end
      order by ordinality
    ) as test_contract
  from framework_step_execution_spec e
  cross join lateral jsonb_array_elements(e.test_contract)
    with ordinality test_items(test_case,ordinality)
  left join framework_simulation_case c
    on c.process_code=e.process_code
   and c.case_code=test_case->>'caseCode'
  group by e.process_code,e.step_code
), changed as (
  update framework_step_execution_spec e
  set test_contract=n.test_contract,spec_version=e.spec_version+1,
      source_hash=md5(
        e.actor_contract::text||e.business_contract::text||
        e.transition_contract::text||e.input_contract::text||
        e.output_contract::text||e.screen_contract::text||
        e.field_contract::text||e.command_contract::text||
        e.api_contract::text||e.persistence_contract::text||
        e.handoff_contract::text||n.test_contract::text||
        e.guide_contract::text||e.nonfunctional_contract::text
      ),
      updated_at=current_timestamp
  from normalized n
  where e.process_code=n.process_code and e.step_code=n.step_code
    and e.test_contract<>n.test_contract
  returning e.process_code,e.step_code
)
select count(*) from changed;")"

# A structurally complete design used to remain REVIEW_REQUIRED forever unless
# the process definition was imported as locked. That left every downstream
# test job PENDING even though the graph and schema-set validators had already
# proven the exact contract safe to generate. Approve only the intersection of
# both deterministic readiness views. This is design approval, not
# implementation verification: generated code and runtime tests must still
# pass their own jobs before any process can become VERIFIED.
review_ready_candidate_exists="$(psqlq -c "
select case when exists (
  select 1
  from framework_step_execution_spec
  where design_status='DESIGN_COMPLETE'
    and approval_status='REVIEW_REQUIRED'
    and blocker_codes='[]'::jsonb
) then 1 else 0 end;")"
deterministic_specs_approved=0
if [[ "$review_ready_candidate_exists" == "1" ]]; then
deterministic_specs_approved="$(psqlq -c "
with candidate as (
  select e.process_code,e.step_code
  from framework_step_execution_spec e
  join framework_professional_design_graph_quality graph
    on graph.process_code=e.process_code and graph.step_code=e.step_code
  join framework_step_schema_set_readiness schema_set
    on schema_set.process_code=e.process_code and schema_set.step_code=e.step_code
  where e.design_status='DESIGN_COMPLETE'
    and e.approval_status='REVIEW_REQUIRED'
    and e.blocker_codes='[]'::jsonb
    and graph.design_status='READY'
    and cardinality(graph.blocker_codes)=0
    and schema_set.completeness_status='COMPLETE'
    and schema_set.generation_status='SYNCED'
    and schema_set.blocker_codes='[]'::jsonb
    and e.actor_contract->>'contractType'='STEP_ACTOR_AUTHORITY'
    and length(coalesce(e.actor_contract->>'actorCode',''))>0
    and e.actor_contract->>'scope' in ('GLOBAL','TENANT','PROJECT','TENANT_PROJECT')
    and e.business_contract->>'contractType'='STEP_BUSINESS'
    and length(coalesce(e.business_contract->>'stepName',''))>0
    and length(coalesce(e.business_contract->>'requirement',''))>0
    and length(coalesce(e.business_contract->>'completionRule',''))>0
    and e.transition_contract->>'contractType'='STEP_TRANSITION'
    and length(coalesce(e.transition_contract->>'fromState',''))>0
    and length(coalesce(e.transition_contract->>'toState',''))>0
    and e.input_contract->>'contractType'='STEP_INPUT'
    and e.input_contract->'schema'<>'{}'::jsonb
    and e.output_contract->>'contractType'='STEP_OUTPUT'
    and e.output_contract->'schema'<>'{}'::jsonb
    and e.guide_contract->>'contractType'='STEP_GUIDE'
    and length(coalesce(e.guide_contract->>'title',''))>0
    and length(coalesce(e.guide_contract->>'purpose',''))>0
    and length(coalesce(e.guide_contract->>'completionCondition',''))>0
    and jsonb_array_length(e.screen_contract)>0
    and jsonb_array_length(coalesce(e.field_contract->'fields','[]'::jsonb))>0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(e.field_contract->'fields','[]'::jsonb)) nested_field
      where coalesce(nested_field->>'audience','')=''
    )
    and jsonb_array_length(e.command_contract)>0
    and jsonb_array_length(e.api_contract)>0
    and e.persistence_contract->>'contractType'='STEP_PERSISTENCE'
    and (e.persistence_contract->'policy'<>'{}'::jsonb
      or jsonb_array_length(coalesce(e.persistence_contract->'mappings','[]'::jsonb))>0
      or e.persistence_contract->'extensions'<>'{}'::jsonb)
    and (e.handoff_contract->'policy'<>'{}'::jsonb
      or jsonb_array_length(coalesce(e.handoff_contract->'transitions','[]'::jsonb))>0)
    and jsonb_array_length(e.test_contract)>0
    and (
      select count(distinct test_case->>'type')
      from jsonb_array_elements(e.test_contract) test_case
      where test_case->>'status' in ('APPROVED','VERIFIED')
        and jsonb_typeof(test_case->'steps')='array'
        and jsonb_array_length(test_case->'steps')>0
        and jsonb_typeof(test_case->'assertions')='array'
        and jsonb_array_length(test_case->'assertions')>0
        and test_case->>'type' in (
          'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
        )
    )=5
    and e.guide_contract<>'{}'::jsonb
    and e.nonfunctional_contract->>'contractType'='STEP_NONFUNCTIONAL'
    and jsonb_typeof(e.nonfunctional_contract->'security')='object'
    and jsonb_typeof(e.nonfunctional_contract->'performance')='object'
    and (e.nonfunctional_contract->'performance'->>'targetP95Ms')::integer>0
    and jsonb_typeof(e.nonfunctional_contract->'accessibility')='object'
    and length(coalesce(e.nonfunctional_contract->'accessibility'->>'standard',''))>0
    and jsonb_typeof(e.nonfunctional_contract->'responsive')='object'
    and jsonb_typeof(e.nonfunctional_contract->'recovery')='object'
    and jsonb_typeof(e.nonfunctional_contract->'audit')='object'
    and jsonb_typeof(e.nonfunctional_contract->'sla')='object'
), approved as (
  update framework_step_execution_spec e
  set approval_status='APPROVED',generation_status='READY',
      approved_by='DETERMINISTIC_DESIGN_GATE',
      approved_at=current_timestamp,updated_at=current_timestamp
  from candidate c
  where e.process_code=c.process_code and e.step_code=c.step_code
  returning e.process_code,e.step_code
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select j.job_id,'DETERMINISTIC_SPEC_APPROVED','REVIEW_REQUIRED','APPROVED',
         'project-auto-completion',
         jsonb_build_object(
           'processCode',a.process_code,'stepCode',a.step_code,
           'reason','design graph READY and schema set COMPLETE/SYNCED'
         )
  from approved a
  join framework_development_job j
    on j.process_code=a.process_code and j.step_code=a.step_code
   and j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
  returning 1
)
select count(*) from approved;")"
else
  echo "[project-auto-completion] deterministic design approval skipped: no REVIEW_REQUIRED candidates"
fi

# Legacy and compact contracts are normalized by the same renderer used at
# runtime. Promote a REVIEW_REQUIRED design only after every generated package
# in the complete process graph passes the deterministic static contract gate.
# The gate uses source hashes and a single DB transaction, so concurrent design
# edits make the whole promotion roll back rather than approving stale input.
static_contract_gate_failed=0
static_contract_gate_result='{"candidateCount":0,"promoted":0,"status":"NOOP"}'
static_contract_gate_root="$ROOT_DIR"
deployed_gate_root="${STATIC_CONTRACT_GATE_DEPLOY_ROOT:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
if [[ -x "$deployed_gate_root/ops/scripts/promote-review-contracts-after-static-test.sh" ]]; then
  static_contract_gate_root="$deployed_gate_root"
fi
if [[ "$review_ready_candidate_exists" == "1" ]]; then
  if ! static_contract_gate_result="$(bash "$static_contract_gate_root/ops/scripts/promote-review-contracts-after-static-test.sh" "$static_contract_gate_root" 2>&1)"; then
    static_contract_gate_failed=1
    echo "[project-auto-completion] review static contract gate failed: $static_contract_gate_result" >&2
    static_contract_gate_result='{"candidateCount":0,"promoted":0,"status":"FAILED"}'
  fi
else
  echo "[project-auto-completion] review static contract gate skipped: no REVIEW_REQUIRED candidates"
fi

contract_jobs_approved="$(psqlq -c "
with candidate as (
  select j.job_id,full_stack.job_id source_job_id
  from framework_development_job j
  join framework_step_execution_spec spec
    on spec.process_code=j.process_code and spec.step_code=j.step_code
   and spec.design_status='DESIGN_COMPLETE' and spec.approval_status='APPROVED'
  join lateral (
    select verified.job_id
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by verified.completed_at desc nulls last,verified.job_id desc limit 1
  ) full_stack on true
  where j.approval_status='PENDING' and j.job_status in ('PLANNED','RETRY')
    and j.job_type in ('DATABASE','DATABASE_QUALITY','API','API_QUALITY','BACKEND','BACKEND_QUALITY','FRONTEND_ADMIN','TEST','ACTOR_TEST','INTEGRATION')
), approved as (
  update framework_development_job j
  set approval_status='APPROVED',
      result_json=(coalesce(framework_try_jsonb(j.result_json),'{}'::jsonb)||jsonb_build_object('approvalStrategy','APPROVED_STEP_CONTRACT','approvalSourceJobId',c.source_job_id))::text,
      updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.source_job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'STEP_CONTRACT_APPROVED','PENDING','PLANNED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'reason','approved execution spec and verified full-stack package cover the exact process step')
  from approved returning 1
)
select count(*) from approved;")"
legacy_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and (j.last_error like 'Kilo exited with code %' or j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN'))
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='HERMES_ENGINE_MIGRATION_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'HERMES_ENGINE_MIGRATION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','legacy Kilo timeout released after Hermes engine migration')
  from recovered returning 1
)
select count(*) from recovered;")"
pool_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and j.last_error='Hermes project worker exited with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='NVIDIA_POOL_EXPANDED_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'NVIDIA_POOL_EXPANDED_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','secure NVIDIA credential pool expanded')
  from recovered returning 1
)
select count(*) from recovered;")"
adoption_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='AI completed without a source or metadata change'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='ADOPTION_GATE_RETRY'
    )
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_GATE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','deterministic existing frontend adoption gate installed')
  from recovered returning 1
)
select count(*) from recovered;")"
binding_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='existing frontend adoption contract failed'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ROUTE_BINDING_ADOPTION_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ROUTE_BINDING_ADOPTION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','exact route-family binding accepted as registered implementation evidence') from recovered returning 1
)
select count(*) from recovered;")"
shared_evidence_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='ORGANIZATIONAL_BOUNDARY'
    and j.job_type in ('API','API_QUALITY','BACKEND','BACKEND_QUALITY')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='SHARED_EVIDENCE_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'SHARED_EVIDENCE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','runtime evidence lookup now resolves through the shared primary worktree')
  from recovered returning 1
)
select count(*) from recovered;")"
cache_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='existing frontend adoption type check failed'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ADOPTION_CACHE_PATH_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_CACHE_PATH_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','frontend verification cache moved to worker-writable var directory') from recovered returning 1
)
select count(*) from recovered;")"
metadata_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='root tracked worktree changed before metadata fast-forward'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ADOPTION_CLOSEOUT_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_CLOSEOUT_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','adoption evidence already exists on main; close without a duplicate commit') from recovered returning 1
)
select count(*) from recovered;")"
symlink_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.last_error like 'unexpected worker error at line %'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='WORKTREE_LINK_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'WORKTREE_LINK_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','worktree dependency symlink creation made idempotent') from recovered returning 1
)
select count(*) from recovered;")"
router_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and j.last_error='Hermes project worker exited with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='HERMES_ROUTER_FIX_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'HERMES_ROUTER_FIX_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','E4B selector input bounded after HTTP 400')
  from recovered returning 1
)
select count(*) from recovered;")"
legacy_design_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN'
    and j.job_status='FAILED'
    and j.last_error='unexpected worker error at line 316'
    and not (j.specification_json::jsonb ? 'designContracts')
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='LEGACY_DESIGN_SPEC_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'LEGACY_DESIGN_SPEC_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','legacy DESIGN specification will be enriched from governed screen contracts')
  from recovered returning 1
)
select count(*) from recovered;")"
design_factory_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN' and j.job_status='FAILED'
    and j.last_error='governed professional screen contracts are missing for legacy DESIGN specification'
    and to_regprocedure('framework_ensure_step_screen_contract(character varying,character varying,character varying)') is not null
    and exists (
      select 1 from framework_page_design d
      where d.process_code=j.process_code and d.step_code=j.step_code
        and d.design_status='DESIGN_COMPLETE' and d.route_status='IMPLEMENTED'
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DESIGN_FACTORY_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_FACTORY_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','professional screen contract factory completed the missing design prerequisite')
  from recovered returning 1
)
select count(*) from recovered;")"
design_preflight_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN' and j.job_status='FAILED'
    and j.last_error in ('professional development contract preflight failed',
      'AI completed without a source or metadata change')
    and exists (
      select 1 from framework_professional_screen_contract c
      where c.process_code=j.process_code and c.step_code=j.step_code
        and length(coalesce(c.business_purpose,''))>=10
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DESIGN_PREFLIGHT_V3_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_PREFLIGHT_V3_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','governed contract renderer can adopt an identical existing professional design')
  from recovered returning 1
)
select count(*) from recovered;")"
generator_spec_retried="$(psqlq -c "
with candidate as (
  select j.job_id,s.requirement_text,s.step_name
  from framework_development_job j
  join framework_process_step s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error in ('professional development contract preflight failed',
      'deterministic generator failed with code 1')
    and (
      not (coalesce(nullif(j.specification_json,''),'{}')::jsonb ? 'generatorRequired')
      or coalesce((coalesce(nullif(j.specification_json,''),'{}')::jsonb->>'generatorRequired')::boolean,false)=false
      or nullif(btrim(coalesce(coalesce(nullif(j.specification_json,''),'{}')::jsonb->>'requirement','')),'') is null
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='GENERATOR_SPEC_SYNC_RETRY'
    )
), recovered as (
  update framework_development_job j
  set specification_json=(coalesce(nullif(j.specification_json,''),'{}')::jsonb
        || jsonb_build_object(
          'generatorRequired',true,
          'reuseCommonAssets',true,
          'requirement',coalesce(nullif(btrim(c.requirement_text),''),
            c.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
          'specRepairVersion','CONTRACT_GENERATOR_SPEC_V2'))::text,
      job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'GENERATOR_SPEC_SYNC_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','stale full-stack job synchronized with the governed generator contract')
  from recovered returning 1
)
select count(*) from recovered;")"
post_design_fullstack_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1 from framework_development_job design_job
      where design_job.process_code=j.process_code and design_job.step_code=j.step_code
        and design_job.job_type='DESIGN' and design_job.job_status='VERIFIED'
        and design_job.quality_status='VERIFIED' and nullif(design_job.evidence_ref,'') is not null
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='POST_DESIGN_STACK_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'POST_DESIGN_STACK_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','verified professional DESIGN evidence now satisfies the full-stack prerequisite')
  from recovered returning 1
)
select count(*) from recovered;")"
flat_field_contract_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1
      from framework_step_execution_spec s
      cross join lateral jsonb_array_elements(coalesce(s.field_contract->'fields','[]'::jsonb)) field
      where s.process_code=j.process_code and s.step_code=j.step_code
        and field ? 'fieldCode'
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FLAT_FIELD_CONTRACT_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FLAT_FIELD_CONTRACT_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','deterministic generator now supports flat professional field contracts')
  from recovered returning 1
)
select count(*) from recovered;")"
ready_package_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1 from framework_step_execution_spec s
      where s.process_code=j.process_code and s.step_code=j.step_code
        and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
        and jsonb_array_length(s.screen_contract)>0
        and (
          jsonb_array_length(coalesce(s.field_contract->'fields','[]'::jsonb))>=8
        )
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='READY_PACKAGE_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'READY_PACKAGE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','approved screen and professional field package is now generator-ready')
  from recovered returning 1
)
select count(*) from recovered;")"
frontend_inventory_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.job_status='FAILED'
    and j.last_error='deterministic generation unavailable and the single automatic AI escalation was already consumed'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FRONTEND_INVENTORY_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FRONTEND_INVENTORY_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','route-source inventory refreshed; retry exact existing frontend adoption')
  from recovered returning 1
)
select count(*) from recovered;")"
database_adoption_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='EMISSION_PROJECT'
    and j.job_type in ('DATABASE','DATABASE_QUALITY')
    and j.job_status='FAILED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DB_ADOPTION_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DB_ADOPTION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','exact migration and live schema validator installed')
  from recovered returning 1
)
select count(*) from recovered;")"
collect_database_validator_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='EMISSION_PROJECT'
    and j.step_code='EMISSION_PROJECT_COLLECT'
    and j.job_type in ('DATABASE','DATABASE_QUALITY')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='COLLECT_DB_VALIDATOR_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'COLLECT_DB_VALIDATOR_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','activity collection database contract added to exact validator')
  from recovered returning 1
)
select count(*) from recovered;")"
retried="$(psqlq -c "
with candidate as (
  select j.job_id,
    (j.attempt_count>=j.max_attempts) as infrastructure_retry
  from framework_development_job j
  where j.job_status='FAILED'
    and (
      j.attempt_count<j.max_attempts
      or (
        j.last_error in (
          'unexpected worker error at line 111',
          'Kilo exited with code 124',
          'AI completed without a source or metadata change',
          'parallel publish rebase conflict'
        )
        and not exists (
          select 1 from framework_development_job_event e
          where e.job_id=j.job_id and e.event_type='INFRA_RETRY_GRANTED'
        )
      )
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=case when c.infrastructure_retry then greatest(0,j.max_attempts-1) else j.attempt_count end,
      updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.infrastructure_retry
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,case when infrastructure_retry then 'INFRA_RETRY_GRANTED' else 'RETRY_GRANTED' end,
         'FAILED','RETRY','project-auto-completion',jsonb_build_object('infrastructureRetry',infrastructure_retry)
  from recovered returning 1
)
select count(*) from recovered;")"
retried="$((retried+legacy_retried+pool_retried+adoption_retried+binding_retried+shared_evidence_retried+cache_retried+metadata_retried+symlink_retried+router_retried+legacy_design_retried+design_factory_retried+design_preflight_retried+generator_spec_retried+post_design_fullstack_retried+flat_field_contract_retried+ready_package_retried+frontend_inventory_retried+database_adoption_retried+collect_database_validator_retried))"

# Before invoking a model, deterministically adopt server work that is already
# implemented and covered by tests. The adopter is state-guarded, so a job that
# another worker claims concurrently is never overwritten.
server_adopted=0
if [[ -x "$ROOT_DIR/ops/scripts/adopt-existing-server-job.sh" ]]; then
  while IFS= read -r adoption_job_id; do
    [[ -n "$adoption_job_id" ]] || continue
    if ROOT_DIR="$ROOT_DIR" PGDATABASE="$DB" PGUSER="$DB_USER" PGPASSWORD="${PGPASSWORD:-local-trust}" \
      POSTGRES_POD="$leader" PGHOST="127.0.0.1" K8S_NAMESPACE="$NAMESPACE" \
      bash "$ROOT_DIR/ops/scripts/adopt-existing-server-job.sh" "$adoption_job_id" --apply; then
      server_adopted=$((server_adopted + 1))
    fi
  done < <(psqlq -c "
    select j.job_id
    from framework_development_job j
    left join framework_process_delivery_priority_queue q on q.process_code=j.process_code
    where j.approval_status='APPROVED'
      and j.job_status in ('PLANNED','RETRY','FAILED')
      and j.job_type in ('BACKEND','API','API_QUALITY','DATABASE','DATABASE_QUALITY','TEST','ACTOR_TEST')
    order by case q.delivery_priority when 'BLOCKER' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 when 'LOW' then 1 else 0 end desc,
             coalesce(q.development_order,2147483647),j.job_id
    limit ${SERVER_ADOPTION_SCAN_LIMIT:-3};")
fi
exhausted_planned_retried="$(psqlq -c "
with candidate as (
  select j.job_id
  from framework_development_job j
  where j.approval_status='APPROVED'
    and j.job_status='PLANNED'
    and j.attempt_count>=j.max_attempts
    and coalesce(j.last_error,'')=''
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='EXHAUSTED_PLANNED_RETRY'
    )
    and not exists (
      select 1 from framework_development_job_dependency d
      join framework_development_job required_job on required_job.job_id=d.depends_on_job_id
      where d.job_id=j.job_id and d.dependency_type='REQUIRED'
        and required_job.job_status not in ('VERIFIED','COMPLETED')
    )
), recovered as (
  update framework_development_job j
  set attempt_count=greatest(0,j.max_attempts-1),worker_id=null,lease_token=null,
      lease_until=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'EXHAUSTED_PLANNED_RETRY','PLANNED','PLANNED','project-auto-completion',
         jsonb_build_object('reason','planned job exhausted attempts without an error or execution result')
  from recovered returning 1
)
select count(*) from recovered;")"

# FULL_STACK generation is allowed only after the governed execution spec is
# approved. Older workers treated REVIEW_REQUIRED as a generator failure and
# exhausted retries. Reconcile that state without claiming implementation:
# pending reviews wait, while an approved package is released automatically.
incomplete_spec_demoted="$(psqlq -c "
with candidate as (
  select e.process_code,e.step_code,
    jsonb_array_length(e.screen_contract)=0 as screen_missing,
    jsonb_array_length(coalesce(e.field_contract->'fields','[]'::jsonb))<8 as fields_incomplete
  from framework_step_execution_spec e
  join framework_process_step s using(process_code,step_code)
  where e.approval_status='APPROVED'
    and (s.requires_user_page or s.requires_admin_page)
    and (
      jsonb_array_length(e.screen_contract)=0
      or jsonb_array_length(coalesce(e.field_contract->'fields','[]'::jsonb))<8
    )
), demoted as (
  update framework_step_execution_spec e
  set design_status='DESIGN_BLOCKED',approval_status='REVIEW_REQUIRED',
      generation_status='BLOCKED',approved_by=null,approved_at=null,
      blocker_codes=(select jsonb_agg(distinct blocker)
        from jsonb_array_elements(
          e.blocker_codes
          ||case when c.screen_missing then '[\"SCREEN_CONTRACT_MISSING\"]'::jsonb else '[]'::jsonb end
          ||case when c.fields_incomplete then '[\"FIELD_CONTRACT_INCOMPLETE\"]'::jsonb else '[]'::jsonb end
        ) blocker),
      updated_at=current_timestamp
  from candidate c where e.process_code=c.process_code and e.step_code=c.step_code
  returning e.process_code,e.step_code
)
select count(*) from demoted;")"

spec_approval_waiting="$(psqlq -c "
with candidate as (
  select j.job_id
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status in ('FAILED','RETRY')
    and s.approval_status<>'APPROVED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='SPEC_APPROVAL_WAIT_V1'
    )
), waiting as (
  update framework_development_job j
  set job_status='PLANNED',approval_status='PENDING',attempt_count=0,
      worker_id=null,lease_token=null,lease_until=null,
      last_error='awaiting governed execution spec approval',updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'SPEC_APPROVAL_WAIT_V1','FAILED','PLANNED','project-auto-completion',
         jsonb_build_object('reason','full-stack generation waits for governed execution spec approval')
  from waiting returning 1
)
select count(*) from waiting;")"

approved_generator_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  join framework_process_step step
    on step.process_code=j.process_code and step.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status in ('FAILED','PLANNED')
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and ((jsonb_array_length(s.screen_contract)>0 and jsonb_array_length(coalesce(s.field_contract->'fields','[]'::jsonb))>0)
      or (not step.requires_user_page and not step.requires_admin_page
        and (step.requires_api or step.requires_database)))
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='APPROVED_GENERATOR_V7_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'APPROVED_GENERATOR_V7_RETRY',job_status,'RETRY','project-auto-completion',
         jsonb_build_object('reason','approved UI or backend-only package released to generator v7')
  from released returning 1
)
select count(*) from released;")"

frontend_package_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.job_status='FAILED'
    and j.last_error='deterministic generation unavailable and the single automatic AI escalation was already consumed'
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and jsonb_array_length(s.screen_contract)>0
    and jsonb_array_length(coalesce(s.field_contract->'fields','[]'::jsonb))>0
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FRONTEND_PACKAGE_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FRONTEND_PACKAGE_V1_RETRY',job_status,'RETRY','project-auto-completion',
         jsonb_build_object('reason','approved frontend released after deterministic step-package self-generation')
  from released returning 1
)
select count(*) from released;")"

grouped_field_generator_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(s.field_contract->'fields','[]'::jsonb)) nested_field
      where coalesce(nested_field->>'audience','')=''
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FIELD_AUDIENCE_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select job_id,'FIELD_AUDIENCE_V1_RETRY',job_status,'RETRY',
         'project-auto-completion',
         jsonb_build_object(
           'reason','generator now partitions legacy grouped fields by nested audience'
         )
  from released returning 1
)
select count(*) from released;")"

package_contract_generator_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and (
      select count(distinct test_case->>'type')
      from jsonb_array_elements(s.test_contract) test_case
      where test_case->>'status' in ('APPROVED','VERIFIED')
        and jsonb_typeof(test_case->'steps')='array'
        and jsonb_array_length(test_case->'steps')>0
        and jsonb_typeof(test_case->'assertions')='array'
        and jsonb_array_length(test_case->'assertions')>0
        and test_case->>'type' in (
          'HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY'
        )
    )=5
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='PACKAGE_CONTRACT_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select job_id,'PACKAGE_CONTRACT_V1_RETRY',job_status,'RETRY',
         'project-auto-completion',
         jsonb_build_object(
           'reason','approved scenarios and common persistence package normalization applied'
         )
  from released returning 1
)
select count(*) from released;")"

generated_dimension_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN','API','API_QUALITY',
      'BACKEND','BACKEND_QUALITY','DATABASE','DATABASE_QUALITY','TEST','ACTOR_TEST','INTEGRATION')
    and s.approval_status='APPROVED' and s.generation_status='GENERATED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='GENERATED_DIMENSION_V7_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'GENERATED_DIMENSION_V7_RETRY',job_status,'RETRY','project-auto-completion',
         jsonb_build_object('reason','exact generated step dimension validates structured input fields and grouped runtime field codes')
  from released returning 1
)
select count(*) from released;")"

common_contract_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('COMPONENT_COMMON','CLASS_PROPERTY_COMMON','UI_QUALITY')
    and s.approval_status='APPROVED' and s.generation_status='GENERATED'
    and not exists(select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='QUALITY_CONTRACT_V2_RETRY')
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'QUALITY_CONTRACT_V2_RETRY',job_status,'RETRY','project-auto-completion',
    jsonb_build_object('reason','approved generated package now deterministically validates common components and class properties')
  from released returning 1
)
select count(*) from released;")"

database_constraint_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('DATABASE','DATABASE_QUALITY')
    and j.last_error='deterministic generator failed with code 1'
    and s.approval_status='APPROVED' and s.generation_status='GENERATED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id
        and e.event_type='DB_CONSTRAINT_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select job_id,'DB_CONSTRAINT_V1_RETRY',job_status,'RETRY',
         'project-auto-completion',
         jsonb_build_object(
           'reason','generator and validator now share index and foreign-key requirements'
         )
  from released returning 1
)
select count(*) from released;")"

delivery_infrastructure_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error in ('result commit was not deployed','worker interrupted by signal')
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DELIVERY_INFRA_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select job_id,'DELIVERY_INFRA_V1_RETRY',job_status,'RETRY',
         'project-auto-completion',
         jsonb_build_object(
           'reason','canonical deploy marker and worker capacity are healthy'
         )
  from released returning 1
)
select count(*) from released;")"

deterministic_diff_scope_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.last_error like 'diff line limit exceeded:%'
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and s.generation_status='GENERATED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DET_DIFF_SCOPE_V1_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(
    job_id,event_type,from_status,to_status,worker_id,detail_json
  )
  select job_id,'DET_DIFF_SCOPE_V1_RETRY',job_status,'RETRY',
         'project-auto-completion',
         jsonb_build_object(
           'reason','generated metadata now has a path and size bounded diff policy'
         )
  from released returning 1
)
select count(*) from released;")"

retried="$((retried+spec_approval_waiting+approved_generator_retried+frontend_package_retried+grouped_field_generator_retried+package_contract_generator_retried+generated_dimension_retried+common_contract_retried+database_constraint_retried+delivery_infrastructure_retried+deterministic_diff_scope_retried))"

# Once the canonical endpoint compiler is installed, tracked full-stack output
# is owned by evidence-backed development workers. Queue an exact source-hash
# job when contract completion has not already done so. A new source hash gets
# a new immutable target; workers serialize all canonical targets for the same
# process during claim/publication.
canonical_endpoint_compiler_installed="$(psqlq -c "
select case when
  to_regprocedure('public.framework_canonical_endpoint_catalog(integer)') is not null
  and to_regprocedure('public.framework_canonical_endpoint_readiness(integer,character varying)') is not null
then 1 else 0 end;")"
canonical_evidence_jobs_queued=0
if [[ "$canonical_endpoint_compiler_installed" == "1" ]]; then
  canonical_evidence_jobs_queued="$(psqlq -c "
with ready_process as materialized (
  select distinct s.process_code
  from framework_step_execution_spec s
  where s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and s.generation_status='READY'
), eligible_process as materialized (
  select process_code from ready_process
  where framework_canonical_endpoint_readiness(5000,process_code)->>'status'='COMPLETE'
), candidate as (
  select s.process_code,s.step_code,s.source_hash,
    coalesce(nullif(btrim(step.requirement_text),''),
      step.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.') requirement
  from framework_step_execution_spec s
  join eligible_process p using(process_code)
  join framework_process_step step using(process_code,step_code)
  where s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and s.generation_status='READY'
    and not exists (
      select 1 from framework_development_job j
      where j.process_code=s.process_code and j.step_code=s.step_code
        and j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
        and (
          j.job_status in ('PLANNED','RETRY','RUNNING')
          or (
            j.job_status='VERIFIED' and j.quality_status='VERIFIED'
            and framework_try_jsonb(j.result_json)->'canonicalGeneration'->>'sourceHash'=s.source_hash
          )
        )
    )
), queued as (
  insert into framework_development_job(
    process_code,step_code,job_type,job_name,target_path,specification_json,
    job_status,approval_status,execution_mode,job_group_code,required,
    progress_weight,max_attempts,quality_status,created_by
  )
  select process_code,step_code,'FULL_STACK_GENERATION','정규 설계 전체 스택 자동 생성',
    'canonical://'||process_code||'/'||source_hash,
    jsonb_build_object(
      'algorithm','CANONICAL_EVIDENCE_PUBLICATION_V1','generatorRequired',true,
      'reuseCommonAssets',true,'requirement',requirement,'sourceHash',source_hash,
      'requiredGates',jsonb_build_array('DESIGN','FRONTEND','API','DATABASE','HELP','CARDS','BUILD','PUBLISH','DEPLOY_HEALTH'),
      'verifiedEvidenceRequired',true)::text,
    'PLANNED','APPROVED','SEQUENTIAL',process_code||'_CANONICAL_PUBLICATION',true,
    10,3,'PENDING','CANONICAL_ENDPOINT_ORCHESTRATOR'
  from candidate
  on conflict do nothing
  returning job_id
)
select count(*) from queued;")"
fi
executable="$(psqlq -c "
select count(*) from framework_development_job j
where j.approval_status='APPROVED' and (j.job_status='PLANNED' or (j.job_status='RETRY' and (j.lease_until is null or j.lease_until<current_timestamp))) and j.attempt_count<j.max_attempts
  and not exists (
    select 1 from framework_development_job_dependency d
    join framework_development_job required_job on required_job.job_id=d.depends_on_job_id
    where d.job_id=j.job_id and d.dependency_type='REQUIRED'
      and required_job.job_status not in ('VERIFIED','COMPLETED')
  );")"
if [[ "$executable" -gt 0 ]] && ! bash "$ROOT_DIR/ops/scripts/verify-hermes-project-work-policy.sh" >/dev/null 2>&1; then
  design_causality_post_invocation=''
  if design_causality_post_invocation="$(
    finalize_hermes_policy_invalid_run "$run_id" "$selected" "$executable" "$retried"
  )"; then
    :
  else
    compiler_rc=$?
    echo "[project-auto-completion] design causality post-work compiler failed: rc=$compiler_rc" >&2
    exit "$compiler_rc"
  fi
  trap - ERR
  design_causality_post_log="$(jq -c 'del(.canonicalHash)' <<<"$design_causality_post_invocation")"
  echo "[project-auto-completion] ATTENTION_REQUIRED reason=HERMES_PROJECT_WORK_POLICY_INVALID executable=$executable designCausalityPost=$design_causality_post_log"
  exit 0
fi
dispatcher_failed=0
if [[ "$executable" -gt 0 ]]; then
  ROOT_DIR="$ROOT_DIR" MAX_PARALLEL_WORKERS="$MAX_PARALLEL_WORKERS" \
    PGDATABASE="$DB" PGUSER="$DB_USER" PGPASSWORD="${PGPASSWORD:-local-trust}" \
    POSTGRES_POD="$leader" PGHOST="127.0.0.1" K8S_NAMESPACE="$NAMESPACE" \
    PROJECT_WORK_RUNNER="$PROJECT_WORK_RUNNER" bash "$PROCESS_DEVELOPMENT_DISPATCHER" || dispatcher_failed=1
fi
full_stack_ready_before="$(psqlq -c "select count(*) from framework_step_execution_spec where design_status='DESIGN_COMPLETE' and approval_status='APPROVED' and generation_status='READY';")"
full_stack_generation_result="$(jq -cn --argjson ready "$full_stack_ready_before" '{status:(if $ready>0 then "PENDING" else "UNCHANGED" end),readyBefore:$ready,readyAfter:$ready,elapsedMillis:0}')"
if (( full_stack_ready_before > 0 )); then
  canonical_ready_before=0
  if [[ "$canonical_endpoint_compiler_installed" == "1" ]]; then
    canonical_ready_before="$(psqlq -c "
      with ready_process as materialized (
        select distinct process_code from framework_step_execution_spec
        where design_status='DESIGN_COMPLETE' and approval_status='APPROVED'
          and generation_status='READY'
      ), eligible_process as materialized (
        select process_code from ready_process
        where framework_canonical_endpoint_readiness(5000,process_code)->>'status'='COMPLETE'
      )
      select count(*) from framework_step_execution_spec s
      join eligible_process p using(process_code)
      where s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
        and s.generation_status='READY';")"
  fi
  if (( canonical_ready_before > 0 )); then
    IFS='|' read -r canonical_active_jobs canonical_failed_jobs canonical_exact_jobs <<<"$(psqlq -c "
      with ready_process as materialized (
        select distinct process_code from framework_step_execution_spec
        where design_status='DESIGN_COMPLETE' and approval_status='APPROVED'
          and generation_status='READY'
      ), eligible_process as materialized (
        select process_code from ready_process
        where framework_canonical_endpoint_readiness(5000,process_code)->>'status'='COMPLETE'
      )
      select
        count(*) filter(where j.job_status in ('PLANNED','RETRY','RUNNING')),
        count(*) filter(where j.job_status in ('FAILED','BLOCKED')),
        count(*) filter(where j.job_status='VERIFIED' and j.quality_status='VERIFIED'
          and framework_try_jsonb(j.result_json)->'canonicalGeneration'->>'sourceHash'=s.source_hash)
      from framework_step_execution_spec s
      join eligible_process p using(process_code)
      left join framework_development_job j
        on j.process_code=s.process_code and j.step_code=s.step_code
       and j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
      where s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
        and s.generation_status='READY';")"
    full_stack_ready_after="$full_stack_ready_before"
    if (( canonical_failed_jobs > 0 && canonical_active_jobs == 0 )); then
      dispatcher_failed=1
    fi
    full_stack_generation_result="$(canonical_generation_decision \
      "$full_stack_ready_before" "$full_stack_ready_after" "$canonical_ready_before" \
      "$canonical_active_jobs" "$canonical_failed_jobs" "$canonical_exact_jobs" \
      "$canonical_evidence_jobs_queued")"
  else
    # Rolling-upgrade and endpoint-PARTIAL contracts retain the legacy direct
    # generator. Canonical COMPLETE contracts never write tracked output here.
    full_stack_started_ms="$(date +%s%3N)"
    set +e
    full_stack_output="$(FULL_STACK_PACKAGE_OUT="${FULL_STACK_PACKAGE_OUT:-$ROOT_DIR/var/runtime/full-stack-generation/generated}" \
      FULL_STACK_PREVIEW_OUT="${FULL_STACK_PREVIEW_OUT:-$ROOT_DIR/var/runtime/full-stack-generation/design-preview}" \
      K8S_NAMESPACE="$NAMESPACE" PGDATABASE="$DB" PGUSER="$DB_USER" POSTGRES_POD="$leader" \
      bash "$ROOT_DIR/ops/scripts/generate-full-stack-design-packages.sh" "$ROOT_DIR" 2>&1)"
    full_stack_rc=$?
    set -e
    full_stack_elapsed_ms="$(( $(date +%s%3N) - full_stack_started_ms ))"
    full_stack_ready_after="$(psqlq -c "select count(*) from framework_step_execution_spec where design_status='DESIGN_COMPLETE' and approval_status='APPROVED' and generation_status='READY';")"
    if (( full_stack_rc != 0 || full_stack_ready_after != 0 )); then
      dispatcher_failed=1
      full_stack_generation_result="$(jq -cn --arg error "$full_stack_output" --argjson before "$full_stack_ready_before" --argjson after "$full_stack_ready_after" --argjson elapsed "$full_stack_elapsed_ms" '{status:"FAILED",readyBefore:$before,readyAfter:$after,elapsedMillis:$elapsed,error:$error}')"
    else
      full_stack_generation_result="$(jq -cn --argjson before "$full_stack_ready_before" --argjson elapsed "$full_stack_elapsed_ms" '{status:"GENERATED",readyBefore:$before,readyAfter:0,elapsedMillis:$elapsed}')"
    fi
  fi
fi

screen_generation_result='{"status":"NOT_INSTALLED"}'
if [[ "$(psqlq -c "select (to_regprocedure('framework_incremental_screen_generation_snapshot(integer,character varying)') is not null)::integer;")" == "1" ]]; then
  set +e
  screen_generation_result="$(ROOT_DIR="$ROOT_DIR" PGDATABASE="$DB" PGUSER="$DB_USER" \
    PGPASSWORD="${PGPASSWORD:-local-trust}" POSTGRES_POD="$leader" K8S_NAMESPACE="$NAMESPACE" \
    SCREEN_RUNTIME_OUT="${SCREEN_RUNTIME_OUT:-$ROOT_DIR/var/runtime/screen-generation}" \
    bash "$ROOT_DIR/ops/scripts/generate-incremental-screen-runtime.sh" "$ROOT_DIR" 2>&1)"
  screen_generation_rc=$?
  set -e
  if (( screen_generation_rc != 0 )); then
    dispatcher_failed=1
    screen_generation_result="$(jq -cn --arg error "$screen_generation_result" '{status:"FAILED",error:$error}')"
  fi
fi
business_e2e_result='{"status":"NOT_INSTALLED"}'
if [[ -x "$BUSINESS_E2E_RUNNER" && -s "$BUSINESS_E2E_REGISTRY" ]]; then
  set +e
  business_e2e_output="$(RESONANCE_ROOT="$BUSINESS_E2E_RUNTIME_ROOT" \
    BUSINESS_E2E_RUNNER_REGISTRY="$BUSINESS_E2E_REGISTRY" \
    timeout 900 bash "$BUSINESS_E2E_RUNNER" 2>&1)"
  business_e2e_rc=$?
  set -e
  if (( business_e2e_rc == 0 )); then
    business_e2e_result="$(jq -cn --arg output "$business_e2e_output" '{status:"PASSED_OR_COMPLETE",output:$output}')"
  elif (( business_e2e_rc == 75 )); then
    business_e2e_result="$(jq -cn --arg output "$business_e2e_output" '{status:"DEFERRED",output:$output}')"
  else
    dispatcher_failed=1
    business_e2e_result="$(jq -cn --arg output "$business_e2e_output" --argjson rc "$business_e2e_rc" '{status:"FAILED",exitCode:$rc,output:$output}')"
  fi
fi
completed="$(psqlq -c "with done as (update framework_process_definition p set process_status='DEVELOPMENT_READY',updated_at=current_timestamp from framework_process_delivery_priority_queue q where q.process_code=p.process_code and q.next_action='COMPLETE' and p.process_status<>'DEVELOPMENT_READY' returning 1) select count(*) from done;")"
design_causality_post_invocation=''
if design_causality_post_invocation="$(
  finalize_design_causality_post_work "$run_id"
)"; then
  :
else
  compiler_rc=$?
  echo "[project-auto-completion] design causality post-work compiler failed: rc=$compiler_rc" >&2
  exit "$compiler_rc"
fi
blocked="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where delivery_priority='BLOCKER';")"
remaining="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
design_causality_post_readiness="$(jq -r '.codegenReadiness' \
  <<<"$design_causality_post_invocation")"
full_stack_deferred=0
[[ "$(jq -r '.status' <<<"$full_stack_generation_result")" == "DEFERRED" ]] && full_stack_deferred=1
status="PROGRESSING"; [[ "$remaining" == "0" ]] && status="COMPLETED"; [[ "$blocked" -gt 0 || ( "$remaining" -gt 0 && "$executable" == "0" && "$full_stack_deferred" == "0" ) || "$dispatcher_failed" -gt 0 || "$static_contract_gate_failed" -gt 0 || "$design_causality_post_readiness" != "READY" ]] && status="ATTENTION_REQUIRED"
completion_result_json="$(jq -cn --argjson remaining "$remaining" --argjson dispatcherFailed "$dispatcher_failed" \
  --arg designCausalityReadiness "$design_causality_post_readiness" \
  --argjson fullStackGeneration "$full_stack_generation_result" \
  '{remainingProcesses:$remaining,dispatcherFailed:$dispatcherFailed,designCausalityReadiness:$designCausalityReadiness,fullStackGeneration:$fullStackGeneration}')"
psqlq -c "update framework_project_completion_run set run_status='$status',selected_process_count=$selected,executable_job_count=$executable,retried_job_count=$retried,completed_process_count=$completed,blocked_process_count=$blocked,result_json=(coalesce(framework_try_jsonb(result_json),'{}'::jsonb)||\$result\$${completion_result_json}\$result\$::jsonb)::text,completed_at=current_timestamp where run_id='$run_id';" >/dev/null
design_causality_pre_log="$(jq -c 'del(.canonicalHash)' <<<"$design_causality_pre_invocation")"
design_causality_post_log="$(jq -c 'del(.canonicalHash)' <<<"$design_causality_post_invocation")"
echo "[project-auto-completion] $status selected=$selected executable=$executable retried=$retried deterministicSafetyCasesApproved=$deterministic_safety_cases_approved embeddedTestsSynced=$embedded_tests_synced deterministicSpecsApproved=$deterministic_specs_approved staticContractGate=$(jq -c . <<<"$static_contract_gate_result") incompleteSpecDemoted=$incomplete_spec_demoted specApprovalWaiting=$spec_approval_waiting approvedGeneratorRetried=$approved_generator_retried frontendPackageRetried=$frontend_package_retried groupedFieldGeneratorRetried=$grouped_field_generator_retried packageContractGeneratorRetried=$package_contract_generator_retried generatedDimensionRetried=$generated_dimension_retried commonContractRetried=$common_contract_retried databaseConstraintRetried=$database_constraint_retried deliveryInfrastructureRetried=$delivery_infrastructure_retried deterministicDiffScopeRetried=$deterministic_diff_scope_retried designEvidenceAdopted=$design_evidence_adopted notApplicableCompleted=$not_applicable_completed contractJobsApproved=$contract_jobs_approved exhaustedPlannedRetried=$exhausted_planned_retried adopted=$server_adopted completed=$completed blocked=$blocked remaining=$remaining dispatcherFailed=$dispatcher_failed contractCompletion=$contract_completion_result designCausalityPre=$design_causality_pre_log designCausalityPost=$design_causality_post_log fullStackGeneration=$(jq -c . <<<"$full_stack_generation_result") screenGeneration=$(jq -c '{status:(.status//"GENERATED"),requested:(.requested//0),generated:(.generated//0),unchanged:(.unchanged//0),elapsedMillis:(.elapsedMillis//0)}' <<<"$screen_generation_result") businessE2E=$(jq -c . <<<"$business_e2e_result")"

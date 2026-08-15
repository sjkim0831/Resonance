#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
TMP="$(mktemp -d)"
trap '[[ "${KEEP_DESIGN_CAUSALITY_TEST_TMP:-0}" == 1 ]] || rm -rf "$TMP"' EXIT

fail() {
  echo "[design-causality-compiler-worker] FAIL: $*" >&2
  [[ "${KEEP_DESIGN_CAUSALITY_TEST_TMP:-0}" != 1 ]] || echo "testTmp=$TMP" >&2
  exit 1
}

PROJECT_AUTO_COMPLETION_LIBRARY_ONLY=true source "$ORCHESTRATOR"
unset PROJECT_AUTO_COMPLETION_LIBRARY_ONLY
declare -F run_design_causality_post_commit_compiler >/dev/null \
  || fail 'compiler function boundary is not sourceable'
[[ "$(grep -Ec "^[[:space:]]+\('trg_design_causality_" "$ORCHESTRATOR")" -eq 26 ]] \
  || fail 'runtime readiness does not bind all 26 exact M1.1 triggers'

READINESS='READY'; COMPILE_SEQUENCE="$TMP/compile"; CALL_LOG="$TMP/calls"
EVIDENCE_STATE="$TMP/evidence-state"
set_sequence() { local target="$1"; shift; printf '%s\n' "$@" >"$target"; }
next_sequence() {
  local target="$1" value
  [[ -s "$target" ]] || return 1
  value="$(head -n1 "$target")"
  tail -n +2 "$target" >"$target.next"; mv "$target.next" "$target"
  printf '%s' "$value"
}
psqlq() {
  local sql="${!#}" value
  if [[ "$sql" == *"to_regrole('carbonet_design_compiler')"* ]]; then
    printf 'readiness\n' >>"$CALL_LOG"
    [[ "$READINESS" == QUERY_ERROR ]] && return 1
    printf '%s\n' "$READINESS"
  elif [[ "$sql" == *"set local role carbonet_design_compiler"* ]]; then
    printf 'compile\n' >>"$CALL_LOG"
    value="$(next_sequence "$COMPILE_SEQUENCE")" || return 1
    case "$value" in
      ERROR40001:*) printf 'ERROR:  40001: %s\n' "${value#ERROR40001:}" >&2; return 3 ;;
      ERROR40P01:*) printf 'ERROR:  40P01: %s\n' "${value#ERROR40P01:}" >&2; return 3 ;;
      TRANSPORT:*) printf '%s\n' "${value#TRANSPORT:}" >&2; return 2 ;;
      TIMEOUT:*) printf '%s\n' "${value#TIMEOUT:}" >&2; return 124 ;;
      FATAL:*) printf 'ERROR:  42501: %s\n' "${value#FATAL:}" >&2; return 3 ;;
      *) printf '%s\n' "$value" ;;
    esac
  elif [[ "$sql" == *"update framework_project_completion_run"* &&
          "$sql" == *"DEFERRED_RECOVERY_REQUIRED"* ]]; then
    printf 'persist-deferred\n' >>"$CALL_LOG"
    if [[ -s "$EVIDENCE_STATE" ]]; then
      local deferred_reason='ORCHESTRATOR_ERROR' deferred_signal='null'
      for candidate in ORCHESTRATOR_SIGNALLED ORCHESTRATOR_ERROR; do
        [[ "$sql" != *"'failureReason','$candidate'"* ]] || deferred_reason="$candidate"
      done
      for candidate in INT TERM HUP; do
        [[ "$sql" != *"\"signal\":\"$candidate\""* ]] || deferred_signal="$candidate"
      done
      EVIDENCE_STATE="$EVIDENCE_STATE" DEFERRED_REASON="$deferred_reason" \
        DEFERRED_SIGNAL="$deferred_signal" python3 - <<'PY'
import json, os
p=os.environ['EVIDENCE_STATE']
d=json.load(open(p, encoding='utf-8'))
d['runStatus']='FAILED'
d['result']['failureReason']=os.environ['DEFERRED_REASON']
inv=d['result']['designCausality']['compilerInvocation']
inv.setdefault('postWork', {
  'result':'DEFERRED_RECOVERY_REQUIRED','invoked':False,
  'recoveryPhase':'NEXT_PRE_WORK','dirtyState':'PRESERVED_UNOBSERVED',
  'reason':os.environ['DEFERRED_REASON'],
  'signal':None if os.environ['DEFERRED_SIGNAL']=='null' else os.environ['DEFERRED_SIGNAL']
})
json.dump(d, open(p,'w',encoding='utf-8'))
PY
    fi
    printf '1\n'
  elif [[ "$sql" == *"update framework_project_completion_run"* &&
          "$sql" == *"{designCausality,compilerInvocation,postWork}"* ]]; then
    printf 'persist-post\n' >>"$CALL_LOG"
    if [[ -s "$EVIDENCE_STATE" ]]; then
      EVIDENCE_STATE="$EVIDENCE_STATE" python3 - <<'PY'
import json, os
p=os.environ['EVIDENCE_STATE']
d=json.load(open(p, encoding='utf-8'))
d['result']['designCausality']['compilerInvocation']['postWork']={'result':'NO_WORK'}
json.dump(d, open(p,'w',encoding='utf-8'))
PY
    fi
    printf '1\n'
  elif [[ "$sql" == *"update framework_project_completion_run"* &&
          "$sql" == *"HERMES_PROJECT_WORK_POLICY_INVALID"* ]]; then
    printf 'persist-hermes-attention\n' >>"$CALL_LOG"
    if [[ -s "$EVIDENCE_STATE" ]]; then
      EVIDENCE_STATE="$EVIDENCE_STATE" python3 - <<'PY'
import json, os
p=os.environ['EVIDENCE_STATE']
d=json.load(open(p, encoding='utf-8'))
d['runStatus']='ATTENTION_REQUIRED'
d['result']['reason']='HERMES_PROJECT_WORK_POLICY_INVALID'
json.dump(d, open(p,'w',encoding='utf-8'))
PY
    fi
    printf '1\n'
  else
    printf 'unexpected\n' >>"$CALL_LOG"; return 1
  fi
}
json_assert() {
  local payload="$1" expression="$2"
  JSON_PAYLOAD="$payload" JSON_EXPRESSION="$expression" python3 - <<'PY'
import json, os
d=json.loads(os.environ['JSON_PAYLOAD'])
assert eval(os.environ['JSON_EXPRESSION'], {'d':d})
PY
}
run_case() {
  local phase="$1" output_file="$2" error_file="$3"; : >"$CALL_LOG"
  if DESIGN_CAUSALITY_COMPILER_MAX_ATTEMPTS="${MAX_ATTEMPTS:-4}" \
     DESIGN_CAUSALITY_COMPILER_RETRY_DELAY_SECONDS=0 \
     run_design_causality_post_commit_compiler "$phase" \
       >"$output_file" 2>"$error_file"; then CASE_RC=0; else CASE_RC=$?; fi
}

hash_a="$(printf 'a%.0s' {1..64})"; hash_b="$(printf 'b%.0s' {1..64})"
codegen_hash="$(printf 'c%.0s' {1..64})"

# New script / old DB blocks all project writes.
READINESS='MIGRATION_NOT_READY'
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|BASELINE|0|0|1|null|0|$hash_a|null|READY|[]|0"
run_case PRE_WORK "$TMP/missing.out" "$TMP/missing.err"
[[ "$CASE_RC" -eq 75 && ! -s "$TMP/missing.out" ]] \
  || fail 'migration-absent rolling state was not write-blocking'
[[ "$(<"$CALL_LOG")" == readiness ]] || fail 'old DB invoked worker API'

# NO_WORK is the fresh REPEATABLE READ linearization point and performs no DML.
READINESS='READY'; MAX_ATTEMPTS=4
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|BASELINE|0|0|2|null|0|$hash_a|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/no-work.out" "$TMP/no-work.err"
[[ "$CASE_RC" -eq 0 ]] || { sed -n '1,20p' "$TMP/no-work.err" >&2; fail 'NO_WORK proof failed'; }
json_assert "$(<"$TMP/no-work.out")" \
  "d['schema'].endswith('/v2') and d['result']=='NO_WORK' and d['dirtyAtLinearization']==0 and d['attempts']==1 and d['revisionBefore']==0 and d['revisionAfter']==0 and d['currentEventId'] is None and d['canonicalHash']=='$hash_a' and d['canonicalSchemaVersion']==2 and d['codegenInputHash']=='$codegen_hash' and d['codegenReadiness']=='READY' and d['activeBindingCount']==0 and 0<=d['elapsedMillis']<20000"
[[ "$(grep -c '^compile$' "$CALL_LOG")" -eq 1 ]] \
  || fail 'NO_WORK did not use exactly one worker API transaction'

# A v1 head remains fail-closed. A structurally valid v2 raw-source snapshot is
# accepted for remediation even when code generation readiness is BLOCKED.
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|BASELINE|0|0|1|null|0|$hash_a|null|READY|[]|0"
run_case PRE_WORK "$TMP/v1-head.out" "$TMP/v1-head.err"
[[ "$CASE_RC" -eq 75 ]] || fail 'old-v1 compiler result crossed the write gate'
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|BLOCKED|[\"ACTIVE_RELEASE_BINDING_SOURCE_ONLY\"]|1"
run_case PRE_WORK "$TMP/active-binding.out" "$TMP/active-binding.err"
[[ "$CASE_RC" -eq 0 ]] || fail 'BLOCKED v2 source snapshot did not permit remediation'
json_assert "$(<"$TMP/active-binding.out")" \
  "d['codegenReadiness']=='BLOCKED' and d['codegenReadinessReasons']==['ACTIVE_RELEASE_BINDING_SOURCE_ONLY'] and d['activeBindingCount']==1"

# Readiness envelopes are internally consistent before they can become
# durable project evidence.
set_sequence "$COMPILE_SEQUENCE" \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|BLOCKED|[]|0"
run_case PRE_WORK "$TMP/blocked-empty.out" "$TMP/blocked-empty.err"
[[ "$CASE_RC" -eq 70 ]] || fail 'BLOCKED readiness without reasons was accepted'
set_sequence "$COMPILE_SEQUENCE" \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[\"SOURCE_CONTRACT_INVALID\"]|0"
run_case PRE_WORK "$TMP/ready-reason.out" "$TMP/ready-reason.err"
[[ "$CASE_RC" -eq 70 ]] || fail 'READY readiness with blocker reasons was accepted'

# BUSY and COMPILED both require a later fresh NO_WORK result.
set_sequence "$COMPILE_SEQUENCE" \
  "BUSY|BASELINE|0|0|2|null|1|$hash_a|$codegen_hash|READY|[]|0" \
  "COMPILED|CANONICAL_COMPILED|0|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0" \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/busy.out" "$TMP/busy.err"
[[ "$CASE_RC" -eq 0 ]] || fail 'BUSY/COMPILED drain failed'
json_assert "$(<"$TMP/busy.out")" \
  "d['result']=='DRAINED' and d['attempts']==3 and d['busyRetries']==1 and d['compiledEvents']==1 and d['revisionBefore']==0 and d['revisionAfter']==1 and d['currentEventId']==11 and d['canonicalHash']=='$hash_b'"

# Only transport, serialization, and deadlock retry; diagnostics never escape.
secret='pii-account@example.test private-scope password=qwer1234'
set_sequence "$COMPILE_SEQUENCE" \
  "ERROR40001:$secret" \
  "NO_SEMANTIC_CHANGE|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0" \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0"
run_case POST_WORK "$TMP/db-retry.out" "$TMP/db-retry.err"
[[ "$CASE_RC" -eq 0 ]] || fail 'serialization retry did not recover'
json_assert "$(<"$TMP/db-retry.out")" \
  "d['result']=='DRAINED' and d['databaseRetries']==1 and d['semanticNoops']==1 and d['attempts']==3"
if grep -Fq "$secret" "$TMP/db-retry.out" "$TMP/db-retry.err"; then
  fail 'captured database diagnostic leaked to output'
fi
set_sequence "$COMPILE_SEQUENCE" \
  'TIMEOUT:bounded transport deadline' \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/timeout.out" "$TMP/timeout.err"
[[ "$CASE_RC" -eq 0 ]] || fail 'bounded wall timeout did not recover'
json_assert "$(<"$TMP/timeout.out")" \
  "d['result']=='DRAINED' and d['databaseRetries']==1 and d['attempts']==2 and d['elapsedMillis']<20000"
set_sequence "$COMPILE_SEQUENCE" 'FATAL:permission contract changed' \
  "NO_WORK|BASELINE|0|0|2|null|0|$hash_a|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/fatal.out" "$TMP/fatal.err"
[[ "$CASE_RC" -eq 70 && "$(grep -c '^compile$' "$CALL_LOG")" -eq 1 ]] \
  || fail 'contract/ACL error consumed retries'

# Malformed NO_WORK and persistent BUSY fail closed.
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|BASELINE|0|0|2|null|1|$hash_a|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/forged.out" "$TMP/forged.err"
[[ "$CASE_RC" -eq 70 ]] || fail 'NO_WORK with dirty signal was accepted'
MAX_ATTEMPTS=2
set_sequence "$COMPILE_SEQUENCE" \
  "BUSY|BASELINE|0|0|2|null|1|$hash_a|$codegen_hash|READY|[]|0" "BUSY|BASELINE|0|0|2|null|1|$hash_a|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/exhausted.out" "$TMP/exhausted.err"
[[ "$CASE_RC" -eq 75 ]] || fail "BUSY exhaustion rc=$CASE_RC"

# Missing membership and role/ACL drift are immediate.
READINESS='NOT_AUTHORIZED'; MAX_ATTEMPTS=4
set_sequence "$COMPILE_SEQUENCE" "NO_WORK|BASELINE|0|0|2|null|0|$hash_a|$codegen_hash|READY|[]|0"
run_case PRE_WORK "$TMP/unauthorized.out" "$TMP/unauthorized.err"
[[ "$CASE_RC" -eq 77 && "$(<"$CALL_LOG")" == readiness ]] \
  || fail 'unauthorized worker was not blocked'
READINESS='CONTRACT_INVALID'
run_case PRE_WORK "$TMP/invalid-contract.out" "$TMP/invalid-contract.err"
[[ "$CASE_RC" -eq 78 ]] || fail 'invalid role contract was not blocked'

# Exercise the actual HERMES early-exit helper: PRE survives, POST drains once,
# and the run closes ATTENTION_REQUIRED instead of remaining RUNNING.
READINESS='READY'; : >"$CALL_LOG"
printf '%s\n' \
  '{"runStatus":"RUNNING","result":{"designCausality":{"compilerInvocation":{"preWork":{"result":"NO_WORK"}}}}}' \
  >"$EVIDENCE_STATE"
set_sequence "$COMPILE_SEQUENCE" \
  "NO_WORK|CANONICAL_COMPILED|1|1|2|11|0|$hash_b|$codegen_hash|READY|[]|0"
if hermes_post="$(finalize_hermes_policy_invalid_run \
  '00000000-0000-0000-0000-000000000001' 7 3 2)"; then
  :
else
  fail 'central HERMES post-work finalizer failed'
fi
json_assert "$hermes_post" \
  "d['phase']=='POST_WORK' and d['result']=='NO_WORK' and d['canonicalHash']=='$hash_b'"
[[ "$(grep -c '^compile$' "$CALL_LOG")" -eq 1 &&
   "$(grep -c '^persist-post$' "$CALL_LOG")" -eq 1 &&
   "$(grep -c '^persist-hermes-attention$' "$CALL_LOG")" -eq 1 ]] \
  || fail 'HERMES finalizer did not drain/persist exactly once'
EVIDENCE_STATE="$EVIDENCE_STATE" python3 - <<'PY'
import json, os
d=json.load(open(os.environ['EVIDENCE_STATE'], encoding='utf-8'))
inv=d['result']['designCausality']['compilerInvocation']
assert inv['preWork']['result']=='NO_WORK'
assert inv['postWork']['result']=='NO_WORK'
assert d['runStatus']=='ATTENTION_REQUIRED'
assert d['result']['reason']=='HERMES_PROJECT_WORK_POLICY_INVALID'
PY

# INT/TERM/HUP/ERR never invoke the compiler. They fail the run, preserve PRE,
# and record the next-PRE recovery obligation without replacing a prior POST.
for deferred_signal in INT TERM HUP; do
  : >"$CALL_LOG"
  printf '%s\n' \
    '{"runStatus":"RUNNING","result":{"designCausality":{"compilerInvocation":{"preWork":{"result":"NO_WORK"}}}}}' \
    >"$EVIDENCE_STATE"
  record_design_causality_deferred_recovery \
    '00000000-0000-0000-0000-000000000001' \
    ORCHESTRATOR_SIGNALLED "$deferred_signal" 130 null
  [[ "$(grep -c '^persist-deferred$' "$CALL_LOG")" -eq 1 &&
     "$(grep -c '^compile$' "$CALL_LOG" || true)" -eq 0 ]] \
    || fail "$deferred_signal invoked compiler or missed recovery evidence"
  EVIDENCE_STATE="$EVIDENCE_STATE" DEFERRED_SIGNAL="$deferred_signal" python3 - <<'PY'
import json, os
d=json.load(open(os.environ['EVIDENCE_STATE'], encoding='utf-8'))
inv=d['result']['designCausality']['compilerInvocation']
assert inv['preWork']['result']=='NO_WORK'
assert inv['postWork']['result']=='DEFERRED_RECOVERY_REQUIRED'
assert inv['postWork']['invoked'] is False
assert inv['postWork']['recoveryPhase']=='NEXT_PRE_WORK'
assert inv['postWork']['dirtyState']=='PRESERVED_UNOBSERVED'
assert inv['postWork']['reason']=='ORCHESTRATOR_SIGNALLED'
assert inv['postWork']['signal']==os.environ['DEFERRED_SIGNAL']
assert d['runStatus']=='FAILED' and d['result']['failureReason']=='ORCHESTRATOR_SIGNALLED'
PY
done
: >"$CALL_LOG"
printf '%s\n' \
  '{"runStatus":"RUNNING","result":{"designCausality":{"compilerInvocation":{"preWork":{"result":"NO_WORK"}}}}}' \
  >"$EVIDENCE_STATE"
set +e
fail_design_causality_run_deferred \
  '00000000-0000-0000-0000-000000000001' 77 75
deferred_err_rc=$?
set -e
[[ "$deferred_err_rc" -eq 75 && "$(grep -c '^compile$' "$CALL_LOG" || true)" -eq 0 ]] \
  || fail 'ERR deferred recovery lost the original exit code or invoked compiler'
EVIDENCE_STATE="$EVIDENCE_STATE" python3 - <<'PY'
import json, os
d=json.load(open(os.environ['EVIDENCE_STATE'], encoding='utf-8'))
inv=d['result']['designCausality']['compilerInvocation']
assert inv['preWork']['result']=='NO_WORK'
assert inv['postWork']['result']=='DEFERRED_RECOVERY_REQUIRED'
assert inv['postWork']['reason']=='ORCHESTRATOR_ERROR'
assert inv['postWork']['signal'] is None
assert d['runStatus']=='FAILED' and d['result']['failureReason']=='ORCHESTRATOR_ERROR'
PY
: >"$CALL_LOG"
printf '%s\n' \
  '{"runStatus":"RUNNING","result":{"designCausality":{"compilerInvocation":{"preWork":{"result":"NO_WORK"},"postWork":{"result":"DRAINED"}}}}}' \
  >"$EVIDENCE_STATE"
record_design_causality_deferred_recovery \
  '00000000-0000-0000-0000-000000000001' ORCHESTRATOR_ERROR null 1 88
EVIDENCE_STATE="$EVIDENCE_STATE" python3 - <<'PY'
import json, os
d=json.load(open(os.environ['EVIDENCE_STATE'], encoding='utf-8'))
inv=d['result']['designCausality']['compilerInvocation']
assert inv['preWork']['result']=='NO_WORK' and inv['postWork']['result']=='DRAINED'
assert d['runStatus']=='FAILED'
PY

# Static integration and persistence ordering contract.
function_start="$(grep -n '^run_design_causality_post_commit_compiler()' "$ORCHESTRATOR" | cut -d: -f1)"
function_end="$(grep -n '^if \[\[ "\${PROJECT_AUTO_COMPLETION_LIBRARY_ONLY' "$ORCHESTRATOR" | cut -d: -f1)"
function_body="$(sed -n "${function_start},$((function_end-1))p" "$ORCHESTRATOR")"
grep -Fq 'begin isolation level repeatable read' <<<"$function_body" \
  || fail 'REPEATABLE READ transaction missing'
grep -Fq "set local statement_timeout='2s'" <<<"$function_body" \
  || fail 'bounded SQL statement timeout missing'
grep -Fq "set local lock_timeout='1s'" <<<"$function_body" \
  || fail 'bounded SQL lock timeout missing'
grep -Fq 'set local role carbonet_design_compiler' <<<"$function_body" \
  || fail 'dedicated SET LOCAL ROLE boundary missing'
grep -Fq 'framework_run_design_causality_compiler_worker()' <<<"$function_body" \
  || fail 'narrow worker API missing'
if grep -Eq 'PGPASSWORD|PGHOST|kubectl|psql -' <<<"$function_body"; then
  fail 'compiler introduced an independent credential path'
fi
[[ "$(grep -Fc "to_regclass('public." <<<"$function_body")" -eq 32 ]] \
  || fail 'runtime readiness does not inspect 29 relations, 2 sequences, and exact trigger targets'
[[ "$(grep -Fc "to_regprocedure('public.framework_" <<<"$function_body")" -ge 18 ]] \
  || fail 'runtime readiness does not inspect every M1 protected function'
if grep -Fq 'design-causality-compiler-invocation/v1' "$ORCHESTRATOR"; then
  fail 'active orchestrator path retains a v1 compiler envelope'
fi
grep -Fq 'from pg_authid' <<<"$function_body" \
  || fail 'runtime readiness role attribute boundary incomplete'
grep -Fq "has_schema_privilege(role_oid,'public','CREATE')" <<<"$function_body" \
  || fail 'runtime readiness schema ACL boundary incomplete'
grep -Fq 'timeout --signal=TERM --kill-after=1s' "$ORCHESTRATOR" \
  || fail 'psql wall-clock timeout adapter missing'
[[ "$(grep -Fc 'run_design_causality_post_commit_compiler ' "$ORCHESTRATOR")" -eq 2 ]] \
  || fail 'expected exact pre/post compiler calls'
[[ "$(grep -Fc 'finalize_hermes_policy_invalid_run "$run_id"' "$ORCHESTRATOR")" -eq 1 ]] \
  || fail 'HERMES early path is not routed through its finalizer'
[[ "$(grep -Fc 'finalize_design_causality_post_work "$run_id"' "$ORCHESTRATOR")" -eq 1 ]] \
  || fail 'normal path does not have exactly one central finalizer'
[[ "$(grep -Fc 'finalize_design_causality_post_work "' "$ORCHESTRATOR")" -eq 2 ]] \
  || fail 'HERMES/normal do not have exactly two exclusive finalizer calls'
pre_line="$(grep -n 'run_design_causality_post_commit_compiler PRE_WORK' "$ORCHESTRATOR" | cut -d: -f1)"
run_insert_line="$(grep -n 'insert into framework_project_completion_run(run_id,result_json)' "$ORCHESTRATOR" | cut -d: -f1)"
first_recovery_line="$(grep -n 'with recovered as (' "$ORCHESTRATOR" | head -1 | cut -d: -f1)"
completed_line="$(grep -n '^completed=.*update framework_process_definition' "$ORCHESTRATOR" | cut -d: -f1)"
post_line="$(grep -n 'finalize_design_causality_post_work "$run_id"' "$ORCHESTRATOR" | tail -1 | cut -d: -f1)"
(( pre_line < run_insert_line && run_insert_line < first_recovery_line && completed_line < post_line )) \
  || fail 'compiler/run evidence call order is unsafe'
grep -Fq "'{designCausality,compilerInvocation,postWork}'" "$ORCHESTRATOR" \
  || fail 'post-work invocation persistence missing'
grep -Fq "set run_status='FAILED',completed_at=current_timestamp" "$ORCHESTRATOR" \
  || fail 'post-work failure closure missing'
hermes_finalize_line="$(grep -n 'finalize_hermes_policy_invalid_run "$run_id"' "$ORCHESTRATOR" | cut -d: -f1)"
hermes_exit_line="$(awk -v start="$hermes_finalize_line" 'NR>start && /exit 0/{print NR;exit}' "$ORCHESTRATOR")"
(( hermes_finalize_line < hermes_exit_line )) \
  || fail 'HERMES policy exit bypasses centralized POST finalization'
hermes_function_start="$(grep -n '^finalize_hermes_policy_invalid_run()' "$ORCHESTRATOR" | cut -d: -f1)"
hermes_function_end="$(awk -v start="$hermes_function_start" 'NR>start && /^}/{print NR;exit}' "$ORCHESTRATOR")"
sed -n "${hermes_function_start},${hermes_function_end}p" "$ORCHESTRATOR" | \
  grep -Fq 'coalesce(framework_try_jsonb(result_json)' \
  || fail 'HERMES policy result erases PRE/POST invocation evidence'
mapfile -t post_run_exit_lines < <(
  awk -v start="$run_insert_line" 'NR>start && /^[[:space:]]+exit /{print NR}' "$ORCHESTRATOR"
)
signal_deferred_line="$(grep -n 'record_design_causality_deferred_recovery ' "$ORCHESTRATOR" | awk -F: -v start="$run_insert_line" '$1>start{print $1;exit}')"
error_deferred_line="$(grep -n 'fail_design_causality_run_deferred "$run_id"' "$ORCHESTRATOR" | cut -d: -f1)"
(( ${#post_run_exit_lines[@]} == 4 &&
   signal_deferred_line < post_run_exit_lines[0] &&
   post_run_exit_lines[0] < error_deferred_line &&
   error_deferred_line < hermes_finalize_line &&
   hermes_finalize_line < post_run_exit_lines[1] &&
   post_run_exit_lines[1] < post_run_exit_lines[2] &&
   post_run_exit_lines[2] < post_line &&
   post_line < post_run_exit_lines[3] )) \
  || fail 'a PRE-success exit path has neither finalization nor deferred recovery'
deferred_function_start="$(grep -n '^record_design_causality_deferred_recovery()' "$ORCHESTRATOR" | cut -d: -f1)"
deferred_function_end="$(awk -v start="$deferred_function_start" 'NR>start && /^}/{print NR;exit}' "$ORCHESTRATOR")"
deferred_function_body="$(sed -n "${deferred_function_start},${deferred_function_end}p" "$ORCHESTRATOR")"
if grep -Eq 'framework_(design_change|design_causality|compile_design|cas_design|mark_design|capture_design)' <<<"$deferred_function_body"; then
  fail 'signal/ERR deferred handler calls causality authority'
fi
grep -Fq "del(.canonicalHash)" "$ORCHESTRATOR" \
  || fail 'canonical hash is not redacted from normal stdout'
post_tail="$(tail -n +"$post_line" "$ORCHESTRATOR")"
if grep -Eiq '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(framework_(process_definition|process_step|actor_definition|account_actor_assignment|permission_requirement_v1|permission_grant_v1|permission_mapping_control_v1|page_design|page_field_definition|professional_screen_contract)|comtnmenufunctioninfo|comtnauthorfunctionrelate|comtnuserfeatureoverride|comtnemplyrscrtyestbs)' <<<"$post_tail"; then
  fail 'tracked source DML exists after POST_WORK gate'
fi
if grep -Fq 'producerCoverage' <<<"$function_body"; then
  fail 'invocation falsely claims persistent producer coverage'
fi

echo '[design-causality-compiler-worker] PASS mutants=35 oldDbWriteBlock=1 oldV1WriteBlock=1 exactTriggerReadiness=26 blockedRemediation=allowed readinessConsistency=2 noWorkLinearized=1 maxGateSeconds=18 piiLogs=0 durableHeadLink=1 hermesPostDrain=1 abnormalCompilerCalls=0 originalErrRc=preserved nextPreRecovery=required prePost=2 generationEnforcement=false persistentCoverageClaim=0 deploymentWiring=0'

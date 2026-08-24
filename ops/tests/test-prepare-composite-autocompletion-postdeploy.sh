#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSITE_AUTOCOMPLETION_LIBRARY_ONLY=true
# shellcheck source=ops/scripts/prepare-composite-autocompletion-postdeploy.sh
source "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
printf 'CARBONET_ACTOR_TEST_PASSWORD=value-without-spaces\n' >"$tmp/good.env"
printf 'UNRELATED=value\n' >"$tmp/missing.env"
[[ "$(secret_value_from_file "$tmp/good.env" CARBONET_ACTOR_TEST_PASSWORD)" == value-without-spaces ]]
if secret_value_from_file "$tmp/missing.env" CARBONET_ACTOR_TEST_PASSWORD >/dev/null; then
  echo 'missing secret accepted' >&2; exit 1
fi
require_exact_denied_account_count 1
for invalid in 0 2 '' text; do
  if require_exact_denied_account_count "$invalid"; then
    echo "denied account count accepted: $invalid" >&2; exit 1
  fi
done
campaign_runtime_superseded campaign \
  cccccccccccccccccccccccccccccccccccccccc \
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
superseded_status=0
( if skip_superseded_campaign campaign \
      cccccccccccccccccccccccccccccccccccccccc \
      aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa >/dev/null; then
    exit 0
  fi
  exit 2
) || superseded_status=$?
[[ "$superseded_status" == 0 ]] || {
  echo "superseded campaign did not terminate successfully: $superseded_status" >&2; exit 1
}
if campaign_runtime_superseded campaign \
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; then
  echo 'current campaign was classified as superseded' >&2; exit 1
fi
runtime_commit='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
stale_runtime_commit='cccccccccccccccccccccccccccccccccccccccc'
authority_hash='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
stale_authority_hash='dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
final_authority_hash='eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
candidate_id='postdeploy:aaaaaaaaaaaa:composite-test'
stale_candidate_id='postdeploy:aaaaaaaaaaaa:stale-test'
pass='{"success":true,"dryRun":true,"capabilityEnabled":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseFinalized":false,"currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentSourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentFinalAuthoritySetHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","currentVerifiedCanaryFinalAuthorityHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","tenMinuteTarget":"PASS","estimatedTotalSeconds":599,"physicalSampleCount":1,"historicalPhysicalSampleCount":7,"currentVerifiedCanaryCount":1,"activeCanaryCount":0,"currentVerifiedCanaryProcessCode":"PROCESS_A","currentVerifiedCanaryJobId":42,"requiredParallelism":8,"liveSmokeParallelism":8,"preflightComplete":true,"preflightStable":true,"preflightBusy":false,"preflightCandidateCount":108,"preflightCheckedCount":108,"preflightFailureCount":0,"preflightTimedOutCount":0,"preflightLatencyMs":9000,"quiescentForGateTransition":true}'
measurement_required='{"success":true,"dryRun":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","tenMinuteTarget":"MEASUREMENT_REQUIRED","estimatedTotalSeconds":null,"physicalSampleCount":0,"historicalPhysicalSampleCount":7,"currentVerifiedCanaryCount":0,"activeCanaryCount":0,"currentVerifiedCanaryJobId":0,"requiredParallelism":null,"liveSmokeParallelism":8}'
inspection_allows_enable "$pass" "$runtime_commit" "$authority_hash"
timed_out="${pass/\"preflightTimedOutCount\":0/\"preflightTimedOutCount\":1}"
timed_out="${timed_out/\"preflightComplete\":true/\"preflightComplete\":false}"
if inspection_allows_enable "$timed_out" "$runtime_commit" "$authority_hash"; then
  echo 'timed-out compiler preflight accepted' >&2; exit 1
fi
if inspection_allows_enable "$measurement_required" "$runtime_commit" "$authority_hash"; then
  echo 'unmeasured canary accepted for automatic enablement' >&2; exit 1
fi
if inspection_allows_enable "$pass" "$stale_runtime_commit" "$authority_hash"; then
  echo 'stale runtime commit inspection accepted' >&2; exit 1
fi
if inspection_allows_enable "$pass" "$runtime_commit" "$stale_authority_hash"; then
  echo 'stale authority-set inspection accepted' >&2; exit 1
fi
historical_only='{"success":true,"dryRun":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","tenMinuteTarget":"PASS","estimatedTotalSeconds":599,"physicalSampleCount":0,"historicalPhysicalSampleCount":7,"currentVerifiedCanaryCount":0,"activeCanaryCount":0,"currentVerifiedCanaryJobId":0,"requiredParallelism":8,"liveSmokeParallelism":8}'
if inspection_allows_enable "$historical_only" "$runtime_commit" "$authority_hash"; then
  echo 'historical physical samples accepted without a current verified canary' >&2; exit 1
fi
missing_canary='{"success":true,"dryRun":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","tenMinuteTarget":"PASS","estimatedTotalSeconds":599,"physicalSampleCount":1,"currentVerifiedCanaryCount":0,"activeCanaryCount":0,"currentVerifiedCanaryJobId":0,"requiredParallelism":8,"liveSmokeParallelism":8}'
if inspection_allows_enable "$missing_canary" "$runtime_commit" "$authority_hash"; then
  echo 'missing current verified canary accepted' >&2; exit 1
fi
active_canary='{"success":true,"dryRun":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","tenMinuteTarget":"PASS","estimatedTotalSeconds":599,"physicalSampleCount":1,"currentVerifiedCanaryCount":1,"activeCanaryCount":1,"currentVerifiedCanaryJobId":42,"requiredParallelism":8,"liveSmokeParallelism":8}'
if inspection_allows_enable "$active_canary" "$runtime_commit" "$authority_hash"; then
  echo 'active canary accepted before terminal verification' >&2; exit 1
fi
multiple_canaries='{"success":true,"dryRun":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","tenMinuteTarget":"PASS","estimatedTotalSeconds":599,"physicalSampleCount":1,"currentVerifiedCanaryCount":2,"activeCanaryCount":0,"currentVerifiedCanaryJobId":42,"requiredParallelism":8,"liveSmokeParallelism":8}'
if inspection_allows_enable "$multiple_canaries" "$runtime_commit" "$authority_hash"; then
  echo 'multiple current verified canaries accepted' >&2; exit 1
fi
enabled='{"success":true,"dryRun":true,"enabled":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","gateRuntimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","gatePostdeployCandidateId":"postdeploy:aaaaaaaaaaaa:composite-test","releaseFinalized":true,"currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentSourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentFinalAuthoritySetHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateFinalAuthorityHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateStatus":"ACTIVE","preparedBindingCurrent":false,"approvalBindingCurrent":true,"gateSourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanarySourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanaryFinalAuthorityHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateCanaryProcessCode":"PROCESS_A","currentVerifiedCanaryProcessCode":"PROCESS_A","gateCanaryJobId":42,"currentVerifiedCanaryJobId":42,"currentVerifiedCanaryCount":1,"activeCanaryCount":0,"preflightComplete":true,"preflightStable":true,"preflightTimedOutCount":0,"automaticEnablementAllowed":true}'
inspection_confirms_enabled "$enabled" "$runtime_commit" "$authority_hash" "$candidate_id"
prepared='{"success":true,"dryRun":true,"enabled":false,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","gateRuntimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","gatePostdeployCandidateId":"postdeploy:aaaaaaaaaaaa:composite-test","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentSourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentFinalAuthoritySetHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateFinalAuthorityHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateStatus":"PREPARED","preparedBindingCurrent":true,"approvalBindingCurrent":false,"gateSourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanarySourceInputAuthorityHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanaryFinalAuthorityHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","gateCanaryProcessCode":"PROCESS_A","currentVerifiedCanaryProcessCode":"PROCESS_A","gateCanaryJobId":42,"currentVerifiedCanaryJobId":42,"currentVerifiedCanaryCount":1,"activeCanaryCount":0,"preflightComplete":true,"preflightStable":true,"preflightTimedOutCount":0,"automaticEnablementAllowed":false}'
inspection_confirms_prepared "$prepared" "$runtime_commit" "$authority_hash" "$candidate_id"
if inspection_confirms_enabled "$enabled" "$runtime_commit" "$authority_hash" "$stale_candidate_id"; then
  echo 'ACTIVE gate with a stale postdeploy candidate was accepted' >&2; exit 1
fi
if inspection_confirms_prepared "$prepared" "$runtime_commit" "$authority_hash" "$stale_candidate_id"; then
  echo 'PREPARED gate with a stale postdeploy candidate was accepted' >&2; exit 1
fi
if inspection_confirms_enabled "$prepared" "$runtime_commit" "$authority_hash" "$candidate_id"; then
  echo 'PREPARED gate was accepted as worker-enabled before finalization' >&2; exit 1
fi
if inspection_confirms_prepared "$enabled" "$runtime_commit" "$authority_hash" "$candidate_id"; then
  echo 'ACTIVE gate was accepted as non-live PREPARED state' >&2; exit 1
fi
enabled_stale='{"success":true,"dryRun":true,"enabled":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","approvedRuntimeCommit":"cccccccccccccccccccccccccccccccccccccccc","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","approvedAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanaryCount":1,"activeCanaryCount":0,"automaticEnablementAllowed":true}'
if inspection_confirms_enabled "$enabled_stale" "$runtime_commit" "$authority_hash" "$candidate_id"; then
  echo 'post-enable stale approval binding accepted' >&2; exit 1
fi
enabled_gate_closed='{"success":true,"dryRun":true,"enabled":true,"runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","approvedRuntimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","currentAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","approvedAuthoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","currentVerifiedCanaryCount":1,"activeCanaryCount":0,"automaticEnablementAllowed":false}'
if inspection_confirms_enabled "$enabled_gate_closed" "$runtime_commit" "$authority_hash" "$candidate_id"; then
  echo 'post-enable closed runtime gate accepted' >&2; exit 1
fi
approval='{"schema":"carbonet.composite-autocompletion-approval/v1","decision":"MEASURED_PASS","runtimeCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","authoritySetHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'
audit_marker_matches "$approval" "$runtime_commit" "$authority_hash"
if audit_marker_matches "$approval" "$stale_runtime_commit" "$authority_hash"; then
  echo 'stale runtime commit approval accepted' >&2; exit 1
fi
if audit_marker_matches "$approval" "$runtime_commit" "$stale_authority_hash"; then
  echo 'stale authority-set approval accepted' >&2; exit 1
fi
grep -Fq 'BRIDGE_SECRET="${CARBONET_COMPOSITE_BRIDGE_SECRET:-resonance-ops-bridge}"' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq "jsonpath={.data.RESONANCE_OPS_TOKEN}" \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
if grep -Eq 'kubectl .*set env|kubectl .*rollout status' \
    "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"; then
  echo 'approval helper still creates an unvalidated rollout' >&2; exit 1
fi
grep -Fq 'change_approval PREPARE' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'change_approval ACTIVATE' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'effectiveWithoutRollout' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'inspection_confirms_enabled' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'prepared gate commit source canary binding mismatch' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'runtime_revision_ready || fail' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'configured and actual runtime replica counts differ' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq "return 1" "$ROOT/ops/scripts/auto-deploy-main.sh"
grep -Fq 'measured capacity is insufficient' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq '"$mode" == campaign' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'CAMPAIGN_TIMEOUT_SECONDS="${CARBONET_COMPOSITE_CAMPAIGN_TIMEOUT_SECONDS:-720}"' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'while ((SECONDS<campaign_deadline)); do' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'dispatch_current_canary' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'CARBONET_COMPOSITE_EXPECTED_RUNTIME_COMMIT' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh"
grep -Fq 'RESONANCE_COMPOSITE_AUTOCOMPLETION_CAPABILITY_ENABLED=true' \
  "$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
grep -Fq 'RESONANCE_COMPOSITE_AUTOCOMPLETION_CAPABILITY_ENABLED: "true"' \
  "$ROOT/deploy/k8s/projects/carbonet/carbonet-runtime.config.yaml"
if grep -Fq 'RESONANCE_COMPOSITE_AUTOCOMPLETION_ENABLED=' \
    "$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"; then
  echo 'legacy enabled env still controls production capability' >&2; exit 1
fi
reconcile_block="$(sed -n '/if \[\[ "$mode" == reconcile \]\]; then/,/^fi$/p' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh")"
grep -Fq 'prepare_current_gate' <<<"$reconcile_block"
if grep -Fq 'activate_current_gate' <<<"$reconcile_block"; then
  echo 'reconcile activated workers before authoritative finalization' >&2; exit 1
fi
if grep -Fq 'audit_marker_matches' <<<"$reconcile_block"; then
  echo 'audit mirror still authorizes durable gate reconciliation' >&2; exit 1
fi
python3 - "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh" <<'PY' || {
import pathlib,re,sys
source=pathlib.Path(sys.argv[1]).read_text()

def function(name):
    match=re.search(rf'(?ms)^{re.escape(name)}\(\)\{{\n(.*?)^\}}$',source)
    assert match, name
    return match.group(1).rstrip()

# Both durable-state confirmation helpers must bind the fourth argument: the
# exact deployment-attempt candidate, not merely the source commit and H0.
enabled=function('inspection_confirms_enabled')
prepared=function('inspection_confirms_prepared')
assert 'x.get("gatePostdeployCandidateId")==sys.argv[4]' in enabled
assert 'x.get("gatePostdeployCandidateId")==sys.argv[4]' in prepared

# The narrow cleanup mode can only revoke this candidate's PREPARED revision.
assert '"$mode" == revoke-prepared' in source
candidate_guard=source.split('if [[ "$mode" == enable',1)[1].split('fi',1)[0]
assert '"$mode" == revoke-prepared' in candidate_guard
change=function('change_approval')
assert '"$action" == REVOKE_PREPARED' in change
assert 'expectedPostdeployCandidateId:$candidate' in change
revoke_prepared=function('revoke_prepared_gate')
assert '== PREPARED' in revoke_prepared
assert '.gatePostdeployCandidateId' in revoke_prepared
assert '== "$POSTDEPLOY_CANDIDATE_ID"' in revoke_prepared
assert 'change_approval REVOKE_PREPARED' in revoke_prepared

# ACTIVATE is the linearization point. Its HTTP CAS is the final fallible
# command, and both entry paths exit immediately after it succeeds.
activate=function('activate_current_gate')
assert activate.endswith('change_approval ACTIVATE "$revision" >/dev/null')
for mode,next_mode in (('enable','activate'),('activate','revoke')):
    block=source.split(f'if [[ "$mode" == {mode} ]]; then',1)[1]
    block=block.split(f'if [[ "$mode" == {next_mode} ]]; then',1)[0]
    assert re.search(r'activate_current_gate\s*\n\s*exit 0',block)
campaign=source.split('if [[ "$mode" == campaign ]]; then',2)[-1]
campaign=campaign.split("fail 'asynchronous canary campaign exceeded its bounded deadline'",1)[0]
assert 'systemctl enable --now resonance-composite-live-smoke.timer' in campaign
assert 'while ((SECONDS<campaign_deadline)); do' in campaign
assert campaign.index('dispatch_current_canary') < campaign.rindex('sleep "$CAMPAIGN_POLL_SECONDS"')
assert campaign.index('prepare_current_gate') < campaign.index('activate_current_gate')
assert re.search(r'activate_current_gate\s*\n\s*campaign_prepared=false\s*\n\s*exit 0',campaign)
early=source.index('early_runtime_commit=')
token=source.index('token_tmp=')
denied=source.index('denied_count=')
account_map=source.index('generate-composite-relay-account-map.py')
assert early < token < denied < account_map
early_block=source[early:token]
assert 'skip_superseded_campaign' in early_block and 'exit 0' in early_block
fail_closed=function('best_effort_revoke_preflight_gate')
assert '.gatePostdeployCandidateId' in fail_closed
assert 'change_approval REVOKE_PREPARED' in fail_closed
assert 'change_approval REVOKE ' in fail_closed
assert '"$POSTDEPLOY_CANDIDATE_ID"' in fail_closed
PY
  echo 'exact-candidate PREPARED cleanup or last-fallible ACTIVATE contract is missing' >&2; exit 1
}
python3 - \
  "$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql" \
  "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java" \
  "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java" \
  "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java" <<'PY' || {
import pathlib,re,sys
migration,service,worker,controller=(pathlib.Path(path).read_text() for path in sys.argv[1:])
assert "'DISABLED','PREPARED','ACTIVE','REVOKED'" in migration
assert "set approval_status='PREPARED'" in service
assert "set approval_status='ACTIVE'" in service
assert "approval_status='PREPARED'" in service
assert '"PREPARED".equals(gate.get("approvalStatus"))' in service
assert '"ACTIVE".equals(gate.get("approvalStatus"))' in service
prepare=service.split('public Map<String,Object> prepare(',1)[1].split(
    'public Map<String,Object> approve(',1)[0]
assert 'Map<String,Object> gate=lockGate();' in prepare
assert 'globallyInFlight()!=0' in prepare
lock=service.split('private Map<String,Object> lockGate()',1)[1].split(
    'Snapshot snapshot(',1)[0]
assert 'integrated_design_autocompletion_gate' in lock and 'for update' in lock.lower()
active=service.split('void assertActiveExecutionBinding(',1)[1].split(
    'boolean retainActiveGateOrRevokeOnSourceDrift(',1)[0]
assert 'integrated_design_autocompletion_gate' in active
assert 'for share' in active.lower()
assert '"ACTIVE".equals(gate.get("approvalStatus"))' in active
for binding in ('revision','runtimeCommit','sourceInputAuthorityHash',
                'expectedRuntimeIdentity','currentVerifiedCanaries','finalizerPromoted'):
    assert binding in active
dispatch=worker.split('private Map<String,Object> dispatchAvailable(',1)[1].split(
    'private Map<String,Object> dispatchReceipt(',1)[0]
lock_index=dispatch.index('readiness.acquireGlobalDispatchLock(')
guard_index=dispatch.index('if(!readiness.retainActiveGateOrRevokeOnSourceDrift(')
claim_index=dispatch.index('List<Map<String,Object>> one=claimOne(')
assert lock_index < guard_index < claim_index
assert 'new GateContext(' in dispatch and 'row.put("gateContext",claimedGate)' in dispatch
complete=worker.split('private void complete(',1)[1].split(
    'private void recordFailure(',1)[0]
complete_guard=complete.index('readiness.assertActiveExecutionBinding(')
compile_index=complete.index('governance.compileIntegratedDesignProcess(')
assert complete_guard < compile_index
assert 'Boolean.TRUE.equals(report.get("automaticEnablementAllowed"))' in worker
assert 'readiness.prepare(' in worker and 'readiness.activate(' in worker
assert 'case "PREPARE","APPROVE"' in controller
assert 'case "ACTIVATE"' in controller
assert 'case "REVOKE_PREPARED"' in controller
PY
  echo 'PREPARED/ACTIVE state machine or transaction-time bulk-claim fence is missing' >&2; exit 1
}
python3 - "$ROOT/ops/scripts/auto-deploy-main.sh" <<'PY' || {
import pathlib,re,sys
lines=pathlib.Path(sys.argv[1]).read_text().splitlines()
calls=[i for i,line in enumerate(lines) if line.strip().startswith("reconcile_composite_autocompletion_postdeploy || {")]
assert len(calls)==2
for index in calls:
    following=[line.strip() for line in lines[index+1:] if line.strip() and
               not line.lstrip().startswith("#") and line.strip() != "}" and
               "composite_autocompletion_gate_prepared=false" not in line and
               "optional composite reconcile returned nonzero" not in line]
    assert following and following[0]=="finalize_postdeploy_candidate_release_with_composite_gate_cleanup"
source="\n".join(lines)
wrapper=source.split("finalize_postdeploy_candidate_release_with_composite_gate_cleanup() {",1)[1]
wrapper=wrapper.split("\n}",1)[0]
finalize=wrapper.index("if finalize_postdeploy_candidate_release; then")
deferred=wrapper.index('if [[ "${composite_autocompletion_gate_prepared:-false}" != true ]]')
launch=wrapper.index("launch_composite_autocompletion_postdeploy_campaign")
activate=wrapper.index("prepare-composite-autocompletion-postdeploy.sh activate")
revoke_prepared=wrapper.index("prepare-composite-autocompletion-postdeploy.sh revoke-prepared")
assert finalize < deferred < launch < activate < revoke_prepared
assert "composite_autocompletion_gate_prepared=false" in wrapper
assert not re.search(r'prepare-composite-autocompletion-postdeploy\.sh\s+revoke(?!-)',wrapper)
launcher=source.split("launch_composite_autocompletion_postdeploy_campaign() {",1)[1]
launcher=launcher.split("\n}",1)[0]
assert "systemd-run" in launcher and "--collect" in launcher
assert "--wait" not in launcher
assert launcher.index("CARBONET_COMPOSITE_EXPECTED_RUNTIME_COMMIT") < launcher.index("campaign;")
assert "CARBONET_COMPOSITE_CAMPAIGN_TIMEOUT_SECONDS=720" in launcher
assert "--property=Restart=no" in launcher
assert "--property=Restart=on-failure" not in launcher
assert "--property=RestartSec=" not in launcher
assert "--property=StartLimitBurst=" not in launcher
reconcile=source.split("reconcile_composite_autocompletion_postdeploy(){",1)[1]
reconcile=reconcile.split("\n}",1)[0]
assert "gate=PREPARED prepared=true" in reconcile
flag=reconcile.index("composite_autocompletion_gate_prepared=true")
proof=reconcile.index("gate=PREPARED prepared=true")
assert proof < flag
failure=reconcile.split('else',1)[-1]
assert 'prepare-composite-autocompletion-postdeploy.sh revoke-candidate' in failure
assert 'disable --now resonance-composite-live-smoke.timer' in failure
assert 'return 0' in failure
assert source.count('reconcile_composite_autocompletion_postdeploy || {') == 2
assert source.count('optional composite reconcile returned nonzero; release continues gate-disabled') == 2
cleanup=source.split("cleanup_deploy() {",1)[1].split("\n}",1)[0]
prepared_guard=cleanup.index('if [[ "${composite_autocompletion_gate_prepared:-false}" == true ]]')
cleanup_revoke=cleanup.index("revoke-prepared")
assert prepared_guard < cleanup_revoke
assert 'CARBONET_POSTDEPLOY_CANDIDATE_ID="$postdeploy_candidate_id"' in cleanup
assert not re.search(r'prepare-composite-autocompletion-postdeploy\.sh"?\s*\\?\s*revoke(?!-)',cleanup)
recovery=source.split('if [[ "$postdeploy_recovered_commit" == "$target_commit"',1)[1]
recovery=recovery.split('# Remote B may arrive',1)[0]
prepared=recovery.index('if [[ "$early_composite_gate_status" == PREPARED ]]')
candidate=recovery.index('[[ "$early_composite_gate_candidate" =~',prepared)
activate=recovery.index('prepare-composite-autocompletion-postdeploy.sh" activate',candidate)
success_exit=recovery.index('exit 0',activate)
ordinary_exit=recovery.index('exit 0',success_exit+1)
assert prepared < candidate < activate < success_exit < ordinary_exit
assert recovery[activate:].splitlines()[1].strip()=='exit 0'
PY
  echo 'guarded finalization or prepared-only deploy cleanup contract is missing' >&2; exit 1
}
# Dynamically exercise the extracted production wrapper without sourcing the
# deployment program. PREPARED must be non-executable while the finalizer runs;
# failure may only revoke the exact candidate's PREPARED revision. Success may
# only ACTIVATE after finalization and must leave no later cleanup action.
eval "$(sed -n \
  '/^finalize_postdeploy_candidate_release_with_composite_gate_cleanup() {/,/^}/p' \
  "$ROOT/ops/scripts/auto-deploy-main.sh")"
gate_state=PREPARED
finalizer_observed_gate=''
helper_actions=()
helper_candidates=()
campaign_launch_count=0
finalizer_count=0
finalizer_status=37
helper_activate_status=0
bulk_claim_count(){
  [[ "$gate_state" == ACTIVE ]] && printf '1\n' || printf '0\n'
}
finalize_postdeploy_candidate_release(){
  finalizer_count=$((finalizer_count+1))
  finalizer_observed_gate="$gate_state"
  return "$finalizer_status"
}
launch_composite_autocompletion_postdeploy_campaign(){
  campaign_launch_count=$((campaign_launch_count+1))
}
bash(){
  local helper_mode="${*: -1}"
  helper_actions+=("$helper_mode")
  helper_candidates+=("${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}")
  [[ "${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}" == "$candidate_id" ]] || return 63
  case "$helper_mode" in
    activate)
      ((helper_activate_status==0)) || return "$helper_activate_status"
      [[ "$gate_state" == PREPARED ]] || return 65
      gate_state=ACTIVE
      ;;
    revoke-prepared)
      [[ "$gate_state" == PREPARED ]] || return 66
      gate_state=REVOKED
      ;;
    revoke) return 67 ;;
    *) return 64 ;;
  esac
}
sudo(){ return 0; }
ROOT_DIR="$ROOT"
postdeploy_candidate_id="$candidate_id"
composite_autocompletion_gate_prepared=true
[[ "$(bulk_claim_count)" == 0 ]] || {
  echo 'PREPARED gate allowed a bulk claim before finalization' >&2; exit 1
}
finalize_failure_status=0
finalize_postdeploy_candidate_release_with_composite_gate_cleanup ||
  finalize_failure_status=$?
[[ "$finalize_failure_status" == 37 ]] || {
  echo "guarded finalizer lost original failure status: $finalize_failure_status" >&2; exit 1
}
[[ "$finalizer_observed_gate" == PREPARED ]] || {
  echo "gate changed before finalizer: $finalizer_observed_gate" >&2; exit 1
}
[[ "${helper_actions[*]}" == revoke-prepared && "$gate_state" == REVOKED ]] || {
  echo "finalizer failure did not exclusively revoke PREPARED gate: ${helper_actions[*]} $gate_state" >&2
  exit 1
}
[[ "${helper_candidates[*]}" == "$candidate_id" ]] || {
  echo "finalizer cleanup lost exact candidate identity: ${helper_candidates[*]}" >&2; exit 1
}
[[ "$campaign_launch_count" == 0 ]] || {
  echo 'failed finalizer launched an asynchronous campaign' >&2; exit 1
}
[[ "$(bulk_claim_count)" == 0 ]] || {
  echo 'REVOKED gate allowed a bulk claim after finalizer failure' >&2; exit 1
}

# Successful finalization invokes ACTIVATE exactly once and returns immediately;
# no generic or prepared-only revoke may run after the worker-visible CAS.
gate_state=PREPARED; finalizer_observed_gate=''; helper_actions=(); helper_candidates=()
finalizer_status=0; helper_activate_status=0; composite_autocompletion_gate_prepared=true
finalize_postdeploy_candidate_release_with_composite_gate_cleanup
[[ "$finalizer_observed_gate" == PREPARED ]] || {
  echo "gate changed before successful finalization: $finalizer_observed_gate" >&2; exit 1
}
[[ "${helper_actions[*]}" == activate && "$gate_state" == ACTIVE ]] || {
  echo "successful finalizer did not exclusively activate: ${helper_actions[*]} $gate_state" >&2; exit 1
}
[[ "${helper_candidates[*]}" == "$candidate_id" &&
   "$composite_autocompletion_gate_prepared" == false ]] || {
  echo 'successful activation did not consume the exact prepared candidate' >&2; exit 1
}
[[ "$campaign_launch_count" == 0 ]] || {
  echo 'PREPARED success launched a duplicate asynchronous campaign' >&2; exit 1
}

# If the optional ACTIVATE HTTP CAS fails, the wrapper must preserve the
# already-authoritative release, revoke only the candidate-fenced PREPARED
# gate, and leave bulk work disabled.
gate_state=PREPARED; finalizer_observed_gate=''; helper_actions=(); helper_candidates=()
finalizer_status=0; helper_activate_status=41; composite_autocompletion_gate_prepared=true
activation_failure_status=0
finalize_postdeploy_candidate_release_with_composite_gate_cleanup ||
  activation_failure_status=$?
[[ "$activation_failure_status" == 0 ]] || {
  echo "optional activation failure rolled back the release: $activation_failure_status" >&2; exit 1
}
[[ "${helper_actions[*]}" == 'activate revoke-prepared' && "$gate_state" == REVOKED ]] || {
  echo "activation failure did not revoke only PREPARED: ${helper_actions[*]} $gate_state" >&2; exit 1
}
[[ "${helper_candidates[*]}" == "$candidate_id $candidate_id" ]] || {
  echo "activation failure cleanup lost exact candidate identity: ${helper_candidates[*]}" >&2; exit 1
}
[[ "$(bulk_claim_count)" == 0 ]] || {
  echo 'failed activation allowed a bulk claim' >&2; exit 1
}

# A fresh, unmeasured runtime finalizes with its durable gate disabled. It
# queues exactly one non-blocking campaign only after the release finalizer and
# performs no synchronous PREPARE or ACTIVATE on the critical path.
gate_state=DISABLED; finalizer_observed_gate=''; helper_actions=(); helper_candidates=()
campaign_launch_count=0; finalizer_count=0; finalizer_status=0; helper_activate_status=0
composite_autocompletion_gate_prepared=false
finalize_postdeploy_candidate_release_with_composite_gate_cleanup
[[ "$finalizer_observed_gate" == DISABLED && "$gate_state" == DISABLED ]] || {
  echo 'fresh release changed the gate before asynchronous evidence' >&2; exit 1
}
[[ "${#helper_actions[@]}" == 0 && "$campaign_launch_count" == 1 \
   && "$finalizer_count" == 1 ]] || {
  echo "fresh/denied0 release counts differ from finalizer1 async1 source0: ${helper_actions[*]} $campaign_launch_count $finalizer_count" >&2
  exit 1
}
unset -f bash sudo bulk_claim_count finalize_postdeploy_candidate_release \
  launch_composite_autocompletion_postdeploy_campaign \
  finalize_postdeploy_candidate_release_with_composite_gate_cleanup

# The exact commit+candidate transient unit is delivered once while active and
# never restarts after an unavailable optional inspection. A later deployment
# may enqueue a new commit-bound unit, but one release cannot create a storm.
eval "$(sed -n '/^launch_composite_autocompletion_postdeploy_campaign() {/,/^}/p' \
  "$ROOT/ops/scripts/auto-deploy-main.sh")"
launcher_active=false; launcher_calls=()
target_commit="$runtime_commit"; postdeploy_candidate_id="$candidate_id"; ROOT_DIR="$ROOT"
systemctl(){ [[ "$launcher_active" == true ]]; }
sudo(){ launcher_calls+=("$*"); launcher_active=true; return 0; }
launch_composite_autocompletion_postdeploy_campaign
launch_composite_autocompletion_postdeploy_campaign
[[ "${#launcher_calls[@]}" == 1 \
   && "${launcher_calls[0]}" == *'--property=Restart=no'* \
   && "${launcher_calls[0]}" != *'--property=Restart=on-failure'* \
   && "${launcher_calls[0]}" != *'--property=RestartSec='* \
   && "${launcher_calls[0]}" != *'--property=StartLimitBurst='* ]] || {
  echo "campaign duplicate/retry contract invalid: ${launcher_calls[*]}" >&2; exit 1
}
unset -f sudo systemctl launch_composite_autocompletion_postdeploy_campaign

# Reconcile may return successfully for a fresh disabled gate, but the outer
# PREPARED flag follows the exact helper proof rather than the exit status.
eval "$(sed -n '/^reconcile_composite_autocompletion_postdeploy(){/,/^}/p' \
  "$ROOT/ops/scripts/auto-deploy-main.sh")"
reconcile_payload='[composite-autocompletion-postdeploy] READY mode=reconcile gate=DISABLED prepared=false target=MEASUREMENT_REQUIRED scheduler=false processes=108 identities=324 samples=0 estimateSeconds=NA requiredParallelism=NA slots=8 replicas=2'
sudo_actions=(); reconcile_status=0; reconcile_calls="$tmp/reconcile-calls"
: >"$reconcile_calls"
bash(){
  local helper_mode="${*: -1}"
  printf '%s\n' "$helper_mode" >>"$reconcile_calls"
  if [[ "$helper_mode" == reconcile ]]; then
    ((reconcile_status==0)) || return "$reconcile_status"
    printf '%s\n' "$reconcile_payload"
    return 0
  fi
  [[ "$helper_mode" == revoke-candidate ]]
}
sudo(){ sudo_actions+=("$*"); return 0; }
composite_autocompletion_gate_prepared=true
reconcile_composite_autocompletion_postdeploy
[[ "$composite_autocompletion_gate_prepared" == false \
   && "${sudo_actions[*]}" == *'disable --now resonance-composite-live-smoke.timer'* ]] || {
  echo 'fresh DISABLED reconcile forged a PREPARED outer flag' >&2; exit 1
}
reconcile_payload='[composite-autocompletion-postdeploy] READY mode=reconcile gate=PREPARED prepared=true target=PASS scheduler=false processes=108 identities=324 samples=1 estimateSeconds=590 requiredParallelism=8 slots=8 replicas=2'
sudo_actions=(); composite_autocompletion_gate_prepared=false
reconcile_composite_autocompletion_postdeploy
[[ "$composite_autocompletion_gate_prepared" == true \
   && "${sudo_actions[*]}" == *'enable --now resonance-composite-live-smoke.timer'* ]] || {
  echo 'exact PREPARED reconcile failed to set its outer flag' >&2; exit 1
}

# Any denied/account-map/migration-style helper failure is fail-closed but does
# not block the authoritative finalizer: one general exact-candidate revoke is
# attempted and the timer is disabled before returning success.
reconcile_status=2; sudo_actions=(); : >"$reconcile_calls"
composite_autocompletion_gate_prepared=true
err_trap_calls=0
trap 'err_trap_calls=$((err_trap_calls+1))' ERR
reconcile_composite_autocompletion_postdeploy
trap - ERR
[[ "$composite_autocompletion_gate_prepared" == false \
   && "$(paste -sd' ' "$reconcile_calls")" == 'reconcile revoke-candidate' \
   && "${sudo_actions[*]}" == *'disable --now resonance-composite-live-smoke.timer'* \
   && "$err_trap_calls" == 0 ]] || {
  echo "failed reconcile did not degrade safely: $(paste -sd' ' "$reconcile_calls") ${sudo_actions[*]} errTrap=$err_trap_calls" >&2
  exit 1
}
unset -f bash sudo reconcile_composite_autocompletion_postdeploy

# denied-role count 0 never invokes account-map generation. With an exact
# candidate already ACTIVE/PREPARED, the helper uses the matching durable CAS
# and verifies the timer is inactive while keeping reconcile non-blocking.
eval "$(sed -n '/^best_effort_revoke_preflight_gate(){/,/^}/p' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh")"
eval "$(sed -n '/^fail_closed_preflight_state(){/,/^}/p' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh")"
POSTDEPLOY_CANDIDATE_ID="$candidate_id"
inspection="{\"gateStatus\":\"ACTIVE\",\"gateRevision\":7,\"gatePostdeployCandidateId\":\"$candidate_id\",\"enabled\":true}"
revoked_inspection="{\"gateStatus\":\"REVOKED\",\"gateRevision\":8,\"gatePostdeployCandidateId\":\"$candidate_id\",\"enabled\":false}"
preflight_calls="$tmp/preflight-calls"
: >"$preflight_calls"
change_approval(){
  printf '%s\n' "$1" >>"$preflight_calls"
  printf '{"success":true,"action":"REVOKE","approvalStatus":"REVOKED"}\n'
}
inspect(){ printf '%s\n' "$revoked_inspection"; }
sudo(){ printf '%s\n' "$*" >>"$preflight_calls"; return 0; }
systemctl(){ return 1; }
fail_closed_preflight_state DENIED_ROLE_ACCOUNT_COUNT_INVALID
[[ "$preflight_revoke" == true && "$preflight_timer_off" == true \
   && "$(jq -r .gateStatus <<<"$inspection")" == REVOKED \
   && "$(grep -c '^REVOKE$' "$preflight_calls")" == 1 \
   && "$(grep -c 'generate-composite-relay-account-map' "$preflight_calls" || true)" == 0 ]] || {
  echo 'denied0 ACTIVE gate did not fail closed without account generation' >&2; exit 1
}

inspection="{\"gateStatus\":\"PREPARED\",\"gateRevision\":9,\"gatePostdeployCandidateId\":\"$candidate_id\",\"enabled\":false}"
: >"$preflight_calls"
change_approval(){
  printf '%s\n' "$1" >>"$preflight_calls"
  printf '{"success":true,"action":"REVOKE_PREPARED","approvalStatus":"REVOKED","postdeployCandidateId":"%s"}\n' "$candidate_id"
}
fail_closed_preflight_state DENIED_ROLE_ACCOUNT_COUNT_INVALID
[[ "$preflight_revoke" == true \
   && "$(grep -c '^REVOKE_PREPARED$' "$preflight_calls")" == 1 ]] || {
  echo 'denied0 PREPARED gate bypassed exact-candidate revoke' >&2; exit 1
}
unset -f change_approval inspect sudo systemctl best_effort_revoke_preflight_gate \
  fail_closed_preflight_state
# Audit publication happens before ACTIVATE and remains detectably fallible; the
# caller can warn without putting any fallible work after the activation CAS.
eval "$(sed -n '/^write_audit_marker(){/,/^}/p' \
  "$ROOT/ops/scripts/prepare-composite-autocompletion-postdeploy.sh")"
ENABLE_MARKER="$tmp/approval.json";inspection='{}';marker_tmp=''
mktemp(){ printf '%s\n' "$tmp/marker.tmp"; }
jq(){ printf '{}\n'; }
sudo(){ return 1; }
marker_failure_propagated=false
write_audit_marker || marker_failure_propagated=true
[[ "$marker_failure_propagated" == true ]] || {
  echo 'audit marker publication failure was masked inside OR-list' >&2; exit 1
}
unset -f mktemp jq sudo
echo '[test-composite-autocompletion-postdeploy] PASS secrets denied-count H0-H1 PREPARED-ACTIVE claim0 durable-CAS no-rollout fail-closed'

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HELPER="$ROOT/ops/scripts/record-runtime-release-state.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/fixtures"

old_commit='1111111111111111111111111111111111111111'
target_commit='2222222222222222222222222222222222222222'
image_id='docker-pullable://registry/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

write_deployment() {
  local ready="${1:-2}" annotation="${2:-$old_commit}"
  jq -n --arg annotation "$annotation" --argjson ready "$ready" '{
    metadata:{resourceVersion:"rv-7",uid:"deployment-uid-1",generation:7,annotations:{"resonance.ai/target-commit":$annotation}},
    spec:{replicas:2,selector:{matchLabels:{app:"carbonet-runtime"}},template:{spec:{containers:[{name:"carbonet-runtime",image:"registry/carbonet:test"}]}}},
    status:{observedGeneration:7,updatedReplicas:2,readyReplicas:$ready,availableReplicas:$ready,unavailableReplicas:(2-$ready)}
  }' >"$TMP/fixtures/deployment.json"
}

write_old_ledger() {
  jq -cn --arg commit "$old_commit" '{releaseKey:"CARBONET_RUNTIME",sourceCommit:$commit}' >"$TMP/fixtures/ledger.json"
}

write_pods() {
  local second_image_id="${1-$image_id}" terminating="${2:-false}"
  jq -n --arg first "$image_id" --arg second "$second_image_id" --argjson terminating "$terminating" '{items:[
    {metadata:({name:"runtime-0"}+if $terminating then {deletionTimestamp:"2026-08-12T00:00:00Z"} else {} end),spec:{containers:[{name:"carbonet-runtime",image:"registry/carbonet:test"}]},status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$first}]}},
    {metadata:{name:"runtime-1"},spec:{containers:[{name:"carbonet-runtime",image:"registry/carbonet:test"}]},status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$second}]}}
  ]}' >"$TMP/fixtures/pods.json"
}

write_deployment
write_old_ledger
write_pods

cat >"$TMP/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
args=" $* "
if [[ "$args" == *" exec -i $POSTGRES_POD "* ]]; then
  sql="$(cat)"
  printf '%s\n--CALL--\n' "$sql" >>"$FIXTURE_DIR/sql.calls"
  if [[ "$sql" == *"to_regclass('public.framework_runtime_release_state')"* ]]; then
    printf 'framework_runtime_release_state\n'
  elif [[ "$sql" == *"delete from framework_runtime_release_state"* ]]; then
    [[ "${FAIL_DELETE:-false}" != true ]] || exit 51
    : >"$FIXTURE_DIR/ledger.json"
  elif [[ "$sql" == *"insert into framework_runtime_release_state"* ]]; then
    deployment="$(cat "$FIXTURE_DIR/deployment.json")"
    jq -cn \
      --arg commit "$FIXTURE_TARGET" \
      --arg namespace "carbonet-test" \
      --arg deployment "carbonet-runtime" \
      --arg uid "$(jq -r .metadata.uid <<<"$deployment")" \
      --arg image "$(jq -r '.spec.template.spec.containers[0].image' <<<"$deployment")" \
      --arg imageId "$(jq -r '.items[0].status.containerStatuses[0].imageID' "$FIXTURE_DIR/pods.json")" \
      --argjson generation "$(jq -r .metadata.generation <<<"$deployment")" \
      --argjson observed "$(jq -r .status.observedGeneration <<<"$deployment")" \
      --argjson desired "$(jq -r .spec.replicas <<<"$deployment")" \
      '{releaseKey:"CARBONET_RUNTIME",sourceCommit:$commit,deploymentNamespace:$namespace,deploymentName:$deployment,deploymentUid:$uid,deploymentGeneration:$generation,observedGeneration:$observed,desiredReplicas:$desired,imageRef:$image,imageId:$imageId,healthStatus:"UP"}' \
      >"$FIXTURE_DIR/ledger.json"
    [[ "${COMMIT_OUTPUT_ILLUSION:-false}" != true ]] || printf '{"sourceCommit":"forged-pre-commit"}\n'
    [[ "${COMMIT_OUTPUT_ILLUSION:-false}" == true || "$sql" != *"jsonb_build_object"* ]] || cat "$FIXTURE_DIR/ledger.json"
  elif [[ "$sql" == *"jsonb_build_object"* ]]; then
    [[ "${FAIL_POST_COMMIT_READ:-false}" != true ]] || exit 52
    cat "$FIXTURE_DIR/ledger.json"
  elif [[ "$sql" == *"select count(*) from framework_runtime_release_state"* ]]; then
    [[ -s "$FIXTURE_DIR/ledger.json" ]] && printf '1\n' || printf '0\n'
  else
    echo "unexpected SQL: $sql" >&2
    exit 90
  fi
elif [[ "$args" == *" get deployment/carbonet-runtime -o json "* ]]; then
  identity_counter_file="$FIXTURE_DIR/identity-get-count"
  identity_count="$(( $(cat "$identity_counter_file" 2>/dev/null || printf '0') + 1 ))"
  printf '%s\n' "$identity_count" >"$identity_counter_file"
  if [[ -n "${BECOME_READY_AFTER:-}" ]]; then
    counter_file="$FIXTURE_DIR/deployment-get-count"
    count="$(( $(cat "$counter_file" 2>/dev/null || printf '0') + 1 ))"
    printf '%s\n' "$count" >"$counter_file"
    if (( count >= BECOME_READY_AFTER )); then
      jq '.status.readyReplicas=2 | .status.availableReplicas=2 | .status.unavailableReplicas=0' "$FIXTURE_DIR/deployment.json" >"$FIXTURE_DIR/deployment.tmp"
      mv "$FIXTURE_DIR/deployment.tmp" "$FIXTURE_DIR/deployment.json"
    fi
  fi
  if [[ -n "${DRIFT_AFTER_DEPLOYMENT_GET:-}" && "$identity_count" == "$DRIFT_AFTER_DEPLOYMENT_GET" ]]; then
    jq '.metadata.resourceVersion="rv-drift" | .metadata.generation+=1 | .status.observedGeneration+=1' "$FIXTURE_DIR/deployment.json"
  else
    cat "$FIXTURE_DIR/deployment.json"
  fi
elif [[ "$args" == *" annotate deployment/carbonet-runtime "* ]]; then
  printf '%s\n' "$*" >>"$FIXTURE_DIR/annotate.calls"
  [[ "${FAIL_ANNOTATE:-false}" != "true" ]] || exit 41
  commit=""
  for value in "$@"; do
    [[ "$value" == resonance.ai/target-commit=* ]] && commit="${value#*=}"
  done
  [[ -n "$commit" ]] || exit 42
  jq --arg commit "$commit" '.metadata.annotations["resonance.ai/target-commit"]=$commit' \
    "$FIXTURE_DIR/deployment.json" >"$FIXTURE_DIR/deployment.tmp"
  mv "$FIXTURE_DIR/deployment.tmp" "$FIXTURE_DIR/deployment.json"
elif [[ "$args" == *" get pods "* ]]; then
  cat "$FIXTURE_DIR/pods.json"
elif [[ "$args" == *" exec runtime-"* && "$args" == *"/actuator/health "* ]]; then
  if [[ "$args" == *" exec runtime-1 "* && "${UNHEALTHY_RUNTIME_1:-false}" == true ]]; then
    printf '{"status":"DOWN"}\n'
  else
    printf '{"status":"UP"}\n'
  fi
else
  echo "unexpected kubectl invocation: $*" >&2
  exit 90
fi
SH
chmod +x "$TMP/bin/kubectl" "$HELPER"

export FIXTURE_DIR="$TMP/fixtures"
export FIXTURE_TARGET="$target_commit"
export POSTGRES_POD=patroni-0
export CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$TMP/bin/kubectl"
export CARBONET_K8S_NAMESPACE=carbonet-test
export CARBONET_K8S_DEPLOYMENT=carbonet-runtime
export CARBONET_K8S_CONTAINER=carbonet-runtime
export CARBONET_RUNTIME_LEDGER_READY_ATTEMPTS=1
export CARBONET_RUNTIME_LEDGER_READY_DELAY_SECONDS=0

bash "$HELPER" "$target_commit" >/dev/null
[[ "$(jq -r '.metadata.annotations["resonance.ai/target-commit"]' "$TMP/fixtures/deployment.json")" == "$target_commit" ]]
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$target_commit" ]]
[[ "$(jq -r '.desiredReplicas' "$TMP/fixtures/ledger.json")" == "2" ]]
[[ "$(jq -r '.imageId' "$TMP/fixtures/ledger.json")" == "$image_id" ]]


write_deployment 1 "$old_commit"
write_old_ledger
rm -f "$TMP/fixtures/deployment-get-count"
export BECOME_READY_AFTER=2
export CARBONET_RUNTIME_LEDGER_READY_ATTEMPTS=3
bash "$HELPER" "$target_commit" >/dev/null
unset BECOME_READY_AFTER
export CARBONET_RUNTIME_LEDGER_READY_ATTEMPTS=1
[[ "$(cat "$TMP/fixtures/deployment-get-count")" == "5" ]]
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$target_commit" ]]
write_deployment 2 "$old_commit"
write_old_ledger
set +e
FAIL_ANNOTATE=true bash "$HELPER" "$target_commit" >/dev/null 2>&1
annotate_status=$?
set -e
[[ "$annotate_status" -ne 0 ]] || { echo 'annotation failure was accepted' >&2; exit 1; }
[[ ! -s "$TMP/fixtures/ledger.json" ]] || { echo 'annotation failure retained stale ledger state' >&2; exit 1; }

write_deployment 1 "$old_commit"
write_old_ledger
set +e
bash "$HELPER" "$target_commit" >/dev/null 2>&1
readiness_status=$?
set -e
[[ "$readiness_status" -ne 0 ]] || { echo 'unready rollout was accepted' >&2; exit 1; }
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$old_commit" ]] || { echo 'preflight failure mutated the prior ledger' >&2; exit 1; }

write_deployment 2 "$old_commit"
write_old_ledger
write_pods 'docker-pullable://registry/carbonet@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
set +e
bash "$HELPER" "$target_commit" >/dev/null 2>&1
image_id_status=$?
set -e
[[ "$image_id_status" -ne 0 ]] || { echo 'mixed runtime imageID digests were accepted' >&2; exit 1; }
[[ ! -s "$TMP/fixtures/ledger.json" ]] || { echo 'mixed imageID failure retained stale ledger state' >&2; exit 1; }

write_deployment 2 "$old_commit"
write_old_ledger
write_pods "$image_id" true
set +e
bash "$HELPER" "$target_commit" >/dev/null 2>&1
terminating_status=$?
set -e
[[ "$terminating_status" -ne 0 && ! -s "$TMP/fixtures/ledger.json" ]] \
  || { echo 'terminating Ready pod was accepted' >&2; exit 1; }

write_deployment 2 "$old_commit"
write_old_ledger
write_pods ''
set +e
bash "$HELPER" "$target_commit" >/dev/null 2>&1
empty_image_id_status=$?
set -e
[[ "$empty_image_id_status" -ne 0 && ! -s "$TMP/fixtures/ledger.json" ]] \
  || { echo 'empty imageID pod was accepted' >&2; exit 1; }

write_deployment 2 "$old_commit"
write_old_ledger
write_pods
bash "$HELPER" --invalidate >/dev/null
[[ ! -s "$TMP/fixtures/ledger.json" ]] || { echo 'explicit invalidation retained the ledger' >&2; exit 1; }

# Rollback publication observes the already restored annotation and performs
# zero Kubernetes writes. Both Ready pods must independently report UP.
write_deployment 2 "$target_commit"
write_old_ledger
write_pods
rm -f "$TMP/fixtures/annotate.calls"
rm -f "$TMP/fixtures/sql.calls" "$TMP/fixtures/identity-get-count"
COMMIT_OUTPUT_ILLUSION=true CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true \
  bash "$HELPER" "$target_commit" >/dev/null
[[ ! -e "$TMP/fixtures/annotate.calls" ]]
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$target_commit" ]]
grep -Fqi 'begin;' "$TMP/fixtures/sql.calls"
grep -Fqi 'commit;' "$TMP/fixtures/sql.calls"
! grep -Fqi 'delete from framework_runtime_release_state' "$TMP/fixtures/sql.calls"
python3 - "$TMP/fixtures/sql.calls" <<'PY'
from pathlib import Path
import sys
calls=Path(sys.argv[1]).read_text().lower().split("--call--")
insert=next(i for i,v in enumerate(calls) if "insert into framework_runtime_release_state" in v)
reread=next(i for i,v in enumerate(calls) if "jsonb_build_object" in v and "insert into" not in v)
assert insert < reread
PY

# A post-COMMIT read failure must either clear and prove count=0 or emit the
# quarantine exit. A failed DELETE can never be treated as successful cleanup.
write_deployment 2 "$target_commit"
write_old_ledger
write_pods
rm -f "$TMP/fixtures/sql.calls" "$TMP/fixtures/identity-get-count"
set +e
FAIL_POST_COMMIT_READ=true FAIL_DELETE=true CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true \
  bash "$HELPER" "$target_commit" >"$TMP/fixtures/delete-failure.log" 2>&1
delete_failure_status=$?
set -e
[[ "$delete_failure_status" == 79 && -s "$TMP/fixtures/ledger.json" ]]
grep -Fq 'QUARANTINE' "$TMP/fixtures/delete-failure.log"

# A deployment identity change after the committed UPSERT invalidates the new
# row instead of publishing stale generation/replica evidence.
write_deployment 2 "$target_commit"
write_old_ledger
write_pods
rm -f "$TMP/fixtures/sql.calls" "$TMP/fixtures/identity-get-count"
set +e
DRIFT_AFTER_DEPLOYMENT_GET=3 CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true \
  bash "$HELPER" "$target_commit" >/dev/null 2>&1
drift_status=$?
set -e
[[ "$drift_status" -ne 0 && ! -s "$TMP/fixtures/ledger.json" ]]
python3 - "$TMP/fixtures/sql.calls" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text().lower()
assert text.index("insert into framework_runtime_release_state") < text.index("delete from framework_runtime_release_state")
PY

write_deployment 2 "$target_commit"
write_old_ledger
rm -f "$TMP/fixtures/annotate.calls"
set +e
CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true UNHEALTHY_RUNTIME_1=true \
  bash "$HELPER" "$target_commit" >/dev/null 2>&1
unhealthy_status=$?
set -e
[[ "$unhealthy_status" -ne 0 && ! -e "$TMP/fixtures/annotate.calls" ]]
[[ ! -s "$TMP/fixtures/ledger.json" ]] || { echo 'unhealthy second pod retained stale ledger' >&2; exit 1; }

write_deployment 2 "$old_commit"
write_old_ledger
set +e
CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true bash "$HELPER" "$target_commit" >/dev/null 2>&1
observe_annotation_status=$?
set -e
[[ "$observe_annotation_status" -ne 0 ]]
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$old_commit" ]] \
  || { echo 'observe-only annotation mismatch mutated the prior ledger' >&2; exit 1; }

echo '[runtime-release-state-test] PASS ready=recorded transient-unready=retried replicas=exact imageID=all-nonempty-single-digest terminatingPod=rejected allPodHealth=required observeOnly=annotate0 transaction=commit-then-independent-reread postTransactionDrift=invalidated cleanupDeleteFailure=quarantined annotation-failure=invalidated unready=preserved explicit-invalidate=cleared'

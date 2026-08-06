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
    metadata:{uid:"deployment-uid-1",generation:7,annotations:{"resonance.ai/target-commit":$annotation}},
    spec:{replicas:2,selector:{matchLabels:{app:"carbonet-runtime"}},template:{spec:{containers:[{name:"carbonet-runtime",image:"registry/carbonet:test"}]}}},
    status:{observedGeneration:7,updatedReplicas:2,readyReplicas:$ready,availableReplicas:$ready,unavailableReplicas:(2-$ready)}
  }' >"$TMP/fixtures/deployment.json"
}

write_old_ledger() {
  jq -cn --arg commit "$old_commit" '{releaseKey:"CARBONET_RUNTIME",sourceCommit:$commit}' >"$TMP/fixtures/ledger.json"
}

write_pods() {
  local second_image_id="${1:-$image_id}"
  jq -n --arg first "$image_id" --arg second "$second_image_id" '{items:[
    {metadata:{name:"runtime-0"},spec:{containers:[{name:"carbonet-runtime",image:"registry/carbonet:test"}]},status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$first}]}},
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
  if [[ "$sql" == *"to_regclass('public.framework_runtime_release_state')"* ]]; then
    printf 'framework_runtime_release_state\n'
  elif [[ "$sql" == *"delete from framework_runtime_release_state"* ]]; then
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
  elif [[ "$sql" == *"jsonb_build_object"* ]]; then
    cat "$FIXTURE_DIR/ledger.json"
  else
    echo "unexpected SQL: $sql" >&2
    exit 90
  fi
elif [[ "$args" == *" get deployment/carbonet-runtime -o json "* ]]; then
  cat "$FIXTURE_DIR/deployment.json"
elif [[ "$args" == *" annotate deployment/carbonet-runtime "* ]]; then
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
elif [[ "$args" == *" exec runtime-0 "* && "$args" == *"/actuator/health "* ]]; then
  printf '{"status":"UP"}\n'
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

bash "$HELPER" "$target_commit" >/dev/null
[[ "$(jq -r '.metadata.annotations["resonance.ai/target-commit"]' "$TMP/fixtures/deployment.json")" == "$target_commit" ]]
[[ "$(jq -r '.sourceCommit' "$TMP/fixtures/ledger.json")" == "$target_commit" ]]
[[ "$(jq -r '.desiredReplicas' "$TMP/fixtures/ledger.json")" == "2" ]]
[[ "$(jq -r '.imageId' "$TMP/fixtures/ledger.json")" == "$image_id" ]]

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
write_pods
bash "$HELPER" --invalidate >/dev/null
[[ ! -s "$TMP/fixtures/ledger.json" ]] || { echo 'explicit invalidation retained the ledger' >&2; exit 1; }

echo '[runtime-release-state-test] PASS ready=recorded replicas=exact imageID=single-digest annotation-failure=invalidated unready=preserved explicit-invalidate=cleared'

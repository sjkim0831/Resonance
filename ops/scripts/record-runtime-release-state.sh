#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
DATABASE="${POSTGRES_DB:-carbonet}"
DB_USER="${POSTGRES_ADMIN_USER:-postgres}"
DB_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
KUBECTL_BIN="${CARBONET_RUNTIME_LEDGER_KUBECTL_BIN:-kubectl}"
RECORDED_BY="${CARBONET_RUNTIME_LEDGER_RECORDED_BY:-auto-deploy-main}"
ACTION="${1:-}"
ROLLOUT_READY_ATTEMPTS="${CARBONET_RUNTIME_LEDGER_READY_ATTEMPTS:-11}"
ROLLOUT_READY_DELAY_SECONDS="${CARBONET_RUNTIME_LEDGER_READY_DELAY_SECONDS:-2}"
OBSERVE_ONLY="${CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY:-false}"
LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT/ops/scripts/resolve-patroni-primary-pod.sh}"

log() { printf '[runtime-release-state] %s\n' "$*"; }
fail() { log "FAIL $*" >&2; exit 1; }
[[ "$ROLLOUT_READY_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] ||
  fail "ready attempts must be a positive integer"
[[ "$ROLLOUT_READY_DELAY_SECONDS" =~ ^[0-9]+$ ]] ||
  fail "ready delay seconds must be a non-negative integer"
[[ "$OBSERVE_ONLY" == true || "$OBSERVE_ONLY" == false ]] ||
  fail "observe-only must be true or false"


if [[ -z "${POSTGRES_POD:-}" ]]; then
  POSTGRES_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$LEADER_RESOLVER")"
fi
[[ -n "$POSTGRES_POD" ]] || fail "Patroni primary pod is unavailable"

db_psql() {
  "$KUBECTL_BIN" -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$DB_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -X -q -At -v ON_ERROR_STOP=1 "$@"
}

table_name="$(printf '%s\n' "select to_regclass('public.framework_runtime_release_state')::text;" | db_psql)"
[[ "$table_name" == "framework_runtime_release_state" ]] || fail "runtime release ledger migration is unavailable"

invalidate_ledger() {
  printf '%s\n' "delete from framework_runtime_release_state where release_key='CARBONET_RUNTIME';" | db_psql >/dev/null
}

if [[ "$ACTION" == "--invalidate" ]]; then
  invalidate_ledger
  log "PASS state=RUNTIME_COMMIT_UNAVAILABLE"
  exit 0
fi

TARGET_COMMIT="$ACTION"
[[ "$TARGET_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "target commit must be exactly 40 lowercase hexadecimal characters"


rollout_ready() {
  local value="$1"
  jq -e --arg container "$CONTAINER" '
    (.metadata.uid | type=="string" and length>0) and
    ((.spec.replicas // 0) > 0) and
    ((.status.observedGeneration // -1) >= (.metadata.generation // 0)) and
    ((.status.updatedReplicas // 0) == (.spec.replicas // 0)) and
    ((.status.readyReplicas // 0) == (.spec.replicas // 0)) and
    ((.status.availableReplicas // 0) == (.spec.replicas // 0)) and
    ((.status.unavailableReplicas // 0) == 0) and
    (any(.spec.template.spec.containers[]?; .name==$container and (.image | type=="string" and length>0)))
  ' <<<"$value" >/dev/null
}

validate_rollout() {
  rollout_ready "$1" || fail "deployment rollout is not fully observed and ready"
}

deployment_json=""
for ((rollout_attempt=1; rollout_attempt<=ROLLOUT_READY_ATTEMPTS; rollout_attempt++)); do
  if deployment_json="$($KUBECTL_BIN -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" &&
     rollout_ready "$deployment_json"; then
    break
  fi
  if (( rollout_attempt == ROLLOUT_READY_ATTEMPTS )); then
    fail "deployment rollout is not fully observed and ready after ${ROLLOUT_READY_ATTEMPTS} attempts"
  fi
  log "WAIT rollout not ready attempt=${rollout_attempt}/${ROLLOUT_READY_ATTEMPTS} retry_in=${ROLLOUT_READY_DELAY_SECONDS}s"
  sleep "$ROLLOUT_READY_DELAY_SECONDS"
done

annotated_commit="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$deployment_json")"
if [[ "$OBSERVE_ONLY" == true ]]; then
  [[ "$annotated_commit" == "$TARGET_COMMIT" ]] \
    || fail "observe-only deployment annotation does not exactly match target commit"
  # The reconciler has already restored and verified the exact owned
  # annotations.  Re-annotating here would be a second Kubernetes writer and
  # could invalidate the captured deployment identity.
  invalidate_ledger
else
  # Clear the prior identity before touching Kubernetes. Every later failure
  # is visible as RUNTIME_COMMIT_UNAVAILABLE.
  invalidate_ledger
  if ! "$KUBECTL_BIN" -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
    "resonance.ai/target-commit=$TARGET_COMMIT" --overwrite >/dev/null; then
    fail "deployment target-commit annotation could not be updated; ledger remains invalidated"
  fi
  deployment_json="$($KUBECTL_BIN -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json)" ||
    fail "annotated deployment cannot be reread; ledger remains invalidated"
  validate_rollout "$deployment_json"
  annotated_commit="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' <<<"$deployment_json")"
  [[ "$annotated_commit" == "$TARGET_COMMIT" ]] \
    || fail "deployment annotation does not exactly match target commit; ledger remains invalidated"
fi

selector="$(jq -r '.spec.selector.matchLabels // {} | to_entries | map("\(.key)=\(.value)") | join(",")' <<<"$deployment_json")"
[[ -n "$selector" ]] || fail "deployment pod selector is unavailable; ledger remains invalidated"
pods_json="$($KUBECTL_BIN -n "$NAMESPACE" get pods -l "$selector" -o json)" ||
  fail "runtime pods cannot be read; ledger remains invalidated"
image_ref="$(jq -r --arg container "$CONTAINER" '.spec.template.spec.containers[] | select(.name==$container) | .image' <<<"$deployment_json")"
desired_replicas="$(jq -r '.spec.replicas // 0' <<<"$deployment_json")"
ready_runtime_pods="$(jq -c --arg container "$CONTAINER" --arg image "$image_ref" '
  [.items[]
   | select(.status.phase=="Running")
   | select(any(.spec.containers[]?; .name==$container and .image==$image))
   | select(any(.status.conditions[]?; .type=="Ready" and .status=="True"))
   | select(any(.status.containerStatuses[]?; .name==$container and .ready==true))
   | {name:.metadata.name,imageId:([.status.containerStatuses[] | select(.name==$container) | .imageID][0] // "") }]
' <<<"$pods_json")"
ready_runtime_count="$(jq -r 'length' <<<"$ready_runtime_pods")"
[[ "$ready_runtime_count" == "$desired_replicas" ]] ||
  fail "Ready pods for the exact deployment image do not match desired replicas; ledger remains invalidated"
runtime_image_id_count="$(jq -r '[.[].imageId | select(length>0)] | unique | length' <<<"$ready_runtime_pods")"
runtime_image_id="$(jq -r '.[0].imageId // empty' <<<"$ready_runtime_pods")"
[[ "$runtime_image_id_count" == "1" && "$runtime_image_id" =~ sha256:[0-9a-f]{64}$ ]] ||
  fail "Ready pods do not share one immutable imageID digest; ledger remains invalidated"
mapfile -t runtime_pods < <(jq -r '.[].name' <<<"$ready_runtime_pods")
[[ "${#runtime_pods[@]}" == "$desired_replicas" ]] \
  || fail "Ready runtime pod list does not equal desired replicas; ledger remains invalidated"
for runtime_pod in "${runtime_pods[@]}"; do
  health_json="$($KUBECTL_BIN -n "$NAMESPACE" exec "$runtime_pod" -c "$CONTAINER" -- \
    curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health)" ||
    fail "runtime health request failed for $runtime_pod; ledger remains invalidated"
  jq -e '.status=="UP"' <<<"$health_json" >/dev/null ||
    fail "runtime health is not UP for $runtime_pod; ledger remains invalidated"
done

deployment_uid="$(jq -r '.metadata.uid' <<<"$deployment_json")"
deployment_generation="$(jq -r '.metadata.generation // 0' <<<"$deployment_json")"
observed_generation="$(jq -r '.status.observedGeneration // 0' <<<"$deployment_json")"

cat <<'SQL' | db_psql \
  -v source_commit="$TARGET_COMMIT" \
  -v deployment_namespace="$NAMESPACE" \
  -v deployment_name="$DEPLOYMENT" \
  -v deployment_uid="$deployment_uid" \
  -v deployment_generation="$deployment_generation" \
  -v observed_generation="$observed_generation" \
  -v desired_replicas="$desired_replicas" \
  -v image_ref="$image_ref" \
  -v image_id="$runtime_image_id" \
  -v recorded_by="$RECORDED_BY" >/dev/null
insert into framework_runtime_release_state(
  release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,image_ref,image_id,health_status,recorded_by,recorded_at
) values (
  'CARBONET_RUNTIME',:'source_commit',:'deployment_namespace',:'deployment_name',:'deployment_uid',
  :'deployment_generation'::bigint,:'observed_generation'::bigint,:'desired_replicas'::integer,:'image_ref',:'image_id','UP',:'recorded_by',current_timestamp
)
on conflict (release_key) do update set
  source_commit=excluded.source_commit,
  deployment_namespace=excluded.deployment_namespace,
  deployment_name=excluded.deployment_name,
  deployment_uid=excluded.deployment_uid,
  deployment_generation=excluded.deployment_generation,
  observed_generation=excluded.observed_generation,
  desired_replicas=excluded.desired_replicas,
  image_ref=excluded.image_ref,
  image_id=excluded.image_id,
  health_status=excluded.health_status,
  recorded_by=excluded.recorded_by,
  recorded_at=excluded.recorded_at;
SQL

recorded_json="$(cat <<'SQL' | db_psql
select jsonb_build_object(
  'releaseKey',release_key,
  'sourceCommit',source_commit,
  'deploymentNamespace',deployment_namespace,
  'deploymentName',deployment_name,
  'deploymentUid',deployment_uid,
  'deploymentGeneration',deployment_generation,
  'observedGeneration',observed_generation,
  'desiredReplicas',desired_replicas,
  'imageRef',image_ref,
  'imageId',image_id,
  'healthStatus',health_status
)::text
from framework_runtime_release_state
where release_key='CARBONET_RUNTIME';
SQL
)"

jq -e \
  --arg commit "$TARGET_COMMIT" \
  --arg namespace "$NAMESPACE" \
  --arg deployment "$DEPLOYMENT" \
  --arg uid "$deployment_uid" \
  --arg image "$image_ref" \
  --arg imageId "$runtime_image_id" \
  --argjson generation "$deployment_generation" \
  --argjson observed "$observed_generation" \
  --argjson desired "$desired_replicas" '
    .releaseKey=="CARBONET_RUNTIME" and
    .sourceCommit==$commit and
    .deploymentNamespace==$namespace and
    .deploymentName==$deployment and
    .deploymentUid==$uid and
    .deploymentGeneration==$generation and
    .observedGeneration==$observed and
    .desiredReplicas==$desired and
    .imageRef==$image and
    .imageId==$imageId and
    .healthStatus=="UP"
  ' <<<"$recorded_json" >/dev/null || {
    invalidate_ledger || true
    fail "runtime release ledger reread did not match the healthy deployment"
  }

log "PASS commit=$TARGET_COMMIT deployment=$NAMESPACE/$DEPLOYMENT generation=$deployment_generation replicas=$desired_replicas imageID=$runtime_image_id pods=${#runtime_pods[@]} observeOnly=$OBSERVE_ONLY"

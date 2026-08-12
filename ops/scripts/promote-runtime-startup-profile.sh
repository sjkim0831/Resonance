#!/usr/bin/env bash
set -Eeuo pipefail

root="${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
deployment="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
profile_file="${CARBONET_RUNTIME_JVM_PROFILE:-$root/ops/config/runtime-jvm-profile.env}"
validation_env="${CARBONET_RUNTIME_VALIDATION_ENV:-/opt/carbonet-data/config/actor-test.env}"

[[ -s "$profile_file" ]] || {
  echo "[startup-profile] missing profile: $profile_file" >&2
  exit 2
}
# shellcheck source=ops/config/runtime-jvm-profile.env
source "$profile_file"
: "${CARBONET_RUNTIME_JAVA_OPTS:?runtime JAVA_OPTS profile is required}"

old_java_opts="$(
  kubectl -n "$namespace" get deployment "$deployment" -o json |
    jq -r '
      .spec.template.spec.containers[0].env
      | map(select(.name == "JAVA_OPTS"))[0].value // ""
    '
)"
changed=false

rollback() {
  local exit_code=$?
  if [[ "$changed" == "true" && "$exit_code" -ne 0 \
     && "${DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER:-false}" != true ]]; then
    echo "[startup-profile] validation failed; restoring previous JVM profile" >&2
    kubectl -n "$namespace" set env "deployment/$deployment" \
      "JAVA_OPTS=$old_java_opts" >/dev/null
    kubectl -n "$namespace" rollout status "deployment/$deployment" \
      --timeout=180s >/dev/null || true
  elif [[ "$changed" == "true" && "$exit_code" -ne 0 ]]; then
    echo "[startup-profile] validation failed; durable attempt reconciler owns rollback" >&2
  fi
  exit "$exit_code"
}
trap rollback EXIT

if [[ "$old_java_opts" != "$CARBONET_RUNTIME_JAVA_OPTS" ]]; then
  kubectl -n "$namespace" set env "deployment/$deployment" \
    "JAVA_OPTS=$CARBONET_RUNTIME_JAVA_OPTS" >/dev/null
  changed=true
fi
kubectl -n "$namespace" rollout status "deployment/$deployment" --timeout=180s

health="$(
  kubectl -n "$namespace" exec "deployment/$deployment" -- \
    wget -qO- http://127.0.0.1:8080/actuator/health
)"
grep -q '"status":"UP"' <<<"$health"

if [[ -r "$validation_env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$validation_env"
  set +a
fi
CARBONET_DEPLOY_ROOT="$root" \
  bash "$root/ops/scripts/run-post-deploy-validation-groups.sh"

changed=false
trap - EXIT
echo "[startup-profile] PASS deployment=$deployment health=UP rollback=armed validation=complete"

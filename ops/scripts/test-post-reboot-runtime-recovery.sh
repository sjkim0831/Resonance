#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
recovery="$root/ops/scripts/reconcile-post-reboot-runtime.sh"
self_heal="$root/ops/scripts/resonance-k8s-self-heal.sh"
hermes="$root/ops/scripts/hermes-builder-monitoring-automation.sh"

bash -n "$recovery" "$self_heal" "$hermes"
grep -q 'init-addr last,libc,none' \
  "$root/ops/kubernetes/postgres-haproxy-config.yaml"
grep -q 'nameserver kube-dns 10.96.0.10:53' \
  "$root/ops/kubernetes/postgres-haproxy-config.yaml"
grep -q 'POST_REBOOT_RUNTIME_RECOVERY_PASS' "$recovery"
grep -q 'Kubernetes mutation not ready; retry=' "$recovery"
grep -q 'WantedBy=multi-user.target' \
  "$root/ops/systemd/carbonet-post-reboot-recovery.service"
grep -q 'post-reboot runtime recovery synchronized' \
  "$root/ops/scripts/auto-deploy-main.sh"

python3 - "$recovery" "$self_heal" "$hermes" <<'PY'
import pathlib
import sys

recovery, self_heal, hermes = [pathlib.Path(path).read_text(encoding="utf-8") for path in sys.argv[1:]]
for source, name in ((recovery, "post-reboot"), (self_heal, "self-heal")):
    if "rollout restart deployment/carbonet-runtime" in source:
        raise SystemExit(f"{name} mutates the runtime PodTemplate during same-template recovery")
for token in (
    "recycle_deployment_pods_preserving_template",
    ".metadata.ownerReferences",
    "deployment_replicaset_uids",
    "replicaset_uids",
    "expected_token",
    "@sha256:",
    'delete pod "$pod_name"',
):
    if token not in recovery:
        raise SystemExit(f"post-reboot exact pod recovery contract missing: {token}")
if 'source "$POD_RECOVERY_HELPER"' not in self_heal:
    raise SystemExit("self-heal does not load the reviewed same-template recovery helper")
if self_heal.count("recycle_deployment_pods_preserving_template") < 4:
    raise SystemExit("self-heal recovery sites are not all routed through the same-template helper")

if "resonance-k8s-build-deploy-80.sh" in self_heal:
    raise SystemExit("self-heal may not invoke a legacy image/template mutation path")
for forbidden in ('patch deployment "$name"', "patch hpa carbonet-runtime-hpa"):
    if forbidden in self_heal:
        raise SystemExit(f"self-heal may not synthesize runtime Pods outside durable promotion: {forbidden}")
if "runtime remains unhealthy; run the durable auto-deploy recovery path (mutation=0)" not in self_heal:
    raise SystemExit("self-heal does not fail closed to the durable candidate path")
if "--dry-run 2>/dev/null || true" in hermes or "REBUILD_ON_FAILURE=false" not in hermes:
    raise SystemExit("Hermes must not hide a dry-run identity failure or enable legacy rebuild")
PY

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/state"
calls="$tmp/calls.log"
: >"$calls"

cat >"$tmp/state/carbonet-runtime.json" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"carbonet-prod","name":"carbonet-runtime","uid":"11111111-1111-4111-8111-111111111111"},"spec":{"replicas":2,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"metadata":{"labels":{"app":"carbonet-runtime","release":"stable"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}},"status":{"availableReplicas":2}}
JSON
cat >"$tmp/state/carbonet-runtime-drift.json" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"carbonet-prod","name":"carbonet-runtime","uid":"11111111-1111-4111-8111-111111111111"},"spec":{"replicas":2,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"metadata":{"labels":{"app":"carbonet-runtime","release":"stable"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","env":[{"name":"DRIFT","value":"true"}]}]}}},"status":{"availableReplicas":2}}
JSON
cat >"$tmp/state/carbonet-runtime-rs.json" <<'JSON'
{"items":[{"metadata":{"uid":"22222222-2222-4222-8222-222222222222","ownerReferences":[{"controller":true,"kind":"Deployment","uid":"11111111-1111-4111-8111-111111111111"}]},"spec":{"template":{"metadata":{"labels":{"app":"carbonet-runtime","release":"stable","pod-template-hash":"current"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}}}]}
JSON
cat >"$tmp/state/carbonet-runtime-pods.json" <<'JSON'
{"items":[{"metadata":{"name":"carbonet-runtime-a","uid":"33333333-3333-4333-8333-333333333333","deletionTimestamp":null,"ownerReferences":[{"controller":true,"kind":"ReplicaSet","uid":"22222222-2222-4222-8222-222222222222"}]},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]},"status":{"conditions":[{"type":"Ready","status":"True"}]}},{"metadata":{"name":"carbonet-runtime-b","uid":"44444444-4444-4444-8444-444444444444","deletionTimestamp":null,"ownerReferences":[{"controller":true,"kind":"ReplicaSet","uid":"22222222-2222-4222-8222-222222222222"}]},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]},"status":{"conditions":[{"type":"Ready","status":"True"}]}}]}
JSON
cp "$tmp/state/carbonet-runtime-pods.json" "$tmp/state/carbonet-runtime-pods-original.json"
cat >"$tmp/state/carbonet-web.json" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"carbonet-prod","name":"carbonet-web","uid":"55555555-5555-4555-8555-555555555555"},"spec":{"replicas":1,"selector":{"matchLabels":{"app":"carbonet-web"}},"template":{"metadata":{"labels":{"app":"carbonet-web"}},"spec":{"containers":[{"name":"carbonet-web","image":"registry.local/carbonet-web@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]}}},"status":{"availableReplicas":0}}
JSON
cp "$tmp/state/carbonet-web.json" "$tmp/state/carbonet-web-drift.json"
cat >"$tmp/state/carbonet-web-rs.json" <<'JSON'
{"items":[{"metadata":{"uid":"66666666-6666-4666-8666-666666666666","ownerReferences":[{"controller":true,"kind":"Deployment","uid":"55555555-5555-4555-8555-555555555555"}]},"spec":{"template":{"metadata":{"labels":{"app":"carbonet-web","pod-template-hash":"current"}},"spec":{"containers":[{"name":"carbonet-web","image":"registry.local/carbonet-web@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]}}}}]}
JSON
cat >"$tmp/state/carbonet-web-pods.json" <<'JSON'
{"items":[{"metadata":{"name":"carbonet-web-a","uid":"77777777-7777-4777-8777-777777777777","deletionTimestamp":null,"ownerReferences":[{"controller":true,"kind":"ReplicaSet","uid":"66666666-6666-4666-8666-666666666666"}]},"spec":{"containers":[{"name":"carbonet-web","image":"registry.local/carbonet-web@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]},"status":{"conditions":[{"type":"Ready","status":"False"}]}}]}
JSON

cat >"$tmp/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_KUBECTL_CALLS"
state="$FAKE_KUBECTL_STATE"

serve_deployment() {
  local deployment="$1" count_file deployment_file count=0
  count_file="$state/$deployment.count"
  deployment_file="$state/$deployment.json"
  if [[ "$deployment" == carbonet-runtime && -n "${FAKE_RUNTIME_DEPLOYMENT_FILE:-}" ]]; then
    deployment_file="$FAKE_RUNTIME_DEPLOYMENT_FILE"
  fi
  [[ ! -f "$count_file" ]] || read -r count <"$count_file"
  count=$((count + 1)); printf '%s\n' "$count" >"$count_file"
  if [[ "${FAKE_DRIFT_DEPLOYMENT:-}" == "$deployment" && "$count" -ge 2 ]]; then
    cat "$state/$deployment-drift.json"
  else
    cat "$deployment_file"
  fi
}

case "$*" in
  "get node ccus") exit 0 ;;
  "apply -f "*) exit 0 ;;
  "-n carbonet-prod get deployment postgres-haproxy -o jsonpath={.spec.replicas}"|"-n carbonet-prod get deployment postgres-haproxy -o jsonpath={.status.availableReplicas}")
    printf '1'; exit 0 ;;
  "-n carbonet-prod get deployment carbonet-runtime -o json")
    serve_deployment carbonet-runtime; exit 0 ;;
  "-n carbonet-prod get deployment carbonet-web -o json")
    serve_deployment carbonet-web; exit 0 ;;
  "-n carbonet-prod get replicasets -l app=carbonet-runtime -o json")
    cat "${FAKE_RUNTIME_RS_FILE:-$state/carbonet-runtime-rs.json}"; exit 0 ;;
  "-n carbonet-prod get replicasets -l app=carbonet-web -o json")
    cat "$state/carbonet-web-rs.json"; exit 0 ;;
  "-n carbonet-prod get pods -l app=carbonet-runtime -o json")
    cat "${FAKE_RUNTIME_PODS_FILE:-$state/carbonet-runtime-pods.json}"; exit 0 ;;
  "-n carbonet-prod get pods -l app=carbonet-web -o json")
    cat "$state/carbonet-web-pods.json"; exit 0 ;;
  "-n carbonet-prod get pod carbonet-runtime-a -o json")
    jq -c '.items[0]' "${FAKE_RUNTIME_PODS_FILE:-$state/carbonet-runtime-pods.json}"; exit 0 ;;
  "-n carbonet-prod get pod carbonet-runtime-b -o json")
    jq -c '.items[1]' "${FAKE_RUNTIME_PODS_FILE:-$state/carbonet-runtime-pods.json}"; exit 0 ;;
  "-n carbonet-prod get pod carbonet-web-a -o json")
    jq -c '.items[0]' "$state/carbonet-web-pods.json"; exit 0 ;;
  "-n carbonet-prod delete pod "*|"-n carbonet-prod rollout status deployment/"*) exit 0 ;;
esac
printf 'unexpected fake kubectl call: %s\n' "$*" >&2
exit 9
SH
chmod +x "$tmp/bin/kubectl"

cat >"$tmp/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
count=0
[[ ! -f "$FAKE_HEALTH_COUNT" ]] || read -r count <"$FAKE_HEALTH_COUNT"
count=$((count + 1)); printf '%s\n' "$count" >"$FAKE_HEALTH_COUNT"
if (( count == 1 )); then printf '{"status":"DOWN"}\n'; else printf '{"status":"UP"}\n'; fi
SH
chmod +x "$tmp/bin/curl"

export FAKE_KUBECTL_CALLS="$calls" FAKE_KUBECTL_STATE="$tmp/state"
PATH="$tmp/bin:$PATH" FAKE_HEALTH_COUNT="$tmp/health.count" \
  CARBONET_NAMESPACE=carbonet-prod \
  CARBONET_HAPROXY_CONFIG_MANIFEST="$tmp/haproxy.yaml" \
  bash "$recovery" >"$tmp/recovery.out"
grep -q 'POST_REBOOT_RUNTIME_RECOVERY_PASS' "$tmp/recovery.out"
[[ "$(grep -c -- '-n carbonet-prod delete pod carbonet-runtime-' "$calls")" == 2 ]]
[[ "$(grep -c -- '-n carbonet-prod delete pod carbonet-web-' "$calls")" == 1 ]]
! grep -q 'rollout restart deployment/carbonet-runtime' "$calls"
! grep -q 'rollout restart deployment/carbonet-web' "$calls"

# A template race must fail before the first Pod deletion.
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
if PATH="$tmp/bin:$PATH" FAKE_DRIFT_DEPLOYMENT=carbonet-runtime bash -c '
  source "$1"
  recycle_deployment_pods_preserving_template carbonet-prod carbonet-runtime carbonet-runtime 30
' _ "$recovery" >"$tmp/drift.out" 2>&1; then
  echo 'template-race recovery unexpectedly succeeded' >&2
  exit 1
fi
! grep -q ' delete pod ' "$calls"

# An owned Pod with a non-template image must also fail with mutation=0.
sed 's/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc/g' \
  "$tmp/state/carbonet-runtime-pods.json" >"$tmp/state/carbonet-runtime-pods-bad.json"
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
if PATH="$tmp/bin:$PATH" \
    FAKE_RUNTIME_PODS_FILE="$tmp/state/carbonet-runtime-pods-bad.json" bash -c '
  source "$1"
  recycle_deployment_pods_preserving_template carbonet-prod carbonet-runtime carbonet-runtime 30
' _ "$recovery" >"$tmp/image.out" 2>&1; then
  echo 'wrong-image recovery unexpectedly succeeded' >&2
  exit 1
fi
! grep -q ' delete pod ' "$calls"

# A still-live Pod from an older ReplicaSet is not a same-PodTemplate target,
# even when it uses the same image reference.
jq -c '.items += [{"metadata":{"uid":"88888888-8888-4888-8888-888888888888","ownerReferences":[{"controller":true,"kind":"Deployment","uid":"11111111-1111-4111-8111-111111111111"}]},"spec":{"template":{"metadata":{"labels":{"app":"carbonet-runtime","release":"stable","pod-template-hash":"old"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","env":[{"name":"OLD_TEMPLATE","value":"true"}]}]}}}}]' \
  "$tmp/state/carbonet-runtime-rs.json" >"$tmp/state/carbonet-runtime-rs-mixed.json"
jq -c '.items += [{"metadata":{"name":"carbonet-runtime-old","uid":"99999999-9999-4999-8999-999999999999","deletionTimestamp":null,"ownerReferences":[{"controller":true,"kind":"ReplicaSet","uid":"88888888-8888-4888-8888-888888888888"}]},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]},"status":{"conditions":[{"type":"Ready","status":"True"}]}}]' \
  "$tmp/state/carbonet-runtime-pods-original.json" >"$tmp/state/carbonet-runtime-pods-mixed.json"
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
if PATH="$tmp/bin:$PATH" \
    FAKE_RUNTIME_RS_FILE="$tmp/state/carbonet-runtime-rs-mixed.json" \
    FAKE_RUNTIME_PODS_FILE="$tmp/state/carbonet-runtime-pods-mixed.json" bash -c '
  source "$1"
  recycle_deployment_pods_preserving_template carbonet-prod carbonet-runtime carbonet-runtime 30
' _ "$recovery" >"$tmp/old-template.out" 2>&1; then
  echo 'old-ReplicaSet recovery unexpectedly succeeded' >&2
  exit 1
fi
! grep -q ' delete pod ' "$calls"

# A mutable image tag cannot prove that replacement Pods preserve image ID.
sed 's#registry.local/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#registry.local/carbonet-runtime:mutable#' \
  "$tmp/state/carbonet-runtime.json" >"$tmp/state/carbonet-runtime-tag.json"
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
if PATH="$tmp/bin:$PATH" \
    FAKE_RUNTIME_DEPLOYMENT_FILE="$tmp/state/carbonet-runtime-tag.json" bash -c '
  source "$1"
  recycle_deployment_pods_preserving_template carbonet-prod carbonet-runtime carbonet-runtime 30
' _ "$recovery" >"$tmp/tag.out" 2>&1; then
  echo 'mutable-image recovery unexpectedly succeeded' >&2
  exit 1
fi
grep -q 'image is not digest-pinned; durable auto-deploy must publish an immutable PodTemplate (mutation=0)' \
  "$tmp/tag.out"
! grep -q ' delete pod ' "$calls"

# Deleting the only Ready Pod would create downtime and must fail before mutation.
jq -c '.items=[.items[0]]' "$tmp/state/carbonet-runtime-pods-original.json" \
  >"$tmp/state/carbonet-runtime-sole-ready.json"
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
if PATH="$tmp/bin:$PATH" \
    FAKE_RUNTIME_PODS_FILE="$tmp/state/carbonet-runtime-sole-ready.json" bash -c '
  source "$1"
  recycle_deployment_pods_preserving_template carbonet-prod carbonet-runtime carbonet-runtime 30
' _ "$recovery" >"$tmp/availability.out" 2>&1; then
  echo 'sole-ready-pod recovery unexpectedly succeeded' >&2
  exit 1
fi
! grep -q ' delete pod ' "$calls"

# Hermes' default probe now reaches a real, read-only self-heal dry run.
: >"$calls"; rm -f "$tmp/state/carbonet-runtime.count"
PATH="$tmp/bin:$PATH" ROOT_DIR="$root" LOG_FILE="$tmp/self-heal.log" \
  LOCK_FILE="$tmp/self-heal.lock" LATENCY_FAILURE_FILE="$tmp/latency.failures" \
  RUNTIME_RESTART_STAMP="$tmp/restart.stamp" \
  bash "$self_heal" --dry-run
grep -q 'dry-run complete: exact target verified, mutation=0' "$tmp/self-heal.log"
! grep -q ' delete pod ' "$calls"
! grep -q 'rollout restart deployment/carbonet-runtime' "$calls"

echo "POST_REBOOT_RUNTIME_RECOVERY_CONTRACT_PASS"

#!/usr/bin/env bash
set -euo pipefail
trap 'status=$?; if [[ $- == *e* ]]; then echo "[backstage-rollback-test] FAIL line=$LINENO status=$status" >&2; exit "$status"; fi' ERR

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"

bash -n "$DEPLOY"
python3 - "$DEPLOY" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
if source.count("kubectl create --dry-run=client -f - -o json") != 3:
    raise SystemExit("target rendering must use exactly three live-independent create dry-runs")
if "kubectl apply --dry-run=client -f - -o json" in source:
    raise SystemExit("apply dry-run can merge live values into the exact target render")
if source.count('ports:[($item.spec.ports // [])[] | . + {protocol:(.protocol // "TCP")}]') != 1:
    raise SystemExit("target Service rendering does not normalize the API-default TCP protocol")
if source.count('ports:[(.spec.ports // [])[] | . + {protocol:(.protocol // "TCP")}]') != 1:
    raise SystemExit("live Service rendering does not normalize the API-default TCP protocol")
if 'BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR:-/opt/resonance-data/control-plane/deploy-state/backstage' not in source:
    raise SystemExit("official and direct deploys do not share the canonical default state directory")
recover_mode = source.index('mode="${1:-deploy}"')
recover_branch = source.index('recover-pending|finalize-pending|reconcile-pending|verify-runtime-identity|verify-pending-candidate|reconcile-repair-authority', recover_mode)
full_prerequisites = source.index("for command in git node corepack docker", recover_branch)
docker_probe = source.index("docker buildx version", full_prerequisites)
if not recover_mode < recover_branch < full_prerequisites < docker_probe:
    raise SystemExit("pending recovery/finalization modes do not precede full deployment prerequisites")
recover_end = source.index("\nphase_started_at", recover_branch)
recover_source = source[recover_branch:recover_end]
expected_binding = source.index("validate_expected_backstage_pending_sha256 || exit 79", recover_branch, recover_end)
pending_branch = source.index("if backstage_pending_state_exists", expected_binding, recover_end)
if not recover_branch < expected_binding < pending_branch:
    raise SystemExit("expected pending SHA-256 is not checked under lock before pending dispatch")
for token in (
    "for command in dirname id mkdir readlink realpath stat flock sed jq sha256sum awk",
    "acquire_backstage_deployment_lock || exit 79",
    "if backstage_pending_state_exists",
    "for command in kubectl jq sha256sum awk date sleep rm sync mv chmod mktemp tr curl openssl base64",
    "resume_pending_backstage_deployment_rollback || exit 79",
    'finalize_pending_backstage_deployment "$2" || exit 79',
    'reconcile_pending_backstage_deployment "$2" || exit 79',
    "requires one exact 40-hex commit; mutation=0",
    "BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0",
    'BACKSTAGE_EXPECTED_PENDING_SHA256',
    'verify_expected_backstage_pending_binding || exit 79',
    'verify_backstage_runtime_identity_against_live "$2"',
):
    if token not in recover_source:
        raise SystemExit(f"recover-pending minimal contract missing: {token}")
for forbidden in (
    "initialize_backstage_build_workspace",
    "ensure_auth_secret",
    "ensure_runtime_purge_recovery_secret",
    "docker build",
    "corepack yarn",
    "kubectl apply",
    "kubectl create",
):
    if forbidden in recover_source:
        raise SystemExit(f"recover-pending contains forbidden mutation path: {forbidden}")
deploy_branch = source.index("  deploy)")
acquire = source.index("acquire_backstage_deployment_lock || exit 79", deploy_branch)
resume = source.index("resume_or_finalize_pending_backstage_deployment || exit 79", acquire)
build_workspace = source.index("initialize_backstage_build_workspace", resume)
preflight = source.index("start_phase preflight", resume)
capture = source.index("capture_backstage_deployment_baseline || exit 79")
mutation_arm = source.index("arm_backstage_deployment_mutations || exit 79", capture)
resource_apply = source.index("apply_exact_target_backstage_resources || exit 79", mutation_arm)
single_deployment_cas = source.index('converge_exact_backstage_deployment_spec "$catalog_digest" || exit 79', resource_apply)
candidate_capture = source.index("capture_backstage_deployment_candidate || exit 79", single_deployment_cas)
finalize = source.index("finalize_successful_backstage_deployment || exit 79")
deployment_pass = source.index('echo "[backstage] PASS deployed', finalize)
if not deploy_branch < acquire < resume < build_workspace < preflight < capture < mutation_arm < resource_apply < single_deployment_cas < candidate_capture < finalize < deployment_pass:
    raise SystemExit("Backstage rollback ordering is not fail-closed")
registry_reuse = source.index('if resolve_verified_backstage_registry_image "$tagged_image" "$runtime_fingerprint"', preflight)
application_build = source.index("start_phase application-build", registry_reuse)
digest_bind = source.index('BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$image"', application_build)
if not preflight < registry_reuse < application_build < digest_bind < capture:
    raise SystemExit("immutable registry digest is not bound before rollback baseline capture")
staging_assignment = source.index(
    'staging_image="$IMAGE_REPOSITORY:${tag}-${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID}"',
    registry_reuse,
    capture,
)
staging_push = source.index('docker push "$staging_image"', staging_assignment, capture)
prebaseline_image_window = source[registry_reuse:capture]
if not registry_reuse < staging_assignment < staging_push < digest_bind < capture:
    raise SystemExit("attempt-scoped staging image is not pushed and digest-bound before baseline capture")
if prebaseline_image_window.count('docker push "$staging_image"') != 1:
    raise SystemExit("pre-baseline image flow must push exactly one attempt-scoped staging image")
for forbidden in ('docker push "$tagged_image"', '-t "$tagged_image"', 'docker tag "$staging_image"'):
    if forbidden in prebaseline_image_window:
        raise SystemExit(f"canonical fingerprint tag is mutated before durable baseline: {forbidden}")
prebaseline_window = source[deploy_branch:capture]
for forbidden in ("kubectl apply", "kubectl patch", "kubectl create secret", "kubectl set image"):
    if forbidden in prebaseline_window:
        raise SystemExit(f"deploy mutates Kubernetes before durable baseline: {forbidden}")
deployment_window = source[mutation_arm:candidate_capture]
for forbidden in (" set image ", "configure_auth_mode\n", "--type=merge"):
    if forbidden in deployment_window:
        raise SystemExit(f"Deployment has a pre-convergence intermediate writer: {forbidden}")
prefix = source[deploy_branch:acquire]
for forbidden in ("resume_pending_", "initialize_backstage_", "kubectl ", "docker "):
    if forbidden in prefix:
        raise SystemExit(f"deploy performs work before state-directory lock: {forbidden}")

lock_start = source.index("acquire_backstage_deployment_lock() {")
lock_end = source.index("\nbackstage_pending_state_exists() {", lock_start)
lock_source = source[lock_start:lock_end]
for token in (
    'prepare_backstage_rollback_state_directory || return 79',
    'exec {lock_fd}<"$state_dir"',
    'stat -Lc',
    'shell_pid="$BASHPID"',
    '"/proc/$shell_pid/fd/$lock_fd"',
    'flock -n "$lock_fd"',
    'BACKSTAGE_DEPLOYMENT_LOCK_HELD=true',
):
    if token not in lock_source:
        raise SystemExit(f"directory FD lock contract missing: {token}")
if "mktemp" in lock_source or ".lock" in lock_source:
    raise SystemExit("deployment serialization must not create a separate lock file")

required = (
    "BackstageDeploymentRollbackPending",
    ".schemaVersion == 4",
    '(.authorityKind == "DB_PROMOTION" or .authorityKind == "APPLIED_MARKER" or .authorityKind == "REPAIR_TOKEN")',
    '(.attemptId | type == "string" and test("^[0-9a-f]{32}$"))',
    'deploymentClosureSha256',
    'plannedDeployment',
    'BACKSTAGE_EXPECTED_ATTEMPT_ID',
    '.schemaVersion == 1',
    '(.phase == "BASELINE_CAPTURED" or .phase == "MUTATION_ARMED" or .phase == "CANDIDATE_READY")',
    '.phase = "MUTATION_ARMED"',
    "candidate capture requires v4 MUTATION_ARMED state",
    "candidate Deployment spec hash is invalid",
    "candidate Deployment spec changed; mutation=0",
    "Deployment spec is foreign to pending phase; rollback mutation=0",
    "legacy pending state cannot be finalized; mutation=0",
    "integritySha256",
    "stat -c '%a:%u:%h'",
    '[[ -f "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" &&',
    '! -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    "pending state schema is invalid",
    "pending state integrity check failed",
    '{op:"test", path:"/metadata/uid", value:$uid}',
    '{op:"test", path:"/metadata/resourceVersion", value:$resourceVersion}',
    '{op:"test", path:"/spec", value:$currentSpec}',
    '{op:"replace", path:"/spec", value:$baselineSpec}',
    'publish_backstage_deploy_marker "$exact_target"',
    'verify_backstage_deploy_marker "$2" || exit 79',
    'chmod 0644 -- "$marker_tmp"',
    'mv -T -- "$marker_tmp" "$BACKSTAGE_DEPLOY_STATE_FILE"',
    "Backstage deploy marker atomic publication failed",
    ".status.updatedReplicas // 0",
    ".status.readyReplicas // 0",
    ".status.availableReplicas // 0",
    ".status.unavailableReplicas // 0",
    "final_status=79",
    'BACKSTAGE_DEPLOY_MARKER_PUBLISHED=true',
    'candidate and pending state retained, rollback forbidden status=79',
    'expected pending SHA-256 is invalid; mutation=0',
    'pending state inode changed during expected-hash verification; mutation=0',
    'pending state does not match expected SHA-256; mutation=0',
    'BACKSTAGE_RUNTIME_IDENTITY_FILE',
    'runtime-success.identity.json',
    'publish_backstage_runtime_identity "$exact_target"',
    'BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED=true',
    'runtime identity owner, mode, or link count is invalid',
    'runtime identity integrity check failed',
    'VERIFY_RUNTIME_IDENTITY_PASS',
    'VERIFY_RUNTIME_IDENTITY_DRIFT',
    'VERIFY_RUNTIME_IDENTITY_UNSAFE',
    'BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE',
    'repair-authority.json',
    'repair authority integrity check failed; mutation=0',
    'reconcile-repair-authority',
    'BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD',
    'adopt_inherited_backstage_deployment_lock',
    'converge_exact_backstage_deployment_spec "$catalog_digest"',
    'schemaVersion: 4',
    'schemaVersion: 3',
    'Secret/carbonet-prod/resonance-preview-tls',
    'name == "https-32947" and .port == 32947',
    'verify_backstage_public_serving_plane',
    '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED',
    'inherited deployment lock FD is not already exclusively locked; mutation=0',
    'is_digest_pinned_backstage_candidate_image',
    'io.resonance.backstage.runtime-fingerprint',
    'docker pull "$tagged_image"',
    'RepoDigests',
    'wait_for_backstage_ready_pod_image_ids',
    '-l app.kubernetes.io/name=resonance-backstage -o json',
    '--label "io.resonance.backstage.runtime-fingerprint=$runtime_fingerprint"',
    'staging_image="$IMAGE_REPOSITORY:${tag}-${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID}"',
    'docker push "$staging_image"',
    'rollbackSpecSha256',
    'baselineTagProof',
    '(keys | sort) == ["deploymentUid","digestImage","holdTag","tag"]',
    'rollback-hold-${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID}',
    'docker push "$hold_tag"',
    'live mutable baseline tag digest changed before durable capture; mutation=0',
    'BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF',
    'VERIFY_PENDING_CANDIDATE_PASS',
    'v4 candidate image is not digest-pinned',
    'v3 runtime identity candidate image is not digest-pinned',
)
for token in required:
    if token not in source:
        raise SystemExit(f"Backstage rollback contract missing: {token}")
PY

fixture="$(mktemp -d)"
cleanup_fixture() {
  local status="$?" pid_file
  trap - EXIT
  if [[ -n "${holder_pid:-}" ]]; then
    kill "$holder_pid" >/dev/null 2>&1 || true
  fi
  for pid_file in "$fixture/holder-child.pid" "$fixture/recover-holder-child.pid"; do
    if [[ -f "$pid_file" ]]; then
      kill "$(cat "$pid_file")" >/dev/null 2>&1 || true
    fi
  done
  rm -rf -- "$fixture" || true
  exit "$status"
}
trap cleanup_fixture EXIT
mkdir -m 0700 "$fixture/state" "$fixture/bin" "$fixture/identity-bin" "$fixture/hash-race-bin" "$fixture/image-bin"
functions="$fixture/rollback-functions.sh"
handler="$fixture/exit-handler.sh"
db_password_function="$fixture/database-role-password-function.sh"
sed -n '/^BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR=/,/^deployment_exit_handler() {/p' "$DEPLOY" |
  sed '$d' >"$functions"
sed -n '/^deployment_exit_handler() {/,/^}$/p' "$DEPLOY" >"$handler"
sed -n '/^update_backstage_database_role_password() {/,/^}$/p' "$DEPLOY" >"$db_password_function"
[[ -s "$functions" && -s "$handler" && -s "$db_password_function" ]]
cat >>"$functions" <<'SH'

# The rollback harness keeps target rendering deterministic and lightweight;
# production target rendering remains exercised by the static target-bound
# contract and focused convergence cases below.
build_target_backstage_managed_resource_payloads() {
  cat "$FAKE_TARGET_RESOURCE_INTENTS"
}
capture_all_backstage_runtime_dependencies() {
  cat "$FAKE_RUNTIME_DEPENDENCIES"
}
eval "$(declare -f reprove_backstage_live_baseline_image_resolution_before_capture | sed '1s/reprove_backstage_live_baseline_image_resolution_before_capture/_fixture_real_reprove_backstage_live_baseline_image_resolution_before_capture/')"
reprove_backstage_live_baseline_image_resolution_before_capture() {
  :
}
eval "$(declare -f arm_backstage_deployment_mutations | sed '1s/arm_backstage_deployment_mutations/_fixture_real_arm_backstage_deployment_mutations/')"
arm_backstage_deployment_mutations() {
  local state_payload planned_spec planned_sha
  _fixture_real_arm_backstage_deployment_mutations "$@" || return
  planned_spec="$(jq -cS '.spec' "$FAKE_PLANNED_DEPLOYMENT_FILE")" || return 1
  planned_sha="$(printf '%s' "$planned_spec" | sha256sum | awk '{print $1}')" || return 1
  state_payload="$(jq -cS --argjson spec "$planned_spec" --arg sha "$planned_sha" '
      del(.integritySha256) |
      .plannedDeployment = {spec:$spec,specSha256:$sha}
    ' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state
}
SH

baseline="$fixture/baseline.json"
candidate="$fixture/candidate.json"
current="$fixture/current.json"
pending="$fixture/state/deployment-rollback.pending.json"
identity="$fixture/state/runtime-success.identity.json"
calls="$fixture/kubectl.calls"
docker_calls="$fixture/docker.calls"
docker_pulled="$fixture/docker.pulled"
image_inspect_json="$fixture/image-inspect.json"
mutations="$fixture/patch-mutations"
resource_mutations="$fixture/resource-mutations"
secret_value='fixture-secret-value-must-never-appear'
target_commit='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
other_commit='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
absent_pending_hash='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
candidate_image='registry.local/resonance-backstage@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
marker_dir="$fixture/marker"
marker="$marker_dir/backstage-runtime-success.commit"
mkdir -m 0700 "$marker_dir"

cat >"$baseline" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"resonance-ops","name":"resonance-backstage","uid":"11111111-1111-4111-8111-111111111111","resourceVersion":"10","generation":4},"spec":{"replicas":1,"selector":{"matchLabels":{"app.kubernetes.io/name":"resonance-backstage"}},"template":{"metadata":{"labels":{"app.kubernetes.io/name":"resonance-backstage","release":"baseline"}},"spec":{"containers":[{"name":"backstage","image":"registry.local/resonance-backstage@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","env":[{"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"resonance-backstage-database","key":"POSTGRES_PASSWORD"}}}]}]}}},"status":{"observedGeneration":4,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
cat >"$candidate" <<'JSON'
{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"namespace":"resonance-ops","name":"resonance-backstage","uid":"11111111-1111-4111-8111-111111111111","resourceVersion":"11","generation":5},"spec":{"replicas":1,"selector":{"matchLabels":{"app.kubernetes.io/name":"resonance-backstage"}},"template":{"metadata":{"labels":{"app.kubernetes.io/name":"resonance-backstage","release":"candidate"}},"spec":{"containers":[{"name":"backstage","image":"registry.local/resonance-backstage@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","env":[{"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"resonance-backstage-database","key":"POSTGRES_PASSWORD"}}}]}]}}},"status":{"observedGeneration":5,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
candidate_spec="$(jq -cS '.spec' "$candidate")"
candidate_spec_sha256="$(printf '%s' "$candidate_spec" | sha256sum | awk '{print $1}')"
resource_baseline_dir="$fixture/resource-baseline"
resource_state_dir="$fixture/resource-state"
mkdir -m 0700 "$resource_baseline_dir" "$resource_state_dir"
cat >"$resource_baseline_dir/ConfigMap_resonance-backstage-config.json" <<'JSON'
{"apiVersion":"v1","kind":"ConfigMap","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-config","uid":"cm-config-uid","resourceVersion":"20","labels":{"app":"backstage"}},"data":{"app-config.production.yaml":"baseline-config"}}
JSON
cat >"$resource_baseline_dir/ConfigMap_resonance-backstage-catalog.json" <<'JSON'
{"apiVersion":"v1","kind":"ConfigMap","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-catalog","uid":"cm-catalog-uid","resourceVersion":"21","labels":{}},"data":{"organization.yaml":"fixture-catalog:organization.yaml\n","systems.yaml":"fixture-catalog:systems.yaml\n","components.yaml":"fixture-catalog:components.yaml\n","apis.yaml":"fixture-catalog:apis.yaml\n","resources.yaml":"fixture-catalog:resources.yaml\n","environments.yaml":"fixture-catalog:environments.yaml\n"}}
JSON
cat >"$resource_baseline_dir/Service_resonance-backstage.json" <<'JSON'
{"apiVersion":"v1","kind":"Service","metadata":{"namespace":"resonance-ops","name":"resonance-backstage","uid":"svc-main-uid","resourceVersion":"22","labels":{"app":"backstage"}},"spec":{"type":"ClusterIP","selector":{"app":"backstage"},"ports":[{"name":"http","port":7007,"protocol":"TCP","targetPort":7007}],"sessionAffinity":"None","externalTrafficPolicy":"Cluster","internalTrafficPolicy":"Cluster","publishNotReadyAddresses":false}}
JSON
cat >"$resource_baseline_dir/Service_resonance-backstage-catalog.json" <<'JSON'
{"apiVersion":"v1","kind":"Service","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-catalog","uid":"svc-catalog-uid","resourceVersion":"23","labels":{"app":"catalog"}},"spec":{"type":"ClusterIP","selector":{"app":"backstage"},"ports":[{"name":"http","port":7007,"protocol":"TCP","targetPort":7007}],"sessionAffinity":"None","externalTrafficPolicy":"Cluster","internalTrafficPolicy":"Cluster","publishNotReadyAddresses":false}}
JSON
cat >"$resource_baseline_dir/NetworkPolicy_resonance-backstage-ingress.json" <<'JSON'
{"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-ingress","uid":"np-ingress-uid","resourceVersion":"24","labels":{"app":"backstage"}},"spec":{"podSelector":{"matchLabels":{"app":"backstage"}},"policyTypes":["Ingress"],"ingress":[]}}
JSON
target_resource_intents="$fixture/target-resource-intents.json"
jq -nS \
  --slurpfile config "$resource_baseline_dir/ConfigMap_resonance-backstage-config.json" \
  --slurpfile catalog "$resource_baseline_dir/ConfigMap_resonance-backstage-catalog.json" \
  --slurpfile service "$resource_baseline_dir/Service_resonance-backstage.json" \
  --slurpfile catalogService "$resource_baseline_dir/Service_resonance-backstage-catalog.json" \
  --slurpfile policy "$resource_baseline_dir/NetworkPolicy_resonance-backstage-ingress.json" '
    def annotations: ((.metadata.annotations // {}) | del(."kubectl.kubernetes.io/last-applied-configuration"));
    def cm: {data:(.data//{}),binaryData:(.binaryData//{}),immutable:(.immutable//false),labels:(.metadata.labels//{}),annotations:annotations};
    def svc: {type:(.spec.type//"ClusterIP"),selector:(.spec.selector//{}),ports:(.spec.ports//[]),sessionAffinity:(.spec.sessionAffinity//"None"),sessionAffinityConfig:(.spec.sessionAffinityConfig//null),externalTrafficPolicy:(.spec.externalTrafficPolicy//"Cluster"),internalTrafficPolicy:(.spec.internalTrafficPolicy//"Cluster"),publishNotReadyAddresses:(.spec.publishNotReadyAddresses//false),trafficDistribution:(.spec.trafficDistribution//null),labels:(.metadata.labels//{}),annotations:annotations};
    {"ConfigMap/resonance-backstage-config":{kind:"ConfigMap",name:"resonance-backstage-config",exists:true,payload:($config[0]|cm)},
     "ConfigMap/resonance-backstage-catalog":{kind:"ConfigMap",name:"resonance-backstage-catalog",exists:true,payload:($catalog[0]|cm)},
     "Service/resonance-backstage":{kind:"Service",name:"resonance-backstage",exists:true,payload:($service[0]|svc)},
     "Service/resonance-backstage-catalog":{kind:"Service",name:"resonance-backstage-catalog",exists:true,payload:($catalogService[0]|svc)},
     "NetworkPolicy/resonance-backstage-ingress":{kind:"NetworkPolicy",name:"resonance-backstage-ingress",exists:true,payload:{spec:$policy[0].spec,labels:($policy[0].metadata.labels//{}),annotations:($policy[0]|annotations)}}}
  ' >"$target_resource_intents"
target_resource_intents_baseline="$fixture/target-resource-intents.baseline.json"
cp -- "$target_resource_intents" "$target_resource_intents_baseline"
dependency_baseline_dir="$fixture/dependency-baseline"
dependency_state_dir="$fixture/dependency-state"
mkdir -m 0700 "$dependency_baseline_dir" "$dependency_state_dir"
cat >"$dependency_baseline_dir/Secret_resonance-backstage-database.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-database","uid":"dependency-db-uid","resourceVersion":"31"},"type":"Opaque","data":{"POSTGRES_PASSWORD":"ZGI=","POSTGRES_USER":"YmFja3N0YWdl"}}
JSON
cat >"$dependency_baseline_dir/Secret_resonance-backstage-auth.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-auth","uid":"dependency-auth-uid","resourceVersion":"32"},"type":"Opaque","data":{"AUTH_SESSION_SECRET":"YXV0aA=="}}
JSON
cat >"$dependency_baseline_dir/Secret_resonance-ops-bridge.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"resonance-ops","name":"resonance-ops-bridge","uid":"dependency-bridge-uid","resourceVersion":"33"},"type":"Opaque","data":{"TOKEN":"YnJpZGdl"}}
JSON
cat >"$dependency_baseline_dir/Secret_resonance-runtime-purge-recovery.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"resonance-ops","name":"resonance-runtime-purge-recovery","uid":"dependency-purge-uid","resourceVersion":"34"},"type":"Opaque","data":{"RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID":"YWNjb3VudA=="}}
JSON
cat >"$dependency_baseline_dir/ConfigMap_resonance-internal-ca.json" <<'JSON'
{"apiVersion":"v1","kind":"ConfigMap","metadata":{"namespace":"resonance-ops","name":"resonance-internal-ca","uid":"dependency-ca-uid","resourceVersion":"35"},"data":{"ca.crt":"fixture-ca"}}
JSON
cat >"$dependency_baseline_dir/Secret_resonance-backstage-tls.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"resonance-ops","name":"resonance-backstage-tls","uid":"dependency-tls-uid","resourceVersion":"36"},"type":"kubernetes.io/tls","data":{"tls.crt":"Zml4dHVyZS1jZXJ0","tls.key":"Zml4dHVyZS1rZXk="}}
JSON
cat >"$dependency_baseline_dir/Secret_carbonet-prod_resonance-ops-bridge.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"carbonet-prod","name":"resonance-ops-bridge","uid":"dependency-source-bridge-uid","resourceVersion":"37"},"type":"Opaque","data":{"TOKEN":"YnJpZGdl"}}
JSON
cat >"$dependency_baseline_dir/Secret_carbonet-prod_resonance-preview-tls.json" <<'JSON'
{"apiVersion":"v1","kind":"Secret","metadata":{"namespace":"carbonet-prod","name":"resonance-preview-tls","uid":"dependency-preview-tls-uid","resourceVersion":"39"},"type":"kubernetes.io/tls","data":{"tls.crt":"Zml4dHVyZS1wcmV2aWV3LWNlcnQ=","tls.key":"Zml4dHVyZS1wcmV2aWV3LWtleQ=="}}
JSON
cat >"$dependency_baseline_dir/Service_ingress-nginx-controller.json" <<'JSON'
{"apiVersion":"v1","kind":"Service","metadata":{"namespace":"ingress-nginx","name":"ingress-nginx-controller","uid":"dependency-ingress-service-uid","resourceVersion":"38"},"spec":{"ports":[{"name":"https-32947","port":32947,"protocol":"TCP","targetPort":"https","nodePort":32947}]}}
JSON
cat >"$dependency_baseline_dir/IngressList.json" <<'JSON'
{"apiVersion":"v1","kind":"List","items":[{"apiVersion":"networking.k8s.io/v1","kind":"Ingress","metadata":{"namespace":"resonance-ops","name":"backstage","uid":"dependency-backstage-ingress-uid"},"spec":{"tls":[{"hosts":["backstage.172.16.1.232.nip.io"],"secretName":"resonance-backstage-tls"}],"rules":[{"host":"backstage.172.16.1.232.nip.io","http":{"paths":[{"path":"/","pathType":"Prefix","backend":{"service":{"name":"resonance-backstage","port":{"number":7007}}}}]}}]}},{"apiVersion":"networking.k8s.io/v1","kind":"Ingress","metadata":{"namespace":"carbonet-prod","name":"resonance-preview","uid":"dependency-preview-ingress-uid"},"spec":{"tls":[{"hosts":["resonance.172.16.1.232.nip.io"],"secretName":"resonance-preview-tls"}],"rules":[{"host":"resonance.172.16.1.232.nip.io","http":{"paths":[{"path":"/","pathType":"Prefix","backend":{"service":{"name":"carbonet-web","port":{"number":80}}}}]}}]}}]}
JSON
runtime_dependencies="$fixture/runtime-dependencies.json"
runtime_dependency_json='{}'
for descriptor in \
  'Secret|resonance-backstage-database' \
  'Secret|resonance-backstage-auth' \
  'Secret|resonance-ops-bridge' \
  'Secret|resonance-runtime-purge-recovery' \
  'ConfigMap|resonance-internal-ca' \
  'Secret|resonance-backstage-tls'; do
  IFS='|' read -r dependency_kind dependency_name <<<"$descriptor"
  dependency_file="$dependency_baseline_dir/${dependency_kind}_${dependency_name}.json"
  if [[ "$dependency_kind" == Secret ]]; then
    dependency_content="$(jq -cS '{data:(.data//{}),immutable:(.immutable//false),type:(.type//"Opaque")}' "$dependency_file")"
  else
    dependency_content="$(jq -cS '{data:(.data//{}),binaryData:(.binaryData//{}),immutable:(.immutable//false)}' "$dependency_file")"
  fi
  dependency_hash="$(printf '%s' "$dependency_content" | sha256sum | awk '{print $1}')"
  dependency_snapshot="$(jq -cnS --arg kind "$dependency_kind" --arg name "$dependency_name" \
    --arg uid "$(jq -r '.metadata.uid' "$dependency_file")" --arg contentSha256 "$dependency_hash" \
    '{kind:$kind,name:$name,uid:$uid,contentSha256:$contentSha256}')"
  runtime_dependency_json="$(jq -cS --arg key "$dependency_kind/$dependency_name" \
    --argjson snapshot "$dependency_snapshot" '. + {($key):$snapshot}' <<<"$runtime_dependency_json")"
done
source_bridge_content="$(jq -cS '{data:(.data//{}),immutable:(.immutable//false),type:(.type//"Opaque")}' \
  "$dependency_baseline_dir/Secret_carbonet-prod_resonance-ops-bridge.json")"
source_bridge_hash="$(printf '%s' "$source_bridge_content" | sha256sum | awk '{print $1}')"
runtime_dependency_json="$(jq -cS --arg hash "$source_bridge_hash" '
  . + {"Secret/carbonet-prod/resonance-ops-bridge":
    {kind:"Secret",name:"resonance-ops-bridge",uid:"dependency-source-bridge-uid",contentSha256:$hash}}
' <<<"$runtime_dependency_json")"
preview_tls_content="$(jq -cS '{data:(.data//{}),immutable:(.immutable//false),type:(.type//"Opaque")}' \
  "$dependency_baseline_dir/Secret_carbonet-prod_resonance-preview-tls.json")"
preview_tls_hash="$(printf '%s' "$preview_tls_content" | sha256sum | awk '{print $1}')"
runtime_dependency_json="$(jq -cS --arg hash "$preview_tls_hash" '
  . + {"Secret/carbonet-prod/resonance-preview-tls":
    {kind:"Secret",name:"resonance-preview-tls",uid:"dependency-preview-tls-uid",contentSha256:$hash}}
' <<<"$runtime_dependency_json")"
ingress_service_content="$(jq -cS '{httpsPorts:[.spec.ports[] | select(.name=="https-32947") |
  {name,port,protocol,targetPort,nodePort}]}' "$dependency_baseline_dir/Service_ingress-nginx-controller.json")"
ingress_service_hash="$(printf '%s' "$ingress_service_content" | sha256sum | awk '{print $1}')"
runtime_dependency_json="$(jq -cS --arg hash "$ingress_service_hash" '
  . + {"Service/ingress-nginx-controller":
    {kind:"Service",name:"ingress-nginx/ingress-nginx-controller",uid:"dependency-ingress-service-uid",contentSha256:$hash}}
' <<<"$runtime_dependency_json")"
for ingress_role in backstage preview; do
  if [[ "$ingress_role" == backstage ]]; then ingress_host='backstage.172.16.1.232.nip.io'; ingress_uid='dependency-backstage-ingress-uid';
  else ingress_host='resonance.172.16.1.232.nip.io'; ingress_uid='dependency-preview-ingress-uid'; fi
  ingress_content="$(jq -cS --arg host "$ingress_host" '
    [.items[] | select(any(.spec.rules[]?; .host==$host))][0] |
    {namespace:.metadata.namespace,name:.metadata.name,
     annotations:((.metadata.annotations // {}) | with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration"))),
     ingressClassName:(.spec.ingressClassName // null),rules:[.spec.rules[]|select(.host==$host)],
     tls:[.spec.tls[]?|select(.hosts|index($host)!=null)]}
  ' "$dependency_baseline_dir/IngressList.json")"
  ingress_hash="$(printf '%s' "$ingress_content" | sha256sum | awk '{print $1}')"
  runtime_dependency_json="$(jq -cS --arg key "Ingress/$ingress_role" --arg role "$ingress_role" \
    --arg uid "$ingress_uid" --arg hash "$ingress_hash" \
    '. + {($key):{kind:"Ingress",name:$role,uid:$uid,contentSha256:$hash}}' <<<"$runtime_dependency_json")"
done
printf '%s\n' "$runtime_dependency_json" >"$runtime_dependencies"

cat >"$fixture/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_KUBECTL_CALLS"
case "$*" in
  "create --dry-run=client -f - -o json")
    cat >/dev/null
    jq -n \
      --slurpfile config "$FAKE_RESOURCE_BASELINE_DIR/ConfigMap_resonance-backstage-config.json" \
      --slurpfile service "$FAKE_RESOURCE_BASELINE_DIR/Service_resonance-backstage.json" \
      --slurpfile catalogService "$FAKE_RESOURCE_BASELINE_DIR/Service_resonance-backstage-catalog.json" \
      --slurpfile policy "$FAKE_RESOURCE_BASELINE_DIR/NetworkPolicy_resonance-backstage-ingress.json" \
      --slurpfile deployment "$FAKE_PLANNED_DEPLOYMENT_FILE" \
      '{apiVersion:"v1",kind:"List",items:[$config[0],$service[0],$catalogService[0],$policy[0],$deployment[0]]}'
    ;;
  "-n resonance-ops get deployment resonance-backstage -o json")
    cat "$FAKE_DEPLOYMENT_STATE"
    ;;
  "-n resonance-ops get pods -l app.kubernetes.io/name=resonance-backstage -o json")
    [[ "${FAKE_POD_LOOKUP_FAIL:-false}" != true ]] || exit 1
    pod_image="$(jq -er '[.spec.template.spec.containers[] | select(.name=="backstage") | .image] | if length==1 then .[0] else error("image") end' "$FAKE_DEPLOYMENT_STATE")"
    pod_image_id="${FAKE_POD_IMAGE_ID_OVERRIDE:-docker-pullable://$pod_image}"
    desired="$(jq -r '.spec.replicas // 1' "$FAKE_DEPLOYMENT_STATE")"
    jq -cn --arg image "$pod_image" --arg imageID "$pod_image_id" --argjson desired "$desired" '
      {apiVersion:"v1",kind:"List",items:[range(0;$desired) | {
        metadata:{name:("backstage-"+tostring),namespace:"resonance-ops",deletionTimestamp:null,
          labels:{"app.kubernetes.io/name":"resonance-backstage"}},
        spec:{containers:[{name:"backstage",image:$image}]},
        status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],
          containerStatuses:[{name:"backstage",ready:true,image:$image,imageID:$imageID}]}
      }]}'
    ;;
  "-n carbonet-prod get Secret resonance-ops-bridge -o json")
    cat "$FAKE_DEPENDENCY_STATE_DIR/Secret_carbonet-prod_resonance-ops-bridge.json"
    ;;
  "-n carbonet-prod get Secret resonance-preview-tls -o json")
    cat "$FAKE_DEPENDENCY_STATE_DIR/Secret_carbonet-prod_resonance-preview-tls.json"
    ;;
  "-n ingress-nginx get Service ingress-nginx-controller -o json")
    cat "$FAKE_DEPENDENCY_STATE_DIR/Service_ingress-nginx-controller.json"
    ;;
  "get ingress -A -o json")
    cat "$FAKE_DEPENDENCY_STATE_DIR/IngressList.json"
    ;;
  "-n carbonet-prod exec -i "*" -c patroni -- psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 --set=VERBOSITY=terse")
    sql_input="$(cat)"
    escaped_password="${FAKE_DB_PASSWORD_EXPECTED//\'/\'\'}"
    expected_sql="$(printf 'create role backstage login createdb password '\''%s'\'';' "$escaped_password")"
    [[ "$sql_input" == "$expected_sql" ]] || exit 92
    : >"$FAKE_DB_SQL_PROOF"
    if [[ "${FAKE_DB_PSQL_FAIL:-false}" == true ]]; then
      printf 'raw database diagnostic included password=%s\n' "$FAKE_DB_PASSWORD_EXPECTED" >&2
      exit 1
    fi
    ;;
  "-n carbonet-prod exec -i "*" -c patroni -- python3 -c "*)
    password_input="$(cat)"
    [[ "$password_input" == "$FAKE_DB_PASSWORD_EXPECTED" ]] || exit 93
    : >"$FAKE_DB_AUTH_PROOF"
    if [[ "${FAKE_DB_AUTH_FAIL:-false}" == true ]]; then
      printf 'raw database authentication diagnostic password=%s\n' "$FAKE_DB_PASSWORD_EXPECTED" >&2
      exit 1
    fi
    printf '1\n'
    ;;
  "-n resonance-ops get Secret "*" -o json"|"-n resonance-ops get ConfigMap resonance-internal-ca -o json")
    kind="$4"
    name="$5"
    cat "$FAKE_DEPENDENCY_STATE_DIR/${kind}_${name}.json"
    ;;
  "-n resonance-ops get "*" "*" --ignore-not-found -o json")
    kind="$4"
    name="$5"
    resource_file="$FAKE_RESOURCE_STATE_DIR/${kind}_${name}.json"
    [[ ! -f "$resource_file" ]] || cat "$resource_file"
    ;;
  "-n resonance-ops patch deployment resonance-backstage --type=json --patch-file=/dev/stdin")
    patch_json="$(cat)"
    current_json="$(cat "$FAKE_DEPLOYMENT_STATE")"
    if [[ "${FAKE_CAS_DRIFT_ON_PATCH:-false}" == true ]]; then
      drift_tmp="$FAKE_DEPLOYMENT_STATE.drift.$$"
      jq -c '
        .metadata.resourceVersion = "99" |
        .metadata.generation = (.metadata.generation + 1) |
        .spec.template.metadata.annotations.externalDrift = "true"
      ' <<<"$current_json" >"$drift_tmp"
      mv -f -- "$drift_tmp" "$FAKE_DEPLOYMENT_STATE"
      current_json="$(cat "$FAKE_DEPLOYMENT_STATE")"
    fi
    if ! jq -e --argjson patch "$patch_json" '
        ($patch | length) == 4 and
        $patch[0].op == "test" and $patch[0].path == "/metadata/uid" and
        $patch[1].op == "test" and $patch[1].path == "/metadata/resourceVersion" and
        $patch[2].op == "test" and $patch[2].path == "/spec" and
        $patch[3].op == "replace" and $patch[3].path == "/spec" and
        .metadata.uid == $patch[0].value and
        .metadata.resourceVersion == $patch[1].value and
        .spec == $patch[2].value
      ' <<<"$current_json" >/dev/null; then
      echo 'fixture JSON-Patch test conflict' >&2
      exit 1
    fi
    replacement_spec="$(jq -c '.[3].value' <<<"$patch_json")"
    patched_tmp="$FAKE_DEPLOYMENT_STATE.patched.$$"
    jq -c --argjson replacement "$replacement_spec" '
      .spec = $replacement |
      .metadata.resourceVersion = ((.metadata.resourceVersion | tonumber) + 1 | tostring) |
      .metadata.generation = (.metadata.generation + 1) |
      (.spec.replicas // 1) as $desired |
      .status = {
        observedGeneration: .metadata.generation,
        updatedReplicas: $desired,
        readyReplicas: $desired,
        availableReplicas: $desired,
        unavailableReplicas: 0
      }
    ' <<<"$current_json" >"$patched_tmp"
    mv -f -- "$patched_tmp" "$FAKE_DEPLOYMENT_STATE"
    count="$(cat "$FAKE_PATCH_MUTATIONS")"
    printf '%s\n' "$((count + 1))" >"$FAKE_PATCH_MUTATIONS"
    ;;
  "-n resonance-ops patch ConfigMap "*" --type=json --patch-file=/dev/stdin"|\
  "-n resonance-ops patch Service "*" --type=json --patch-file=/dev/stdin"|\
  "-n resonance-ops patch NetworkPolicy "*" --type=json --patch-file=/dev/stdin")
    kind="$4"
    name="$5"
    resource_file="$FAKE_RESOURCE_STATE_DIR/${kind}_${name}.json"
    patch_json="$(cat)"
    current_json="$(cat "$resource_file")"
    jq -e --argjson patch "$patch_json" '
      ($patch | length) >= 2 and
      $patch[0] == {op:"test",path:"/metadata/uid",value:.metadata.uid} and
      $patch[1] == {op:"test",path:"/metadata/resourceVersion",value:.metadata.resourceVersion}
    ' <<<"$current_json" >/dev/null || exit 1
    patched_tmp="$resource_file.patched.$$"
    jq -c --argjson patch "$patch_json" '
      def pointer: split("/")[1:] | map(gsub("~1";"/") | gsub("~0";"~"));
      reduce ($patch[2:][]) as $operation (.;
        if $operation.op == "remove" then delpaths([($operation.path | pointer)])
        elif $operation.op == "add" or $operation.op == "replace" then
          setpath(($operation.path | pointer); $operation.value)
        else error("unsupported fixture JSON patch") end) |
      .metadata.resourceVersion = ((.metadata.resourceVersion | tonumber) + 1 | tostring)
    ' <<<"$current_json" >"$patched_tmp"
    mv -f -- "$patched_tmp" "$resource_file"
    count="$(cat "$FAKE_RESOURCE_MUTATIONS")"
    printf '%s\n' "$((count + 1))" >"$FAKE_RESOURCE_MUTATIONS"
    ;;
  "-n resonance-ops rollout status deployment/resonance-backstage --timeout=2s")
    ;;
  *)
    printf 'unexpected fake kubectl call: %s\n' "$*" >&2
    exit 91
    ;;
esac
SH
chmod 0755 "$fixture/bin/kubectl"

cat >"$fixture/image-bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_DOCKER_CALLS"
case "$*" in
  "pull "*)
    [[ "${FAKE_REGISTRY_PULL_FAIL:-false}" != true ]] || exit 1
    : >"$FAKE_DOCKER_PULLED"
    ;;
  "image inspect "*)
    [[ -f "$FAKE_DOCKER_PULLED" ]] || exit 1
    cat "$FAKE_IMAGE_INSPECT_JSON"
    ;;
  "tag "*)
    [[ "${FAKE_DOCKER_TAG_FAIL:-false}" != true ]] || exit 1
    ;;
  "push "*)
    [[ "${FAKE_DOCKER_PUSH_FAIL:-false}" != true ]] || exit 1
    ;;
  "image rm "*)
    ;;
  *) exit 97 ;;
esac
SH
chmod 0755 "$fixture/image-bin/docker"
ln -s ../bin/kubectl "$fixture/image-bin/kubectl"

cat >"$fixture/bin/forbidden-full-prerequisite" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$(basename "$0")" >>"$FAKE_FORBIDDEN_COMMANDS"
exit 98
SH
chmod 0755 "$fixture/bin/forbidden-full-prerequisite"
for command in node docker corepack; do
  ln -s forbidden-full-prerequisite "$fixture/bin/$command"
done
cat >"$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "curl $*" >>"$FAKE_KUBECTL_CALLS"
if [[ -n "${FAKE_CURL_HOLD_STARTED:-}" ]]; then
  : >"$FAKE_CURL_HOLD_STARTED"
  sleep 0.3
fi
if [[ -n "${FAKE_PUBLIC_CURL_FAIL_PATTERN:-}" &&
      "$*" == *"$FAKE_PUBLIC_CURL_FAIL_PATTERN"* ]]; then
  exit 22
fi
exit 0
SH
chmod 0755 "$fixture/bin/curl"
cat >"$fixture/bin/openssl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == x509 ]]; then
  cat >/dev/null
  exit 0
fi
[[ "$#" == 3 && "$1" == rand && "$2" == -hex && "$3" == 16 ]]
exec /usr/bin/openssl "$@"
SH
chmod 0755 "$fixture/bin/openssl"
cat >"$fixture/bin/git" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == -C ]]; then
  root="$2"
  shift 2
else
  root="${FAKE_GIT_ROOT:-.}"
fi
case "${1:-}" in
  show)
    object_path="${2#*:}"
    if [[ "$object_path" == ops/scripts/resonance-backstage-runtime-fingerprint.sh &&
          -n "${FAKE_TARGET_FINGERPRINT_SCRIPT:-}" ]]; then
      exec /bin/cat -- "$FAKE_TARGET_FINGERPRINT_SCRIPT"
    fi
    if [[ "$object_path" == platform/control-plane/catalog/*.yaml ]]; then
      printf 'fixture-catalog:%s\n' "${object_path##*/}"
      exit 0
    fi
    exec /bin/cat -- "$root/$object_path"
    ;;
  cat-file)
    [[ "${2:-}" == -e ]]
    object_path="${3#*:}"
    [[ -n "$object_path" ]]
    ;;
  ls-tree)
    shift
    [[ "${1:-}" == -r ]]
    shift 2
    [[ "${1:-}" == -- ]]
    shift
    files=()
    for requested in "$@"; do
      if [[ -d "$root/$requested" ]]; then
        # Runtime-fingerprint tests need stable target-bound tree bytes, not a
        # full sparse-worktree walk on every verifier invocation.
        files+=("$requested/package.json")
      elif [[ -f "$root/$requested" ]]; then
        files+=("$requested")
      else
        files+=("$requested")
      fi
    done
    for file in "${files[@]}"; do
      if [[ -f "$root/$file" ]]; then
        hash="$(sha256sum "$root/$file" | awk '{print $1}')"
      else
        hash="$(printf 'fixture-missing:%s' "$file" | sha256sum | awk '{print $1}')"
      fi
      printf '100644 blob %s\t%s\n' "$hash" "$file"
    done | sort -k2
    ;;
  rev-parse)
    printf '%s\n' "${FAKE_SELECTED_HEAD:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
    ;;
  *)
    echo "unexpected fake git command: $*" >&2
    exit 97
    ;;
esac
SH
chmod 0755 "$fixture/bin/git"
cat >"$fixture/identity-bin/git" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" == 4 && "$1" == -C && "$2" == "$FAKE_SELECTED_ROOT" &&
      "$3" == rev-parse && "$4" == HEAD ]]; then
  printf '%s\n' "$FAKE_SELECTED_HEAD"
  exit 0
fi
exec "$FAKE_GENERAL_GIT" "$@"
SH
chmod 0755 "$fixture/identity-bin/git"
cat >"$fixture/hash-race-bin/sha256sum" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${FAKE_PENDING_SWAP_DURING_HASH:-false}" == true && "$#" == 2 &&
      "$1" == -- && "$2" == "$FAKE_PENDING_HASH_TARGET" ]]; then
  /usr/bin/sha256sum "$@"
  mv -f -- "$FAKE_PENDING_REPLACEMENT" "$FAKE_PENDING_HASH_TARGET"
  exit 0
fi
exec /usr/bin/sha256sum "$@"
SH
chmod 0755 "$fixture/hash-race-bin/sha256sum"

export PATH="$fixture/bin:$PATH"
export BACKSTAGE_REGISTRY=registry.local
export IMAGE_REPOSITORY=registry.local/resonance-backstage
export FAKE_DEPLOYMENT_STATE="$current"
export FAKE_KUBECTL_CALLS="$calls"
export FAKE_PATCH_MUTATIONS="$mutations"
export FAKE_RESOURCE_MUTATIONS="$resource_mutations"
export FAKE_FORBIDDEN_COMMANDS="$fixture/forbidden-commands"
export FAKE_GENERAL_GIT="$fixture/bin/git"
export FAKE_RESOURCE_STATE_DIR="$resource_state_dir"
export FAKE_RESOURCE_BASELINE_DIR="$resource_baseline_dir"
export FAKE_DEPENDENCY_STATE_DIR="$dependency_state_dir"
export FAKE_TARGET_RESOURCE_INTENTS="$target_resource_intents"
export FAKE_RUNTIME_DEPENDENCIES="$runtime_dependencies"
export FAKE_PLANNED_DEPLOYMENT_FILE="$candidate"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$fixture/state"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$pending"
export BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS=2
export BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS=0.05
export BACKSTAGE_DEPLOYMENT_TARGET_COMMIT="$target_commit"
export BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND=DB_PROMOTION
export BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$candidate_image"
runtime_fingerprint="$(git -C "$ROOT" show \
  "$target_commit:ops/scripts/resonance-backstage-runtime-fingerprint.sh" |
  bash -s -- "$ROOT" "$target_commit")"
deployment_closure_sha256="$(ROOT="$ROOT" bash -c '
  set -Eeuo pipefail
  source "$1"
  calculate_target_backstage_deployment_closure "$2" "$3"
' _ "$functions" "$target_commit" "$runtime_fingerprint")"
tagged_image="registry.local/resonance-backstage:${runtime_fingerprint:0:12}"
jq -cn --arg fingerprint "$runtime_fingerprint" --arg digest "$candidate_image" '
  [{Config:{Labels:{"io.resonance.backstage.runtime-fingerprint":$fingerprint}},
    RepoDigests:[$digest]}]
' >"$image_inspect_json"
export FAKE_DOCKER_CALLS="$docker_calls"
export FAKE_DOCKER_PULLED="$docker_pulled"
export FAKE_IMAGE_INSPECT_JSON="$image_inspect_json"
export BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT="$runtime_fingerprint"
export BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256="$deployment_closure_sha256"
export FIXTURE_SECRET_VALUE="$secret_value"

reset_fixture() {
  rm -rf -- "$fixture/state"
  mkdir -m 0700 "$fixture/state"
  cp -- "$baseline" "$current"
  rm -rf -- "$resource_state_dir"
  cp -a -- "$resource_baseline_dir" "$resource_state_dir"
  cp -- "$target_resource_intents_baseline" "$target_resource_intents"
  rm -rf -- "$dependency_state_dir"
  cp -a -- "$dependency_baseline_dir" "$dependency_state_dir"
  : >"$calls"
  : >"$docker_calls"
  rm -f -- "$docker_pulled"
  : >"$FAKE_FORBIDDEN_COMMANDS"
  printf '0\n' >"$mutations"
  printf '0\n' >"$resource_mutations"
  unset FAKE_CAS_DRIFT_ON_PATCH
  unset BACKSTAGE_DEPLOY_STATE_FILE
  unset BACKSTAGE_EXPECTED_PENDING_SHA256
  unset BACKSTAGE_EXPECTED_ATTEMPT_ID
  unset BACKSTAGE_DEPLOYMENT_ATTEMPT_ID
  unset BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF
  unset BACKSTAGE_RUNTIME_IDENTITY_FILE
  unset BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE
  unset BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD
  unset FAKE_DB_AUTH_FAIL
  unset FAKE_PUBLIC_CURL_FAIL
  unset FAKE_PUBLIC_CURL_FAIL_PATTERN
  unset FAKE_POD_IMAGE_ID_OVERRIDE
  unset FAKE_POD_LOOKUP_FAIL
  unset FAKE_REGISTRY_PULL_FAIL
  unset FAKE_DOCKER_TAG_FAIL
  unset FAKE_DOCKER_PUSH_FAIL
  unset FAKE_CURL_HOLD_STARTED
  rm -f -- "$marker"
}

assert_baseline_restored() {
  local expected_pending="${1:-$pending}"
  jq -e --slurpfile baseline "$baseline" '
    .metadata.uid == $baseline[0].metadata.uid and
    .spec == $baseline[0].spec and
    ((.spec.replicas // 1) as $desired |
      .status.updatedReplicas == $desired and
      .status.readyReplicas == $desired and
      .status.availableReplicas == $desired and
      .status.unavailableReplicas == 0)
  ' "$current" >/dev/null
  [[ ! -e "$expected_pending" && ! -L "$expected_pending" ]]
}

set_managed_resource_to_target_intent() {
  local kind="$1" name="$2" key="$1/$2" resource_file payload resource_tmp
  resource_file="$resource_state_dir/${kind}_${name}.json"
  payload="$(jq -cS --arg key "$key" '.[$key].payload' "$target_resource_intents")"
  resource_tmp="$resource_file.intent.$$"
  case "$kind" in
    ConfigMap)
      jq -c --argjson payload "$payload" '
        .metadata.resourceVersion = ((.metadata.resourceVersion|tonumber)+1|tostring) |
        .metadata.labels = $payload.labels | .metadata.annotations = $payload.annotations |
        .data = $payload.data | .binaryData = $payload.binaryData | .immutable = $payload.immutable
      ' "$resource_file" >"$resource_tmp"
      ;;
    Service)
      jq -c --argjson payload "$payload" '
        .metadata.resourceVersion = ((.metadata.resourceVersion|tonumber)+1|tostring) |
        .metadata.labels = $payload.labels | .metadata.annotations = $payload.annotations |
        .spec.type = $payload.type | .spec.selector = $payload.selector | .spec.ports = $payload.ports |
        .spec.sessionAffinity = $payload.sessionAffinity |
        .spec.sessionAffinityConfig = $payload.sessionAffinityConfig |
        .spec.externalTrafficPolicy = $payload.externalTrafficPolicy |
        .spec.internalTrafficPolicy = $payload.internalTrafficPolicy |
        .spec.publishNotReadyAddresses = $payload.publishNotReadyAddresses |
        .spec.trafficDistribution = $payload.trafficDistribution
      ' "$resource_file" >"$resource_tmp"
      ;;
    NetworkPolicy)
      jq -c --argjson payload "$payload" '
        .metadata.resourceVersion = ((.metadata.resourceVersion|tonumber)+1|tostring) |
        .metadata.labels = $payload.labels | .metadata.annotations = $payload.annotations |
        .spec = $payload.spec
      ' "$resource_file" >"$resource_tmp"
      ;;
    *) return 1 ;;
  esac
  mv -f -- "$resource_tmp" "$resource_file"
}

set_target_intent_variant() {
  local kind="$1" name="$2" key="$1/$2" intents_tmp
  intents_tmp="$target_resource_intents.variant.$$"
  jq -cS --arg key "$key" '.[$key].payload.labels.fixtureTarget = "candidate"' \
    "$target_resource_intents" >"$intents_tmp"
  mv -f -- "$intents_tmp" "$target_resource_intents"
}

set_managed_resource_foreign() {
  local kind="$1" name="$2" resource_file resource_tmp
  resource_file="$resource_state_dir/${kind}_${name}.json"
  resource_tmp="$resource_file.foreign.$$"
  jq -c '
    .metadata.resourceVersion = ((.metadata.resourceVersion|tonumber)+1|tostring) |
    .metadata.labels.foreignWriter = "unexpected"
  ' "$resource_file" >"$resource_tmp"
  mv -f -- "$resource_tmp" "$resource_file"
}

assert_managed_resource_payload_baseline() {
  local kind="$1" name="$2"
  NAMESPACE=resonance-ops bash -c '
    set -Eeuo pipefail
    source "$1"
    current_payload="$(normalize_backstage_managed_resource_payload "$2" "$(<"$3")")"
    baseline_payload="$(normalize_backstage_managed_resource_payload "$2" "$(<"$4")")"
    [[ "$current_payload" == "$baseline_payload" ]]
  ' _ "$functions" "$kind" \
    "$resource_state_dir/${kind}_${name}.json" \
    "$resource_baseline_dir/${kind}_${name}.json"
}

# 1. A normal nonzero exit restores the exact spec and preserves status 37.
reset_fixture
set +e
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline
  arm_backstage_deployment_mutations
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 37
' _ "$functions" "$handler" "$candidate" >"$fixture/failure.out" 2>"$fixture/failure.err"
status=$?
set -e
[[ "$status" == 37 ]] || {
  printf '[backstage-rollback-test] case1 unexpected status=%s\n' "$status" >&2
  sed 's/^/[case1] /' "$fixture/failure.err" >&2
  jq -c '{schemaVersion,keys:(keys|sort),dependencyKeys:(.runtimeDependencies|keys|sort),phase,
    baselineKeys:(.baseline|keys|sort),candidateKeys:(.candidate|keys|sort)}' "$pending" >&2 || true
  exit 1
}
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]
grep -Fq 'deployment rollback verified and pending state cleared' "$fixture/failure.out"

# 2. SIGKILL leaves an atomic mode-0600 pending snapshot; the next deploy
# resumes it before doing any other work and removes it only after proof.
reset_fixture
set +e
{
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline
    arm_backstage_deployment_mutations
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    kill -KILL $$
  ' _ "$functions" "$candidate" >"$fixture/sigkill.out" 2>"$fixture/sigkill.err"
  status=$?
} 2>>"$fixture/sigkill.err"
set -e
[[ "$status" == 137 ]]
[[ "$(stat -c '%a:%u:%h' "$pending")" == "600:$(id -u):1" ]]
jq -e --slurpfile baseline "$baseline" --arg target "$target_commit" \
  --arg runtimeFingerprint "$runtime_fingerprint" \
  --arg deploymentClosure "$deployment_closure_sha256" --arg candidateImage "$candidate_image" '
  .schemaVersion == 4 and
  .targetCommit == $target and
  .authorityKind == "DB_PROMOTION" and
  .phase == "MUTATION_ARMED" and
  .candidate.image == $candidateImage and
  .candidate.spec == null and
  .candidate.specSha256 == null and
  .plannedDeployment.spec == ($baseline[0] | .spec.template.metadata.labels.release = "candidate" | .spec.template.spec.containers[0].image = $candidateImage | .spec) and
  (.resourceIntents | keys | length) == 5 and
  .baseline.uid == $baseline[0].metadata.uid and
  .baseline.resourceVersion == $baseline[0].metadata.resourceVersion and
  .baseline.spec == $baseline[0].spec and
  (.attemptId | test("^[0-9a-f]{32}$")) and
  .runtimeFingerprint == $runtimeFingerprint and
  .deploymentClosureSha256 == $deploymentClosure
' "$pending" >/dev/null
[[ "$(find "$fixture/state" -maxdepth 1 -name '.deployment-rollback.pending.*' | wc -l)" == 0 ]]
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  resume_pending_backstage_deployment_rollback
' _ "$functions" >"$fixture/resume.out" 2>"$fixture/resume.err"
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]
grep -Fq 'pending Deployment rollback recovery PASS' "$fixture/resume.out"

# 3. A resourceVersion drift between fresh GET and PATCH makes the JSON-Patch
# tests fail. The rollback performs zero Deployment mutations and returns 79.
reset_fixture
set +e
FAKE_CAS_DRIFT_ON_PATCH=true bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline
  arm_backstage_deployment_mutations
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 23
' _ "$functions" "$handler" "$candidate" >"$fixture/cas.out" 2>"$fixture/cas.err"
status=$?
set -e
[[ "$status" == 79 ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ -f "$pending" ]]
jq -e '.metadata.resourceVersion == "99" and .spec.template.metadata.annotations.externalDrift == "true"' \
  "$current" >/dev/null
grep -Fq 'JSON-Patch CAS failed' "$fixture/cas.err"

# 4. A successful, fully ready candidate clears pending without rollback.
reset_fixture
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline
  arm_backstage_deployment_mutations
  cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate
  finalize_successful_backstage_deployment
' _ "$functions" "$candidate" >"$fixture/success.out" 2>"$fixture/success.err"
[[ ! -e "$pending" && ! -L "$pending" ]]
[[ "$(cat "$mutations")" == 0 ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
grep -Fq "deployment rollback state finalized target=$target_commit pending=0" "$fixture/success.out"

create_pending_state() {
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
  ' _ "$functions"
}

create_armed_pending_state() {
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
  ' _ "$functions"
}

create_pending_candidate_state() {
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    capture_backstage_deployment_candidate >/dev/null
  ' _ "$functions" "$candidate"
}

create_legacy_v1_pending_state() {
  local destination="${1:-$pending}" payload integrity
  payload="$(jq -cS \
    --arg namespace resonance-ops \
    --arg deployment resonance-backstage '
      {
        schemaVersion: 1,
        kind: "BackstageDeploymentRollbackPending",
        namespace: $namespace,
        deploymentName: $deployment,
        baseline: {
          uid: .metadata.uid,
          resourceVersion: .metadata.resourceVersion,
          spec: .spec
        }
      }
    ' "$baseline")"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$destination"
  chmod 0600 "$destination"
}

create_valid_replacement_pending_state() {
  local destination="$1" payload integrity
  payload="$(jq -cS --arg target "$other_commit" '
    del(.integritySha256) |
    .targetCommit = $target |
    .authorityKind = "APPLIED_MARKER"
  ' "$pending")"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$destination"
  chmod 0600 "$destination"
}

create_runtime_identity_from_deployment() {
  local target="$1" deployment_file="$2" destination="${3:-$identity}"
  local attempt_id="${4:-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee}"
  local uid image spec spec_sha256 payload integrity dependency_closure live_resource_closure candidate_closure
  uid="$(jq -r '.metadata.uid' "$deployment_file")"
  image="$(jq -er '[.spec.template.spec.containers[] | select(.name == "backstage") | .image] |
    if length == 1 then .[0] else error("image") end' "$deployment_file")"
  spec="$(jq -cS '.spec' "$deployment_file")"
  spec_sha256="$(printf '%s' "$spec" | sha256sum | awk '{print $1}')"
  dependency_closure="$(printf '%s' "$(jq -cS . "$runtime_dependencies")" |
    sha256sum | awk '{print $1}')"
  live_resource_closure="$(printf 'fixture-managed-resource-closure' | sha256sum | awk '{print $1}')"
  if [[ -f "$pending" ]]; then
    candidate_closure="$(jq -r '.candidate.liveResourceClosureSha256 // empty' "$pending")"
    [[ "$candidate_closure" =~ ^[0-9a-f]{64}$ ]] && live_resource_closure="$candidate_closure"
  fi
  payload="$(jq -cnS --arg target "$target" --arg attemptId "$attempt_id" \
    --arg runtimeFingerprint "$runtime_fingerprint" \
    --arg deploymentClosureSha256 "$deployment_closure_sha256" \
    --arg uid "$uid" --arg image "$image" --arg specSha256 "$spec_sha256" \
    --arg liveResourceClosureSha256 "$live_resource_closure" \
    --argjson runtimeDependencies "$(<"$runtime_dependencies")" \
    --arg runtimeDependencyClosureSha256 "$dependency_closure" '
      {
        schemaVersion:3,
        targetCommit:$target,
        attemptId:$attemptId,
        runtimeFingerprint:$runtimeFingerprint,
        deploymentClosureSha256:$deploymentClosureSha256,
        liveResourceClosureSha256:$liveResourceClosureSha256,
        runtimeDependencies:$runtimeDependencies,
        runtimeDependencyClosureSha256:$runtimeDependencyClosureSha256,
        deploymentUid:$uid,
        candidateImage:$image,
        candidateSpecSha256:$specSha256
      }
    ')"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$destination"
  chmod 0600 "$destination"
}

project_pending_to_legacy_v3() {
  local payload dependency_closure integrity
  payload="$(jq -cS '
      del(.integritySha256) |
      .schemaVersion = 3 |
      del(.candidate.baselineTagProof) |
      del(.baseline.rollbackSpec,.baseline.rollbackSpecSha256) |
      .runtimeDependencies |= with_entries(select(.key == "ConfigMap/resonance-internal-ca" or
        .key == "Secret/resonance-backstage-auth" or
        .key == "Secret/resonance-backstage-database" or
        .key == "Secret/resonance-ops-bridge" or
        .key == "Secret/resonance-runtime-purge-recovery"))
    ' "$pending")"
  dependency_closure="$(printf '%s' "$(jq -cS '.runtimeDependencies' <<<"$payload")" |
    sha256sum | awk '{print $1}')"
  payload="$(jq -cS --arg closure "$dependency_closure" \
    '.candidate.runtimeDependencyClosureSha256 = $closure' <<<"$payload")"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$pending"
  chmod 0600 "$pending"
}

project_identity_to_legacy_v2() {
  local payload dependency_closure integrity
  payload="$(jq -cS '
      del(.integritySha256) |
      .schemaVersion = 2 |
      .runtimeDependencies |= with_entries(select(.key == "ConfigMap/resonance-internal-ca" or
        .key == "Secret/resonance-backstage-auth" or
        .key == "Secret/resonance-backstage-database" or
        .key == "Secret/resonance-ops-bridge" or
        .key == "Secret/resonance-runtime-purge-recovery"))
    ' "$identity")"
  dependency_closure="$(printf '%s' "$(jq -cS '.runtimeDependencies' <<<"$payload")" |
    sha256sum | awk '{print $1}')"
  payload="$(jq -cS --arg closure "$dependency_closure" \
    '.runtimeDependencyClosureSha256 = $closure' <<<"$payload")"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$identity"
  chmod 0600 "$identity"
}

create_parent_authority_binding() {
  local destination="${1:-$fixture/state/parent-authority-binding.json}"
  local status="${2:-ARMED}" payload integrity
  payload="$(jq -cnS --arg status "$status" --arg target "$target_commit" '
    {schemaVersion:1,kind:"BackstageParentAuthorityBinding",status:$status,
     authorityKind:"DB_PROMOTION",targetCommit:$target,
     attemptId:"ffffffffffffffffffffffffffffffff",
     pendingSha256:"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
     releaseAttemptId:"release-attempt-fixture",appliedMarkerBeforeSha256:null,
     appliedMarkerBeforeStat:null}')"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$destination"
  chmod 0600 "$destination"
}

create_exact_runtime_identity() {
  create_pending_candidate_state
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
    bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
  export BACKSTAGE_DEPLOY_STATE_FILE="$marker"
}

expect_security_failure() {
  local label="$1" status
  set +e
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    resume_pending_backstage_deployment_rollback
  ' _ "$functions" >"$fixture/$label.out" 2>"$fixture/$label.err"
  status=$?
  set -e
  [[ "$status" == 79 ]]
  [[ "$(cat "$mutations")" == 0 ]]
}

# 5-8. Symlink, mode, schema and integrity tampering all fail closed before a
# kubectl patch. Owner and hard-link checks share the same numeric stat gate.
reset_fixture
create_pending_state
mv -- "$pending" "$pending.target"
ln -s "$(basename "$pending.target")" "$pending"
expect_security_failure symlink

reset_fixture
create_pending_state
chmod 0644 "$pending"
expect_security_failure mode

reset_fixture
create_pending_state
schema_payload="$(jq -cS 'del(.integritySha256) | .unexpected = true' "$pending")"
schema_integrity="$(printf '%s' "$schema_payload" | sha256sum | awk '{print $1}')"
jq -cS --arg integrity "$schema_integrity" '. + {integritySha256:$integrity}' \
  <<<"$schema_payload" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
expect_security_failure schema

reset_fixture
create_pending_state
jq -cS '.baseline.spec.replicas = 9' "$pending" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
expect_security_failure tamper

# 9. Official and direct invocations derive the same pending path from the one
# default state directory. The contender fails immediately with status 79,
# performs no kubectl mutation, and cannot alter the holder's pending bytes.
rm -rf -- "$fixture/state"
shared_state="$fixture/shared-default-state"
shared_pending="$shared_state/deployment-rollback.pending.json"
official_path="$fixture/official.path"
direct_path="$fixture/direct.path"
holder_ready="$fixture/holder.ready"
holder_release="$fixture/holder.release"
rm -rf -- "$shared_state"
mkdir -m 0700 "$shared_state"
cp -- "$baseline" "$current"
: >"$calls"
printf '0\n' >"$mutations"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
  ' _ "$functions"
pending_hash_before="$(sha256sum "$shared_pending" | awk '{print $1}')"
calls_before="$(wc -l <"$calls")"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  OFFICIAL_PATH="$official_path" HOLDER_READY="$holder_ready" HOLDER_RELEASE="$holder_release" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    printf "%s\n" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" >"$OFFICIAL_PATH"
    acquire_backstage_deployment_lock
    : >"$HOLDER_READY"
    while [[ ! -e "$HOLDER_RELEASE" ]]; do sleep 0.05; done
  ' _ "$functions" >"$fixture/official-holder.out" 2>"$fixture/official-holder.err" &
holder_pid="$!"
for _ in $(seq 1 500); do
  [[ -e "$holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$holder_ready" ]]
set +e
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" DIRECT_PATH="$direct_path" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    printf "%s\n" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" >"$DIRECT_PATH"
    acquire_backstage_deployment_lock
  ' _ "$functions" >"$fixture/direct-contender.out" 2>"$fixture/direct-contender.err"
status=$?
set -e
[[ "$status" == 79 ]]
[[ "$(cat "$official_path")" == "$shared_pending" ]]
[[ "$(cat "$direct_path")" == "$shared_pending" ]]
[[ "$(sha256sum "$shared_pending" | awk '{print $1}')" == "$pending_hash_before" ]]
[[ "$(wc -l <"$calls")" == "$calls_before" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ "$(find "$shared_state" -mindepth 1 -maxdepth 1 -type f -printf '%f\n')" == "deployment-rollback.pending.json" ]]
grep -Fq 'another Backstage deploy holds the state-directory lock' "$fixture/direct-contender.err"
: >"$holder_release"
wait "$holder_pid"
holder_pid=""

# 10. The production service uses control-group termination. SIGKILL both the
# holder and its recorded build child so every inherited directory FD closes;
# the next contender then acquires, resumes, and proves the exact baseline.
rm -f -- "$holder_ready" "$holder_release"
rm -rf -- "$shared_state"
mkdir -m 0700 "$shared_state"
cp -- "$baseline" "$current"
: >"$calls"
printf '0\n' >"$mutations"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" HOLDER_READY="$holder_ready" \
  HOLDER_CHILD_PID="$fixture/holder-child.pid" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    acquire_backstage_deployment_lock
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    sleep 300 &
    child_pid="$!"
    printf "%s\n" "$child_pid" >"$HOLDER_CHILD_PID"
    : >"$HOLDER_READY"
    wait "$child_pid"
  ' _ "$functions" "$candidate" >"$fixture/killed-holder.out" 2>"$fixture/killed-holder.err" &
holder_pid="$!"
for _ in $(seq 1 500); do
  [[ -e "$holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$holder_ready" && -f "$shared_pending" ]]
holder_child_pid="$(cat "$fixture/holder-child.pid")"
kill -KILL "$holder_pid" "$holder_child_pid"
set +e
{
  wait "$holder_pid"
  status=$?
} 2>>"$fixture/killed-holder.err"
holder_pid=""
set -e
[[ "$status" == 137 ]]
for _ in $(seq 1 500); do
  ! kill -0 "$holder_child_pid" 2>/dev/null && break
  sleep 0.02
done
! kill -0 "$holder_child_pid" 2>/dev/null
rm -f -- "$fixture/holder-child.pid"
env -u BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$shared_state" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    acquire_backstage_deployment_lock
    resume_pending_backstage_deployment_rollback
  ' _ "$functions" >"$fixture/post-kill-contender.out" 2>"$fixture/post-kill-contender.err"
[[ ! -e "$shared_pending" && ! -L "$shared_pending" ]]
[[ "$(cat "$mutations")" == 1 ]]
assert_baseline_restored "$shared_pending"
grep -Fq 'exclusive state-directory deploy lock acquired' "$fixture/post-kill-contender.out"
grep -Fq 'pending Deployment rollback recovery PASS' "$fixture/post-kill-contender.out"

reset_recover_fixture() {
  rm -rf -- "$recover_state"
  mkdir -m 0700 "$recover_state"
  cp -- "$baseline" "$current"
  : >"$calls"
  : >"$FAKE_FORBIDDEN_COMMANDS"
  printf '0\n' >"$mutations"
  unset FAKE_CAS_DRIFT_ON_PATCH
  unset BACKSTAGE_EXPECTED_PENDING_SHA256
  unset BACKSTAGE_RUNTIME_IDENTITY_FILE
}

recover_state="$fixture/recover-state"
recover_pending="$recover_state/deployment-rollback.pending.json"

# 11. The lightweight mode sees a durable pending candidate, acquires the same
# directory lock, restores and proves the baseline, then clears the state.
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
' _ "$functions"
cp -- "$candidate" "$current"
: >"$calls"
printf '0\n' >"$mutations"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-present.out" 2>"$fixture/recover-present.err"
assert_baseline_restored "$recover_pending"
[[ "$(cat "$mutations")" == 1 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
grep -Fq 'BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only' \
  "$fixture/recover-present.out"

# 12. With no pending state the mode is idempotent: two executions perform no
# Kubernetes call, no full prerequisite probe, and no filesystem residue.
reset_recover_fixture
for attempt in 1 2; do
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
  RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" recover-pending >>"$fixture/recover-absent.out" \
    2>>"$fixture/recover-absent.err"
done
[[ ! -e "$recover_pending" && ! -L "$recover_pending" ]]
[[ ! -s "$calls" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
[[ "$(grep -Fc 'BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0' \
  "$fixture/recover-absent.out")" == 2 ]]

# 13. A holder prevents recover-pending from even reading Kubernetes. The
# contender exits 79 while the pending hash and mutation counters remain exact.
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  capture_backstage_deployment_baseline >/dev/null
' _ "$functions"
recover_hash_before="$(sha256sum "$recover_pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
recover_holder_ready="$fixture/recover-holder.ready"
recover_holder_release="$fixture/recover-holder.release"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
HOLDER_READY="$recover_holder_ready" HOLDER_RELEASE="$recover_holder_release" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  : >"$HOLDER_READY"
  while [[ ! -e "$HOLDER_RELEASE" ]]; do sleep 0.05; done
' _ "$functions" >"$fixture/recover-lock-holder.out" 2>"$fixture/recover-lock-holder.err" &
holder_pid="$!"
for _ in $(seq 1 500); do
  [[ -e "$recover_holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$recover_holder_ready" ]]
set +e
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-lock-contender.out" \
  2>"$fixture/recover-lock-contender.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ "$(sha256sum "$recover_pending" | awk '{print $1}')" == "$recover_hash_before" ]]
[[ ! -s "$calls" ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
: >"$recover_holder_release"
wait "$holder_pid"
holder_pid=""

# 14. A control-group SIGKILL leaves the authenticated pending bytes intact.
# After every inherited lock FD closes, recover-pending acquires and resumes it.
rm -f -- "$recover_holder_ready" "$recover_holder_release"
reset_recover_fixture
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
HOLDER_READY="$recover_holder_ready" HOLDER_CHILD_PID="$fixture/recover-holder-child.pid" \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
  sleep 300 &
  child_pid="$!"
  printf "%s\n" "$child_pid" >"$HOLDER_CHILD_PID"
  : >"$HOLDER_READY"
  wait "$child_pid"
' _ "$functions" "$candidate" >"$fixture/recover-killed-holder.out" \
  2>"$fixture/recover-killed-holder.err" &
holder_pid="$!"
for _ in $(seq 1 500); do
  [[ -e "$recover_holder_ready" ]] && break
  sleep 0.02
done
[[ -e "$recover_holder_ready" && -f "$recover_pending" ]]
recover_hash_before="$(sha256sum "$recover_pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
recover_child_pid="$(cat "$fixture/recover-holder-child.pid")"
kill -KILL "$holder_pid" "$recover_child_pid"
set +e
{
  wait "$holder_pid"
  status="$?"
} 2>>"$fixture/recover-killed-holder.err"
holder_pid=""
set -e
[[ "$status" == 137 ]]
for _ in $(seq 1 500); do
  ! kill -0 "$recover_child_pid" 2>/dev/null && break
  sleep 0.02
done
! kill -0 "$recover_child_pid" 2>/dev/null
rm -f -- "$fixture/recover-holder-child.pid"
[[ "$(sha256sum "$recover_pending" | awk '{print $1}')" == "$recover_hash_before" ]]
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$recover_state" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$recover_pending" \
RESONANCE_ROOT="$ROOT" \
bash "$DEPLOY" recover-pending >"$fixture/recover-post-kill.out" \
  2>"$fixture/recover-post-kill.err"
assert_baseline_restored "$recover_pending"
[[ "$(cat "$mutations")" == 1 ]]
[[ ! -s "$FAKE_FORBIDDEN_COMMANDS" ]]
grep -Fq 'BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only' \
  "$fixture/recover-post-kill.out"

# 15-22. Superseded multi-step Deployment intermediates are foreign to the
# durable one-CAS plan. Ordinary failure and SIGKILL recovery both fail closed
# with zero mutation; only the exact planned spec is rollback-authorized.
for mutation_point in manifest_apply set_image configure_auth catalog_digest; do
  intermediate="$fixture/intermediate-$mutation_point.json"
  case "$mutation_point" in
    manifest_apply)
      jq -c '.metadata.resourceVersion="11" | .metadata.generation=5 |
        .spec.template.metadata.labels.release="manifest" |
        .status.observedGeneration=5' "$baseline" >"$intermediate"
      ;;
    set_image)
      jq -c '.metadata.resourceVersion="12" | .metadata.generation=6 |
        (.spec.template.spec.containers[] | select(.name=="backstage") | .image)="registry.local/resonance-backstage@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" |
        .status.observedGeneration=6' "$baseline" >"$intermediate"
      ;;
    configure_auth)
      jq -c '.metadata.resourceVersion="13" | .metadata.generation=7 |
        (.spec.template.spec.containers[] | select(.name=="backstage") | .args)=["node","packages/backend","--config","app-config.yaml"] |
        .status.observedGeneration=7' "$baseline" >"$intermediate"
      ;;
    catalog_digest)
      jq -c '.metadata.resourceVersion="14" | .metadata.generation=8 |
        .spec.template.metadata.annotations["resonance.io/catalog-digest"]="fixture-digest" |
        .status.observedGeneration=8' "$baseline" >"$intermediate"
      ;;
  esac

  reset_fixture
  set +e
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    source "$2"
    cleanup_build_tmp() { :; }
    trap deployment_exit_handler EXIT
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
    exit 47
  ' _ "$functions" "$handler" "$intermediate" \
    >"$fixture/$mutation_point-nonzero.out" 2>"$fixture/$mutation_point-nonzero.err"
  status="$?"
  set -e
  [[ "$status" == 79 ]]
  cmp -s "$intermediate" "$current"
  [[ -f "$pending" ]]
  [[ "$(cat "$mutations")" == 0 ]]
  grep -Fq 'rollback preflight Deployment spec is foreign; mutation=0' "$fixture/$mutation_point-nonzero.err"

  reset_fixture
  set +e
  {
    bash -c '
      set -Eeuo pipefail
      NAMESPACE=resonance-ops
      source "$1"
      capture_backstage_deployment_baseline >/dev/null
      arm_backstage_deployment_mutations >/dev/null
      cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
      kill -KILL $$
    ' _ "$functions" "$intermediate" \
      >"$fixture/$mutation_point-sigkill.out" 2>"$fixture/$mutation_point-sigkill.err"
    status="$?"
  } 2>>"$fixture/$mutation_point-sigkill.err"
  set -e
  [[ "$status" == 137 ]]
  jq -e '.schemaVersion == 4 and .phase == "MUTATION_ARMED"' "$pending" >/dev/null
  set +e
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
    >"$fixture/$mutation_point-resume.out" 2>"$fixture/$mutation_point-resume.err"
  status="$?"
  set -e
  [[ "$status" == 79 ]]
  cmp -s "$intermediate" "$current"
  [[ -f "$pending" ]]
  [[ "$(cat "$mutations")" == 0 ]]
done

# 23. BASELINE_CAPTURED never authorizes an arbitrary live spec; only the
# durable MUTATION_ARMED transition opens the same-UID intermediate window.
reset_fixture
create_pending_state
cp -- "$candidate" "$current"
pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
set +e
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/baseline-foreign.out" 2>"$fixture/baseline-foreign.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]
grep -Fq 'rollback preflight Deployment spec is foreign; mutation=0' "$fixture/baseline-foreign.err"

# 24. Standalone immediate mode remains backward compatible: with both new
# identity variables absent it binds exact source HEAD + APPLIED_MARKER.
env -u BACKSTAGE_DEPLOYMENT_TARGET_COMMIT -u BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND \
  -u BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT -u BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256 \
  -u BACKSTAGE_DEPLOYMENT_ATTEMPT_ID \
  BACKSTAGE_DEPLOYMENT_FINALIZE_MODE=immediate \
  PATH="$fixture/identity-bin:/usr/bin:/bin" \
  FAKE_SELECTED_ROOT="$ROOT" FAKE_SELECTED_HEAD="$target_commit" \
  ROOT="$ROOT" bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    bind_backstage_deployment_identity >/dev/null
    [[ "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" == "$2" ]]
    [[ "$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND" == APPLIED_MARKER ]]
  ' _ "$functions" "$target_commit"

# 25. Deferred success proves the exact candidate but hands the authenticated
# v4 state to the parent without clearing or publishing a marker.
reset_fixture
BACKSTAGE_DEPLOYMENT_FINALIZE_MODE=deferred \
BACKSTAGE_DEPLOYMENT_ATTEMPT_ID=dddddddddddddddddddddddddddddddd bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate >/dev/null
  finalize_successful_backstage_deployment
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/deferred.out" 2>"$fixture/deferred.err"
jq -e --arg target "$target_commit" --arg image "$candidate_image" '
  .schemaVersion == 4 and .phase == "CANDIDATE_READY" and
  .targetCommit == $target and .authorityKind == "DB_PROMOTION" and
  .attemptId == "dddddddddddddddddddddddddddddddd" and
  .finalizeMode == "deferred" and .coordinator == "auto" and
  (.runtimeFingerprint | test("^[0-9a-f]{64}$")) and
  (.deploymentClosureSha256 | test("^[0-9a-f]{64}$")) and
  .candidate.image == $image and (.candidate.spec | type == "object") and
  (.candidate.specSha256 | test("^[0-9a-f]{64}$"))
' "$pending" >/dev/null
[[ ! -e "$marker" && "$(cat "$mutations")" == 0 ]]
grep -Fq 'deferred candidate handed off with authenticated pending state' "$fixture/deferred.out"

# 26. Parent finalization publishes the exact marker atomically before pending
# clear and performs no Deployment mutation.
: >"$calls"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/finalize.out" 2>"$fixture/finalize.err"
[[ ! -e "$pending" && ! -L "$pending" ]]
[[ "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(stat -c '%a:%u:%h' "$marker")" == "644:$(id -u):1" ]]
[[ "$(stat -c '%a:%u:%h' "$identity")" == "600:$(id -u):1" ]]
jq -e --arg target "$target_commit" --arg image "$candidate_image" \
  --arg specSha256 "$candidate_spec_sha256" \
  --arg runtimeFingerprint "$runtime_fingerprint" \
  --arg deploymentClosureSha256 "$deployment_closure_sha256" '
    type == "object" and
    (keys | sort) == ["attemptId","candidateImage","candidateSpecSha256","deploymentClosureSha256","deploymentUid","integritySha256","liveResourceClosureSha256","runtimeDependencies","runtimeDependencyClosureSha256","runtimeFingerprint","schemaVersion","targetCommit"] and
    .schemaVersion == 3 and .targetCommit == $target and
    .attemptId == "dddddddddddddddddddddddddddddddd" and
    .runtimeFingerprint == $runtimeFingerprint and
    .deploymentClosureSha256 == $deploymentClosureSha256 and
    .deploymentUid == "11111111-1111-4111-8111-111111111111" and
    .candidateImage == $image and .candidateSpecSha256 == $specSha256 and
    (.liveResourceClosureSha256 | test("^[0-9a-f]{64}$")) and
    (.runtimeDependencyClosureSha256 | test("^[0-9a-f]{64}$")) and
    (.runtimeDependencies | keys | length) == 11
  ' "$identity" >/dev/null
identity_payload="$(jq -cS 'del(.integritySha256)' "$identity")"
[[ "$(printf '%s' "$identity_payload" | sha256sum | awk '{print $1}')" == \
   "$(jq -r '.integritySha256' "$identity")" ]]
[[ "$(cat "$mutations")" == 0 ]]

# 27-28. A finalize retry with no pending state succeeds only when the durable
# exact marker proves marker-before-clear. Missing marker cannot be mistaken for
# a completed parent handoff.
: >"$calls"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/finalize-retry.out" 2>"$fixture/finalize-retry.err"
[[ "$(grep -Fc -- '-n resonance-ops get deployment resonance-backstage -o json' "$calls")" == 3 ]]
[[ "$(cat "$mutations")" == 0 ]]
rm -f -- "$marker"
: >"$calls"
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/finalize-missing-marker.out" 2>"$fixture/finalize-missing-marker.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ "$(grep -Fc -- '-n resonance-ops get deployment resonance-backstage -o json' "$calls")" == 3 ]]
[[ "$(cat "$mutations")" == 0 ]]

# 29. A SIGKILL after marker publication but before pending clear is replayable:
# an already exact marker is safely republished, then the pending state clears.
reset_fixture
create_pending_candidate_state
printf '%s\n' "$target_commit" >"$marker"
chmod 0644 "$marker"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/marker-replay.out" 2>"$fixture/marker-replay.err"
[[ ! -e "$pending" && "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(cat "$mutations")" == 0 ]]

# 30. Marker publication failure retains byte-identical pending state and the
# exact live candidate; clear is never attempted.
reset_fixture
create_pending_candidate_state
pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
sentinel="$fixture/marker-sentinel"
printf 'sentinel\n' >"$sentinel"
ln -s "$sentinel" "$marker"
: >"$calls"
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/marker-failure.out" 2>"$fixture/marker-failure.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]
[[ "$(cat "$sentinel")" == sentinel && "$(cat "$mutations")" == 0 ]]
grep -Fq 'marker is not a regular non-symlink file' "$fixture/marker-failure.err"
rm -f -- "$marker" "$sentinel"

# 31. Rename success followed by directory-sync failure is already on the
# marker-authoritative side of the boundary and therefore also forbids rollback.
reset_fixture
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" TEST_MARKER_DIR="$marker_dir" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate >/dev/null
  sync() {
    if [[ "$#" == 2 && "$1" == -f && "$2" == "$TEST_MARKER_DIR" ]]; then
      return 1
    fi
    command sync "$@"
  }
  finalize_successful_backstage_deployment
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/marker-post-mv-sync.out" 2>"$fixture/marker-post-mv-sync.err"
status="$?"
set -e
[[ "$status" == 79 ]]
[[ -f "$pending" && "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
[[ "$(cat "$mutations")" == 0 ]]
grep -Fq 'directory sync failed; rollback forbidden' "$fixture/marker-post-mv-sync.err"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/marker-post-mv-sync-retry.out" 2>"$fixture/marker-post-mv-sync-retry.err"
[[ ! -e "$pending" && "$(cat "$mutations")" == 0 ]]

# 32-35. Once the target marker is durable, immediate mode never rolls back.
# Both clear failure and SIGKILL retain the exact candidate + pending state;
# the next startup auto-finalizes that prior attempt before any new mutation.
reset_fixture
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate >/dev/null
  clear_backstage_pending_state() { return 1; }
  finalize_successful_backstage_deployment
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/clear-failure.out" 2>"$fixture/clear-failure.err"
status="$?"
set -e
[[ "$status" == 79 ]]
jq -e '.schemaVersion == 4 and .phase == "CANDIDATE_READY"' "$pending" >/dev/null
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
[[ "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(cat "$mutations")" == 0 ]]
grep -Fq 'rollback forbidden status=79' "$fixture/clear-failure.err"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  resume_or_finalize_pending_backstage_deployment
' _ "$functions" >"$fixture/clear-failure-retry.out" 2>"$fixture/clear-failure-retry.err"
[[ ! -e "$pending" && "$(cat "$mutations")" == 0 ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null

reset_fixture
set +e
{
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    capture_backstage_deployment_candidate >/dev/null
    clear_backstage_pending_state() { kill -KILL $$; }
    finalize_successful_backstage_deployment
  ' _ "$functions" "$candidate" \
    >"$fixture/clear-sigkill.out" 2>"$fixture/clear-sigkill.err"
  status="$?"
} 2>>"$fixture/clear-sigkill.err"
set -e
[[ "$status" == 137 ]]
jq -e '.schemaVersion == 4 and .phase == "CANDIDATE_READY"' "$pending" >/dev/null
[[ "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(cat "$mutations")" == 0 ]]
BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  acquire_backstage_deployment_lock
  resume_or_finalize_pending_backstage_deployment
' _ "$functions" >"$fixture/clear-sigkill-retry.out" 2>"$fixture/clear-sigkill-retry.err"
[[ ! -e "$pending" && "$(cat "$mutations")" == 0 ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null

# 36-37. Reconcile finalizes only an exact authoritative target. A different
# authority rolls back the candidate and never changes an existing marker.
reset_fixture
create_pending_candidate_state
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" reconcile-pending "$target_commit" \
  >"$fixture/reconcile-equal.out" 2>"$fixture/reconcile-equal.err"
[[ ! -e "$pending" && "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(cat "$mutations")" == 0 ]]

reset_fixture
create_pending_candidate_state
printf '%s\n' "$other_commit" >"$marker"
chmod 0644 "$marker"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" reconcile-pending "$other_commit" \
  >"$fixture/reconcile-different.out" 2>"$fixture/reconcile-different.err"
assert_baseline_restored
[[ "$(tr -d '[:space:]' <"$marker")" == "$other_commit" ]]
[[ "$(cat "$mutations")" == 1 ]]

# 38-40. Missing, malformed, and mismatched CLI targets fail with status 79,
# mutation=0, and byte-identical authenticated pending state.
for invalid_case in finalize_missing reconcile_malformed finalize_mismatch; do
  reset_fixture
  create_pending_candidate_state
  pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
  : >"$calls"
  set +e
  case "$invalid_case" in
    finalize_missing)
      RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending \
        >"$fixture/$invalid_case.out" 2>"$fixture/$invalid_case.err"
      ;;
    reconcile_malformed)
      RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending invalid \
        >"$fixture/$invalid_case.out" 2>"$fixture/$invalid_case.err"
      ;;
    finalize_mismatch)
      RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$other_commit" \
        >"$fixture/$invalid_case.out" 2>"$fixture/$invalid_case.err"
      ;;
  esac
  status="$?"
  set -e
  [[ "$status" == 79 ]]
  [[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]
  [[ "$(cat "$mutations")" == 0 ]]
done

# 41-43. Foreign live UID/spec and invalid v2 authority never authorize a
# rollback, finalization, marker write, or any other Deployment mutation.
for foreign_case in uid spec; do
  reset_fixture
  create_pending_candidate_state
  if [[ "$foreign_case" == uid ]]; then
    jq -c '.metadata.uid="22222222-2222-4222-8222-222222222222"' "$current" >"$current.rewrite"
  else
    jq -c '.spec.template.metadata.annotations.foreignWriter="true"' "$current" >"$current.rewrite"
  fi
  mv -f -- "$current.rewrite" "$current"
  pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
  : >"$calls"
  set +e
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending "$other_commit" \
    >"$fixture/foreign-$foreign_case.out" 2>"$fixture/foreign-$foreign_case.err"
  status="$?"
  set -e
  [[ "$status" == 79 ]]
  [[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]
  [[ "$(cat "$mutations")" == 0 ]]
done

reset_fixture
create_pending_candidate_state
invalid_authority_payload="$(jq -cS 'del(.integritySha256) | .authorityKind="FOREIGN"' "$pending")"
invalid_authority_integrity="$(printf '%s' "$invalid_authority_payload" | sha256sum | awk '{print $1}')"
jq -cS --arg integrity "$invalid_authority_integrity" '. + {integritySha256:$integrity}' \
  <<<"$invalid_authority_payload" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
set +e
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/invalid-authority.out" 2>"$fixture/invalid-authority.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]

# 44-47. Legacy v1 lacks a planned/candidate proof. A changed live spec is
# therefore foreign and every recovery/finalization route is mutation0/status79.
reset_fixture
create_legacy_v1_pending_state
cp -- "$candidate" "$current"
legacy_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
set +e
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/legacy-recover.out" 2>"$fixture/legacy-recover.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$legacy_hash_before" ]]

reset_fixture
create_legacy_v1_pending_state
cp -- "$candidate" "$current"
legacy_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
set +e
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/legacy-finalize.out" 2>"$fixture/legacy-finalize.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$legacy_hash_before" ]]
grep -Fq 'legacy pending state cannot be finalized; mutation=0' "$fixture/legacy-finalize.err"

legacy_equal_payload="$(jq -cS --arg target "$target_commit" '
  del(.integritySha256) | .targetCommit=$target
' "$pending")"
legacy_equal_integrity="$(printf '%s' "$legacy_equal_payload" | sha256sum | awk '{print $1}')"
jq -cS --arg integrity "$legacy_equal_integrity" '. + {integritySha256:$integrity}' \
  <<<"$legacy_equal_payload" >"$pending.rewrite"
chmod 0600 "$pending.rewrite"
mv -f -- "$pending.rewrite" "$pending"
legacy_equal_hash="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
set +e
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending "$target_commit" \
  >"$fixture/legacy-equal.out" 2>"$fixture/legacy-equal.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$legacy_equal_hash" ]]

reset_fixture
create_legacy_v1_pending_state
cp -- "$candidate" "$current"
legacy_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" reconcile-pending "$other_commit" \
  >"$fixture/legacy-reconcile.out" 2>"$fixture/legacy-reconcile.err"
status="$?"
set -e
[[ "$status" == 79 && ! -e "$marker" && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$legacy_hash_before" ]]

# 48-53. Parent authority decisions bind to the exact pending bytes observed
# before child invocation. For both recover and reconcile, a pre-lock inode
# replacement, same-inode valid hash change, or replacement during the locked
# hash check fails 79 before any Kubernetes read or Deployment mutation.
for expected_mode in recover reconcile; do
  for toctou_kind in replacement hash inode; do
    reset_fixture
    create_pending_candidate_state
    expected_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
    original_pending_inode="$(stat -c '%d:%i' "$pending")"
    replacement_pending="$fixture/$expected_mode-$toctou_kind-replacement.json"
    create_valid_replacement_pending_state "$replacement_pending"
    replacement_pending_hash="$(sha256sum "$replacement_pending" | awk '{print $1}')"
    case "$toctou_kind" in
      replacement)
        mv -f -- "$replacement_pending" "$pending"
        [[ "$(stat -c '%d:%i' "$pending")" != "$original_pending_inode" ]]
        ;;
      hash)
        cp -- "$replacement_pending" "$pending"
        rm -f -- "$replacement_pending"
        [[ "$(stat -c '%d:%i' "$pending")" == "$original_pending_inode" ]]
        ;;
      inode)
        :
        ;;
    esac
    : >"$calls"
    printf '0\n' >"$mutations"
    set +e
    if [[ "$expected_mode" == recover ]]; then
      if [[ "$toctou_kind" == inode ]]; then
        PATH="$fixture/hash-race-bin:$PATH" \
        FAKE_PENDING_SWAP_DURING_HASH=true \
        FAKE_PENDING_HASH_TARGET="$pending" \
        FAKE_PENDING_REPLACEMENT="$replacement_pending" \
        BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
        RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
          >"$fixture/$expected_mode-$toctou_kind.out" \
          2>"$fixture/$expected_mode-$toctou_kind.err"
      else
        BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
        RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
          >"$fixture/$expected_mode-$toctou_kind.out" \
          2>"$fixture/$expected_mode-$toctou_kind.err"
      fi
    else
      if [[ "$toctou_kind" == inode ]]; then
        PATH="$fixture/hash-race-bin:$PATH" \
        FAKE_PENDING_SWAP_DURING_HASH=true \
        FAKE_PENDING_HASH_TARGET="$pending" \
        FAKE_PENDING_REPLACEMENT="$replacement_pending" \
        BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
        RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending "$target_commit" \
          >"$fixture/$expected_mode-$toctou_kind.out" \
          2>"$fixture/$expected_mode-$toctou_kind.err"
      else
        BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
        RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending "$target_commit" \
          >"$fixture/$expected_mode-$toctou_kind.out" \
          2>"$fixture/$expected_mode-$toctou_kind.err"
      fi
    fi
    status="$?"
    set -e
    [[ "$status" == 79 ]]
    [[ "$(cat "$mutations")" == 0 && ! -s "$calls" ]]
    [[ "$(sha256sum "$pending" | awk '{print $1}')" == "$replacement_pending_hash" ]]
    jq -e --arg target "$other_commit" '
      .schemaVersion == 4 and .targetCommit == $target and
      .authorityKind == "APPLIED_MARKER"
    ' "$pending" >/dev/null
    if [[ "$toctou_kind" == inode ]]; then
      grep -Fq 'inode changed during expected-hash verification; mutation=0' \
        "$fixture/$expected_mode-$toctou_kind.err"
    else
      grep -Fq 'does not match expected SHA-256; mutation=0' \
        "$fixture/$expected_mode-$toctou_kind.err"
    fi
  done
done

# 54-55. A correct expected binding preserves both intended actions: recover
# performs the single baseline CAS, while equal-authority reconcile publishes
# the exact marker and clears without a Deployment mutation.
reset_fixture
create_pending_candidate_state
expected_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/expected-recover-pass.out" 2>"$fixture/expected-recover-pass.err"
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]

reset_fixture
create_pending_candidate_state
expected_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_pending_hash" \
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" reconcile-pending "$target_commit" \
  >"$fixture/expected-reconcile-pass.out" 2>"$fixture/expected-reconcile-pass.err"
[[ ! -e "$pending" && "$(cat "$mutations")" == 0 ]]
[[ "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]

# 56-59. Invalid expected hashes and expected-but-absent state fail under the
# shared lock with status 79 and zero Kubernetes/Deployment mutation.
for expected_mode in recover reconcile; do
  reset_fixture
  create_pending_candidate_state
  pending_hash_before="$(sha256sum "$pending" | awk '{print $1}')"
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  if [[ "$expected_mode" == recover ]]; then
    BACKSTAGE_EXPECTED_PENDING_SHA256=INVALID RESONANCE_ROOT="$ROOT" \
      bash "$DEPLOY" recover-pending \
      >"$fixture/$expected_mode-invalid-expected.out" \
      2>"$fixture/$expected_mode-invalid-expected.err"
  else
    BACKSTAGE_EXPECTED_PENDING_SHA256=INVALID RESONANCE_ROOT="$ROOT" \
      bash "$DEPLOY" reconcile-pending "$target_commit" \
      >"$fixture/$expected_mode-invalid-expected.out" \
      2>"$fixture/$expected_mode-invalid-expected.err"
  fi
  status="$?"
  set -e
  [[ "$status" == 79 && "$(cat "$mutations")" == 0 && ! -s "$calls" ]]
  [[ "$(sha256sum "$pending" | awk '{print $1}')" == "$pending_hash_before" ]]

  reset_fixture
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  if [[ "$expected_mode" == recover ]]; then
    BACKSTAGE_EXPECTED_PENDING_SHA256="$absent_pending_hash" \
      RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
      >"$fixture/$expected_mode-absent-expected.out" \
      2>"$fixture/$expected_mode-absent-expected.err"
  else
    BACKSTAGE_EXPECTED_PENDING_SHA256="$absent_pending_hash" \
      RESONANCE_ROOT="$ROOT" bash "$DEPLOY" reconcile-pending "$target_commit" \
      >"$fixture/$expected_mode-absent-expected.out" \
      2>"$fixture/$expected_mode-absent-expected.err"
  fi
  status="$?"
  set -e
  [[ "$status" == 79 && "$(cat "$mutations")" == 0 && ! -s "$calls" ]]
  [[ ! -e "$pending" && ! -L "$pending" ]]
done

# 60. The read-only verifier accepts only the exact durable identity and exact
# live UID/image/full canonical Deployment spec/readiness without mutation.
reset_fixture
create_exact_runtime_identity
identity_hash_before="$(sha256sum "$identity" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" verify-runtime-identity "$target_commit" \
  >"$fixture/identity-valid.out" 2>"$fixture/identity-valid.err"
[[ "$(grep -Fc -- '-n resonance-ops get deployment resonance-backstage -o json' "$calls")" == 3 ]]
[[ "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$identity" | awk '{print $1}')" == "$identity_hash_before" ]]
grep -Fq 'VERIFY_RUNTIME_IDENTITY_PASS' "$fixture/identity-valid.out"

# 61. An explicit identity path override uses the same strict publication and
# verification contract while leaving the default path absent.
reset_fixture
custom_identity="$fixture/state/custom-runtime-success.identity.json"
create_pending_candidate_state
BACKSTAGE_RUNTIME_IDENTITY_FILE="$custom_identity" BACKSTAGE_DEPLOY_STATE_FILE="$marker" \
  RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/identity-override-finalize.out" 2>"$fixture/identity-override-finalize.err"
[[ -f "$custom_identity" && ! -e "$identity" ]]
[[ "$(stat -c '%a:%u:%h' "$custom_identity")" == "600:$(id -u):1" ]]
: >"$calls"
BACKSTAGE_RUNTIME_IDENTITY_FILE="$custom_identity" BACKSTAGE_DEPLOY_STATE_FILE="$marker" \
  RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" verify-runtime-identity "$target_commit" \
  >"$fixture/identity-override-verify.out" 2>"$fixture/identity-override-verify.err"
[[ "$(cat "$mutations")" == 0 ]]

# 62-64. Integrity tamper, symlink replacement, and mode weakening are unsafe
# status 79 before any Kubernetes read or Deployment mutation.
for identity_security_case in tamper symlink mode; do
  reset_fixture
  create_exact_runtime_identity
  case "$identity_security_case" in
    tamper)
      jq -cS '.candidateSpecSha256="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"' \
        "$identity" >"$identity.rewrite"
      chmod 0600 "$identity.rewrite"
      mv -f -- "$identity.rewrite" "$identity"
      ;;
    symlink)
      mv -- "$identity" "$identity.target"
      ln -s "$(basename "$identity.target")" "$identity"
      ;;
    mode)
      chmod 0644 "$identity"
      ;;
  esac
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" verify-runtime-identity "$target_commit" \
    >"$fixture/identity-$identity_security_case.out" \
    2>"$fixture/identity-$identity_security_case.err"
  status="$?"
  set -e
  [[ "$status" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 ]]
  grep -Fq 'VERIFY_RUNTIME_IDENTITY_UNSAFE' "$fixture/identity-$identity_security_case.err"
done

# 65-67. Same-image mutations to env, volumes, or serviceAccountName all change
# the full canonical .spec hash and therefore return drift=1, mutation=0.
reset_fixture
create_exact_runtime_identity
identity_hash_before="$(sha256sum "$identity" | awk '{print $1}')"
for identity_drift_case in env volume service_account; do
  cp -- "$candidate" "$current"
  case "$identity_drift_case" in
    env)
      jq -c '(.spec.template.spec.containers[] | select(.name=="backstage") | .env) +=
        [{"name":"FOREIGN_ENV","value":"drift"}]' "$current" >"$current.rewrite"
      ;;
    volume)
      jq -c '.spec.template.spec.volumes=[{"name":"foreign-volume","emptyDir":{}}]' \
        "$current" >"$current.rewrite"
      ;;
    service_account)
      jq -c '.spec.template.spec.serviceAccountName="foreign-service-account"' \
        "$current" >"$current.rewrite"
      ;;
  esac
  mv -f -- "$current.rewrite" "$current"
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" verify-runtime-identity "$target_commit" \
    >"$fixture/identity-drift-$identity_drift_case.out" \
    2>"$fixture/identity-drift-$identity_drift_case.err"
  status="$?"
  set -e
  [[ "$status" == 1 && "$(cat "$mutations")" == 0 ]]
  [[ "$(grep -Fc -- '-n resonance-ops get deployment resonance-backstage -o json' "$calls")" == 1 ]]
  [[ "$(sha256sum "$identity" | awk '{print $1}')" == "$identity_hash_before" ]]
  grep -Fq 'VERIFY_RUNTIME_IDENTITY_DRIFT' "$fixture/identity-drift-$identity_drift_case.err"
done

# 68. Once exact candidate proof enters finalization, even an identity temp-file
# failure retains candidate+pending/status79 and forbids automatic rollback.
reset_fixture
set +e
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate >/dev/null
  mktemp() {
    if [[ "$1" == *"/.runtime-success.identity."* ]]; then return 1; fi
    command mktemp "$@"
  }
  finalize_successful_backstage_deployment
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/identity-pre-mv-failure.out" 2>"$fixture/identity-pre-mv-failure.err"
status="$?"
set -e
[[ "$status" == 79 && -f "$pending" && ! -e "$identity" ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
[[ "$(cat "$mutations")" == 0 ]]
grep -Fq 'rollback forbidden status=79' "$fixture/identity-pre-mv-failure.err"
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
[[ ! -e "$pending" && -f "$identity" ]]

# 69. Identity rename is the authority boundary: post-mv directory-sync failure
# retains candidate+pending and is idempotently finalized on retry.
reset_fixture
set +e
TEST_IDENTITY_DIR="$fixture/state" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  capture_backstage_deployment_candidate >/dev/null
  sync() {
    if [[ "$#" == 2 && "$1" == -f && "$2" == "$TEST_IDENTITY_DIR" ]]; then return 1; fi
    command sync "$@"
  }
  finalize_successful_backstage_deployment
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/identity-post-mv-sync.out" 2>"$fixture/identity-post-mv-sync.err"
status="$?"
set -e
[[ "$status" == 79 && -f "$pending" && -f "$identity" ]]
jq -e '.spec.template.metadata.labels.release == "candidate"' "$current" >/dev/null
[[ "$(cat "$mutations")" == 0 ]]
grep -Fq 'runtime identity directory sync failed; rollback forbidden' \
  "$fixture/identity-post-mv-sync.err"
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
[[ ! -e "$pending" && -f "$identity" ]]

# 70-71. SIGKILL between identity and marker leaves the attempt-bound identity
# plus pending intact. Standalone recovery finalizes that same attempt and a
# subsequent finalize retry is idempotent.
reset_fixture
set +e
{
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    capture_backstage_deployment_candidate >/dev/null
    publish_backstage_deploy_marker() { kill -KILL $$; }
    finalize_successful_backstage_deployment
  ' _ "$functions" "$candidate" \
    >"$fixture/identity-before-marker-kill.out" 2>"$fixture/identity-before-marker-kill.err"
  status="$?"
} 2>>"$fixture/identity-before-marker-kill.err"
set -e
[[ "$status" == 137 && -f "$pending" && -f "$identity" && ! -e "$marker" ]]
identity_hash_before="$(sha256sum "$identity" | awk '{print $1}')"
: >"$calls"
printf '0\n' >"$mutations"
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/identity-authority-recover.out" 2>"$fixture/identity-authority-recover.err"
status="$?"
set -e
[[ "$status" == 0 && "$(cat "$mutations")" == 0 ]]
[[ ! -e "$pending" && -f "$marker" && "$(sha256sum "$identity" | awk '{print $1}')" == "$identity_hash_before" ]]
grep -Fq 'BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=standalone-finalize' \
  "$fixture/identity-authority-recover.out"
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
[[ ! -e "$pending" && -f "$identity" && -f "$marker" ]]

# 72. A valid but stale pre-authority identity is removed only after the exact
# baseline has been restored and proved ready.
reset_fixture
create_runtime_identity_from_deployment "$other_commit" "$candidate"
set +e
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 33
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/stale-identity-rollback.out" 2>"$fixture/stale-identity-rollback.err"
status="$?"
set -e
[[ "$status" == 33 ]] || {
  printf '[backstage-rollback-test] case72 unexpected status=%s\n' "$status" >&2
  sed 's/^/[case72] /' "$fixture/stale-identity-rollback.err" >&2
  exit 1
}
assert_baseline_restored
[[ ! -e "$identity" && "$(cat "$mutations")" == 1 ]]
grep -Fq 'stale pre-authority runtime identity removed after exact baseline proof' \
  "$fixture/stale-identity-rollback.out"

# 73. An existing identity that exactly describes the captured baseline is
# preserved byte-for-byte across rollback.
reset_fixture
create_runtime_identity_from_deployment "$other_commit" "$baseline"
baseline_identity_hash="$(sha256sum "$identity" | awk '{print $1}')"
set +e
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 33
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/baseline-identity-rollback.out" 2>"$fixture/baseline-identity-rollback.err"
status="$?"
set -e
[[ "$status" == 33 ]]
assert_baseline_restored
[[ "$(sha256sum "$identity" | awk '{print $1}')" == "$baseline_identity_hash" ]]
[[ "$(cat "$mutations")" == 1 ]]

# 73b. If the exact captured baseline had no deploy marker, its otherwise
# matching pre-authority identity is retired only after the baseline proof.
reset_fixture
create_runtime_identity_from_deployment "$other_commit" "$baseline"
rm -f -- "$marker"
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  source "$2"
  cleanup_build_tmp() { :; }
  trap deployment_exit_handler EXIT
  capture_backstage_deployment_baseline >/dev/null
  arm_backstage_deployment_mutations >/dev/null
  cp -- "$3" "$FAKE_DEPLOYMENT_STATE"
  exit 33
' _ "$functions" "$handler" "$candidate" \
  >"$fixture/marker-absent-baseline-identity.out" \
  2>"$fixture/marker-absent-baseline-identity.err"
status="$?"
set -e
[[ "$status" == 33 ]]
assert_baseline_restored
[[ ! -e "$marker" && ! -e "$identity" && "$(cat "$mutations")" == 1 ]] || {
  printf '[backstage-rollback-test] marker-absent baseline mismatch marker=%s identity=%s mutations=%s\n' \
    "$([[ -e "$marker" ]] && echo present || echo absent)" \
    "$([[ -e "$identity" ]] && echo present || echo absent)" "$(cat "$mutations")" >&2
  exit 1
}
grep -Fq 'marker-absent baseline will retire stale pre-authority runtime identity after exact proof' \
  "$fixture/marker-absent-baseline-identity.out"
grep -Fq 'stale pre-authority runtime identity removed after exact baseline proof' \
  "$fixture/marker-absent-baseline-identity.out"

# 74-78. Every managed kind/object can move to its exact durable target intent
# during MUTATION_ARMED and is restored to its full normalized baseline.
for descriptor in \
  'ConfigMap|resonance-backstage-config' \
  'ConfigMap|resonance-backstage-catalog' \
  'Service|resonance-backstage' \
  'Service|resonance-backstage-catalog' \
  'NetworkPolicy|resonance-backstage-ingress'; do
  IFS='|' read -r managed_kind managed_name <<<"$descriptor"
  reset_fixture
  set_target_intent_variant "$managed_kind" "$managed_name"
  create_armed_pending_state
  set_managed_resource_to_target_intent "$managed_kind" "$managed_name"
  NAMESPACE=resonance-ops bash -c '
    set -Eeuo pipefail
    source "$1"
    resume_pending_backstage_deployment_rollback >/dev/null
  ' _ "$functions"
  assert_managed_resource_payload_baseline "$managed_kind" "$managed_name"
  [[ "$(cat "$resource_mutations")" == 1 && "$(cat "$mutations")" == 0 && ! -e "$pending" ]]
done

# 79. A CANDIDATE_READY managed checkpoint plus the exact planned Deployment
# rolls both planes back to their baseline and clears pending only after proof.
reset_fixture
set_target_intent_variant ConfigMap resonance-backstage-config
create_armed_pending_state
set_managed_resource_to_target_intent ConfigMap resonance-backstage-config
cp -- "$candidate" "$current"
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  capture_backstage_deployment_candidate >/dev/null
  resume_pending_backstage_deployment_rollback >/dev/null
' _ "$functions"
assert_baseline_restored
assert_managed_resource_payload_baseline ConfigMap resonance-backstage-config
[[ "$(cat "$resource_mutations")" == 1 && "$(cat "$mutations")" == 1 ]]

# 80-84. A foreign payload in each managed object fails the all-object
# preflight with zero Deployment/resource mutation.
for descriptor in \
  'ConfigMap|resonance-backstage-config' \
  'ConfigMap|resonance-backstage-catalog' \
  'Service|resonance-backstage' \
  'Service|resonance-backstage-catalog' \
  'NetworkPolicy|resonance-backstage-ingress'; do
  IFS='|' read -r managed_kind managed_name <<<"$descriptor"
  reset_fixture
  create_armed_pending_state
  set_managed_resource_foreign "$managed_kind" "$managed_name"
  aggregate_before="$(sha256sum "$current" "$resource_state_dir"/*)"
  set +e
  NAMESPACE=resonance-ops bash -c '
    set -Eeuo pipefail
    source "$1"
    resume_pending_backstage_deployment_rollback
  ' _ "$functions" >"$fixture/foreign-${managed_kind}-${managed_name}.out" \
    2>"$fixture/foreign-${managed_kind}-${managed_name}.err"
  status="$?"
  set -e
  [[ "$status" == 79 && "$(cat "$resource_mutations")" == 0 && "$(cat "$mutations")" == 0 ]]
  [[ "$aggregate_before" == "$(sha256sum "$current" "$resource_state_dir"/*)" && -f "$pending" ]]
done

# 85. Resource1 exact-target plus resource2 foreign cannot partially restore
# resource1; the two-phase preflight keeps all six objects byte-identical.
reset_fixture
set_target_intent_variant ConfigMap resonance-backstage-config
create_armed_pending_state
set_managed_resource_to_target_intent ConfigMap resonance-backstage-config
set_managed_resource_foreign Service resonance-backstage
cp -- "$candidate" "$current"
aggregate_before="$(sha256sum "$current" "$resource_state_dir"/*)"
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  resume_pending_backstage_deployment_rollback
' _ "$functions" >"$fixture/two-phase-resource-foreign.out" 2>"$fixture/two-phase-resource-foreign.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$resource_mutations")" == 0 && "$(cat "$mutations")" == 0 ]]
[[ "$aggregate_before" == "$(sha256sum "$current" "$resource_state_dir"/*)" ]]

# 86. A foreign Deployment blocks rollback before an otherwise exact target
# managed object can be touched.
reset_fixture
set_target_intent_variant ConfigMap resonance-backstage-config
create_armed_pending_state
set_managed_resource_to_target_intent ConfigMap resonance-backstage-config
jq -c '.metadata.resourceVersion="99" | .spec.template.metadata.labels.foreignWriter="unexpected"' \
  "$candidate" >"$current"
aggregate_before="$(sha256sum "$current" "$resource_state_dir"/*)"
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  resume_pending_backstage_deployment_rollback
' _ "$functions" >"$fixture/two-phase-deployment-foreign.out" 2>"$fixture/two-phase-deployment-foreign.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$resource_mutations")" == 0 && "$(cat "$mutations")" == 0 ]]
[[ "$aggregate_before" == "$(sha256sum "$current" "$resource_state_dir"/*)" ]]

# 87. The actual database role-password function keeps adversarial password
# bytes out of argv, stdout, stderr, and durable paths even when psql emits the
# raw value in its diagnostics. Only the canonical classifier marker escapes.
reset_fixture
db_password=$'db-quote-sentinel\'\ndb-newline-sentinel'
export FAKE_DB_PASSWORD_EXPECTED="$db_password"
export FAKE_DB_SQL_PROOF="$fixture/db-sql-proof"
export FAKE_DB_PSQL_FAIL=true
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  source "$2"
  update_backstage_database_role_password patroni-fixture "" "$3"
' _ "$functions" "$db_password_function" "$db_password" \
  >"$fixture/db-password.out" 2>"$fixture/db-password.err"
status="$?"
set -e
[[ "$status" == 79 && -f "$FAKE_DB_SQL_PROOF" ]]
[[ ! -s "$fixture/db-password.out" ]]
[[ "$(grep -Fxc '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' \
  "$fixture/db-password.err")" == 1 ]]
for fragment in db-quote-sentinel db-newline-sentinel; do
  ! grep -RFq -- "$fragment" "$fixture/db-password.out" \
    "$fixture/db-password.err" "$calls" "$fixture/state"
done
[[ -z "$(find "$fixture/state" -maxdepth 1 -name '.database-role-update.*' -print -quit)" ]]

# 88. An existing role is a strict release-time no-op: credential rotation is
# outside this rollback protocol and must not invoke kubectl/psql.
reset_fixture
unset FAKE_DB_PSQL_FAIL
export FAKE_DB_AUTH_PROOF="$fixture/db-auth-proof"
rm -f -- "$FAKE_DB_AUTH_PROOF"
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  source "$2"
  update_backstage_database_role_password patroni-fixture 1 "$3"
' _ "$functions" "$db_password_function" "$db_password"
[[ -f "$FAKE_DB_AUTH_PROOF" ]]
[[ "$(grep -Fc -- '-U backstage -d postgres' "$calls")" == 0 ]]
[[ "$(grep -Fc -- 'python3 -c' "$calls")" == 1 ]]

# 89. The raw-diagnostic pathname is durably unlinked before psql. If the
# containing-directory fsync cannot be proved, external mutation stays zero.
reset_fixture
export FAKE_DB_PSQL_FAIL=true
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  source "$2"
  sync() { return 1; }
  update_backstage_database_role_password patroni-fixture "" "$3"
' _ "$functions" "$db_password_function" "$db_password" \
  >"$fixture/db-sync-failure.out" 2>"$fixture/db-sync-failure.err"
status="$?"
set -e
[[ "$status" == 79 && ! -s "$calls" ]]
[[ "$(grep -Fxc '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' \
  "$fixture/db-sync-failure.err")" == 1 ]]
[[ -z "$(find "$fixture/state" -maxdepth 1 -name '.database-role-update.*' -print -quit)" ]]

# 90. Existing-role authentication failure is fail-closed and secret-free. It
# never falls back to CREATE/ALTER and cannot publish pending or a marker.
reset_fixture
export FAKE_DB_AUTH_FAIL=true
export FAKE_DB_AUTH_PROOF="$fixture/db-auth-failure-proof"
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  source "$2"
  update_backstage_database_role_password patroni-fixture 1 "$3"
' _ "$functions" "$db_password_function" "$db_password" \
  >"$fixture/db-auth-failure.out" 2>"$fixture/db-auth-failure.err"
status="$?"
set -e
[[ "$status" == 79 && -f "$FAKE_DB_AUTH_PROOF" && ! -e "$pending" && ! -e "$marker" ]]
[[ "$(grep -Fxc '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' \
  "$fixture/db-auth-failure.err")" == 1 ]]
for fragment in db-quote-sentinel db-newline-sentinel; do
  ! grep -Fq -- "$fragment" "$fixture/db-auth-failure.out"
  ! grep -Fq -- "$fragment" "$fixture/db-auth-failure.err"
  ! grep -Fq -- "$fragment" "$calls"
done
! grep -Eq 'create role|alter role' "$calls"

# 91. A valid old five-dependency v3 CANDIDATE_READY pending remains safely
# rollback-recoverable after the v4 reader upgrade.
reset_fixture
create_pending_candidate_state
project_pending_to_legacy_v3
legacy_attempt="$(jq -r '.attemptId' "$pending")"
legacy_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
BACKSTAGE_EXPECTED_PENDING_SHA256="$legacy_pending_hash" \
BACKSTAGE_EXPECTED_ATTEMPT_ID="$legacy_attempt" \
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/legacy-v3-recover.out" 2>"$fixture/legacy-v3-recover.err"
assert_baseline_restored

# 92. The matching old v2 identity can finish its exact v3 attempt. The public
# verifier then reports drift=1 so the next deploy upgrades to v4/v3 evidence.
reset_fixture
create_pending_candidate_state
project_pending_to_legacy_v3
legacy_candidate="$fixture/legacy-candidate.json"
legacy_tagged_image='registry.local/resonance-backstage:legacy-v3'
jq -c --arg image "$legacy_tagged_image" '
  (.spec.template.spec.containers[] | select(.name=="backstage")).image=$image
' "$candidate" >"$legacy_candidate"
legacy_spec="$(jq -cS '.spec' "$legacy_candidate")"
legacy_spec_sha256="$(printf '%s' "$legacy_spec" | sha256sum | awk '{print $1}')"
legacy_payload="$(jq -cS --arg image "$legacy_tagged_image" --argjson spec "$legacy_spec" \
  --arg sha "$legacy_spec_sha256" '
    del(.integritySha256) |
    .candidate.image=$image |
    .candidate.spec=$spec | .candidate.specSha256=$sha |
    .plannedDeployment.spec=$spec | .plannedDeployment.specSha256=$sha
  ' "$pending")"
legacy_integrity="$(printf '%s' "$legacy_payload" | sha256sum | awk '{print $1}')"
jq -cS --arg integrity "$legacy_integrity" '. + {integritySha256:$integrity}' \
  <<<"$legacy_payload" >"$pending"
chmod 0600 "$pending"
cp -- "$legacy_candidate" "$current"
legacy_attempt="$(jq -r '.attemptId' "$pending")"
create_runtime_identity_from_deployment "$target_commit" "$legacy_candidate" "$identity" "$legacy_attempt"
project_identity_to_legacy_v2
legacy_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
BACKSTAGE_EXPECTED_PENDING_SHA256="$legacy_pending_hash" \
BACKSTAGE_EXPECTED_ATTEMPT_ID="$legacy_attempt" BACKSTAGE_DEPLOY_STATE_FILE="$marker" \
RESONANCE_ROOT="$ROOT" bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/legacy-v3-finalize.out" 2>"$fixture/legacy-v3-finalize.err"
[[ ! -e "$pending" && "$(jq -r '.schemaVersion' "$identity")" == 2 ]]
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" verify-runtime-identity "$target_commit" \
  >"$fixture/legacy-v2-verify.out" 2>"$fixture/legacy-v2-verify.err"
status="$?"
set -e
[[ "$status" == 1 ]]

# 93-99. Terminal identity proof rejects independent source-bridge, Backstage
# TLS, preview TLS, Ingress backend, and each required public :32947 endpoint.
reset_fixture
create_pending_candidate_state
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
for serving_case in source-bridge backstage-tls preview-tls ingress-backend \
  public-readiness public-purge public-preview; do
  cp -a -- "$dependency_baseline_dir/." "$dependency_state_dir/"
  unset FAKE_PUBLIC_CURL_FAIL_PATTERN
  expected_public_path=""
  case "$serving_case" in
    source-bridge)
      jq -c '.data.TOKEN="cm90YXRlZA=="' \
        "$dependency_state_dir/Secret_carbonet-prod_resonance-ops-bridge.json" \
        >"$fixture/dependency-mutant.json"
      mv -f "$fixture/dependency-mutant.json" \
        "$dependency_state_dir/Secret_carbonet-prod_resonance-ops-bridge.json"
      ;;
    backstage-tls)
      jq -c '.data["tls.crt"]="cm90YXRlZA=="' \
        "$dependency_state_dir/Secret_resonance-backstage-tls.json" \
        >"$fixture/dependency-mutant.json"
      mv -f "$fixture/dependency-mutant.json" \
        "$dependency_state_dir/Secret_resonance-backstage-tls.json"
      ;;
    preview-tls)
      jq -c '.data["tls.crt"]="cm90YXRlZA=="' \
        "$dependency_state_dir/Secret_carbonet-prod_resonance-preview-tls.json" \
        >"$fixture/dependency-mutant.json"
      mv -f "$fixture/dependency-mutant.json" \
        "$dependency_state_dir/Secret_carbonet-prod_resonance-preview-tls.json"
      ;;
    ingress-backend)
      jq -c '(.items[] | select(.metadata.name=="backstage") |
        .spec.rules[0].http.paths[0].backend.service.name)="foreign-service"' \
        "$dependency_state_dir/IngressList.json" >"$fixture/dependency-mutant.json"
      mv -f "$fixture/dependency-mutant.json" "$dependency_state_dir/IngressList.json"
      ;;
    public-readiness)
      export FAKE_PUBLIC_CURL_FAIL_PATTERN='/.backstage/health/v1/readiness'
      expected_public_path='https://backstage.172.16.1.232.nip.io:32947/.backstage/health/v1/readiness'
      ;;
    public-purge)
      export FAKE_PUBLIC_CURL_FAIL_PATTERN='/api/resonance-projects/health/project-runtime-purge-recovery'
      expected_public_path='https://backstage.172.16.1.232.nip.io:32947/api/resonance-projects/health/project-runtime-purge-recovery'
      ;;
    public-preview)
      export FAKE_PUBLIC_CURL_FAIL_PATTERN='resonance.172.16.1.232.nip.io:32947/signin/loginView'
      expected_public_path='https://resonance.172.16.1.232.nip.io:32947/signin/loginView'
      ;;
  esac
  : >"$calls"
  set +e
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
    bash "$DEPLOY" verify-runtime-identity "$target_commit" \
    >"$fixture/serving-$serving_case.out" 2>"$fixture/serving-$serving_case.err"
  status="$?"
  set -e
  [[ "$status" != 0 && "$(cat "$mutations")" == 0 ]]
  if [[ -n "$expected_public_path" ]]; then
    grep -Fq -- "$expected_public_path" "$calls"
  fi
done

# 100. A foreign Ready Pod imageID blocks candidate finalization before either
# runtime identity or commit marker publication and retains rollback evidence.
reset_fixture
create_pending_candidate_state
export FAKE_POD_IMAGE_ID_OVERRIDE='docker-pullable://registry.local/resonance-backstage@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
set +e
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" \
  >"$fixture/foreign-pod-imageid.out" 2>"$fixture/foreign-pod-imageid.err"
status="$?"
set -e
[[ "$status" == 79 && -f "$pending" && ! -e "$identity" && ! -e "$marker" ]]
[[ "$(cat "$mutations")" == 0 ]]
grep -Fq 'Ready Pod imageID proof failed for immutable candidate image' \
  "$fixture/foreign-pod-imageid.err"
unset FAKE_POD_IMAGE_ID_OVERRIDE

# 101-103. Registry-first reuse works with no pre-existing local image only
# after pull, exact OCI runtime-fingerprint label inspection, immutable digest
# resolution, and (for the same live image) Ready Pod imageID proof.
reset_fixture
cp -- "$candidate" "$current"
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  prepare_backstage_live_baseline_image_resolution
  resolve_verified_backstage_registry_image "$2" "$3"
  [[ "$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE" == "$4" ]]
' _ "$functions" "$tagged_image" "$runtime_fingerprint" "$candidate_image" \
  >"$fixture/registry-reuse.out" 2>"$fixture/registry-reuse.err"
[[ "$(grep -Fxc "pull $tagged_image" "$docker_calls")" == 1 ]]
[[ "$(grep -Fxc "image inspect $tagged_image" "$docker_calls")" == 1 ]]
grep -Fq -- '-n resonance-ops get pods -l app.kubernetes.io/name=resonance-backstage -o json' "$calls"

reset_fixture
jq -cn --arg digest "$candidate_image" '
  [{Config:{Labels:{"io.resonance.backstage.runtime-fingerprint":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}},RepoDigests:[$digest]}]
' >"$image_inspect_json"
set +e
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  prepare_backstage_live_baseline_image_resolution
  resolve_verified_backstage_registry_image "$2" "$3"
' _ "$functions" "$tagged_image" "$runtime_fingerprint" \
  >"$fixture/registry-label-foreign.out" 2>"$fixture/registry-label-foreign.err"
status="$?"
set -e
[[ "$status" != 0 && "$(cat "$mutations")" == 0 ]]

reset_fixture
jq -cn --arg fingerprint "$runtime_fingerprint" --arg digest "$candidate_image" '
  [{Config:{Labels:{"io.resonance.backstage.runtime-fingerprint":$fingerprint}},RepoDigests:[$digest]}]
' >"$image_inspect_json"
cp -- "$candidate" "$current"
export FAKE_POD_IMAGE_ID_OVERRIDE='docker-pullable://registry.local/resonance-backstage@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
set +e
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
bash -c '
  set -Eeuo pipefail
  NAMESPACE=resonance-ops
  source "$1"
  prepare_backstage_live_baseline_image_resolution
  resolve_verified_backstage_registry_image "$2" "$3"
' _ "$functions" "$tagged_image" "$runtime_fingerprint" \
  >"$fixture/registry-pod-foreign.out" 2>"$fixture/registry-pod-foreign.err"
status="$?"
set -e
[[ "$status" != 0 && "$(cat "$mutations")" == 0 ]]
grep -Fq -- '-n resonance-ops get pods -l app.kubernetes.io/name=resonance-backstage -o json' "$calls"
unset FAKE_POD_IMAGE_ID_OVERRIDE

# 104. Any valid parent authority artifact blocks a new/direct writer before
# Kubernetes or pending mutation, regardless of ARMED/AUTHORIZED phase.
reset_fixture
parent_binding="$fixture/state/parent-authority-binding.json"
create_parent_authority_binding "$parent_binding" ARMED
set +e
NAMESPACE=resonance-ops bash -c '
  set -Euo pipefail
  source "$1"
  reject_active_backstage_parent_authority_binding
' _ "$functions" >"$fixture/parent-binding-active.out" 2>"$fixture/parent-binding-active.err"
status="$?"
set -e
[[ "$status" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 && ! -e "$pending" ]]

# 105-108. Malformed, forbidden-status, file-symlink, and ancestor-symlink
# bindings all fail closed with zero mutation.
for binding_case in malformed forbidden-status file-symlink ancestor-symlink; do
  reset_fixture
  parent_binding="$fixture/state/parent-authority-binding.json"
  case "$binding_case" in
    malformed) printf '{}\n' >"$parent_binding"; chmod 0600 "$parent_binding" ;;
    forbidden-status) create_parent_authority_binding "$parent_binding" FINALIZED ;;
    file-symlink)
      printf '{}\n' >"$fixture/foreign-binding.json"
      ln -s "$fixture/foreign-binding.json" "$parent_binding"
      ;;
    ancestor-symlink)
      mkdir -m 0700 "$fixture/ancestor-real"
      mkdir -m 0700 "$fixture/ancestor-real/state"
      ln -s "$fixture/ancestor-real" "$fixture/ancestor-link"
      parent_binding="$fixture/ancestor-real/state/parent-authority-binding.json"
      create_parent_authority_binding "$parent_binding" ARMED
      ;;
  esac
  set +e
  if [[ "$binding_case" == ancestor-symlink ]]; then
    BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$fixture/ancestor-link/state" \
    BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$fixture/ancestor-link/state/deployment-rollback.pending.json" \
    BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$fixture/ancestor-link/state/parent-authority-binding.json" \
    NAMESPACE=resonance-ops bash -c '
      set -Euo pipefail
      source "$1"
      reject_active_backstage_parent_authority_binding
    ' _ "$functions" >"$fixture/binding-$binding_case.out" 2>"$fixture/binding-$binding_case.err"
  else
    NAMESPACE=resonance-ops bash -c '
      set -Euo pipefail
      source "$1"
      reject_active_backstage_parent_authority_binding
    ' _ "$functions" >"$fixture/binding-$binding_case.out" 2>"$fixture/binding-$binding_case.err"
  fi
  status="$?"
  set -e
  [[ "$status" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 && ! -e "$pending" ]]
done

# 109. A genuinely inherited, already-held state-directory FD remains locked
# before, during, and after the verifier child; the child closes only its copy.
reset_fixture
create_pending_candidate_state
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
exec {held_lock_fd}<"$fixture/state"
flock "$held_lock_fd"
! flock -n "$fixture/state" -c ':'
export FAKE_CURL_HOLD_STARTED="$fixture/inherited-curl-started"
BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$held_lock_fd" \
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" verify-runtime-identity "$target_commit" \
  >"$fixture/inherited-verify.out" 2>"$fixture/inherited-verify.err" &
inherited_child_pid="$!"
for _ in $(seq 1 300); do
  [[ -f "$FAKE_CURL_HOLD_STARTED" ]] && break
  sleep 0.02
done
[[ -f "$FAKE_CURL_HOLD_STARTED" ]] || {
  sed 's/^/[inherited-child] /' "$fixture/inherited-verify.err" >&2
  wait "$inherited_child_pid" || true
  exit 1
}
! flock -n "$fixture/state" -c ':'
wait "$inherited_child_pid"
! flock -n "$fixture/state" -c ':'
flock -u "$held_lock_fd"
exec {held_lock_fd}<&-
flock -n "$fixture/state" -c ':'

# 110. Merely passing an unlocked descriptor for the correct directory is not
# inherited-lock authority and fails status79 with mutation0.
reset_fixture
create_pending_candidate_state
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" finalize-pending "$target_commit" >/dev/null
exec {unlocked_fd}<"$fixture/state"
set +e
BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$unlocked_fd" \
BACKSTAGE_DEPLOY_STATE_FILE="$marker" RESONANCE_ROOT="$ROOT" \
  bash "$DEPLOY" verify-runtime-identity "$target_commit" \
  >"$fixture/unlocked-fd.out" 2>"$fixture/unlocked-fd.err"
status="$?"
set -e
exec {unlocked_fd}<&-
[[ "$status" == 79 && "$(cat "$mutations")" == 0 ]]

# 111. Two standalone immediate bindings generate distinct exact 128-bit
# attempt IDs, which in turn produce distinct attempt-scoped staging tags.
standalone_bind_result() {
  env -u BACKSTAGE_DEPLOYMENT_TARGET_COMMIT \
    -u BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND \
    -u BACKSTAGE_DEPLOYMENT_ATTEMPT_ID \
    -u BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT \
    -u BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256 \
    BACKSTAGE_DEPLOYMENT_FINALIZE_MODE=immediate \
    PATH="$fixture/identity-bin:$fixture/bin:/usr/bin:/bin" \
    FAKE_SELECTED_ROOT="$ROOT" FAKE_SELECTED_HEAD="$target_commit" ROOT="$ROOT" \
    bash -c '
      set -Eeuo pipefail
      NAMESPACE=resonance-ops
      source "$1"
      bind_backstage_deployment_identity >/dev/null
      printf "%s|%s:%s-%s\n" \
        "$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID" "$IMAGE_REPOSITORY" \
        "${BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT:0:12}" \
        "$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID"
    ' _ "$functions"
}
IFS='|' read -r standalone_attempt_one standalone_staging_one <<<"$(standalone_bind_result)"
IFS='|' read -r standalone_attempt_two standalone_staging_two <<<"$(standalone_bind_result)"
[[ "$standalone_attempt_one" =~ ^[0-9a-f]{32}$ &&
   "$standalone_attempt_two" =~ ^[0-9a-f]{32}$ &&
   "$standalone_attempt_one" != "$standalone_attempt_two" ]]
[[ "$standalone_staging_one" =~ ^registry\.local/resonance-backstage:[0-9a-f]{12}-[0-9a-f]{32}$ &&
   "$standalone_staging_two" =~ ^registry\.local/resonance-backstage:[0-9a-f]{12}-[0-9a-f]{32}$ &&
   "$standalone_staging_one" != "$standalone_staging_two" ]]

# 112-113. Execute the real pre-baseline build/push branch in isolation for
# both attempts. Only each staging tag is built/pushed; the canonical
# fingerprint tag receives zero writes before the rollback baseline is durable.
staging_flow="$fixture/attempt-scoped-staging-flow.sh"
python3 - "$DEPLOY" "$staging_flow" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
registry = source.index('    if resolve_verified_backstage_registry_image "$tagged_image" "$runtime_fingerprint"; then')
start = source.rindex('    if (( image_reuse_status == 1 )); then', 0, registry)
end_marker = '    BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$image"'
end = source.index(end_marker, start) + len(end_marker)
pathlib.Path(sys.argv[2]).write_text(source[start:end] + "\n", encoding="utf-8")
PY
staging_app="$fixture/staging-app"
mkdir -p "$staging_app"
run_isolated_staging_flow() {
  local attempt_id="$1" flow_calls="$2"
  : >"$flow_calls"
  STAGING_ATTEMPT_ID="$attempt_id" STAGING_FLOW_CALLS="$flow_calls" \
    STAGING_FLOW="$staging_flow" STAGING_APP="$staging_app" \
    STAGING_DIGEST_IMAGE="$candidate_image" STAGING_FINGERPRINT="$runtime_fingerprint" \
    IMAGE_REPOSITORY="$IMAGE_REPOSITORY" bash -c '
      set -Eeuo pipefail
      resolve_verified_backstage_registry_image() { return 1; }
      start_phase() { :; }
      finish_phase() { :; }
      install_backstage_dependencies() { :; }
      run_yarn_script_if_defined() { :; }
      build_backstage_application() { :; }
      verify_backstage_frontend_schema_artifacts() { :; }
      docker() {
        printf "%s\n" "$*" >>"$STAGING_FLOW_CALLS"
        if [[ "$*" == "buildx inspect" ]]; then
          printf "Driver: docker\n"
        fi
      }
      inspect_backstage_image_runtime_binding() {
        [[ "$1" == "$IMAGE_REPOSITORY:${STAGING_FINGERPRINT:0:12}-$STAGING_ATTEMPT_ID" &&
           "$2" == "$STAGING_FINGERPRINT" ]]
        BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$STAGING_DIGEST_IMAGE"
      }
      is_digest_pinned_backstage_candidate_image() {
        [[ "$1" == "$STAGING_DIGEST_IMAGE" ]]
      }
      APP="$STAGING_APP"
      runtime_fingerprint="$STAGING_FINGERPRINT"
      tag="${runtime_fingerprint:0:12}"
      tagged_image="$IMAGE_REPOSITORY:$tag"
      image_reuse_status=1
      BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$STAGING_ATTEMPT_ID"
      BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE=""
      BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
      source "$STAGING_FLOW"
      printf "%s|%s\n" "$BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE" \
        "$BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE"
    '
}
for staging_descriptor in \
  "$standalone_attempt_one|$standalone_staging_one|one" \
  "$standalone_attempt_two|$standalone_staging_two|two"; do
  IFS='|' read -r staging_attempt expected_staging staging_label <<<"$staging_descriptor"
  staging_calls="$fixture/staging-$staging_label.calls"
  staging_result="$(run_isolated_staging_flow "$staging_attempt" "$staging_calls")"
  IFS='|' read -r actual_staging actual_digest \
    <<<"$(tail -n 1 <<<"$staging_result")"
  grep -Fq "attempt-scoped staging image retained for digest availability" \
    <<<"$staging_result"
  [[ "$actual_staging" == "$expected_staging" && "$actual_digest" == "$candidate_image" ]]
  [[ "$(grep -Fxc "push $expected_staging" "$staging_calls")" == 1 ]]
  [[ "$(grep -Fxc "push $tagged_image" "$staging_calls" || true)" == 0 ]]
  grep -Fq -- "-t $expected_staging " "$staging_calls"
  ! grep -Fq -- "-t $tagged_image " "$staging_calls"
done

# Mutable-tag fixtures prove that v4 keeps the exact observed spec separately
# from the immutable digest-pinned rollback spec.
baseline_digest_image="$(jq -er '[.spec.template.spec.containers[] | select(.name=="backstage") | .image] | if length==1 then .[0] else error("image") end' "$baseline")"
mutable_baseline_tag="$IMAGE_REPOSITORY:mutable-baseline"
mutable_baseline="$fixture/mutable-baseline.json"
same_digest_candidate="$fixture/same-digest-candidate.json"
jq -c --arg image "$mutable_baseline_tag" \
  '(.spec.template.spec.containers[] | select(.name=="backstage") | .image)=$image' \
  "$baseline" >"$mutable_baseline"
jq -c --arg image "$baseline_digest_image" \
  '(.spec.template.spec.containers[] | select(.name=="backstage") | .image)=$image' \
  "$candidate" >"$same_digest_candidate"

write_mutable_baseline_inspect_fixture() {
  jq -cn --arg fingerprint "$runtime_fingerprint" --arg digest "$baseline_digest_image" '
    [{Config:{Labels:{"io.resonance.backstage.runtime-fingerprint":$fingerprint}},
      RepoDigests:[$digest]}]
  ' >"$image_inspect_json"
}

create_mutable_tag_candidate_state() {
  local candidate_file="$1" candidate_digest="$2"
  cp -- "$mutable_baseline" "$current"
  write_mutable_baseline_inspect_fixture
  PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
  BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$(openssl rand -hex 16)" \
  BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$candidate_digest" \
  FAKE_PLANNED_DEPLOYMENT_FILE="$candidate_file" \
  FAKE_POD_IMAGE_ID_OVERRIDE="docker-pullable://$baseline_digest_image" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    prepare_backstage_live_baseline_image_resolution
    capture_backstage_deployment_baseline >/dev/null
    arm_backstage_deployment_mutations >/dev/null
    cp -- "$2" "$FAKE_DEPLOYMENT_STATE"
    capture_backstage_deployment_candidate >/dev/null
  ' _ "$functions" "$candidate_file"
}

# 114. The exact v4 loader binds observed baseline, digest rollback spec, and
# the tag-to-digest proof into both their inner hashes and outer integrity.
reset_fixture
create_mutable_tag_candidate_state "$same_digest_candidate" "$baseline_digest_image"
valid_mutable_pending="$fixture/valid-mutable.pending.json"
cp -- "$pending" "$valid_mutable_pending"
mutable_attempt_id="$(jq -r '.attemptId' "$pending")"
expected_hold_tag="$IMAGE_REPOSITORY:rollback-hold-$mutable_attempt_id"
expected_rollback_spec="$(jq -cS --arg image "$baseline_digest_image" \
  '.spec | (.template.spec.containers[] | select(.name=="backstage") | .image)=$image' \
  "$mutable_baseline")"
expected_rollback_sha="$(printf '%s' "$expected_rollback_spec" | sha256sum | awk '{print $1}')"
NAMESPACE=resonance-ops EXPECTED_OBSERVED_TAG="$mutable_baseline_tag" \
EXPECTED_DIGEST_IMAGE="$baseline_digest_image" EXPECTED_HOLD_TAG="$expected_hold_tag" \
EXPECTED_ROLLBACK_SHA="$expected_rollback_sha" \
bash -c '
  set -Eeuo pipefail
  source "$1"
  load_backstage_pending_state
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" == "$EXPECTED_ROLLBACK_SHA" ]]
  [[ "$(jq -r "[.template.spec.containers[] | select(.name==\"backstage\") | .image][0]" \
      <<<"$BACKSTAGE_BASELINE_SPEC")" == "$EXPECTED_OBSERVED_TAG" ]]
  [[ "$(jq -r "[.template.spec.containers[] | select(.name==\"backstage\") | .image][0]" \
      <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" == "$EXPECTED_DIGEST_IMAGE" ]]
  [[ "$(jq -r ".digestImage" <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" == \
      "$EXPECTED_DIGEST_IMAGE" ]]
  [[ "$(jq -r ".holdTag" <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" == \
      "$EXPECTED_HOLD_TAG" ]]
' _ "$functions"
jq -e --arg tag "$mutable_baseline_tag" --arg digest "$baseline_digest_image" \
  --arg hold "$expected_hold_tag" \
  --arg uid '11111111-1111-4111-8111-111111111111' --arg rollbackSha "$expected_rollback_sha" '
  .schemaVersion == 4 and
  .baseline.rollbackSpecSha256 == $rollbackSha and
  .candidate.baselineTagProof == {tag:$tag,digestImage:$digest,holdTag:$hold,deploymentUid:$uid}
' "$pending" >/dev/null
mutable_payload="$(jq -cS 'del(.integritySha256)' "$pending")"
[[ "$(printf '%s' "$mutable_payload" | sha256sum | awk '{print $1}')" == \
   "$(jq -r '.integritySha256' "$pending")" ]]

# 115-116. Recomputed outer integrity cannot hide an altered rollbackSpec hash
# or baselineTagProof. Both fail before a Kubernetes read or mutation.
for v4_tamper_case in rollback-spec-hash baseline-tag-proof; do
  cp -- "$valid_mutable_pending" "$pending"
  case "$v4_tamper_case" in
    rollback-spec-hash)
      tampered_payload="$(jq -cS '
        del(.integritySha256) |
        .baseline.rollbackSpecSha256="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      ' "$pending")"
      ;;
    baseline-tag-proof)
      tampered_payload="$(jq -cS --arg hold "$IMAGE_REPOSITORY:rollback-hold-00000000000000000000000000000000" '
        del(.integritySha256) | .candidate.baselineTagProof.holdTag=$hold
      ' "$pending")"
      ;;
  esac
  tampered_integrity="$(printf '%s' "$tampered_payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$tampered_integrity" '. + {integritySha256:$integrity}' \
    <<<"$tampered_payload" >"$pending.rewrite"
  chmod 0600 "$pending.rewrite"
  mv -f -- "$pending.rewrite" "$pending"
  tampered_hash="$(sha256sum "$pending" | awk '{print $1}')"
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
    >"$fixture/v4-$v4_tamper_case.out" 2>"$fixture/v4-$v4_tamper_case.err"
  status="$?"
  set -e
  [[ "$status" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 ]]
  [[ "$(sha256sum "$pending" | awk '{print $1}')" == "$tampered_hash" ]]
done

# 117. Recovery from the observed mutable tag writes the immutable digest
# rollbackSpec, then proves every Ready Pod imageID resolves to that digest.
cp -- "$valid_mutable_pending" "$pending"
chmod 0600 "$pending"
: >"$calls"
printf '0\n' >"$mutations"
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" recover-pending \
  >"$fixture/mutable-tag-digest-rollback.out" \
  2>"$fixture/mutable-tag-digest-rollback.err"
assert_baseline_restored
[[ "$(cat "$mutations")" == 1 ]]
[[ "$(jq -r '[.spec.template.spec.containers[] | select(.name=="backstage") | .image][0]' \
  "$current")" == "$baseline_digest_image" ]]
grep -Fq -- '-n resonance-ops get pods -l app.kubernetes.io/name=resonance-backstage -o json' "$calls"
grep -Fq 'Ready Pod imageID proof PASS' "$fixture/mutable-tag-digest-rollback.out"

run_inherited_pending_verifier() {
  local label="$1" expected_sha="$2" expected_attempt="$3" require_proof="$4"
  exec {pending_verify_fd}<"$fixture/state"
  flock "$pending_verify_fd"
  : >"$calls"
  printf '0\n' >"$mutations"
  set +e
  BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$pending_verify_fd" \
  BACKSTAGE_EXPECTED_PENDING_SHA256="$expected_sha" \
  BACKSTAGE_EXPECTED_ATTEMPT_ID="$expected_attempt" \
  BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF="$require_proof" \
  RESONANCE_ROOT="$ROOT" bash "$DEPLOY" verify-pending-candidate "$target_commit" \
    >"$fixture/$label.out" 2>"$fixture/$label.err"
  VERIFY_PENDING_STATUS="$?"
  set -e
  flock -u "$pending_verify_fd"
  exec {pending_verify_fd}<&-
}

# 118. An inherited already-held FD plus exact pending SHA/attempt accepts the
# same-digest mutable-tag proof without mutation.
reset_fixture
create_mutable_tag_candidate_state "$same_digest_candidate" "$baseline_digest_image"
verify_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
verify_pending_attempt="$(jq -r '.attemptId' "$pending")"
run_inherited_pending_verifier verify-pending-exact \
  "$verify_pending_hash" "$verify_pending_attempt" true
[[ "$VERIFY_PENDING_STATUS" == 0 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$verify_pending_hash" ]]
grep -Fq "VERIFY_PENDING_CANDIDATE_PASS target=$target_commit attempt=$verify_pending_attempt" \
  "$fixture/verify-pending-exact.out"
grep -Fq 'baselineTagDigestProof=1 mutation=0' "$fixture/verify-pending-exact.out"

# 119. A valid digest-baseline v4 candidate has no tag proof; requiring one is
# fail-closed after proof with pending bytes and Deployment unchanged.
reset_fixture
create_pending_candidate_state
verify_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
verify_pending_attempt="$(jq -r '.attemptId' "$pending")"
run_inherited_pending_verifier verify-pending-missing-proof \
  "$verify_pending_hash" "$verify_pending_attempt" true
[[ "$VERIFY_PENDING_STATUS" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$verify_pending_hash" ]]
grep -Fq 'pending candidate lacks required baseline tag-to-digest proof; mutation=0' \
  "$fixture/verify-pending-missing-proof.err"

# 120. A structurally valid tag proof for a different digest cannot satisfy the
# candidate-digest selector, even though both pending and live candidate prove.
reset_fixture
create_mutable_tag_candidate_state "$candidate" "$candidate_image"
verify_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
verify_pending_attempt="$(jq -r '.attemptId' "$pending")"
run_inherited_pending_verifier verify-pending-mismatched-proof \
  "$verify_pending_hash" "$verify_pending_attempt" true
[[ "$VERIFY_PENDING_STATUS" == 79 && "$(cat "$mutations")" == 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$verify_pending_hash" ]]
grep -Fq 'pending candidate lacks required baseline tag-to-digest proof; mutation=0' \
  "$fixture/verify-pending-mismatched-proof.err"

# 121-122. The inherited verifier also rejects either a foreign pending hash or
# a foreign attempt before any Kubernetes read or mutation.
foreign_pending_hash='ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
[[ "$foreign_pending_hash" != "$verify_pending_hash" ]]
run_inherited_pending_verifier verify-pending-foreign-sha \
  "$foreign_pending_hash" "$verify_pending_attempt" true
[[ "$VERIFY_PENDING_STATUS" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 ]]
foreign_pending_attempt='00000000000000000000000000000000'
[[ "$foreign_pending_attempt" != "$verify_pending_attempt" ]]
run_inherited_pending_verifier verify-pending-foreign-attempt \
  "$verify_pending_hash" "$foreign_pending_attempt" true
[[ "$VERIFY_PENDING_STATUS" == 79 && ! -s "$calls" && "$(cat "$mutations")" == 0 ]]

# 123. Failure to create the attempt-scoped rollback hold is fail-closed before
# durable state or Kubernetes mutation, and never writes the mutable live tag.
reset_fixture
cp -- "$mutable_baseline" "$current"
write_mutable_baseline_inspect_fixture
hold_failure_attempt='1234567890abcdef1234567890abcdef'
hold_failure_tag="$IMAGE_REPOSITORY:rollback-hold-$hold_failure_attempt"
set +e
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
  BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$hold_failure_attempt" \
  FAKE_POD_IMAGE_ID_OVERRIDE="docker-pullable://$baseline_digest_image" \
  FAKE_DOCKER_TAG_FAIL=true \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    prepare_backstage_live_baseline_image_resolution || exit "$?"
  ' _ "$functions" >"$fixture/hold-creation-failure.out" \
    2>"$fixture/hold-creation-failure.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 &&
   "$(cat "$resource_mutations")" == 0 && ! -e "$pending" ]]
grep -Fqx "tag $baseline_digest_image $hold_failure_tag" "$docker_calls"
[[ "$(grep -Fxc "push $mutable_baseline_tag" "$docker_calls" || true)" == 0 ]]
grep -Fq 'baseline rollback hold tag creation failed; mutation=0' \
  "$fixture/hold-creation-failure.err"

# 124. If the mutable tag swaps after its hold was published but before
# baseline capture, the real reproof path rejects it with pending=0 and
# Kubernetes mutation=0. The canonical mutable tag still receives no push.
reset_fixture
cp -- "$mutable_baseline" "$current"
write_mutable_baseline_inspect_fixture
swapped_baseline_digest_image="$IMAGE_REPOSITORY@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
swapped_image_inspect_json="$fixture/swapped-image-inspect.json"
jq -cn --arg fingerprint "$runtime_fingerprint" --arg digest "$swapped_baseline_digest_image" '
  [{Config:{Labels:{"io.resonance.backstage.runtime-fingerprint":$fingerprint}},
    RepoDigests:[$digest]}]
' >"$swapped_image_inspect_json"
tag_swap_attempt='fedcba0987654321fedcba0987654321'
tag_swap_hold="$IMAGE_REPOSITORY:rollback-hold-$tag_swap_attempt"
set +e
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
  BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$tag_swap_attempt" \
  BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$candidate_image" \
  FAKE_POD_IMAGE_ID_OVERRIDE="docker-pullable://$baseline_digest_image" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    reprove_backstage_live_baseline_image_resolution_before_capture() {
      _fixture_real_reprove_backstage_live_baseline_image_resolution_before_capture "$@"
    }
    prepare_backstage_live_baseline_image_resolution
    cp -- "$2" "$FAKE_IMAGE_INSPECT_JSON"
    capture_backstage_deployment_baseline >/dev/null
  ' _ "$functions" "$swapped_image_inspect_json" \
    >"$fixture/tag-swap-before-capture.out" 2>"$fixture/tag-swap-before-capture.err"
status="$?"
set -e
[[ "$status" == 79 && "$(cat "$mutations")" == 0 &&
   "$(cat "$resource_mutations")" == 0 && ! -e "$pending" ]]
[[ "$(grep -Fxc "push $tag_swap_hold" "$docker_calls")" == 1 ]]
[[ "$(grep -Fxc "push $mutable_baseline_tag" "$docker_calls" || true)" == 0 ]]
grep -Fq 'live mutable baseline tag digest changed before durable capture; mutation=0' \
  "$fixture/tag-swap-before-capture.err"

# 125. A first-migration legacy v2 identity can describe a mutable tag whose
# held digest has no OCI fingerprint label. Exact rollback retires that stale
# identity after marker/resources/dependencies/Pod proof; it never publishes a
# schema-v3 digest identity over unauthenticated bytes.
reset_fixture
create_mutable_tag_candidate_state "$candidate" "$candidate_image"
create_runtime_identity_from_deployment "$target_commit" "$mutable_baseline"
project_identity_to_legacy_v2
mkdir -p "$(dirname "$marker")"
printf '%s\n' "$target_commit" >"$marker"
chmod 0644 "$marker"
label_less_inspect_json="$fixture/label-less-baseline-inspect.json"
jq -cn --arg digest "$baseline_digest_image" \
  '[{Config:{Labels:{}},RepoDigests:[$digest]}]' >"$label_less_inspect_json"
cp -- "$label_less_inspect_json" "$image_inspect_json"
label_less_identity_hash="$(sha256sum "$identity" | awk '{print $1}')"
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" \
  BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
  FAKE_POD_IMAGE_ID_OVERRIDE="docker-pullable://$baseline_digest_image" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    calculate_target_backstage_runtime_fingerprint() {
      printf "%s" "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT"
    }
    calculate_target_backstage_deployment_closure() {
      printf "%s" "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256"
    }
    rollback_pending_backstage_deployment
  ' _ "$functions" >"$fixture/label-less-rollback.out" \
    2>"$fixture/label-less-rollback.err"
[[ ! -e "$pending" && ! -e "$identity" && -f "$marker" ]]
[[ "$(tr -d '[:space:]' <"$marker")" == "$target_commit" ]]
[[ "$(cat "$mutations")" == 1 ]]
[[ "$(jq -r '[.spec.template.spec.containers[] | select(.name=="backstage") | .image][0]' \
  "$current")" == "$baseline_digest_image" ]]
grep -Fq 'label-less legacy rollback identity will be securely retired' \
  "$fixture/label-less-rollback.out"
grep -Fq 'stale pre-authority runtime identity removed after exact baseline proof' \
  "$fixture/label-less-rollback.out"
[[ -n "$label_less_identity_hash" ]]

# 126. Runtime dependency drift after the pending snapshot cannot be blessed by
# rollback identity normalization. The exact Deployment baseline may be
# restored, but identity bytes and authenticated pending state remain intact.
reset_fixture
create_mutable_tag_candidate_state "$candidate" "$candidate_image"
create_runtime_identity_from_deployment "$target_commit" "$mutable_baseline"
project_identity_to_legacy_v2
printf '%s\n' "$target_commit" >"$marker"
chmod 0644 "$marker"
write_mutable_baseline_inspect_fixture
dependency_drift_json="$fixture/runtime-dependencies.drift.json"
jq -cS '."Secret/resonance-backstage-auth".contentSha256 =
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"' \
  "$runtime_dependencies" >"$dependency_drift_json"
dependency_drift_identity_hash="$(sha256sum "$identity" | awk '{print $1}')"
dependency_drift_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
set +e
PATH="$fixture/image-bin:$fixture/bin:/usr/bin:/bin" \
  BACKSTAGE_DEPLOY_STATE_FILE="$marker" \
  BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=1 \
  FAKE_RUNTIME_DEPENDENCIES="$dependency_drift_json" \
  FAKE_POD_IMAGE_ID_OVERRIDE="docker-pullable://$baseline_digest_image" \
  bash -c '
    set -Eeuo pipefail
    NAMESPACE=resonance-ops
    source "$1"
    calculate_target_backstage_runtime_fingerprint() {
      printf "%s" "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT"
    }
    calculate_target_backstage_deployment_closure() {
      printf "%s" "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256"
    }
    rollback_pending_backstage_deployment
  ' _ "$functions" >"$fixture/dependency-drift-normalization.out" \
    2>"$fixture/dependency-drift-normalization.err"
status="$?"
set -e
[[ "$status" != 0 && -f "$pending" && -f "$identity" ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$dependency_drift_pending_hash" ]]
[[ "$(sha256sum "$identity" | awk '{print $1}')" == "$dependency_drift_identity_hash" ]]
[[ "$(cat "$mutations")" == 1 ]]
grep -Fq 'rollback runtime dependencies differ from pre-attempt snapshot; mutation=0' \
  "$fixture/dependency-drift-normalization.err"

# 127. The production checkpoint function must derive its key from arguments,
# not accidentally inherited globals. The actual extracted function succeeds
# with both globals unset; a dynamic mutant that restores the old one-command
# local declaration must die under set -u before publishing candidate state.
checkpoint_scope_mutant="$fixture/checkpoint-scope-mutant.sh"
python3 - "$functions" "$checkpoint_scope_mutant" <<'PY'
import pathlib
import sys

source_path = pathlib.Path(sys.argv[1])
mutant_path = pathlib.Path(sys.argv[2])
source = source_path.read_text(encoding="utf-8")
fixed = '''checkpoint_backstage_managed_resource_candidate() {
  local kind="$1" name="$2"
  local key="$kind/$name" snapshot expected expected_payload snapshot_payload state_payload'''
mutant = '''checkpoint_backstage_managed_resource_candidate() {
  local kind="$1" name="$2" key="$kind/$name" snapshot expected expected_payload snapshot_payload state_payload'''
if source.count(fixed) != 1:
    raise SystemExit("checkpoint scope fix is not present exactly once in extracted production functions")
mutant_path.write_text(source.replace(fixed, mutant, 1), encoding="utf-8")
PY

reset_fixture
create_armed_pending_state
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  unset kind name
  checkpoint_backstage_managed_resource_candidate ConfigMap resonance-backstage-config
' _ "$functions" >"$fixture/checkpoint-scope-fixed.out" \
  2>"$fixture/checkpoint-scope-fixed.err"
jq -e '.phase == "MUTATION_ARMED" and
  (.candidate.resources["ConfigMap/resonance-backstage-config"].exists == true)' \
  "$pending" >/dev/null
grep -Fq 'managed resource candidate checkpointed key=ConfigMap/resonance-backstage-config' \
  "$fixture/checkpoint-scope-fixed.out"

reset_fixture
create_armed_pending_state
checkpoint_scope_pending_hash="$(sha256sum "$pending" | awk '{print $1}')"
set +e
NAMESPACE=resonance-ops bash -c '
  set -Eeuo pipefail
  source "$1"
  unset kind name
  checkpoint_backstage_managed_resource_candidate ConfigMap resonance-backstage-config
' _ "$checkpoint_scope_mutant" >"$fixture/checkpoint-scope-mutant.out" \
  2>"$fixture/checkpoint-scope-mutant.err"
status="$?"
set -e
[[ "$status" != 0 ]]
[[ "$(sha256sum "$pending" | awk '{print $1}')" == "$checkpoint_scope_pending_hash" ]]
grep -Eq 'kind: unbound variable' "$fixture/checkpoint-scope-mutant.err"

if grep -R -Fq -- "$secret_value" \
    "$fixture"/*.out "$fixture"/*.err "$fixture/state" 2>/dev/null; then
  echo '[backstage-rollback-test] secret value leaked into state or logs' >&2
  exit 1
fi

echo 'BACKSTAGE_DEPLOYMENT_ROLLBACK_PASS cases=128 failureStatus=37 rollbackFailure=79 sigkillResume=9 mutationPointMutants=8 casMutation=0 successPending=0 securityFailClosed=4 contentionStatus=79 contentionMutation=0 officialDirectShared=1 controlGroupKill=2 recoverPresent=1 recoverAbsent=2 deferredHandoff=1 markerThenClear=7 finalizeRetry=7 postMvSyncNoRollback=2 clearFailureNoRollback=1 clearSigkillNoRollback=1 missingMarkerStatus=79 markerFailureRetained=1 reconcileFinalize=1 reconcileRollback=2 invalidCliMutation0=3 foreignMutation0=3 legacyRecover=3 legacyFinalize=1 legacyFinalizeMutation0=2 standaloneImmediate=1 standaloneAttemptUnique=2 stagingPush=2 canonicalPush0=2 expectedBindingPass=2 expectedReplacementMutation0=2 expectedHashMutation0=2 expectedInodeRaceMutation0=2 expectedInvalidMutation0=2 expectedAbsentMutation0=2 identityPublish=2 identityVerifyExact=2 identityUnsafe=3 fullSpecDrift=3 identityPublicationCuts=3 identityAuthorityNoRollback=1 staleIdentityRemoved=3 baselineIdentityPreserved=1 markerAbsentBaselineRetired=1 managedExactRollback=5 managedCandidateRollback=1 managedForeignMutation0=5 aggregatePreflightMutation0=2 databasePasswordSecret0=4 servingDrift=7 readyPodImageIdDrift=1 registryReuse=1 registryReject=2 parentAuthorityBlock=5 inheritedLock=2 v4BaselineProof=1 v4TamperMutation0=2 mutableTagDigestRollback=1 verifyPendingExact=1 verifyPendingProofReject=2 verifyPendingBindingReject=2 holdCreationFailureMutation0=1 tagSwapBeforeCaptureMutation0=1 rollbackIdentityLabelLessRetired=1 rollbackDependencyDriftRetained=1 checkpointScopeFixed=1 checkpointScopeMutantKilled=1 secretValues=0'

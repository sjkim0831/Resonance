#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JOB_SCRIPT="$ROOT/ops/scripts/run-flyway-migration-job.sh"
DEPLOY_SCRIPT="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
KUBEADM_SCRIPT="$ROOT/ops/scripts/deploy-carbonet-kubeadm-k8s.sh"
STATIC_DEPLOY_SCRIPT="$ROOT/deploy/deploy-resonance-k8s.sh"
DESKTOP_GATE_SCRIPT="$ROOT/ops/scripts/prepare-docker-desktop-k8s-gate.sh"

bash -n "$JOB_SCRIPT"
bash -n "$DEPLOY_SCRIPT"
bash -n "$KUBEADM_SCRIPT"
bash -n "$STATIC_DEPLOY_SCRIPT"
bash -n "$DESKTOP_GATE_SCRIPT"

python3 - "$ROOT" <<'PY'
import pathlib
import sys

import yaml

root = pathlib.Path(sys.argv[1])
expected = {
    "name": "SPRING_FLYWAY_PASSWORD",
    "valueFrom": {
        "secretKeyRef": {
            "name": "carbonet-migration-secret",
            "key": "SPRING_FLYWAY_PASSWORD",
        }
    },
}
for relative in (
    "deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml",
    "deploy/k8s/projects/carbonet/carbonet-runtime-review.deployment.yaml",
):
    documents = list(yaml.safe_load_all((root / relative).read_text(encoding="utf-8")))
    deployment = next(document for document in documents if document["kind"] == "Deployment")
    container = deployment["spec"]["template"]["spec"]["containers"][0]
    entries = [entry for entry in container.get("env", []) if entry.get("name") == "SPRING_FLYWAY_PASSWORD"]
    if entries != [expected]:
        raise SystemExit(f"{relative}: expected one exact migration SecretKeyRef")

kubeadm = (root / "ops/scripts/deploy-carbonet-kubeadm-k8s.sh").read_text(encoding="utf-8")
for needle in (
    "ensure_migration_secret",
    "name: ${MIGRATION_SECRET_NAME}",
    "key: ${MIGRATION_PASSWORD_KEY}",
    '--from-file="$MIGRATION_PASSWORD_KEY=/dev/stdin"',
):
    if needle not in kubeadm:
        raise SystemExit(f"kubeadm contract missing: {needle}")

deploy = (root / "ops/scripts/resonance-k8s-build-deploy-80-v2.sh").read_text(encoding="utf-8")
candidate_patch = next(
    line for line in deploy.splitlines()
    if 'CARBONET_TEST_ACCOUNT_SWITCH_ENABLED' in line and 'SPRING_FLYWAY_PASSWORD' in line
)
for needle in (
    '\\"name\\":\\"SPRING_FLYWAY_PASSWORD\\"',
    '\\"value\\":null',
    '\\"name\\":\\"$MIGRATION_SECRET_NAME\\"',
    '\\"key\\":\\"$MIGRATION_PASSWORD_KEY\\"',
):
    if needle not in candidate_patch:
        raise SystemExit(f"candidate rollout patch missing: {needle}")
if '.data[$key] | type == "string" and length > 0' not in deploy:
    raise SystemExit("candidate rollout must reject a missing or empty migration Secret key")

static_deploy = (root / "deploy/deploy-resonance-k8s.sh").read_text(encoding="utf-8")
desktop_gate = (root / "ops/scripts/prepare-docker-desktop-k8s-gate.sh").read_text(encoding="utf-8")
for name, source in (
    ("kubeadm", kubeadm),
    ("static deploy", static_deploy),
    ("desktop gate", desktop_gate),
):
    for needle in ("base64.b64decode(encoded, validate=True)", "decoded else 1"):
        if needle not in source:
            raise SystemExit(f"{name} lacks decoded-nonempty validation: {needle}")
if static_deploy.index("\n    ensure_migration_secret\n") > static_deploy.index(
    'kubectl apply -f "${DEPLOY_DIR}/projects/carbonet/carbonet-runtime.deployment.yaml"'
):
    raise SystemExit("static deploy must ensure the migration Secret before applying the runtime")
if '--from-literal=' in desktop_gate:
    raise SystemExit("desktop Secret values must not be passed in argv")
for needle in (
    '--from-env-file=/dev/stdin',
    '--from-file="$MIGRATION_PASSWORD_KEY=/dev/stdin"',
    "MIGRATION_SECRET_OK",
):
    if needle not in desktop_gate:
        raise SystemExit(f"desktop gate contract missing: {needle}")
PY

tmp="$(mktemp -d)"
mutation_namespace="${CARBONET_SECRET_REF_MUTATION_NAMESPACE:-}"
cleanup() {
  rm -rf "$tmp"
  if [[ -n "$mutation_namespace" ]]; then
    kubectl -n "$mutation_namespace" delete secret carbonet-migration-secret \
      --ignore-not-found=true --wait=false >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
mkdir -p "$tmp/bin" "$tmp/captures" "$tmp/logs"

cat >"$tmp/deployment.json" <<'JSON'
{
  "apiVersion": "apps/v1",
  "kind": "Deployment",
  "metadata": {"name": "carbonet-runtime"},
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "carbonet-runtime",
          "image": "old-image",
          "env": [
            {"name": "SPRING_FLYWAY_PASSWORD", "value": "fixture-literal-must-not-survive"},
            {"name": "CARBONET_FLYWAY_ENABLED", "value": "false"},
            {"name": "CARBONET_LIQUIBASE_ENABLED", "value": "true"}
          ],
          "envFrom": [{"secretRef": {"name": "carbonet-runtime-secret"}}]
        }]
      }
    }
  }
}
JSON

cat >"$tmp/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
joined=" $* "
if [[ "$joined" == *" get deployment "* ]]; then
  cat "$MOCK_DEPLOYMENT"
  exit 0
fi
if [[ "$joined" == *" get secret "* ]]; then
  if [[ "${MOCK_SECRET_PRESENT:-true}" == "true" ]]; then
    printf '%s\n' '{"data":{"SPRING_FLYWAY_PASSWORD":"Zml4dHVyZQ=="}}'
  else
    printf '%s\n' '{"data":{}}'
  fi
  exit 0
fi
if [[ "$joined" == *" apply "* ]]; then
  mode="unknown"
  file=""
  while (($#)); do
    case "$1" in
      --dry-run=*) mode="${1#--dry-run=}" ;;
      -f) shift; file="$1" ;;
    esac
    shift
  done
  [[ -n "$file" ]]
  cp "$file" "$MOCK_CAPTURE_DIR/$mode.json"
  exit 0
fi
if [[ "$joined" == *" delete job "* ]]; then
  exit 0
fi
printf 'unexpected kubectl invocation\n' >&2
exit 90
SH
chmod +x "$tmp/bin/kubectl"

for mode in client server; do
  PATH="$tmp/bin:$PATH" \
  MOCK_DEPLOYMENT="$tmp/deployment.json" \
  MOCK_CAPTURE_DIR="$tmp/captures" \
  MOCK_SECRET_PRESENT=true \
  CARBONET_FLYWAY_LOG_DIR="$tmp/logs" \
  CARBONET_FLYWAY_JOB_DRY_RUN="$mode" \
    bash "$JOB_SCRIPT" 'localhost:5000/carbonet-runtime:test' >/dev/null
done

if PATH="$tmp/bin:$PATH" \
  MOCK_DEPLOYMENT="$tmp/deployment.json" \
  MOCK_CAPTURE_DIR="$tmp/captures" \
  MOCK_SECRET_PRESENT=false \
  CARBONET_FLYWAY_LOG_DIR="$tmp/logs" \
  CARBONET_FLYWAY_JOB_DRY_RUN=server \
    bash "$JOB_SCRIPT" 'localhost:5000/carbonet-runtime:test' >/dev/null 2>&1; then
  echo "server dry-run accepted a missing migration Secret key" >&2
  exit 1
fi

python3 - "$tmp/captures/client.json" "$tmp/captures/server.json" <<'PY'
import json
import sys

expected = {
    "name": "SPRING_FLYWAY_PASSWORD",
    "valueFrom": {
        "secretKeyRef": {
            "name": "carbonet-migration-secret",
            "key": "SPRING_FLYWAY_PASSWORD",
        }
    },
}
for path in sys.argv[1:]:
    manifest = json.load(open(path, encoding="utf-8"))
    container = manifest["spec"]["template"]["spec"]["containers"][0]
    entries = [entry for entry in container["env"] if entry.get("name") == "SPRING_FLYWAY_PASSWORD"]
    if entries != [expected]:
        raise SystemExit(f"{path}: literal survived or SecretKeyRef drifted")
    if "fixture-literal-must-not-survive" in json.dumps(manifest):
        raise SystemExit(f"{path}: fixture literal leaked into Job manifest")
PY

actual_dry_runs=0
mutation_checks=0
integration_namespace="${CARBONET_SECRET_REF_TEST_NAMESPACE:-carbonet-prod}"
if command -v kubectl >/dev/null 2>&1 \
    && kubectl get namespace "$integration_namespace" >/dev/null 2>&1; then
  dry_run_secret="migration-secret-contract-$PPID-$$"
  for mode in client server; do
    printf 'fixture-not-a-secret' |
      kubectl -n "$integration_namespace" create secret generic "$dry_run_secret" \
        --from-file=SPRING_FLYWAY_PASSWORD=/dev/stdin \
        --dry-run="$mode" -o json |
      python3 -c '
import base64
import json
import sys

encoded = json.load(sys.stdin).get("data", {}).get("SPRING_FLYWAY_PASSWORD")
decoded = base64.b64decode(encoded, validate=True) if isinstance(encoded, str) else b""
raise SystemExit(0 if decoded else 1)
' >/dev/null
    actual_dry_runs=$((actual_dry_runs + 1))
  done

  if kubectl -n "$integration_namespace" get deployment carbonet-runtime >/dev/null 2>&1; then
    runtime_patch='{"spec":{"template":{"spec":{"containers":[{"name":"carbonet-runtime","env":[{"name":"SPRING_FLYWAY_PASSWORD","value":null,"valueFrom":{"secretKeyRef":{"name":"carbonet-migration-secret","key":"SPRING_FLYWAY_PASSWORD"}}}]}]}}}}'
    for mode in client server; do
      kubectl -n "$integration_namespace" patch deployment/carbonet-runtime \
        --type=strategic --dry-run="$mode" -p="$runtime_patch" -o json |
        python3 -c '
import json
import sys

deployment = json.load(sys.stdin)
containers = deployment["spec"]["template"]["spec"]["containers"]
runtime = next(container for container in containers if container["name"] == "carbonet-runtime")
entries = [entry for entry in runtime.get("env", []) if entry.get("name") == "SPRING_FLYWAY_PASSWORD"]
expected = [{
    "name": "SPRING_FLYWAY_PASSWORD",
    "valueFrom": {"secretKeyRef": {
        "name": "carbonet-migration-secret",
        "key": "SPRING_FLYWAY_PASSWORD",
    }},
}]
raise SystemExit(0 if entries == expected else 1)
' >/dev/null
      actual_dry_runs=$((actual_dry_runs + 1))
    done
  fi
fi
if [[ "${CARBONET_SECRET_REF_REQUIRE_SERVER_DRY_RUN:-false}" == "true" && "$actual_dry_runs" -lt 4 ]]; then
  echo "required client/server cluster dry-runs were unavailable" >&2
  exit 1
fi

if [[ -n "$mutation_namespace" ]]; then
  kubectl get namespace "$mutation_namespace" >/dev/null

  printf 'fixture-not-a-secret' |
    kubectl -n "$mutation_namespace" create secret generic carbonet-migration-secret \
      --from-file=OTHER_KEY=/dev/stdin --dry-run=client -o yaml |
    kubectl apply -f - >/dev/null
  if NAMESPACE="$mutation_namespace" DB_PASSWORD='' \
      CARBONET_KUBEADM_MIGRATION_SECRET_ENSURE_ONLY=true \
      bash "$KUBEADM_SCRIPT" >/dev/null 2>&1; then
    echo "kubeadm accepted an existing migration Secret with the required key missing" >&2
    exit 1
  fi
  mutation_checks=$((mutation_checks + 1))

  printf '' |
    kubectl -n "$mutation_namespace" create secret generic carbonet-migration-secret \
      --from-file=SPRING_FLYWAY_PASSWORD=/dev/stdin --dry-run=client -o yaml |
    kubectl apply -f - >/dev/null
  if NAMESPACE="$mutation_namespace" DB_PASSWORD='' \
      CARBONET_KUBEADM_MIGRATION_SECRET_ENSURE_ONLY=true \
      bash "$KUBEADM_SCRIPT" >/dev/null 2>&1; then
    echo "kubeadm accepted an existing decoded-empty migration Secret key" >&2
    exit 1
  fi
  mutation_checks=$((mutation_checks + 1))

  printf 'fixture-not-a-secret' |
    kubectl -n "$mutation_namespace" create secret generic carbonet-migration-secret \
      --from-file=SPRING_FLYWAY_PASSWORD=/dev/stdin --dry-run=client -o yaml |
    kubectl apply -f - >/dev/null
  NAMESPACE="$mutation_namespace" DB_PASSWORD='' \
    CARBONET_KUBEADM_MIGRATION_SECRET_ENSURE_ONLY=true \
    bash "$KUBEADM_SCRIPT" >/dev/null
  mutation_checks=$((mutation_checks + 1))

  kubectl -n "$mutation_namespace" delete secret carbonet-migration-secret \
    --ignore-not-found=true >/dev/null
  if env -u CARBONET_MIGRATION_PASSWORD \
      NAMESPACE_CARBONET="$mutation_namespace" \
      RESONANCE_MIGRATION_SECRET_ENSURE_ONLY=true \
      bash "$STATIC_DEPLOY_SCRIPT" >/dev/null 2>&1; then
    echo "static deploy provisioned a missing migration Secret without an explicit password source" >&2
    exit 1
  fi
  mutation_checks=$((mutation_checks + 1))
  NAMESPACE_CARBONET="$mutation_namespace" \
    CARBONET_MIGRATION_PASSWORD='fixture-not-a-secret' \
    RESONANCE_MIGRATION_SECRET_ENSURE_ONLY=true \
    bash "$STATIC_DEPLOY_SCRIPT" >/dev/null
  mutation_checks=$((mutation_checks + 1))

  kubectl -n "$mutation_namespace" delete secret carbonet-migration-secret \
    --ignore-not-found=true >/dev/null
  CARBONET_NS="$mutation_namespace" \
    CARBONET_DB_PASSWORD='fixture-not-a-secret' \
    CARBONET_DESKTOP_MIGRATION_SECRET_ENSURE_ONLY=true \
    bash "$DESKTOP_GATE_SCRIPT" >/dev/null
  mutation_checks=$((mutation_checks + 1))
fi
if [[ "${CARBONET_SECRET_REF_REQUIRE_MUTATION:-false}" == "true" && "$mutation_checks" -lt 6 ]]; then
  echo "required isolated Secret mutation checks were unavailable" >&2
  exit 1
fi

echo "PASS migration-secret-ref contract: yaml=2 kubeadm=1 staticDeploy=1 desktopGate=1 rollout=1 mockedJobDryRun=2 actualDryRun=$actual_dry_runs mutationChecks=$mutation_checks missingKeyRejected=1"

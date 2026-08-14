#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JOB_SCRIPT="$ROOT/ops/scripts/run-flyway-migration-job.sh"
DEPLOY_SCRIPT="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
KUBEADM_SCRIPT="$ROOT/ops/scripts/deploy-carbonet-kubeadm-k8s.sh"

bash -n "$JOB_SCRIPT"
bash -n "$DEPLOY_SCRIPT"
bash -n "$KUBEADM_SCRIPT"

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
PY

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
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

echo "PASS migration-secret-ref contract: yaml=2 kubeadm=1 rollout=1 dryRun=client,server missingKeyRejected=1"

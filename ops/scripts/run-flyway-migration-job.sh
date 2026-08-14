#!/usr/bin/env bash
set -euo pipefail

image="${1:?candidate image is required}"
namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
deployment="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
container="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
timeout="${CARBONET_FLYWAY_JOB_TIMEOUT:-120s}"
migration_secret_name="${CARBONET_MIGRATION_SECRET_NAME:-carbonet-migration-secret}"
migration_password_key="${CARBONET_MIGRATION_PASSWORD_KEY:-SPRING_FLYWAY_PASSWORD}"
dry_run_mode="${CARBONET_FLYWAY_JOB_DRY_RUN:-none}"
job="carbonet-flyway-$(date +%Y%m%d%H%M%S)-$(printf '%s' "$image" | sha256sum | cut -c1-6)"
started_epoch="$(date +%s)"
manifest="$(mktemp)"
log_dir="${CARBONET_FLYWAY_LOG_DIR:-/opt/Resonance/var/logs/flyway-jobs}"
mkdir -p "$log_dir"

cleanup() {
  rm -f "$manifest"
  kubectl -n "$namespace" delete job "$job" --ignore-not-found=true --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ ! "$migration_secret_name" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
  echo "[flyway-job] invalid migration Secret name" >&2
  exit 2
fi
if [[ ! "$migration_password_key" =~ ^[-._A-Za-z][-._A-Za-z0-9]*$ ]]; then
  echo "[flyway-job] invalid migration Secret key" >&2
  exit 2
fi
if [[ "$dry_run_mode" != "none" && "$dry_run_mode" != "client" && "$dry_run_mode" != "server" ]]; then
  echo "[flyway-job] CARBONET_FLYWAY_JOB_DRY_RUN must be none, client, or server" >&2
  exit 2
fi
if [[ "$dry_run_mode" != "client" ]]; then
  if ! kubectl -n "$namespace" get secret "$migration_secret_name" -o json |
      MIGRATION_PASSWORD_KEY="$migration_password_key" python3 -c '
import json, os, sys
secret = json.load(sys.stdin)
value = secret.get("data", {}).get(os.environ["MIGRATION_PASSWORD_KEY"])
raise SystemExit(0 if isinstance(value, str) and value else 1)
' >/dev/null; then
    echo "[flyway-job] migration Secret or required key is unavailable" >&2
    exit 1
  fi
fi

kubectl -n "$namespace" get deployment "$deployment" -o json |
  JOB_NAME="$job" CONTAINER_NAME="$container" CANDIDATE_IMAGE="$image" \
  MIGRATION_SECRET_NAME="$migration_secret_name" MIGRATION_PASSWORD_KEY="$migration_password_key" \
  python3 -c '
import json, os, sys
source = json.load(sys.stdin)
pod = source["spec"]["template"]["spec"]
name = os.environ["CONTAINER_NAME"]
image = os.environ["CANDIDATE_IMAGE"]
containers = []
for current in pod["containers"]:
    if current["name"] != name:
        continue
    env = [
        value for value in current.get("env", [])
        if value.get("name") not in (
            "CARBONET_FLYWAY_ENABLED",
            "CARBONET_LIQUIBASE_ENABLED",
            "SPRING_FLYWAY_PASSWORD",
        )
    ]
    env.extend([
        {"name": "CARBONET_FLYWAY_ENABLED", "value": "true"},
        {"name": "CARBONET_LIQUIBASE_ENABLED", "value": "false"},
        {
            "name": "SPRING_FLYWAY_PASSWORD",
            "valueFrom": {
                "secretKeyRef": {
                    "name": os.environ["MIGRATION_SECRET_NAME"],
                    "key": os.environ["MIGRATION_PASSWORD_KEY"],
                }
            },
        },
    ])
    migrated = {
        "name": "flyway",
        "image": image,
        "imagePullPolicy": "Never",
        "env": env,
        "envFrom": current.get("envFrom", []),
        "command": ["java"],
        "args": [
            "-XX:+UseContainerSupport",
            "-XX:+UseSerialGC",
            "-XX:TieredStopAtLevel=1",
            "-XX:MaxRAMPercentage=70",
            "-Dfile.encoding=UTF-8",
            "-cp", "/app/runtime/BOOT-INF/classes:/app/runtime/BOOT-INF/lib/*",
            "egovframework.com.migration.FlywayMigrationApplication",
        ],
        "resources": {
            "requests": {"cpu": "100m", "memory": "256Mi"},
            "limits": {"cpu": "2", "memory": "1Gi"},
        },
    }
    for key in ("volumeMounts", "securityContext"):
        if key in current:
            migrated[key] = current[key]
    containers.append(migrated)
if not containers:
    raise SystemExit(f"container not found: {name}")
job = {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
        "name": os.environ["JOB_NAME"],
        "labels": {"app": "carbonet-flyway", "managed-by": "carbonet-auto-deploy"},
    },
    "spec": {
        "backoffLimit": 0,
        "ttlSecondsAfterFinished": 300,
        "template": {
            "metadata": {"labels": {"app": "carbonet-flyway"}},
            "spec": {
                "restartPolicy": "Never",
                "serviceAccountName": pod.get("serviceAccountName", "default"),
                "securityContext": {
                    "runAsUser": 1000,
                    "runAsGroup": 1000,
                    "runAsNonRoot": True,
                    "fsGroup": 1000,
                    "seccompProfile": {"type": "RuntimeDefault"},
                },
                "containers": containers,
                "volumes": pod.get("volumes", []),
            },
        },
    },
}
print(json.dumps(job))
' >"$manifest"

MIGRATION_SECRET_NAME="$migration_secret_name" MIGRATION_PASSWORD_KEY="$migration_password_key" \
  python3 - "$manifest" <<'PY'
import json
import os
import sys

job = json.load(open(sys.argv[1], encoding="utf-8"))
containers = job["spec"]["template"]["spec"]["containers"]
if len(containers) != 1:
    raise SystemExit("flyway manifest must contain exactly one container")
entries = [entry for entry in containers[0].get("env", []) if entry.get("name") == "SPRING_FLYWAY_PASSWORD"]
expected = {
    "name": "SPRING_FLYWAY_PASSWORD",
    "valueFrom": {
        "secretKeyRef": {
            "name": os.environ["MIGRATION_SECRET_NAME"],
            "key": os.environ["MIGRATION_PASSWORD_KEY"],
        }
    },
}
if entries != [expected]:
    raise SystemExit("flyway password must be one exact SecretKeyRef")
PY

if [[ "$dry_run_mode" != "none" ]]; then
  kubectl -n "$namespace" apply --dry-run="$dry_run_mode" -f "$manifest" >/dev/null
  echo "[flyway-job] DRY_RUN_PASS mode=$dry_run_mode secretRef=$migration_secret_name/$migration_password_key"
  exit 0
fi

echo "[flyway-job] applying $job image=$image"
kubectl -n "$namespace" apply -f "$manifest" >/dev/null
if ! kubectl -n "$namespace" wait --for=condition=complete "job/$job" --timeout="$timeout" >/dev/null; then
  kubectl -n "$namespace" logs "job/$job" --all-containers=true >"$log_dir/$job.log" 2>&1 || true
  kubectl -n "$namespace" describe "job/$job" >>"$log_dir/$job.log" 2>&1 || true
  echo "[flyway-job] failed; candidate image was not promoted (log=$log_dir/$job.log)" >&2
  exit 1
fi

kubectl -n "$namespace" logs "job/$job" --all-containers=true >"$log_dir/$job.log"
if ! grep -q 'FLYWAY_MIGRATION_PASS' "$log_dir/$job.log"; then
  echo "[flyway-job] completion evidence was not found (log=$log_dir/$job.log)" >&2
  exit 1
fi
elapsed="$(( $(date +%s)-started_epoch ))"
echo "[flyway-job] PASS job=$job elapsed=${elapsed}s imagePullPolicy=Never log=$log_dir/$job.log"

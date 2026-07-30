#!/usr/bin/env bash
set -euo pipefail

image="${1:?candidate image is required}"
namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
deployment="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
container="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
timeout="${CARBONET_FLYWAY_JOB_TIMEOUT:-120s}"
job="carbonet-flyway-$(date +%Y%m%d%H%M%S)-$(printf '%s' "$image" | sha256sum | cut -c1-6)"
manifest="$(mktemp)"
log_dir="${CARBONET_FLYWAY_LOG_DIR:-/opt/Resonance/var/logs/flyway-jobs}"
mkdir -p "$log_dir"

cleanup() {
  rm -f "$manifest"
  kubectl -n "$namespace" delete job "$job" --ignore-not-found=true --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

kubectl -n "$namespace" get deployment "$deployment" -o json |
  JOB_NAME="$job" CONTAINER_NAME="$container" CANDIDATE_IMAGE="$image" python3 -c '
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
        if value.get("name") not in ("CARBONET_FLYWAY_ENABLED", "CARBONET_LIQUIBASE_ENABLED")
    ]
    env.extend([
        {"name": "CARBONET_FLYWAY_ENABLED", "value": "true"},
        {"name": "CARBONET_LIQUIBASE_ENABLED", "value": "false"},
    ])
    migrated = {
        "name": "flyway",
        "image": image,
        "imagePullPolicy": "IfNotPresent",
        "env": env,
        "envFrom": current.get("envFrom", []),
        "command": ["java"],
        "args": [
            "-XX:+UseContainerSupport",
            "-XX:MaxRAMPercentage=70",
            "-Dfile.encoding=UTF-8",
            "-cp", "/app/runtime/BOOT-INF/classes:/app/runtime/BOOT-INF/lib/*",
            "egovframework.com.migration.FlywayMigrationApplication",
            "--spring.config.additional-location=optional:file:/app/config/",
            "--spring.profiles.active=prod",
            "--spring.main.banner-mode=off",
            "--spring.jmx.enabled=false",
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
                "containers": containers,
                "volumes": pod.get("volumes", []),
            },
        },
    },
}
print(json.dumps(job))
' >"$manifest"

echo "[flyway-job] applying $job image=$image"
kubectl -n "$namespace" apply -f "$manifest" >/dev/null
if ! kubectl -n "$namespace" wait --for=condition=complete "job/$job" --timeout="$timeout" >/dev/null; then
  kubectl -n "$namespace" logs "job/$job" --all-containers=true >"$log_dir/$job.log" 2>&1 || true
  kubectl -n "$namespace" describe "job/$job" >>"$log_dir/$job.log" 2>&1 || true
  echo "[flyway-job] failed; candidate image was not promoted (log=$log_dir/$job.log)" >&2
  exit 1
fi

kubectl -n "$namespace" logs "job/$job" --all-containers=true >"$log_dir/$job.log"
if ! grep -Eq 'Schema .* is up to date|Successfully applied|Successfully validated' "$log_dir/$job.log"; then
  echo "[flyway-job] completion evidence was not found (log=$log_dir/$job.log)" >&2
  exit 1
fi
echo "[flyway-job] PASS job=$job log=$log_dir/$job.log"

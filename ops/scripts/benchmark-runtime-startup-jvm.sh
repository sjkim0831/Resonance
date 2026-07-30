#!/usr/bin/env bash
set -euo pipefail

namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
deployment="${CARBONET_DEPLOYMENT:-carbonet-runtime}"
trials="${CARBONET_STARTUP_BENCHMARK_TRIALS:-2}"
minimum_improvement_percent="${CARBONET_STARTUP_MIN_IMPROVEMENT_PERCENT:-10}"
timeout_seconds="${CARBONET_STARTUP_BENCHMARK_TIMEOUT_SECONDS:-120}"
state_root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}/var/run/startup-benchmark"
run_id="$(date +%Y%m%d%H%M%S)-$$"
run_dir="$state_root/$run_id"
results_file="$run_dir/results.jsonl"
deployment_json="$run_dir/deployment.json"

[[ "$trials" =~ ^[1-9][0-9]*$ ]] || {
  echo "[startup-benchmark] trials must be a positive integer" >&2
  exit 2
}
[[ "$minimum_improvement_percent" =~ ^[0-9]+$ ]] || {
  echo "[startup-benchmark] minimum improvement must be a non-negative integer" >&2
  exit 2
}
command -v kubectl >/dev/null
command -v jq >/dev/null

mkdir -p "$run_dir"
kubectl -n "$namespace" get deployment "$deployment" -o json >"$deployment_json"

base_java_opts="$(
  jq -r '
    .spec.template.spec.containers[0].env
    | map(select(.name == "JAVA_OPTS"))[0].value // ""
  ' "$deployment_json"
)"
image="$(
  jq -r '.spec.template.spec.containers[0].image' "$deployment_json"
)"

cleanup() {
  kubectl -n "$namespace" delete pod \
    -l "resonance.ai/startup-benchmark=$run_id" \
    --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_trial() {
  local variant="$1"
  local extra_java_opts="$2"
  local trial="$3"
  local pod_name="runtime-startup-${run_id//[^a-zA-Z0-9]/}-${variant}-${trial}"
  pod_name="${pod_name,,}"
  pod_name="${pod_name:0:63}"
  pod_name="${pod_name%-}"
  local pod_file="$run_dir/${variant}-${trial}.json"
  local java_opts="$base_java_opts $extra_java_opts"

  jq \
    --arg name "$pod_name" \
    --arg run_id "$run_id" \
    --arg variant "$variant" \
    --arg java_opts "$java_opts" '
      {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: $name,
          labels: {
            app: "carbonet-runtime-startup-benchmark",
            "resonance.ai/startup-benchmark": $run_id,
            "resonance.ai/startup-variant": $variant
          }
        },
        spec: .spec.template.spec
      }
      | .spec.restartPolicy = "Never"
      | .spec.terminationGracePeriodSeconds = 5
      | .spec.containers[0].name = "runtime"
      | .spec.containers[0].env = (
          .spec.containers[0].env
          | map(if .name == "JAVA_OPTS" then .value = $java_opts else . end)
        )
      | del(.spec.containers[0].lifecycle)
      | del(.spec.containers[0].livenessProbe)
      | del(.spec.containers[0].startupProbe)
      | .spec.containers[0].readinessProbe.periodSeconds = 1
      | .spec.containers[0].readinessProbe.failureThreshold = 120
    ' "$deployment_json" >"$pod_file"

  local started_ms ready_ms elapsed_ms app_seconds status log_file
  started_ms="$(date +%s%3N)"
  kubectl -n "$namespace" apply -f "$pod_file" >/dev/null
  if kubectl -n "$namespace" wait \
      --for=condition=Ready "pod/$pod_name" \
      "--timeout=${timeout_seconds}s" >/dev/null; then
    status="PASS"
  else
    status="TIMEOUT"
  fi
  ready_ms="$(date +%s%3N)"
  elapsed_ms=$((ready_ms - started_ms))
  log_file="$run_dir/${variant}-${trial}.log"
  kubectl -n "$namespace" logs "$pod_name" >"$log_file" 2>&1 || true
  app_seconds="$(
    sed -nE 's/.*Started CarbonetApiApplication in ([0-9.]+) seconds.*/\1/p' \
      "$log_file" | tail -n 1
  )"
  [[ -n "$app_seconds" ]] || app_seconds="null"

  jq -cn \
    --arg variant "$variant" \
    --argjson trial "$trial" \
    --arg status "$status" \
    --arg image "$image" \
    --arg javaOpts "$java_opts" \
    --argjson readyMs "$elapsed_ms" \
    --argjson appSeconds "$app_seconds" \
    '{
      variant:$variant,trial:$trial,status:$status,image:$image,
      javaOpts:$javaOpts,readyMs:$readyMs,appSeconds:$appSeconds
    }' | tee -a "$results_file"

  kubectl -n "$namespace" delete pod "$pod_name" \
    --ignore-not-found --wait=true >/dev/null
  [[ "$status" == "PASS" && "$app_seconds" != "null" ]]
}

# C1 compilation reduces cold-start compilation work. It is only promoted when
# its measured startup gain clears the gate; production adoption still requires
# the normal authenticated post-deploy workload suite.
for ((trial = 1; trial <= trials; trial++)); do
  run_trial baseline "" "$trial"
  run_trial tier1 "-XX:TieredStopAtLevel=1" "$trial"
done

summary_file="$run_dir/summary.json"
jq -s \
  --argjson minimumImprovementPercent "$minimum_improvement_percent" '
    def median:
      sort
      | if length == 0 then null
        elif length % 2 == 1 then .[length / 2 | floor]
        else (.[length / 2 - 1] + .[length / 2]) / 2
        end;
    ([.[] | select(.variant == "baseline" and .status == "PASS") | .appSeconds] | median) as $baseline
    | ([.[] | select(.variant == "tier1" and .status == "PASS") | .appSeconds] | median) as $candidate
    | (if $baseline != null and $candidate != null and $baseline > 0
       then (($baseline - $candidate) * 100 / $baseline)
       else null end) as $improvement
    | {
        baselineMedianSeconds:$baseline,
        candidateMedianSeconds:$candidate,
        improvementPercent:$improvement,
        minimumImprovementPercent:$minimumImprovementPercent,
        recommendation:
          (if $improvement != null and $improvement >= $minimumImprovementPercent
           then "CANDIDATE"
           else "REJECT" end)
      }
  ' "$results_file" >"$summary_file"

cat "$summary_file"
ln -sfn "$run_dir" "$state_root/latest"


#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

phase_file="$temp_dir/phases.jsonl"
cat >"$phase_file" <<'EOF'
{"phase":"policy","durationMs":10,"finishedAtMs":10}
{"phase":"platform_preflight","durationMs":30,"finishedAtMs":40}
{"phase":"policy","durationMs":5,"finishedAtMs":45}
EOF

for sample in 1 2 3 4 5; do
  CARBONET_DEPLOY_ROOT="$root" \
  CARBONET_DEPLOY_PERFORMANCE_DIR="$temp_dir/performance" \
  CARBONET_DEPLOY_PHASE_FILE="$phase_file" \
    bash "$root/ops/scripts/record-deploy-performance.sh" automation "test-$sample" 45 \
      >/dev/null
done

jq -e '
  .slowestPhase == "platform_preflight" and
  .slowestPhaseMs == 30 and
  (.phases | length) == 2 and
  (.phases[] | select(.phase == "policy") | .durationMs) == 15
' "$temp_dir/performance/phase-latest.json" >/dev/null

cat >"$phase_file" <<'EOF'
{"phase":"policy","durationMs":20,"finishedAtMs":20}
{"phase":"platform_preflight","durationMs":50,"finishedAtMs":70}
EOF
CARBONET_DEPLOY_ROOT="$root" \
CARBONET_DEPLOY_PERFORMANCE_DIR="$temp_dir/performance" \
CARBONET_DEPLOY_PHASE_FILE="$phase_file" \
  bash "$root/ops/scripts/record-deploy-performance.sh" automation test-regression 70 \
    >/dev/null

jq -e '
  (.regressedPhases | index("policy")) != null and
  (.regressedPhases | index("platform_preflight")) != null
' "$temp_dir/performance/phase-latest.json" >/dev/null

printf '%s\n' "DEPLOY_PHASE_TELEMETRY_PASS"

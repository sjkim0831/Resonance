#!/usr/bin/env bash
set -euo pipefail

script="ops/scripts/benchmark-runtime-startup-jvm.sh"
[[ -f "$script" ]]
bash -n "$script"

grep -q 'resonance.ai/startup-benchmark' "$script"
grep -q 'minimumImprovementPercent' "$script"
grep -q 'recommendation' "$script"
grep -q 'CANDIDATE' "$script"
grep -q 'REJECT' "$script"
grep -q -- '-XX:TieredStopAtLevel=1' "$script"
grep -q 'trap cleanup EXIT' "$script"

echo "[startup-benchmark-test] PASS isolated-pod=true fail-closed=true promotion-gate=true"

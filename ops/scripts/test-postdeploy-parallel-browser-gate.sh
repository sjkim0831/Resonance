#!/usr/bin/env bash
set -euo pipefail

script="ops/scripts/auto-deploy-main.sh"
runner="projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh"
bash -n "$script"
bash -n "$runner"
grep -q 'bounded browser gate running concurrently' "$script"
grep -q 'runtime_screen_gate_pid' "$script"
grep -q 'wait "$runtime_screen_gate_pid"' "$script"
grep -q 'concurrent browser gate failed' "$script"
grep -q 'kill "$runtime_screen_gate_pid"' "$script"
grep -q 'test-results' "$runner"
grep -q 'sudo -n chown' "$runner"

echo "[postdeploy-browser-parallel-test] PASS bounded=true joined=true cleanup=true ownership-self-heal=true fail-closed=true"

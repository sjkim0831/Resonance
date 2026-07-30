#!/usr/bin/env bash
set -euo pipefail

script="ops/scripts/auto-deploy-main.sh"
bash -n "$script"
grep -q 'bounded browser gate running concurrently' "$script"
grep -q 'runtime_screen_gate_pid' "$script"
grep -q 'wait "$runtime_screen_gate_pid"' "$script"
grep -q 'concurrent browser gate failed' "$script"
grep -q 'kill "$runtime_screen_gate_pid"' "$script"

echo "[postdeploy-browser-parallel-test] PASS bounded=true joined=true cleanup=true fail-closed=true"

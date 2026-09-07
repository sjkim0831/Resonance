#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/patroni-auto-heal.sh"

bash -n "$script"
grep -q 'assert_rollout_idle' "$script"
grep -q 'len(healthy_replicas)<1' "$script"
grep -q 'len(targets)>1' "$script"
grep -q 'PATRONI_REINIT_COOLDOWN_SECONDS' "$script"
grep -q 'flock -n 9' "$script"
grep -q 'patronictl -c /tmp/patroni.yml reinit' "$script"
grep -q 'state.*streaming.*lag.*0' "$script"

if grep -Eq 'kubectl delete pod.*postgres-patroni|postgres-patroni-0.*patronictl' "$script"; then
  echo "unsafe fixed-member or whole-cluster deletion path remains" >&2
  exit 1
fi

echo "PATRONI_AUTO_HEAL_SAFETY_PASS"

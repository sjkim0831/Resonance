#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-emission-project-assurance.sh"
bash -n "$TARGET"

for required in \
  'VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"' \
  "grep -Eq '^\\[customer-journey\\] PASS '" \
  'validation commit is not deployed' \
  'merge-base --is-ancestor' \
  'plan-incremental-work.sh' \
  'PLAN_RUNTIME_REQUIRED PLAN_FRONTEND_REQUIRED PLAN_BACKEND_REQUIRED PLAN_DATABASE_REQUIRED' \
  'validationCommit:$validationCommit'; do
  grep -Fq "$required" "$TARGET" || {
    echo "[emission-assurance-contract] FAIL missing=$required" >&2
    exit 1
  }
done

if grep -Fq 'SOURCE_COMMIT" == "${E2E_DEPLOYED_COMMIT' "$TARGET"; then
  echo '[emission-assurance-contract] FAIL legacy runtime-validation identity coupling' >&2
  exit 1
fi

mutant="$(mktemp)"
trap 'rm -f "$mutant"' EXIT
sed 's/customer-journey/customer-work-journey/' "$TARGET" > "$mutant"
if grep -Fq "grep -Eq '^\[customer-journey\] PASS '" "$mutant"; then
  echo '[emission-assurance-contract] FAIL journey-name mutation survived' >&2
  exit 1
fi

printf '[emission-assurance-contract] PASS steps=7 freshness=split runtime-gap=blocked journey-name=current\n'

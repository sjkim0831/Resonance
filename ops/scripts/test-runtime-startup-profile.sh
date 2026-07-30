#!/usr/bin/env bash
set -euo pipefail

profile="ops/config/runtime-jvm-profile.env"
promoter="ops/scripts/promote-runtime-startup-profile.sh"
deploy="ops/scripts/auto-deploy-main.sh"
planner="ops/scripts/plan-incremental-work.sh"

bash -n "$profile"
bash -n "$promoter"
if LC_ALL=C grep -q $'\r' "$profile"; then
  echo "[startup-profile-test] CRLF is forbidden in sourceable env files" >&2
  exit 1
fi
grep -q -- '-XX:TieredStopAtLevel=1' "$profile"
grep -q 'runtime-jvm-profile.env' "$deploy"
grep -q 'JAVA_OPTS=$CARBONET_RUNTIME_JAVA_OPTS' "$deploy"
grep -q 'validation failed; restoring previous JVM profile' "$promoter"
grep -q 'run-post-deploy-validation-groups.sh' "$promoter"
grep -q 'runtime:startup-profile' "$planner"
grep -q 'JVM profile promoted without Java/frontend rebuild' "$deploy"

echo "[startup-profile-test] PASS centralized=true rollback=true full-validation=true"

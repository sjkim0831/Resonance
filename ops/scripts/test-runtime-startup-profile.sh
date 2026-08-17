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
grep -q 'JAVA_OPTS=$CARBONET_RUNTIME_JAVA_OPTS' "$promoter"
grep -q 'validation failed; restoring previous JVM profile' "$promoter"
grep -q 'run-post-deploy-validation-groups.sh' "$promoter"
grep -q 'runtime:startup-profile' "$planner"
grep -q 'JVM profile promoted without Java/frontend rebuild' "$deploy"

python3 - "$deploy" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

def assert_candidate_before_profile(source: str) -> None:
    branch = source[
        source.index("# A measured JVM profile changes only the Deployment environment."):
        source.index("# Test/deployment automation changes do not alter the running application.")
    ]
    assert branch.count("enable_postdeploy_candidate_mode") == 1
    assert branch.index("enable_postdeploy_candidate_mode") < branch.index(
        "promote-runtime-startup-profile.sh")

def assert_pre_flyway_gate(source: str) -> None:
    gate = source[
        source.index("run_runtime_template_identity_migration_contract_if_required() {"):
        source.index("run_operational_usage_ledger_live_e2e_if_required() {")
    ]
    selector_end = gate.index("; then")
    parallel = gate.index("run_parallel_contract_tests", selector_end)
    postgres = gate.index("test-postdeploy-candidate-evidence-postgres.sh", parallel)
    assert gate.index("ops/scripts/promote-runtime-startup-profile.sh") < selector_end
    assert gate.index("ops/scripts/test-runtime-startup-profile.sh") < selector_end
    assert parallel < gate.index("ops/scripts/test-runtime-startup-profile.sh", parallel) < postgres

assert_candidate_before_profile(text)
assert_pre_flyway_gate(text)
branch = text[
    text.index("# A measured JVM profile changes only the Deployment environment."):
    text.index("# Test/deployment automation changes do not alter the running application.")
]
mutants = (
    text.replace(branch, branch.replace(
        "  enable_postdeploy_candidate_mode\n", "", 1), 1),
    text.replace(branch, branch.replace(
        "  enable_postdeploy_candidate_mode\n  CARBONET_DEPLOY_ROOT=",
        "  CARBONET_DEPLOY_ROOT=", 1).replace(
            "    bash ops/scripts/promote-runtime-startup-profile.sh\n",
            "    bash ops/scripts/promote-runtime-startup-profile.sh\n  enable_postdeploy_candidate_mode\n", 1), 1),
)
for mutant in mutants:
    try:
        assert_candidate_before_profile(mutant)
    except (AssertionError, ValueError):
        continue
    raise AssertionError("startup-profile pre-mutation candidate guard mutant survived")

gate_mutants = (
    text.replace("      ops/scripts/promote-runtime-startup-profile.sh \\\n", "", 1),
    "".join(text.rpartition(
        "      ops/scripts/test-runtime-startup-profile.sh \\\n")[::2]),
)
for mutant in gate_mutants:
    try:
        assert_pre_flyway_gate(mutant)
    except (AssertionError, ValueError):
        continue
    raise AssertionError("startup-profile pre-Flyway gate mutant survived")
PY

echo "[startup-profile-test] PASS centralized=true rollback=true full-validation=true candidateBeforeMutation=true preFlyway=true mutants=4"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
pipeline="$ROOT_DIR/projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"
deploy_pipeline="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
auto_deploy="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"

grep -Fq 'run(process.execPath, ["scripts/dedupe-generated-route-family.mjs"])' "$pipeline"
grep -Fq 'const validationTasks = [' "$pipeline"
grep -Fq '...validationTasks,' "$pipeline"
grep -Fq 'node_modules/typescript/bin/tsc' "$pipeline"
grep -Fq 'four independent generators and customer-journey audit run concurrently' "$pipeline"
grep -Fq 'generateAsync("page-completeness-inventory"' "$pipeline"
grep -Fq 'runAsync(process.execPath, ["scripts/check-customer-journey-governance.mjs"])' "$pipeline"
grep -Fq 'runAsync(bundlerCommand, bundlerArgs)' "$pipeline"
grep -Fq 'ops/tests/test-work-execution-versioned-support-ui.mjs' "$pipeline"
grep -Fq 'ops/tests/test-versioned-support-help-integration.mjs' "$pipeline"
grep -Fq 'ops/tests/test-work-execution-route-ownership.mjs' "$pipeline"
grep -Fq 'ops/tests/test-taskquest-session-gate.mjs' "$pipeline"
grep -Fq 'ops/tests/test-global-user-gnb-home-fetch-stability.mjs' "$pipeline"
grep -Fq 'ops/tests/test-frontend-favicon-contract.mjs' "$pipeline"
grep -Fq 'ops/tests/test-material-symbols-self-hosting.mjs' "$pipeline"
grep -Fq 'ops/tests/test-member-lifecycle-relay-safe-harness-contract.mjs' "$pipeline"

dedupe_line="$(grep -n 'run(process.execPath, \["scripts/dedupe-generated-route-family.mjs"\])' "$pipeline" | head -1 | cut -d: -f1)"
validation_line="$(grep -n 'const validationTasks = \[' "$pipeline" | head -1 | cut -d: -f1)"
[[ "$dedupe_line" -lt "$validation_line" ]] || {
  echo "source-mutating dedupe must precede parallel read-only validation" >&2
  exit 1
}

echo "[frontend-parallel-build-pipeline-test] PASS"

python3 - "$deploy_pipeline" "$auto_deploy" <<'PY'
import os
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
auto_source = Path(sys.argv[2]).read_text(encoding="utf-8")
start = source.index('if [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]]')
end = source.index('verify_immutable_frontend_jar', start)
block = source[start:end]
frontend = block.index('build_frontend & immutable_frontend_pid=$!')
backend = block.index('build_maven & immutable_backend_pid=$!')
wait_frontend = block.index('wait "$immutable_frontend_pid"')
wait_backend = block.index('wait "$immutable_backend_pid"')
assemble = block.index('prepare_immutable_frontend', wait_backend)
final_jar = block.index('build_maven', assemble)
assert frontend < wait_frontend
assert backend < wait_backend
assert wait_frontend < assemble and wait_backend < assemble < final_jar
assert 'SKIP_FRONTEND" != "true" && "$SKIP_BACKEND" != "true"' in block
assert 'IMMUTABLE_PARALLEL_BUILD_FAILED' in block
assert 'IMMUTABLE_FRONTEND_SOURCE_DIR:-$OVERLAY_HOST_PATH' in source
assert 'Immutable JAR candidate sourced from verified overlay' in source
assert 'OVERLAY_DIR="$OVERLAY_HOST_PATH" SOURCE_DIR="$FRONTEND_DIR"' in source
print("IMMUTABLE_FRONTEND_BACKEND_PARALLEL_PASS final-jar-after-barrier=true")


def build_child_block(candidate: str) -> str:
    block_start = candidate.index("IMMUTABLE_FRONTEND_IMAGE=true")
    block_end = candidate.index(
        "verify_postdeploy_release_attempt_db_staged ||", block_start
    )
    return candidate[block_start:block_end]


def probe_build_child_environment(candidate: str) -> dict[str, str]:
    child = build_child_block(candidate)
    command = "  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
    assert child.count(command) == 1
    probe = child.replace(command, "  env", 1)
    probe_env = os.environ.copy()
    probe_env.pop("IMMUTABLE_FRONTEND_IMAGE", None)
    probe_env.update(
        {
            "skip_frontend": "true",
            "PLAN_DATABASE_REQUIRED": "true",
            "target_commit": "1" * 40,
            "runtime_deployed_commit": "2" * 40,
            "postdeploy_db_attempt_staged": "false",
            "POSTDEPLOY_ATTEMPT_JOURNAL_FILE": "/tmp/probe-journal",
            "POSTDEPLOY_JOURNAL_HELPER": "/tmp/probe-helper",
            "postdeploy_candidate_id": "postdeploy:probe",
            "POSTDEPLOY_LEADER_RESOLVER": "/tmp/probe-resolver",
            "POSTGRES_POD": "postgres-probe-0",
            "POSTGRES_CONTAINER": "postgres",
            "POSTGRES_DB": "carbonet",
            "POSTGRES_USER": "probe",
            "CARBONET_RUNTIME_JAVA_OPTS": "-Xmx1g",
        }
    )
    completed = subprocess.run(
        ["bash", "-eu", "-o", "pipefail", "-c", probe],
        check=True,
        capture_output=True,
        text=True,
        env=probe_env,
    )
    return dict(
        line.split("=", 1)
        for line in completed.stdout.splitlines()
        if "=" in line
    )


def assert_contiguous_build_child(candidate: str) -> None:
    child = build_child_block(candidate)
    lines = child.rstrip().splitlines()
    assert lines[0] == "IMMUTABLE_FRONTEND_IMAGE=true \\", lines[0]
    assert lines[1].startswith('SKIP_FRONTEND="$skip_frontend" \\')
    assert not any(line.lstrip().startswith("#") for line in lines)
    observed = probe_build_child_environment(candidate)
    assert observed.get("IMMUTABLE_FRONTEND_IMAGE") == "true"
    assert observed.get("SKIP_FRONTEND") == "true"
    assert observed.get("RUN_FLYWAY_MIGRATION_JOB") == "true"


assert_contiguous_build_child(auto_source)
poisoned = auto_source.replace(
    "IMMUTABLE_FRONTEND_IMAGE=true \\\nSKIP_FRONTEND=",
    "IMMUTABLE_FRONTEND_IMAGE=true \\\n# poisoned continuation mutant\nSKIP_FRONTEND=",
    1,
)
assert poisoned != auto_source
assert probe_build_child_environment(poisoned).get("IMMUTABLE_FRONTEND_IMAGE") is None
try:
    assert_contiguous_build_child(poisoned)
except AssertionError:
    pass
else:
    raise AssertionError("comment-placement mutant escaped the env-chain contract")


def immutable_main_block(candidate: str) -> str:
    immutable_start = candidate.index(
        'if [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]]'
    )
    immutable_end = candidate.index(
        'log_step "Parallel Build (Frontend + Backend)"', immutable_start
    )
    return candidate[immutable_start:immutable_end]


def assert_static_rollout_contract(candidate: str) -> None:
    immutable = immutable_main_block(candidate)
    skip_overlay = immutable.index("SKIP_OVERLAY_SYNC=true")
    sync_overlay = immutable.index("sync_overlay", skip_overlay)
    build_image = immutable.index("build_image", sync_overlay)
    rollout = immutable.index("rollout_image", build_image)
    health = immutable.index("verify_runtime", rollout)
    assert skip_overlay < sync_overlay < build_image < rollout < health
    assert immutable.count("rollout_image") == 1
    assert 'build_frontend\n' in immutable

    frontend_start = candidate.index("build_frontend() {")
    frontend_end = candidate.index("publish_pending_frontend_staging() {", frontend_start)
    frontend_function = candidate[frontend_start:frontend_end]
    assert 'if [[ "$SKIP_FRONTEND" == "true" ]]' in frontend_function
    assert 'Skipped (SKIP_FRONTEND=true)' in frontend_function

    prepare_start = candidate.index("prepare_immutable_frontend() {")
    prepare_end = candidate.index("verify_immutable_frontend_jar() {", prepare_start)
    prepare_function = candidate[prepare_start:prepare_end]
    assert 'IMMUTABLE_FRONTEND_SOURCE_DIR:-$OVERLAY_HOST_PATH' in prepare_function

    sync_start = candidate.index("sync_overlay() {")
    sync_end = candidate.index("build_maven() {", sync_start)
    sync_function = candidate[sync_start:sync_end]
    skip_branch = sync_function[
        sync_function.index('if [[ "$SKIP_OVERLAY_SYNC" == "true" ]]') :
        sync_function.index("guard_frontend_overlay backup")
    ]
    assert "return" in skip_branch
    assert "rollout restart" not in skip_branch

    normal_start = candidate.index('log_step "Parallel Build (Frontend + Backend)"')
    normal = candidate[normal_start : candidate.index("local total_time=", normal_start)]
    assert "build_frontend" in normal
    assert normal.count("rollout_image") == 1


def run_immutable_control_flow(
    candidate: str, *, skip_frontend: bool, defer_live: bool
) -> list[str]:
    immutable = immutable_main_block(candidate)
    harness = f'''set -euo pipefail
IMMUTABLE_FRONTEND_IMAGE=true
SKIP_FRONTEND={str(skip_frontend).lower()}
SKIP_BACKEND=false
CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY={str(defer_live).lower()}
PENDING_FRONTEND_STAGING_DIR=""
SKIP_OVERLAY_SYNC=false
start_time="$(date +%s)"
log_step() {{ :; }}
build_frontend() {{
  if [[ "$SKIP_FRONTEND" == true ]]; then
    printf '%s\\n' frontend:reuse
  else
    printf '%s\\n' frontend:build
  fi
}}
build_maven() {{ printf '%s\\n' backend:build; }}
prepare_immutable_frontend() {{ printf '%s\\n' immutable:reuse; }}
verify_immutable_frontend_jar() {{ printf '%s\\n' immutable:verified; }}
sync_overlay() {{
  if [[ "$SKIP_OVERLAY_SYNC" == true ]]; then
    printf '%s\\n' overlay:reuse
  else
    printf '%s\\n' overlay:interim-rollout
  fi
}}
build_image() {{ printf '%s\\n' image:build; }}
rollout_image() {{ printf '%s\\n' runtime:rollout; }}
ensure_pdb() {{ printf '%s\\n' runtime:pdb; }}
verify_runtime() {{ printf '%s\\n' runtime:health; }}
notify() {{ :; }}
print_summary() {{ :; }}
release_lock() {{ :; }}
run_pipeline() {{
{immutable}
}}
run_pipeline
'''
    completed = subprocess.run(
        ["bash", "-eu", "-o", "pipefail", "-c", harness],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.splitlines()


def assert_dynamic_rollout_contract(candidate: str) -> None:
    reused = run_immutable_control_flow(
        candidate, skip_frontend=True, defer_live=True
    )
    assert reused.count("frontend:reuse") == 1
    assert reused.count("immutable:reuse") == 1
    assert reused.count("overlay:reuse") == 1
    assert "overlay:interim-rollout" not in reused
    assert reused.count("runtime:rollout") == 1
    assert reused.count("runtime:health") == 1

    frontend = run_immutable_control_flow(
        candidate, skip_frontend=False, defer_live=True
    )
    assert frontend.count("frontend:build") == 1
    assert frontend.count("runtime:rollout") == 1
    assert frontend.count("runtime:health") == 1


assert_static_rollout_contract(source)
assert_dynamic_rollout_contract(source)

overlay_mutant = source.replace(
    "    SKIP_OVERLAY_SYNC=true\n    sync_overlay",
    "    SKIP_OVERLAY_SYNC=false\n    sync_overlay",
    1,
)
assert overlay_mutant != source
try:
    assert_dynamic_rollout_contract(overlay_mutant)
except AssertionError:
    pass
else:
    raise AssertionError("interim-rollout mutant escaped the dynamic contract")

rollout_mutant = source.replace(
    "    rollout_image\n    ensure_pdb",
    "    rollout_image\n    rollout_image\n    ensure_pdb",
    1,
)
assert rollout_mutant != source
try:
    assert_static_rollout_contract(rollout_mutant)
except AssertionError:
    pass
else:
    raise AssertionError("duplicate-rollout mutant escaped the static contract")

print(
    "IMMUTABLE_FRONTEND_ENV_CHAIN_PASS "
    "skipFrontendReuse=1 interimRollouts=0 runtimeRollouts=1 "
    "normalFrontendBuild=1 commentMutant=caught rolloutMutants=2"
)
PY

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER="$ROOT/ops/scripts/run-process-development-worker.sh"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
TMP="$(mktemp -d)"
PG_CONTAINER="canonical-status-$RANDOM-$$"
PG_STARTED=0
PG_RUNTIME=""
PUBLICATION_PIDS=()
cleanup() {
  set +e
  if (( ${#PUBLICATION_PIDS[@]} )); then
    kill -TERM "${PUBLICATION_PIDS[@]}" >/dev/null 2>&1 || true
    wait "${PUBLICATION_PIDS[@]}" >/dev/null 2>&1 || true
  fi
  if (( PG_STARTED )); then
    if [[ "$PG_RUNTIME" == ctr ]]; then
      sudo ctr -n k8s.io tasks kill --signal SIGKILL "$PG_CONTAINER" >/dev/null 2>&1 || true
      sudo ctr -n k8s.io tasks rm --force "$PG_CONTAINER" >/dev/null 2>&1 || true
      sudo ctr -n k8s.io containers rm "$PG_CONTAINER" >/dev/null 2>&1 || true
    elif [[ "$PG_RUNTIME" == docker ]]; then
      docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

python3 - "$WORKER" "$ORCHESTRATOR" <<'PY'
import sys
from pathlib import Path

worker = Path(sys.argv[1]).read_text(encoding="utf-8")
orchestrator = Path(sys.argv[2]).read_text(encoding="utf-8")
push = worker.index('git -C "$WT" push origin "HEAD:main"')
deploy = worker.index('runtime_is_healthy || fail_job "deployment health check failed"')
binding = worker.index('if ! CANONICAL_BINDING_EVIDENCE="$(verify_stable_canonical_runtime_deployment', deploy)
publication = worker.index('canonical_published=0', binding)
final_slo = worker.index('CANONICAL_DEPLOY_SECONDS="$(canonical_deploy_elapsed_seconds)"', publication)
finalize = worker.index('finalize_canonical_generation "$JOB_ID"', final_slo)
if not push < deploy < binding < publication < final_slo < finalize:
    raise AssertionError("canonical finalization is not after deploy/binding/publication/final SLO proof")
if "CANONICAL_RUNTIME_BINDING_VERIFIED" in worker:
    raise AssertionError("caller-supplied runtime binding boolean can bypass exact mappings proof")
if "canonical_job_head_is_current" in worker:
    raise AssertionError("retired step-local head checker can reject the process-wide publication head")
for token in (
    "CANONICAL_FINALIZE_AFTER_PUSH_DEPLOY_HEALTH",
    "CANONICAL_FINALIZE_READBACK",
    "STALE_CANONICAL_SOURCE_HASH",
    "CANONICAL_TERMINAL_EVIDENCE_IMMUTABLE",
    "CANONICAL_RELEASE_FINALIZED",
    "canonicalGeneration",
    "canonical_diff_line_count",
    "validate_canonical_generated_diff",
    "compile_canonical_generated_endpoint",
    "revalidate_canonical_commit_after_rebase",
    "CANONICAL_ENDPOINT_SOURCE_DIRS",
    "CANONICAL_RUNTIME_BINDING",
    "CANONICAL_DEPLOY_SLO",
    "CANONICAL_PROCESS_PUBLICATION_V1:",
    "framework_process_generation_input(j.process_code)",
    "CANONICAL_PROCESS_JOB_HEAD",
    "CANONICAL_MAIN_PUBLICATION_LOCK_CLASS_ID=1128353359",
    "CANONICAL_MAIN_PUBLICATION_LOCK_OBJECT_ID=1296124238",
    "PROCESS_WORKER_PSQL_SESSION_COMMAND",
    "timeout --foreground --signal=TERM --kill-after=5s",
    'read -r -t "$timeout_seconds"',
    "canonical_publication_complete_push",
    "/actuator/mappings",
    "--untracked-files=all",
):
    if token not in worker:
        raise AssertionError(f"worker publication token missing: {token}")
for token in (
    "CANONICAL_EVIDENCE_PUBLICATION_V1",
    "FULL_STACK_GENERATION",
    "canonical_endpoint_compiler_installed",
    "framework_canonical_endpoint_readiness(5000,process_code)",
    'status:"DEFERRED"',
    "CANONICAL_EVIDENCE_PUBLICATION_PENDING",
):
    if token not in orchestrator:
        raise AssertionError(f"orchestrator publication token missing: {token}")
canonical_branch = orchestrator.index("if (( canonical_ready_before > 0 )); then")
legacy_generator = orchestrator.index('bash "$ROOT_DIR/ops/scripts/generate-full-stack-design-packages.sh"', canonical_branch)
legacy_else = orchestrator.index("else", canonical_branch)
if not canonical_branch < legacy_else < legacy_generator:
    raise AssertionError("canonical branch can still invoke the direct tracked-output generator")
canonical_limit = worker.index('CANONICAL_ENDPOINT_MANIFEST="$WT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/')
manifest_validation = worker.index('validate_canonical_generated_diff "$WT"', canonical_limit)
generic_limit = worker.index('[ "$FILE_COUNT" -le "$MAX_FILES" ]', canonical_limit)
if not canonical_limit < manifest_validation < generic_limit:
    raise AssertionError("generic MAX_FILES still precedes canonical manifest validation")
for rebase in [index for index in range(len(worker)) if worker.startswith('git -C "$WT" rebase origin/main', index)]:
    if 'revalidate_canonical_commit_after_rebase HEAD' not in worker[rebase:rebase + 900]:
        raise AssertionError("canonical rebase can reach push without manifest validation and compile")
publication_begin = worker.index('canonical_publication_begin "$PROCESS_CODE"', canonical_limit)
head_check = worker.index('canonical_process_job_head_is_current', publication_begin)
push_loop = worker.index('for publish_attempt in 1 2 3; do', head_check)
loop_session_check = worker.index('canonical_publication_db_session_alive', push_loop)
loop_head_check = worker.index('canonical_process_job_head_is_current', loop_session_check)
push = worker.index('git -C "$WT" push origin "HEAD:main"', loop_head_check)
main_release = worker.index('canonical_publication_complete_push', push)
finalize_call = worker.index('finalize_canonical_generation "$JOB_ID"', main_release)
publication_end = worker.index('canonical_publication_end', finalize_call)
if not publication_begin < head_check < push_loop < loop_session_check < loop_head_check < push < main_release < finalize_call < publication_end:
    raise AssertionError("canonical DB locks/head checks do not enclose every push attempt")
PY

REMOTE="$TMP/remote.git"
REPO="$TMP/repo"
git init --bare -q "$REMOTE"
git init -q "$REPO"
git -C "$REPO" config user.name fixture
git -C "$REPO" config user.email fixture@example.invalid
printf 'initial\n' >"$REPO/README"
git -C "$REPO" add README
git -C "$REPO" commit -qm initial
git -C "$REPO" branch -M main
git -C "$REPO" remote add origin "$REMOTE"
git -C "$REPO" push -q -u origin main

PACKAGE="$REPO/projects/carbonet-backend-metadata/process-runtime/generated/PROC/PROC__STEP.json"
RELEASE="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/full-stack-release.json"
MAPPINGS="$TMP/runtime-mappings.json"
mkdir -p "$(dirname "$PACKAGE")" "$(dirname "$RELEASE")"
python3 - "$PACKAGE" "$RELEASE" "$MAPPINGS" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

package = {
    "schemaVersion": "2.0.0",
    "process": {"code": "PROC"},
    "step": {"code": "STEP"},
    "sourceHash": "a" * 32,
    "generationStatus": "READY",
    "canonicalCatalogHash": "b" * 64,
    "canonicalScreens": [],
}
package["packageHash"] = hashlib.sha256(stable(package).encode()).hexdigest()
package_index = {
    "schemaVersion": "2.0.0",
    "packageCount": 1,
    "skippedReviewRequired": 0,
    "packages": [{"processCode": "PROC", "stepCode": "STEP", "package": "PROC__STEP.json", "packageHash": package["packageHash"], "pages": 1}],
    "canonicalCatalogHash": "b" * 64,
    "canonicalScreens": [],
}
package_index["manifestHash"] = hashlib.sha256(stable(package_index).encode()).hexdigest()
endpoint_manifest = {
    "schema": "carbonet.generated-endpoints/v1",
    "adapter": "EXISTING_PROCESS_COMMAND_RUNTIME",
    "catalogHash": "c" * 64,
    "generatorHash": "1" * 64,
    "artifactCount": 0,
    "artifacts": [],
    "operations": [{
        "operationKey": "CompleteActivityPlan",
        "method": "POST",
        "path": "/api/generated/proc/{executionId}/complete",
        "handlerClass": "egovframework.com.generated.canonical.CompleteActivityPlanController",
        "handlerMethod": "execute",
        "designHash": "d" * 64,
        "endpointHash": "e" * 64,
    }],
}
endpoint_manifest["artifactHash"] = hashlib.sha256(stable(endpoint_manifest["artifacts"]).encode()).hexdigest()
endpoint_manifest["bundleHash"] = hashlib.sha256(stable(endpoint_manifest).encode()).hexdigest()
release = {
    "schema": "carbonet.canonical-full-stack-release/v1",
    "activationPolicy": "SOURCE_IMMEDIATE_V1",
    "lanes": ["FRONTEND", "API", "DATABASE", "HELP", "CARDS"],
    "designCatalogHash": "b" * 64,
    "endpointCatalogHash": "c" * 64,
    "designHashes": ["d" * 64],
    "packageManifestHash": package_index["manifestHash"],
    "endpointBundleHash": endpoint_manifest["bundleHash"],
}
release["releaseHash"] = hashlib.sha256(stable(release).encode()).hexdigest()
Path(sys.argv[1]).write_text(json.dumps(package), encoding="utf-8")
Path(sys.argv[2]).write_text(json.dumps(release), encoding="utf-8")
Path(sys.argv[1]).with_name("index.json").write_text(json.dumps(package_index), encoding="utf-8")
Path(sys.argv[2]).with_name("manifest.json").write_text(json.dumps(endpoint_manifest), encoding="utf-8")
mappings = {
    "contexts": {"application": {"mappings": {"dispatcherServlets": {"dispatcherServlet": [{
        "details": {
            "handlerMethod": {
                "className": endpoint_manifest["operations"][0]["handlerClass"],
                "name": "execute",
            },
            "requestMappingConditions": {
                "methods": ["POST"],
                "patterns": [endpoint_manifest["operations"][0]["path"]],
            },
        },
    }]}}}},
}
Path(sys.argv[3]).write_text(json.dumps(mappings), encoding="utf-8")
PY
cp "$MAPPINGS" "$MAPPINGS.good"
git -C "$REPO" add .
git -C "$REPO" commit -qm generated
RESULT_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
DEPLOYED_COMMIT="$RESULT_COMMIT"

FAKE_DB="$TMP/fake-db.py"
cat >"$FAKE_DB" <<'PY'
#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

state_path = Path(os.environ["FAKE_DB_STATE"])
state = json.loads(state_path.read_text())
args = sys.argv[1:]
sql = args[args.index("-c") + 1]
payload_match = re.search(r"\$payload\$(\{.*?\})\$payload\$", sql, re.S)
payload = json.loads(payload_match.group(1)) if payload_match else None
commit_match = re.search(r"\$commit\$([0-9a-f]{40})\$commit\$", sql)
commit = commit_match.group(1) if commit_match else None
rollback_match = re.search(r"\$rollback\$([0-9a-f]{40})\$rollback\$", sql)
rollback = rollback_match.group(1) if rollback_match else None

if "CANONICAL_FINALIZE_AFTER_PUSH_DEPLOY_HEALTH" in sql:
    if payload["sourceHash"] != state["sourceHash"]:
        raise SystemExit(1)
    if state.get("jobStatus") == "VERIFIED":
        if state.get("evidence") != payload or state.get("commit") != commit:
            raise SystemExit(1)
    else:
        if state.get("artifactCount", 1) != 1 or not state.get("artifactExact", True):
            raise SystemExit(1)
        state.update(
            status="GENERATED", jobStatus="VERIFIED", evidence=payload,
            commit=commit, rollbackRef=rollback, artifactStatus="VERIFIED",
            eventCount=1, writes=state.get("writes", 0) + 1,
        )
    ambiguous = state.get("ambiguous", 0)
    if ambiguous:
        state["ambiguous"] = ambiguous - 1
    state_path.write_text(json.dumps(state))
    if ambiguous:
        raise SystemExit(1)
    raise SystemExit(0)

if "CANONICAL_FINALIZE_READBACK" in sql:
    exact = (
        state.get("status") == "GENERATED"
        and state.get("jobStatus") == "VERIFIED"
        and state.get("eventCount") == 1
        and state.get("evidence") == payload
        and state.get("commit") == commit
        and state.get("rollbackRef") == rollback
        and state.get("artifactStatus") == "VERIFIED"
    )
    print(1 if exact else 0)
    raise SystemExit(0)

raise SystemExit("unexpected fake DB query")
PY
chmod +x "$FAKE_DB"
STATE="$TMP/state.json"

reset_state() {
  local source_hash="$1" ambiguous="${2:-0}" artifact_count="${3:-1}" artifact_exact="${4:-true}"
  python3 - "$STATE" "$source_hash" "$ambiguous" "$artifact_count" "$artifact_exact" <<'PY'
import json,sys
json.dump({"sourceHash":sys.argv[2],"status":"READY","jobStatus":"RUNNING","eventCount":0,
           "writes":0,"ambiguous":int(sys.argv[3]),"artifactCount":int(sys.argv[4]),
           "artifactExact":sys.argv[5]=="true","artifactStatus":"PENDING"},open(sys.argv[1],"w"))
PY
}

invoke_finalize() {
  local -a marker_env=()
  if [[ -n "${FIXTURE_MARKER_SEQUENCE:-}" ]]; then
    printf '%b' "$FIXTURE_MARKER_SEQUENCE" >"$MARKER_SEQUENCE_FILE"
    marker_env+=(CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE="$MARKER_SEQUENCE_FILE")
  elif [[ -n "${FIXTURE_MARKER_COMMAND:-}" ]]; then
    marker_env+=(CANONICAL_DEPLOYED_COMMIT_COMMAND="$FIXTURE_MARKER_COMMAND")
  else
    marker_env+=(CANONICAL_DEPLOYED_COMMIT="$DEPLOYED_COMMIT")
  fi
  env ROOT_DIR="$REPO" WORKTREE_ROOT="$TMP/worker-wt" LOG_ROOT="$TMP/logs" \
    LOCK_FILE="$TMP/worker.lock" PGDATABASE=fake PGUSER=fake PGPASSWORD=fake \
    PROCESS_WORKER_PSQLQ_COMMAND="$FAKE_DB" FAKE_DB_STATE="$STATE" \
    CANONICAL_FINALIZE_RETRY_SLEEP_SECONDS=0 \
    CANONICAL_PACKAGE_FILE="$PACKAGE" CANONICAL_RELEASE_FILE="$RELEASE" \
    CANONICAL_RESULT_COMMIT="$RESULT_COMMIT" CANONICAL_JOB_ID=101 \
    CANONICAL_LEASE_TOKEN=11111111-1111-1111-1111-111111111111 \
    CANONICAL_PROCESS_CODE=PROC CANONICAL_STEP_CODE=STEP \
    CANONICAL_WORKTREE="$REPO" CANONICAL_WORKER_ID=fixture-worker \
    CANONICAL_RUNTIME_MAPPINGS_FILE="$MAPPINGS" \
    CANONICAL_DEPLOY_ELAPSED_SECONDS="${FIXTURE_DEPLOY_SECONDS:-42}" \
    CANONICAL_LOG_FILE="$TMP/fixture.log" JOB_TYPE=FULL_STACK_GENERATION "${marker_env[@]}" \
    bash "$WORKER" --canonical-finalize-contract
}

# Local commit exists but origin/main does not contain it: DB write must be 0.
reset_state "$(printf 'a%.0s' {1..32})"
if invoke_finalize >/dev/null 2>&1; then
  echo 'pre-push finalization unexpectedly succeeded' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

# A rejected push never enters finalization and therefore leaves DB untouched.
printf '#!/usr/bin/env bash\nexit 1\n' >"$REMOTE/hooks/pre-receive"
chmod +x "$REMOTE/hooks/pre-receive"
if git -C "$REPO" push origin HEAD:main >/dev/null 2>&1; then
  echo 'fixture push rejection failed' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY"' "$STATE" >/dev/null
rm -f "$REMOTE/hooks/pre-receive"

# Published commit plus exact hashes produces one terminal write/event.
git -C "$REPO" push -q origin HEAD:main
printf 'unrelated descendant\n' >"$REPO/unrelated-descendant.txt"
git -C "$REPO" add unrelated-descendant.txt
git -C "$REPO" commit -qm unrelated-descendant
git -C "$REPO" push -q origin HEAD:main
DEPLOYED_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
UNRELATED_DEPLOYED_COMMIT="$DEPLOYED_COMMIT"

# An unrelated descendant is valid, but a deployed descendant that changes the
# same process tree cannot finalize the older release even with unchanged live
# Spring method/path/class mappings.
reset_state "$(printf 'a%.0s' {1..32})"
manifest_path="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/manifest.json"
jq '.descendantMutation=true' "$manifest_path" >"$manifest_path.tmp" && mv "$manifest_path.tmp" "$manifest_path"
git -C "$REPO" add "$manifest_path"
git -C "$REPO" commit -qm same-process-descendant
git -C "$REPO" push -q origin HEAD:main
DEPLOYED_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
SAME_PROCESS_DEPLOYED_COMMIT="$DEPLOYED_COMMIT"
if invoke_finalize >/dev/null 2>&1; then
  echo 'same-process deployed descendant unexpectedly finalized the old release' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null
git -C "$REPO" revert --no-edit HEAD >/dev/null
git -C "$REPO" push -q origin HEAD:main
DEPLOYED_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
RESTORED_DEPLOYED_COMMIT="$DEPLOYED_COMMIT"

# Marker movement during the mappings proof is retried from the new immutable
# commit. An unrelated descendant stabilizes and passes on attempt two.
MARKER_SEQUENCE_FILE="$TMP/marker-sequence"
export MARKER_SEQUENCE_FILE RESULT_COMMIT UNRELATED_DEPLOYED_COMMIT SAME_PROCESS_DEPLOYED_COMMIT RESTORED_DEPLOYED_COMMIT
reset_state "$(printf 'a%.0s' {1..32})"
FIXTURE_MARKER_SEQUENCE="$RESULT_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n" invoke_finalize
jq -e '.writes==1 and .status=="GENERATED" and .eventCount==1' "$STATE" >/dev/null

# A marker advance to a same-process descendant is rejected before accepting
# mappings that still happen to match the older operation surface.
reset_state "$(printf 'a%.0s' {1..32})"
if FIXTURE_MARKER_SEQUENCE="$RESULT_COMMIT\n$SAME_PROCESS_DEPLOYED_COMMIT\n$SAME_PROCESS_DEPLOYED_COMMIT\n" invoke_finalize >/dev/null 2>&1; then
  echo 'same-process marker advance unexpectedly finalized stale mappings' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

# Continuous marker motion exhausts the bounded three attempts and performs no
# terminal DB write.
reset_state "$(printf 'a%.0s' {1..32})"
if FIXTURE_MARKER_SEQUENCE="$RESULT_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n$RESULT_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n$RESULT_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n" invoke_finalize >/dev/null 2>&1; then
  echo 'continuously moving deploy marker unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

# Even after one stable before/after proof, a final marker change immediately
# before SQL finalization is rejected.
reset_state "$(printf 'a%.0s' {1..32})"
if FIXTURE_MARKER_SEQUENCE="$RESULT_COMMIT\n$RESULT_COMMIT\n$UNRELATED_DEPLOYED_COMMIT\n" invoke_finalize >/dev/null 2>&1; then
  echo 'terminal-edge deploy marker change unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null
DEPLOYED_COMMIT="$RESTORED_DEPLOYED_COMMIT"

# Missing, mismatched and stale extra Spring bindings all fail closed before
# the terminal DB transaction.
reset_state "$(printf 'a%.0s' {1..32})"
jq '.contexts.application.mappings.dispatcherServlets.dispatcherServlet=[]' \
  "$MAPPINGS.good" >"$MAPPINGS"
if invoke_finalize >/dev/null 2>&1; then
  echo 'missing runtime binding unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

reset_state "$(printf 'a%.0s' {1..32})"
jq '.contexts.application.mappings.dispatcherServlets.dispatcherServlet[0].details.handlerMethod.name="staleExecute"' \
  "$MAPPINGS.good" >"$MAPPINGS"
if invoke_finalize >/dev/null 2>&1; then
  echo 'mismatched runtime handler unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

reset_state "$(printf 'a%.0s' {1..32})"
jq '.contexts.application.mappings.dispatcherServlets.dispatcherServlet += [{"details":{"handlerMethod":{"className":"egovframework.com.generated.canonical.CompleteActivityPlanController","name":"execute"},"requestMappingConditions":{"methods":["POST"],"patterns":["/api/generated/proc/stale"]}}}]' \
  "$MAPPINGS.good" >"$MAPPINGS"
if invoke_finalize >/dev/null 2>&1; then
  echo 'extra generated runtime binding unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

cp "$MAPPINGS.good" "$MAPPINGS"
reset_state "$(printf 'a%.0s' {1..32})"
if FIXTURE_DEPLOY_SECONDS=61 invoke_finalize >/dev/null 2>&1; then
  echo '61-second canonical deployment unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .eventCount==0' "$STATE" >/dev/null

reset_state "$(printf 'a%.0s' {1..32})"
invoke_finalize
jq -e --arg rollback "$(git -C "$REPO" rev-parse "$RESULT_COMMIT^")" \
  '.writes==1 and .status=="GENERATED" and .jobStatus=="VERIFIED" and .eventCount==1
   and .artifactStatus=="VERIFIED" and .rollbackRef==$rollback
   and (.evidence.sourceHash|length)==32 and (.evidence.packageHash|length)==64
   and (.evidence.designCatalogHash|length)==64 and (.evidence.endpointCatalogHash|length)==64
   and (.evidence.releaseHash|length)==64' "$STATE" >/dev/null

# Missing, duplicate or wrong process-artifact ownership rolls the entire
# terminal transaction back and preserves READY/RUNNING.
for artifact_case in missing duplicate wrong; do
  case "$artifact_case" in
    missing) reset_state "$(printf 'a%.0s' {1..32})" 0 0 true ;;
    duplicate) reset_state "$(printf 'a%.0s' {1..32})" 0 2 true ;;
    wrong) reset_state "$(printf 'a%.0s' {1..32})" 0 1 false ;;
  esac
  if invoke_finalize >/dev/null 2>&1; then
    echo "$artifact_case canonical artifact unexpectedly finalized" >&2
    exit 1
  fi
  jq -e '.writes==0 and .status=="READY" and .jobStatus=="RUNNING"
    and .artifactStatus=="PENDING" and .eventCount==0' "$STATE" >/dev/null
done

# A dirty canonical worktree cannot substitute self-consistent mutable JSON for
# the already-published RESULT_COMMIT tree.
reset_state "$(printf 'a%.0s' {1..32})"
python3 - "$PACKAGE" "$RELEASE" <<'PY'
import hashlib,json,sys
from pathlib import Path
stable=lambda value:json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
package_path,release_path=map(Path,sys.argv[1:])
package=json.loads(package_path.read_text()); package["fixtureMutation"]=True
package.pop("packageHash"); package["packageHash"]=hashlib.sha256(stable(package).encode()).hexdigest()
package_path.write_text(json.dumps(package))
index_path=package_path.with_name("index.json"); index=json.loads(index_path.read_text())
index["packages"][0]["packageHash"]=package["packageHash"]; index.pop("manifestHash")
index["manifestHash"]=hashlib.sha256(stable(index).encode()).hexdigest(); index_path.write_text(json.dumps(index))
release=json.loads(release_path.read_text()); release["packageManifestHash"]=index["manifestHash"]
release.pop("releaseHash"); release["releaseHash"]=hashlib.sha256(stable(release).encode()).hexdigest()
release_path.write_text(json.dumps(release))
PY
if invoke_finalize >/dev/null 2>&1; then
  echo 'mutable worktree canonical evidence unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .jobStatus=="RUNNING" and .eventCount==0' "$STATE" >/dev/null
git -C "$REPO" restore --worktree -- \
  projects/carbonet-backend-metadata/process-runtime/generated/PROC/PROC__STEP.json \
  projects/carbonet-backend-metadata/process-runtime/generated/PROC/index.json \
  projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/full-stack-release.json

# Restore one successful terminal state for immutability/idempotency probes.
reset_state "$(printf 'a%.0s' {1..32})"
invoke_finalize

# Terminal evidence is immutable even if a later caller presents the same job
# with a different already-recorded payload.
recorded_rollback="$(jq -r '.rollbackRef' "$STATE")"
jq '.evidence.releaseHash=("0"*64)' "$STATE" >"$STATE.tmp"
mv "$STATE.tmp" "$STATE"
if invoke_finalize >/dev/null 2>&1; then
  echo 'terminal canonical evidence was overwritten' >&2
  exit 1
fi
jq -e --arg rollback "$recorded_rollback" \
  '.writes==1 and .eventCount==1 and .evidence.releaseHash==("0"*64) and .rollbackRef==$rollback' "$STATE" >/dev/null

# Commit-ack ambiguity: transaction commits, transport fails, exact readback
# succeeds without a second terminal write.
reset_state "$(printf 'a%.0s' {1..32})" 1
invoke_finalize
jq -e '.writes==1 and .ambiguous==0 and .status=="GENERATED" and .eventCount==1' "$STATE" >/dev/null

# A design edit after generation invalidates sourceHash and writes nothing.
reset_state "$(printf '9%.0s' {1..32})"
if invoke_finalize >/dev/null 2>&1; then
  echo 'stale source hash unexpectedly finalized' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY" and .jobStatus=="RUNNING" and .eventCount==0' "$STATE" >/dev/null

# A self-consistent package index still fails when its manifestHash is not the
# one bound into the immutable full-stack release.
reset_state "$(printf 'a%.0s' {1..32})"
python3 - "$PACKAGE" <<'PY'
import hashlib,json,sys
from pathlib import Path
path=Path(sys.argv[1]).with_name("index.json")
value=json.loads(path.read_text()); value.pop("manifestHash"); value["fixtureMutation"]=True
stable=lambda item: json.dumps(item,ensure_ascii=False,sort_keys=True,separators=(",",":"))
value["manifestHash"]=hashlib.sha256(stable(value).encode()).hexdigest()
path.write_text(json.dumps(value))
PY
if invoke_finalize >/dev/null 2>&1; then
  echo 'release/package manifest binding mutation escaped' >&2
  exit 1
fi
jq -e '.writes==0 and .status=="READY"' "$STATE" >/dev/null
git -C "$REPO" restore --worktree -- \
  projects/carbonet-backend-metadata/process-runtime/generated/PROC/PROC__STEP.json \
  projects/carbonet-backend-metadata/process-runtime/generated/PROC/index.json \
  projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/full-stack-release.json \
  projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/manifest.json

decision="$(CANONICAL_READY_BEFORE=3 CANONICAL_READY_AFTER=3 CANONICAL_READY_COUNT=3 \
  CANONICAL_ACTIVE_JOBS=2 CANONICAL_FAILED_JOBS=0 CANONICAL_EXACT_JOBS=0 CANONICAL_QUEUED_JOBS=1 \
  bash "$ORCHESTRATOR" --canonical-generation-decision-contract)"
jq -e '.status=="DEFERRED" and .reason=="CANONICAL_EVIDENCE_PUBLICATION_PENDING" and .readyBefore==3 and .readyAfter==3 and .activeJobs==2 and .queuedJobs==1' <<<"$decision" >/dev/null

# The worker counts untracked generated Java, validates manifest scope before
# its generic 20-file limit, compiles once before publication, and compiles
# again after a rebase. A failed second compile must make the push count zero.
PREPUBLISH="$TMP/prepublish"
git init -q "$PREPUBLISH"
git -C "$PREPUBLISH" config user.name fixture
git -C "$PREPUBLISH" config user.email fixture@example.invalid
mkdir -p "$PREPUBLISH/ops/scripts"
cp "$ROOT/ops/scripts/validate-deterministic-fullstack-diff.sh" "$PREPUBLISH/ops/scripts/"
mkdir -p "$PREPUBLISH/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/SECOND/src/main/java/egovframework/generated"
printf 'package egovframework.generated; public class ExistingSecondProcess {}\n' \
  >"$PREPUBLISH/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/SECOND/src/main/java/egovframework/generated/ExistingSecondProcess.java"
printf 'seed\n' >"$PREPUBLISH/README"
git -C "$PREPUBLISH" add .
git -C "$PREPUBLISH" commit -qm seed
python3 - "$PREPUBLISH" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]); process="PROC"; step="STEP"
stable=lambda value: json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
digest=lambda value: hashlib.sha256(value if isinstance(value,bytes) else value.encode()).hexdigest()
design_hash="d"*64
catalog_hash="b"*64
endpoint_catalog_hash="c"*64
screen={"screenKey":"PROC:STEP","designHash":design_hash}
package={
    "schemaVersion":"2.0.0",
    "process":{"code":process},
    "step":{"code":step},
    "canonicalCatalogHash":catalog_hash,
    "canonicalScreens":[screen],
}
package["packageHash"]=digest(stable(package))
package_ref={
    "processCode":process,"stepCode":step,"package":"PROC__STEP.json",
    "packageHash":package["packageHash"],"pages":1,
}
package_index={
    "schemaVersion":"2.0.0","packageCount":1,"skippedReviewRequired":0,
    "packages":[package_ref],"canonicalCatalogHash":catalog_hash,
    "canonicalScreens":[screen],
}
package_index["manifestHash"]=digest(stable(package_index))
for lane in ("generated","design-preview"):
    base=root/"projects/carbonet-backend-metadata/process-runtime"/lane/process
    base.mkdir(parents=True,exist_ok=True)
    (base/"PROC__STEP.json").write_text(json.dumps(package)+'\n')
    (base/"index.json").write_text(json.dumps(package_index)+'\n')
endpoint=root/"projects/carbonet-backend-metadata/process-runtime/generated-endpoints"/process
operation_key="CompleteActivityPlan"
handler_class=f"egovframework.com.generated.canonical.{operation_key}Controller"
operation={
    "operationKey":operation_key,"method":"POST",
    "path":"/api/generated/proc/{executionId}/complete",
    "handlerClass":handler_class,"handlerMethod":"execute",
    "designHash":design_hash,"endpointHash":"e"*64,
}
artifacts=[]
for suffix in ("Controller","Request","Response"):
    relative=f"src/main/java/egovframework/com/generated/canonical/{operation_key}{suffix}.java"
    target=endpoint/relative; target.parent.mkdir(parents=True,exist_ok=True)
    source=f"package egovframework.com.generated.canonical; public class {operation_key}{suffix} {{}}\n"
    target.write_text(source)
    artifacts.append({
        "path":relative,"sha256":digest(source),"designHash":design_hash,
        "endpointHash":operation["endpointHash"],
    })
artifacts.sort(key=lambda item:item["path"])
manifest={
    "schema":"carbonet.generated-endpoints/v1",
    "adapter":"EXISTING_PROCESS_COMMAND_RUNTIME",
    "catalogHash":endpoint_catalog_hash,"generatorHash":"1"*64,
    "artifactCount":len(artifacts),"artifacts":artifacts,"operations":[operation],
}
manifest["artifactHash"]=digest(stable(artifacts))
manifest["bundleHash"]=digest(stable(manifest))
release={
    "schema":"carbonet.canonical-full-stack-release/v1",
    "activationPolicy":"SOURCE_IMMEDIATE_V1",
    "lanes":["FRONTEND","API","DATABASE","HELP","CARDS"],
    "designCatalogHash":catalog_hash,"endpointCatalogHash":endpoint_catalog_hash,
    "designHashes":[design_hash],"packageManifestHash":package_index["manifestHash"],
    "endpointBundleHash":manifest["bundleHash"],
}
release["releaseHash"]=digest(stable(release))
(endpoint/"manifest.json").write_text(json.dumps(manifest)+'\n')
(endpoint/"full-stack-release.json").write_text(json.dumps(release)+'\n')
PY
COMPILE_COUNT="$TMP/compile-count"
PUSH_MARKER="$TMP/push-marker"
FAKE_COMPILE="$TMP/fake-compile.sh"
FAKE_REBASE="$TMP/fake-rebase.sh"
FAKE_PUSH="$TMP/fake-push.sh"
cat >"$FAKE_COMPILE" <<'SH'
#!/usr/bin/env bash
count=0; [[ ! -f "$COMPILE_COUNT" ]] || count="$(cat "$COMPILE_COUNT")"
count=$((count+1)); printf '%s\n' "$count" >"$COMPILE_COUNT"
IFS=: read -r -a sources <<<"${CANONICAL_ENDPOINT_SOURCE_DIRS:?}"
[[ "${#sources[@]}" -eq 2 ]]
printf '%s\n' "${sources[@]}" | grep -Fqx "$1/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/src/main/java"
printf '%s\n' "${sources[@]}" | grep -Fqx "$1/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/SECOND/src/main/java"
if [[ "${MUTATE_AFTER_COMPILE:-false}" == true ]]; then
  printf '// compile hook mutation\n' >>"$1/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/src/main/java/egovframework/com/generated/canonical/CompleteActivityPlanController.java"
fi
[[ "${FAIL_SECOND_COMPILE:-false}" != true || "$count" -ne 2 ]]
SH
cat >"$FAKE_REBASE" <<'SH'
#!/usr/bin/env bash
second="$1/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/SECOND/src/main/java/egovframework/generated/ExistingSecondProcess.java"
printf '// incoming committed dependency drift forces a full-set recompile\n' >>"$second"
git -C "$1" add "${second#"$1"/}"
git -C "$1" commit -qm incoming-second-process-drift
SH
cat >"$FAKE_PUSH" <<'SH'
#!/usr/bin/env bash
printf 'pushed\n' >"$PUSH_MARKER"
SH
chmod +x "$FAKE_COMPILE" "$FAKE_REBASE" "$FAKE_PUSH"
export COMPILE_COUNT PUSH_MARKER
if env PGDATABASE=fake PGUSER=fake PGPASSWORD=fake ROOT_DIR="$PREPUBLISH" \
    WORKTREE_ROOT="$TMP/prepublish-wt-fail" LOG_ROOT="$TMP/prepublish-log-fail" LOCK_FILE="$TMP/prepublish-fail.lock" \
    CANONICAL_WORKTREE="$PREPUBLISH" CANONICAL_PROCESS_CODE=PROC \
    CANONICAL_ENDPOINT_COMPILE_COMMAND="$FAKE_COMPILE" CANONICAL_CONTRACT_REBASE_COMMAND="$FAKE_REBASE" \
    CANONICAL_CONTRACT_PUSH_COMMAND="$FAKE_PUSH" FAIL_SECOND_COMPILE=true \
    bash "$WORKER" --canonical-prepublish-contract >/dev/null 2>&1; then
  echo 'post-rebase compile failure unexpectedly succeeded' >&2
  exit 1
fi
[[ "$(cat "$COMPILE_COUNT")" == 2 && ! -e "$PUSH_MARKER" ]]

# A compile command is an untrusted verifier: mutating canonical bytes after a
# successful compile is detected before its push hook can run.
proc_controller="$PREPUBLISH/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROC/src/main/java/egovframework/com/generated/canonical/CompleteActivityPlanController.java"
cp "$proc_controller" "$TMP/proc-controller.java"
rm -f "$COMPILE_COUNT" "$PUSH_MARKER"
if env PGDATABASE=fake PGUSER=fake PGPASSWORD=fake ROOT_DIR="$PREPUBLISH" \
    WORKTREE_ROOT="$TMP/prepublish-wt-mutate" LOG_ROOT="$TMP/prepublish-log-mutate" LOCK_FILE="$TMP/prepublish-mutate.lock" \
    CANONICAL_WORKTREE="$PREPUBLISH" CANONICAL_PROCESS_CODE=PROC \
    CANONICAL_ENDPOINT_COMPILE_COMMAND="$FAKE_COMPILE" MUTATE_AFTER_COMPILE=true \
    CANONICAL_CONTRACT_PUSH_COMMAND="$FAKE_PUSH" \
    bash "$WORKER" --canonical-prepublish-contract >/dev/null 2>&1; then
  echo 'compile-hook canonical mutation unexpectedly reached push' >&2
  exit 1
fi
[[ "$(cat "$COMPILE_COUNT")" == 1 && ! -e "$PUSH_MARKER" ]]
cp "$TMP/proc-controller.java" "$proc_controller"

# With both exact compiles green, the same bounded fixture reaches publication.
git -C "$PREPUBLISH" restore --worktree -- .
rm -f "$COMPILE_COUNT" "$PUSH_MARKER"
env PGDATABASE=fake PGUSER=fake PGPASSWORD=fake ROOT_DIR="$PREPUBLISH" \
  WORKTREE_ROOT="$TMP/prepublish-wt-pass" LOG_ROOT="$TMP/prepublish-log-pass" LOCK_FILE="$TMP/prepublish-pass.lock" \
  CANONICAL_WORKTREE="$PREPUBLISH" CANONICAL_PROCESS_CODE=PROC \
  CANONICAL_ENDPOINT_COMPILE_COMMAND="$FAKE_COMPILE" CANONICAL_CONTRACT_REBASE_COMMAND="$FAKE_REBASE" \
  CANONICAL_CONTRACT_PUSH_COMMAND="$FAKE_PUSH" \
  bash "$WORKER" --canonical-prepublish-contract >/dev/null
[[ "$(cat "$COMPILE_COUNT")" == 2 && -s "$PUSH_MARKER" ]]

# Parse and execute the exact production transaction in a disposable PostgreSQL
# instance. The fake DB above controls transport ambiguity; this fixture proves
# the SQL itself and terminal idempotency.
IMAGE="docker.io/library/postgres:16"
PG_PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
PG_PASSWORD="status-$RANDOM-$$"
if command -v ctr >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1 \
    && sudo ctr -n k8s.io images ls -q | grep -Fxq "$IMAGE"; then
  PG_RUNTIME=ctr
  sudo ctr -n k8s.io run --detach --net-host \
    --env "POSTGRES_PASSWORD=$PG_PASSWORD" --env POSTGRES_DB=status \
    --env "PGPORT=$PG_PORT" "$IMAGE" "$PG_CONTAINER"
else
  PG_RUNTIME=docker
  docker image inspect postgres:16 >/dev/null
  docker run --detach --rm --name "$PG_CONTAINER" \
    --publish "127.0.0.1:${PG_PORT}:${PG_PORT}" \
    --env "POSTGRES_PASSWORD=$PG_PASSWORD" --env POSTGRES_DB=status \
    postgres:16 -c "port=$PG_PORT" >/dev/null
fi
PG_STARTED=1
export PGPASSWORD="$PG_PASSWORD"
for _ in $(seq 1 100); do
  psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep .1
done
psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN coalesce(nullif(btrim(source),'')::jsonb,fallback);
EXCEPTION WHEN others THEN RETURN fallback; END $$;
CREATE TABLE framework_step_execution_spec(
 process_code text,step_code text,source_hash text,design_status text,
 approval_status text,generation_status text,updated_at timestamp);
CREATE TABLE framework_development_job(
 job_id bigint PRIMARY KEY,job_status text,quality_status text,result_json text,
 evidence_ref text,rollback_ref text,completed_at timestamp,lease_token text,
 lease_until timestamp,updated_at timestamp,last_error text,specification_json text);
CREATE TABLE framework_process_artifact(
 artifact_id bigserial PRIMARY KEY,
 process_code text,step_code text,contract_ref text,delivery_status text,
 evidence_ref text,updated_at timestamp);
CREATE TABLE framework_development_job_event(
 job_id bigint,event_type text,from_status text,to_status text,worker_id text,detail_json text);
INSERT INTO framework_step_execution_spec VALUES(
 'PROC','STEP','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','DESIGN_COMPLETE','APPROVED','READY',now());
INSERT INTO framework_development_job VALUES(
 202,'RUNNING','PENDING','{}',null,null,null,'22222222-2222-2222-2222-222222222222',now()+interval '1 hour',now(),null,'{}');
INSERT INTO framework_process_artifact(process_code,step_code,contract_ref,delivery_status,evidence_ref,updated_at) VALUES(
 'PROC','STEP','AUTO:FULL_STACK_GENERATION','PENDING',null,now());
SQL
REAL_PSQL="$TMP/real-psql.sh"
cat >"$REAL_PSQL" <<EOF
#!/usr/bin/env bash
exec env PGPASSWORD='$PG_PASSWORD' psql -h 127.0.0.1 -p '$PG_PORT' -U postgres -d status -X -q -v ON_ERROR_STOP=1 -At "\$@"
EOF
chmod +x "$REAL_PSQL"
invoke_real_finalize() {
  env ROOT_DIR="$REPO" WORKTREE_ROOT="$TMP/real-worker-wt" LOG_ROOT="$TMP/real-logs" \
    LOCK_FILE="$TMP/real-worker.lock" PGDATABASE=status PGUSER=postgres PGPASSWORD="$PG_PASSWORD" \
    PROCESS_WORKER_PSQLQ_COMMAND="$REAL_PSQL" CANONICAL_FINALIZE_RETRY_SLEEP_SECONDS=0 \
    CANONICAL_PACKAGE_FILE="$PACKAGE" CANONICAL_RELEASE_FILE="$RELEASE" \
    CANONICAL_RESULT_COMMIT="$RESULT_COMMIT" CANONICAL_JOB_ID=202 \
    CANONICAL_DEPLOYED_COMMIT="$DEPLOYED_COMMIT" \
    CANONICAL_LEASE_TOKEN=22222222-2222-2222-2222-222222222222 \
    CANONICAL_PROCESS_CODE=PROC CANONICAL_STEP_CODE=STEP CANONICAL_WORKTREE="$REPO" \
    CANONICAL_RUNTIME_MAPPINGS_FILE="$MAPPINGS" CANONICAL_DEPLOY_ELAPSED_SECONDS=42 \
    CANONICAL_WORKER_ID=real-postgres-fixture CANONICAL_LOG_FILE="$TMP/real.log" \
    JOB_TYPE=FULL_STACK_GENERATION bash "$WORKER" --canonical-finalize-contract
}

reset_real_case() {
  local artifact_case="$1"
  psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 >/dev/null <<SQL
truncate framework_development_job_event,framework_process_artifact,framework_development_job,framework_step_execution_spec restart identity;
insert into framework_step_execution_spec values(
 'PROC','STEP','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','DESIGN_COMPLETE','APPROVED','READY',now());
  insert into framework_development_job values(
  202,'RUNNING','PENDING','{}',null,null,null,'22222222-2222-2222-2222-222222222222',now()+interval '1 hour',now(),null,'{}');
SQL
  case "$artifact_case" in
    exact)
      psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
        "insert into framework_process_artifact(process_code,step_code,contract_ref,delivery_status,updated_at) values('PROC','STEP','AUTO:FULL_STACK_GENERATION','PENDING',now())" ;;
    missing) ;;
    wrong)
      psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
        "insert into framework_process_artifact(process_code,step_code,contract_ref,delivery_status,updated_at) values('PROC','STEP','AUTO:OTHER','PENDING',now())" ;;
    duplicate)
      psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
        "insert into framework_process_artifact(process_code,step_code,contract_ref,delivery_status,updated_at) values('PROC','STEP','AUTO:FULL_STACK_GENERATION','PENDING',now()),('PROC','STEP','AUTO:FULL_STACK_GENERATION','PENDING',now())" ;;
  esac
}

for artifact_case in missing wrong duplicate; do
  reset_real_case "$artifact_case"
  if invoke_real_finalize >/dev/null 2>&1; then
    echo "real PostgreSQL $artifact_case artifact unexpectedly finalized" >&2
    exit 1
  fi
  failed_result="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
    "select s.generation_status||'|'||j.job_status||'|'||j.quality_status||'|'||(select count(*) from framework_development_job_event)||'|'||coalesce((select string_agg(delivery_status,',' order by artifact_id) from framework_process_artifact),'NONE') from framework_step_execution_spec s cross join framework_development_job j where j.job_id=202")"
  [[ "$failed_result" == "READY|RUNNING|PENDING|0|"* ]]
  [[ "$failed_result" != *VERIFIED* ]]
done
reset_real_case exact
invoke_real_finalize
invoke_real_finalize
real_result="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select s.generation_status||'|'||j.job_status||'|'||j.quality_status||'|'||j.rollback_ref||'|'||(select count(*) from framework_process_artifact where delivery_status='VERIFIED' and evidence_ref=j.evidence_ref)||'|'||(select count(*) from framework_development_job_event where event_type='CANONICAL_RELEASE_FINALIZED') from framework_step_execution_spec s cross join framework_development_job j where j.job_id=202")"
[[ "$real_result" == "GENERATED|VERIFIED|VERIFIED|$(git -C "$REPO" rev-parse "$RESULT_COMMIT^")|1|1" ]]

invoke_failure_transition() {
  local lease="$1"
  env ROOT_DIR="$REPO" WORKTREE_ROOT="$TMP/failure-worker-wt" LOG_ROOT="$TMP/failure-logs" \
    LOCK_FILE="$TMP/failure-worker.lock" PGDATABASE=status PGUSER=postgres PGPASSWORD="$PG_PASSWORD" \
    PROCESS_WORKER_PSQLQ_COMMAND="$REAL_PSQL" CANONICAL_JOB_ID=202 \
    CANONICAL_LEASE_TOKEN="$lease" CANONICAL_WORKER_ID=failure-fixture \
    CANONICAL_ROLLBACK_COMMIT="$(git -C "$REPO" rev-parse "$RESULT_COMMIT^")" \
    CANONICAL_FAILURE_MESSAGE='post-finalize readback unavailable' CANONICAL_LOG_FILE="$TMP/failure.log" \
    bash "$WORKER" --canonical-failure-transition-contract
}

# A terminal commit followed by a persistent readback outage cannot append a
# contradictory FAILED event after the lease has already been cleared.
invoke_failure_transition 22222222-2222-2222-2222-222222222222
post_terminal_failure="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select job_status||'|'||(select count(*) from framework_development_job_event where event_type='FAILED') from framework_development_job where job_id=202")"
[[ "$post_terminal_failure" == 'VERIFIED|0' ]]

# Lease-lost failures write nothing; an exactly owned RUNNING lease writes one
# FAILED transition and one matching event in the same statement.
reset_real_case exact
invoke_failure_transition 33333333-3333-3333-3333-333333333333
lease_lost_failure="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select job_status||'|'||(select count(*) from framework_development_job_event where event_type='FAILED') from framework_development_job where job_id=202")"
[[ "$lease_lost_failure" == 'RUNNING|0' ]]
invoke_failure_transition 22222222-2222-2222-2222-222222222222
owned_failure="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select job_status||'|'||(select count(*) from framework_development_job_event where event_type='FAILED') from framework_development_job where job_id=202")"
[[ "$owned_failure" == 'FAILED|1' ]]

# The publication critical section is a real PostgreSQL session, not a sequence
# of unrelated psql calls. This fixture supplies the same process-wide head
# shape as V20260815121600 and exercises cross-host contention and stale saves.
psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
alter table framework_development_job
  add column process_code text,
  add column step_code text,
  add column job_type text,
  add column job_group_code text,
  add column worker_id text;
create table framework_process_generation_head_fixture(
  process_code text primary key,
  process_input_hash text not null,
  process_step_count integer not null,
  generation_ready_step_count integer not null,
  coordinator_step text not null,
  process_endpoint_expected integer not null,
  screen_count integer not null,
  design_set_hash text not null,
  design_catalog_hash text not null,
  design_catalog_text_hash text not null,
  endpoint_catalog_hash text not null,
  endpoint_catalog_text_hash text not null
);
create or replace function framework_process_generation_input(requested_process text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'schema','carbonet.process-generation-head/v1',
    'processCode',head.process_code,
    'processInputHash',head.process_input_hash,
    'processStepCount',head.process_step_count,
    'generationReadyStepCount',head.generation_ready_step_count,
    'coordinatorStep',head.coordinator_step,
    'processEndpointExpected',head.process_endpoint_expected,
    'screenCount',head.screen_count,
    'designSetHash',head.design_set_hash,
    'designCatalogHash',head.design_catalog_hash,
    'designCatalogTextHash',head.design_catalog_text_hash,
    'endpointCatalogHash',head.endpoint_catalog_hash,
    'endpointCatalogTextHash',head.endpoint_catalog_text_hash,
    'input','{}'::jsonb)
  from framework_process_generation_head_fixture head
  where head.process_code=requested_process
$$;
SQL

HASH_1="$(printf '1%.0s' {1..64})"
HASH_2="$(printf '2%.0s' {1..64})"
HASH_3="$(printf '3%.0s' {1..64})"
HASH_4="$(printf '4%.0s' {1..64})"
HASH_5="$(printf '5%.0s' {1..64})"
HASH_6="$(printf '6%.0s' {1..64})"
HASH_7="$(printf '7%.0s' {1..64})"
DESIGN_SET_HASH="$(printf 'd%.0s' {1..64})"
DESIGN_CATALOG_HASH="$(printf 'b%.0s' {1..64})"
DESIGN_CATALOG_TEXT_HASH="$(printf 'c%.0s' {1..64})"
ENDPOINT_CATALOG_HASH="$(printf 'e%.0s' {1..64})"
ENDPOINT_CATALOG_TEXT_HASH="$(printf 'f%.0s' {1..64})"
TRIGGER_DESIGN_HASH="$(printf 'a%.0s' {1..64})"
LOCK_LEASE_1=31111111-1111-1111-1111-111111111111
LOCK_LEASE_2=32222222-2222-2222-2222-222222222222
LOCK_LEASE_3=33333333-3333-3333-3333-333333333333
LOCK_LEASE_4=34444444-4444-4444-4444-444444444444
LOCK_LEASE_5=35555555-5555-5555-5555-555555555555
LOCK_LEASE_6=36666666-6666-6666-6666-666666666666
LOCK_LEASE_7=37777777-7777-7777-7777-777777777777

publication_spec() {
  local process="$1" hash="$2" step_count="$3" endpoint_count="$4"
  jq -cn --arg process "$process" --arg hash "$hash" \
    --arg design_set_hash "$DESIGN_SET_HASH" --arg design_hash "$TRIGGER_DESIGN_HASH" \
    --arg design_catalog_hash "$DESIGN_CATALOG_HASH" \
    --arg design_catalog_text_hash "$DESIGN_CATALOG_TEXT_HASH" \
    --arg endpoint_catalog_hash "$ENDPOINT_CATALOG_HASH" \
    --arg endpoint_catalog_text_hash "$ENDPOINT_CATALOG_TEXT_HASH" \
    --argjson step_count "$step_count" --argjson endpoint_count "$endpoint_count" '{
      algorithm:"CANONICAL_PROCESS_PUBLICATION_V1",generatorRequired:true,reuseCommonAssets:true,
      processCode:$process,stepCode:"STEP_1",coordinatorStep:"STEP_1",
      processInputHash:$hash,sourceHash:$hash,designSetHash:$design_set_hash,
      designCatalogHash:$design_catalog_hash,designCatalogTextHash:$design_catalog_text_hash,
      endpointCatalogHash:$endpoint_catalog_hash,endpointCatalogTextHash:$endpoint_catalog_text_hash,
      designHash:$design_hash,processStepCount:$step_count,
      generationReadyStepCount:$step_count,endpointExpected:$endpoint_count,
      routePath:"/fixture",audience:"USER",autoDeploy:false
    }'
}

reset_publication_process() {
  local process="$1" job_id="$2" lease="$3" hash="$4" step_count="$5" endpoint_count="$6" spec="$7"
  psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 \
    -v process="$process" -v job_id="$job_id" -v lease="$lease" -v hash="$hash" \
    -v step_count="$step_count" -v endpoint_count="$endpoint_count" \
    -v design_set_hash="$DESIGN_SET_HASH" -v design_catalog_hash="$DESIGN_CATALOG_HASH" \
    -v design_catalog_text_hash="$DESIGN_CATALOG_TEXT_HASH" \
    -v endpoint_catalog_hash="$ENDPOINT_CATALOG_HASH" \
    -v endpoint_catalog_text_hash="$ENDPOINT_CATALOG_TEXT_HASH" -v spec="$spec" >/dev/null <<'SQL'
delete from framework_development_job where process_code=:'process';
delete from framework_step_execution_spec where process_code=:'process';
delete from framework_process_generation_head_fixture where process_code=:'process';
insert into framework_process_generation_head_fixture values(
  :'process',:'hash',:step_count,:step_count,'STEP_1',:endpoint_count,:step_count,:'design_set_hash',
  :'design_catalog_hash',:'design_catalog_text_hash',:'endpoint_catalog_hash',:'endpoint_catalog_text_hash');
insert into framework_step_execution_spec(
  process_code,step_code,source_hash,design_status,approval_status,generation_status,updated_at)
select :'process','STEP_'||series,:'hash','DESIGN_COMPLETE','APPROVED','READY',now()
from generate_series(1,:step_count) series;
insert into framework_development_job(
  job_id,job_status,quality_status,result_json,lease_token,lease_until,updated_at,
  process_code,step_code,job_type,job_group_code,specification_json,worker_id)
values(:job_id,'RUNNING','PENDING','{}',:'lease',now()+interval '1 hour',now(),
  :'process','STEP_1','FULL_STACK_GENERATION',:'process'||'_CANONICAL_PUBLICATION',:'spec','publication-fixture');
SQL
}

invoke_publication_contract() {
  local process="$1" job_id="$2" lease="$3" spec="$4" slot_lock="$5" host_lock="$6" app_name="$7"
  shift 7
  local specification_base64
  specification_base64="$(printf '%s' "$spec" | base64 | tr -d '\n')"
  local -a publication_command=(
    env "ROOT_DIR=$REPO" "WORKTREE_ROOT=$TMP/publication-wt" "LOG_ROOT=$TMP/publication-logs"
    "LOCK_FILE=$slot_lock" "AI_PUBLISH_LOCK_FILE=$host_lock"
    PGDATABASE=status PGUSER=postgres "PGPASSWORD=$PG_PASSWORD"
    "PROCESS_WORKER_PSQLQ_COMMAND=$REAL_PSQL" "PROCESS_WORKER_PSQL_SESSION_COMMAND=$REAL_PSQL"
    "CANONICAL_JOB_ID=$job_id" "CANONICAL_LEASE_TOKEN=$lease" "CANONICAL_PROCESS_CODE=$process"
    "CANONICAL_SPECIFICATION_B64=$specification_base64"
    "CANONICAL_PUBLICATION_DB_APPLICATION_NAME=$app_name"
    "$@" bash "$WORKER" --canonical-publication-lock-contract
  )
  if [[ "${PUBLICATION_CONTRACT_REPLACE_SHELL:-0}" = 1 ]]; then
    exec "${publication_command[@]}"
  fi
  "${publication_command[@]}"
}

wait_for_file() {
  local path="$1"
  for _ in $(seq 1 100); do
    [[ -e "$path" ]] && return 0
    sleep .05
  done
  return 1
}

WAIT_PUSH="$TMP/wait-publication-push.sh"
PASS_PUSH="$TMP/pass-publication-push.sh"
RETRY_PUSH="$TMP/retry-publication-push.sh"
cat >"$WAIT_PUSH" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
while [[ ! -e "${PUBLICATION_RELEASE_FILE:?}" ]]; do sleep .05; done
SH
cat >"$PASS_PUSH" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ -z "${PUBLICATION_PUSH_MARKER:-}" ]] || : >"$PUBLICATION_PUSH_MARKER"
SH
cat >"$RETRY_PUSH" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
process="$1"
attempt="$2"
observed="$("${PROCESS_WORKER_PSQLQ_COMMAND:?}" -c "
  select pg_try_advisory_lock(1128353359,1296124238)||'|'||
    pg_try_advisory_lock(hashtextextended(
      'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(\$process\$${process}\$process\$)),0));")"
printf '%s\n' "$observed" >>"${PUBLICATION_LOCK_OBSERVATIONS:?}"
printf '%s\n' "$attempt" >"${PUBLICATION_RETRY_COUNT:?}"
[[ "$observed" == 'false|false' && "$attempt" -ge 3 ]]
SH
chmod +x "$WAIT_PUSH" "$PASS_PUSH" "$RETRY_PUSH"

# Session A holds both DB locks. A second worker with a different host flock
# reaches PostgreSQL and waits on the fixed MAIN key, proving cross-host scope.
LOCK_SPEC_1="$(publication_spec PROC_LOCK "$HASH_1" 2 2)"
OTHER_SPEC="$(publication_spec PROC_OTHER "$HASH_3" 1 1)"
reset_publication_process PROC_LOCK 301 "$LOCK_LEASE_1" "$HASH_1" 2 2 "$LOCK_SPEC_1"
reset_publication_process PROC_OTHER 302 "$LOCK_LEASE_3" "$HASH_3" 1 1 "$OTHER_SPEC"
LOCK_READY_A="$TMP/publication-a.ready"
LOCK_READY_B="$TMP/publication-b.ready"
LOCK_RELEASE_A="$TMP/publication-a.release"
invoke_publication_contract PROC_LOCK 301 "$LOCK_LEASE_1" "$LOCK_SPEC_1" \
  "$TMP/slot-a.lock" "$TMP/host-a.lock" publication-lock-a \
  CANONICAL_PUBLICATION_READY_FILE="$LOCK_READY_A" \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$WAIT_PUSH" \
  PUBLICATION_RELEASE_FILE="$LOCK_RELEASE_A" >"$TMP/publication-a.log" 2>&1 &
PUBLICATION_A_PID=$!
PUBLICATION_PIDS+=("$PUBLICATION_A_PID")
wait_for_file "$LOCK_READY_A"
invoke_publication_contract PROC_OTHER 302 "$LOCK_LEASE_3" "$OTHER_SPEC" \
  "$TMP/slot-b.lock" "$TMP/host-b.lock" publication-lock-b \
  CANONICAL_PUBLICATION_READY_FILE="$LOCK_READY_B" \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" >"$TMP/publication-b.log" 2>&1 &
PUBLICATION_B_PID=$!
PUBLICATION_PIDS+=("$PUBLICATION_B_PID")
main_waiters=0
for _ in $(seq 1 100); do
  main_waiters="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
    "select count(*) from pg_locks where locktype='advisory' and classid=1128353359 and objid=1296124238 and not granted")"
  (( main_waiters > 0 )) && break
  sleep .05
done
(( main_waiters > 0 ))
[[ ! -e "$LOCK_READY_B" ]]

# A design save uses the exact process key. It remains blocked until A's push
# hook succeeds, then atomically installs the new process input and job revision.
LOCK_SPEC_2="$(publication_spec PROC_LOCK "$HASH_2" 2 2)"
psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 \
  -v hash="$HASH_2" -v process=PROC_LOCK -v spec="$LOCK_SPEC_2" >"$TMP/save-wait.log" <<'SQL' &
begin;
select pg_advisory_xact_lock(hashtextextended(
  'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(:'process')),0));
update framework_process_generation_head_fixture set process_input_hash=:'hash' where process_code=:'process';
update framework_step_execution_spec set source_hash=:'hash',generation_status='READY' where process_code=:'process';
update framework_development_job
   set specification_json=:'spec',job_status='PLANNED',lease_token=null,lease_until=null,updated_at=now()
 where process_code=:'process';
commit;
SQL
SAVE_PID=$!
PUBLICATION_PIDS+=("$SAVE_PID")
sleep .25
kill -0 "$SAVE_PID"
blocked_state="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select head.process_input_hash||'|'||job.job_status from framework_process_generation_head_fixture head join framework_development_job job using(process_code) where head.process_code='PROC_LOCK'")"
[[ "$blocked_state" == "$HASH_1|RUNNING" ]]
: >"$LOCK_RELEASE_A"
wait "$PUBLICATION_A_PID"
wait "$SAVE_PID"
wait "$PUBLICATION_B_PID"
[[ -e "$LOCK_READY_B" ]]
saved_state="$(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -Atqc \
  "select head.process_input_hash||'|'||job.job_status||'|'||coalesce(job.lease_token,'') from framework_process_generation_head_fixture head join framework_development_job job using(process_code) where head.process_code='PROC_LOCK'")"
[[ "$saved_state" == "$HASH_2|PLANNED|" ]]

# The stale claimed bytes/lease are rejected after the save. Only the newly
# claimed revision with the new process head may enter its push hook.
if invoke_publication_contract PROC_LOCK 301 "$LOCK_LEASE_1" "$LOCK_SPEC_1" \
    "$TMP/slot-stale.lock" "$TMP/host-stale.lock" publication-stale \
    CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" >/dev/null 2>&1; then
  echo 'stale process generation head unexpectedly entered publication' >&2
  exit 1
fi
psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d status -v ON_ERROR_STOP=1 \
  -v lease="$LOCK_LEASE_2" >/dev/null <<'SQL'
update framework_development_job
   set job_status='RUNNING',lease_token=:'lease',lease_until=now()+interval '1 hour'
 where process_code='PROC_LOCK';
SQL
invoke_publication_contract PROC_LOCK 301 "$LOCK_LEASE_2" "$LOCK_SPEC_2" \
  "$TMP/slot-new.lock" "$TMP/host-new.lock" publication-new \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" >/dev/null

# All three simulated push attempts observe both advisory locks as unavailable
# from an independent session. No retry releases/reacquires either lock.
RETRY_SPEC="$(publication_spec PROC_RETRY "$HASH_3" 1 1)"
reset_publication_process PROC_RETRY 303 "$LOCK_LEASE_3" "$HASH_3" 1 1 "$RETRY_SPEC"
RETRY_COUNT="$TMP/publication-retry.count"
RETRY_OBSERVATIONS="$TMP/publication-retry.observations"
if ! invoke_publication_contract PROC_RETRY 303 "$LOCK_LEASE_3" "$RETRY_SPEC" \
    "$TMP/slot-retry.lock" "$TMP/host-retry.lock" publication-retry \
    CANONICAL_PUBLICATION_PUSH_COMMAND="$RETRY_PUSH" \
    PUBLICATION_RETRY_COUNT="$RETRY_COUNT" \
    PUBLICATION_LOCK_OBSERVATIONS="$RETRY_OBSERVATIONS" \
    CANONICAL_PUBLICATION_RETRY_SLEEP_SECONDS=0 >"$TMP/publication-retry.log" 2>&1; then
  cat "$TMP/publication-retry.log" >&2
  [[ ! -f "$RETRY_OBSERVATIONS" ]] || cat "$RETRY_OBSERVATIONS" >&2
  exit 1
fi
[[ "$(cat "$RETRY_COUNT")" == 3 ]]
[[ "$(wc -l <"$RETRY_OBSERVATIONS")" == 3 ]]
[[ "$(sort -u "$RETRY_OBSERVATIONS")" == 'false|false' ]]

# Push completion releases the MAIN/host locks but keeps the process lock. A
# different process can publish immediately while a same-process save remains
# blocked until terminal cleanup (well below the 60-second deploy SLO here).
HOLD_SPEC="$(publication_spec PROC_HOLD "$HASH_6" 1 1)"
NEXT_SPEC="$(publication_spec PROC_NEXT "$HASH_7" 1 1)"
reset_publication_process PROC_HOLD 306 "$LOCK_LEASE_6" "$HASH_6" 1 1 "$HOLD_SPEC"
reset_publication_process PROC_NEXT 307 "$LOCK_LEASE_7" "$HASH_7" 1 1 "$NEXT_SPEC"
AFTER_PUSH_FIFO="$TMP/publication-after-push.fifo"
AFTER_PUSH_READY="$TMP/publication-after-push.ready"
NEXT_PUSH_MARKER="$TMP/publication-next.push"
mkfifo "$AFTER_PUSH_FIFO"
PUBLICATION_CONTRACT_REPLACE_SHELL=1 invoke_publication_contract \
  PROC_HOLD 306 "$LOCK_LEASE_6" "$HOLD_SPEC" \
  "$TMP/slot-hold.lock" "$TMP/host-hold.lock" publication-hold \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" \
  CANONICAL_PUBLICATION_AFTER_PUSH_READY_FILE="$AFTER_PUSH_READY" \
  CANONICAL_PUBLICATION_AFTER_PUSH_WAIT_FIFO="$AFTER_PUSH_FIFO" \
  >"$TMP/publication-hold.log" 2>&1 &
HOLD_WORKER_PID=$!
PUBLICATION_PIDS+=("$HOLD_WORKER_PID")
wait_for_file "$AFTER_PUSH_READY"
invoke_publication_contract PROC_NEXT 307 "$LOCK_LEASE_7" "$NEXT_SPEC" \
  "$TMP/slot-next.lock" "$TMP/host-next.lock" publication-next \
  CANONICAL_PUBLICATION_LOCK_WAIT_SECONDS=2 \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" \
  PUBLICATION_PUSH_MARKER="$NEXT_PUSH_MARKER" >/dev/null
[[ -e "$NEXT_PUSH_MARKER" ]]
same_process_wait_started="$(date +%s%3N)"
$REAL_PSQL -c "select pg_advisory_xact_lock(hashtextextended(
  'CANONICAL_PROCESS_PUBLICATION_V1:PROC_HOLD',0));" >"$TMP/same-process-save.log" &
SAME_PROCESS_SAVE_PID=$!
PUBLICATION_PIDS+=("$SAME_PROCESS_SAVE_PID")
sleep .25
kill -0 "$SAME_PROCESS_SAVE_PID"
printf 'terminal\n' >"$AFTER_PUSH_FIFO"
wait "$HOLD_WORKER_PID"
wait "$SAME_PROCESS_SAVE_PID"
same_process_wait_millis="$(( $(date +%s%3N) - same_process_wait_started ))"
(( same_process_wait_millis < 60000 ))

# SIGTERM runs the worker trap, closes the persistent psql process and releases
# both locks. A FIFO keeps the main shell itself blocked, avoiding child-signal
# ambiguity in the mutant.
TERM_SPEC="$(publication_spec PROC_TERM "$HASH_4" 1 1)"
reset_publication_process PROC_TERM 304 "$LOCK_LEASE_4" "$HASH_4" 1 1 "$TERM_SPEC"
TERM_FIFO="$TMP/publication-term.fifo"
TERM_READY="$TMP/publication-term.ready"
mkfifo "$TERM_FIFO"
PUBLICATION_CONTRACT_REPLACE_SHELL=1 invoke_publication_contract PROC_TERM 304 "$LOCK_LEASE_4" "$TERM_SPEC" \
  "$TMP/slot-term.lock" "$TMP/host-term.lock" publication-term \
  CANONICAL_PUBLICATION_READY_FILE="$TERM_READY" CANONICAL_PUBLICATION_WAIT_FIFO="$TERM_FIFO" \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" >"$TMP/publication-term.log" 2>&1 &
TERM_WORKER_PID=$!
PUBLICATION_PIDS+=("$TERM_WORKER_PID")
wait_for_file "$TERM_READY"
term_held="$($REAL_PSQL -c "select pg_try_advisory_lock(1128353359,1296124238)||'|'||pg_try_advisory_lock(hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC_TERM',0))")"
[[ "$term_held" == 'false|false' ]]
kill -TERM "$TERM_WORKER_PID"
if wait "$TERM_WORKER_PID"; then
  echo 'SIGTERM publication worker unexpectedly exited successfully' >&2
  exit 1
fi
term_released="$($REAL_PSQL -c "select pg_try_advisory_lock(1128353359,1296124238)||'|'||pg_try_advisory_lock(hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC_TERM',0))")"
[[ "$term_released" == 'true|true' ]]

# PostgreSQL backend loss itself releases both locks. Once the blocked shell is
# resumed, its heartbeat fails and the push hook is never accepted.
DROP_SPEC="$(publication_spec PROC_DROP "$HASH_5" 1 1)"
reset_publication_process PROC_DROP 305 "$LOCK_LEASE_5" "$HASH_5" 1 1 "$DROP_SPEC"
DROP_FIFO="$TMP/publication-drop.fifo"
DROP_READY="$TMP/publication-drop.ready"
mkfifo "$DROP_FIFO"
PUBLICATION_CONTRACT_REPLACE_SHELL=1 invoke_publication_contract PROC_DROP 305 "$LOCK_LEASE_5" "$DROP_SPEC" \
  "$TMP/slot-drop.lock" "$TMP/host-drop.lock" publication-drop \
  CANONICAL_PUBLICATION_READY_FILE="$DROP_READY" CANONICAL_PUBLICATION_WAIT_FIFO="$DROP_FIFO" \
  CANONICAL_PUBLICATION_PUSH_COMMAND="$PASS_PUSH" >"$TMP/publication-drop.log" 2>&1 &
DROP_WORKER_PID=$!
PUBLICATION_PIDS+=("$DROP_WORKER_PID")
wait_for_file "$DROP_READY"
drop_backend="$($REAL_PSQL -c "select pid from pg_stat_activity where application_name='publication-drop' and pid<>pg_backend_pid()")"
[[ "$drop_backend" =~ ^[0-9]+$ ]]
[[ "$($REAL_PSQL -c "select pg_terminate_backend($drop_backend)")" == t ]]
drop_released="$($REAL_PSQL -c "select pg_try_advisory_lock(1128353359,1296124238)||'|'||pg_try_advisory_lock(hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC_DROP',0))")"
[[ "$drop_released" == 'true|true' ]]
printf 'resume\n' >"$DROP_FIFO"
if wait "$DROP_WORKER_PID"; then
  echo 'disconnected publication DB session unexpectedly reached push success' >&2
  exit 1
fi

echo 'CANONICAL_GENERATION_PUBLICATION_STATUS_PASS prePushWrites=0 pushFailureWrites=0 runtimeMissingWrites=0 runtimeMismatchWrites=0 runtimeExtraWrites=0 slo61Writes=0 successWrites=1 ambiguousWrites=1 staleWrites=0 terminalEvents=1 terminalImmutable=1 artifactMissingWrites=0 artifactWrongWrites=0 artifactDuplicateWrites=0 mutableWorktreeWrites=0 rollbackParentExact=1 unrelatedDescendant=PASS sameProcessDescendantWrites=0 markerAdvanceUnrelated=RETRY_PASS markerAdvanceSameProcessWrites=0 markerContinuousWrites=0 markerTerminalEdgeWrites=0 postTerminalFalseFailedEvents=0 leaseLostFailureWrites=0 ownedFailureEvents=1 bindingMutations=1 crossProcessCompileDirs=2 prepublishCompileFailCount=2 prepublishPushOnFail=0 compileHookMutationPush=0 prepublishCompilePassCount=2 prepublishPushOnPass=1 realPostgres=1 publicationSessions=2 mainContention=PASS staleSaveBlocked=PASS newHead=PASS pushRetriesLocked=3 mainReleaseBeforeDeploy=PASS processLockThroughFinalize=PASS sameProcessWaitUnder60s=PASS sigtermRelease=PASS disconnectRelease=PASS orchestrator=DEFERRED legacy=preserved liveDb=0'

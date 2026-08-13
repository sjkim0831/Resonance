#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER="$ROOT/ops/scripts/run-process-development-worker.sh"
ORCHESTRATOR="$ROOT/ops/scripts/run-project-auto-completion-orchestrator.sh"
TMP="$(mktemp -d)"
PG_CONTAINER="canonical-status-$RANDOM-$$"
PG_STARTED=0
cleanup() {
  set +e
  if (( PG_STARTED )); then
    sudo ctr -n k8s.io tasks kill --signal SIGKILL "$PG_CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n k8s.io tasks rm --force "$PG_CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n k8s.io containers rm "$PG_CONTAINER" >/dev/null 2>&1 || true
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
sudo -n true >/dev/null
sudo ctr -n k8s.io images ls -q | grep -Fxq "$IMAGE"
PG_PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
PG_PASSWORD="status-$RANDOM-$$"
sudo ctr -n k8s.io run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PG_PASSWORD" --env POSTGRES_DB=status \
  --env "PGPORT=$PG_PORT" "$IMAGE" "$PG_CONTAINER"
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
 lease_until timestamp,updated_at timestamp,last_error text);
CREATE TABLE framework_process_artifact(
 artifact_id bigserial PRIMARY KEY,
 process_code text,step_code text,contract_ref text,delivery_status text,
 evidence_ref text,updated_at timestamp);
CREATE TABLE framework_development_job_event(
 job_id bigint,event_type text,from_status text,to_status text,worker_id text,detail_json text);
INSERT INTO framework_step_execution_spec VALUES(
 'PROC','STEP','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','DESIGN_COMPLETE','APPROVED','READY',now());
INSERT INTO framework_development_job VALUES(
 202,'RUNNING','PENDING','{}',null,null,null,'22222222-2222-2222-2222-222222222222',now()+interval '1 hour',now(),null);
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
 202,'RUNNING','PENDING','{}',null,null,null,'22222222-2222-2222-2222-222222222222',now()+interval '1 hour',now(),null);
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

echo 'CANONICAL_GENERATION_PUBLICATION_STATUS_PASS prePushWrites=0 pushFailureWrites=0 runtimeMissingWrites=0 runtimeMismatchWrites=0 runtimeExtraWrites=0 slo61Writes=0 successWrites=1 ambiguousWrites=1 staleWrites=0 terminalEvents=1 terminalImmutable=1 artifactMissingWrites=0 artifactWrongWrites=0 artifactDuplicateWrites=0 mutableWorktreeWrites=0 rollbackParentExact=1 unrelatedDescendant=PASS sameProcessDescendantWrites=0 markerAdvanceUnrelated=RETRY_PASS markerAdvanceSameProcessWrites=0 markerContinuousWrites=0 markerTerminalEdgeWrites=0 postTerminalFalseFailedEvents=0 leaseLostFailureWrites=0 ownedFailureEvents=1 bindingMutations=1 crossProcessCompileDirs=2 prepublishCompileFailCount=2 prepublishPushOnFail=0 compileHookMutationPush=0 prepublishCompilePassCount=2 prepublishPushOnPass=1 realPostgres=1 orchestrator=DEFERRED legacy=preserved liveDb=0'

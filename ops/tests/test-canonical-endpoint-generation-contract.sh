#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
GRADLE="$ROOT/modules/resonance-common/carbonet-common-core/build.gradle.kts"

python3 - "$TARGET" "$GRADLE" <<'PY'
import sys
from pathlib import Path

source=Path(sys.argv[1]).read_text(encoding="utf-8")
gradle_text=Path(sys.argv[2]).read_text(encoding="utf-8")

def require_contract(value: str) -> None:
    required=(
        'CANONICAL_ENDPOINT_CATALOG',
        'CANONICAL_ENDPOINT_AUTODETECT',
        'LIMIT_VALIDATED=1',
        'LINKED_WORKTREE_VALIDATED=1',
        "to_regprocedure('public.framework_canonical_endpoint_catalog(integer)')",
        "to_regprocedure('public.framework_source_canonical_endpoint_catalog(integer,character varying)')",
        "to_regprocedure('public.framework_source_canonical_design_catalog(integer,character varying)')",
        "to_regprocedure('public.framework_source_canonical_endpoint_readiness(integer,character varying)')",
        'endpoint_readiness_expression',
        'with source_snapshot as materialized',
        '$(endpoint_readiness_expression) endpoint_readiness',
        "'endpointReadiness',endpoint_readiness",
        'CANONICAL_ENDPOINT_DEFERRED',
        'explicit endpoint catalog rejected while canonical endpoint readiness is PARTIAL',
        'framework_canonical_endpoint_catalog(%s)',
        'framework_process_generation_snapshot($selector) runtime',
        '$(design_catalog_expression) design',
        "column_name in ('execution_id','tenant_id','project_id','execution_version')",
        'generate-spring-api-from-design.py',
        '"$ENDPOINT_STAGE" --workers "$WORKERS" --check',
        'generate-safe-migrations-from-design.py" "$RUNTIME_STAGE" --root "$ROOT" --check',
        '.generated==0',
        '(.legacySkipped+.unchanged)==.packages',
        '([.endpoints[].endpointContract.operations[]|[.processCode,.stepCode]]|unique|sort)',
        '--canonical-catalog "$DESIGN_CATALOG_TMP"',
        'five-lane canonical design hashes diverged',
        'designCatalogHash:$designCatalogHash',
        'endpointCatalogHash:$endpointCatalogHash',
        'releaseHash=$releaseHash',
        'ENDPOINT_OUT="$ENDPOINT_OUT/$PROCESS_CODE"',
        'CANONICAL_ENDPOINT_SOURCE_DIRS="$build_sources"',
        'endpoint_process_sources',
        'mixed legacy-root and process-scoped endpoint layouts are forbidden',
        'endpoint source layout changed between preflight and publish',
        'published release marker cross-hash verification failed',
        'CANONICAL_RELEASE_READY',
        'bash "$ROOT/gradlew" "$GRADLE_TASK"',
        '--publish-set',
        'carbonet.canonical-full-stack-release/v1',
        'SOURCE_IMMEDIATE_V1',
        '"FRONTEND","API","DATABASE","HELP","CARDS"',
    )
    for token in required:
        if token not in value:
            raise AssertionError(f"orchestration token missing: {token}")
    if value.count('--canonical-catalog "$DESIGN_CATALOG_TMP"') < 3:
        raise AssertionError("runtime/preview canonical design binding is incomplete")
    endpoint_check=value.index('"$ENDPOINT_STAGE" --workers "$WORKERS" --check')
    endpoint_generate=value.index('"$ENDPOINT_STAGE" --workers "$WORKERS"\n', endpoint_check)
    migration_check=value.index('generate-safe-migrations-from-design.py" "$RUNTIME_STAGE" --root "$ROOT" --check')
    publish=value.index('--publish-set')
    gradle_index=value.index('bash "$ROOT/gradlew" "$GRADLE_TASK"')
    if not endpoint_check < endpoint_generate < migration_check < gradle_index < publish:
        raise AssertionError("preflight/stage/schema-check/build/publish order is unsafe")
    post_publish=value[publish:]
    if 'generate-safe-migrations-from-design.py" "$OUT" --root "$ROOT"' in post_publish and 'if [[ -z "$ENDPOINT_CATALOG" ]]' not in post_publish:
        raise AssertionError("canonical publish is followed by an unsafe live migration write")
    if 'update framework_step_execution_spec' in post_publish and 'if [[ -z "$ENDPOINT_CATALOG" ]]' not in post_publish:
        raise AssertionError("canonical publish is followed by a database write")
    if 'generated-endpoints' not in gradle_text or 'src/main/java' not in gradle_text:
        raise AssertionError("generated endpoint Java is not in the backend source set")
    if 'CANONICAL_ENDPOINT_SOURCE_DIRS' not in gradle_text or 'generatedEndpointRoot.listFiles()' not in gradle_text:
        raise AssertionError("Gradle cannot compile staged endpoint Java before publish")
    for token in ('^[A-Z][A-Z0-9_]{1,79}$', 'mixed legacy-root and process-scoped generated endpoint layouts are forbidden',
                  'carbonet.generated-endpoints/v1', 'carbonet.canonical-full-stack-release/v1',
                  'artifact bytes diverge', 'Java artifact set diverges', 'Files::isSymbolicLink',
                  'manifestJson["bundleHash"] == releaseJson["endpointBundleHash"]'):
        if token not in gradle_text:
            raise AssertionError(f"Gradle strict endpoint source discovery token missing: {token}")

require_contract(source)
mutants=(
    source.replace('"$ENDPOINT_STAGE" --workers "$WORKERS" --check', '"$ENDPOINT_STAGE" --workers "$WORKERS"', 1),
    source.replace('generate-safe-migrations-from-design.py" "$RUNTIME_STAGE" --root "$ROOT" --check',
                   'generate-safe-migrations-from-design.py" "$RUNTIME_STAGE" --root "$ROOT"', 1),
    source.replace('--publish-set', '--publish-disabled', 1),
    source.replace("to_regprocedure('public.framework_canonical_endpoint_catalog(integer)')", "to_regprocedure('public.missing_endpoint_compiler(integer)')", 1),
    source.replace('$(endpoint_readiness_expression) endpoint_readiness', "jsonb_build_object('status','COMPLETE') endpoint_readiness", 1),
    source.replace('.generated==0', '.generated>=0', 1),
    source.replace('(.legacySkipped+.unchanged)==.packages', '(.legacySkipped+.unchanged)<=.packages', 1),
    source.replace('([.endpoints[].endpointContract.operations[]|[.processCode,.stepCode]]|unique|sort)', '([])', 1),
    source.replace('--canonical-catalog "$DESIGN_CATALOG_TMP"', '', 1),
    source.replace('$(design_catalog_expression) design', 'null design', 1),
    source.replace('bash "$ROOT/gradlew" "$GRADLE_TASK"', 'true "$GRADLE_TASK"', 1),
    source.replace('ENDPOINT_OUT="$ENDPOINT_OUT/$PROCESS_CODE"', 'ENDPOINT_OUT="$ENDPOINT_OUT"', 1),
    source.replace('framework_process_generation_snapshot($selector) runtime', 'null runtime', 1),
)
for index, mutant in enumerate(mutants):
    try:
        require_contract(mutant)
    except AssertionError:
        continue
    raise AssertionError(f"orchestration mutant escaped: {index}")
PY

# Two generated endpoint controllers must be discovered by the real Gradle
# source set. Use the test fixture twice with distinct routes/operations.
BUILD_WORK="$(mktemp -d)"
trap 'rm -rf "$BUILD_WORK"' EXIT
python3 - "$ROOT" "$BUILD_WORK/catalog.json" <<'PY'
import copy, importlib.util, json, sys
from pathlib import Path

root=Path(sys.argv[1]); target=Path(sys.argv[2])
spec=importlib.util.spec_from_file_location("endpoint_fixture", root/"ops/scripts/test-generate-spring-api-from-design.py")
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)
value=fixture.catalog(); second=copy.deepcopy(value["endpoints"][0])
canonical=json.loads(second["canonicalText"])
canonical["identity"].update(screenKey="ACTIVITY_DATA|ACTIVITY_DATA_01_PLAN|ADMIN|/activity/plan-review", routePath="/activity/plan-review", audience="ADMIN", actorCode="ACTIVITY_REVIEWER")
second.update(screenKey=canonical["identity"]["screenKey"], routePath=canonical["identity"]["routePath"], audience="ADMIN", canonicalText=fixture.stable(canonical))
second["designHash"]=fixture.sha(second["canonicalText"])
contract=second["endpointContract"]
contract.update(screenKey=second["screenKey"], routePath=second["routePath"], audience="ADMIN")
contract["source"]["designHash"]=second["designHash"]
operation=contract["operations"][0]
operation.update(operationId="ReviewActivityPlan", path="/api/generated/activity/{executionId}/review")
operation["authority"].update(audience="ADMIN", actorCodes=["ACTIVITY_REVIEWER"])
value["endpoints"].append(second); fixture.refresh(value)
target.write_text(json.dumps(value), encoding="utf-8")
PY
python3 "$ROOT/ops/scripts/generate-spring-api-from-design.py" "$BUILD_WORK/catalog.json" --out "$BUILD_WORK/generated" --workers 2
python3 - "$BUILD_WORK/generated" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]); manifest=json.loads((root/'manifest.json').read_text())
release={'schema':'carbonet.canonical-full-stack-release/v1','activationPolicy':'SOURCE_IMMEDIATE_V1','endpointCatalogHash':manifest['catalogHash'],
         'endpointBundleHash':manifest['bundleHash']}
release['releaseHash']=hashlib.sha256(json.dumps(release,sort_keys=True,separators=(',',':')).encode()).hexdigest()
(root/'full-stack-release.json').write_text(json.dumps(release))
PY
CANONICAL_ENDPOINT_SOURCE_DIRS="$BUILD_WORK/generated/src/main/java" \
  bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:compileJava \
    --no-daemon --console=plain --no-build-cache --rerun-tasks
[[ "$(find "$BUILD_WORK/generated/src/main/java" -name '*Controller.java' -type f | wc -l)" -eq 2 ]]
[[ -f "$ROOT/modules/resonance-common/carbonet-common-core/build/classes/java/main/egovframework/com/generated/canonical/CompleteActivityPlanController.class" ]]
[[ -f "$ROOT/modules/resonance-common/carbonet-common-core/build/classes/java/main/egovframework/com/generated/canonical/ReviewActivityPlanController.class" ]]
rm -rf "$ROOT/modules/resonance-common/carbonet-common-core/build/classes/java/main/egovframework/com/generated/canonical"

# Default runtime discovery must compile only strict process directories with
# matching manifest/release evidence; hidden crash artifacts are never sources.
DEFAULT_ROOT="$BUILD_WORK/default-root"
mkdir -p "$DEFAULT_ROOT/ACTIVITY_DATA" "$DEFAULT_ROOT/.ACTIVITY_DATA.incoming-crash/src/main/java" "$DEFAULT_ROOT/lowercase/src/main/java"
cp -a "$BUILD_WORK/generated/src" "$DEFAULT_ROOT/ACTIVITY_DATA/"
cp "$BUILD_WORK/generated/manifest.json" "$DEFAULT_ROOT/ACTIVITY_DATA/manifest.json"
python3 - "$DEFAULT_ROOT/ACTIVITY_DATA" <<'PY'
import json,sys
from pathlib import Path
root=Path(sys.argv[1]); manifest=json.loads((root/'manifest.json').read_text())
release={'schema':'carbonet.canonical-full-stack-release/v1','activationPolicy':'SOURCE_IMMEDIATE_V1','endpointCatalogHash':manifest['catalogHash'],
         'endpointBundleHash':manifest['bundleHash']}
import hashlib
release['releaseHash']=hashlib.sha256(json.dumps(release,sort_keys=True,separators=(',',':')).encode()).hexdigest()
(root/'full-stack-release.json').write_text(json.dumps(release))
PY
printf 'this must never compile\n' >"$DEFAULT_ROOT/.ACTIVITY_DATA.incoming-crash/src/main/java/Poison.java"
printf 'this must never compile\n' >"$DEFAULT_ROOT/lowercase/src/main/java/Poison.java"
CANONICAL_ENDPOINT_ROOT="$DEFAULT_ROOT" \
  bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:compileJava \
    --no-daemon --console=plain --no-build-cache --rerun-tasks
[[ -f "$ROOT/modules/resonance-common/carbonet-common-core/build/classes/java/main/egovframework/com/generated/canonical/CompleteActivityPlanController.class" ]]
TAMPERED_JAVA="$(find "$DEFAULT_ROOT/ACTIVITY_DATA/src/main/java" -name '*Controller.java' -type f | head -1)"
cp "$TAMPERED_JAVA" "$TAMPERED_JAVA.clean"
printf '\n// stale manual edit\n' >>"$TAMPERED_JAVA"
if CANONICAL_ENDPOINT_ROOT="$DEFAULT_ROOT" \
  bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:tasks --no-daemon --console=plain >/dev/null 2>&1; then
  echo 'changed Java bytes escaped manifest verification' >&2; exit 1
fi
mv "$TAMPERED_JAVA.clean" "$TAMPERED_JAVA"
ln -s ACTIVITY_DATA "$DEFAULT_ROOT/SYMLINK_PROCESS"
if CANONICAL_ENDPOINT_ROOT="$DEFAULT_ROOT" \
  bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:tasks --no-daemon --console=plain >/dev/null 2>&1; then
  echo 'symlink process directory escaped Gradle fail-closed discovery' >&2; exit 1
fi
rm "$DEFAULT_ROOT/SYMLINK_PROCESS"
mkdir -p "$DEFAULT_ROOT/src/main/java"
if CANONICAL_ENDPOINT_ROOT="$DEFAULT_ROOT" \
  bash "$ROOT/gradlew" :modules:resonance-common:carbonet-common-core:tasks --no-daemon --console=plain >/dev/null 2>&1; then
  echo 'mixed default endpoint layout escaped Gradle fail-closed discovery' >&2; exit 1
fi
rm -rf "$ROOT/modules/resonance-common/carbonet-common-core/build/classes/java/main/egovframework/com/generated/canonical"

# Execute the real orchestration shell against deterministic fake infrastructure.
# No Kubernetes/PostgreSQL connection is made; every read/write is logged.
python3 - "$ROOT" <<'PY'
import json, os, shutil, subprocess, sys, tempfile, textwrap
from pathlib import Path

real_root=Path(sys.argv[1]); shell=real_root/"ops/scripts/generate-full-stack-design-packages.sh"
design_hash="a"*64; endpoint_hash="b"*64; catalog_hash="c"*64
screen={"screenKey":"ACTIVITY_DATA|S1|USER|/activity","processCode":"ACTIVITY_DATA","stepCode":"S1","designHash":design_hash}
design={"schema":"carbonet.canonical-design/v1","catalogHash":"d"*64,"screenCount":1,"screens":[screen]}
endpoint={"schema":"carbonet.canonical-endpoint-catalog/v1","catalogHash":catalog_hash,"endpoints":[{
    **screen,"routePath":"/activity","audience":"USER","endpointHash":endpoint_hash,
    "endpointContract":{"operations":[{"processCode":"ACTIVITY_DATA","stepCode":"S1"}]},
}]}
runtime={"schemaVersion":"2.0.0","processes":[{"processCode":"ACTIVITY_DATA","steps":[]}]}

full_generator='''#!/usr/bin/env python3
import json,shutil,sys
from pathlib import Path
a=sys.argv[1:]
if a[0]=="--recover-publish-set": print(json.dumps({"recovered":False})); raise SystemExit
if a[0]=="--publish-set":
  values=a[1:]
  for src,dst in zip(values[0::2],values[1::2]):
    dst=Path(dst); shutil.rmtree(dst,ignore_errors=True); shutil.copytree(src,dst)
    if __import__('os').environ.get('FAKE_READER_LOG'):
      runtime=Path(values[1])/"index.json"; endpoint=Path(values[5]); valid=False
      try:
        index=json.loads(runtime.read_text()); manifest=json.loads((endpoint/"manifest.json").read_text()); release=json.loads((endpoint/"full-stack-release.json").read_text())
        valid=(release["packageManifestHash"]==index["manifestHash"] and release["endpointBundleHash"]==manifest["bundleHash"] and release["endpointCatalogHash"]==manifest["catalogHash"])
      except (OSError,KeyError,json.JSONDecodeError): pass
      with open(__import__('os').environ['FAKE_READER_LOG'],'a') as log: log.write(('1' if valid else '0')+'\\n')
  print(json.dumps({"published":True})); raise SystemExit
if a[0]=="--subset-canonical-catalog": print(Path(a[1]).read_text()); raise SystemExit
out=Path(a[a.index("--out")+1])
if "--check" in a:
  if not (out/"index.json").exists(): raise SystemExit(2)
  print(json.dumps({"check":True})); raise SystemExit
out.mkdir(parents=True,exist_ok=True)
catalog=None
if "--canonical-catalog" in a: catalog=json.loads(Path(a[a.index("--canonical-catalog")+1]).read_text())
screens=[] if catalog is None else [{"screenKey":x["screenKey"],"designHash":x["designHash"]} for x in catalog["screens"]]
package={"process":{"code":"ACTIVITY_DATA"},"step":{"code":"S1"},"database":{"autoGenerateMigration":False},"canonicalScreens":screens}
(out/"ACTIVITY_DATA__S1.json").write_text(json.dumps(package))
index={"packageCount":1,"manifestHash":"e"*64,"packages":[{"processCode":"ACTIVITY_DATA","stepCode":"S1"}]}
if catalog is not None: index.update(canonicalCatalogHash=catalog["catalogHash"],canonicalScreens=screens)
(out/"index.json").write_text(json.dumps(index)); print(json.dumps({"generated":1}))
'''
endpoint_generator='''#!/usr/bin/env python3
import json,sys
from pathlib import Path
a=sys.argv[1:]; catalog=json.loads(Path(a[0]).read_text()); out=Path(a[a.index("--out")+1])
if "--check" in a: print(json.dumps({"check":True})); raise SystemExit
src=out/"src/main/java"; src.mkdir(parents=True)
(src/"Fixture.java").write_text("public final class Fixture {}\\n")
artifacts=[{"designHash":x["designHash"]} for x in catalog["endpoints"]]
(out/"manifest.json").write_text(json.dumps({"catalogHash":catalog["catalogHash"],"bundleHash":"f"*64,"artifacts":artifacts}))
'''
safe_migration='''#!/usr/bin/env python3
import json,os
bad=os.environ.get("FAKE_SCENARIO")=="migration_validated"
print(json.dumps({"success":True,"packages":1,"generated":0,"unchanged":0,"legacySkipped":0 if bad else 1,"reviewRequired":0,"plans":[{"status":"VALIDATED"}] if bad else []}))
'''
kubectl='''#!/usr/bin/env bash
set -eu
echo "$*" >>"$FAKE_DB_LOG"
case "$*" in
  *"get pods"*) echo 'pod/postgres-patroni-0' ;;
  *"pg_is_in_recovery"*) echo f ;;
  *"to_regprocedure"*) echo true ;;
  *"jsonb_build_object"*) [[ "$FAKE_SCENARIO" != db_failure ]] || exit 44; cat "$FAKE_BUNDLE" ;;
  *"to_regclass"*) [[ "$FAKE_SCENARIO" != aggregate_missing ]] && echo true || echo false ;;
  *"framework_process_generation_snapshot"*) jq -c '.runtime' "$FAKE_BUNDLE" ;;
  *"update framework_step_execution_spec"*) echo WRITE >>"$FAKE_DB_LOG" ;;
  *) exit 45 ;;
esac
'''
gradlew='''#!/usr/bin/env bash
[[ "${FAKE_SCENARIO:-}" != gradle_fail ]] || exit 55
[[ -n "${CANONICAL_ENDPOINT_SOURCE_DIRS:-}" ]] || exit 56
find "${CANONICAL_ENDPOINT_SOURCE_DIRS%%:*}" -name '*.java' -type f | grep -q .
'''

def executable(path, content):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(textwrap.dedent(content)); path.chmod(0o755)

def run_case(scenario, explicit=None, lane_byte=False):
    with tempfile.TemporaryDirectory() as folder:
        root=Path(folder); (root/"ops/scripts").mkdir(parents=True)
        git_common=root/"git-common"; git_dir=git_common/"worktrees/fixture"; git_dir.mkdir(parents=True)
        executable(root/"bin/git",'''#!/usr/bin/env bash
case "$*" in
  *"--absolute-git-dir"*) echo "$FAKE_GIT_DIR" ;;
  *"--git-common-dir"*) echo "$FAKE_GIT_COMMON" ;;
  *) exit 2 ;;
esac
''')
        executable(root/"ops/scripts/generate-full-stack-design-packages.py",full_generator)
        executable(root/"ops/scripts/generate-spring-api-from-design.py",endpoint_generator)
        executable(root/"ops/scripts/generate-safe-migrations-from-design.py",safe_migration)
        executable(root/"gradlew",gradlew)
        executable(root/"bin/kubectl",kubectl)
        case_design=json.loads(json.dumps(design)); case_endpoint=json.loads(json.dumps(endpoint))
        if lane_byte:
            case_design["catalogHash"]="2"*64; case_design["screens"][0]["designHash"]="1"*64
            case_endpoint["catalogHash"]="3"*64; case_endpoint["endpoints"][0]["designHash"]="1"*64
        is_partial=scenario in {"partial","primary_partial","explicit_partial"}
        bundle={"runtime":runtime,"design":case_design,
                "endpointReadiness":{"status":"PARTIAL" if is_partial else "COMPLETE","blockerCount":1 if is_partial else 0},
                "endpoint":None if is_partial else case_endpoint}
        (root/"bundle.json").write_text(json.dumps(bundle)); (root/"db.log").write_text("")
        env={**os.environ,"PATH":str(root/"bin")+os.pathsep+os.environ["PATH"],"FAKE_SCENARIO":scenario,
             "FAKE_BUNDLE":str(root/"bundle.json"),"FAKE_DB_LOG":str(root/"db.log"),
             "FULL_STACK_PACKAGE_OUT":str(root/"out/runtime"),"FULL_STACK_PREVIEW_OUT":str(root/"out/preview"),
             "CANONICAL_ENDPOINT_OUT":str(root/"out/endpoints")}
        env.update(FAKE_GIT_DIR=str(git_dir),FAKE_GIT_COMMON=str(git_common))
        reader_log=root/"reader.log"; env["FAKE_READER_LOG"]=str(reader_log)
        if scenario=="limit_injection": env["CANONICAL_ENDPOINT_LIMIT"]="1);select pg_sleep(9);--"
        if scenario in {"primary_checkout","primary_partial"}: env["FAKE_GIT_DIR"]=str(git_common)
        if scenario in {"mixed_layout","crash_temp"}:
            process=root/"out/endpoints/OTHER_PROCESS"; (process/"src/main/java").mkdir(parents=True)
            (process/"src/main/java/Other.java").write_text("public final class Other {}")
            (process/"manifest.json").write_text(json.dumps({"schema":"carbonet.generated-endpoints/v1","catalogHash":"8"*64}))
            (process/"full-stack-release.json").write_text(json.dumps({"schema":"carbonet.canonical-full-stack-release/v1","activationPolicy":"SOURCE_IMMEDIATE_V1","endpointCatalogHash":"8"*64,"releaseHash":"7"*64}))
            if scenario=="mixed_layout": (root/"out/endpoints/src/main/java").mkdir(parents=True)
            else:
                crash=root/"out/endpoints/.OTHER_PROCESS.incoming-crash/src/main/java"; crash.mkdir(parents=True)
                (crash/"Poison.java").write_text("this must never compile")
            env["FAKE_SCENARIO"]="complete"
        if explicit:
            external=endpoint if explicit=="current" else {**endpoint,"catalogHash":"9"*64}
            (root/"external.json").write_text(json.dumps(external))
            env["CANONICAL_ENDPOINT_CATALOG"]=str(root/"external.json")
        process_scoped=scenario not in {"partial","primary_partial"}
        command=["bash",str(shell),str(root)]+(["ACTIVITY_DATA"] if process_scoped else [])
        result=subprocess.run(command,env=env,text=True,capture_output=True)
        outputs=root/"out"
        runtime_out=outputs/"runtime"/("ACTIVITY_DATA" if process_scoped else "")
        preview_out=outputs/"preview"/("ACTIVITY_DATA" if process_scoped else "")
        endpoint_out=outputs/"endpoints"/("ACTIVITY_DATA" if process_scoped else "")
        if scenario=="complete":
            assert result.returncode==0,result.stderr
            assert runtime_out.is_dir() and preview_out.is_dir() and endpoint_out.is_dir()
            assert "WRITE" not in (root/"db.log").read_text()
            release=json.loads((endpoint_out/"full-stack-release.json").read_text())
            assert set(("designCatalogHash","endpointCatalogHash","releaseHash"))<=set(release)
            assert reader_log.read_text().splitlines()==["0","0","1"]
            return release["releaseHash"]
        elif scenario in {"partial","primary_partial"}:
            assert result.returncode==0,result.stderr
            assert (outputs/"runtime").is_dir() and not (outputs/"endpoints").exists()
            assert "CANONICAL_ENDPOINT_DEFERRED" in result.stderr and "WRITE" in (root/"db.log").read_text()
        elif scenario=="crash_temp":
            assert result.returncode==0,result.stderr
            assert (endpoint_out/"src/main/java/Fixture.java").is_file()
        else:
            assert result.returncode!=0,(scenario,result.stdout,result.stderr)
            assert not runtime_out.exists() and not endpoint_out.exists()
            if scenario=="limit_injection": assert (root/"db.log").read_text()==""
        return scenario

release_hash=run_case("complete"); changed_hash=run_case("complete",lane_byte=True)
assert release_hash!=changed_hash
assert run_case("partial")=="partial"
assert run_case("primary_partial")=="primary_partial"
assert run_case("explicit_partial","current")=="explicit_partial"
assert [run_case(name, "stale" if name=="stale" else None) for name in
        ("stale","aggregate_missing","migration_validated","gradle_fail","db_failure","limit_injection","mixed_layout","crash_temp","primary_checkout")]
print("CANONICAL_ENDPOINT_SHELL_FIXTURE_PASS cases=14 complete=2 oneByte=1 partialFallback=1 primaryPartialLegacy=1 explicitPartial=1 stale=1 aggregate=1 migration=1 gradle=1 dbFailure=1 limitInjection=1 mixedLayout=1 crashTempExcluded=1 primaryRejected=1")
PY

# Unit contracts exercise authority fail-closed behavior, GET/arbitrary adapter
# rejection, missing executionId, atomic rollback, zero rewrite, and deterministic
# bounded parallel rendering without contacting Kubernetes or PostgreSQL.
python3 "$ROOT/ops/scripts/test-generate-spring-api-from-design.py"
python3 "$ROOT/ops/scripts/test-generate-full-stack-design-packages.py"

# The adapter path must reject a duplicate placeholder as well as a missing one.
python3 - "$ROOT" <<'PY'
import importlib.util, json, sys, tempfile
from pathlib import Path

root=Path(sys.argv[1])
def load(name, path):
    spec=importlib.util.spec_from_file_location(name, path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module
generator=load("endpoint_generator", root/"ops/scripts/generate-spring-api-from-design.py")
fixture=load("endpoint_fixture", root/"ops/scripts/test-generate-spring-api-from-design.py")
value=fixture.catalog()
operation=value["endpoints"][0]["endpointContract"]["operations"][0]
operation["path"] += "/{executionId}"
value["endpoints"][0]["endpointText"]=fixture.stable(value["endpoints"][0]["endpointContract"])
value["endpoints"][0]["endpointHash"]=fixture.sha(value["endpoints"][0]["endpointText"])
value["catalogHash"]=fixture.sha(value["endpoints"][0]["screenKey"]+"\x1f"+value["endpoints"][0]["endpointHash"])
with tempfile.TemporaryDirectory() as folder:
    path=Path(folder)/"catalog.json"; path.write_text(json.dumps(value), encoding="utf-8")
    try:
        generator.load_contract(path)
    except generator.ContractError as error:
        assert "exactly one {executionId}" in str(error)
    else:
        raise AssertionError("duplicate executionId placeholder escaped")
PY

echo 'CANONICAL_ENDPOINT_ORCHESTRATION_PASS autodetect=complete-only linkedWorktree=canonical-complete-only primaryPartialLegacy=1 gitCommitBoundary=1 processScoped=1 sourceSet=gradle endpoints=2 snapshotBound=1 processStepBound=1 fiveLaneHashBound=1 oneBytePropagation=1 preflightRuntimeLayout=exact strictProcessDirs=1 crashTempExcluded=1 mixedLayoutRejected=1 artifactBytesVerified=1 symlinkRejected=1 releaseMarkerLast=1 preflight=1 staged=1 migrationCheck=zero build=1 crashConsistentStaging=1 postPublishWrites=0 crashCuts=8 shellCases=14 limitInjection=1 workers=16 zeroRewrite=1 mutations=14 liveDb=0'

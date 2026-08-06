#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT_DIR/ops/scripts/runtime-candidate-checkpoint.sh"
AUTO_DEPLOY="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
BUILD_DEPLOY="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

repo="$work/repo"
fixtures="$work/fixtures"
bin="$work/bin"
asset_dir="$work/assets"
state_dir="$work/full-screen-deploy-gate"
snapshot_dir="$state_dir/snapshots/snapshot-1"
checkpoint="$work/carbonet-runtime-candidate.json"
mkdir -p "$repo" "$fixtures" "$bin" "$asset_dir/assets" "$snapshot_dir/frontend-overlay"

git -C "$repo" init -q
git -C "$repo" config user.email checkpoint-test@example.invalid
git -C "$repo" config user.name checkpoint-test
mkdir -p "$repo/apps/carbonet-api/src/main/resources/db/migration/postgresql"
printf 'base\n' >"$repo/README.md"
git -C "$repo" add .
git -C "$repo" commit -qm base
base_commit="$(git -C "$repo" rev-parse HEAD)"
migration="V20990101000000__checkpoint_resume_test.sql"
cat >"$repo/apps/carbonet-api/src/main/resources/db/migration/postgresql/$migration" <<'SQL'
create table checkpoint_resume_test (
  id bigint primary key
);
SQL
git -C "$repo" add .
git -C "$repo" commit -qm target
target_commit="$(git -C "$repo" rev-parse HEAD)"
migration_checksum="$(python3 - "$repo/apps/carbonet-api/src/main/resources/db/migration/postgresql/$migration" <<'PY'
import pathlib
import sys
import zlib

checksum = 0
for line in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    checksum = zlib.crc32(line.encode("utf-8"), checksum)
if checksum >= 2**31:
    checksum -= 2**32
print(checksum)
PY
)"
printf '%s\t%s\n' "$migration" "$migration_checksum" >"$fixtures/flyway.tsv"

printf '<html><script src="/assets/app.js"></script></html>\n' >"$asset_dir/index.html"
printf 'console.log("candidate");\n' >"$asset_dir/assets/app.js"
cp "$asset_dir/index.html" "$snapshot_dir/frontend-overlay/index.html"
printf 'events {}\n' >"$snapshot_dir/nginx.conf"
cat >"$state_dir/active.env" <<EOF
SNAPSHOT_ID='snapshot-1'
SNAPSHOT_DIR='$snapshot_dir'
SNAPSHOT_FORMAT='hardlink-tree'
RUNTIME_IMAGE='localhost:5000/carbonet-runtime:old'
WEB_IMAGE='nginx:old'
GIT_SHA='$base_commit'
EOF

image='localhost:5000/carbonet-runtime:checkpoint-test'
image_id='docker-pullable://localhost:5000/carbonet-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
release='release-checkpoint-1'

write_deployment_fixture() {
  jq -n \
    --arg target "$target_commit" --arg image "$image" --arg release "$release" '
    {
      metadata:{uid:"deployment-uid-1",generation:7,annotations:{"resonance.ai/target-commit":$target}},
      spec:{replicas:2,template:{metadata:{labels:{"resonance.ai/release-id":$release}},spec:{containers:[{name:"carbonet-runtime",image:$image}]}}},
      status:{observedGeneration:7,updatedReplicas:2,readyReplicas:2,availableReplicas:2,unavailableReplicas:0}
    }' >"$fixtures/deployment.json"
}

write_pods_fixture() {
  jq -n --arg image "$image" --arg imageId "$image_id" '
    {items:[range(0;2) | {
      metadata:{name:("candidate-" + tostring)},
      spec:{containers:[{name:"carbonet-runtime",image:$image}]},
      status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$imageId}]}
    }]}' >"$fixtures/pods.json"
}
write_deployment_fixture
write_pods_fixture
cp "$fixtures/deployment.json" "$fixtures/deployment.good.json"
cp "$fixtures/pods.json" "$fixtures/pods.good.json"
cp "$fixtures/flyway.tsv" "$fixtures/flyway.good.tsv"
cp "$asset_dir/assets/app.js" "$fixtures/app.good.js"
cp "$state_dir/active.env" "$fixtures/active.good.env"

cat >"$bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
args=" $* "
if [[ "$args" == *" get deployment "* ]]; then
  cat "$FIXTURE_DIR/deployment.json"
elif [[ "$args" == *" get pods "* ]]; then
  cat "$FIXTURE_DIR/pods.json"
elif [[ "$args" == *" exec "* && "$args" == *" psql "* ]]; then
  cat "$FIXTURE_DIR/flyway.tsv"
else
  echo "unexpected kubectl invocation: $*" >&2
  exit 90
fi
SH
cat >"$bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
url="${*: -1}"
if [[ "$url" == */actuator/health ]]; then
  [[ "${FAIL_HEALTH:-false}" != "true" ]] || exit 22
  printf '{"status":"UP"}\n'
elif [[ "$url" == */home ]]; then
  [[ "${FAIL_HOME:-false}" != "true" ]] || printf '503'
  [[ "${FAIL_HOME:-false}" == "true" ]] || printf '200'
else
  exit 90
fi
SH
chmod +x "$bin/kubectl" "$bin/curl"

export FIXTURE_DIR="$fixtures"
export CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$checkpoint"
export CARBONET_DEPLOY_ROOT="$repo"
export CARBONET_CHECKPOINT_BASE_COMMIT="$base_commit"
export CARBONET_CHECKPOINT_TARGET_COMMIT="$target_commit"
export CARBONET_CHECKPOINT_PLAN_RUNTIME=true
export CARBONET_CHECKPOINT_PLAN_FRONTEND=true
export CARBONET_CHECKPOINT_PLAN_BACKEND=true
export CARBONET_CHECKPOINT_PLAN_DATABASE=true
export CARBONET_CHECKPOINT_PLAN_BACKSTAGE=false
export CARBONET_CHECKPOINT_PLAN_INFRASTRUCTURE=false
export CARBONET_CHECKPOINT_PLAN_TESTS='runtime:test,database:test'
export CARBONET_K8S_NAMESPACE=carbonet-test
export CARBONET_K8S_DEPLOYMENT=carbonet-runtime
export CARBONET_K8S_CONTAINER=carbonet-runtime
export CARBONET_RUNTIME_BASE_URL=http://runtime.test
export CARBONET_RUNTIME_ASSET_DIR="$asset_dir"
export CARBONET_ROLLBACK_ACTIVE_FILE="$state_dir/active.env"
export CARBONET_CHECKPOINT_KUBECTL_BIN="$bin/kubectl"
export CARBONET_CHECKPOINT_CURL_BIN="$bin/curl"
export POSTGRES_POD=postgres-0
export POSTGRES_CONTAINER=patroni
export POSTGRES_DB=carbonet
export POSTGRES_USER=postgres

run_checkpoint() {
  bash "$HELPER" "$1" >/dev/null
}

expect_failure() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "[runtime-checkpoint-test] expected failure: $name" >&2
    exit 1
  fi
}

restore_live_fixtures() {
  cp "$fixtures/deployment.good.json" "$fixtures/deployment.json"
  cp "$fixtures/pods.good.json" "$fixtures/pods.json"
  cp "$fixtures/flyway.good.tsv" "$fixtures/flyway.tsv"
  cp "$fixtures/app.good.js" "$asset_dir/assets/app.js"
  cp "$fixtures/active.good.env" "$state_dir/active.env"
  unset FAIL_HEALTH FAIL_HOME
}

run_checkpoint prepare
jq -e --arg target "$target_commit" '.stage=="PREPARED" and .targetCommit==$target and .migrationRequired==true' "$checkpoint" >/dev/null
if compgen -G "${checkpoint}.tmp.*" >/dev/null; then
  echo '[runtime-checkpoint-test] atomic temporary checkpoint leaked' >&2
  exit 1
fi
run_checkpoint mark-ready
jq -e \
  --arg target "$target_commit" --arg image "$image" --arg release "$release" --arg imageId "$image_id" '
  .stage=="RUNTIME_CANDIDATE_READY" and .targetCommit==$target and .imageRef==$image and .releaseId==$release and
  .deploymentGeneration==7 and .desiredReplicas==2 and .imageIdDigest==$imageId and
  (.assetManifestSha256|length)==64 and (.migrationEvidenceSha256|length)==64 and (.activeFileSha256|length)==64' \
  "$checkpoint" >/dev/null
run_checkpoint verify
ready_hash="$(sha256sum "$checkpoint" | awk '{print $1}')"

export CARBONET_CHECKPOINT_TARGET_COMMIT="$base_commit"
expect_failure target-mismatch run_checkpoint verify
export CARBONET_CHECKPOINT_TARGET_COMMIT="$target_commit"

jq '.spec.template.spec.containers[0].image="localhost:5000/carbonet-runtime:other"' "$fixtures/deployment.good.json" >"$fixtures/deployment.json"
expect_failure image-mismatch run_checkpoint verify
restore_live_fixtures

jq '.spec.template.metadata.labels["resonance.ai/release-id"]="other-release"' "$fixtures/deployment.good.json" >"$fixtures/deployment.json"
expect_failure release-mismatch run_checkpoint verify
restore_live_fixtures

jq '.status.observedGeneration=6' "$fixtures/deployment.good.json" >"$fixtures/deployment.json"
expect_failure generation-mismatch run_checkpoint verify
restore_live_fixtures

jq '.status.readyReplicas=1' "$fixtures/deployment.good.json" >"$fixtures/deployment.json"
expect_failure replica-mismatch run_checkpoint verify
restore_live_fixtures

export FAIL_HEALTH=true
expect_failure health-failure run_checkpoint verify
restore_live_fixtures

printf 'console.log("tampered");\n' >"$asset_dir/assets/app.js"
expect_failure asset-mismatch run_checkpoint verify
restore_live_fixtures

printf '%s\t%s\n' "$migration" "$((migration_checksum + 1))" >"$fixtures/flyway.tsv"
expect_failure migration-evidence-mismatch run_checkpoint verify
restore_live_fixtures

jq '.items[1].status.containerStatuses[0].imageID="docker-pullable://other@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' "$fixtures/pods.good.json" >"$fixtures/pods.json"
expect_failure pod-digest-mismatch run_checkpoint verify
restore_live_fixtures

printf '# changed\n' >>"$state_dir/active.env"
expect_failure rollback-pointer-mismatch run_checkpoint verify
restore_live_fixtures

[[ "$(sha256sum "$checkpoint" | awk '{print $1}')" == "$ready_hash" ]] || {
  echo '[runtime-checkpoint-test] failed verification mutated the checkpoint' >&2
  exit 1
}

cp "$checkpoint" "$fixtures/checkpoint.good.json"
printf '{\n' >"$checkpoint"
malformed_hash="$(sha256sum "$checkpoint" | awk '{print $1}')"
expect_failure malformed-json run_checkpoint verify
[[ "$(sha256sum "$checkpoint" | awk '{print $1}')" == "$malformed_hash" ]] || exit 1
cp "$fixtures/checkpoint.good.json" "$checkpoint"

export CARBONET_CHECKPOINT_TARGET_COMMIT="$base_commit"
expect_failure wrong-target-clear run_checkpoint clear-success
[[ -s "$checkpoint" ]] || exit 1
export CARBONET_CHECKPOINT_TARGET_COMMIT="$target_commit"
run_checkpoint clear-success
[[ ! -e "$checkpoint" ]] || exit 1

run_checkpoint prepare
prepared_hash="$(sha256sum "$checkpoint" | awk '{print $1}')"
export FAIL_HEALTH=true
expect_failure mark-ready-health-failure run_checkpoint mark-ready
unset FAIL_HEALTH
[[ "$(jq -r '.stage' "$checkpoint")" == PREPARED ]] || exit 1
[[ "$(sha256sum "$checkpoint" | awk '{print $1}')" == "$prepared_hash" ]] || {
  echo '[runtime-checkpoint-test] failed mark-ready mutated PREPARED evidence' >&2
  exit 1
}

if [[ "${CHECKPOINT_TEST_SKIP_STATIC_SOURCE_ASSERTIONS:-false}" != "true" ]]; then
  grep -Fq 'run_runtime_candidate_checkpoint verify' "$AUTO_DEPLOY"
  grep -Fq 'run_runtime_candidate_checkpoint mark-ready' "$AUTO_DEPLOY"
  grep -Fq 'run_runtime_candidate_checkpoint clear-success' "$AUTO_DEPLOY"
  grep -Fq 'CARBONET_TARGET_COMMIT="$target_commit"' "$AUTO_DEPLOY"
  grep -Fq 'resonance.ai/target-commit=$target_commit_annotation' "$BUILD_DEPLOY"
fi

echo '[runtime-checkpoint-test] PASS exact target/image/release/generation/replicas/health/assets/migrations are fail-closed; atomic lifecycle preserves failures and clears success'

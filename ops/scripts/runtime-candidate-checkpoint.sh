#!/usr/bin/env bash
set -euo pipefail

action="${1:-verify}"
checkpoint_file="${CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE:-/opt/resonance-data/deploy/carbonet-runtime-candidate.json}"
root="${CARBONET_DEPLOY_ROOT:-${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
base_commit="${CARBONET_CHECKPOINT_BASE_COMMIT:-}"
target_commit="${CARBONET_CHECKPOINT_TARGET_COMMIT:-}"
namespace="${CARBONET_K8S_NAMESPACE:-${NAMESPACE:-carbonet-prod}}"
deployment="${CARBONET_K8S_DEPLOYMENT:-${DEPLOYMENT:-carbonet-runtime}}"
container="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
base_url="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
asset_dir="${CARBONET_RUNTIME_ASSET_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"
rollback_active_file="${CARBONET_ROLLBACK_ACTIVE_FILE:-$root/var/run/full-screen-deploy-gate/active.env}"
migration_dir_rel="${CARBONET_MIGRATION_DIR_REL:-apps/carbonet-api/src/main/resources/db/migration/postgresql}"
migration_required="${CARBONET_CHECKPOINT_PLAN_DATABASE:-false}"
postgres_pod="${POSTGRES_POD:-}"
postgres_container="${POSTGRES_CONTAINER:-patroni}"
postgres_database="${POSTGRES_DB:-carbonet}"
postgres_user="${POSTGRES_USER:-${POSTGRES_ADMIN_USER:-postgres}}"
flyway_history_table="${FLYWAY_HISTORY_TABLE:-carbonet_flyway_schema_history}"
kubectl_bin="${CARBONET_CHECKPOINT_KUBECTL_BIN:-kubectl}"
curl_bin="${CARBONET_CHECKPOINT_CURL_BIN:-curl}"
git_bin="${CARBONET_CHECKPOINT_GIT_BIN:-git}"

log() { printf '[runtime-checkpoint] %s\n' "$*"; }
# This helper is a standalone fail-closed process. Use exit rather than return:
# callers intentionally invoke `verify` in an if-condition, which disables
# Bash errexit inheritance inside functions and could otherwise continue after
# a failed evidence assertion.
fail() { log "FAIL $*" >&2; exit 1; }

sha256_stdin() {
  sha256sum | awk '{print $1}'
}

require_context() {
  [[ "$base_commit" =~ ^[0-9a-f]{40}$ ]] || fail "invalid base commit"
  [[ "$target_commit" =~ ^[0-9a-f]{40}$ ]] || fail "invalid target commit"
  [[ "$migration_required" == "true" || "$migration_required" == "false" ]] || fail "invalid database plan flag"
  "$git_bin" -C "$root" cat-file -e "${base_commit}^{commit}" 2>/dev/null || fail "base commit is unavailable"
  "$git_bin" -C "$root" cat-file -e "${target_commit}^{commit}" 2>/dev/null || fail "target commit is unavailable"
}

plan_fingerprint() {
  jq -cn \
    --arg base "$base_commit" \
    --arg target "$target_commit" \
    --arg runtime "${CARBONET_CHECKPOINT_PLAN_RUNTIME:-false}" \
    --arg frontend "${CARBONET_CHECKPOINT_PLAN_FRONTEND:-false}" \
    --arg backend "${CARBONET_CHECKPOINT_PLAN_BACKEND:-false}" \
    --arg database "$migration_required" \
    --arg backstage "${CARBONET_CHECKPOINT_PLAN_BACKSTAGE:-false}" \
    --arg infrastructure "${CARBONET_CHECKPOINT_PLAN_INFRASTRUCTURE:-false}" \
    --arg tests "${CARBONET_CHECKPOINT_PLAN_TESTS:-}" \
    '{base:$base,target:$target,runtime:$runtime,frontend:$frontend,backend:$backend,database:$database,backstage:$backstage,infrastructure:$infrastructure,tests:$tests}' |
    sha256_stdin
}

migration_fingerprint() {
  if [[ "$migration_required" != "true" ]]; then
    printf 'not-required' | sha256_stdin
    return
  fi
  "$git_bin" -C "$root" diff --binary "$base_commit" "$target_commit" -- "$migration_dir_rel" |
    sha256_stdin
}

write_changed_migration_expectations() {
  local output="$1" path script blob checksum count=0
  : >"$output"
  while IFS= read -r -d '' path; do
    script="${path##*/}"
    [[ "$script" =~ ^V[^/]*\.sql$ ]] || continue
    [[ -f "$root/$path" ]] || fail "target migration is missing from worktree: $path"
    blob="$("$git_bin" -C "$root" rev-parse "${target_commit}:${path}" 2>/dev/null)" ||
      fail "target migration blob is unavailable: $path"
    checksum="$(python3 - "$root/$path" <<'PY'
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
    printf '%s\t%s\t%s\n' "$script" "$checksum" "$blob" >>"$output"
    count=$((count + 1))
  done < <(
    "$git_bin" -C "$root" diff --name-only -z --diff-filter=ACMR \
      "$base_commit" "$target_commit" -- "$migration_dir_rel"
  )
  (( count > 0 )) || fail "database plan has no verifiable target migration"
  LC_ALL=C sort -o "$output" "$output"
}

db_migration_evidence_hash() (
  if [[ "$migration_required" != "true" ]]; then
    printf 'not-required' | sha256_stdin
    exit 0
  fi
  [[ "$flyway_history_table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "invalid Flyway history table"
  [[ -n "$postgres_pod" ]] || fail "PostgreSQL leader pod is required for migration evidence"

  local expected history evidence
  expected="$(mktemp)"
  history="$(mktemp)"
  evidence="$(mktemp)"
  trap 'rm -f "${expected:-}" "${history:-}" "${evidence:-}"' EXIT
  write_changed_migration_expectations "$expected"
  "$kubectl_bin" -n "$namespace" exec "$postgres_pod" -c "$postgres_container" -- \
    psql -h 127.0.0.1 -U "$postgres_user" -d "$postgres_database" -X -q -At -F $'\t' \
      -c "select script,checksum from ${flyway_history_table} where success and version is not null and type='SQL' and checksum is not null order by script" \
      >"$history" || fail "Flyway history query failed"

  python3 - "$expected" "$history" "$evidence" <<'PY'
import pathlib
import sys

expected_path, history_path, evidence_path = map(pathlib.Path, sys.argv[1:])
expected = {}
for line in expected_path.read_text(encoding="utf-8").splitlines():
    script, checksum, blob = line.split("\t", 2)
    expected[script] = (checksum, blob)
actual = {}
for line in history_path.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    values = line.split("\t", 1)
    if len(values) == 2:
        actual[values[0]] = values[1]
errors = []
records = []
for script in sorted(expected):
    checksum, blob = expected[script]
    if script not in actual:
        errors.append(f"missing successful migration: {script}")
        continue
    if actual[script] != checksum:
        errors.append(f"migration checksum mismatch: {script} database={actual[script]} target={checksum}")
        continue
    records.append(f"{script}\t{checksum}\t{blob}")
if errors:
    print("; ".join(errors), file=sys.stderr)
    raise SystemExit(1)
evidence_path.write_text("\n".join(records) + "\n", encoding="utf-8")
PY
  sha256sum "$evidence" | awk '{print $1}'
)

asset_hash() {
  [[ -s "$asset_dir/index.html" ]] || fail "runtime asset index is missing: $asset_dir/index.html"
  (
    cd "$asset_dir"
    find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum
  ) | sha256_stdin
}

read_rollback_field() {
  local key="$1"
  sed -n "s/^${key}='\([^']*\)'$/\1/p" "$rollback_active_file" | head -1
}

rollback_evidence_json() {
  [[ -s "$rollback_active_file" ]] || fail "rollback active pointer is missing"
  local snapshot_id snapshot_dir active_hash state_root
  snapshot_id="$(read_rollback_field SNAPSHOT_ID)"
  snapshot_dir="$(read_rollback_field SNAPSHOT_DIR)"
  [[ "$snapshot_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "invalid rollback snapshot id"
  [[ -n "$snapshot_dir" ]] || fail "rollback snapshot directory is missing"
  state_root="$(cd "$(dirname "$rollback_active_file")" && pwd -P)"
  case "$(realpath -m "$snapshot_dir")" in
    "$state_root"/snapshots/*) ;;
    *) fail "rollback snapshot path escaped state directory" ;;
  esac
  [[ -d "$snapshot_dir" && -s "$snapshot_dir/nginx.conf" ]] || fail "rollback snapshot closure is incomplete"
  if [[ ! -s "$snapshot_dir/frontend-overlay/index.html" \
     && ! -s "$snapshot_dir/frontend-overlay.tar" \
     && ! -s "$snapshot_dir/frontend-overlay.tar.gz" ]]; then
    fail "rollback frontend closure is incomplete"
  fi
  active_hash="$(sha256sum "$rollback_active_file" | awk '{print $1}')"
  jq -cn --arg id "$snapshot_id" --arg dir "$snapshot_dir" --arg hash "$active_hash" \
    '{snapshotId:$id,snapshotDir:$dir,activeFileSha256:$hash}'
}

deployment_evidence_json() (
  local deployment_json pods_json target image release uid generation observed desired updated ready available unavailable image_id pod_count
  deployment_json="$(mktemp)"
  pods_json="$(mktemp)"
  trap 'rm -f "${deployment_json:-}" "${pods_json:-}"' EXIT
  "$kubectl_bin" -n "$namespace" get deployment "$deployment" -o json >"$deployment_json" ||
    fail "deployment lookup failed"
  target="$(jq -r '.metadata.annotations["resonance.ai/target-commit"] // empty' "$deployment_json")"
  image="$(jq -r --arg container "$container" '.spec.template.spec.containers[] | select(.name==$container) | .image' "$deployment_json")"
  release="$(jq -r '.spec.template.metadata.labels["resonance.ai/release-id"] // empty' "$deployment_json")"
  uid="$(jq -r '.metadata.uid // empty' "$deployment_json")"
  generation="$(jq -r '.metadata.generation // 0' "$deployment_json")"
  observed="$(jq -r '.status.observedGeneration // 0' "$deployment_json")"
  desired="$(jq -r '.spec.replicas // 1' "$deployment_json")"
  updated="$(jq -r '.status.updatedReplicas // 0' "$deployment_json")"
  ready="$(jq -r '.status.readyReplicas // 0' "$deployment_json")"
  available="$(jq -r '.status.availableReplicas // 0' "$deployment_json")"
  unavailable="$(jq -r '.status.unavailableReplicas // 0' "$deployment_json")"
  [[ "$target" == "$target_commit" ]] || fail "deployment target annotation mismatch"
  [[ -n "$image" && -n "$release" && -n "$uid" ]] || fail "deployment identity evidence is incomplete"
  [[ "$generation" =~ ^[0-9]+$ && "$observed" == "$generation" ]] || fail "deployment generation is not observed"
  [[ "$desired" =~ ^[1-9][0-9]*$ ]] || fail "deployment desired replicas are invalid"
  [[ "$updated" == "$desired" && "$ready" == "$desired" && "$available" == "$desired" && "$unavailable" == "0" ]] ||
    fail "deployment replica gate failed desired=$desired updated=$updated ready=$ready available=$available unavailable=$unavailable"

  "$kubectl_bin" -n "$namespace" get pods \
    -l "app=$deployment,resonance.ai/release-id=$release" -o json >"$pods_json" ||
    fail "candidate pod lookup failed"
  pod_count="$(jq '.items | length' "$pods_json")"
  [[ "$pod_count" == "$desired" ]] || fail "candidate pod count mismatch desired=$desired actual=$pod_count"
  if ! jq -e --arg container "$container" --arg image "$image" '
      all(.items[];
        .status.phase == "Running" and
        any(.status.conditions[]?; .type == "Ready" and .status == "True") and
        any(.spec.containers[]; .name == $container and .image == $image) and
        any(.status.containerStatuses[]?; .name == $container and .ready == true and ((.imageID // "") | length) > 0)
      )' "$pods_json" >/dev/null; then
    fail "candidate pod image or readiness evidence failed"
  fi
  image_id="$(jq -r --arg container "$container" '[.items[].status.containerStatuses[] | select(.name==$container) | .imageID] | unique | if length == 1 then .[0] else empty end' "$pods_json")"
  [[ -n "$image_id" ]] || fail "candidate pods do not share one image digest"

  jq -cn \
    --arg target "$target" --arg image "$image" --arg release "$release" \
    --arg uid "$uid" --arg imageId "$image_id" \
    --argjson generation "$generation" --argjson desired "$desired" \
    '{targetCommit:$target,imageRef:$image,releaseId:$release,deploymentUid:$uid,deploymentGeneration:$generation,desiredReplicas:$desired,imageIdDigest:$imageId}'
)

verify_http_health() {
  local health home_status
  health="$("$curl_bin" -fsS --max-time 10 "$base_url/actuator/health")" || fail "runtime health request failed"
  jq -e '.status == "UP"' <<<"$health" >/dev/null || fail "runtime health is not UP"
  home_status="$("$curl_bin" -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$base_url/home")" ||
    fail "runtime home request failed"
  [[ "$home_status" == "200" ]] || fail "runtime home returned $home_status"
}

atomic_write() {
  local content="$1" directory tmp
  directory="$(dirname "$checkpoint_file")"
  mkdir -p "$directory"
  tmp="$(mktemp "${checkpoint_file}.tmp.XXXXXX")"
  printf '%s\n' "$content" >"$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$checkpoint_file"
}

prepare_checkpoint() {
  require_context
  local plan migration document
  plan="$(plan_fingerprint)" || fail "plan fingerprint failed"
  migration="$(migration_fingerprint)" || fail "migration fingerprint failed"
  document="$(jq -cn \
    --argjson schemaVersion 1 --arg stage PREPARED \
    --arg base "$base_commit" --arg target "$target_commit" \
    --arg plan "$plan" --arg migration "$migration" \
    --argjson migrationRequired "$migration_required" \
    --arg preparedAt "$(date -Iseconds)" \
    '{schemaVersion:$schemaVersion,stage:$stage,baseCommit:$base,targetCommit:$target,planFingerprint:$plan,migrationRequired:$migrationRequired,migrationFingerprint:$migration,preparedAt:$preparedAt}')"
  atomic_write "$document"
  log "prepared target=$target_commit"
}

checkpoint_context_matches() {
  local expected_plan expected_migration
  [[ -s "$checkpoint_file" ]] || fail "checkpoint is missing"
  jq -e '.schemaVersion == 1 and (.stage == "PREPARED" or .stage == "RUNTIME_CANDIDATE_READY")' "$checkpoint_file" >/dev/null ||
    fail "checkpoint schema is invalid"
  expected_plan="$(plan_fingerprint)" || fail "plan fingerprint failed"
  expected_migration="$(migration_fingerprint)" || fail "migration fingerprint failed"
  jq -e \
    --arg base "$base_commit" --arg target "$target_commit" \
    --arg plan "$expected_plan" --arg migration "$expected_migration" \
    --argjson migrationRequired "$migration_required" \
    '.baseCommit==$base and .targetCommit==$target and .planFingerprint==$plan and .migrationRequired==$migrationRequired and .migrationFingerprint==$migration' \
    "$checkpoint_file" >/dev/null || fail "checkpoint deployment context mismatch"
}

mark_ready() {
  require_context
  checkpoint_context_matches
  [[ "$(jq -r '.stage' "$checkpoint_file")" == "PREPARED" ]] || fail "checkpoint is not PREPARED"
  [[ "$("$git_bin" -C "$root" rev-parse HEAD)" == "$target_commit" ]] || fail "deployment worktree is not at target"
  verify_http_health
  local live rollback asset migration_evidence document
  live="$(deployment_evidence_json)" || fail "deployment evidence collection failed"
  rollback="$(rollback_evidence_json)" || fail "rollback evidence collection failed"
  asset="$(asset_hash)" || fail "asset evidence collection failed"
  migration_evidence="$(db_migration_evidence_hash)" || fail "migration evidence collection failed"
  document="$(jq -cn \
    --argjson previous "$(cat "$checkpoint_file")" \
    --argjson live "$live" --argjson rollback "$rollback" \
    --arg asset "$asset" --arg migrationEvidence "$migration_evidence" \
    --arg verifiedAt "$(date -Iseconds)" \
    '$previous + $live + $rollback + {stage:"RUNTIME_CANDIDATE_READY",assetManifestSha256:$asset,migrationEvidenceSha256:$migrationEvidence,verifiedAt:$verifiedAt}')"
  atomic_write "$document"
  log "candidate ready target=$target_commit image=$(jq -r '.imageRef' <<<"$live")"
}

verify_resume() {
  require_context
  checkpoint_context_matches
  [[ "$(jq -r '.stage' "$checkpoint_file")" == "RUNTIME_CANDIDATE_READY" ]] || fail "candidate checkpoint is not ready"
  [[ "$("$git_bin" -C "$root" rev-parse HEAD)" == "$target_commit" ]] || fail "deployment worktree is not at target"
  verify_http_health
  local live rollback asset migration_evidence
  live="$(deployment_evidence_json)" || fail "deployment evidence collection failed"
  rollback="$(rollback_evidence_json)" || fail "rollback evidence collection failed"
  asset="$(asset_hash)" || fail "asset evidence collection failed"
  migration_evidence="$(db_migration_evidence_hash)" || fail "migration evidence collection failed"
  jq -e \
    --argjson live "$live" --argjson rollback "$rollback" \
    --arg asset "$asset" --arg migrationEvidence "$migration_evidence" '
      .targetCommit == $live.targetCommit and
      .imageRef == $live.imageRef and
      .releaseId == $live.releaseId and
      .deploymentUid == $live.deploymentUid and
      .deploymentGeneration == $live.deploymentGeneration and
      .desiredReplicas == $live.desiredReplicas and
      .imageIdDigest == $live.imageIdDigest and
      .snapshotId == $rollback.snapshotId and
      .snapshotDir == $rollback.snapshotDir and
      .activeFileSha256 == $rollback.activeFileSha256 and
      .assetManifestSha256 == $asset and
      .migrationEvidenceSha256 == $migrationEvidence
    ' "$checkpoint_file" >/dev/null || fail "live candidate evidence differs from checkpoint"
  log "resume verified target=$target_commit image=$(jq -r '.imageRef' <<<"$live")"
}

clear_success() {
  [[ -e "$checkpoint_file" ]] || return 0
  [[ "$target_commit" =~ ^[0-9a-f]{40}$ ]] || fail "invalid success target"
  jq -e --arg target "$target_commit" '.schemaVersion == 1 and .targetCommit == $target' "$checkpoint_file" >/dev/null ||
    fail "refusing to remove checkpoint for another target"
  rm -f -- "$checkpoint_file"
  log "cleared successful target=$target_commit"
}

clear_failed() {
  [[ -e "$checkpoint_file" ]] || return 0
  [[ "${CARBONET_CHECKPOINT_FAILURE_RECOVERY_VERIFIED:-false}" == "true" ]] ||
    fail "failed checkpoint clear requires verified rollback recovery"
  [[ "$base_commit" =~ ^[0-9a-f]{40}$ ]] || fail "invalid failed-clear base commit"
  [[ "$target_commit" =~ ^[0-9a-f]{40}$ ]] || fail "invalid failed-clear target commit"
  jq -e --arg base "$base_commit" --arg target "$target_commit" '
    .schemaVersion == 1
    and (.stage == "PREPARED" or .stage == "RUNTIME_CANDIDATE_READY")
    and .baseCommit == $base and .targetCommit == $target
  ' "$checkpoint_file" >/dev/null ||
    fail "refusing to remove failed checkpoint for another deployment identity"
  rm -f -- "$checkpoint_file"
  sync -f "$(dirname "$checkpoint_file")" 2>/dev/null || true
  log "cleared failed target=$target_commit rollback=$base_commit"
}

case "$action" in
  prepare) prepare_checkpoint ;;
  mark-ready) mark_ready ;;
  verify) verify_resume ;;
  clear-success) clear_success ;;
  clear-failed) clear_failed ;;
  *) fail "unknown action: $action" ;;
esac

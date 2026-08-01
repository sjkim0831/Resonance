#!/usr/bin/env bash
set -euo pipefail

if [[ "${CARBONET_DEPLOY_SNAPSHOT_ACTIVE:-false}" != "true" ]]; then
  original_script="$(readlink -f "${BASH_SOURCE[0]}")"
  original_root="$(cd "$(dirname "$original_script")/../.." && pwd)"
  snapshot_script="$(mktemp /tmp/carbonet-auto-deploy-main.XXXXXX.sh)"
  cp "$original_script" "$snapshot_script"
  chmod 700 "$snapshot_script"
  export CARBONET_DEPLOY_SNAPSHOT_ACTIVE=true
  export CARBONET_DEPLOY_ORIGINAL_ROOT="$original_root"
  export CARBONET_DEPLOY_SNAPSHOT_PATH="$snapshot_script"
  exec bash "$snapshot_script" "$@"
fi

POLICY_ROOT="${CARBONET_DEPLOY_ORIGINAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
monotonic_milliseconds() {
  awk '{printf "%.0f\n", $1 * 1000}' /proc/uptime
}

DEPLOY_STARTED_EPOCH_MILLISECONDS="$(monotonic_milliseconds)"
DEPLOY_PHASE_LAST_MILLISECONDS="$DEPLOY_STARTED_EPOCH_MILLISECONDS"
DEPLOY_PHASE_FILE="$(mktemp /tmp/carbonet-deploy-phases.XXXXXX.jsonl)"

record_deploy_phase() {
  local phase="$1"
  local now_ms duration_ms
  now_ms="$(monotonic_milliseconds)"
  duration_ms=$((now_ms - DEPLOY_PHASE_LAST_MILLISECONDS))
  jq -cn \
    --arg phase "$phase" \
    --argjson durationMs "$duration_ms" \
    --argjson finishedAtMs "$now_ms" \
    '{phase:$phase,durationMs:$durationMs,finishedAtMs:$finishedAtMs}' \
    >>"$DEPLOY_PHASE_FILE"
  DEPLOY_PHASE_LAST_MILLISECONDS="$now_ms"
}

# Agent policy is deterministic and must pass before any model-generated change can deploy.
bash "$POLICY_ROOT/ops/scripts/verify-kilo-m3-policy.sh"
bash "$POLICY_ROOT/ops/scripts/verify-hermes-nvidia-two-tier.sh"
bash "$POLICY_ROOT/ops/scripts/verify-hermes-project-work-policy.sh"
if [[ -f "$POLICY_ROOT/ops/scripts/test-backstage-fast-deploy-policy.sh" ]]; then
  bash "$POLICY_ROOT/ops/scripts/test-backstage-fast-deploy-policy.sh"
else
  echo "[auto-deploy] fast-deploy policy is introduced by the pending commit; validating after bootstrap"
fi
record_deploy_phase "policy"

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-${CARBONET_DEPLOY_ORIGINAL_ROOT:-/opt/Resonance}}"
PLAN_SCRIPT="${CARBONET_DEPLOY_PLAN_SCRIPT:-ops/scripts/plan-incremental-work.sh}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
BACKSTAGE_DEPLOY_STATE_FILE="${BACKSTAGE_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/backstage-runtime-success.commit}"
BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
POSTGRES_POD="${CARBONET_POSTGRES_POD:-}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
MIN_BACKUP_BYTES="${CARBONET_MIN_BACKUP_BYTES:-1048576}"
BACKUP_TIMEOUT_SECONDS="${CARBONET_BACKUP_TIMEOUT_SECONDS:-1200}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG

record_deploy_performance() {
  local mode="$1"
  local elapsed_ms=$(( $(monotonic_milliseconds) - DEPLOY_STARTED_EPOCH_MILLISECONDS ))
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_DEPLOY_PHASE_FILE="$DEPLOY_PHASE_FILE" \
    bash "$ROOT_DIR/ops/scripts/record-deploy-performance.sh" \
      "$mode" "$target_commit" "$elapsed_ms"
}

mkdir -p \
  "$(dirname "$LOCK_FILE")" \
  "$(dirname "$DEPLOY_STATE_FILE")" \
  "$(dirname "$BACKSTAGE_DEPLOY_STATE_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "[auto-deploy] another deployment is running"; exit 0; }

cd "$ROOT_DIR"

# Poll Git before touching Kubernetes, PostgreSQL, worktrees, or backup
# storage. The one-minute timer normally observes no change; that path should
# finish as a cheap remote comparison instead of exercising every platform
# safety gate. Changed revisions still pass every existing gate below.
git fetch --quiet --prune "$REMOTE" "$BRANCH"
target_commit="$(git rev-parse "$REMOTE/$BRANCH")"
current_commit="$(git rev-parse HEAD)"
deployed_commit="$(cat "$DEPLOY_STATE_FILE" 2>/dev/null || true)"
if ! git cat-file -e "${deployed_commit}^{commit}" 2>/dev/null; then
  deployed_commit="$current_commit"
fi
record_deploy_phase "remote_change_detection"
if [[ "$deployed_commit" == "$target_commit" ]]; then
  no_change_elapsed_ms=$(( $(monotonic_milliseconds) - DEPLOY_STARTED_EPOCH_MILLISECONDS ))
  echo "[auto-deploy] already deployed: $deployed_commit (${no_change_elapsed_ms}ms)"
  rm -f -- "$DEPLOY_PHASE_FILE" "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}"
  exit 0
fi

# Publish the in-flight state before any mutable platform work. Authenticated
# E2E verifies RUNNING, and record-deploy-performance atomically promotes it to
# SUCCESS only after every fail-closed gate completes.
deploy_status_file="${CARBONET_DEPLOY_STATUS_FILE:-/opt/resonance-data/deploy/deploy-status.json}"
jq -n \
  --arg checkedAt "$(date -Iseconds)" \
  --arg status RUNNING \
  --arg category NONE \
  --arg targetCommit "$target_commit" \
  '{checkedAt:$checkedAt,status:$status,category:$category,targetCommit:$targetCommit,retryAllowed:false,retryAttempted:false,evidence:""}' \
  >"${deploy_status_file}.tmp"
chmod 0644 "${deploy_status_file}.tmp"
mv "${deploy_status_file}.tmp" "$deploy_status_file"

if [[ ! -r "$KUBECONFIG" ]]; then
  echo "[auto-deploy] refusing deployment: kubeconfig is not readable ($KUBECONFIG)" >&2
  exit 8
fi
mkdir -p "$BACKUP_DIR"

# Detached deployment worktrees are disposable build inputs. Remove leftovers
# from completed or interrupted runs before Kubernetes evaluates DiskPressure;
# otherwise the single node can taint itself before Patroni/etcd health checks.
deploy_worktree_root="${CARBONET_CLEAN_WORKTREE_BASE:-${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}/var/deploy-worktrees}"
persistent_build_worktree="$deploy_worktree_root/runtime-build"
while IFS= read -r stale_worktree; do
  [[ -n "$stale_worktree" ]] || continue
  stale_real="$(realpath -m "$stale_worktree")"
  root_real="$(realpath -m "$ROOT_DIR")"
  case "$stale_real" in
    "$deploy_worktree_root"/*)
      # Keep one operator-owned worktree so Gradle task outputs survive between
      # commits. Per-commit worktrees made every Java deployment a cold build.
      [[ "$stale_real" == "$root_real" || "$stale_real" == "$(realpath -m "$persistent_build_worktree")" ]] ||
        git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree remove --force "$stale_real"
      ;;
    *) echo "[auto-deploy] refusing unsafe stale worktree path: $stale_real" >&2; exit 23 ;;
  esac
done < <(git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree list --porcelain |
  awk -v prefix="$deploy_worktree_root/" '$1=="worktree" && index($2,prefix)==1 {print $2}')
git -C "${CARBONET_DEPLOY_ORIGINAL_ROOT:-$ROOT_DIR}" worktree prune

# Reserve both the post-deploy safety floor and worst-case build/backup work
# space after reclaiming disposable worktrees, but before database backup or
# build. A blocked run leaves the timer active for a later retry.
bash "$POLICY_ROOT/ops/scripts/deploy-capacity-gate.sh"

# A runaway reports controller previously consumed more than 24 CPU cores and
# made otherwise incremental builds and three-pod rollouts appear slow. Keep
# Kyverno's configured exclusions enabled and cap the auxiliary reporting
# workload before spending resources on a build.
if [[ -f "$POLICY_ROOT/ops/scripts/ensure-kyverno-resource-guard.sh" ]]; then
  bash "$POLICY_ROOT/ops/scripts/ensure-kyverno-resource-guard.sh"
else
  echo "[auto-deploy] Kyverno resource guard is introduced by the pending commit; validating after bootstrap"
fi

# Image/Gradle packaging can leave generated frontend trees owned by root.
# Normalize only when a foreign-owned entry is detected so the next Git
# fast-forward/restore cannot fail before the deployment plan is evaluated.
for generated_tree in \
  apps/carbonet-api/src/main/resources/static/react-app \
  projects/carbonet-assets/static/react-app \
  projects/carbonet-frontend/src/main/resources/static/react-app; do
  [[ -e "$generated_tree" ]] || continue
  if find "$generated_tree" ! -user "$(id -u)" -print -quit 2>/dev/null | grep -q .; then
    echo "[auto-deploy] repairing generated asset ownership: $generated_tree"
    sudo -n chown -R "$(id -u):$(id -g)" "$generated_tree"
  fi
done

mapfile -t postgres_paths < <(kubectl -n "$NAMESPACE" get statefulset postgres-patroni \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="patroni-data-root")].hostPath.path}{"\n"}{.spec.template.spec.volumes[?(@.name=="wal-archive")].hostPath.path}{"\n"}' \
  2>/dev/null || true)
postgres_data_path="${postgres_paths[0]:-}"
postgres_wal_path="${postgres_paths[1]:-}"
for protected_path in "$postgres_data_path" "$postgres_wal_path"; do
  if [[ -z "$protected_path" || "$protected_path" == "$ROOT_DIR"/* || "$protected_path" != /opt/resonance-data/postgresql/* ]]; then
    echo "[auto-deploy] refusing deployment: PostgreSQL storage is not isolated ($protected_path)" >&2
    exit 9
  fi
done

# A deployment must never continue while the HA database has no elected,
# writable leader. Without this gate pg_dump can emit only an empty gzip
# header and the rollout then replaces healthy application pods with pods
# that cannot connect to PostgreSQL.
mapfile -t patroni_rows < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.status.containerStatuses[0].ready}{"\n"}{end}' \
  2>/dev/null || true)
patroni_pods=()
ready_patroni=0
for patroni_row in "${patroni_rows[@]}"; do
  patroni_pods+=("${patroni_row%%|*}")
  [[ "${patroni_row##*|}" == "true" ]] && ready_patroni=$((ready_patroni + 1))
done
if [[ "$ready_patroni" -lt 2 ]]; then
  echo "[auto-deploy] refusing deployment: Patroni quorum is not ready ($ready_patroni/3)" >&2
  exit 10
fi

# Readiness alone is insufficient: a running Patroni process can report a
# recoverable state after its hostPath was unlinked. Require the PostgreSQL
# control marker on every member before any backup or rollout is attempted.
patroni_data_check_dir="$(mktemp -d /tmp/carbonet-patroni-data-check.XXXXXX)"
declare -a patroni_data_pids=()
for candidate in "${patroni_pods[@]}"; do
  (
    kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
      test -s "/home/postgres/pgdata/${candidate}/pgroot/data/PG_VERSION"
  ) >"$patroni_data_check_dir/$candidate.log" 2>&1 &
  patroni_data_pids+=("$!")
done
for candidate_index in "${!patroni_pods[@]}"; do
  candidate="${patroni_pods[$candidate_index]}"
  if ! wait "${patroni_data_pids[$candidate_index]}"; then
    cat "$patroni_data_check_dir/$candidate.log" >&2
    rm -rf "$patroni_data_check_dir"
    echo "[auto-deploy] refusing deployment: PostgreSQL data directory is missing on $candidate" >&2
    exit 15
  fi
done
rm -rf "$patroni_data_check_dir"

# Patroni can promote any ordinal. Never assume postgres-patroni-0 is the
# writable leader: pg_dump on a recovering replica can be cancelled by WAL
# replay and would unnecessarily block every deployment.
if [[ -z "$POSTGRES_POD" ]]; then
  patroni_role_dir="$(mktemp -d /tmp/carbonet-patroni-role-check.XXXXXX)"
  declare -a patroni_role_pids=()
  for candidate in "${patroni_pods[@]}"; do
    (
      kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
        psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
          -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true
    ) >"$patroni_role_dir/$candidate" &
    patroni_role_pids+=("$!")
  done
  for candidate_index in "${!patroni_pods[@]}"; do
    wait "${patroni_role_pids[$candidate_index]}" || true
  done
  for candidate in "${patroni_pods[@]}"; do
    if [[ "$(tr -d '[:space:]' <"$patroni_role_dir/$candidate")" == "f" ]]; then
      POSTGRES_POD="$candidate"
      break
    fi
  done
  rm -rf "$patroni_role_dir"
fi
if [[ -z "$POSTGRES_POD" ]]; then
  echo "[auto-deploy] refusing deployment: writable PostgreSQL leader was not found" >&2
  exit 12
fi
echo "[auto-deploy] PostgreSQL backup leader: $POSTGRES_POD"
record_deploy_phase "platform_preflight"
backup_application_name="carbonet-auto-deploy-$$"
schema_backup_dir=""
schema_restore_database=""
runtime_asset_sync_pid=""
runtime_asset_sync_log=""
runtime_screen_gate_pid=""
runtime_screen_gate_log=""
catalog_identity_sync_pid=""
catalog_identity_sync_log=""
backstage_visual_e2e_pid=""
backstage_visual_e2e_log=""
backstage_e2e_effective_routes=""
# A disconnected kubectl/pg_dump pipeline can survive the systemd process and
# retain ACCESS SHARE locks indefinitely. Reap only deploy-owned sessions that
# have exceeded five minutes before Flyway can be blocked. Normal full dumps
# remain protected by their active systemd service and current application name.
kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At \
  -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name like 'carbonet-auto-deploy-%' and application_name<>'$backup_application_name' and coalesce(xact_start,query_start,backend_start) < current_timestamp - interval '5 minutes' and pid<>pg_backend_pid()" \
  >/dev/null 2>&1 || true
cleanup_remote_backup() {
  # A terminated `kubectl exec` can leave pg_dump alive inside the pod. End
  # only sessions owned by this deploy invocation, preventing duplicate dumps
  # after a stop or retry without touching other backup jobs.
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At \
    -v app_name="$backup_application_name" \
    -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name=:'app_name' and pid<>pg_backend_pid()" \
    >/dev/null 2>&1 || true
}
cleanup_deploy() {
  if [[ -n "$runtime_asset_sync_pid" ]] && kill -0 "$runtime_asset_sync_pid" 2>/dev/null; then
    kill "$runtime_asset_sync_pid" 2>/dev/null || true
    wait "$runtime_asset_sync_pid" 2>/dev/null || true
  fi
  if [[ -n "$runtime_screen_gate_pid" ]] && kill -0 "$runtime_screen_gate_pid" 2>/dev/null; then
    kill "$runtime_screen_gate_pid" 2>/dev/null || true
    wait "$runtime_screen_gate_pid" 2>/dev/null || true
  fi
  if [[ -n "$catalog_identity_sync_pid" ]] && kill -0 "$catalog_identity_sync_pid" 2>/dev/null; then
    kill "$catalog_identity_sync_pid" 2>/dev/null || true
    wait "$catalog_identity_sync_pid" 2>/dev/null || true
  fi
  if [[ -n "$backstage_visual_e2e_pid" ]] && kill -0 "$backstage_visual_e2e_pid" 2>/dev/null; then
    kill "$backstage_visual_e2e_pid" 2>/dev/null || true
    wait "$backstage_visual_e2e_pid" 2>/dev/null || true
  fi
  cleanup_remote_backup
  if [[ -n "$schema_restore_database" ]]; then
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres \
        -c "drop database if exists \"$schema_restore_database\" with (force)" \
      >/dev/null 2>&1 || true
  fi
  if [[ -n "$schema_backup_dir" ]]; then
    rm -rf -- "$schema_backup_dir"
  fi
  current_root="$(realpath -m "${ROOT_DIR:-/}")"
  persistent_root="$(realpath -m "${persistent_build_worktree:-/nonexistent}")"
  if [[ "$current_root" == "$persistent_root" &&
        -x "$current_root/ops/scripts/normalize-deploy-generated-assets.sh" ]]; then
    bash "$current_root/ops/scripts/normalize-deploy-generated-assets.sh" "$current_root" ||
      echo "[auto-deploy] WARN generated worktree normalization failed" >&2
  fi
  if [[ -n "${CARBONET_DEPLOY_SNAPSHOT_PATH:-}" ]]; then
    rm -f -- "$CARBONET_DEPLOY_SNAPSHOT_PATH"
  fi
  rm -f -- "${DEPLOY_PHASE_FILE:-}"
}
trap cleanup_deploy EXIT INT TERM
eval "$(bash "$PLAN_SCRIPT" "$deployed_commit" "$target_commit" --format env)"
record_deploy_phase "incremental_plan"
PLAN_BACKSTAGE_REQUIRED="${PLAN_BACKSTAGE_REQUIRED:-false}"
echo "[auto-deploy] incremental plan: runtime=$PLAN_RUNTIME_REQUIRED frontend=$PLAN_FRONTEND_REQUIRED backend=$PLAN_BACKEND_REQUIRED database=$PLAN_DATABASE_REQUIRED backstage=$PLAN_BACKSTAGE_REQUIRED"
echo "[auto-deploy] selected checks: $PLAN_TESTS ($PLAN_REASONS)"

# Database availability is a hard prerequisite for Flyway and every runtime
# health gate. Keep the Patroni image independently recoverable even when
# Docker/containerd or registry retention removes unused application layers.
if [[ "$PLAN_BACKEND_REQUIRED" == "true" || "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash ops/scripts/ensure-protected-runtime-images.sh
else
  echo "[auto-deploy] protected runtime image check skipped for non-image deployment"
fi

# Keep pre-deploy restore points bounded before build and backup I/O begins.
# Containerd and PostgreSQL backups share /opt; allowing unlimited dump history
# can taint the only Kubernetes node with DiskPressure and stall every rollout.
if [[ "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash ops/scripts/prune-predeploy-backups.sh
  bash ops/scripts/deduplicate-verified-postgres-backups.sh
else
  echo "[auto-deploy] PostgreSQL backup maintenance deferred for non-database deployment"
fi

# Recheck after backup pruning because concurrent workloads can consume the
# reservation while the deployment plan is being prepared.
if [[ "$PLAN_BACKEND_REQUIRED" == "true" || "$PLAN_DATABASE_REQUIRED" == "true" ]]; then
  bash "$POLICY_ROOT/ops/scripts/deploy-capacity-gate.sh"
else
  echo "[auto-deploy] second capacity check skipped; initial reservation remains valid"
fi

root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] root usage ${root_usage}%: pruning unused Docker build cache and images before build"
  # BuildKit cache is separate from the image store and can grow by tens of
  # gigabytes even when image pruning reports nothing reclaimable.
  sudo docker builder prune -a -f >/dev/null
  sudo docker image prune -a -f >/dev/null
  sudo apt-get clean
  root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
fi
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] refusing deployment: root disk usage remains ${root_usage}%" >&2
  exit 16
fi

tracked_source_changes="$(git diff --name-only -- \
  . \
  ':(exclude).gradle/**' \
  ':(exclude)apps/carbonet-api/src/main/resources/static/react-app/**' \
  ':(exclude)projects/carbonet-assets/static/react-app/**' \
  ':(exclude)projects/carbonet-backend-metadata/builder/platform-builder-store.json' \
  ':(exclude)projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json' \
  ':(exclude)projects/carbonet-backend-metadata/git-build-monitoring-status.json' \
  ':(exclude)projects/carbonet-frontend/src/main/resources/static/react-app/**' \
  ':(exclude)projects/carbonet-frontend/source/.cache/full-screen-smoke/**' \
  ':(exclude)projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo' \
  ':(exclude)projects/carbonet-frontend/target/**')"
if [[ -n "$tracked_source_changes" ]]; then
  if [[ "${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" ]]; then
    echo "[auto-deploy] refusing deployment: dedicated deployment worktree is modified" >&2
    printf '%s\n' "$tracked_source_changes" >&2
    exit 2
  fi

  # Server-authored or operator-owned changes in /opt/Resonance must never be
  # overwritten, but they also must not block unrelated commits forever. Build
  # the exact remote commit in a dedicated clean worktree. Reusing this one
  # worktree retains untracked Gradle outputs and turns unchanged modules into
  # sub-second UP-TO-DATE checks without touching operator-owned source.
  source_root="$ROOT_DIR"
  clean_worktree_base="${CARBONET_CLEAN_WORKTREE_BASE:-$source_root/var/deploy-worktrees}"
  clean_worktree="$clean_worktree_base/runtime-build"
  mkdir -p "$clean_worktree_base"
  if [[ ! -e "$clean_worktree/.git" ]]; then
    echo "[auto-deploy] tracked operator changes detected; creating persistent isolated build worktree"
    git worktree add --detach "$clean_worktree" "$target_commit"
  elif [[ "$(git -C "$clean_worktree" rev-parse HEAD)" != "$target_commit" ]]; then
    # Only generated assets may be dirty in this operator-owned worktree.
    # Restore those tracked files, retain untracked build/ directories, then
    # advance strictly by fast-forward so a rewritten branch fails closed.
    persistent_build_artifacts=(
      .gradle
      apps/carbonet-api/src/main/resources/static/react-app
      projects/carbonet-assets/static/react-app
      projects/carbonet-backend-metadata/builder/platform-builder-store.json
      projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json
      projects/carbonet-backend-metadata/git-build-monitoring-status.json
      projects/carbonet-frontend/src/main/resources/static/react-app
      projects/carbonet-frontend/source/.cache/full-screen-smoke
      projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts
      projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts
      projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
      projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
      projects/carbonet-frontend/target
    )
    for generated_path in "${persistent_build_artifacts[@]}"; do
      [[ -n "$(git -C "$clean_worktree" ls-files -- "$generated_path")" ]] &&
        git -C "$clean_worktree" restore --worktree -- "$generated_path"
    done
    unexpected_build_changes="$(git -C "$clean_worktree" diff --name-only)"
    if [[ -n "$unexpected_build_changes" ]]; then
      echo "[auto-deploy] refusing deployment: persistent build worktree contains source changes" >&2
      printf '%s\n' "$unexpected_build_changes" >&2
      exit 24
    fi
    git -C "$clean_worktree" merge --ff-only "$target_commit"
  fi
  if [[ "$(git -C "$clean_worktree" rev-parse HEAD)" != "$target_commit" ]]; then
    echo "[auto-deploy] refusing deployment: isolated worktree commit mismatch" >&2
    exit 21
  fi
  source_overlay="$source_root/projects/carbonet-frontend/src/main/resources/static/react-app"
  clean_overlay="$clean_worktree/projects/carbonet-frontend/src/main/resources/static/react-app"
  mkdir -p "$clean_worktree/var/run" "$clean_worktree/var/logs"
  if [[ -f "$source_overlay/index.html" && "$PLAN_RUNTIME_REQUIRED" == "true" ]]; then
    # Both worktrees live on /opt. A read-only hard-link snapshot preserves the
    # verified frontend closure without copying its full hashed asset graph.
    rm -rf -- "$clean_overlay"
    mkdir -p "$clean_overlay"
    cp -al "$source_overlay/." "$clean_overlay/"
    node "$clean_worktree/ops/scripts/verify-react-asset-closure.mjs" "$clean_overlay"
  elif [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
    # Catalog/automation commits never mutate or serve this isolated overlay.
    # The checked-out closure is sufficient; copying and checking the live 313
    # file graph here would be pure repeated work.
    echo "[auto-deploy] isolated frontend overlay copy skipped for catalog-only work"
  fi
  ROOT_DIR="$clean_worktree"
  export ROOT_DIR CARBONET_DEPLOY_ROOT="$clean_worktree" CARBONET_CLEAN_WORKTREE_ACTIVE=true
  cd "$ROOT_DIR"
  current_commit="$target_commit"
  # A failed build may leave copied frontend assets in the persistent worktree
  # even when HEAD already equals the next target. Restore generated tracked
  # outputs on every invocation, not only while advancing the worktree.
  for generated_path in \
    apps/carbonet-api/src/main/resources/static/react-app \
    projects/carbonet-assets/static/react-app \
    projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo; do
    [[ -n "$(git -C "$clean_worktree" ls-files -- "$generated_path")" ]] &&
      git -C "$clean_worktree" restore --worktree -- "$generated_path"
  done
  tracked_source_changes="$(git diff --name-only -- \
    . \
    ':(exclude)projects/carbonet-frontend/src/main/resources/static/react-app/**')"
  if [[ -n "$tracked_source_changes" ]]; then
    echo "[auto-deploy] refusing deployment: isolated worktree is unexpectedly modified" >&2
    printf '%s\n' "$tracked_source_changes" >&2
    exit 22
  fi
  echo "[auto-deploy] isolated deployment worktree ready: $ROOT_DIR"
fi
record_deploy_phase "worktree_prepare"

# Run the target revision as well. This bootstraps a newly introduced guard and
# verifies that the exact revision being promoted owns the live resource cap.
bash "$ROOT_DIR/ops/scripts/ensure-kyverno-resource-guard.sh"

if ! git merge-base --is-ancestor "$current_commit" "$target_commit"; then
  echo "[auto-deploy] refusing non-fast-forward update: $current_commit -> $target_commit" >&2
  exit 3
fi

# Validate the exact pending commit after selecting its clean worktree. The
# bootstrap check above may legitimately run against the previously deployed
# tree when a new policy file is introduced by the pending commit.
if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
  bash "$ROOT_DIR/ops/scripts/test-backstage-fast-deploy-policy.sh"
fi

# The React hostPath is the live runtime closure, while index.html and the Vite
# manifest are still tracked for repository compatibility. Preserve the live
# closure before restoring generated worktree files: otherwise a catalog-only
# fast-forward can replace a freshly verified bundle graph with the stale
# repository copy after the screen gate has already passed.
live_frontend_overlay="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
merge_overlay_backup="$(mktemp -d "$ROOT_DIR/var/run/pre-merge-overlay.XXXXXX")"
merge_overlay_backup_valid=false
if [[ -f "$live_frontend_overlay/index.html" \
   && ! ("${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" \
     && "$PLAN_RUNTIME_REQUIRED" != "true") ]]; then
  cp -al "$live_frontend_overlay/." "$merge_overlay_backup/"
  if node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$merge_overlay_backup" >/dev/null 2>&1; then
    merge_overlay_backup_valid=true
  elif [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
    echo "[auto-deploy] stale frontend overlay detected; the new isolated frontend build will replace it"
  else
    echo "[auto-deploy] refusing deployment: the existing frontend closure is incomplete and no frontend rebuild is planned" >&2
    rm -rf "$merge_overlay_backup"
    exit 20
  fi
elif [[ "${CARBONET_CLEAN_WORKTREE_ACTIVE:-false}" == "true" \
     && "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
  # This worktree is not the mounted production overlay and catalog-only work
  # cannot alter runtime assets. Preserve the real live closure by doing
  # nothing instead of snapshotting and restoring an unused checkout.
  echo "[auto-deploy] isolated overlay snapshot skipped for catalog-only work"
fi

restore_live_frontend_overlay() {
  if [[ "$merge_overlay_backup_valid" == "true" && -f "$merge_overlay_backup/index.html" ]]; then
    rsync -a --delete "$merge_overlay_backup/" "$live_frontend_overlay/"
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$live_frontend_overlay"
  elif [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
    echo "[auto-deploy] skipped restoration of stale frontend overlay"
  fi
  rm -rf "$merge_overlay_backup"
  merge_overlay_backup=""
}

deploy_backstage_if_required() {
  [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" == "true" ]] || return 0
  local checkpoint status
  checkpoint="$(cat "$BACKSTAGE_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  if [[ "$checkpoint" == "$target_commit" ]]; then
    status="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 10 \
      https://backstage.172.16.1.232.nip.io/.backstage/health/v1/readiness || true)"
    if [[ "$status" == "200" ]]; then
      echo "[auto-deploy] Backstage runtime checkpoint verified; resuming at E2E gates"
      return 0
    fi
    echo "[auto-deploy] stale Backstage checkpoint ignored: readiness returned $status" >&2
  fi
  echo "[auto-deploy] Backstage-only image build and rollout started"
  bash ops/scripts/resonance-backstage-deploy.sh
  # The ingress endpoint can briefly return 502 while its upstream switches
  # from the terminating pod to the newly ready pod. Require a stable 200, but
  # absorb only that bounded post-rollout propagation window.
  status=""
  for attempt in 1 2 3 4 5; do
    status="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time 10 \
      https://backstage.172.16.1.232.nip.io/.backstage/health/v1/readiness || true)"
    [[ "$status" == "200" ]] && break
    echo "[auto-deploy] Backstage ingress readiness attempt $attempt/5 returned $status" >&2
    sleep 2
  done
  if [[ "$status" != "200" ]]; then
    echo "[auto-deploy] refusing success marker: Backstage readiness returned $status" >&2
    exit 24
  fi
  printf '%s\n' "$target_commit" > "${BACKSTAGE_DEPLOY_STATE_FILE}.tmp"
  mv "${BACKSTAGE_DEPLOY_STATE_FILE}.tmp" "$BACKSTAGE_DEPLOY_STATE_FILE"
  echo "[auto-deploy] Backstage runtime verified"
}

derive_backstage_e2e_routes() {
  local file routes="" full=false
  add_route() {
    [[ ",$routes," == *",$1,"* ]] || routes="${routes:+$routes,}$1"
  }
  add_core_routes() {
    add_route /actor-process-control
    add_route /identity-administration
    add_route /system-operations
  }
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    case "$file" in
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenDesignCatalogPage.tsx)
        add_route /ccus-screen-designs ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenSpaceRuntimePage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ScreenSpaceEnginePage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/screenSpaceEngine.ts)
        add_route /ccus-screen-space ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ResonanceProjectControlPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceProjects.ts)
        add_route /resonance-projects ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ResonanceControlAssetsPage.tsx)
        add_route /resonance-control-assets ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/ActorProcessControlPage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/actorProcessWorkspaces.ts)
        add_route /actor-process-control
        add_route /actor-process-design
        add_route /actor-process-development
        add_route /actor-process-operations ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/DesignAssetControlPage.tsx)
        add_route /design-assets ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/IdentityAdministrationPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceIdentityAdmin.ts)
        add_route /identity-administration ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemOperationsControlPage.tsx)
        add_route /system-operations ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemDevelopmentControlPage.tsx)
        add_route /system-development ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemSecurityControlPage.tsx)
        add_route /system-security ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/MigrationCutoverPage.tsx|\
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/migrationCutoverRegistry.ts)
        add_route /migration-cutover ;;
      platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemRecoveryControlPage.tsx|\
      platform/control-plane/backstage/packages/backend/src/plugins/resonanceRecovery.ts)
        add_route /system-recovery ;;
      deploy/k8s/control-plane/backstage.yaml|\
      ops/scripts/auto-deploy-main.sh|\
      ops/scripts/resonance-backstage-deploy.sh|\
      ops/scripts/resonance-backstage-runtime-fingerprint.sh|\
      ops/scripts/resonance-backstage-full-e2e.sh|\
      ops/scripts/test-backstage-runtime-fingerprint.sh|\
      ops/scripts/test-backstage-fast-deploy-policy.sh|\
      ops/scripts/test-catalog-identity-parallel-deploy.sh|\
      ops/systemd/resonance-backstage-full-e2e.service|\
      ops/systemd/resonance-backstage-full-e2e.timer|\
      platform/control-plane/backstage/app-config*.yaml|\
      platform/control-plane/backstage/packages/backend/Dockerfile)
        add_core_routes ;;
      *) full=true ;;
    esac
  done < <(git diff --name-only "$deployed_commit" "$target_commit")
  [[ "$full" == true ]] && return 0
  printf '%s\n' "$routes"
}

run_backstage_visual_e2e_if_required() {
  if [[ "$PLAN_BACKSTAGE_REQUIRED" != "true" \
     && ",$PLAN_TESTS," != *",backstage:visual-e2e,"* \
     && ",$PLAN_TESTS," != *",backstage:catalog-sync,"* ]]; then
    return
  fi
  local e2e_scope="${RESONANCE_BACKSTAGE_E2E_SCOPE:-full}" display_scope
  local e2e_routes="${RESONANCE_BACKSTAGE_E2E_ROUTES:-${backstage_e2e_effective_routes:-}}"
  [[ -n "$e2e_routes" ]] || e2e_routes="$(derive_backstage_e2e_routes)"
  display_scope="$e2e_scope"
  [[ -n "$e2e_routes" ]] && display_scope=impact
  echo "[auto-deploy] Backstage visual E2E scope: $display_scope routes=${e2e_routes:-all}"
  BACKSTAGE_E2E_USERNAME="${BACKSTAGE_E2E_USERNAME:-sjkim}" \
  BACKSTAGE_E2E_SECRET_NAME="${BACKSTAGE_E2E_SECRET_NAME:-resonance-keycloak-integrated-admin}" \
  RESONANCE_BACKSTAGE_E2E_SCOPE="$e2e_scope" \
  RESONANCE_BACKSTAGE_E2E_ROUTES="$e2e_routes" \
  RESONANCE_E2E_SKIP_IDENTITY_PREFLIGHT=true \
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-backstage-visual-e2e.sh
}

start_backstage_visual_e2e() {
  backstage_e2e_effective_routes="${RESONANCE_BACKSTAGE_E2E_ROUTES:-}"
  [[ -n "$backstage_e2e_effective_routes" ]] ||
    backstage_e2e_effective_routes="$(derive_backstage_e2e_routes)"
  backstage_visual_e2e_log="$ROOT_DIR/var/logs/backstage-visual-e2e-${target_commit:0:10}.log"
  (
    run_backstage_visual_e2e_if_required
  ) >"$backstage_visual_e2e_log" 2>&1 &
  backstage_visual_e2e_pid="$!"
  echo "[auto-deploy] Backstage visual E2E running concurrently pid=$backstage_visual_e2e_pid"
}

wait_backstage_visual_e2e() {
  if wait "$backstage_visual_e2e_pid"; then
    cat "$backstage_visual_e2e_log"
    backstage_visual_e2e_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent Backstage visual E2E failed" >&2
    cat "$backstage_visual_e2e_log" >&2
    exit 26
  fi
}

run_backstage_identity_e2e_if_required() {
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* ]]; then
    return 0
  fi
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-identity-admin-e2e.sh
}

run_actor_process_role_e2e_if_required() {
  if [[ -n "${backstage_e2e_effective_routes:-}" ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/actor-process-"* ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/identity-administration,"* ]] &&
    [[ ",${backstage_e2e_effective_routes}," != *",/resonance-projects,"* ]]; then
    echo "[auto-deploy] actor-process role E2E skipped for unrelated routes: $backstage_e2e_effective_routes"
    return 0
  fi
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* \
     && ",${PLAN_TESTS:-}," != *",backstage:visual-e2e,"* ]]; then
    if ! git diff --name-only "$deployed_commit" "$target_commit" -- \
        modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance \
        ops/scripts/auto-deploy-main.sh \
        ops/scripts/test-catalog-identity-parallel-deploy.sh \
        ops/scripts/resonance-actor-process-role-e2e.sh \
        ops/scripts/resonance-project-task-browser-e2e.mjs \
        ops/scripts/resonance-project-task-browser-e2e.sh \
        ops/scripts/resonance-seven-step-disposable-e2e.mjs \
        ops/scripts/resonance-seven-step-disposable-e2e.sh \
        ops/scripts/resonance-keycloak-deploy.sh \
        ops/scripts/resonance-keycloak-carbonet-identity-sync.sh \
        | grep -q .; then
      return 0
    fi
  fi
  local parallel_log_dir="$ROOT_DIR/var/logs/actor-process-parallel-${target_commit:0:10}"
  local actor_pid delivery_pid browser_pid lifecycle_pid
  local actor_status delivery_status browser_status lifecycle_status
  rm -rf "$parallel_log_dir"
  mkdir -p "$parallel_log_dir"

  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-actor-process-role-e2e.sh) \
    >"$parallel_log_dir/actor-role.log" 2>&1 & actor_pid=$!
  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-project-delivery-e2e.sh) \
    >"$parallel_log_dir/project-delivery.log" 2>&1 & delivery_pid=$!
  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-project-task-browser-e2e.sh) \
    >"$parallel_log_dir/browser.log" 2>&1 & browser_pid=$!
  (RESONANCE_ROOT="$ROOT_DIR" bash ops/scripts/resonance-seven-step-disposable-e2e.sh) \
    >"$parallel_log_dir/seven-step.log" 2>&1 & lifecycle_pid=$!

  set +e
  wait "$actor_pid"; actor_status=$?
  wait "$delivery_pid"; delivery_status=$?
  wait "$browser_pid"; browser_status=$?
  wait "$lifecycle_pid"; lifecycle_status=$?
  set -e
  cat "$parallel_log_dir/actor-role.log"
  cat "$parallel_log_dir/project-delivery.log"
  cat "$parallel_log_dir/browser.log"
  cat "$parallel_log_dir/seven-step.log"
  if ((actor_status != 0 || delivery_status != 0 || browser_status != 0 || lifecycle_status != 0)); then
    echo "[auto-deploy] parallel actor/process E2E failed actor=$actor_status delivery=$delivery_status browser=$browser_status lifecycle=$lifecycle_status logs=$parallel_log_dir" >&2
    return 1
  fi
  echo "[auto-deploy] parallel actor/process E2E PASS jobs=4 logs=$parallel_log_dir"
}

sync_keycloak_actor_assignments_if_required() {
  if ! git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/resonance-keycloak-deploy.sh \
      ops/scripts/resonance-keycloak-carbonet-identity-sync.sh \
      ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh \
      ops/scripts/validate-keycloak-carbonet-identity-sync.sh \
      ops/scripts/resonance-keycloak-e2e-scope-sync.sh \
      ops/scripts/resonance-actor-process-role-e2e.sh \
      | grep -q .; then
    echo "[auto-deploy] identity reconciliation skipped: no identity contract change"
    return 0
  fi
  # Keycloak realm provisioning is intentionally not repeated in the hot
  # application deployment path. It can take several minutes because it
  # reconciles every identity. The periodic identity sync below applies the
  # already-provisioned attributes to Carbonet without another realm rebuild.
  bash ops/scripts/resonance-keycloak-e2e-scope-sync.sh
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh
  bash ops/scripts/resonance-keycloak-carbonet-identity-sync.sh
  bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh
}

run_backstage_screen_space_e2e_if_required() {
  if [[ "${PLAN_BACKSTAGE_REQUIRED:-false}" != "true" \
     && ",${PLAN_TESTS:-}," != *",backstage:build-deploy,"* ]]; then
    return 0
  fi
  RESONANCE_ROOT="$ROOT_DIR" \
    bash ops/scripts/resonance-screen-space-runtime-e2e.sh
}

sync_backstage_catalog_if_required() {
  if [[ ",$PLAN_TESTS," != *",backstage:catalog-sync,"* \
     || "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
    return
  fi
  kubectl -n resonance-ops create configmap resonance-backstage-catalog \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/organization.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/systems.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/components.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/apis.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/resources.yaml" \
    --from-file="$ROOT_DIR/platform/control-plane/catalog/environments.yaml" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n resonance-ops rollout restart deployment/resonance-backstage
  kubectl -n resonance-ops rollout status deployment/resonance-backstage \
    --timeout=180s
}

# The standard build updates tracked generated bundles and Gradle state. They are
# deployment artifacts, not server-authored source changes, so restore only these
# known paths before the fast-forward merge.
generated_paths=(
  .gradle
  apps/carbonet-api/src/main/resources/static/react-app
  projects/carbonet-assets/static/react-app
  projects/carbonet-backend-metadata/builder/platform-builder-store.json
  projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json
  projects/carbonet-backend-metadata/git-build-monitoring-status.json
  projects/carbonet-frontend/src/main/resources/static/react-app
  projects/carbonet-frontend/source/.cache/full-screen-smoke
  projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts
  projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts
  projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
  projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
  projects/carbonet-frontend/target
)
for generated_path in "${generated_paths[@]}"; do
  # A missing/ignored path must not cancel restoration of every later path.
  # Capture the complete result instead of piping into `grep -q`: with
  # pipefail enabled, grep's early exit can SIGPIPE git and falsely report that
  # a large tracked directory has no files.
  tracked_generated_files="$(git ls-files -- "$generated_path")"
  if [[ -n "$tracked_generated_files" ]]; then
    git restore --worktree -- "$generated_path"
  fi
done

remaining_generated_changes="$(git diff --name-only -- "${generated_paths[@]}")"
if [[ -n "$remaining_generated_changes" ]]; then
  echo "[auto-deploy] refusing deployment: generated files could not be restored" >&2
  printf '%s\n' "$remaining_generated_changes" >&2
  exit 13
fi

sync_postgres_backup_cronjobs_if_required() {
  local live_paths=""
  live_paths="$(
    kubectl -n "$NAMESPACE" get cronjob postgres-carbonet-hourly-backup \
      -o jsonpath='{.spec.jobTemplate.spec.template.spec.volumes[*].hostPath.path}' \
      2>/dev/null || true
  )"
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/apply-backup-cronjobs.sh |
      grep -q . ||
    [[ "$live_paths" != *"/opt/resonance-data/backups/postgres/primary"* ||
      "$live_paths" != *"/opt/resonance-data/backups/postgres/mirror"* ]]; then
    bash ops/scripts/apply-backup-cronjobs.sh
    echo "[auto-deploy] PostgreSQL backup CronJobs synchronized"
  fi
}

sync_post_reboot_recovery_if_required() {
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/kubernetes/postgres-haproxy-config.yaml \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      ops/systemd/carbonet-post-reboot-recovery.service |
      grep -q . ||
    ! systemctl is-enabled --quiet carbonet-post-reboot-recovery.service; then
    sudo -n install -d -m 0755 /opt/resonance-data/control-plane/manifests
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      /opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh
    sudo -n install -m 0644 \
      ops/kubernetes/postgres-haproxy-config.yaml \
      /opt/resonance-data/control-plane/manifests/postgres-haproxy-config.yaml
    sudo -n install -m 0644 \
      ops/systemd/carbonet-post-reboot-recovery.service \
      /etc/systemd/system/carbonet-post-reboot-recovery.service
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable carbonet-post-reboot-recovery.service >/dev/null
    bash /opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh
    echo "[auto-deploy] post-reboot runtime recovery synchronized"
  fi
}

sync_patroni_auto_heal_if_required() {
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/patroni-auto-heal.sh \
      ops/scripts/test-patroni-auto-heal-safety.sh \
      ops/systemd/carbonet-patroni-auto-heal.service \
      ops/systemd/carbonet-patroni-auto-heal.timer |
      grep -q . ||
    ! systemctl is-enabled --quiet carbonet-patroni-auto-heal.timer; then
    bash ops/scripts/test-patroni-auto-heal-safety.sh
    sudo -n install -d -m 0755 /opt/resonance-data/control-plane/bin
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/patroni-auto-heal.sh \
      /opt/resonance-data/control-plane/bin/patroni-auto-heal.sh
    sudo -n install -m 0644 \
      ops/systemd/carbonet-patroni-auto-heal.service \
      /etc/systemd/system/carbonet-patroni-auto-heal.service
    sudo -n install -m 0644 \
      ops/systemd/carbonet-patroni-auto-heal.timer \
      /etc/systemd/system/carbonet-patroni-auto-heal.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now carbonet-patroni-auto-heal.timer >/dev/null
    PATRONI_AUTO_HEAL_DRY_RUN=true \
      bash /opt/resonance-data/control-plane/bin/patroni-auto-heal.sh
    echo "[auto-deploy] guarded Patroni auto-heal synchronized"
  fi
}

sync_postgres_restore_drill_if_required() {
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/postgres-isolated-restore-drill.sh \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      ops/scripts/test-postgres-isolated-restore-drill.sh \
      ops/systemd/carbonet-postgres-restore-drill.service \
      ops/systemd/carbonet-postgres-restore-drill.timer |
      grep -q . ||
    ! systemctl is-enabled --quiet carbonet-postgres-restore-drill.timer; then
    bash ops/scripts/test-postgres-isolated-restore-drill.sh
    sudo -n install -d -m 2770 -o sjkim -g sjkim \
      /opt/resonance-data/restore-drills \
      /opt/resonance-data/restore-drills/work \
      /opt/resonance-data/restore-drills/reports
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/postgres-isolated-restore-drill.sh \
      /opt/resonance-data/control-plane/bin/postgres-isolated-restore-drill.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      /opt/resonance-data/control-plane/bin/report-latest-postgres-restore-drill.sh
    sudo -n install -m 0644 \
      ops/systemd/carbonet-postgres-restore-drill.service \
      /etc/systemd/system/carbonet-postgres-restore-drill.service
    sudo -n install -m 0644 \
      ops/systemd/carbonet-postgres-restore-drill.timer \
      /etc/systemd/system/carbonet-postgres-restore-drill.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now carbonet-postgres-restore-drill.timer >/dev/null
    echo "[auto-deploy] isolated PostgreSQL restore drill synchronized"
  fi
}

sync_process_development_worker_if_required() {
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/run-process-development-dispatcher.sh \
      ops/scripts/run-process-development-worker.sh \
      ops/scripts/test-process-worker-deploy-marker.sh \
      ops/systemd/resonance-process-development-worker.service \
      ops/systemd/resonance-process-development-worker.timer | \
      grep -q . || \
    ! systemctl cat resonance-process-development-worker.service 2>/dev/null | \
      grep -Fq '/opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh'; then
    bash ops/scripts/test-process-worker-deploy-marker.sh
    sudo -n install -d -m 0755 -o root -g root \
      /opt/resonance-data/control-plane/bin
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-process-development-dispatcher.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-dispatcher.sh
    sudo -n install -m 0750 -o sjkim -g sjkim \
      ops/scripts/run-process-development-worker.sh \
      /opt/resonance-data/control-plane/bin/run-process-development-worker.sh
    sudo -n install -m 0644 \
      ops/systemd/resonance-process-development-worker.service \
      /etc/systemd/system/resonance-process-development-worker.service
    sudo -n install -m 0644 \
      ops/systemd/resonance-process-development-worker.timer \
      /etc/systemd/system/resonance-process-development-worker.timer
    sudo -n systemctl daemon-reload
    sudo -n systemctl enable --now resonance-process-development-worker.timer >/dev/null
    echo "[auto-deploy] process development worker control plane synchronized"
  fi
}

# Documentation, design metadata, catalog and automation-only changes do not
# alter the running application. Fast-forward and refresh the searchable source
# catalog without an unnecessary DB dump, JVM build, image build or rollout.
if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
  git merge --ff-only "$target_commit"
  restore_live_frontend_overlay
  while IFS= read -r changed_script; do
    [[ "$changed_script" == *.sh && -f "$changed_script" ]] && bash -n "$changed_script"
  done < <(git diff --name-only --diff-filter=ACMR "$deployed_commit" "$target_commit")
  if git diff --name-only "$deployed_commit" "$target_commit" -- \
      ops/scripts/auto-deploy-main.sh \
      ops/scripts/sync-unified-asset-catalog.sh \
      ops/scripts/test-atomic-asset-e4b-validation.sh \
      ops/scripts/test-catalog-identity-parallel-deploy.sh \
      ops/scripts/test-catalog-overlay-fast-path.sh \
      ops/scripts/test-no-change-preflight-fast-path.sh \
      ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
      ops/scripts/test-candidate-release-rollout-gate.sh \
      ops/scripts/run-process-development-worker.sh \
      ops/scripts/run-process-development-dispatcher.sh \
      ops/scripts/test-process-worker-deploy-marker.sh \
      ops/scripts/test-frontend-parallel-build-pipeline.sh \
      ops/scripts/install-resonance-github-runner.sh \
      ops/scripts/install-resonance-github-deploy-webhook.sh \
      ops/scripts/apply-backup-cronjobs.sh \
      ops/scripts/reconcile-post-reboot-runtime.sh \
      ops/scripts/test-post-reboot-runtime-recovery.sh \
      ops/scripts/postgres-storage-guard.sh \
      ops/scripts/test-postgres-storage-guard-install.sh \
      ops/scripts/carbonet-auto-deploy-failure-handler.sh \
      ops/scripts/carbonet-deploy-notify.sh \
      ops/scripts/test-auto-deploy-failure-handler.sh \
      ops/scripts/patroni-auto-heal.sh \
      ops/scripts/test-patroni-auto-heal-safety.sh \
      ops/scripts/postgres-isolated-restore-drill.sh \
      ops/scripts/report-latest-postgres-restore-drill.sh \
      ops/scripts/test-postgres-isolated-restore-drill.sh \
      ops/scripts/resonance-github-deploy-webhook.py \
      ops/scripts/sync-github-deploy-webhook-url.py \
      ops/scripts/test-github-deploy-webhook.sh \
      ops/scripts/test-push-deploy-dispatch.sh \
      ops/systemd/carbonet-auto-deploy.timer \
      ops/systemd/carbonet-auto-deploy.service \
      ops/systemd/carbonet-auto-deploy-failure-handler.service \
      ops/systemd/carbonet-github-deploy-webhook.service \
      ops/systemd/carbonet-github-webhook-reconcile.service \
      ops/systemd/carbonet-github-webhook-reconcile.timer \
      ops/systemd/carbonet-post-reboot-recovery.service \
      ops/systemd/postgres-storage-guard.service \
      ops/systemd/postgres-storage-guard.timer \
      ops/systemd/carbonet-patroni-auto-heal.service \
      ops/systemd/carbonet-patroni-auto-heal.timer \
      ops/systemd/carbonet-postgres-restore-drill.service \
      ops/systemd/carbonet-postgres-restore-drill.timer \
      ops/systemd/resonance-process-development-worker.service \
      ops/systemd/resonance-process-development-worker.timer \
      ops/scripts/resonance-backstage-full-e2e.sh \
      ops/systemd/resonance-backstage-full-e2e.service \
      ops/systemd/resonance-backstage-full-e2e.timer \
      ops/kubernetes/postgres-haproxy-config.yaml \
      .github/workflows/carbonet-push-deploy.yml |
      grep -q .; then
    bash ops/scripts/test-catalog-identity-parallel-deploy.sh
    bash ops/scripts/test-catalog-overlay-fast-path.sh
    bash ops/scripts/test-atomic-asset-e4b-validation.sh
    bash ops/scripts/test-no-change-preflight-fast-path.sh
    bash ops/scripts/test-candidate-release-rollout-gate.sh
    bash ops/scripts/test-process-worker-deploy-marker.sh
    bash ops/scripts/test-frontend-parallel-build-pipeline.sh
    bash ops/scripts/test-push-deploy-dispatch.sh
    bash ops/scripts/test-github-deploy-webhook.sh
    bash ops/scripts/test-post-reboot-runtime-recovery.sh
    if git diff --name-only "$deployed_commit" "$target_commit" -- \
        ops/scripts/carbonet-auto-deploy-failure-handler.sh \
        ops/scripts/carbonet-deploy-notify.sh \
        ops/scripts/test-auto-deploy-failure-handler.sh \
        ops/scripts/record-deploy-performance.sh \
        ops/systemd/carbonet-auto-deploy.service \
        ops/systemd/carbonet-auto-deploy-failure-handler.service | grep -q .; then
      bash ops/scripts/test-auto-deploy-failure-handler.sh
      sudo -n install -d -m 0755 -o root -g root \
        /opt/resonance-data/control-plane/bin
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/carbonet-auto-deploy-failure-handler.sh \
        /opt/resonance-data/control-plane/bin/carbonet-auto-deploy-failure-handler.sh
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/carbonet-deploy-notify.sh \
        /opt/resonance-data/control-plane/bin/carbonet-deploy-notify.sh
      sudo -n install -m 0644 ops/systemd/carbonet-auto-deploy.service \
        /etc/systemd/system/carbonet-auto-deploy.service
      sudo -n install -m 0644 \
        ops/systemd/carbonet-auto-deploy-failure-handler.service \
        /etc/systemd/system/carbonet-auto-deploy-failure-handler.service
      sudo -n systemctl daemon-reload
      echo "[auto-deploy] failure classification and one-shot recovery synchronized"
    fi
    if git diff --name-only "$deployed_commit" "$target_commit" -- \
        ops/scripts/resonance-github-deploy-webhook.py \
        ops/scripts/sync-github-deploy-webhook-url.py \
        ops/systemd/carbonet-github-deploy-webhook.service \
        ops/systemd/carbonet-github-webhook-reconcile.service \
        ops/systemd/carbonet-github-webhook-reconcile.timer |
        grep -q .; then
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/resonance-github-deploy-webhook.py \
        /opt/resonance-data/control-plane/bin/resonance-github-deploy-webhook.py
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-deploy-webhook.service \
        /etc/systemd/system/carbonet-github-deploy-webhook.service
      sudo -n install -m 0750 -o sjkim -g sjkim \
        ops/scripts/sync-github-deploy-webhook-url.py \
        /opt/resonance-data/control-plane/bin/sync-github-deploy-webhook-url.py
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-webhook-reconcile.service \
        /etc/systemd/system/carbonet-github-webhook-reconcile.service
      sudo -n install -m 0644 \
        ops/systemd/carbonet-github-webhook-reconcile.timer \
        /etc/systemd/system/carbonet-github-webhook-reconcile.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl restart carbonet-github-deploy-webhook.service
      sudo -n systemctl enable --now \
        carbonet-github-webhook-reconcile.timer >/dev/null
      if ! python3 \
          /opt/resonance-data/control-plane/bin/sync-github-deploy-webhook-url.py; then
        echo "[auto-deploy] warning: webhook URL reconciliation deferred to timer" >&2
      fi
      echo "[auto-deploy] GitHub webhook runtime synchronized"
    fi
    sync_postgres_backup_cronjobs_if_required
    sync_post_reboot_recovery_if_required
    sync_patroni_auto_heal_if_required
    sync_postgres_restore_drill_if_required
    sync_process_development_worker_if_required
    if git diff --name-only "$deployed_commit" "$target_commit" -- \
        ops/scripts/postgres-storage-guard.sh \
        ops/scripts/test-postgres-storage-guard-install.sh \
        ops/systemd/postgres-storage-guard.service \
        ops/systemd/postgres-storage-guard.timer | grep -q .; then
      bash ops/scripts/test-postgres-storage-guard-install.sh
      sudo -n install -d -m 0755 -o root -g root \
        /opt/resonance-data/control-plane/bin
      sudo -n install -m 0750 -o root -g root \
        ops/scripts/postgres-storage-guard.sh \
        /opt/resonance-data/control-plane/bin/postgres-storage-guard.sh
      sudo -n install -m 0644 ops/systemd/postgres-storage-guard.service \
        /etc/systemd/system/postgres-storage-guard.service
      sudo -n install -m 0644 ops/systemd/postgres-storage-guard.timer \
        /etc/systemd/system/postgres-storage-guard.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl enable --now postgres-storage-guard.timer >/dev/null
      sudo -n systemctl restart postgres-storage-guard.service
      echo "[auto-deploy] PostgreSQL storage guard runtime synchronized"
    fi
    if git diff --name-only "$deployed_commit" "$target_commit" -- \
        ops/scripts/resonance-backstage-full-e2e.sh \
        ops/systemd/resonance-backstage-full-e2e.service \
        ops/systemd/resonance-backstage-full-e2e.timer | grep -q .; then
      sudo -n install -m 0750 -o sjkim -g sjkim \
        ops/scripts/resonance-backstage-full-e2e.sh \
        /opt/resonance-data/control-plane/bin/resonance-backstage-full-e2e.sh
      sudo -n install -m 0644 ops/systemd/resonance-backstage-full-e2e.service \
        /etc/systemd/system/resonance-backstage-full-e2e.service
      sudo -n install -m 0644 ops/systemd/resonance-backstage-full-e2e.timer \
        /etc/systemd/system/resonance-backstage-full-e2e.timer
      sudo -n systemctl daemon-reload
      sudo -n systemctl enable --now resonance-backstage-full-e2e.timer >/dev/null
      echo "[auto-deploy] nightly full Backstage E2E synchronized"
    fi
  fi
  backstage_only_change=false
  if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]] &&
    ! git diff --name-only "$deployed_commit" "$target_commit" |
      grep -Ev '^(platform/control-plane/backstage/|deploy/k8s/control-plane/backstage\.yaml$|ops/scripts/(resonance-backstage-deploy|test-backstage-fast-deploy-policy)\.sh$)' |
      grep -q .; then
    backstage_only_change=true
  fi
  if [[ "$backstage_only_change" == "true" ]]; then
    echo "[auto-deploy] Backstage-only change: synchronizing source assets without an application rollout"
  fi
  # Identity reconciliation and source-catalog indexing read independent
  # systems. Run them concurrently, then join fail-closed before role E2E and
  # the success marker. This removes the longest sequential tail without
  # weakening either contract.
  catalog_identity_sync_log="$ROOT_DIR/var/logs/catalog-identity-sync-${target_commit:0:10}.log"
  (
    sync_keycloak_actor_assignments_if_required
  ) >"$catalog_identity_sync_log" 2>&1 &
  catalog_identity_sync_pid="$!"
  echo "[auto-deploy] identity reconciliation running concurrently pid=$catalog_identity_sync_pid"
  # A visual-E2E-only change cannot alter the running Backstage image. Start
  # its full browser regression beside catalog/identity synchronization and
  # join all gates before advancing the deploy marker. Runtime/image changes
  # intentionally keep the later post-rollout start so E2E sees the candidate.
  if [[ "$PLAN_BACKSTAGE_REQUIRED" != "true" \
     && ",$PLAN_TESTS," == *",backstage:visual-e2e,"* ]]; then
    start_backstage_visual_e2e
    echo "[auto-deploy] test-only visual E2E started concurrently with catalog synchronization"
  fi
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  sync_backstage_catalog_if_required
  record_deploy_phase "catalog_sync"
  deploy_backstage_if_required
  record_deploy_phase "backstage_build_rollout"
  if [[ -z "$backstage_visual_e2e_pid" ]]; then
    start_backstage_visual_e2e
  fi
  if wait "$catalog_identity_sync_pid"; then
    cat "$catalog_identity_sync_log"
    catalog_identity_sync_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent identity reconciliation failed" >&2
    cat "$catalog_identity_sync_log" >&2
    exit 25
  fi
  record_deploy_phase "identity_reconcile"
  run_actor_process_role_e2e_if_required
  record_deploy_phase "actor_role_e2e"
  wait_backstage_visual_e2e
  record_deploy_phase "backstage_visual_e2e"
  printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
  if [[ "$PLAN_BACKSTAGE_REQUIRED" == "true" ]]; then
    record_deploy_performance backstage
  else
    record_deploy_performance catalog
  fi
  echo "[auto-deploy] catalog-only update completed without application rollout: $target_commit"
  exit 0
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/carbonet-$timestamp-$current_commit.sql.gz"
roles_backup_file="$BACKUP_DIR/postgres-roles-$timestamp-$current_commit.sql.gz"
backup_required="$PLAN_DATABASE_REQUIRED"
[[ "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" == "true" ]] && backup_required=true
menu_backup_only=false
governance_backup_only=false
activity_backup_only=false
identity_backup_only=false
schema_backup_only=false
if [[ "$PLAN_DATABASE_REQUIRED" == "true" && "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" != "true" ]]; then
  database_change_files="$(git diff --name-only "$deployed_commit" "$target_commit" -- \
    apps/carbonet-api/src/main/resources/db/migration/postgresql)"
  backup_scope="$(printf '%s\n' "$database_change_files" | bash ops/scripts/classify-db-backup-scope.sh)"
  [[ "$backup_scope" == "menu" ]] && menu_backup_only=true
  [[ "$backup_scope" == "governance" ]] && governance_backup_only=true
  [[ "$backup_scope" == "activity" ]] && activity_backup_only=true
  [[ "$backup_scope" == "identity" ]] && identity_backup_only=true
  database_change_statuses="$(git diff --name-status "$deployed_commit" "$target_commit" -- \
    apps/carbonet-api/src/main/resources/db/migration/postgresql)"
  if [[ -n "$database_change_files" ]] \
    && ! grep -Ev '^A[[:space:]]' <<<"$database_change_statuses" | grep -q . \
    && python3 ops/scripts/classify-safe-additive-ddl.py $database_change_files; then
    schema_backup_only=true
    menu_backup_only=false
    governance_backup_only=false
    activity_backup_only=false
    identity_backup_only=false
    backup_scope="safe-additive-schema"
  fi
  echo "[auto-deploy] database backup scope: $backup_scope"
fi
if [[ "$backup_required" == "true" ]]; then
  if [[ "$schema_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-schema-$timestamp-$current_commit.tar"
    schema_backup_dir="$(mktemp -d)"
    echo "[auto-deploy] safe additive DDL detected; creating schema and Flyway-history backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
        kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
          env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
          pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
            --schema-only --no-owner --no-privileges -h 127.0.0.1 \
        > "$schema_backup_dir/schema.dump"; then
      echo "[auto-deploy] refusing deployment: schema backup failed" >&2
      exit 14
    fi
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
          --data-only --no-owner --no-privileges -h 127.0.0.1 \
          -t carbonet_flyway_schema_history > "$schema_backup_dir/flyway-history.dump"; then
      echo "[auto-deploy] refusing deployment: Flyway-history backup failed" >&2
      exit 14
    fi
    git diff --name-status "$deployed_commit" "$target_commit" -- \
      apps/carbonet-api/src/main/resources/db/migration/postgresql \
      > "$schema_backup_dir/migrations.manifest"
    git diff "$deployed_commit" "$target_commit" -- \
      apps/carbonet-api/src/main/resources/db/migration/postgresql \
      > "$schema_backup_dir/migrations.patch"
    for archive in schema.dump flyway-history.dump; do
      if [[ "$(stat -c %s "$schema_backup_dir/$archive")" -lt 512 ]] \
        || ! kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
          pg_restore --list < "$schema_backup_dir/$archive" >/dev/null; then
        echo "[auto-deploy] refusing deployment: $archive restore catalog is invalid" >&2
        exit 18
      fi
    done
    schema_restore_database="carbonet_schema_verify_${timestamp//-/_}_$$"
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 \
        -c "create database \"$schema_restore_database\"" >/dev/null
    if ! kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      pg_restore -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" \
        --schema-only --no-owner --no-privileges -t carbonet_flyway_schema_history \
        < "$schema_backup_dir/schema.dump" \
      || ! kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        pg_restore -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" \
          --data-only --no-owner --no-privileges -t carbonet_flyway_schema_history \
          < "$schema_backup_dir/flyway-history.dump"; then
      echo "[auto-deploy] refusing deployment: Flyway-history restore verification failed" >&2
      exit 19
    fi
    restored_history_count="$(kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d "$schema_restore_database" -Atqc \
        "select count(*) from carbonet_flyway_schema_history")"
    [[ "$restored_history_count" =~ ^[1-9][0-9]*$ ]] || {
      echo "[auto-deploy] refusing deployment: restored Flyway history is empty" >&2
      exit 19
    }
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      psql -U "$POSTGRES_USER" -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 \
        -c "drop database \"$schema_restore_database\" with (force)" >/dev/null
    schema_restore_database=""
    tar -C "$schema_backup_dir" -cf "$backup_file" \
      schema.dump flyway-history.dump migrations.manifest migrations.patch
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 2048 ]] || ! tar -tf "$backup_file" | grep -q '^schema.dump$'; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: schema backup package is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    rm -rf "$schema_backup_dir"
    schema_backup_dir=""
    echo "[auto-deploy] schema backup verified: $backup_file (${backup_bytes} bytes, restoredFlywayRows=${restored_history_count})"
  elif [[ "$menu_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-menu-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] menu-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
          -h 127.0.0.1 -t comtnmenuinfo -t comtccmmndetailcode \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted menu backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$governance_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-governance-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] governance-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t framework_actor_definition -t framework_account_actor_assignment \
          -t framework_process_definition -t framework_process_step \
          -t framework_business_process_sequence \
          -t framework_process_execution_topology \
          -t framework_process_navigation_binding \
          -t framework_simulation_case -t framework_simulation_run \
          -t framework_development_job -t framework_process_artifact \
          -t framework_project_actor_assignment \
          -t emission_project_registry -t emission_project_task \
          -t emission_project_history -t emission_workflow_notification \
          -t ui_component_registry -t ui_section_registry \
          -t framework_design_asset_registry \
          -t ui_page_manifest -t ui_page_component_map \
          -t comtncomponentinfo \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted governance backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$activity_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-activity-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] activity-workflow migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t emission_activity_request -t emission_activity_request_event \
          -t emission_activity_data -t emission_activity_quality_run -t emission_activity_quality_issue \
          -t emission_activity_submission -t emission_activity_submission_item \
          -t emission_activity_submission_evidence -t emission_activity_submission_event \
          -t emission_factor_reference -t emission_factor_mapping_decision \
          -t emission_calculation_run -t emission_calculation_item \
          -t emission_project_task -t emission_project_history -t emission_workflow_notification \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted activity-workflow backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$identity_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-identity-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] identity-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t comtngnrlmber -t comtnentrprsmber -t comtnemplyrinfo \
          -t comtnpasswordresethist -t comtnauthtokenstore \
          -t spring_session -t spring_session_attributes \
          -t account_recovery_request -t account_recovery_audit \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted identity backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted identity backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted identity backup verified: $backup_file (${backup_bytes} bytes)"
  else
  echo "[auto-deploy] database migration detected; creating full pre-deploy backup"
  echo "[auto-deploy] backing up PostgreSQL roles to $roles_backup_file"
  if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
      pg_dumpall -U "$POSTGRES_USER" --roles-only -h 127.0.0.1 \
    | gzip -1 > "$roles_backup_file"; then
    rm -f "$roles_backup_file"
    echo "[auto-deploy] refusing deployment: PostgreSQL role backup failed" >&2
    exit 16
  fi
  if [[ "$(stat -c %s "$roles_backup_file")" -lt 100 ]] || ! gzip -t "$roles_backup_file"; then
    rm -f "$roles_backup_file"
    echo "[auto-deploy] refusing deployment: PostgreSQL role backup is invalid" >&2
    exit 17
  fi
  echo "[auto-deploy] backing up database to $backup_file"
  if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      env "PGAPPNAME=$backup_application_name" "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
      pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
        -h 127.0.0.1 \
    | gzip -1 > "$backup_file"; then
    rm -f "$backup_file"
    echo "[auto-deploy] refusing deployment: database backup failed or exceeded ${BACKUP_TIMEOUT_SECONDS}s" >&2
    exit 14
  fi
  test -s "$backup_file"
  backup_bytes="$(stat -c %s "$backup_file")"
  if [[ "$backup_bytes" -lt "$MIN_BACKUP_BYTES" ]] || ! gzip -t "$backup_file"; then
    rm -f "$backup_file"
    echo "[auto-deploy] refusing deployment: database backup is invalid or too small (${backup_bytes} bytes)" >&2
    exit 11
  fi
  fi
else
  echo "[auto-deploy] database backup skipped: no schema migration in selected work"
fi

# Apply the same policy after a successful dump so retries cannot accumulate
# duplicate full backups faster than the hourly cleanup cadence.
bash ops/scripts/prune-predeploy-backups.sh

# Backend-only and migration-only commits reuse the last verified immutable
# frontend closure. Rebuilding TypeScript for such commits creates avoidable
# I/O pressure and can starve the running Kubernetes workloads.
skip_frontend=true
[[ "$PLAN_FRONTEND_REQUIRED" == "true" ]] && skip_frontend=false
echo "[auto-deploy] frontend build required: $([[ "$skip_frontend" == "true" ]] && echo no || echo yes)"

# Preserve the last verified runtime closure across the merge. The isolated
# frontend build will replace it only after closure validation.
git merge --ff-only "$target_commit"
restore_live_frontend_overlay
if [[ "$PLAN_BACKEND_REQUIRED" == "true" ]]; then
  # Run guards introduced by the pending commit only after that exact revision
  # is present in the selected deployment worktree.
  bash ops/scripts/validate-jpa-entity-package-closure.sh "$ROOT_DIR"
fi
bash ops/scripts/validate-deterministic-development-policy.sh
# Applied Flyway files are immutable. Detect a checksum drift before spending
# time on Java/image builds and before Kubernetes starts a doomed rollout.
POSTGRES_POD="$POSTGRES_POD" \
  bash ops/scripts/verify-flyway-migration-immutability.sh "$ROOT_DIR"

# Capture the last known-good runtime, web proxy and frontend overlay before
# any deployable artifact changes. The post-deploy screen gate restores this
# snapshot automatically if a governed route becomes blank or unavailable.
bash ops/scripts/resonance-full-screen-deploy-gate.sh capture

# A frontend-only commit is compiled directly into the already mounted,
# guarded React overlay. The overlay script verifies the complete hashed asset
# closure and the HTTP response before the deployment marker advances. This
# avoids Java compilation, image creation and a rolling restart while keeping
# rollback material and stale-chunk protection.
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" ]]; then
  frontend_smoke_pattern="$(node \
    projects/carbonet-frontend/source/scripts/derive-frontend-smoke-route-pattern.mjs \
    "$deployed_commit" "$target_commit")"
  echo "[auto-deploy] frontend smoke impact pattern=$frontend_smoke_pattern"
  BASE_URL="${CARBONET_PUBLIC_BASE_URL:-http://127.0.0.1}" \
  OVERLAY_DIR="${CARBONET_LIVE_FRONTEND_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}" \
  STATUS_DIR="${CARBONET_LIVE_STATUS_DIR:-/opt/Resonance/var/run}" \
  SKIP_OVERLAY_BACKUP=true \
  DEFER_REACT_MOUNT_VERIFY=true \
    bash ops/scripts/resonance-screen-overlay-apply.sh
  health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
  if [[ "$health_status" != *'"status":"UP"'* ]]; then
    echo "[auto-deploy] refusing frontend success marker: health check is not UP" >&2
    exit 17
  fi
  bash ops/scripts/validate-common-design-assets.sh
  # Frontend source/CSS changes do not necessarily update DB contract
  # fingerprints. Always exercise a bounded cross-domain canary set here so a
  # common bundle regression can never result in a zero-screen deploy gate.
  # The scheduled nightly sweep remains the global 1,000-screen safety net.
  FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
  FULL_SCREEN_SMOKE_ROUTE_PATTERN="$frontend_smoke_pattern" \
    bash ops/scripts/resonance-full-screen-deploy-gate.sh verify
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  record_deploy_phase "frontend_build_and_verify"
  printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
  record_deploy_performance frontend
  echo "[auto-deploy] frontend overlay deployed without Java/image build or rollout: $target_commit"
  exit 0
fi

# A measured JVM profile changes only the Deployment environment. Promote it
# through a guarded rolling restart and the complete runtime validation suite;
# the promoter restores the previous profile automatically on any failure.
if [[ "$PLAN_RUNTIME_REQUIRED" == "true" \
   && "$PLAN_FRONTEND_REQUIRED" != "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" \
   && ",$PLAN_TESTS," == *",runtime:startup-profile,"* ]]; then
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
    bash ops/scripts/promote-runtime-startup-profile.sh
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  record_deploy_phase "runtime_profile_and_verify"
  rm -f "$ROOT_DIR/var/run/full-screen-deploy-gate/active.env"
  printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
  record_deploy_performance runtime
  echo "[auto-deploy] JVM profile promoted without Java/frontend rebuild: $target_commit"
  exit 0
fi

# Test/deployment automation changes do not alter the running application.
# Validate their syntax and planning contract, then advance the marker without
# rebuilding React, Java, or an immutable image.
if [[ "$PLAN_FRONTEND_REQUIRED" != "true" \
   && "$PLAN_BACKEND_REQUIRED" != "true" \
   && "$PLAN_DATABASE_REQUIRED" != "true" \
   && "$PLAN_INFRASTRUCTURE_REQUIRED" == "true" ]]; then
  bash -n ops/scripts/auto-deploy-main.sh
  bash -n ops/scripts/auto-deploy-main-launcher.sh
  bash -n ops/scripts/plan-incremental-work.sh
  bash ops/scripts/test-plan-incremental-work.sh
  bash -n ops/scripts/resonance-full-screen-deploy-gate.sh
  bash -n projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh
  bash ops/scripts/test-fast-browser-deploy-gate.sh
  bash ops/scripts/test-postdeploy-parallel-browser-gate.sh
  bash ops/scripts/test-candidate-release-rollout-gate.sh
  bash ops/scripts/test-process-worker-deploy-marker.sh
  bash ops/scripts/test-frontend-parallel-build-pipeline.sh
  bash ops/scripts/test-fast-overlay-snapshot.sh
  bash ops/scripts/test-shared-smoke-auth-state.sh
  bash ops/scripts/test-deploy-phase-telemetry.sh
  if [[ ",$PLAN_TESTS," == *",control-plane:validate,"* ]]; then
    bash ops/scripts/resonance-control-plane.sh validate
  fi
  health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
  if [[ "$health_status" != *'"status":"UP"'* ]]; then
    echo "[auto-deploy] refusing automation-only success marker: health check is not UP" >&2
    exit 17
  fi
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$live_frontend_overlay"
  bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  record_deploy_phase "automation_validation"
  rm -f "$ROOT_DIR/var/run/full-screen-deploy-gate/active.env"
  printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
  record_deploy_performance automation
  echo "[auto-deploy] automation-only change validated without frontend/backend build: $target_commit"
  exit 0
fi

# Source catalog closure is independent of a backend-only image build and
# rollout. Overlap its complete 41k+ file audit with those CPU/network waits,
# then join fail-closed before runtime validation. Schema-changing releases
# retain sequential ordering because Flyway may alter catalog contracts.
if [[ "$PLAN_DATABASE_REQUIRED" != "true" ]]; then
  runtime_asset_sync_log="$ROOT_DIR/var/logs/runtime-asset-sync-${target_commit:0:10}.log"
  (
    bash ops/scripts/sync-unified-asset-catalog.sh "$deployed_commit" "$target_commit"
  ) >"$runtime_asset_sync_log" 2>&1 &
  runtime_asset_sync_pid="$!"
  echo "[auto-deploy] source asset closure running concurrently with runtime build pid=$runtime_asset_sync_pid"
fi

# The candidate-image migration Job is the only schema migration owner.
# Runtime pods keep both engines disabled so replicas never contend for DDL.
RUNTIME_JVM_PROFILE="$ROOT_DIR/ops/config/runtime-jvm-profile.env"
[[ -r "$RUNTIME_JVM_PROFILE" ]] || {
  echo "[auto-deploy] refusing deployment: runtime JVM profile is missing" >&2
  exit 8
}
# shellcheck source=ops/config/runtime-jvm-profile.env
source "$RUNTIME_JVM_PROFILE"
: "${CARBONET_RUNTIME_JAVA_OPTS:?runtime JAVA_OPTS profile is required}"
kubectl -n "$NAMESPACE" set env deployment/"$DEPLOYMENT" \
  CARBONET_FLYWAY_ENABLED=false \
  CARBONET_LIQUIBASE_ENABLED=false \
  "JAVA_OPTS=$CARBONET_RUNTIME_JAVA_OPTS"

IMMUTABLE_FRONTEND_IMAGE=true \
SKIP_FRONTEND="$skip_frontend" \
SKIP_NOTIFY="${SKIP_NOTIFY:-true}" \
  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh

# The build/deploy script already gates the exact candidate release pods and
# verifies the runtime. Do not wait a second time for old pods to finish their
# protected connection drain.
health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
if [[ "$health_status" != *'"status":"UP"'* ]]; then
  echo "[auto-deploy] refusing success marker: health check is not UP" >&2
  exit 17
fi
record_deploy_phase "build_rollout_health"
asset_sync_precompleted=false
if [[ -n "$runtime_asset_sync_pid" ]]; then
  if wait "$runtime_asset_sync_pid"; then
    cat "$runtime_asset_sync_log"
    asset_sync_precompleted=true
    runtime_asset_sync_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent source asset closure failed" >&2
    cat "$runtime_asset_sync_log" >&2
    exit 18
  fi
fi
# Browser rendering and the domain validators are independent read/validation
# lanes after rollout health is UP. Start the bounded browser canary alongside
# the three validation groups and join both fail-closed. This removes a
# sequential five-second tail without reducing test coverage.
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
  runtime_screen_gate_log="$ROOT_DIR/var/logs/runtime-screen-gate-${target_commit:0:10}.log"
  (
    FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
    FULL_SCREEN_SMOKE_ROUTE_PATTERN='^/(home|emission/project_list|emission/project/create|emission/my-tasks|home/certificate-verify|admin|admin/system/menu|admin/system/actor-process|admin/emission/survey-admin|admin/emission/survey-admin-data|admin/emission/survey-report|admin/emission/survey-report-print)([?#]|$)' \
      bash ops/scripts/resonance-full-screen-deploy-gate.sh verify
  ) >"$runtime_screen_gate_log" 2>&1 &
  runtime_screen_gate_pid="$!"
  echo "[auto-deploy] bounded browser gate running concurrently pid=$runtime_screen_gate_pid"
fi

# These groups use independent tables and contracts. Ordering remains strict
# inside a group; the reusable harness provides bounded parallelism, isolated
# logs, and one fail-closed result for both deployment and operator testing.
UNIFIED_ASSET_SYNC_PRECOMPLETED="$asset_sync_precompleted" \
  bash ops/scripts/run-post-deploy-validation-groups.sh "$ROOT_DIR" "$target_commit" "$deployed_commit"
if [[ "$PLAN_FRONTEND_REQUIRED" == "true" ]]; then
  if wait "$runtime_screen_gate_pid"; then
    cat "$runtime_screen_gate_log"
    runtime_screen_gate_pid=""
  else
    echo "[auto-deploy] refusing success marker: concurrent browser gate failed" >&2
    cat "$runtime_screen_gate_log" >&2
    exit 19
  fi
else
  # Backend/database-only commits already pass the domain runtime/API/schema
  # gates above. A
  # second 333-route browser sweep adds minutes without exercising new UI.
  # Keep the rollback snapshot and immutable asset closure checks, then accept
  # the healthy runtime. Mixed/frontend/database changes retain the full gate.
  bash ops/scripts/resonance-full-screen-deploy-gate.sh accept-fast
fi
sync_backstage_catalog_if_required
deploy_backstage_if_required
run_backstage_identity_e2e_if_required
start_backstage_visual_e2e
# The identity-contracts post-deploy group above already performs one atomic
# Keycloak-to-Carbonet synchronization and verification. Do not repeat the
# same account writes on the runtime path; catalog/frontend-only paths still
# call sync_keycloak_actor_assignments_if_required before their success marker.
run_actor_process_role_e2e_if_required
wait_backstage_visual_e2e
run_backstage_screen_space_e2e_if_required
sync_postgres_backup_cronjobs_if_required
sync_post_reboot_recovery_if_required
record_deploy_phase "postdeploy_validation"
printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
record_deploy_performance runtime
sudo docker image prune -a -f >/dev/null || true
echo "[auto-deploy] deployed $target_commit after one-shot Flyway verification; runtime migration disabled"

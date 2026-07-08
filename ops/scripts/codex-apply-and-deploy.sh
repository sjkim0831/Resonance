#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/codex-apply-and-deploy.sh <repo-root> <diff-file>

Purpose:
  Apply a prepared diff, rebuild the canonical app jar, verify app closure,
  then schedule restart and runtime freshness verification.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/verify-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

REPO_ROOT="${1:?repo root is required}"
DIFF_FILE="${2:?diff file is required}"
ARTIFACTS_ROOT="$(cd "$(dirname "$DIFF_FILE")" && pwd)"
BACKUP_INFO_FILE="$ARTIFACTS_ROOT/deploy-backup.env"
DEFER_RESTART_SECONDS="${DEFER_RESTART_SECONDS:-3}"
ASYNC_RESTART_LOG="$ARTIFACTS_ROOT/deploy-restart.log"

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "Repository root does not exist: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -f "$DIFF_FILE" ]]; then
  echo "Diff file does not exist: $DIFF_FILE" >&2
  exit 1
fi

cd "$REPO_ROOT"

NO_BUILD_APPLY_SCRIPT="$REPO_ROOT/ops/scripts/resonance-no-build-apply.sh"
if [[ -x "$NO_BUILD_APPLY_SCRIPT" ]]; then
  mapfile -t no_build_candidates < <(git apply --numstat --summary "$DIFF_FILE" 2>/dev/null | awk '
    /^[0-9-]+[[:space:]]+[0-9-]+[[:space:]]+/ {print $3; next}
    / create mode / {print $NF; next}
    / delete mode / {print $NF; next}
  ' | sort -u)
  if [[ ${#no_build_candidates[@]} -eq 0 && -f "$ARTIFACTS_ROOT/changed-files.txt" ]]; then
    mapfile -t no_build_candidates < <(sed '/^[[:space:]]*$/d' "$ARTIFACTS_ROOT/changed-files.txt" | sort -u)
  fi

  if [[ ${#no_build_candidates[@]} -gt 0 ]]; then
    no_build_only=true
    for changed_file in "${no_build_candidates[@]}"; do
      case "$changed_file" in
        projects/carbonet-frontend/src/main/resources/static/react-app/*|\
        projects/carbonet-assets/static/*|\
        projects/carbonet-backend-metadata/*|\
        var/k8s/carbonet-runtime-manifest.json|\
        ops/runtime-metadata/*|\
        ops/scripts/resonance-no-build-apply.sh)
          ;;
        *)
          no_build_only=false
          break
          ;;
      esac
    done

    if [[ "$no_build_only" == true ]]; then
      echo "Detected runtime metadata/overlay-only diff; applying without build or redeploy."
      exec bash "$NO_BUILD_APPLY_SCRIPT" "$REPO_ROOT" "$DIFF_FILE"
    fi
  fi
fi

BACKUP_DIR="$REPO_ROOT/var/backups/codex-deploy"
mkdir -p "$BACKUP_DIR"
BACKUP_SOURCE="$REPO_ROOT/var/run/carbonet-18000.jar"
if [[ ! -f "$BACKUP_SOURCE" ]]; then
  BACKUP_SOURCE="$REPO_ROOT/apps/carbonet-app/target/carbonet.jar"
fi
if [[ -f "$BACKUP_SOURCE" ]]; then
  BACKUP_JAR_PATH="$BACKUP_DIR/carbonet-18000-$(date '+%Y%m%d-%H%M%S').jar"
  cp "$BACKUP_SOURCE" "$BACKUP_JAR_PATH"
  {
    echo "BACKUP_JAR_PATH=$BACKUP_JAR_PATH"
    echo "BACKUP_CREATED_AT=$(date '+%Y-%m-%d %H:%M:%S')"
  } > "$BACKUP_INFO_FILE"
fi

apply_diff() {
  git apply --check --whitespace=nowarn "$DIFF_FILE"
  git apply --whitespace=nowarn "$DIFF_FILE"
}

copy_changed_files_from_worktree() {
  local artifacts_root run_root worktree_root changed_files_file changed_file source_file target_file
  artifacts_root="$(cd "$(dirname "$DIFF_FILE")" && pwd)"
  run_root="$(cd "$artifacts_root/.." && pwd)"
  worktree_root="$run_root/worktree"
  changed_files_file="$artifacts_root/changed-files.txt"

  if [[ ! -d "$worktree_root" ]]; then
    echo "Worktree root does not exist for fallback copy: $worktree_root" >&2
    return 1
  fi
  if [[ ! -f "$changed_files_file" ]]; then
    echo "Changed files list does not exist for fallback copy: $changed_files_file" >&2
    return 1
  fi

  while IFS= read -r changed_file; do
    changed_file="${changed_file#"${changed_file%%[![:space:]]*}"}"
    changed_file="${changed_file%"${changed_file##*[![:space:]]}"}"
    [[ -z "$changed_file" ]] && continue
    source_file="$worktree_root/$changed_file"
    target_file="$REPO_ROOT/$changed_file"
    if [[ ! -f "$source_file" ]]; then
      rm -f "$target_file"
      continue
    fi
    mkdir -p "$(dirname "$target_file")"
    cp "$source_file" "$target_file"
  done < "$changed_files_file"
}

if ! apply_diff; then
  echo "git apply failed; falling back to changed-file copy from worktree" >&2
  copy_changed_files_from_worktree
fi

if [[ -d "$REPO_ROOT/frontend" ]]; then
  (
    cd "$REPO_ROOT/frontend"
    npm run build
  )
fi

# Use REPO_ROOT as the build root for jbuild/JAR detection
ROOT_DIR="$REPO_ROOT"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool

jbuild -q -pl apps/carbonet-app -am -DskipTests package

echo "App closure verification started"
bash "$REPO_ROOT/ops/scripts/verify-large-move-app-closure.sh"

schedule_restart() {
  local restart_command log_file
  log_file="$ASYNC_RESTART_LOG"
  restart_command="sleep $DEFER_RESTART_SECONDS && bash \"$REPO_ROOT/ops/scripts/restart-18000.sh\" && bash \"$REPO_ROOT/ops/scripts/codex-verify-18000-freshness.sh\""
  nohup bash -lc "$restart_command" >"$log_file" 2>&1 </dev/null &
}

schedule_restart
echo "Restart scheduled asynchronously in ${DEFER_RESTART_SECONDS}s. log=$ASYNC_RESTART_LOG"

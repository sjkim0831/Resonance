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

mvn -q -pl apps/carbonet-app -am -DskipTests package

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

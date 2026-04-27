#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/codex-rollback-18000.sh <repo-root> <backup-jar-path>

Purpose:
  Restore a backup jar into the canonical app jar path and restart :18000.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

REPO_ROOT="${1:?repo root is required}"
BACKUP_JAR_PATH="${2:?backup jar path is required}"

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "Repository root does not exist: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_JAR_PATH" ]]; then
  echo "Backup jar does not exist: $BACKUP_JAR_PATH" >&2
  exit 1
fi

TARGET_JAR="$REPO_ROOT/apps/carbonet-app/target/carbonet.jar"
cp "$BACKUP_JAR_PATH" "$TARGET_JAR"
ROLLBACK_LOG_DIR="$REPO_ROOT/var/logs"
mkdir -p "$ROLLBACK_LOG_DIR"
nohup bash "$REPO_ROOT/ops/scripts/restart-18000.sh" > "$ROLLBACK_LOG_DIR/codex-rollback-18000.log" 2>&1 < /dev/null &
echo "Restart scheduled in background."

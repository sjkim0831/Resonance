#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMMIT="${1:-HEAD}"
git -C "$ROOT_DIR" diff --quiet && git -C "$ROOT_DIR" diff --cached --quiet || { echo "main worktree is dirty" >&2; exit 2; }
git -C "$ROOT_DIR" revert --no-edit "$COMMIT"
echo "rollback revert created for $COMMIT; review before push"

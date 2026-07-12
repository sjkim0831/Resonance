#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKTREE="${1:-$(cat "$(dirname "$ROOT_DIR")/.kilo-worktrees/.last" 2>/dev/null || true)}"
[[ -d "$WORKTREE/.git" || -f "$WORKTREE/.git" ]] || { echo "worktree not found" >&2; exit 2; }
(cd "$WORKTREE" && bash ops/scripts/ai-ui-task-verify.sh)
git -C "$WORKTREE" diff --quiet && git -C "$WORKTREE" diff --cached --quiet || { echo "commit Kilo changes in the task worktree first" >&2; exit 3; }
BRANCH="$(git -C "$WORKTREE" branch --show-current)"
git -C "$ROOT_DIR" diff --quiet && git -C "$ROOT_DIR" diff --cached --quiet || { echo "main worktree is dirty" >&2; exit 4; }
BACKUP="backup/pre-apply-$(basename "$BRANCH")-$(date '+%Y%m%d-%H%M%S')"
git -C "$ROOT_DIR" branch "$BACKUP" HEAD
git -C "$ROOT_DIR" merge --ff-only "$BRANCH"
echo "applied=$BRANCH backup=$BACKUP"
echo "review, then push with: git -C '$ROOT_DIR' push origin main"

#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TASK="${1:-}"
[[ "$TASK" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || { echo "usage: $0 <task-name> [--launch]" >&2; exit 2; }
STAMP="$(date '+%Y%m%d-%H%M%S')"
BRANCH="ai-ui/${TASK}-${STAMP}"
WORKTREE="$(dirname "$ROOT_DIR")/.kilo-worktrees/${TASK}-${STAMP}"
mkdir -p "$(dirname "$WORKTREE")"
git -C "$ROOT_DIR" branch "backup/pre-${TASK}-${STAMP}" HEAD
git -C "$ROOT_DIR" worktree add --no-checkout -b "$BRANCH" "$WORKTREE" HEAD
git -C "$WORKTREE" sparse-checkout init --cone
git -C "$WORKTREE" sparse-checkout set projects/carbonet-frontend/source ops/scripts
git -C "$WORKTREE" checkout "$BRANCH"
cat > "$WORKTREE/KILO_UI_TASK.md" <<EOF
# Kilo UI-only task: $TASK

Allowed: projects/carbonet-frontend/source/src/features/**, components/**, styles/**, and app/routes/**.
Do not modify backend, database, deployment, authentication, secrets, build configuration, or install packages.
Use existing API clients only. If a backend/API change is required, stop and report BLOCKED with the required contract.
Before completion run: bash ops/scripts/ai-ui-task-verify.sh
EOF
WORKTREE_GIT_DIR="$(git -C "$WORKTREE" rev-parse --git-dir)"
mkdir -p "$WORKTREE_GIT_DIR/info"
printf 'KILO_UI_TASK.md\n' >> "$WORKTREE_GIT_DIR/info/exclude"
printf '%s\n' "$WORKTREE" > "$(dirname "$ROOT_DIR")/.kilo-worktrees/.last"
echo "worktree=$WORKTREE"
echo "branch=$BRANCH"
echo "launch: kilo '$WORKTREE' --prompt 'Read KILO_UI_TASK.md completely before editing.'"
if [[ "${2:-}" == "--launch" ]]; then exec kilo "$WORKTREE" --prompt "Read KILO_UI_TASK.md completely before editing."; fi

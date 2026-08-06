#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

fail() {
  echo "[test-auto-deploy-persistent-worktree-recovery] FAIL: $*" >&2
  exit 1
}

function_source="$(awk '
  /^recover_invalid_persistent_build_worktree\(\)/ { capture=1 }
  capture { print }
  capture && /^}/ { exit }
' "$DEPLOY")"
[[ "$function_source" == *'worktree repair'* ]] || fail 'repair-first contract is missing'
[[ "$function_source" == *'rm -rf -- "$persistent_real"'* ]] || fail 'bounded invalid-directory removal is missing'

repo="$TMP/repository"
base="$repo/var/deploy-worktrees"
runtime="$base/runtime-build"
git init -q "$repo"
git -C "$repo" config user.name 'Resonance test'
git -C "$repo" config user.email 'resonance-test@example.invalid'
printf 'fixture\n' >"$repo/README.md"
git -C "$repo" add README.md
git -C "$repo" commit -qm fixture
mkdir -p "$runtime/.gradle"
printf 'gitdir: %s/.git/worktrees/runtime-build\n' "$repo" >"$runtime/.git"
printf 'generated cache\n' >"$runtime/.gradle/cache.bin"

(
  eval "$function_source"
  ROOT_DIR="$repo"
  CARBONET_DEPLOY_ORIGINAL_ROOT="$repo"
  deploy_worktree_root="$(realpath -m "$base")"
  persistent_build_worktree="$runtime"
  recover_invalid_persistent_build_worktree
)
[[ ! -e "$runtime" ]] || fail 'stale worktree directory survived recovery'

git -C "$repo" worktree add -q --detach "$runtime" HEAD
printf 'keep cache\n' >"$runtime/.valid-cache"
(
  eval "$function_source"
  ROOT_DIR="$repo"
  CARBONET_DEPLOY_ORIGINAL_ROOT="$repo"
  deploy_worktree_root="$(realpath -m "$base")"
  persistent_build_worktree="$runtime"
  recover_invalid_persistent_build_worktree
)
[[ -f "$runtime/.valid-cache" ]] || fail 'valid worktree cache was removed'
git -C "$runtime" rev-parse --is-inside-work-tree >/dev/null || fail 'valid worktree was damaged'

set +e
(
  eval "$function_source"
  ROOT_DIR="$repo"
  CARBONET_DEPLOY_ORIGINAL_ROOT="$repo"
  deploy_worktree_root="$(realpath -m "$base")"
  persistent_build_worktree="$base/not-runtime-build"
  recover_invalid_persistent_build_worktree
) >/dev/null 2>&1
unsafe_rc=$?
set -e
[[ "$unsafe_rc" -eq 23 ]] || fail "unsafe path did not fail closed (exit=$unsafe_rc)"

echo '[test-auto-deploy-persistent-worktree-recovery] PASS: stale metadata rebuilt, valid cache preserved, unsafe path rejected'

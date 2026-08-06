#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"

[[ -d "$ROOT_DIR/.git" || -f "$ROOT_DIR/.git" ]] || {
  printf '[frontend-generated-cleanup] invalid git worktree: %s\n' "$ROOT_DIR" >&2
  exit 2
}

# A deployment worktree is required to be clean before a build starts. These
# paths are the only tracked files that frontend generators may rewrite while
# compiling. Never restore application source outside this bounded allowlist.
allowed_path() {
  case "$1" in
    projects/carbonet-frontend/source/src/generated/* | \
    projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts | \
    projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts | \
    projects/carbonet-frontend/source/.cache/full-screen-smoke/* | \
    projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json)
      return 0
      ;;
    *) return 1 ;;
  esac
}

mapfile -t dirty_tracked < <(
  git -C "$ROOT_DIR" status --porcelain=v1 --untracked-files=no |
    sed -E 's/^.. //' |
    sed -E 's/^.* -> //' |
    sed '/^$/d'
)

generated=()
preserved=()
for path in "${dirty_tracked[@]:-}"; do
  if allowed_path "$path"; then
    generated+=("$path")
  else
    preserved+=("$path")
  fi
done

if ((${#generated[@]})); then
  git -C "$ROOT_DIR" restore --worktree -- "${generated[@]}"
fi

printf '[frontend-generated-cleanup] restored=%d preserved=%d\n' \
  "${#generated[@]}" "${#preserved[@]}"
for path in "${generated[@]:-}"; do
  [[ -n "$path" ]] && printf '[frontend-generated-cleanup] restored path=%s\n' "$path"
done
for path in "${preserved[@]:-}"; do
  [[ -n "$path" ]] && printf '[frontend-generated-cleanup] preserved source change=%s\n' "$path" >&2
done

# A non-generated tracked change is never auto-cleaned and remains an explicit
# deployment blocker for a human or a subsequent guarded reconciliation.
((${#preserved[@]} == 0))

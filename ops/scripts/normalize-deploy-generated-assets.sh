#!/usr/bin/env bash
set -euo pipefail

worktree="${1:-${CARBONET_DEPLOY_ROOT:-}}"
[[ -n "$worktree" ]] || { echo "usage: $0 WORKTREE" >&2; exit 2; }
worktree="$(realpath -m "$worktree")"
git -C "$worktree" rev-parse --is-inside-work-tree >/dev/null

# These paths are build outputs or deterministic generator products. Source,
# operator files, Gradle caches and backend build directories are intentionally
# outside this list.
generated_paths=(
  apps/carbonet-api/src/main/resources/static/react-app
  projects/carbonet-assets/static/react-app
  projects/carbonet-frontend/src/main/resources/static/react-app
  projects/carbonet-frontend/source/src/generated/screen-generation/definitions
  projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenTypes.ts
  projects/carbonet-backend-metadata/process-runtime/design-preview
  projects/carbonet-backend-metadata/process-runtime/generated
  projects/carbonet-backend-metadata/process-runtime/generated-endpoints
)

for generated_path in "${generated_paths[@]}"; do
  tracked="$(git -C "$worktree" ls-files -- "$generated_path")"
  [[ -n "$tracked" || -e "$worktree/$generated_path" ]] || continue
  if [[ -n "$tracked" ]]; then
    git -C "$worktree" restore --worktree -- "$generated_path"
  fi
  # Generated source roots must contain exactly the target commit. Include
  # ignored files: an ignored stale Java class is still visible to Gradle and
  # can otherwise compile into the candidate runtime.
  git -C "$worktree" clean -ffdx -- "$generated_path" >/dev/null
done

remaining="$(git -C "$worktree" status --porcelain=v1 -- "${generated_paths[@]}")"
if [[ -n "$remaining" ]]; then
  echo "[generated-normalize] generated paths remain dirty" >&2
  printf '%s\n' "$remaining" >&2
  exit 1
fi
echo "GENERATED_WORKTREE_CLEAN"

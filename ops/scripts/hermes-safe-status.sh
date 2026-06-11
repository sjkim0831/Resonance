#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

MAX_FILE_MB="${CODEX_GIT_MAX_FILE_MB:-95}"
MAX_FILE_BYTES=$((MAX_FILE_MB * 1024 * 1024))

printf 'root: %s\n' "$ROOT_DIR"
printf 'branch: %s\n' "$(git branch --show-current)"
printf 'head: %s %s\n' "$(git rev-parse --short HEAD)" "$(git log -1 --pretty=%s)"
printf 'status_count: %s\n' "$(git status --short | wc -l | tr -d ' ')"
printf '\nstatus_preview:\n'
git status --short | sed -n '1,80p'

printf '\nlarge_worktree_files_over_%sMB:\n' "$MAX_FILE_MB"
found_large=0
while IFS= read -r -d '' record; do
  path="${record:3}"
  [[ -f "$path" ]] || continue
  size="$(wc -c < "$path" 2>/dev/null || printf '0')"
  if [[ "$size" =~ ^[0-9]+$ ]] && (( size > MAX_FILE_BYTES )); then
    found_large=1
    printf '%s bytes  %s\n' "$size" "$path"
  fi
done < <(git status --porcelain=v1 -z)
if (( found_large == 0 )); then
  printf 'none\n'
fi

printf '\nreact_overlay_mount:\n'
if command -v kubectl >/dev/null 2>&1; then
  kubectl -n carbonet-prod get deploy carbonet-runtime \
    -o jsonpath='{range .spec.template.spec.volumes[*]}{.name}{" -> "}{.hostPath.path}{"\n"}{end}' 2>/dev/null \
    | grep react-app-overlay -B1 -A1 || true
else
  printf 'kubectl not available\n'
fi

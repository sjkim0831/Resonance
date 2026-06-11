#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:?repo root is required}"
DIFF_FILE="${2:?diff file is required}"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend directory does not exist: $FRONTEND_DIR" >&2
  exit 1
fi

if [[ ! -f "$DIFF_FILE" ]]; then
  echo "Diff file does not exist: $DIFF_FILE" >&2
  exit 1
fi

ARTIFACTS_ROOT="$(cd "$(dirname "$DIFF_FILE")" && pwd)"
CHANGED_FILES_FILE="$ARTIFACTS_ROOT/changed-files.txt"

cd "$FRONTEND_DIR"
npm run build

if [[ ! -f "$CHANGED_FILES_FILE" ]]; then
  exit 0
fi

mapfile -t MATCHED_SPECS < <(
  while IFS= read -r changed_file; do
    trimmed="${changed_file#"${changed_file%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
    [[ -z "$trimmed" ]] && continue
    case "$trimmed" in
      frontend/src/features/*/MemberListMigrationPage.tsx)
        printf '%s\n' "e2e/member-list.spec.ts"
        ;;
      frontend/src/features/member-list/*)
        printf '%s\n' "e2e/member-list.spec.ts"
        ;;
    esac
  done < "$CHANGED_FILES_FILE" | sort -u
)

if [[ ${#MATCHED_SPECS[@]} -eq 0 ]]; then
  exit 0
fi

for spec in "${MATCHED_SPECS[@]}"; do
  if [[ -f "$spec" ]]; then
    npx playwright test "$spec"
  fi
done

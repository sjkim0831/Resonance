#!/usr/bin/env bash
set -euo pipefail

PROCESS_CODE="${1:?process code is required}"
DIFF_LINES="${2:?diff line count is required}"
MAX_FILES="${DETERMINISTIC_FULLSTACK_MAX_FILES:-50}"
MAX_LINES="${DETERMINISTIC_FULLSTACK_MAX_LINES:-12000}"

[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]]
[[ "$DIFF_LINES" =~ ^[0-9]+$ && "$MAX_FILES" =~ ^[0-9]+$ && "$MAX_LINES" =~ ^[0-9]+$ ]]
(( DIFF_LINES <= MAX_LINES ))

count=0
while IFS= read -r status_line; do
  [[ -n "$status_line" ]] || continue
  ((count += 1))
  path="${status_line:3}"
  [[ "$path" != *' -> '* ]]
  case "$path" in
    "projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS_CODE/"*.json|\
    "projects/carbonet-backend-metadata/process-runtime/design-preview/$PROCESS_CODE/"*.json) ;;
    *)
      echo "deterministic full-stack diff escaped generated metadata scope: $path" >&2
      exit 1
      ;;
  esac
done
(( count > 0 && count <= MAX_FILES ))

printf 'deterministic full-stack diff accepted: process=%s files=%s lines=%s limits=%s/%s\n' \
  "$PROCESS_CODE" "$count" "$DIFF_LINES" "$MAX_FILES" "$MAX_LINES"

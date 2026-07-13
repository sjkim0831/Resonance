#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
REFERENCE_ROOT="${REFERENCE_ROOT:-/opt/reference}"
INDEX_ROOT="${AI_SEARCH_INDEX_ROOT:-/opt/resonance-ai-search-index}"
PROCESS_CODE="${1:?process code is required}"
STEP_CODE="${2:?step code is required}"
JOB_TYPE="${3:?job type is required}"
TARGET_PATH="${4:-}"
COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
KEY="$(printf '%s' "$COMMIT|$PROCESS_CODE|$STEP_CODE|$JOB_TYPE|$TARGET_PATH" | sha256sum | cut -d' ' -f1)"
CACHE="$INDEX_ROOT/$KEY.context"
mkdir -p "$INDEX_ROOT"

if [ -s "$CACHE" ]; then
  printf '%s\n' "$CACHE"
  exit 0
fi

TERMS="$(printf '%s %s %s' "$PROCESS_CODE" "$STEP_CODE" "$TARGET_PATH" | tr '/_.-' '    ' | xargs | tr ' ' '|' | sed 's/|\{2,\}/|/g')"
TMP="$CACHE.tmp.$$"
{
  printf 'commit=%s\nprocess=%s\nstep=%s\ntype=%s\ntarget=%s\n' "$COMMIT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" "$TARGET_PATH"
  printf '\n[repository candidates]\n'
  if [ -n "$TERMS" ]; then
    rg -l -i -m 1 --glob '!**/node_modules/**' --glob '!**/build/**' --glob '!**/.gradle/**' \
      "$TERMS" "$ROOT_DIR/apps" "$ROOT_DIR/modules" "$ROOT_DIR/projects" "$ROOT_DIR/ops" 2>/dev/null | \
      sed "s#^$ROOT_DIR/##" | head -n 100 || true
  fi
  if [ -n "$TARGET_PATH" ] && [ -e "$ROOT_DIR/$TARGET_PATH" ]; then
    printf '%s\n' "$TARGET_PATH"
  fi
  printf '\n[reference candidates]\n'
  if [ -d "$REFERENCE_ROOT" ] && [ -n "$TERMS" ]; then
    find "$REFERENCE_ROOT" -type f -printf '%p\n' 2>/dev/null | rg -i "$TERMS" | head -n 80 || true
  fi
} | awk '!seen[$0]++' >"$TMP"
mv "$TMP" "$CACHE"
printf '%s\n' "$CACHE"

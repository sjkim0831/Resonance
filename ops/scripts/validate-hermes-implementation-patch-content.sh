#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PATCH_CONTENT_PATH="${1:-${PATCH_CONTENT_PATH:-}}"
SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-implementation-patch-content.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$PATCH_CONTENT_PATH" ] || fail "usage: validate-hermes-implementation-patch-content.sh <patch-content.json>"

case "$PATCH_CONTENT_PATH" in
  /*) PATCH_CONTENT="$PATCH_CONTENT_PATH" ;;
  *) PATCH_CONTENT="$ROOT_DIR/$PATCH_CONTENT_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$PATCH_CONTENT" ] || fail "missing patch content: $PATCH_CONTENT_PATH"
jq empty "$SCHEMA" "$PATCH_CONTENT"

jq -e '
  . as $content
  | $content.schemaVersion == "1.0" and
  $content.content_type == "hermes-implementation-patch-content" and
  $content.mutation_allowed == false and
  $content.apply_allowed == false and
  ($content.target_files | type == "array" and length > 0 and length <= 6) and
  ($content.patches | type == "array" and length > 0) and
  ($content.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh") and
  ($content.rollback_note | type == "string" and length > 0)
' "$PATCH_CONTENT" >/dev/null || fail "patch content contract validation failed"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe target file: $file"
      ;;
  esac
done < <(jq -r '.target_files[]' "$PATCH_CONTENT")

while IFS= read -r patch; do
  [ -n "$patch" ] || continue
  op="$(printf '%s' "$patch" | jq -r '.operation // empty')"
  file="$(printf '%s' "$patch" | jq -r '.file // empty')"
  case "$op" in
    replace_text|append_text|add_file) ;;
    *) fail "unsupported patch operation: $op" ;;
  esac
  [ -n "$file" ] || fail "patch missing file"
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe patch file: $file"
      ;;
  esac
  jq -e --arg file "$file" '.target_files | index($file)' "$PATCH_CONTENT" >/dev/null \
    || fail "patch file is not listed in target_files: $file"
  if [ "$op" = "replace_text" ]; then
    old_text="$(printf '%s' "$patch" | jq -r '.old_text // empty')"
    new_text="$(printf '%s' "$patch" | jq -r '.new_text // empty')"
    [ -n "$old_text" ] || fail "replace_text patch missing old_text"
    [ -n "$new_text" ] || fail "replace_text patch missing new_text"
  fi
  if [ "$op" = "append_text" ] || [ "$op" = "add_file" ]; then
    text="$(printf '%s' "$patch" | jq -r '.text // empty')"
    [ -n "$text" ] || fail "$op patch missing text"
  fi
done < <(jq -c '.patches[]' "$PATCH_CONTENT")

printf 'IMPLEMENTATION_PATCH_CONTENT_VALID %s\n' "${PATCH_CONTENT#$ROOT_DIR/}"

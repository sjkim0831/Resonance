#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PATCH_CONTENT_PATH="${1:-${PATCH_CONTENT_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"
VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-patch-content.sh"

mkdir -p "$OUT_DIR"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$PATCH_CONTENT_PATH" ] || fail "usage: dry-run-hermes-implementation-patch-content.sh <patch-content.json>"

case "$PATCH_CONTENT_PATH" in
  /*) PATCH_CONTENT="$PATCH_CONTENT_PATH" ;;
  *) PATCH_CONTENT="$ROOT_DIR/$PATCH_CONTENT_PATH" ;;
esac

[ -f "$VALIDATOR" ] || fail "missing validator: ${VALIDATOR#$ROOT_DIR/}"
[ -f "$PATCH_CONTENT" ] || fail "missing patch content: $PATCH_CONTENT_PATH"
"$VALIDATOR" "$PATCH_CONTENT" >/dev/null

request_id="$(jq -r '.request_id // empty' "$PATCH_CONTENT")"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
DRY_RUN_JSON="$OUT_DIR/hermes-implementation-patch-dry-run-${SAFE_REQUEST}-${STAMP}.json"
DRY_RUN_MD="$OUT_DIR/hermes-implementation-patch-dry-run-${SAFE_REQUEST}-${STAMP}.md"
RESULTS_JSON="$(mktemp)"

status="pass"

jq -c '.patches[]' "$PATCH_CONTENT" | while IFS= read -r patch; do
  op="$(printf '%s' "$patch" | jq -r '.operation')"
  file="$(printf '%s' "$patch" | jq -r '.file')"
  abs_file="$ROOT_DIR/$file"
  result="pass"
  reason="dry-run check passed"

  case "$op" in
    replace_text)
      if [ ! -f "$abs_file" ]; then
        result="fail"
        reason="replace_text target file does not exist"
      else
        old_text="$(printf '%s' "$patch" | jq -r '.old_text')"
        if ! grep -Fq -- "$old_text" "$abs_file"; then
          result="fail"
          reason="replace_text old_text not found in target file"
        fi
      fi
      ;;
    append_text)
      if [ ! -f "$abs_file" ]; then
        result="fail"
        reason="append_text target file does not exist"
      fi
      ;;
    add_file)
      if [ -e "$abs_file" ]; then
        result="fail"
        reason="add_file target already exists"
      else
        parent_dir="$(dirname "$abs_file")"
        if [ ! -d "$parent_dir" ]; then
          result="fail"
          reason="add_file parent directory does not exist"
        fi
      fi
      ;;
  esac

  jq -n \
    --arg operation "$op" \
    --arg file "$file" \
    --arg result "$result" \
    --arg reason "$reason" \
    '{operation: $operation, file: $file, result: $result, reason: $reason}'
done | jq -s '.' > "$RESULTS_JSON"

if jq -e '.[] | select(.result != "pass")' "$RESULTS_JSON" >/dev/null; then
  status="fail"
fi

jq -n \
  --arg requestId "$request_id" \
  --arg sourcePatchContent "${PATCH_CONTENT#$ROOT_DIR/}" \
  --arg generatedAt "$(date -Is)" \
  --arg status "$status" \
  --arg closeoutMd "${DRY_RUN_MD#$ROOT_DIR/}" \
  --argjson results "$(cat "$RESULTS_JSON")" \
  '{
    schemaVersion: "1.0",
    dry_run_type: "hermes-implementation-patch-content-dry-run",
    request_id: $requestId,
    source_patch_content: $sourcePatchContent,
    generated_at: $generatedAt,
    status: $status,
    mutation_allowed: false,
    apply_allowed: false,
    results: $results,
    closeout_markdown: $closeoutMd
  }' > "$DRY_RUN_JSON"

{
  printf '# Hermes Implementation Patch Content Dry Run\n\n'
  printf -- '- request: `%s`\n' "$request_id"
  printf -- '- source patch content: `%s`\n' "${PATCH_CONTENT#$ROOT_DIR/}"
  printf -- '- status: `%s`\n' "$status"
  printf -- '- mutation allowed: `false`\n'
  printf -- '- apply allowed: `false`\n'
  printf '\n## Results\n\n'
  jq -r '.[] | "- `" + .operation + "` `" + .file + "`: `" + .result + "` - " + .reason' "$RESULTS_JSON"
} > "$DRY_RUN_MD"

rm -f "$RESULTS_JSON"

if [ "$status" = "pass" ]; then
  printf 'IMPLEMENTATION_PATCH_DRY_RUN_READY %s\n' "${DRY_RUN_JSON#$ROOT_DIR/}"
  printf 'IMPLEMENTATION_PATCH_DRY_RUN_MARKDOWN %s\n' "${DRY_RUN_MD#$ROOT_DIR/}"
else
  printf 'IMPLEMENTATION_PATCH_DRY_RUN_FAILED %s\n' "${DRY_RUN_JSON#$ROOT_DIR/}" >&2
  printf 'IMPLEMENTATION_PATCH_DRY_RUN_MARKDOWN %s\n' "${DRY_RUN_MD#$ROOT_DIR/}" >&2
  exit 1
fi

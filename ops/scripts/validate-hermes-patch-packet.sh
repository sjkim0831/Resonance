#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PATCH_PACKET_PATH="${1:-${PATCH_PACKET_PATH:-}}"
SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-patch-packet.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$PATCH_PACKET_PATH" ] || fail "usage: validate-hermes-patch-packet.sh <patch-packet.json>"

case "$PATCH_PACKET_PATH" in
  /*) PATCH_PACKET="$PATCH_PACKET_PATH" ;;
  *) PATCH_PACKET="$ROOT_DIR/$PATCH_PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$PATCH_PACKET" ] || fail "missing patch packet: $PATCH_PACKET_PATH"
jq empty "$SCHEMA" "$PATCH_PACKET"

jq -e '
  . as $packet
  | $packet.schemaVersion == "1.0" and
  $packet.packet_type == "hermes-patch-plan" and
  $packet.status == "PATCH_PLAN_READY" and
  $packet.mutation_allowed == false and
  ($packet.selected_files | type == "array" and length > 0 and length <= $packet.worker_contract.max_files) and
  ($packet.planned_edits | type == "array" and length == ($packet.selected_files | length)) and
  ($packet.dangerous_operation.requested == false) and
  ($packet.worker_contract.implementation_allowed == false) and
  ($packet.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh")
' "$PATCH_PACKET" >/dev/null || fail "patch packet contract validation failed"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe selected file: $file"
      ;;
  esac
  [ -e "$ROOT_DIR/$file" ] || fail "selected file does not exist: $file"
done < <(jq -r '.selected_files[]' "$PATCH_PACKET")

if jq -e '.planned_edits[] | select(.mutation != false)' "$PATCH_PACKET" >/dev/null; then
  fail "planned edit attempted mutation"
fi

printf 'PATCH_PACKET_VALID %s\n' "${PATCH_PACKET#$ROOT_DIR/}"

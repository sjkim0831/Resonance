#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMPLEMENTATION_PACKET_PATH="${1:-${IMPLEMENTATION_PACKET_PATH:-}}"
SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-implementation-packet.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$IMPLEMENTATION_PACKET_PATH" ] || fail "usage: validate-hermes-implementation-packet.sh <implementation-packet.json>"

case "$IMPLEMENTATION_PACKET_PATH" in
  /*) IMPLEMENTATION_PACKET="$IMPLEMENTATION_PACKET_PATH" ;;
  *) IMPLEMENTATION_PACKET="$ROOT_DIR/$IMPLEMENTATION_PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$IMPLEMENTATION_PACKET" ] || fail "missing implementation packet: $IMPLEMENTATION_PACKET_PATH"
jq empty "$SCHEMA" "$IMPLEMENTATION_PACKET"

jq -e '
  . as $packet
  | $packet.schemaVersion == "1.0" and
  $packet.packet_type == "hermes-implementation-plan" and
  ($packet.status == "IMPLEMENTATION_APPROVAL_REQUIRED" or $packet.status == "READY_FOR_IMPLEMENTATION_WORKER") and
  ($packet.approval_required == true) and
  ($packet.selected_files | type == "array" and length > 0 and length <= $packet.worker_contract.max_files) and
  ($packet.proposed_changes | type == "array" and length == ($packet.selected_files | length)) and
  ($packet.dangerous_operation.requested == false) and
  ($packet.worker_contract.generic_worker_allowed == false) and
  ($packet.worker_contract.dedicated_implementation_worker_required == true) and
  ($packet.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh")
' "$IMPLEMENTATION_PACKET" >/dev/null || fail "implementation packet contract validation failed"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe selected file: $file"
      ;;
  esac
  [ -e "$ROOT_DIR/$file" ] || fail "selected file does not exist: $file"
done < <(jq -r '.selected_files[]' "$IMPLEMENTATION_PACKET")

if jq -e '.proposed_changes[] | select(.patch_content_included != false)' "$IMPLEMENTATION_PACKET" >/dev/null; then
  fail "implementation packet unexpectedly embedded patch content"
fi

printf 'IMPLEMENTATION_PACKET_VALID %s\n' "${IMPLEMENTATION_PACKET#$ROOT_DIR/}"

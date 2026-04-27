#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PACKET_PATH="${1:-${PACKET_PATH:-}}"
SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-reviewed-apply-packet.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$PACKET_PATH" ] || fail "usage: validate-hermes-reviewed-apply-packet.sh <reviewed-apply-packet.json>"

case "$PACKET_PATH" in
  /*) PACKET="$PACKET_PATH" ;;
  *) PACKET="$ROOT_DIR/$PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$PACKET" ] || fail "missing reviewed apply packet: $PACKET_PATH"
jq empty "$SCHEMA" "$PACKET"

jq -e '
  . as $packet
  | $packet.schemaVersion == "1.0" and
  $packet.packet_type == "hermes-reviewed-apply-packet" and
  $packet.review_status == "REVIEWED_APPLY_PENDING" and
  $packet.mutation_allowed == false and
  $packet.apply_allowed == false and
  ($packet.selected_files | type == "array" and length > 0 and length <= 6) and
  ($packet.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh") and
  ($packet.rollback_note | type == "string" and length > 0) and
  ($packet.worker_contract.future_apply_worker_required == true) and
  ($packet.worker_contract.generic_worker_allowed == false)
' "$PACKET" >/dev/null || fail "reviewed apply packet contract validation failed"

for ref in \
  "$(jq -r '.source_implementation_packet // empty' "$PACKET")" \
  "$(jq -r '.source_patch_content // empty' "$PACKET")" \
  "$(jq -r '.source_patch_dry_run // empty' "$PACKET")" \
  "$(jq -r '.source_implementation_preview // empty' "$PACKET")"
do
  [ -n "$ref" ] || fail "reviewed apply packet missing source reference"
  [ -f "$ROOT_DIR/$ref" ] || fail "reviewed apply packet source missing: $ref"
done

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe selected file: $file"
      ;;
  esac
done < <(jq -r '.selected_files[]' "$PACKET")

printf 'REVIEWED_APPLY_PACKET_VALID %s\n' "${PACKET#$ROOT_DIR/}"

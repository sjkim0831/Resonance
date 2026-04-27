#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REVIEW_PACKET_PATH="${1:-${REVIEW_PACKET_PATH:-}}"
SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-memory-patch-review.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

[ -n "$REVIEW_PACKET_PATH" ] || fail "usage: validate-hermes-memory-patch-review.sh <review-packet.json>"

case "$REVIEW_PACKET_PATH" in
  /*) REVIEW_PACKET="$REVIEW_PACKET_PATH" ;;
  *) REVIEW_PACKET="$ROOT_DIR/$REVIEW_PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$REVIEW_PACKET" ] || fail "missing review packet: $REVIEW_PACKET_PATH"
jq empty "$SCHEMA" "$REVIEW_PACKET"

jq -e '
  . as $packet
  | $packet.schemaVersion == "1.0" and
  $packet.packet_type == "hermes-memory-patch-review" and
  $packet.status == "MEMORY_PATCH_REVIEW_READY" and
  ($packet.review_status == "NO_UPDATE_RECOMMENDED" or $packet.review_status == "REVIEW_REQUIRED") and
  $packet.mutation_allowed == false and
  $packet.apply_allowed == false and
  ($packet.target_files | type == "array" and length > 0 and length <= $packet.worker_contract.max_files) and
  ($packet.review_findings | type == "array" and length == ($packet.target_files | length)) and
  $packet.dangerous_operation.requested == false and
  $packet.worker_contract.generic_worker_allowed == false and
  $packet.worker_contract.reviewed_patch_required_before_context_update == true and
  $packet.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh"
' "$REVIEW_PACKET" >/dev/null || fail "memory patch review contract validation failed"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    data/ai-runtime/hermes-rag-context-pack.json|data/ai-runtime/deterministic-route-map.json) ;;
    *) fail "target file is not allowed for memory patch review: $file" ;;
  esac
  [ -f "$ROOT_DIR/$file" ] || fail "target file does not exist: $file"
done < <(jq -r '.target_files[]' "$REVIEW_PACKET")

if jq -e '.review_findings[] | select(.patch_content_included != false)' "$REVIEW_PACKET" >/dev/null; then
  fail "memory patch review unexpectedly embedded patch content"
fi

printf 'MEMORY_PATCH_REVIEW_VALID %s\n' "${REVIEW_PACKET#$ROOT_DIR/}"

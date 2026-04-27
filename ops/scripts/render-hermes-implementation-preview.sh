#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMPLEMENTATION_PACKET_PATH="${1:-${IMPLEMENTATION_PACKET_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"

VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-packet.sh"

mkdir -p "$OUT_DIR"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

if [ -z "$IMPLEMENTATION_PACKET_PATH" ]; then
  latest_packet="$(find "$ROOT_DIR/var/agent-task-packets" -maxdepth 1 -type f -name 'hermes-implementation-packet-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_packet" ] || fail "no implementation packet provided and no packet exists under var/agent-task-packets"
  IMPLEMENTATION_PACKET_PATH="$latest_packet"
fi

case "$IMPLEMENTATION_PACKET_PATH" in
  /*) IMPLEMENTATION_PACKET="$IMPLEMENTATION_PACKET_PATH" ;;
  *) IMPLEMENTATION_PACKET="$ROOT_DIR/$IMPLEMENTATION_PACKET_PATH" ;;
esac

[ -f "$VALIDATOR" ] || fail "missing validator: ${VALIDATOR#$ROOT_DIR/}"
[ -f "$IMPLEMENTATION_PACKET" ] || fail "implementation packet not found: $IMPLEMENTATION_PACKET_PATH"
"$VALIDATOR" "$IMPLEMENTATION_PACKET" >/dev/null

request_id="$(jq -r '.request_id // empty' "$IMPLEMENTATION_PACKET")"
objective_id="$(jq -r '.objective_id // empty' "$IMPLEMENTATION_PACKET")"
zone="$(jq -r '.zone // empty' "$IMPLEMENTATION_PACKET")"
packet_status="$(jq -r '.status // empty' "$IMPLEMENTATION_PACKET")"
patch_content_count="$(jq '[.proposed_changes[] | select(.patch_content_included == true)] | length' "$IMPLEMENTATION_PACKET")"
dangerous_requested="$(jq -r '.dangerous_operation.requested // false' "$IMPLEMENTATION_PACKET")"

[ -n "$request_id" ] || fail "implementation packet missing request_id"
[ "$dangerous_requested" = "false" ] || fail "dangerous operation implementation packets cannot be previewed by this gate"

if [ "$patch_content_count" -gt 0 ]; then
  preview_decision="reject_patch_content"
else
  preview_decision="empty_envelope_only"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
PREVIEW_JSON="$OUT_DIR/hermes-implementation-preview-${SAFE_REQUEST}-${STAMP}.json"
PREVIEW_MD="$OUT_DIR/hermes-implementation-preview-${SAFE_REQUEST}-${STAMP}.md"

jq -n \
  --arg requestId "$request_id" \
  --arg objectiveId "$objective_id" \
  --arg zone "$zone" \
  --arg sourcePacket "${IMPLEMENTATION_PACKET#$ROOT_DIR/}" \
  --arg generatedAt "$(date -Is)" \
  --arg packetStatus "$packet_status" \
  --arg previewDecision "$preview_decision" \
  --argjson patchContentCount "$patch_content_count" \
  --argjson selectedFiles "$(jq '.selected_files' "$IMPLEMENTATION_PACKET")" \
  '{
    schemaVersion: "1.0",
    preview_type: "hermes-implementation-preview",
    request_id: $requestId,
    objective_id: $objectiveId,
    zone: $zone,
    source_implementation_packet: $sourcePacket,
    generated_at: $generatedAt,
    packet_status: $packetStatus,
    selected_files: $selectedFiles,
    patch_content_count: $patchContentCount,
    preview_decision: $previewDecision,
    mutation_allowed: false,
    apply_allowed: false,
    verification_gate: "bash ops/scripts/run-hermes-rag-smoke.sh",
    reviewer_note: "Preview only. This artifact never applies patches; a future reviewed apply worker must be separate."
  }' > "$PREVIEW_JSON"

{
  printf '# Hermes Implementation Preview\n\n'
  printf -- '- request: `%s`\n' "$request_id"
  printf -- '- objective: `%s`\n' "$objective_id"
  printf -- '- zone: `%s`\n' "$zone"
  printf -- '- source packet: `%s`\n' "${IMPLEMENTATION_PACKET#$ROOT_DIR/}"
  printf -- '- packet status: `%s`\n' "$packet_status"
  printf -- '- patch content count: `%s`\n' "$patch_content_count"
  printf -- '- preview decision: `%s`\n' "$preview_decision"
  printf -- '- apply allowed: `false`\n'
  printf '\n## Selected Files\n\n'
  jq -r '.selected_files[] | "- `" + . + "`"' "$IMPLEMENTATION_PACKET"
} > "$PREVIEW_MD"

printf 'IMPLEMENTATION_PREVIEW_READY %s\n' "${PREVIEW_JSON#$ROOT_DIR/}"
printf 'IMPLEMENTATION_PREVIEW_MARKDOWN %s\n' "${PREVIEW_MD#$ROOT_DIR/}"

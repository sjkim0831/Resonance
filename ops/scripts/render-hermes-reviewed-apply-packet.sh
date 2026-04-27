#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMPLEMENTATION_PACKET_PATH="${1:-${IMPLEMENTATION_PACKET_PATH:-}}"
PATCH_CONTENT_PATH="${2:-${PATCH_CONTENT_PATH:-}}"
PATCH_DRY_RUN_PATH="${3:-${PATCH_DRY_RUN_PATH:-}}"
IMPLEMENTATION_PREVIEW_PATH="${4:-${IMPLEMENTATION_PREVIEW_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"

PACKET_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-reviewed-apply-packet.sh"
IMPL_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-packet.sh"
PATCH_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-patch-content.sh"

mkdir -p "$OUT_DIR"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

resolve_latest() {
  local pattern="$1"
  find "$ROOT_DIR/var/agent-task-packets" -maxdepth 1 -type f -name "$pattern" 2>/dev/null | sort | tail -n 1
}

if [ -z "$IMPLEMENTATION_PACKET_PATH" ]; then
  IMPLEMENTATION_PACKET_PATH="$(resolve_latest 'hermes-implementation-packet-*.json')"
fi
if [ -z "$PATCH_CONTENT_PATH" ]; then
  PATCH_CONTENT_PATH="$(find "$ROOT_DIR/var/hermes-smoke-fixtures" -maxdepth 1 -type f -name 'hermes-implementation-patch-content-*.json' 2>/dev/null | sort | tail -n 1)"
fi
if [ -z "$PATCH_DRY_RUN_PATH" ]; then
  PATCH_DRY_RUN_PATH="$(resolve_latest 'hermes-implementation-patch-dry-run-*.json')"
fi
if [ -z "$IMPLEMENTATION_PREVIEW_PATH" ]; then
  IMPLEMENTATION_PREVIEW_PATH="$(resolve_latest 'hermes-implementation-preview-*.json')"
fi

for var_name in IMPLEMENTATION_PACKET_PATH PATCH_CONTENT_PATH PATCH_DRY_RUN_PATH IMPLEMENTATION_PREVIEW_PATH; do
  value="${!var_name:-}"
  [ -n "$value" ] || fail "missing required input: $var_name"
done

case "$IMPLEMENTATION_PACKET_PATH" in
  /*) IMPLEMENTATION_PACKET="$IMPLEMENTATION_PACKET_PATH" ;;
  *) IMPLEMENTATION_PACKET="$ROOT_DIR/$IMPLEMENTATION_PACKET_PATH" ;;
esac
case "$PATCH_CONTENT_PATH" in
  /*) PATCH_CONTENT="$PATCH_CONTENT_PATH" ;;
  *) PATCH_CONTENT="$ROOT_DIR/$PATCH_CONTENT_PATH" ;;
esac
case "$PATCH_DRY_RUN_PATH" in
  /*) PATCH_DRY_RUN="$PATCH_DRY_RUN_PATH" ;;
  *) PATCH_DRY_RUN="$ROOT_DIR/$PATCH_DRY_RUN_PATH" ;;
esac
case "$IMPLEMENTATION_PREVIEW_PATH" in
  /*) IMPLEMENTATION_PREVIEW="$IMPLEMENTATION_PREVIEW_PATH" ;;
  *) IMPLEMENTATION_PREVIEW="$ROOT_DIR/$IMPLEMENTATION_PREVIEW_PATH" ;;
esac

[ -f "$PACKET_VALIDATOR" ] || fail "missing validator: ${PACKET_VALIDATOR#$ROOT_DIR/}"
[ -f "$IMPLEMENTATION_PACKET" ] || fail "missing implementation packet: $IMPLEMENTATION_PACKET_PATH"
[ -f "$PATCH_CONTENT" ] || fail "missing patch content: $PATCH_CONTENT_PATH"
[ -f "$PATCH_DRY_RUN" ] || fail "missing patch dry-run: $PATCH_DRY_RUN_PATH"
[ -f "$IMPLEMENTATION_PREVIEW" ] || fail "missing implementation preview: $IMPLEMENTATION_PREVIEW_PATH"

"$IMPL_VALIDATOR" "$IMPLEMENTATION_PACKET" >/dev/null
"$PATCH_VALIDATOR" "$PATCH_CONTENT" >/dev/null

jq -e '.status == "pass" and .apply_allowed == false and .mutation_allowed == false' "$PATCH_DRY_RUN" >/dev/null \
  || fail "patch dry-run must be pass and non-mutating"
jq -e '.apply_allowed == false and .mutation_allowed == false' "$IMPLEMENTATION_PREVIEW" >/dev/null \
  || fail "implementation preview must be non-mutating"

request_id="$(jq -r '.request_id // empty' "$IMPLEMENTATION_PACKET")"
[ -n "$request_id" ] || fail "implementation packet missing request_id"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
PACKET_JSON="$OUT_DIR/hermes-reviewed-apply-packet-${SAFE_REQUEST}-${STAMP}.json"

jq -n \
  --arg requestId "$request_id" \
  --arg generatedAt "$(date -Is)" \
  --arg sourceImplementation "${IMPLEMENTATION_PACKET#$ROOT_DIR/}" \
  --arg sourcePatchContent "${PATCH_CONTENT#$ROOT_DIR/}" \
  --arg sourcePatchDryRun "${PATCH_DRY_RUN#$ROOT_DIR/}" \
  --arg sourceImplementationPreview "${IMPLEMENTATION_PREVIEW#$ROOT_DIR/}" \
  --argjson implementation "$(jq . "$IMPLEMENTATION_PACKET")" \
  '{
    schemaVersion: "1.0",
    packet_type: "hermes-reviewed-apply-packet",
    request_id: $requestId,
    generated_at: $generatedAt,
    source_implementation_packet: $sourceImplementation,
    source_patch_content: $sourcePatchContent,
    source_patch_dry_run: $sourcePatchDryRun,
    source_implementation_preview: $sourceImplementationPreview,
    objective_id: $implementation.objective_id,
    zone: $implementation.zone,
    review_status: "REVIEWED_APPLY_PENDING",
    mutation_allowed: false,
    apply_allowed: false,
    selected_files: $implementation.selected_files,
    verification_gate: $implementation.verification_gate,
    rollback_note: "Reviewed apply packet only. A future dedicated apply worker must still require explicit enablement before changing files.",
    worker_contract: {
      generic_worker_allowed: false,
      future_apply_worker_required: true,
      must_return: [
        "reviewed_apply_packet",
        "verification_command",
        "rollback_commands",
        "apply_worker_enablement_required"
      ]
    }
  }' > "$PACKET_JSON"

"$PACKET_VALIDATOR" "$PACKET_JSON" >/dev/null

printf 'REVIEWED_APPLY_PACKET_READY %s\n' "${PACKET_JSON#$ROOT_DIR/}"
jq . "$PACKET_JSON"

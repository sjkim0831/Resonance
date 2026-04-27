#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PATCH_PACKET_PATH="${1:-${PATCH_PACKET_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"
REQUEST_ID="${REQUEST_ID:-IMPL-$(date +%Y%m%d-%H%M%S)}"
IMPLEMENTATION_APPROVED="${IMPLEMENTATION_APPROVED:-false}"
IMPLEMENTATION_INTENT="${IMPLEMENTATION_INTENT:-bounded implementation proposal}"

SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-implementation-packet.schema.json"
PATCH_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-patch-packet.sh"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

mkdir -p "$OUT_DIR"

if [ -z "$PATCH_PACKET_PATH" ]; then
  latest_patch="$(find "$ROOT_DIR/var/agent-task-packets" -maxdepth 1 -type f -name 'hermes-patch-packet-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_patch" ] || fail "no source patch packet found"
  PATCH_PACKET_PATH="$latest_patch"
fi

case "$PATCH_PACKET_PATH" in
  /*) PATCH_PACKET="$PATCH_PACKET_PATH" ;;
  *) PATCH_PACKET="$ROOT_DIR/$PATCH_PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$PATCH_VALIDATOR" ] || fail "missing patch validator: ${PATCH_VALIDATOR#$ROOT_DIR/}"
[ -f "$PATCH_PACKET" ] || fail "missing source patch packet: $PATCH_PACKET_PATH"
jq empty "$SCHEMA" "$PATCH_PACKET"
"$PATCH_VALIDATOR" "$PATCH_PACKET" >/dev/null

if [ "$IMPLEMENTATION_APPROVED" = "true" ]; then
  status="READY_FOR_IMPLEMENTATION_WORKER"
  implementation_allowed=true
else
  status="IMPLEMENTATION_APPROVAL_REQUIRED"
  implementation_allowed=false
fi

IMPLEMENTATION_PACKET="$OUT_DIR/hermes-implementation-packet-${REQUEST_ID}.json"

jq -n \
  --arg requestId "$REQUEST_ID" \
  --arg generatedAt "$(date -Is)" \
  --arg sourcePatch "${PATCH_PACKET#$ROOT_DIR/}" \
  --arg implementationIntent "$IMPLEMENTATION_INTENT" \
  --arg status "$status" \
  --argjson implementationAllowed "$implementation_allowed" \
  --argjson patch "$(jq . "$PATCH_PACKET")" \
  '{
    schemaVersion: "1.0",
    packet_type: "hermes-implementation-plan",
    request_id: $requestId,
    generated_at: $generatedAt,
    source_patch_packet: $sourcePatch,
    objective_id: $patch.objective_id,
    zone: $patch.zone,
    status: $status,
    approval_required: true,
    implementation_allowed: $implementationAllowed,
    implementation_intent: $implementationIntent,
    selected_files: $patch.selected_files,
    proposed_changes: ($patch.selected_files | map({
      file: .,
      change_summary: "No concrete patch content is embedded by this renderer.",
      patch_content_included: false,
      requires_dedicated_implementation_worker: true
    })),
    verification_gate: $patch.verification_gate,
    dangerous_operation: {
      requested: false,
      policy: "script_only_for_deploy_backup_rollback_restart_k8s_apply_db_migration"
    },
    rollback_plan: {
      required: true,
      note: "A dedicated implementation worker must list exact changed files and rollback commands before execution."
    },
    worker_contract: {
      max_files: $patch.worker_contract.max_files,
      generic_worker_allowed: false,
      dedicated_implementation_worker_required: true,
      must_not_start_with: $patch.worker_contract.must_not_start_with,
      must_return: [
        "changed_files",
        "verification_command",
        "verification_result",
        "rollback_commands",
        "cluster_or_runtime_impact"
      ]
    }
  }' > "$IMPLEMENTATION_PACKET"

"$ROOT_DIR/ops/scripts/validate-hermes-implementation-packet.sh" "$IMPLEMENTATION_PACKET" >/dev/null

printf 'IMPLEMENTATION_PACKET_READY %s\n' "${IMPLEMENTATION_PACKET#$ROOT_DIR/}"
jq . "$IMPLEMENTATION_PACKET"

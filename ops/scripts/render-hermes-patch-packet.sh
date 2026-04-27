#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TASK_PACKET_PATH="${1:-${TASK_PACKET_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"
PATCH_INTENT="${PATCH_INTENT:-verification-only hardening plan}"
REQUEST_ID="${REQUEST_ID:-PATCH-$(date +%Y%m%d-%H%M%S)}"

SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-patch-packet.schema.json"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

mkdir -p "$OUT_DIR"

if [ -z "$TASK_PACKET_PATH" ]; then
  latest_packet="$(find "$ROOT_DIR/var/agent-task-packets" -maxdepth 1 -type f -name 'hermes-task-packet-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_packet" ] || fail "no source task packet found"
  TASK_PACKET_PATH="$latest_packet"
fi

case "$TASK_PACKET_PATH" in
  /*) TASK_PACKET="$TASK_PACKET_PATH" ;;
  *) TASK_PACKET="$ROOT_DIR/$TASK_PACKET_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$TASK_PACKET" ] || fail "missing source task packet: $TASK_PACKET_PATH"
jq empty "$SCHEMA" "$TASK_PACKET"

task_status="$(jq -r '.status // empty' "$TASK_PACKET")"
[ "$task_status" = "READY_FOR_WORKER" ] || fail "source packet must be READY_FOR_WORKER"

selected_count="$(jq -r '.selected_files | length' "$TASK_PACKET")"
max_files="$(jq -r '.worker_contract.max_files // 6' "$TASK_PACKET")"
[ "$selected_count" -gt 0 ] || fail "source packet selected_files is empty"
[ "$selected_count" -le "$max_files" ] || fail "source packet exceeds max file budget"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "unsafe selected file for patch plan: $file"
      ;;
  esac
  [ -e "$ROOT_DIR/$file" ] || fail "selected file does not exist: $file"
done < <(jq -r '.selected_files[]' "$TASK_PACKET")

PATCH_PACKET="$OUT_DIR/hermes-patch-packet-${REQUEST_ID}.json"

jq -n \
  --arg requestId "$REQUEST_ID" \
  --arg generatedAt "$(date -Is)" \
  --arg patchIntent "$PATCH_INTENT" \
  --arg sourcePacket "${TASK_PACKET#$ROOT_DIR/}" \
  --argjson task "$(jq . "$TASK_PACKET")" \
  '{
    schemaVersion: "1.0",
    packet_type: "hermes-patch-plan",
    request_id: $requestId,
    generated_at: $generatedAt,
    source_task_packet: $sourcePacket,
    objective_id: $task.objective_id,
    zone: $task.zone,
    status: "PATCH_PLAN_READY",
    mutation_allowed: false,
    patch_intent: $patchIntent,
    selected_files: $task.selected_files,
    planned_edits: ($task.selected_files | map({
      file: .,
      action: "inspect_or_plan_only",
      mutation: false,
      reason: "Patch content is intentionally omitted until implementation approval."
    })),
    verification_gate: $task.verification_gate,
    dangerous_operation: {
      requested: false,
      policy: "script_only_for_deploy_backup_rollback_restart_k8s_apply_db_migration"
    },
    rollback_note: "This patch packet is non-mutating. If later converted to an implementation packet, rollback must list exact changed files and verification commands.",
    worker_contract: {
      max_files: $task.worker_contract.max_files,
      implementation_allowed: false,
      must_not_start_with: $task.worker_contract.must_not_start_with,
      must_return: [
        "patch_packet",
        "planned_edits",
        "verification_command",
        "verification_result",
        "approval_needed_before_mutation"
      ]
    }
  }' > "$PATCH_PACKET"

"$ROOT_DIR/ops/scripts/validate-hermes-patch-packet.sh" "$PATCH_PACKET" >/dev/null

printf 'PATCH_PACKET_READY %s\n' "${PATCH_PACKET#$ROOT_DIR/}"
jq . "$PATCH_PACKET"

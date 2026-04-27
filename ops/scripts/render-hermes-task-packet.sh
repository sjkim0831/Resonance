#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"
OBJECTIVE_ID="${OBJECTIVE_ID:-hermes-agent-hardening}"
INTENT="${INTENT:-hermes rag bounded orchestration}"
REQUEST_ID="${REQUEST_ID:-HERMES-$(date +%Y%m%d-%H%M%S)}"
MAX_FILES="${MAX_FILES:-6}"

CONTEXT_PACK="$ROOT_DIR/data/ai-runtime/hermes-rag-context-pack.json"
ROUTE_MAP="$ROOT_DIR/data/ai-runtime/deterministic-route-map.json"

mkdir -p "$OUT_DIR"

fail_needs_route_map() {
  local reason="$1"
  printf 'NEEDS_ROUTE_MAP %s\n' "$reason" >&2
  exit 2
}

require_file() {
  local file="$1"
  [ -f "$file" ] || fail_needs_route_map "missing required file: ${file#$ROOT_DIR/}"
}

require_file "$CONTEXT_PACK"
require_file "$ROUTE_MAP"
jq empty "$CONTEXT_PACK" "$ROUTE_MAP"

objective_json="$(jq -c --arg id "$OBJECTIVE_ID" '.activeObjectives[] | select(.id == $id)' "$CONTEXT_PACK")"
[ -n "$objective_json" ] || fail_needs_route_map "objective not found: $OBJECTIVE_ID"

route_json="$(jq -c --arg intent_lc "$(printf '%s' "$INTENT" | tr '[:upper:]' '[:lower:]')" '
  .intentRoutes[]
  | select(any(.match[]?; . as $keyword | $intent_lc | contains($keyword | ascii_downcase)))
' "$ROUTE_MAP" | head -n 1)"
[ -n "$route_json" ] || fail_needs_route_map "intent route not found: $INTENT"

PACKET="$OUT_DIR/hermes-task-packet-${REQUEST_ID}.json"

jq -n \
  --arg requestId "$REQUEST_ID" \
  --arg intent "$INTENT" \
  --argjson maxFiles "$MAX_FILES" \
  --argjson objective "$objective_json" \
  --argjson route "$route_json" \
  --arg generatedAt "$(date -Is)" '
  def uniq_list: reduce .[] as $item ([]; if index($item) then . else . + [$item] end);
  def file_reason($file):
    if ($objective.readFirst // [] | index($file)) and ($route.readFirst // [] | index($file)) then
      "required by both objective and deterministic route"
    elif ($objective.readFirst // [] | index($file)) then
      "required by objective readFirst"
    elif ($route.readFirst // [] | index($file)) then
      "required by deterministic route readFirst"
    else
      "selected by bounded context"
    end;
  (($objective.readFirst // []) + ($route.readFirst // [])) as $allFiles
  | ($allFiles | uniq_list | .[:$maxFiles]) as $selected
  | {
      schemaVersion: "1.0",
      request_id: $requestId,
      generated_at: $generatedAt,
      intent: $intent,
      objective_id: $objective.id,
      zone: $objective.zone,
      status: "READY_FOR_WORKER",
      selected_files: $selected,
      reason_per_file: ($selected | map({file: ., reason: file_reason(.)})),
      verification_gate: "bash ops/scripts/run-hermes-rag-smoke.sh",
      dangerous_operation: {
        requested: false,
        policy: "script_only_for_deploy_backup_rollback_restart_k8s_apply_db_migration"
      },
      rollback_note: "No runtime mutation is performed by this packet. If a worker changes files, revert only its changed files or rerun the recorded script gate before further rollout.",
      worker_contract: {
        max_files: $maxFiles,
        must_not_start_with: ($route.doNotStartWith // []),
        must_return: [
          "changed_files",
          "verification_command",
          "verification_result",
          "cluster_or_runtime_impact",
          "route_map_or_rag_memory_update_needed"
        ]
      }
    }
' > "$PACKET"

jq -e '
  . as $packet
  | $packet.objective_id and
  $packet.zone and
  ($packet.selected_files | type == "array" and length > 0 and length <= ($packet.worker_contract.max_files)) and
  ($packet.reason_per_file | length == ($packet.selected_files | length)) and
  $packet.verification_gate and
  $packet.dangerous_operation and
  $packet.rollback_note
' "$PACKET" >/dev/null

printf 'PACKET_READY %s\n' "${PACKET#$ROOT_DIR/}"
jq . "$PACKET"

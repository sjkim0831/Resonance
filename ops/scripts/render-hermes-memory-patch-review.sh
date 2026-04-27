#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MEMORY_CANDIDATE_PATH="${1:-${MEMORY_CANDIDATE_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-task-packets}"
REQUEST_ID="${REQUEST_ID:-MEMORY-REVIEW-$(date +%Y%m%d-%H%M%S)}"

SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-memory-patch-review.schema.json"
VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-memory-patch-review.sh"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

mkdir -p "$OUT_DIR"

if [ -z "$MEMORY_CANDIDATE_PATH" ]; then
  latest_candidate="$(find "$ROOT_DIR/var/rag-memory-candidates" -maxdepth 1 -type f -name 'hermes-rag-memory-candidate-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_candidate" ] || fail "no memory candidate provided and no candidate exists under var/rag-memory-candidates"
  MEMORY_CANDIDATE_PATH="$latest_candidate"
fi

case "$MEMORY_CANDIDATE_PATH" in
  /*) MEMORY_CANDIDATE="$MEMORY_CANDIDATE_PATH" ;;
  *) MEMORY_CANDIDATE="$ROOT_DIR/$MEMORY_CANDIDATE_PATH" ;;
esac

[ -f "$SCHEMA" ] || fail "missing schema: ${SCHEMA#$ROOT_DIR/}"
[ -f "$VALIDATOR" ] || fail "missing validator: ${VALIDATOR#$ROOT_DIR/}"
[ -f "$MEMORY_CANDIDATE" ] || fail "missing memory candidate: $MEMORY_CANDIDATE_PATH"
jq empty "$SCHEMA" "$MEMORY_CANDIDATE"

candidate_type="$(jq -r '.candidate_type // empty' "$MEMORY_CANDIDATE")"
verification_result="$(jq -r '.verification_result // empty' "$MEMORY_CANDIDATE")"
apply_to_context_pack="$(jq -r 'if has("apply_to_context_pack") then .apply_to_context_pack else true end' "$MEMORY_CANDIDATE")"
mutation_allowed="$(jq -r 'if has("mutation_allowed") then .mutation_allowed else true end' "$MEMORY_CANDIDATE")"
memory_decision="$(jq -r '.memory_decision // empty' "$MEMORY_CANDIDATE")"

[ "$candidate_type" = "hermes-rag-memory-candidate" ] || fail "not a Hermes RAG memory candidate: $candidate_type"
[ "$verification_result" = "pass" ] || fail "only passing memory candidates can be reviewed"
[ "$apply_to_context_pack" = "false" ] || fail "candidate unexpectedly allows context-pack apply"
[ "$mutation_allowed" = "false" ] || fail "candidate unexpectedly allows mutation"

case "$memory_decision" in
  archive_as_verified_no_update) review_status="NO_UPDATE_RECOMMENDED" ;;
  review_required) review_status="REVIEW_REQUIRED" ;;
  *) fail "unknown memory decision: $memory_decision" ;;
esac

REVIEW_PACKET="$OUT_DIR/hermes-memory-patch-review-${REQUEST_ID}.json"

jq -n \
  --arg requestId "$REQUEST_ID" \
  --arg generatedAt "$(date -Is)" \
  --arg sourceCandidate "${MEMORY_CANDIDATE#$ROOT_DIR/}" \
  --arg reviewStatus "$review_status" \
  --argjson candidate "$(jq . "$MEMORY_CANDIDATE")" \
  '{
    schemaVersion: "1.0",
    packet_type: "hermes-memory-patch-review",
    request_id: $requestId,
    generated_at: $generatedAt,
    source_memory_candidate: $sourceCandidate,
    objective_id: $candidate.objective_id,
    zone: $candidate.zone,
    status: "MEMORY_PATCH_REVIEW_READY",
    review_status: $reviewStatus,
    mutation_allowed: false,
    apply_allowed: false,
    target_files: [
      "data/ai-runtime/hermes-rag-context-pack.json",
      "data/ai-runtime/deterministic-route-map.json"
    ],
    review_findings: [
      {
        file: "data/ai-runtime/hermes-rag-context-pack.json",
        action: "review_only",
        patch_content_included: false,
        reason: "Memory candidates cannot directly update the Hermes opening book."
      },
      {
        file: "data/ai-runtime/deterministic-route-map.json",
        action: "review_only",
        patch_content_included: false,
        reason: "Route-map changes require a separate reviewed implementation packet."
      }
    ],
    verification_gate: $candidate.verification_command,
    dangerous_operation: {
      requested: false,
      policy: "script_only_for_deploy_backup_rollback_restart_k8s_apply_db_migration"
    },
    rollback_note: "This review packet is non-mutating. If a later reviewed implementation changes RAG files, revert only those files and rerun the Hermes RAG smoke gate.",
    worker_contract: {
      max_files: 2,
      generic_worker_allowed: false,
      reviewed_patch_required_before_context_update: true,
      dedicated_implementation_worker_required: true,
      must_return: [
        "review_status",
        "target_files",
        "verification_command",
        "approval_needed_before_rag_update"
      ]
    }
  }' > "$REVIEW_PACKET"

"$VALIDATOR" "$REVIEW_PACKET" >/dev/null

printf 'MEMORY_PATCH_REVIEW_READY %s\n' "${REVIEW_PACKET#$ROOT_DIR/}"
jq . "$REVIEW_PACKET"

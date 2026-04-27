#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CLOSEOUT_PATH="${1:-${CLOSEOUT_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/rag-memory-candidates}"

mkdir -p "$OUT_DIR"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

if [ -z "$CLOSEOUT_PATH" ]; then
  latest_closeout="$(find "$ROOT_DIR/var/agent-closeouts" -maxdepth 1 -type f -name 'hermes-worker-closeout-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_closeout" ] || fail "no closeout provided and no closeout exists under var/agent-closeouts"
  CLOSEOUT_PATH="$latest_closeout"
fi

case "$CLOSEOUT_PATH" in
  /*) CLOSEOUT="$CLOSEOUT_PATH" ;;
  *) CLOSEOUT="$ROOT_DIR/$CLOSEOUT_PATH" ;;
esac

[ -f "$CLOSEOUT" ] || fail "closeout not found: $CLOSEOUT_PATH"
jq empty "$CLOSEOUT" || fail "closeout json validation failed"

request_id="$(jq -r '.request_id // empty' "$CLOSEOUT")"
objective_id="$(jq -r '.objective_id // empty' "$CLOSEOUT")"
zone="$(jq -r '.zone // empty' "$CLOSEOUT")"
verification_result="$(jq -r '.verification_result // empty' "$CLOSEOUT")"
verification_command="$(jq -r '.verification_command // empty' "$CLOSEOUT")"
packet_path="$(jq -r '.packet // empty' "$CLOSEOUT")"
memory_update_needed="$(jq -r '.route_map_or_rag_memory_update_needed // false' "$CLOSEOUT")"
changed_count="$(jq -r '.changed_files | length' "$CLOSEOUT")"
selected_count="$(jq -r '.selected_files | length' "$CLOSEOUT")"

[ -n "$request_id" ] || fail "closeout missing request_id"
[ -n "$objective_id" ] || fail "closeout missing objective_id"
[ -n "$zone" ] || fail "closeout missing zone"
[ "$verification_result" = "pass" ] || fail "only passing closeouts can become RAG memory candidates"
[ "$verification_command" = "bash ops/scripts/run-hermes-rag-smoke.sh" ] || fail "verification command is not memory-safe: $verification_command"
[ -n "$packet_path" ] || fail "closeout missing packet"
[ "$selected_count" -gt 0 ] || fail "closeout has no selected files"

case "$packet_path" in
  var/agent-task-packets/hermes-task-packet-*.json) ;;
  *) fail "closeout packet path is not an expected Hermes task packet: $packet_path" ;;
esac

PACKET="$ROOT_DIR/$packet_path"
[ -f "$PACKET" ] || fail "source packet not found: $packet_path"
jq empty "$PACKET" || fail "source packet json validation failed"

packet_status="$(jq -r '.status // empty' "$PACKET")"
dangerous_requested="$(jq -r '.dangerous_operation.requested // false' "$PACKET")"
packet_type="$(jq -r '.packet_type // "hermes-task-packet"' "$PACKET")"

[ "$packet_status" = "READY_FOR_WORKER" ] || fail "source packet status is not READY_FOR_WORKER: $packet_status"
[ "$dangerous_requested" = "false" ] || fail "dangerous-operation closeouts cannot become RAG memory candidates"
[ "$packet_type" = "hermes-task-packet" ] || fail "only base Hermes task packets can become memory candidates: $packet_type"

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "selected file is outside memory-safe bounds: $file"
      ;;
  esac
  [ -e "$ROOT_DIR/$file" ] || fail "selected file does not exist: $file"
done < <(jq -r '.selected_files[]' "$CLOSEOUT")

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
CANDIDATE_JSON="$OUT_DIR/hermes-rag-memory-candidate-${SAFE_REQUEST}-${STAMP}.json"
CANDIDATE_MD="$OUT_DIR/hermes-rag-memory-candidate-${SAFE_REQUEST}-${STAMP}.md"

if [ "$memory_update_needed" = "true" ]; then
  memory_decision="review_required"
else
  memory_decision="archive_as_verified_no_update"
fi

jq -n \
  --arg requestId "$request_id" \
  --arg objectiveId "$objective_id" \
  --arg zone "$zone" \
  --arg generatedAt "$(date -Is)" \
  --arg closeout "${CLOSEOUT#$ROOT_DIR/}" \
  --arg packet "$packet_path" \
  --arg verificationCommand "$verification_command" \
  --arg verificationResult "$verification_result" \
  --arg memoryDecision "$memory_decision" \
  --argjson changedFiles "$(jq '.changed_files' "$CLOSEOUT")" \
  --argjson selectedFiles "$(jq '.selected_files' "$CLOSEOUT")" \
  --argjson memoryUpdateNeeded "$memory_update_needed" \
  '{
    schemaVersion: "1.0",
    candidate_type: "hermes-rag-memory-candidate",
    request_id: $requestId,
    objective_id: $objectiveId,
    zone: $zone,
    generated_at: $generatedAt,
    closeout: $closeout,
    source_packet: $packet,
    verification_command: $verificationCommand,
    verification_result: $verificationResult,
    changed_files: $changedFiles,
    selected_files: $selectedFiles,
    route_map_or_rag_memory_update_needed: $memoryUpdateNeeded,
    memory_decision: $memoryDecision,
    mutation_allowed: false,
    apply_to_context_pack: false,
    reviewer_note: "This candidate records a verified closeout only. A separate reviewed patch must update the RAG context pack or route map."
  }' > "$CANDIDATE_JSON"

{
  printf '# Hermes RAG Memory Candidate\n\n'
  printf -- '- request: `%s`\n' "$request_id"
  printf -- '- objective: `%s`\n' "$objective_id"
  printf -- '- zone: `%s`\n' "$zone"
  printf -- '- closeout: `%s`\n' "${CLOSEOUT#$ROOT_DIR/}"
  printf -- '- packet: `%s`\n' "$packet_path"
  printf -- '- verification command: `%s`\n' "$verification_command"
  printf -- '- verification result: `%s`\n' "$verification_result"
  printf -- '- changed file count: `%s`\n' "$changed_count"
  printf -- '- memory decision: `%s`\n' "$memory_decision"
  printf '\n## Selected Files\n\n'
  jq -r '.selected_files[] | "- `" + . + "`"' "$CLOSEOUT"
  printf '\n## Guardrail\n\n'
  printf 'This is a non-mutating memory candidate. Do not edit context packs or route maps from this artifact without a reviewed patch packet.\n'
} > "$CANDIDATE_MD"

printf 'MEMORY_CANDIDATE_READY %s\n' "${CANDIDATE_JSON#$ROOT_DIR/}"
printf 'MEMORY_CANDIDATE_MARKDOWN %s\n' "${CANDIDATE_MD#$ROOT_DIR/}"

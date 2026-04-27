#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PACKET_PATH="${1:-${PACKET_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-closeouts}"
ALLOW_MODEL_GATE="${ALLOW_MODEL_GATE:-false}"

mkdir -p "$OUT_DIR"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

if [ -z "$PACKET_PATH" ]; then
  latest_packet="$(find "$ROOT_DIR/var/agent-task-packets" -maxdepth 1 -type f -name 'hermes-task-packet-*.json' 2>/dev/null | sort | tail -n 1)"
  [ -n "$latest_packet" ] || fail "no packet provided and no packet exists under var/agent-task-packets"
  PACKET_PATH="$latest_packet"
fi

case "$PACKET_PATH" in
  /*) PACKET="$PACKET_PATH" ;;
  *) PACKET="$ROOT_DIR/$PACKET_PATH" ;;
esac

[ -f "$PACKET" ] || fail "packet not found: $PACKET_PATH"
jq empty "$PACKET" || fail "packet json validation failed"

request_id="$(jq -r '.request_id // empty' "$PACKET")"
objective_id="$(jq -r '.objective_id // empty' "$PACKET")"
zone="$(jq -r '.zone // empty' "$PACKET")"
status="$(jq -r '.status // empty' "$PACKET")"
packet_type="$(jq -r '.packet_type // "hermes-task-packet"' "$PACKET")"
verification_gate="$(jq -r '.verification_gate // empty' "$PACKET")"
max_files="$(jq -r '.worker_contract.max_files // empty' "$PACKET")"
selected_count="$(jq -r '.selected_files | length' "$PACKET")"
dangerous_requested="$(jq -r '.dangerous_operation.requested // false' "$PACKET")"

[ -n "$request_id" ] || fail "packet missing request_id"
[ -n "$objective_id" ] || fail "packet missing objective_id"
[ -n "$zone" ] || fail "packet missing zone"
if [ "$packet_type" = "hermes-implementation-plan" ]; then
  fail "implementation packets require a dedicated implementation worker, not the generic verification loop"
fi
[ "$status" = "READY_FOR_WORKER" ] || fail "packet status is not READY_FOR_WORKER: $status"
[ -n "$verification_gate" ] || fail "packet missing verification_gate"
[ -n "$max_files" ] || fail "packet missing worker_contract.max_files"
[ "$selected_count" -gt 0 ] || fail "packet has no selected files"
[ "$selected_count" -le "$max_files" ] || fail "selected_files exceeds max_files: $selected_count > $max_files"

if [ "$dangerous_requested" = "true" ]; then
  fail "dangerous operation packets require a dedicated deterministic script, not the generic worker loop"
fi

while IFS= read -r file; do
  [ -n "$file" ] || continue
  case "$file" in
    /*|*..*|var/*|*/node_modules/*|*/target/*)
      fail "selected file is outside worker-safe bounds: $file"
      ;;
  esac
  [ -e "$ROOT_DIR/$file" ] || fail "selected file does not exist: $file"
done < <(jq -r '.selected_files[]' "$PACKET")

case "$verification_gate" in
  "bash ops/scripts/run-hermes-rag-smoke.sh")
    verify_command="$verification_gate"
    if [ "$ALLOW_MODEL_GATE" = "true" ]; then
      verify_command="RUN_MODEL_GATE=true MODEL=${MODEL:-gemma3:4b} $verification_gate"
    fi
    ;;
  *)
    fail "verification gate is not allowlisted: $verification_gate"
    ;;
esac

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
CLOSEOUT_JSON="$OUT_DIR/hermes-worker-closeout-${SAFE_REQUEST}-${STAMP}.json"
CLOSEOUT_MD="$OUT_DIR/hermes-worker-closeout-${SAFE_REQUEST}-${STAMP}.md"
VERIFY_LOG="$OUT_DIR/hermes-worker-verify-${SAFE_REQUEST}-${STAMP}.log"

set +e
(
  cd "$ROOT_DIR"
  eval "$verify_command"
) >"$VERIFY_LOG" 2>&1
verify_code="$?"
set -e

if [ "$verify_code" = "0" ]; then
  verification_result="pass"
else
  verification_result="fail"
fi

jq -n \
  --arg requestId "$request_id" \
  --arg objectiveId "$objective_id" \
  --arg zone "$zone" \
  --arg packet "${PACKET#$ROOT_DIR/}" \
  --arg generatedAt "$(date -Is)" \
  --arg verificationCommand "$verify_command" \
  --arg verificationResult "$verification_result" \
  --arg verifyLog "${VERIFY_LOG#$ROOT_DIR/}" \
  --arg closeoutMd "${CLOSEOUT_MD#$ROOT_DIR/}" \
  --argjson selectedFiles "$(jq '.selected_files' "$PACKET")" \
  '{
    schemaVersion: "1.0",
    request_id: $requestId,
    objective_id: $objectiveId,
    zone: $zone,
    packet: $packet,
    generated_at: $generatedAt,
    changed_files: [],
    selected_files: $selectedFiles,
    verification_command: $verificationCommand,
    verification_result: $verificationResult,
    verification_log: $verifyLog,
    cluster_or_runtime_impact: "No file or runtime mutation performed by generic worker loop; verification gate only.",
    route_map_or_rag_memory_update_needed: false,
    closeout_markdown: $closeoutMd
  }' > "$CLOSEOUT_JSON"

{
  printf '# Hermes Worker Closeout\n\n'
  printf -- '- request: `%s`\n' "$request_id"
  printf -- '- objective: `%s`\n' "$objective_id"
  printf -- '- zone: `%s`\n' "$zone"
  printf -- '- packet: `%s`\n' "${PACKET#$ROOT_DIR/}"
  printf -- '- verification command: `%s`\n' "$verify_command"
  printf -- '- verification result: `%s`\n' "$verification_result"
  printf -- '- verification log: `%s`\n' "${VERIFY_LOG#$ROOT_DIR/}"
  printf -- '- changed files: none\n'
  printf -- '- runtime impact: no mutation, verification only\n'
  printf '\n## Selected Files\n\n'
  jq -r '.selected_files[] | "- `" + . + "`"' "$PACKET"
  printf '\n## Tail\n\n```text\n'
  tail -n 40 "$VERIFY_LOG" || true
  printf '\n```\n'
} > "$CLOSEOUT_MD"

if [ "$verify_code" = "0" ]; then
  printf 'WORKER_CLOSEOUT_READY %s\n' "${CLOSEOUT_JSON#$ROOT_DIR/}"
  printf 'WORKER_CLOSEOUT_MARKDOWN %s\n' "${CLOSEOUT_MD#$ROOT_DIR/}"
else
  printf 'WORKER_CLOSEOUT_FAILED %s\n' "${CLOSEOUT_JSON#$ROOT_DIR/}" >&2
  printf 'WORKER_CLOSEOUT_MARKDOWN %s\n' "${CLOSEOUT_MD#$ROOT_DIR/}" >&2
  exit "$verify_code"
fi

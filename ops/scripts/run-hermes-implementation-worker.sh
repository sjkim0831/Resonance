#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
IMPLEMENTATION_PACKET_PATH="${1:-${IMPLEMENTATION_PACKET_PATH:-}}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/agent-closeouts}"
ALLOW_EMPTY_PATCH="${ALLOW_EMPTY_PATCH:-true}"

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
status="$(jq -r '.status // empty' "$IMPLEMENTATION_PACKET")"
implementation_allowed="$(jq -r '.implementation_allowed // false' "$IMPLEMENTATION_PACKET")"
generic_worker_allowed="$(jq -r 'if .worker_contract | has("generic_worker_allowed") then .worker_contract.generic_worker_allowed else true end' "$IMPLEMENTATION_PACKET")"
dedicated_required="$(jq -r 'if .worker_contract | has("dedicated_implementation_worker_required") then .worker_contract.dedicated_implementation_worker_required else false end' "$IMPLEMENTATION_PACKET")"
verification_gate="$(jq -r '.verification_gate // empty' "$IMPLEMENTATION_PACKET")"
dangerous_requested="$(jq -r '.dangerous_operation.requested // false' "$IMPLEMENTATION_PACKET")"
patch_content_count="$(jq '[.proposed_changes[] | select(.patch_content_included == true)] | length' "$IMPLEMENTATION_PACKET")"

[ -n "$request_id" ] || fail "implementation packet missing request_id"
[ "$status" = "READY_FOR_IMPLEMENTATION_WORKER" ] || fail "implementation packet is not approved for worker: $status"
[ "$implementation_allowed" = "true" ] || fail "implementation packet does not allow implementation"
[ "$generic_worker_allowed" = "false" ] || fail "implementation packet allows generic worker unexpectedly"
[ "$dedicated_required" = "true" ] || fail "implementation packet does not require dedicated worker"
[ "$dangerous_requested" = "false" ] || fail "dangerous operation implementation packets require a dedicated deterministic script"
[ "$verification_gate" = "bash ops/scripts/run-hermes-rag-smoke.sh" ] || fail "verification gate is not allowlisted: $verification_gate"

if [ "$patch_content_count" -gt 0 ]; then
  fail "patch content execution is not implemented yet; use reviewed apply tooling before enabling this worker"
fi

if [ "$ALLOW_EMPTY_PATCH" != "true" ]; then
  fail "packet has no patch content and ALLOW_EMPTY_PATCH is not true"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_REQUEST="$(printf '%s' "$request_id" | tr -c 'A-Za-z0-9_.-' '_')"
CLOSEOUT_JSON="$OUT_DIR/hermes-implementation-closeout-${SAFE_REQUEST}-${STAMP}.json"
CLOSEOUT_MD="$OUT_DIR/hermes-implementation-closeout-${SAFE_REQUEST}-${STAMP}.md"
VERIFY_LOG="$OUT_DIR/hermes-implementation-verify-${SAFE_REQUEST}-${STAMP}.log"

set +e
(
  cd "$ROOT_DIR"
  SKIP_IMPLEMENTATION_WORKER_SMOKE=true bash ops/scripts/run-hermes-rag-smoke.sh
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
  --arg packet "${IMPLEMENTATION_PACKET#$ROOT_DIR/}" \
  --arg generatedAt "$(date -Is)" \
  --arg verificationCommand "bash ops/scripts/run-hermes-rag-smoke.sh" \
  --arg verificationResult "$verification_result" \
  --arg verifyLog "${VERIFY_LOG#$ROOT_DIR/}" \
  --arg closeoutMd "${CLOSEOUT_MD#$ROOT_DIR/}" \
  --argjson selectedFiles "$(jq '.selected_files' "$IMPLEMENTATION_PACKET")" \
  '{
    schemaVersion: "1.0",
    closeout_type: "hermes-implementation-worker-closeout",
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
    rollback_commands: [],
    cluster_or_runtime_impact: "No file or runtime mutation performed; approved implementation packet contained no patch content.",
    route_map_or_rag_memory_update_needed: false,
    closeout_markdown: $closeoutMd
  }' > "$CLOSEOUT_JSON"

{
  printf '# Hermes Implementation Worker Closeout\n\n'
  printf -- '- request: `%s`\n' "$request_id"
  printf -- '- objective: `%s`\n' "$objective_id"
  printf -- '- zone: `%s`\n' "$zone"
  printf -- '- packet: `%s`\n' "${IMPLEMENTATION_PACKET#$ROOT_DIR/}"
  printf -- '- verification command: `bash ops/scripts/run-hermes-rag-smoke.sh`\n'
  printf -- '- verification result: `%s`\n' "$verification_result"
  printf -- '- changed files: none\n'
  printf -- '- runtime impact: no mutation, empty implementation envelope only\n'
  printf '\n## Selected Files\n\n'
  jq -r '.selected_files[] | "- `" + . + "`"' "$IMPLEMENTATION_PACKET"
  printf '\n## Tail\n\n```text\n'
  tail -n 40 "$VERIFY_LOG" || true
  printf '\n```\n'
} > "$CLOSEOUT_MD"

if [ "$verify_code" = "0" ]; then
  printf 'IMPLEMENTATION_WORKER_CLOSEOUT_READY %s\n' "${CLOSEOUT_JSON#$ROOT_DIR/}"
  printf 'IMPLEMENTATION_WORKER_CLOSEOUT_MARKDOWN %s\n' "${CLOSEOUT_MD#$ROOT_DIR/}"
else
  printf 'IMPLEMENTATION_WORKER_CLOSEOUT_FAILED %s\n' "${CLOSEOUT_JSON#$ROOT_DIR/}" >&2
  printf 'IMPLEMENTATION_WORKER_CLOSEOUT_MARKDOWN %s\n' "${CLOSEOUT_MD#$ROOT_DIR/}" >&2
  exit "$verify_code"
fi

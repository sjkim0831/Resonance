#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY="$ROOT/data/ai-runtime/hermes-project-work-policy.json"
KIND="" MODE="" PROCESS="" ACCEPTANCE="" OBJECTIVE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind) KIND="${2:-}"; shift 2 ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --process) PROCESS="${2:-}"; shift 2 ;;
    --acceptance) ACCEPTANCE="${2:-}"; shift 2 ;;
    --) shift; OBJECTIVE="$*"; break ;;
    *) OBJECTIVE="${OBJECTIVE:+$OBJECTIVE }$1"; shift ;;
  esac
done
[[ -n "$KIND" && -n "$MODE" && -n "$OBJECTIVE" ]] || {
  echo 'usage: run-hermes-project-work.sh --kind KIND --mode MODE [--process CODE] [--acceptance TEXT] -- OBJECTIVE' >&2; exit 2;
}
bash "$ROOT/ops/scripts/verify-hermes-project-work-policy.sh"
jq -e --arg v "$KIND" '.taskKinds|index($v)' "$POLICY" >/dev/null || { echo "FAIL unknown task kind: $KIND" >&2; exit 2; }
jq -e --arg v "$MODE" '.allowedModes|index($v)' "$POLICY" >/dev/null || { echo "FAIL unknown mode: $MODE" >&2; exit 2; }
TASK_ID="PW-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
LOG_REL="$(jq -r '.auditLog' "$POLICY")"; LOG="$ROOT/$LOG_REL"; mkdir -p "$(dirname "$LOG")"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
jq -cn --arg at "$started" --arg id "$TASK_ID" --arg kind "$KIND" --arg mode "$MODE" --arg process "$PROCESS" --arg objective "$OBJECTIVE" \
  '{at:$at,event:"STARTED",taskId:$id,taskKind:$kind,mode:$mode,processCode:$process,objective:$objective}' >> "$LOG"
prompt="Project work contract. Task ID: $TASK_ID. Kind: $KIND. Mode: $MODE. Process: ${PROCESS:-UNSCOPED}. Objective: $OBJECTIVE. Acceptance criteria: ${ACCEPTANCE:-derive explicit measurable criteria}. Use registered common theme, section, component and CSS assets before adding assets. Preserve actor/process/test/task traceability. Return: affected contracts, implementation plan or bounded patch guidance appropriate to the mode, tests, risks, and deterministic promotion gates. Never deploy, migrate production DB, expose secrets, or bypass verification."
set +e
bash "$ROOT/ops/scripts/run-hermes-nvidia-task.sh" "$prompt"
rc=$?
set -e
ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status="COMPLETED"; [[ $rc -eq 0 ]] || status="FAILED"
jq -cn --arg at "$ended" --arg id "$TASK_ID" --arg status "$status" --argjson exitCode "$rc" \
  '{at:$at,event:$status,taskId:$id,exitCode:$exitCode}' >> "$LOG"
echo "[project-work] task_id=$TASK_ID status=$status audit=$LOG_REL" >&2
exit "$rc"

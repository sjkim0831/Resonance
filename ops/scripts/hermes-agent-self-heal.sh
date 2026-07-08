# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] hermes-agent-self-heal.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
OUT_DIR="${HERMES_AGENT_SELF_HEAL_DIR:-$ROOT_DIR/var/ai-runtime/hermes-agent-self-heal}"
MODEL_ASK="${HERMES_AGENT_REPAIR_MODEL_ASK:-/usr/local/bin/resonance-model-ask}"
RELEASE_MANAGER="${HERMES_AGENT_RELEASE_MANAGER:-$ROOT_DIR/ops/scripts/hermes-agent-release-manager.sh}"
APPLY_PATCH="${HERMES_AGENT_SELF_HEAL_APPLY_PATCH:-1}"
AUTO_PROMOTE="${HERMES_AGENT_SELF_HEAL_AUTO_PROMOTE:-1}"
MAX_TAIL_BYTES="${HERMES_AGENT_SELF_HEAL_TAIL_BYTES:-7000}"

TASK_ID="${1:-}"
EXIT_CODE="${2:-}"
STDOUT_REF="${3:-}"
STDERR_REF="${4:-}"
shift 4 || true

mkdir -p "$OUT_DIR/sql"

if [ -z "$TASK_ID" ] || [ -z "$EXIT_CODE" ]; then
  echo "usage: $0 <task-id> <exit-code> <stdout-ref> <stderr-ref> [hermes command args...]" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_ID="selfheal-$STAMP-$$"
RUN_DIR="$OUT_DIR/$RUN_ID"
mkdir -p "$RUN_DIR"

sql_lit() {
  python3 - "$1" <<'PY'
import sys
text = sys.argv[1]
text = text.replace("\r", " ").replace("\n", " ").strip()
print("'" + text[:3900].replace("'", "''") + "'")
PY
}

db_exec() {
  local sql="$1"
  local sql_path="$RUN_DIR/sql-$(date +%s%N).sql"
  printf '%s\nCOMMIT;\n' "$sql" > "$sql_path"
  kubectl -n "$NAMESPACE" cp "$sql_path" "$CUBRID_POD:/tmp/$(basename "$sql_path")" >/dev/null 2>&1 || return 0
  kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' '$DB_NAME' -i '/tmp/$(basename "$sql_path")'" >/dev/null 2>&1 || true
}

tail_file() {
  local file="$1"
  if [ -n "$file" ] && [ -f "$file" ]; then
    tail -c "$MAX_TAIL_BYTES" "$file" 2>/dev/null || true
  fi
}

COMMAND_LINE="$(printf 'hermes'; for arg in "$@"; do printf ' %q' "$arg"; done)"
STDOUT_TAIL="$(tail_file "$STDOUT_REF")"
STDERR_TAIL="$(tail_file "$STDERR_REF")"

RESUME_ID="$(
  python3 - "$STDOUT_TAIL" "$STDERR_TAIL" "$@" <<'PY'
import re
import sys
text = "\n".join(sys.argv[1:])
patterns = [
    r"hermes\s+--resume\s+([0-9A-Za-z_.:-]+)",
    r"--resume\s+([0-9A-Za-z_.:-]+)",
    r"resume\s+([0-9]{8}_[0-9]{6}_[0-9A-Za-z]+)",
]
for pattern in patterns:
    match = re.search(pattern, text)
    if match:
        print(match.group(1))
        raise SystemExit(0)
PY
)"

FAILURE_JSON="$RUN_DIR/failure.json"
python3 - "$FAILURE_JSON" "$TASK_ID" "$EXIT_CODE" "$STDOUT_REF" "$STDERR_REF" "$COMMAND_LINE" "$RESUME_ID" "$STDOUT_TAIL" "$STDERR_TAIL" <<'PY'
import json
import pathlib
import sys
path, task_id, exit_code, stdout_ref, stderr_ref, command_line, resume_id, stdout_tail, stderr_tail = sys.argv[1:10]
payload = {
    "taskId": task_id,
    "exitCode": exit_code,
    "stdoutRef": stdout_ref,
    "stderrRef": stderr_ref,
    "commandLine": command_line,
    "resumeId": resume_id,
    "stdoutTail": stdout_tail[-7000:],
    "stderrTail": stderr_tail[-7000:],
}
pathlib.Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY

db_exec "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ($(sql_lit "$RUN_ID-failure"), $(sql_lit "$TASK_ID"), 'HERMES_AGENT_FAILURE', $(sql_lit "$FAILURE_JSON"), $(sql_lit "Hermes agent failed with exit_code=$EXIT_CODE. Self-heal pipeline started."), $(sql_lit "$(cat "$FAILURE_JSON")"), 'hermes-agent-self-heal');"

REPAIR_PROMPT="$RUN_DIR/repair-prompt.json"
python3 - "$REPAIR_PROMPT" "$FAILURE_JSON" "$("$RELEASE_MANAGER" status 2>/dev/null || true)" <<'PY'
import json
import pathlib
import sys
out, failure_path, release_status = sys.argv[1:4]
failure = json.loads(pathlib.Path(failure_path).read_text(encoding="utf-8"))
payload = {
    "repairGoal": "Diagnose Hermes agent failure and produce a safe blue/green repair plan. Active runtime must not be edited directly.",
    "failure": failure,
    "releaseStatus": release_status,
    "rules": [
        "Prefer deterministic wrapper/config/script fixes over editing Hermes internals.",
        "If no complete safe patch is evident, return patchUnifiedDiff as empty and applyPatch false.",
        "Always provide smokeTests and a resumeCommand using the original resumeId when available.",
        "Do not claim tests passed; scripts will run tests after your plan.",
    ],
}
pathlib.Path(out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY

REPAIR_RAW="$RUN_DIR/repair-raw.txt"
timeout "${HERMES_AGENT_REPAIR_TIMEOUT_SECONDS:-240}s" env RESONANCE_MODEL_ASK_ROLE=main RESONANCE_MODEL_ASK_MAX_TOKENS="${HERMES_AGENT_REPAIR_MAX_TOKENS:-2400}" \
  "$MODEL_ASK" agent-repair <"$REPAIR_PROMPT" >"$REPAIR_RAW" 2>/dev/null || true

REPAIR_JSON="$RUN_DIR/repair-plan.json"
python3 - "$REPAIR_RAW" "$REPAIR_JSON" "$RESUME_ID" <<'PY'
import json
import pathlib
import re
import sys
raw_path, out_path, resume_id = sys.argv[1:4]
raw = pathlib.Path(raw_path).read_text(encoding="utf-8", errors="ignore")
match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.S)
candidate = match.group(1) if match else raw
start = candidate.find("{")
end = candidate.rfind("}")
plan = {}
if start >= 0 and end >= start:
    try:
        plan = json.loads(candidate[start:end + 1])
    except Exception:
        plan = {}
plan.setdefault("severity", "UNKNOWN")
plan.setdefault("rootCause", "Qwen40 did not return parseable JSON; inspect repair-raw.txt.")
plan.setdefault("repairSummary", "")
plan.setdefault("patchUnifiedDiff", "")
plan.setdefault("applyPatch", False)
plan.setdefault("smokeTests", ["hermes --version", "hermes --help"])
plan.setdefault("promoteRecommended", False)
if resume_id and not plan.get("resumeCommand"):
    plan["resumeCommand"] = f"hermes --resume {resume_id}"
plan.setdefault("operatorMessage", "")
plan.setdefault("riskNotes", [])
pathlib.Path(out_path).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
PY

NEXT_OUTPUT="$RUN_DIR/prepare-next.out"
"$RELEASE_MANAGER" init >"$RUN_DIR/release-init.out"
"$RELEASE_MANAGER" prepare-next "$RUN_ID" >"$NEXT_OUTPUT"
NEXT_DIR="$(sed -n 's/^next=//p' "$NEXT_OUTPUT" | tail -n 1)"

PATCH_STATUS="SKIPPED"
PATCH_FILE="$RUN_DIR/repair.patch"
python3 - "$REPAIR_JSON" "$PATCH_FILE" <<'PY'
import json
import pathlib
import sys
plan = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
patch = str(plan.get("patchUnifiedDiff") or "").strip()
pathlib.Path(sys.argv[2]).write_text(patch + ("\n" if patch else ""), encoding="utf-8")
PY

if [ "$APPLY_PATCH" = "1" ] && [ -s "$PATCH_FILE" ] && python3 - "$REPAIR_JSON" <<'PY'
import json, pathlib, sys
raise SystemExit(0 if json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")).get("applyPatch") else 1)
PY
then
  if command -v git >/dev/null 2>&1 && git -C "$NEXT_DIR" apply --check "$PATCH_FILE" >/dev/null 2>&1; then
    git -C "$NEXT_DIR" apply "$PATCH_FILE"
    PATCH_STATUS="APPLIED_GIT"
  elif patch -d "$NEXT_DIR" -p1 --dry-run <"$PATCH_FILE" >/dev/null 2>&1; then
    patch -d "$NEXT_DIR" -p1 <"$PATCH_FILE" >/dev/null
    PATCH_STATUS="APPLIED_PATCH"
  else
    PATCH_STATUS="FAILED_CHECK"
  fi
fi

SMOKE_STATUS="FAILED"
SMOKE_OUTPUT="$RUN_DIR/smoke.out"
if "$RELEASE_MANAGER" smoke "$NEXT_DIR" >"$SMOKE_OUTPUT" 2>&1; then
  SMOKE_STATUS="PASSED"
fi

PROMOTE_STATUS="NOT_REQUESTED"
if [ "$SMOKE_STATUS" = "PASSED" ] && [ "$AUTO_PROMOTE" = "1" ] && python3 - "$REPAIR_JSON" <<'PY'
import json, pathlib, sys
raise SystemExit(0 if json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")).get("promoteRecommended") else 1)
PY
then
  if "$RELEASE_MANAGER" promote "$NEXT_DIR" >"$RUN_DIR/promote.out" 2>&1; then
    PROMOTE_STATUS="PROMOTED"
  else
    PROMOTE_STATUS="PROMOTE_FAILED"
  fi
fi

HANDOFF="$RUN_DIR/handoff.md"
python3 - "$HANDOFF" "$REPAIR_JSON" "$RUN_ID" "$TASK_ID" "$EXIT_CODE" "$NEXT_DIR" "$PATCH_STATUS" "$SMOKE_STATUS" "$PROMOTE_STATUS" "$RESUME_ID" "$STDOUT_REF" "$STDERR_REF" <<'PY'
import json
import pathlib
import sys
handoff, plan_path, run_id, task_id, exit_code, next_dir, patch_status, smoke_status, promote_status, resume_id, stdout_ref, stderr_ref = sys.argv[1:13]
plan = json.loads(pathlib.Path(plan_path).read_text(encoding="utf-8"))
resume_command = plan.get("resumeCommand") or (f"hermes --resume {resume_id}" if resume_id else "")
lines = [
    f"# Hermes Agent Self-Heal Handoff",
    "",
    f"- runId: `{run_id}`",
    f"- taskId: `{task_id}`",
    f"- exitCode: `{exit_code}`",
    f"- nextRelease: `{next_dir}`",
    f"- patchStatus: `{patch_status}`",
    f"- smokeStatus: `{smoke_status}`",
    f"- promoteStatus: `{promote_status}`",
    f"- stdout: `{stdout_ref}`",
    f"- stderr: `{stderr_ref}`",
    "",
    "## Qwen40 Diagnosis",
    "",
    str(plan.get("rootCause") or ""),
    "",
    "## Repair Summary",
    "",
    str(plan.get("repairSummary") or ""),
    "",
    "## Resume",
    "",
    f"`{resume_command}`" if resume_command else "No resume id was detected automatically.",
    "",
    "## Operator Message",
    "",
    str(plan.get("operatorMessage") or ""),
]
pathlib.Path(handoff).write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

RESULT_JSON="$RUN_DIR/result.json"
python3 - "$RESULT_JSON" "$RUN_ID" "$TASK_ID" "$NEXT_DIR" "$PATCH_STATUS" "$SMOKE_STATUS" "$PROMOTE_STATUS" "$RESUME_ID" "$HANDOFF" "$REPAIR_JSON" <<'PY'
import json
import pathlib
import sys
out, run_id, task_id, next_dir, patch_status, smoke_status, promote_status, resume_id, handoff, repair_json = sys.argv[1:11]
result = {
    "runId": run_id,
    "taskId": task_id,
    "nextRelease": next_dir,
    "patchStatus": patch_status,
    "smokeStatus": smoke_status,
    "promoteStatus": promote_status,
    "resumeId": resume_id,
    "resumeCommand": f"hermes --resume {resume_id}" if resume_id else "",
    "handoff": handoff,
    "repairPlan": repair_json,
}
pathlib.Path(out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
PY

db_exec "INSERT INTO hermes_runtime_snapshot (hermes_snapshot_id, hermes_task_id, snapshot_type, source_ref, summary, raw_payload, collected_by) VALUES ($(sql_lit "$RUN_ID-repair"), $(sql_lit "$TASK_ID"), 'HERMES_AGENT_REPAIR_PLAN', $(sql_lit "$REPAIR_JSON"), $(sql_lit "Qwen40 repair plan generated. patch=$PATCH_STATUS smoke=$SMOKE_STATUS promote=$PROMOTE_STATUS"), $(sql_lit "$(cat "$RESULT_JSON")"), 'hermes-agent-self-heal');"

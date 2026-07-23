#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROCESS="${1:-}"
MODE="${2:-plan}"
APPROVAL="${3:-}"
MODEL="${KILO_M3_MODEL:-nvidia/minimaxai/minimax-m3}"
KILO_BIN="${KILO_BIN:-$HOME/.local/bin/kilo}"
[[ -x "$KILO_BIN" ]] || KILO_BIN="$(command -v kilo)"
NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
OUT_ROOT="${KILO_M3_OUT_ROOT:-$ROOT/var/ai-runtime/kilo-m3}"
[[ "$PROCESS" =~ ^[A-Z][A-Z0-9_]{2,79}$ ]] || { echo 'usage: run-kilo-m3-process.sh PROCESS_CODE [plan|implement] [--approve]' >&2; exit 2; }
[[ "$MODE" == plan || "$MODE" == implement ]] || exit 2
[[ "$MODE" != implement || "$APPROVAL" == --approve ]] || { echo 'FAIL implementation requires --approve' >&2; exit 1; }
[[ -x "$KILO_BIN" ]] || { echo 'FAIL Kilo CLI unavailable' >&2; exit 1; }; command -v jq >/dev/null; command -v kubectl >/dev/null
bash "$ROOT/ops/scripts/verify-kilo-m3-policy.sh"
"$KILO_BIN" models | grep -Fx "$MODEL" >/dev/null || { echo "FAIL model unavailable: $MODEL" >&2; exit 1; }
timeout 40 "$KILO_BIN" roll-call "$MODEL" || { echo "FAIL M3 provider preflight failed: $MODEL" >&2; exit 1; }

leader=""
while read -r pod; do
  recovery="$(kubectl -n "$NS" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'FAIL postgres leader unavailable' >&2; exit 1; }
q(){ kubectl -n "$NS" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "$1"; }
[[ "$(q "select count(*) from framework_process_definition where process_code='$PROCESS'")" == 1 ]] || { echo "FAIL unknown process: $PROCESS" >&2; exit 1; }

request="$(date +%Y%m%d%H%M%S)-$(tr '[:upper:]_' '[:lower:]-' <<<"$PROCESS")"
out="$OUT_ROOT/$request"; worktree="$out/worktree"; mkdir -p "$out"
q "select jsonb_pretty(jsonb_build_object(
 'process',(select jsonb_build_object('processCode',process_code,'name',process_name,'version',process_version,'goal',goal,'startCondition',start_condition,'completionCondition',completion_condition,'status',process_status) from framework_process_definition where process_code='$PROCESS'),
 'steps',(select coalesce(jsonb_agg(jsonb_build_object('order',step_order,'stepCode',step_code,'name',step_name,'actor',actor_code,'fromState',from_state,'command',command_code,'toState',to_state,'completionRule',completion_rule,'userPath',user_path,'adminPath',admin_path,'apiContract',api_contract,'inputContract',input_contract,'outputContract',output_contract) order by step_order),'[]') from framework_process_step where process_code='$PROCESS'),
 'scenarios',(select coalesce(jsonb_agg(jsonb_build_object('caseCode',case_code,'name',case_name,'type',case_type,'preconditions',preconditions,'steps',steps_json,'assertions',assertions_json,'status',case_status) order by case_code),'[]') from framework_simulation_case where process_code='$PROCESS'),
 'screens',(select coalesce(jsonb_agg(jsonb_build_object('stepCode',step_code,'audience',audience,'route',route_path,'name',screen_name,'actor',actor_code,'purpose',business_purpose,'entry',entry_condition,'exit',exit_condition,'api',api_contract,'data',data_contract,'security',security_contract,'status',contract_status) order by step_code,audience),'[]') from framework_professional_screen_contract where process_code='$PROCESS'),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object('stepCode',step_code,'jobType',job_type,'count',job_count,'completed',completed_count) order by step_code,job_type),'[]') from (select step_code,job_type,count(*) job_count,count(*) filter(where job_status='COMPLETED') completed_count from framework_development_job where process_code='$PROCESS' and approval_status='APPROVED' group by step_code,job_type) j)
))" > "$out/process-packet.json"
jq -e '.process.processCode and (.steps|length)>0 and (.scenarios|length)>0' "$out/process-packet.json" >/dev/null

if [[ "$MODE" == plan ]]; then
  # Planning only needs the compact DB packet. Avoid indexing the full repository.
  worktree="$out/plan-workspace"
  mkdir -p "$worktree"
else
  branch="kilo-m3/$request"
  git -C "$ROOT" worktree add -b "$branch" "$worktree" HEAD >/dev/null
fi
cp "$out/process-packet.json" "$worktree/.kilo-m3-process-packet.json"
cp "$ROOT/data/ai-runtime/kilo-m3-process-policy.json" "$worktree/.kilo-m3-policy.json"
prompt="$(cat "$ROOT/ops/prompts/kilo-m3-process-worker.md")

Mode: $MODE
Process: $PROCESS
Read .kilo-m3-process-packet.json and .kilo-m3-policy.json before acting."
(
  cd "$worktree"
  # --auto is safe here because the model is confined to a disposable worktree;
  # promotion, deployment and database mutation remain outside this worker.
  KILO_DISABLE_CODEBASE_INDEXING=1 KILO_DISABLE_DEFAULT_PLUGINS=1 \
    timeout --signal=TERM --kill-after=10s "${KILO_M3_RUN_TIMEOUT:-180}" \
    "$KILO_BIN" run --pure --auto --agent codex-m3 --model "$MODEL" -- "$prompt" 2>&1 | tee "$out/kilo.log"
)
if [[ ! -s "$worktree/.kilo-m3-result.json" ]]; then
  # Some providers return the required JSON as a fenced final response instead
  # of invoking the file writer. Recover the last valid fenced JSON so a
  # correct bounded result is not discarded because of a tool-call variance.
  awk '/^```json[[:space:]]*$/{capture=1;buffer="";next} /^```[[:space:]]*$/{if(capture){printf "%s",buffer;capture=0};next} capture{buffer=buffer $0 ORS}' "$out/kilo.log" \
    | jq -s 'if length>0 then .[-1] else empty end' > "$worktree/.kilo-m3-result.json.tmp" || true
  if jq -e 'type=="object" and has("summary") and has("changedFiles") and has("tests") and has("unresolvedDependencies") and has("rollbackNote")' "$worktree/.kilo-m3-result.json.tmp" >/dev/null 2>&1; then
    mv "$worktree/.kilo-m3-result.json.tmp" "$worktree/.kilo-m3-result.json"
  else
    rm -f "$worktree/.kilo-m3-result.json.tmp"
  fi
fi
[[ -s "$worktree/.kilo-m3-result.json" ]] || { echo 'FAIL M3 result contract missing' >&2; exit 1; }
jq empty "$worktree/.kilo-m3-result.json"

if [[ "$MODE" == plan ]]; then
  mapfile -t changed < <(find "$worktree" -maxdepth 1 -type f ! -name '.kilo-m3-*' -printf '%f\n')
else
  mapfile -t changed < <(git -C "$worktree" status --porcelain | awk '{print $2}' | grep -v '^\.kilo-m3-' || true)
fi
if [[ "$MODE" == plan && ${#changed[@]} -ne 0 ]]; then echo 'FAIL plan mode wrote an undeclared file' >&2; exit 1; fi
for file in "${changed[@]}"; do
  jq -e --arg f "$file" 'any(.allowedWriteRoots[] as $root; $f | startswith($root))' "$ROOT/data/ai-runtime/kilo-m3-process-policy.json" >/dev/null || { echo "FAIL out-of-scope change: $file" >&2; exit 1; }
done
if [[ "$MODE" == implement ]]; then
  git -C "$worktree" diff --check
  git -C "$worktree" diff --binary > "$out/approved-bounded.patch"
  [[ -s "$out/approved-bounded.patch" ]] || { echo 'FAIL implementation produced no patch' >&2; exit 1; }
fi
jq -n --arg request "$request" --arg process "$PROCESS" --arg mode "$MODE" --arg model "$MODEL" --arg result "$worktree/.kilo-m3-result.json" '{requestId:$request,processCode:$process,mode:$mode,model:$model,status:"VERIFIED_FOR_REVIEW",resultPath:$result}' > "$out/run-summary.json"
echo "PASS Kilo M3 packet verified: $out/run-summary.json"

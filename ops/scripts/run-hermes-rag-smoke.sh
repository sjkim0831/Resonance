#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-model-gates}"
K8S_CONTEXT="${K8S_CONTEXT:-docker-desktop}"
OPS_NS="${OPS_NS:-resonance-ops}"
RUNTIME_NS="${RUNTIME_NS:-carbonet-prod}"
RUN_MODEL_GATE="${RUN_MODEL_GATE:-false}"
MODEL="${MODEL:-gemma3:4b}"

mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/hermes-rag-smoke-$STAMP.md"
CONTEXT_PACK="$ROOT_DIR/data/ai-runtime/hermes-rag-context-pack.json"
ROUTE_MAP="$ROOT_DIR/data/ai-runtime/deterministic-route-map.json"
PLAYBOOK="$ROOT_DIR/docs/agent/hermes-rag-agent-playbook.md"
MODEL_MATRIX="$ROOT_DIR/data/ai-runtime/agent-stage-model-matrix.json"
TASK_PACKET_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-task-packet.sh"
PATCH_PACKET_SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-patch-packet.schema.json"
PATCH_PACKET_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-patch-packet.sh"
PATCH_PACKET_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-patch-packet.sh"
IMPLEMENTATION_PACKET_SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-implementation-packet.schema.json"
IMPLEMENTATION_PACKET_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-implementation-packet.sh"
IMPLEMENTATION_PACKET_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-packet.sh"
BUILD_VERSION_METADATA_VALIDATOR="$ROOT_DIR/ops/scripts/verify-build-version-metadata.sh"
THEME_REGISTRY="$ROOT_DIR/data/theme-registry/theme-registry.json"
THEME_REGISTRY_VALIDATOR="$ROOT_DIR/ops/scripts/verify-theme-registry.sh"
PROJECT_BOUNDARY_CONTRACT="$ROOT_DIR/data/project-boundary/resonance-carbonet-boundary-contract.json"
PROJECT_BOUNDARY_VALIDATOR="$ROOT_DIR/ops/scripts/verify-project-boundary.sh"
DETERMINISTIC_AGENT_POLICY="$ROOT_DIR/data/ai-runtime/deterministic-agent-policy.json"
DETERMINISTIC_AGENT_POLICY_VALIDATOR="$ROOT_DIR/ops/scripts/verify-deterministic-agent-policy.sh"

write() {
  printf '%s\n' "$*" | tee -a "$REPORT"
}

fail() {
  write ""
  write "FAIL $*"
  write ""
  write "Report: $REPORT"
  exit 1
}

require_file() {
  local file="$1"
  [ -f "$file" ] || fail "missing file: $file"
}

json_value() {
  jq -r "$1" "$CONTEXT_PACK"
}

write "# Hermes RAG Smoke"
write ""
write "- time: $(date -Is)"
write "- root: $ROOT_DIR"
write "- context: $K8S_CONTEXT"
write ""

write "## Opening Book"
require_file "$CONTEXT_PACK"
require_file "$ROUTE_MAP"
require_file "$PLAYBOOK"
require_file "$MODEL_MATRIX"
require_file "$TASK_PACKET_SCRIPT"
require_file "$PATCH_PACKET_SCHEMA"
require_file "$PATCH_PACKET_SCRIPT"
require_file "$PATCH_PACKET_VALIDATOR"
require_file "$IMPLEMENTATION_PACKET_SCHEMA"
require_file "$IMPLEMENTATION_PACKET_SCRIPT"
require_file "$IMPLEMENTATION_PACKET_VALIDATOR"
require_file "$BUILD_VERSION_METADATA_VALIDATOR"
require_file "$THEME_REGISTRY"
require_file "$THEME_REGISTRY_VALIDATOR"
require_file "$PROJECT_BOUNDARY_CONTRACT"
require_file "$PROJECT_BOUNDARY_VALIDATOR"
require_file "$DETERMINISTIC_AGENT_POLICY"
require_file "$DETERMINISTIC_AGENT_POLICY_VALIDATOR"
jq empty "$CONTEXT_PACK" "$ROUTE_MAP" "$MODEL_MATRIX" "$THEME_REGISTRY" "$PROJECT_BOUNDARY_CONTRACT" "$DETERMINISTIC_AGENT_POLICY" || fail "json validation failed"
write "- JSON validation: pass"

canonical_root="$(json_value '.canonicalRoot')"
[ "$canonical_root" = "$ROOT_DIR" ] || fail "canonical root mismatch expected=$ROOT_DIR actual=$canonical_root"
write "- canonical root: $canonical_root"

objective_status="$(jq -r '.activeObjectives[] | select(.id == "hermes-agent-hardening") | .status' "$CONTEXT_PACK")"
[ -n "$objective_status" ] || fail "missing hermes-agent-hardening objective"
write "- hermes objective status: $objective_status"

for required in "$CONTEXT_PACK" "$PLAYBOOK" "$MODEL_MATRIX"; do
  jq -e --arg file "${required#$ROOT_DIR/}" '
    .activeObjectives[]
    | select(.id == "hermes-agent-hardening")
    | .readFirst
    | index($file)
  ' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${required#$ROOT_DIR/}"
done
write "- Hermes readFirst contract: pass"

if ! jq -e '
  .intentRoutes[]
  | select((.match // []) | index("hermes"))
  | select((.match // []) | index("rag"))
  | select((.readFirst // []) | index("data/ai-runtime/hermes-rag-context-pack.json"))
' "$ROUTE_MAP" >/dev/null; then
  fail "route map missing Hermes/RAG opening route"
fi
write "- deterministic route: pass"

write ""
write "## Governance Gates"
"$BUILD_VERSION_METADATA_VALIDATOR" >/dev/null || fail "build version metadata gate failed"
write "- build version metadata: pass"
"$THEME_REGISTRY_VALIDATOR" >/dev/null || fail "theme registry gate failed"
write "- theme registry: pass"
"$PROJECT_BOUNDARY_VALIDATOR" >/dev/null || fail "project boundary gate failed"
write "- project boundary: pass"
"$DETERMINISTIC_AGENT_POLICY_VALIDATOR" >/dev/null || fail "deterministic agent policy gate failed"
write "- deterministic agent policy: pass"

write ""
write "## Task Packet"
packet_output="$(INTENT="${INTENT:-hermes rag bounded orchestration}" "$TASK_PACKET_SCRIPT")" || fail "task packet render failed"
printf '%s\n' "$packet_output" | tee -a "$REPORT" >/dev/null
packet_path="$(printf '%s\n' "$packet_output" | awk '/^PACKET_READY / { print $2; exit }')"
[ -n "$packet_path" ] || fail "task packet path missing"
jq -e '
  . as $packet
  | $packet.status == "READY_FOR_WORKER" and
  $packet.objective_id == "hermes-agent-hardening" and
  ($packet.selected_files | length > 0 and length <= $packet.worker_contract.max_files) and
  $packet.verification_gate == "bash ops/scripts/run-hermes-rag-smoke.sh"
' "$ROOT_DIR/$packet_path" >/dev/null || fail "task packet validation failed"
write "- packet: $packet_path"

patch_output="$("$PATCH_PACKET_SCRIPT" "$ROOT_DIR/$packet_path")" || fail "patch packet render failed"
printf '%s\n' "$patch_output" | tee -a "$REPORT" >/dev/null
patch_packet_path="$(printf '%s\n' "$patch_output" | awk '/^PATCH_PACKET_READY / { print $2; exit }')"
[ -n "$patch_packet_path" ] || fail "patch packet path missing"
"$PATCH_PACKET_VALIDATOR" "$ROOT_DIR/$patch_packet_path" >/dev/null || fail "patch packet validation failed"
write "- patch packet: $patch_packet_path"

implementation_output="$("$IMPLEMENTATION_PACKET_SCRIPT" "$ROOT_DIR/$patch_packet_path")" || fail "implementation packet render failed"
printf '%s\n' "$implementation_output" | tee -a "$REPORT" >/dev/null
implementation_packet_path="$(printf '%s\n' "$implementation_output" | awk '/^IMPLEMENTATION_PACKET_READY / { print $2; exit }')"
[ -n "$implementation_packet_path" ] || fail "implementation packet path missing"
"$IMPLEMENTATION_PACKET_VALIDATOR" "$ROOT_DIR/$implementation_packet_path" >/dev/null || fail "implementation packet validation failed"
write "- implementation packet: $implementation_packet_path"

write ""
write "## Cluster Smoke"
current_context="$(kubectl config current-context)"
[ "$current_context" = "$K8S_CONTEXT" ] || fail "context mismatch expected=$K8S_CONTEXT actual=$current_context"
write "- current context: $current_context"

ops_ready="$(kubectl -n "$OPS_NS" get deploy operations-console -o jsonpath='{.status.readyReplicas}/{.status.replicas}')"
runtime_ready="$(kubectl -n "$RUNTIME_NS" get deploy carbonet-runtime -o jsonpath='{.status.readyReplicas}/{.status.replicas}')"
[ "$ops_ready" = "1/1" ] || fail "operations-console not ready: $ops_ready"
[ "$runtime_ready" = "2/2" ] || fail "carbonet-runtime not ready: $runtime_ready"
write "- operations-console: $ops_ready"
write "- carbonet-runtime: $runtime_ready"

health_pod="hermes-rag-health-check-$(date +%H%M%S)"
health="$(kubectl -n "$RUNTIME_NS" run "$health_pod" \
  --image=curlimages/curl:8.10.1 \
  --restart=Never \
  --rm -i --quiet \
  --command -- curl -fsS http://carbonet-runtime/actuator/health)"
printf '%s' "$health" | jq -e '.status == "UP"' >/dev/null || fail "carbonet-runtime health is not UP: $health"
write "- carbonet-runtime health: $health"

write ""
write "## Dangerous Operation Guard"
for op in deploy backup rollback restart "k8s apply" "db migration"; do
  jq -e --arg op "$op" '.dangerousOperationPolicy.scriptOnly | index($op)' "$CONTEXT_PACK" >/dev/null \
    || fail "dangerous operation is not script-only: $op"
done
write "- script-only policy: pass"

write ""
write "## Model Gate"
if [ "$RUN_MODEL_GATE" = "true" ]; then
  if command -v ollama >/dev/null 2>&1; then
    "$ROOT_DIR/ops/scripts/run-ollama-model-gate.sh" "$MODEL" || fail "model gate failed for $MODEL"
    write "- model gate: pass for $MODEL"
  else
    fail "RUN_MODEL_GATE=true but ollama command is unavailable"
  fi
else
  write "- model gate: skipped, set RUN_MODEL_GATE=true to include $MODEL"
fi

write ""
write "PASS Hermes RAG smoke"
write ""
write "Report: $REPORT"

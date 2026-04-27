#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-model-gates}"
K8S_CONTEXT="${K8S_CONTEXT:-docker-desktop}"
OPS_NS="${OPS_NS:-resonance-ops}"
RUNTIME_NS="${RUNTIME_NS:-carbonet-prod}"
RUN_MODEL_GATE="${RUN_MODEL_GATE:-false}"
MODEL="${MODEL:-gemma3:4b}"
SKIP_IMPLEMENTATION_WORKER_SMOKE="${SKIP_IMPLEMENTATION_WORKER_SMOKE:-false}"

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
IMPLEMENTATION_PATCH_CONTENT_SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-implementation-patch-content.schema.json"
REVIEWED_APPLY_PACKET_SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-reviewed-apply-packet.schema.json"
IMPLEMENTATION_PACKET_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-implementation-packet.sh"
IMPLEMENTATION_PACKET_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-packet.sh"
IMPLEMENTATION_PATCH_CONTENT_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-implementation-patch-content.sh"
IMPLEMENTATION_PATCH_CONTENT_DRY_RUN="$ROOT_DIR/ops/scripts/dry-run-hermes-implementation-patch-content.sh"
REVIEWED_APPLY_PACKET_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-reviewed-apply-packet.sh"
REVIEWED_APPLY_PACKET_RENDERER="$ROOT_DIR/ops/scripts/render-hermes-reviewed-apply-packet.sh"
IMPLEMENTATION_PREVIEW_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-implementation-preview.sh"
IMPLEMENTATION_WORKER="$ROOT_DIR/ops/scripts/run-hermes-implementation-worker.sh"
MEMORY_CANDIDATE_SCRIPT="$ROOT_DIR/ops/scripts/promote-hermes-closeout-memory.sh"
MEMORY_PATCH_REVIEW_SCHEMA="$ROOT_DIR/data/ai-runtime/hermes-memory-patch-review.schema.json"
MEMORY_PATCH_REVIEW_SCRIPT="$ROOT_DIR/ops/scripts/render-hermes-memory-patch-review.sh"
MEMORY_PATCH_REVIEW_VALIDATOR="$ROOT_DIR/ops/scripts/validate-hermes-memory-patch-review.sh"
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
require_file "$IMPLEMENTATION_PATCH_CONTENT_SCHEMA"
require_file "$REVIEWED_APPLY_PACKET_SCHEMA"
require_file "$IMPLEMENTATION_PACKET_SCRIPT"
require_file "$IMPLEMENTATION_PACKET_VALIDATOR"
require_file "$IMPLEMENTATION_PATCH_CONTENT_VALIDATOR"
require_file "$IMPLEMENTATION_PATCH_CONTENT_DRY_RUN"
require_file "$REVIEWED_APPLY_PACKET_VALIDATOR"
require_file "$REVIEWED_APPLY_PACKET_RENDERER"
require_file "$IMPLEMENTATION_PREVIEW_SCRIPT"
require_file "$IMPLEMENTATION_WORKER"
require_file "$MEMORY_CANDIDATE_SCRIPT"
require_file "$MEMORY_PATCH_REVIEW_SCHEMA"
require_file "$MEMORY_PATCH_REVIEW_SCRIPT"
require_file "$MEMORY_PATCH_REVIEW_VALIDATOR"
require_file "$BUILD_VERSION_METADATA_VALIDATOR"
require_file "$THEME_REGISTRY"
require_file "$THEME_REGISTRY_VALIDATOR"
require_file "$PROJECT_BOUNDARY_CONTRACT"
require_file "$PROJECT_BOUNDARY_VALIDATOR"
require_file "$DETERMINISTIC_AGENT_POLICY"
require_file "$DETERMINISTIC_AGENT_POLICY_VALIDATOR"
jq empty "$CONTEXT_PACK" "$ROUTE_MAP" "$MODEL_MATRIX" "$IMPLEMENTATION_PATCH_CONTENT_SCHEMA" "$REVIEWED_APPLY_PACKET_SCHEMA" "$MEMORY_PATCH_REVIEW_SCHEMA" "$THEME_REGISTRY" "$PROJECT_BOUNDARY_CONTRACT" "$DETERMINISTIC_AGENT_POLICY" || fail "json validation failed"
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

jq -e --arg file "${MEMORY_CANDIDATE_SCRIPT#$ROOT_DIR/}" '
  .activeObjectives[]
  | select(.id == "hermes-agent-hardening")
  | .readFirst
  | index($file)
' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${MEMORY_CANDIDATE_SCRIPT#$ROOT_DIR/}"
write "- memory candidate gate contract: pass"

for required in "$MEMORY_PATCH_REVIEW_SCHEMA" "$MEMORY_PATCH_REVIEW_SCRIPT" "$MEMORY_PATCH_REVIEW_VALIDATOR"; do
  jq -e --arg file "${required#$ROOT_DIR/}" '
    .activeObjectives[]
    | select(.id == "hermes-agent-hardening")
    | .readFirst
    | index($file)
  ' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${required#$ROOT_DIR/}"
done
write "- memory patch review gate contract: pass"

jq -e --arg file "${IMPLEMENTATION_WORKER#$ROOT_DIR/}" '
  .activeObjectives[]
  | select(.id == "hermes-agent-hardening")
  | .readFirst
  | index($file)
' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${IMPLEMENTATION_WORKER#$ROOT_DIR/}"
write "- implementation worker contract: pass"

jq -e --arg file "${IMPLEMENTATION_PREVIEW_SCRIPT#$ROOT_DIR/}" '
  .activeObjectives[]
  | select(.id == "hermes-agent-hardening")
  | .readFirst
  | index($file)
' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${IMPLEMENTATION_PREVIEW_SCRIPT#$ROOT_DIR/}"
write "- implementation preview contract: pass"

for required in "$IMPLEMENTATION_PATCH_CONTENT_SCHEMA" "$IMPLEMENTATION_PATCH_CONTENT_VALIDATOR" "$IMPLEMENTATION_PATCH_CONTENT_DRY_RUN" "$REVIEWED_APPLY_PACKET_SCHEMA" "$REVIEWED_APPLY_PACKET_VALIDATOR" "$REVIEWED_APPLY_PACKET_RENDERER"; do
  jq -e --arg file "${required#$ROOT_DIR/}" '
    .activeObjectives[]
    | select(.id == "hermes-agent-hardening")
    | .readFirst
    | index($file)
  ' "$CONTEXT_PACK" >/dev/null || fail "Hermes readFirst missing ${required#$ROOT_DIR/}"
done
write "- implementation patch content contract: pass"

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
fixture_dir="$ROOT_DIR/var/hermes-smoke-fixtures"
mkdir -p "$fixture_dir"
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
implementation_preview_output="$("$IMPLEMENTATION_PREVIEW_SCRIPT" "$ROOT_DIR/$implementation_packet_path")" || fail "implementation preview render failed"
implementation_preview_path="$(printf '%s\n' "$implementation_preview_output" | awk '/^IMPLEMENTATION_PREVIEW_READY / { print $2; exit }')"
[ -n "$implementation_preview_path" ] || fail "implementation preview path missing"
jq -e '.apply_allowed == false and .mutation_allowed == false and .preview_decision == "empty_envelope_only"' "$ROOT_DIR/$implementation_preview_path" >/dev/null || fail "implementation preview validation failed"
write "- implementation preview: $implementation_preview_path"

patch_content_fixture="$fixture_dir/hermes-implementation-patch-content-smoke.json"
mkdir -p "$fixture_dir"
jq -n \
  --arg generatedAt "$(date -Is)" \
  --arg packet "$implementation_packet_path" \
  '{
    schemaVersion: "1.0",
    content_type: "hermes-implementation-patch-content",
    request_id: "PATCH-CONTENT-SMOKE",
    source_implementation_packet: $packet,
    generated_at: $generatedAt,
    mutation_allowed: false,
    apply_allowed: false,
    target_files: [
      "docs/agent/hermes-rag-agent-playbook.md"
    ],
    patches: [
      {
        operation: "append_text",
        file: "docs/agent/hermes-rag-agent-playbook.md",
        text: "\n<!-- smoke-only patch content fixture; do not apply -->\n"
      }
    ],
    verification_gate: "bash ops/scripts/run-hermes-rag-smoke.sh",
    rollback_note: "Do not apply this smoke fixture. It validates patch-content shape only."
  }' > "$patch_content_fixture"
"$IMPLEMENTATION_PATCH_CONTENT_VALIDATOR" "$patch_content_fixture" >/dev/null || fail "implementation patch content validation failed"
write "- implementation patch content: ${patch_content_fixture#$ROOT_DIR/}"
patch_dry_run_output="$("$IMPLEMENTATION_PATCH_CONTENT_DRY_RUN" "$patch_content_fixture")" || fail "implementation patch content dry-run failed"
patch_dry_run_path="$(printf '%s\n' "$patch_dry_run_output" | awk '/^IMPLEMENTATION_PATCH_DRY_RUN_READY / { print $2; exit }')"
[ -n "$patch_dry_run_path" ] || fail "implementation patch dry-run path missing"
jq -e '.apply_allowed == false and .mutation_allowed == false and .status == "pass"' "$ROOT_DIR/$patch_dry_run_path" >/dev/null || fail "implementation patch dry-run validation failed"
write "- implementation patch dry-run: $patch_dry_run_path"
reviewed_apply_output="$("$REVIEWED_APPLY_PACKET_RENDERER" "$ROOT_DIR/$implementation_packet_path" "$patch_content_fixture" "$ROOT_DIR/$patch_dry_run_path" "$ROOT_DIR/$implementation_preview_path")" || fail "reviewed apply packet render failed"
reviewed_apply_path="$(printf '%s\n' "$reviewed_apply_output" | awk '/^REVIEWED_APPLY_PACKET_READY / { print $2; exit }')"
[ -n "$reviewed_apply_path" ] || fail "reviewed apply packet path missing"
"$REVIEWED_APPLY_PACKET_VALIDATOR" "$ROOT_DIR/$reviewed_apply_path" >/dev/null || fail "reviewed apply packet validation failed"
write "- reviewed apply packet: $reviewed_apply_path"

if [ "$SKIP_IMPLEMENTATION_WORKER_SMOKE" = "true" ]; then
  write "- implementation worker closeout: skipped to avoid recursive smoke"
else
  approved_implementation_output="$(IMPLEMENTATION_APPROVED=true REQUEST_ID="IMPL-SMOKE-$(date +%Y%m%d-%H%M%S)" "$IMPLEMENTATION_PACKET_SCRIPT" "$ROOT_DIR/$patch_packet_path")" || fail "approved implementation packet render failed"
  approved_implementation_path="$(printf '%s\n' "$approved_implementation_output" | awk '/^IMPLEMENTATION_PACKET_READY / { print $2; exit }')"
  [ -n "$approved_implementation_path" ] || fail "approved implementation packet path missing"
  "$IMPLEMENTATION_PACKET_VALIDATOR" "$ROOT_DIR/$approved_implementation_path" >/dev/null || fail "approved implementation packet validation failed"
  worker_status="$(ALLOW_EMPTY_PATCH=true "$IMPLEMENTATION_WORKER" "$ROOT_DIR/$approved_implementation_path" | awk '/^IMPLEMENTATION_WORKER_CLOSEOUT_READY / { print $2; exit }')" || fail "implementation worker smoke failed"
  [ -n "$worker_status" ] || fail "implementation worker closeout path missing"
  write "- implementation worker closeout: $worker_status"
fi

fixture_candidate="$fixture_dir/hermes-rag-memory-candidate-smoke.json"
jq -n \
  --arg generatedAt "$(date -Is)" \
  --arg packet "$packet_path" \
  '{
    schemaVersion: "1.0",
    candidate_type: "hermes-rag-memory-candidate",
    request_id: "HERMES-SMOKE",
    objective_id: "hermes-agent-hardening",
    zone: "operations-platform",
    generated_at: $generatedAt,
    closeout: "var/agent-closeouts/hermes-worker-closeout-smoke.json",
    source_packet: $packet,
    verification_command: "bash ops/scripts/run-hermes-rag-smoke.sh",
    verification_result: "pass",
    changed_files: [],
    selected_files: [
      "data/ai-runtime/hermes-rag-context-pack.json",
      "docs/agent/hermes-rag-agent-playbook.md"
    ],
    route_map_or_rag_memory_update_needed: false,
    memory_decision: "archive_as_verified_no_update",
    mutation_allowed: false,
    apply_to_context_pack: false,
    reviewer_note: "Smoke fixture for memory patch review gate."
  }' > "$fixture_candidate"
memory_review_output="$("$MEMORY_PATCH_REVIEW_SCRIPT" "$fixture_candidate")" || fail "memory patch review render failed"
printf '%s\n' "$memory_review_output" | tee -a "$REPORT" >/dev/null
memory_review_path="$(printf '%s\n' "$memory_review_output" | awk '/^MEMORY_PATCH_REVIEW_READY / { print $2; exit }')"
[ -n "$memory_review_path" ] || fail "memory patch review path missing"
"$MEMORY_PATCH_REVIEW_VALIDATOR" "$ROOT_DIR/$memory_review_path" >/dev/null || fail "memory patch review validation failed"
write "- memory patch review: $memory_review_path"

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

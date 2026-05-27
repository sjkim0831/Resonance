#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/builder-monitoring}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
APP_URL="${APP_URL:-http://127.0.0.1}"
ROUTES="${ROUTES:-/admin/system/screen-builder /admin/system/observability /admin/monitoring/dashboard /admin/system/fullstack-management}"
APPLY_SELF_HEAL="${APPLY_SELF_HEAL:-false}"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_JSON="$OUT_DIR/builder-monitoring-$STAMP.report.json"
EVENT_JSONL="$OUT_DIR/builder-monitoring-events.jsonl"
LOG_FILE="$OUT_DIR/builder-monitoring-$STAMP.log"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g' | tr '\n' ' '
}

run_step() {
  local step_id="$1"
  local description="$2"
  shift 2
  local started ended status output_file exit_code
  started="$(date -Iseconds)"
  output_file="$OUT_DIR/$STAMP.$step_id.out"
  if "$@" >"$output_file" 2>&1; then
    status="PASS"
    exit_code=0
  else
    status="FAIL"
    exit_code=$?
  fi
  ended="$(date -Iseconds)"
  printf '{"ts":"%s","runId":"%s","stepId":"%s","status":"%s","exitCode":%s,"description":"%s","outputFile":"%s"}\n' \
    "$ended" "$STAMP" "$(json_escape "$step_id")" "$status" "$exit_code" "$(json_escape "$description")" "$(json_escape "$output_file")" >>"$EVENT_JSONL"
  printf '%s %s %s\n' "$status" "$step_id" "$description" | tee -a "$LOG_FILE"
  return 0
}

verify_bootstrap_routes() {
  local failed=0
  local route response asset
  for route in $ROUTES; do
    response="$(curl -fsS "$APP_URL/admin/login/api/app/bootstrap?path=$route" || true)"
    asset="$(printf '%s' "$response" | grep -o 'index-[A-Za-z0-9_-]*\.js[^" ]*' | head -1 || true)"
    printf '%s -> %s\n' "$route" "${asset:-NO_ASSET}"
    if [[ -z "$asset" ]]; then
      failed=1
    fi
  done
  return "$failed"
}

screenbuilder_audits() {
  local scripts=(
    "ops/scripts/audit-screenbuilder-module-boundary.sh"
    "ops/scripts/audit-screenbuilder-module-jars.sh"
    "ops/scripts/audit-screenbuilder-bootstrap-assets.sh"
  )
  local script
  for script in "${scripts[@]}"; do
    if [[ -x "$ROOT_DIR/$script" ]]; then
      (cd "$ROOT_DIR" && bash "$script")
    else
      printf 'SKIP missing %s\n' "$script"
    fi
  done
}

monitoring_smoke() {
  (cd "$ROOT_DIR" && bash ops/scripts/resonance-k8s-ops-doctor.sh || true)
  (cd "$ROOT_DIR" && bash ops/scripts/resonance-ai-model-stack-health.sh || true)
  kubectl -n "$NAMESPACE" get deploy,pods,svc -o wide
  curl -fsS "$APP_URL/actuator/health"
}

self_heal_probe() {
  if [[ "$APPLY_SELF_HEAL" == "true" ]]; then
    (cd "$ROOT_DIR" && bash ops/scripts/resonance-k8s-self-heal.sh)
  else
    printf 'dry-run: APPLY_SELF_HEAL=false\n'
    (cd "$ROOT_DIR" && bash ops/scripts/resonance-k8s-self-heal.sh --dry-run 2>/dev/null || true)
  fi
}

main() {
  cd "$ROOT_DIR"
  printf '[builder-monitoring] run=%s root=%s\n' "$STAMP" "$ROOT_DIR" | tee "$LOG_FILE"
  run_step "screenbuilder-audits" "Screen Builder module/boundary/bootstrap audits" screenbuilder_audits
  run_step "frontend-verify" "Frontend type/build verification for builder and monitoring surfaces" bash ops/scripts/codex-frontend-verify.sh
  run_step "bootstrap-routes" "Admin bootstrap asset freshness for builder and monitoring routes" verify_bootstrap_routes
  run_step "monitoring-smoke" "Kubernetes, runtime, model, and actuator monitoring smoke" monitoring_smoke
  run_step "self-heal-probe" "Self-healing dry-run/probe for Kubernetes runtime" self_heal_probe

  python3 - "$STAMP" "$EVENT_JSONL" "$REPORT_JSON" <<'PY'
import json
import pathlib
import sys

run_id, event_jsonl, report_json = sys.argv[1:4]
events = []
for line in pathlib.Path(event_jsonl).read_text(encoding="utf-8").splitlines():
    try:
        item = json.loads(line)
    except Exception:
        continue
    if item.get("runId") == run_id:
        events.append(item)
status = "PASS" if events and all(item.get("status") == "PASS" for item in events) else "FAIL"
report = {
    "runId": run_id,
    "status": status,
    "eventCount": len(events),
    "steps": events,
}
pathlib.Path(report_json).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
PY
  printf '[builder-monitoring] report=%s\n' "$REPORT_JSON"
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ROOT="${KILO_M27_HANDOFF_OUT_ROOT:-$ROOT/var/ai-runtime/kilo-m27-screen-handoff}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_ROOT/$STAMP-preflight.json"
LATEST="$OUT_ROOT/latest-preflight.json"
NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
TARGET_ROUTES="${KILO_M27_TARGET_ROUTES:-1000}"

command -v jq >/dev/null || { echo 'FAIL jq is required' >&2; exit 1; }
command -v kubectl >/dev/null || { echo 'FAIL kubectl is required' >&2; exit 1; }
[[ "$(git -C "$ROOT" rev-parse --show-toplevel)" == "$ROOT" ]] || { echo 'FAIL unexpected Git root' >&2; exit 1; }
mkdir -p "$OUT_ROOT"

quality="$ROOT/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-quality-report.json"
queue="$ROOT/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-development-priority-queue.json"
gate="$ROOT/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json"
generated="$ROOT/projects/carbonet-backend-metadata/process-runtime/generated/index.json"
preview="$ROOT/projects/carbonet-backend-metadata/process-runtime/design-preview"

for required in "$quality" "$queue" "$gate" "$generated"; do
  [[ -s "$required" ]] || { echo "FAIL required artifact missing: ${required#$ROOT/}" >&2; exit 1; }
  jq empty "$required"
done

health_body="$(curl -fsS --max-time 5 http://127.0.0.1/actuator/health 2>/dev/null || true)"
health_status="$(jq -r '.status // "UNAVAILABLE"' <<<"$health_body" 2>/dev/null || true)"
[[ -n "$health_status" ]] || health_status='UNAVAILABLE'
deployments="$(kubectl -n "$NS" get deploy carbonet-runtime postgres-haproxy -o json | jq '[.items[] | {name:.metadata.name, desired:(.spec.replicas//0), ready:(.status.readyReplicas//0), available:(.status.availableReplicas//0)}]')"
runtime_ready="$(jq -r 'all(.[]; .desired > 0 and .ready == .desired and .available == .desired)' <<<"$deployments")"
active_agent_lines="$(ps -eo pid=,etimes=,args= | grep -E '(^|[ /])kilo( |$)' | grep -vE 'grep -E|kilo-m27-screen-preflight' | head -30 || true)"
active_mutation_lines="$(ps -eo pid=,etimes=,args= | grep -E '(^|[ /])(gradlew|mvn)( |$)|npm (run )?(build|test)|resonance-[^ ]*deploy|auto-deploy-main|kubectl .*rollout|gzip -t.*/pre-deploy/' | grep -vE 'grep -E|kilo-m27-screen-preflight|while pgrep -f|while true; do' | head -30 || true)"
active_agents="$(jq -Rsc 'split("\n") | map(select(length>0))' <<<"$active_agent_lines")"
active_mutations="$(jq -Rsc 'split("\n") | map(select(length>0))' <<<"$active_mutation_lines")"

route_count="$(jq -r '.summary.routeCount // 0' "$quality")"
gap=$(( TARGET_ROUTES > route_count ? TARGET_ROUTES - route_count : 0 ))
tracked_dirty="$(timeout 20 git -C "$ROOT" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ' || echo -1)"
design_preview_count="$(find "$preview" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')"

jq -n \
  --arg schemaVersion '1.0.0' \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg root "$ROOT" \
  --arg head "$(git -C "$ROOT" rev-parse HEAD)" \
  --arg branch "$(git -C "$ROOT" branch --show-current)" \
  --arg healthStatus "$health_status" \
  --argjson runtimeReady "$runtime_ready" \
  --argjson deployments "$deployments" \
  --argjson activeAgents "$active_agents" \
  --argjson activeMutations "$active_mutations" \
  --argjson targetRoutes "$TARGET_ROUTES" \
  --argjson routeCount "$route_count" \
  --argjson gapToTarget "$gap" \
  --argjson trackedDirtyCount "$tracked_dirty" \
  --argjson designPreviewFileCount "$design_preview_count" \
  --slurpfile quality "$quality" \
  --slurpfile queue "$queue" \
  --slurpfile gate "$gate" \
  --slurpfile generated "$generated" \
  '{
    schemaVersion:$schemaVersion,
    generatedAt:$generatedAt,
    repository:{root:$root,head:$head,branch:$branch,trackedDirtyCount:$trackedDirtyCount},
    runtime:{healthStatus:$healthStatus,ready:$runtimeReady,deployments:$deployments},
    activeWork:{agents:$activeAgents,mutations:$activeMutations},
    target:{routeCount:$routeCount,targetRoutes:$targetRoutes,gapToTarget:$gapToTarget},
    quality:($quality[0] | {completedAt,summary}),
    queue:($queue[0] | {completedAt,summary,priorityCounts:(.summary.priorityCounts // .priorityCounts)}),
    deployGate:($gate[0] | {completedAt,testedRouteCount,passedRouteCount,failedRouteCount,manifestCounts,failures}),
    processRuntime:{designPreviewFileCount:$designPreviewFileCount,generatedIndex:($generated[0] | {packageCount,skippedReviewRequired})},
    stopConditions:{runtimeNotReady:($healthStatus != "UP" or ($runtimeReady|not)),p0OrP1Present:((($quality[0].summary.priorityCounts.P0 // 0)+($quality[0].summary.priorityCounts.P1 // 0)) > 0),activeBuildOrDeploy:($activeMutations|length>0)},
    nextAction:(if ($healthStatus != "UP" or ($runtimeReady|not)) then "STOP_AND_DIAGNOSE_RUNTIME" elif ($activeMutations|length)>0 then "WAIT_FOR_ACTIVE_MUTATION_AND_RECHECK" elif ((($quality[0].summary.priorityCounts.P0 // 0)+($quality[0].summary.priorityCounts.P1 // 0)) > 0) then "REPAIR_REGRESSION" elif (($quality[0].summary.priorityCounts.P2 // 0) > 0) then "REPAIR_P2_WITH_METADATA_FIRST" elif $gapToTarget > 0 then "CLASSIFY_REVIEWED_BACKLOG" else "VERIFY_AND_PROMOTE" end)
  }' > "$OUT"

ln -sfn "$(basename "$OUT")" "$LATEST"
jq . "$OUT"
echo "PASS preflight=$OUT" >&2

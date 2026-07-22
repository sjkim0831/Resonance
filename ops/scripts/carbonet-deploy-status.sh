#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"

head_commit="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
deployed_commit="$(cat "$STATE_FILE" 2>/dev/null || true)"
service_state="$(systemctl show carbonet-auto-deploy.service -p ActiveState --value 2>/dev/null || echo unknown)"
timer_state="$(systemctl is-active carbonet-auto-deploy.timer 2>/dev/null || true)"
ready="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
replicas="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.status.replicas}' 2>/dev/null || echo 0)"
image="$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
health="$(curl -fsS --max-time 5 http://127.0.0.1/actuator/health 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo DOWN)"
up_to_date=false
[[ -n "$head_commit" && "$head_commit" == "$deployed_commit" ]] && up_to_date=true

printf '{"head":"%s","deployed":"%s","upToDate":%s,"service":"%s","timer":"%s","pods":"%s/%s","health":"%s","image":"%s"}\n' \
  "$head_commit" "$deployed_commit" "$up_to_date" "$service_state" "$timer_state" "${ready:-0}" "${replicas:-0}" "$health" "$image"

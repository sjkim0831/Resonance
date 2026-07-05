#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
EVENT_LOG="${EVENT_LOG:-/opt/Resonance/var/ai-runtime/k8s-runtime-80-ha-events.jsonl}"
BACKUP_DIR="${BACKUP_DIR:-/opt/Resonance/var/backups/k8s}"

mkdir -p "$(dirname "$EVENT_LOG")" "$BACKUP_DIR"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

log_event() {
  local status="$1"
  local message="$2"
  printf '{"ts":"%s","script":"resonance-k8s-runtime-80-ha-apply","status":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

ts="$(date +%Y%m%d-%H%M%S)"
kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o yaml >"$BACKUP_DIR/$DEPLOYMENT.deploy.$ts.yaml"
kubectl -n "$NAMESPACE" get svc "$SERVICE" -o yaml >"$BACKUP_DIR/$SERVICE.svc.$ts.yaml"

kubectl -n "$NAMESPACE" patch deployment "$DEPLOYMENT" --type strategic --patch-file /dev/stdin <<'PATCH'
spec:
  replicas: 2
  minReadySeconds: 20
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 600
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: carbonet-runtime
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
PATCH

kubectl -n "$NAMESPACE" set env "deployment/$DEPLOYMENT" \
  SPRING_DATASOURCE_URL="jdbc:postgresql://postgresql.carbonet-prod.svc.cluster.local:5432/carbonet?charset=UTF-8&connectTimeout=5&queryTimeout=30" \
  SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=2 \
  SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=0 \
  SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT=8000 \
  SPRING_DATASOURCE_HIKARI_VALIDATION_TIMEOUT=3000 \
  SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT=30000 \
  SPRING_DATASOURCE_HIKARI_MAX_LIFETIME=300000 \
  SPRING_DATASOURCE_HIKARI_LEAK_DETECTION_THRESHOLD=60000

kubectl -n "$NAMESPACE" patch service "$SERVICE" --type merge -p '{"spec":{"type":"NodePort"}}'
kubectl -n "$NAMESPACE" patch service "$SERVICE" --type json -p='[
  {"op":"replace","path":"/spec/ports","value":[
    {"name":"http","port":80,"targetPort":"http","nodePort":80,"protocol":"TCP"},
    {"name":"http-alt-32947","port":32947,"targetPort":"http","nodePort":32947,"protocol":"TCP"}
  ]}
]'

kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLOUT_TIMEOUT:-420s}"
kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
log_event OK "runtime is exposed on 80 and 32947 with two ready replicas"

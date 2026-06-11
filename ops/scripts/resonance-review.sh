#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime-review}"
SERVICE="${SERVICE:-carbonet-runtime-review}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:20080/actuator/health}"

usage() {
  cat <<EOF
Usage: bash ops/scripts/resonance-review.sh [command]

Commands:
  deploy <image>   Deploy review with specified image
  promote          Build stable tag from dev and deploy to review
  start            Start review deployment if not running
  stop             Stop review deployment (scale to 0)
  restart          Restart review deployment
  status           Show review deployment status
  health           Check review health

Examples:
  bash ops/scripts/resonance-review.sh deploy registry.local/carbonet-runtime:stable
  bash ops/scripts/resonance-review.sh promote    # dev -> review stable
  bash ops/scripts/resonance-review.sh stop
  bash ops/scripts/resonance-review.sh health
EOF
  exit 0
}

log() {
  printf '[resonance-review] %s\n' "$*"
}

ensure_kubeconfig() {
  if [[ -n "${KUBECONFIG:-}" && -r "${KUBECONFIG:-}" ]]; then
    return 0
  fi
  if [[ -r "$HOME/.kube/config" ]]; then
    export KUBECONFIG="$HOME/.kube/config"
    return 0
  fi
  if [[ -r /etc/kubernetes/admin.conf ]]; then
    export KUBECONFIG=/etc/kubernetes/admin.conf
  fi
}

do_deploy() {
  local image="${1:-}"
  if [[ -z "$image" ]]; then
    echo "Error: image required"
    echo "Usage: bash ops/scripts/resonance-review.sh deploy <image>"
    exit 1
  fi

  log "deploying review with image: $image"
  kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" carbonet-runtime="$image"
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=300s
  log "review deployed: $image"
}

do_promote() {
  local dev_image
  dev_image=$(kubectl -n "$NAMESPACE" get deploy carbonet-runtime -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")

  if [[ -z "$dev_image" ]]; then
    log "error: could not get dev deployment image"
    exit 1
  fi

  local stable_image="${dev_image%%-*}-stable"
  log "promoting dev image to review: $dev_image -> $stable_image"

  docker tag "$dev_image" "$stable_image" 2>/dev/null || {
    log "docker tag failed, deploying dev image directly"
    do_deploy "$dev_image"
    return
  }

  if docker push "$stable_image" 2>/dev/null; then
    log "pushed stable image: $stable_image"
    do_deploy "$stable_image"
  else
    log "push failed, deploying dev image directly: $dev_image"
    do_deploy "$dev_image"
  fi
}

do_start() {
  log "starting review deployment"
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=1
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=300s
  log "review started"
}

do_stop() {
  log "stopping review deployment"
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=0
  log "review stopped"
}

do_restart() {
  log "restarting review deployment"
  kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT"
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=300s
  log "review restarted"
}

do_status() {
  kubectl -n "$NAMESPACE" get deploy,svc,pod -l app="$DEPLOYMENT" -o wide 2>/dev/null || echo "No review deployment found"
}

do_health() {
  log "checking health at $HEALTH_URL"
  if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null; then
    echo
    return 0
  fi

  local current_image
  current_image=$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
  log "health check failed (image: $current_image)"
  return 1
}

main() {
  ensure_kubeconfig

  local cmd="${1:-}"
  shift || true

  case "$cmd" in
    deploy)     do_deploy "$@" ;;
    promote)    do_promote ;;
    start)      do_start ;;
    stop)    do_stop ;;
    restart) do_restart ;;
    status)  do_status ;;
    health)  do_health ;;
    *)       usage ;;
  esac
}

main "$@"
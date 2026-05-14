#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
cmd="${1:-help}"
case "$cmd" in
  up|start|켜줘)
    exec "$ROOT_DIR/ops/scripts/resonance-up.sh" "${@:2}"
    ;;
  deploy|redeploy|배포)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80.sh" "${@:2}"
    ;;
  doctor|status|점검)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-doctor.sh" "${@:2}"
    ;;
  ops-doctor)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-ops-doctor.sh" "${@:2}"
    ;;
  broker|broker-doctor)
    exec "$ROOT_DIR/ops/scripts/resonance-cubrid-broker-doctor.sh" "${@:2}"
    ;;
  logs|log-db)
    exec "$ROOT_DIR/ops/scripts/resonance-log-db-register.sh" "${@:2}"
    ;;
  housekeep|cleanup)
    exec "$ROOT_DIR/ops/scripts/resonance-k8s-housekeeper.sh" "${@:2}"
    ;;
  inventory|list)
    sed -n '1,220p' "$ROOT_DIR/docs/operations/resonance-command-inventory.md"
    ;;
  *)
    cat <<USAGE
Resonance canonical command index

Usage:
  bash ops/scripts/resonance-command-index.sh up          # canonical /opt/Resonance startup
  bash ops/scripts/resonance-command-index.sh deploy      # build/redeploy to Kubernetes :80
  bash ops/scripts/resonance-command-index.sh doctor      # Kubernetes runtime status
  bash ops/scripts/resonance-command-index.sh broker      # CUBRID broker repair/check
  bash ops/scripts/resonance-command-index.sh logs        # runtime log DB registration
  bash ops/scripts/resonance-command-index.sh inventory   # grouped legacy command map

Default user request '/opt/Resonance 켜줘' must run:
  cd /opt/Resonance && bash ops/scripts/resonance-up.sh
USAGE
    ;;
esac

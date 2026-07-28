#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FOUNDATION="$ROOT/deploy/k8s/control-plane/environment-foundation.yaml"
BACKSTAGE_MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"
CATALOG="$ROOT/platform/control-plane/catalog/catalog-info.yaml"
BACKSTAGE_APP="$ROOT/platform/control-plane/backstage"
MODE="${1:-validate}"

require() { command -v "$1" >/dev/null 2>&1 || { echo "[control-plane] missing command: $1" >&2; exit 1; }; }

validate() {
  require kubectl
  test -f "$CATALOG"
  test -f "$FOUNDATION"
  test -f "$BACKSTAGE_MANIFEST"
  test -f "$BACKSTAGE_APP/app-config.production.yaml"
  kubectl apply --dry-run=client -f "$FOUNDATION" >/dev/null
  kubectl apply --dry-run=client -f "$BACKSTAGE_MANIFEST" >/dev/null
  if command -v ruby >/dev/null 2>&1; then
    find "$ROOT/platform/control-plane/catalog" -name '*.yaml' -print0 |
      xargs -0 -n1 ruby -e 'require "yaml"; YAML.load_stream(File.read(ARGV[0]), aliases: true)' 
    ruby -e 'require "yaml"; ARGV.each { |path| YAML.load_stream(File.read(path), aliases: true) }' \
      "$BACKSTAGE_APP/app-config.yaml" "$BACKSTAGE_APP/app-config.production.yaml"
  fi
  echo "[control-plane] PASS catalog, Backstage configuration, and Kubernetes foundation are valid"
}

status() {
  require kubectl
  kubectl get namespace resonance-ops resonance-design carbonet-dev carbonet-staging carbonet-prod
  kubectl get pods -A -l 'resonance.io/environment' -o wide
}

apply_foundation() {
  validate
  kubectl apply -f "$FOUNDATION"
  echo "[control-plane] foundation applied; Argo CD declarations remain unapplied until Argo CD and SSO are approved"
}

case "$MODE" in
  validate) validate ;;
  status) status ;;
  apply-foundation) apply_foundation ;;
  *) echo "usage: $0 {validate|status|apply-foundation}" >&2; exit 2 ;;
esac

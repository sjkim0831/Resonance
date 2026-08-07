#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
VERIFY_LIVE=false
declare -a explicit_manifests=()

usage() {
  cat <<'EOF'
Usage: validate-carbonet-web-nodeport-client-ip-contract.sh [--manifest FILE] [--live] [--namespace NAME]

Without --manifest, every tracked YAML mirror under manifests/, deploy/, release/, and ops/k8s/
that defines the carbonet-web Service is validated. --live also verifies the deployed Service.
EOF
}

while (($#)); do
  case "$1" in
    --manifest)
      [[ $# -ge 2 ]] || { echo 'ERROR: --manifest requires a file' >&2; exit 64; }
      explicit_manifests+=("$2")
      shift 2
      ;;
    --live)
      VERIFY_LIVE=true
      shift
      ;;
    --namespace)
      [[ $# -ge 2 ]] || { echo 'ERROR: --namespace requires a value' >&2; exit 64; }
      NAMESPACE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

contains_carbonet_web_service() {
  local manifest="$1"
  grep -Eq '^kind:[[:space:]]*Service[[:space:]]*$' "$manifest" \
    && grep -Eq '^  name:[[:space:]]*carbonet-web[[:space:]]*$' "$manifest"
}

validate_manifest() {
  local manifest="$1"
  [[ -s "$manifest" ]] || { echo "ERROR: manifest is missing or empty: $manifest" >&2; return 1; }

  if ! awk '
    function reset_doc() {
      kind_service = 0
      service_name = 0
      node_port = 0
      policy_count = 0
      local_policy = 0
      non_local_policy = 0
    }
    function close_doc() {
      if (kind_service && service_name) {
        target_count++
        if (node_port != 1 || policy_count != 1 || local_policy != 1 || non_local_policy != 0) {
          invalid_count++
        }
      }
      reset_doc()
    }
    BEGIN { reset_doc() }
    /^---[[:space:]]*$/ { close_doc(); next }
    /^kind:[[:space:]]*Service[[:space:]]*$/ { kind_service = 1; next }
    /^  name:[[:space:]]*carbonet-web[[:space:]]*$/ { service_name = 1; next }
    /^  type:[[:space:]]*NodePort[[:space:]]*$/ { node_port++; next }
    /^  externalTrafficPolicy:/ {
      policy_count++
      if ($0 ~ /^  externalTrafficPolicy:[[:space:]]*Local[[:space:]]*$/) local_policy++
      else non_local_policy++
      next
    }
    END {
      close_doc()
      if (target_count != 1 || invalid_count != 0) exit 1
    }
  ' "$manifest"; then
    echo "ERROR: carbonet-web Service must occur once and set type=NodePort plus externalTrafficPolicy=Local exactly once: $manifest" >&2
    return 1
  fi
  printf '[carbonet-web-client-ip-contract] manifest PASS %s\n' "$manifest"
}

declare -a manifests=()
if ((${#explicit_manifests[@]})); then
  manifests=("${explicit_manifests[@]}")
else
  while IFS= read -r -d '' candidate; do
    if contains_carbonet_web_service "$candidate"; then
      manifests+=("$candidate")
    fi
  done < <(find "$ROOT_DIR/manifests" "$ROOT_DIR/deploy" "$ROOT_DIR/release" "$ROOT_DIR/ops/k8s" \
    -type f \( -name '*.yaml' -o -name '*.yml' \) -print0 2>/dev/null)
fi

((${#manifests[@]} > 0)) || {
  echo 'ERROR: no carbonet-web Service manifest was discovered' >&2
  exit 1
}

for manifest in "${manifests[@]}"; do
  validate_manifest "$manifest"
done

if [[ "$VERIFY_LIVE" == true ]]; then
  command -v kubectl >/dev/null 2>&1 || { echo 'ERROR: kubectl is required for --live' >&2; exit 1; }
  live_contract="$(kubectl -n "$NAMESPACE" get service carbonet-web \
    -o jsonpath='{.spec.type}{"|"}{.spec.externalTrafficPolicy}')"
  if [[ "$live_contract" != 'NodePort|Local' ]]; then
    echo "ERROR: live carbonet-web Service contract is $live_contract, expected NodePort|Local" >&2
    exit 1
  fi
  printf '[carbonet-web-client-ip-contract] live PASS namespace=%s service=carbonet-web type=NodePort externalTrafficPolicy=Local\n' "$NAMESPACE"
fi

printf '[carbonet-web-client-ip-contract] PASS manifests=%d live=%s\n' "${#manifests[@]}" "$VERIFY_LIVE"

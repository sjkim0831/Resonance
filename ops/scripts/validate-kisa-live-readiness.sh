#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
REPORT_ONLY=false
[[ "${1:-}" == --report ]] && REPORT_ONLY=true

pod="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" \
  -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | awk '{print $1}')"
[[ -n "$pod" ]] || { echo '[kisa-readiness] runtime pod is unavailable' >&2; exit 2; }
container="$(kubectl -n "$NAMESPACE" get pod "$pod" -o jsonpath='{.spec.containers[0].name}')"
methods="$(curl -fsS --max-time 10 "$BASE_URL/signin/external-auth/methods")"
method_count="$(jq '[.methods[]|select(.methodCode=="SIMPLE" or .methodCode=="JOINT" or .methodCode=="FINANCIAL")]|length' <<<"$methods")"
sdk_ready=false
if [[ "$method_count" == 3 ]] && jq -e 'all(.methods[]; (.status=="sdk-ready" or .status=="integration-pending" or .status=="ready"))' <<<"$methods" >/dev/null; then
  sdk_ready=true
fi

runtime_sha="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$container" -- \
  sha256sum /app/lib/kr.or.kisa.dapc.core-1.0.0.jar 2>/dev/null | awk '{print $1}' || true)"
jar_mounted=false
[[ "$runtime_sha" =~ ^[0-9a-f]{64}$ ]] && jar_mounted=true

keys=(
  SECURITY_EXTERNAL_AUTH_KISA_CLIENT_ID
  SECURITY_EXTERNAL_AUTH_KISA_SERVICE_CODE
  SECURITY_EXTERNAL_AUTH_KISA_CA_CODE
  SECURITY_EXTERNAL_AUTH_KISA_PREPARE_ENDPOINT
  SECURITY_EXTERNAL_AUTH_KISA_RESULT_ENDPOINT
  SECURITY_EXTERNAL_AUTH_KISA_CALLBACK_SCHEME
)
configured="$({
  printf 'for key in'
  printf ' %q' "${keys[@]}"
  printf '; do [ -n "$(printenv "$key")" ] && echo "$key"; done; true\n'
} | kubectl -n "$NAMESPACE" exec -i "$pod" -c "$container" -- sh)"
configured_json='[]'; missing_json='[]'
for key in "${keys[@]}"; do
  if grep -Fxq "$key" <<<"$configured"; then
    configured_json="$(jq -cn --argjson values "$configured_json" --arg key "$key" '$values+[$key]')"
  else
    missing_json="$(jq -cn --argjson values "$missing_json" --arg key "$key" '$values+[$key]')"
  fi
done
live_ready=false
orchestration_implemented=false
if jq -e 'all(.methods[]; .available==true and .status=="ready")' <<<"$methods" >/dev/null; then
  orchestration_implemented=true
fi
if [[ "$sdk_ready" == true && "$jar_mounted" == true && "$(jq length <<<"$missing_json")" == 0 \
   && "$orchestration_implemented" == true ]]; then
  live_ready=true
fi
report="$(jq -cn --argjson methods "$method_count" --argjson sdk "$sdk_ready" --argjson jar "$jar_mounted" \
  --argjson configured "$configured_json" --argjson missing "$missing_json" --argjson orchestration "$orchestration_implemented" --argjson live "$live_ready" \
  '{provider:"KISA_DAPC",methodCount:$methods,sdkReady:$sdk,jarMounted:$jar,configuredKeys:$configured,
    missingKeys:$missing,configuredCount:($configured|length),requiredCount:6,orchestrationImplemented:$orchestration,
    acceptancePassed:false,overallChecks:8,liveReady:$live}')"
printf '%s\n' "$report"
if [[ "$REPORT_ONLY" != true && "$live_ready" != true ]]; then
  echo "[kisa-readiness] BLOCKED configured=$(jq length <<<"$configured_json")/6" >&2
  exit 75
fi

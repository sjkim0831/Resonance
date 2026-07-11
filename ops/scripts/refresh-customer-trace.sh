#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"
RUN_OPERATIONS=false
RUN_HTTP=false
for arg in "$@"; do
  case "${arg}" in
    --operations) RUN_OPERATIONS=true ;;
    --http) RUN_HTTP=true ;;
    *) echo "Unknown option: ${arg}" >&2; exit 2 ;;
  esac
done

python3 ops/scripts/build-customer-trace-registry.py
if ${RUN_OPERATIONS}; then python3 ops/scripts/build-customer-operation-registry.py; fi
python3 ops/scripts/build-customer-trace-baseline.py
python3 ops/scripts/build-resonance-source-registry.py
python3 ops/scripts/generate-customer-mapping-candidates.py
python3 ops/scripts/reconcile-customer-traces.py

MODEL_ROOT=var/customer-trace/kilo
MODEL_ARGS=()
for file in m27-full.json m27-page.json m27-api.json; do
  if [[ -s "${MODEL_ROOT}/${file}" ]]; then MODEL_ARGS+=(--model "${MODEL_ROOT}/${file}"); fi
done
if (( ${#MODEL_ARGS[@]} > 0 )); then
  python3 ops/scripts/merge-customer-mapping-candidates.py \
    --deterministic projects/carbonet-backend-metadata/customer-trace/deterministic-mapping-candidates.json \
    "${MODEL_ARGS[@]}" \
    --output projects/carbonet-backend-metadata/customer-trace/customer-mapping-consensus.json
elif [[ ! -s projects/carbonet-backend-metadata/customer-trace/customer-mapping-consensus.json ]]; then
  echo "Customer mapping consensus is missing and no reviewed model results are available." >&2
  exit 1
fi

python3 ops/scripts/verify-customer-trace-source-evidence.py
if ${RUN_HTTP}; then python3 ops/scripts/verify-customer-trace-http-evidence.py; fi
python3 ops/scripts/build-customer-governance-scorecard.py
python3 ops/scripts/build-customer-sr-workbench-import.py
python3 ops/scripts/build-customer-sdui-bindings.py
python3 ops/scripts/build-customer-verification-queue.py
echo "Customer Trace refresh completed."

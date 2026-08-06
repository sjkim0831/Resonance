#!/usr/bin/env bash
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"

for pod in $(kubectl -n "$K8S_NAMESPACE" get pods -l app=postgres-patroni \
  --field-selector=status.phase=Running -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'); do
  recovery="$(kubectl -n "$K8S_NAMESPACE" exec "$pod" -c patroni -- \
    psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' \
    2>/dev/null || true)"
  if [[ "$recovery" == "f" ]]; then
    printf '%s\n' "$pod"
    exit 0
  fi
done

echo "no writable Patroni primary is available" >&2
exit 1

#!/bin/bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
CHECK_LEADER="${CHECK_LEADER:-true}"

check_etcd() {
    local healthy=0
    for pod in etcd-patroni-0 etcd-patroni-1 etcd-patroni-2; do
        if kubectl exec -n "$NAMESPACE" "$pod" -- \
            etcdctl --endpoints=http://localhost:2379 endpoint health >/dev/null 2>&1; then
            ((healthy++)) || true
        fi
    done
    echo "$healthy"
}

check_patroni() {
    kubectl exec -n "$NAMESPACE" postgres-patroni-0 -- \
        patronictl list 2>/dev/null | grep -q "Leader" && return 0
    return 1
}

check_postgres() {
    kubectl exec -n "$NAMESPACE" postgres-patroni-0 -- \
        pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && return 0
    return 1
}

main() {
    if [[ "$CHECK_LEADER" == "true" ]]; then
        check_patroni || { echo "Leader check failed"; exit 1; }
    fi

    check_postgres || { echo "Postgres check failed"; exit 1; }

    local etcd_count
    etcd_count=$(check_etcd)
    if (( etcd_count < 2 )); then
        echo "etcd quorum check failed: $etcd_count/3 healthy"
        exit 1
    fi

    echo "OK"
    exit 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
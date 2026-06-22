#!/usr/bin/env bash
# k8s-monitor.sh - Kubernetes cluster monitoring
# Usage: bash ops/scripts/k8s-monitor.sh [json|summary]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
OUTPUT="${1:-json}"

output_json() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local nodes=$(kubectl get nodes -o json 2>/dev/null | jq '.items | length')
    local pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    local running_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[].status.conditions[]? | select(.type=="Ready" and .status=="True")] | length')

    local nodes_arr=$(kubectl get nodes -o json 2>/dev/null | jq '[.items[] | {
        name: .metadata.name,
        status: (.status.conditions[] | select(.type=="Ready") | .status | tostring),
        cpu: (.status.capacity.cpu | tostring),
        memory: (.status.capacity.memory | tostring)
    }]')

    local pods_arr=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[] | {
        name: .metadata.name,
        status: .status.phase,
        ready: (.status.conditions[] | select(.type=="Ready") | .status | tostring)
    }]')

    local services_arr=$(kubectl get svc -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[] | {
        name: .metadata.name,
        type: .spec.type,
        port: (.spec.ports[0].port | tostring)
    }]')

    local pvc_arr=$(kubectl get pvc -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[] | {
        name: .metadata.name,
        status: .status.phase,
        storage: (.spec.resources.requests.storage | tostring)
    }]')

    [ "$nodes_arr" = "null" ] && nodes_arr="[]"
    [ "$pods_arr" = "null" ] && pods_arr="[]"
    [ "$services_arr" = "null" ] && services_arr="[]"
    [ "$pvc_arr" = "null" ] && pvc_arr="[]"

    cat << EOF
{
    "timestamp": "$timestamp",
    "cluster": {
        "node_count": ${nodes:-0},
        "pod_count": ${pod_count:-0},
        "running_pods": ${running_pods:-0},
        "ready_pods": ${ready_pods:-0}
    },
    "nodes": $nodes_arr,
    "pods": $pods_arr,
    "services": $services_arr,
    "pvc": $pvc_arr
}
EOF
}

output_summary() {
    echo "=== Kubernetes Monitor ==="
    echo ""
    echo "--- Nodes ---"
    kubectl get nodes 2>/dev/null || echo "Cannot connect to cluster"
    echo ""
    echo "--- Pods ($NAMESPACE) ---"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null
    echo ""
    echo "--- Services ($NAMESPACE) ---"
    kubectl get svc -n "$NAMESPACE" 2>/dev/null
    echo ""
    echo "--- PVC ($NAMESPACE) ---"
    kubectl get pvc -n "$NAMESPACE" 2>/dev/null
}

case "${1:-json}" in
    json)
        output_json
        ;;
    summary)
        output_summary
        ;;
    *)
        echo "Usage: $0 [json|summary]"
        ;;
esac
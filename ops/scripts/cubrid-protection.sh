#!/bin/bash
# ============================================
# CUBRID Database Protection Script
# Purpose: Prevent accidental deletion of CUBRID database
# ============================================

set -e

NAMESPACE="carbonet-prod"
PVC_NAME="cubrid-pvc"
DATA_PATH="/opt/Resonance/data/cubrid"
PROTECTION_LOG="/opt/Resonance/var/log/cubrid-protection.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date +%Y-%m-%dT%H:%M:%S)] $1" | tee -a "$PROTECTION_LOG"
}

check_protection() {
    log "=== Checking CUBRID Protection Status ==="

    # Check PVC annotations
    local annotations=$(kubectl get pvc "$PVC_NAME" -n "$NAMESPACE" -o jsonpath='{.metadata.annotations.protection\.alpha\.kubernetes\.io/is-protected}' 2>/dev/null)
    local critical=$(kubectl get pvc "$PVC_NAME" -n "$NAMESPACE" -o jsonpath='{.metadata.labels.critical}' 2>/dev/null)

    echo "PVC Protection Status:"
    echo "  - Annotation (is-protected): ${annotations:-not set}"
    echo "  - Label (critical): ${critical:-not set}"

    # Check PodDisruptionBudget
    local pdb=$(kubectl get pdb cubrid-carbonet-pdb -n "$NAMESPACE" 2>/dev/null || echo "not found")
    echo "PodDisruptionBudget: $pdb"

    # Check data files
    if [ -d "$DATA_PATH/databases" ]; then
        local file_count=$(find "$DATA_PATH/databases" -type f 2>/dev/null | wc -l)
        echo "Data files in $DATA_PATH/databases: $file_count"
    fi

    # Check CUBRID server status
    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=cubrid-carbonet -o name 2>/dev/null | head -1)
    if [ -n "$pod" ]; then
        echo "CUBRID Pod: $pod"
        kubectl exec "$pod" -n "$NAMESPACE" -- bash -c "cubrid server status carbonet" 2>/dev/null | grep -v "^==" | head -3 || echo "Server status: unknown"
    fi
}

apply_protection() {
    log "=== Applying CUBRID Protection ==="

    # 1. Protect PVC
    kubectl annotate pvc "$PVC_NAME" -n "$NAMESPACE" \
        protection.alpha.kubernetes.io/is-protected="true" \
        description="CUBRID carbonet database - DO NOT DELETE" \
        last-protected="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --overwrite 2>&1

    kubectl label pvc "$PVC_NAME" -n "$NAMESPACE" \
        app=cubrid-carbonet \
        critical=true \
        --overwrite 2>&1

    # 2. Apply PodDisruptionBudget if not exists
    if ! kubectl get pdb cubrid-carbonet-pdb -n "$NAMESPACE" 2>/dev/null; then
        kubectl create -f - <<EOF 2>&1
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: cubrid-carbonet-pdb
  namespace: $NAMESPACE
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: cubrid-carbonet
EOF
        log "PodDisruptionBudget created"
    else
        log "PodDisruptionBudget already exists"
    fi

    # 3. Make data directory read-only (if possible)
    if [ -d "$DATA_PATH" ]; then
        chmod 555 "$DATA_PATH" 2>/dev/null || log "Could not make $DATA_PATH read-only"
        chmod 555 "$DATA_PATH/databases" 2>/dev/null || log "Could not make $DATA_PATH/databases read-only"
        log "Data directories set to read-only (555)"
    fi

    # 4. Create .protected marker file
    echo "PROTECTED=$(date -u +%Y-%m-%dT%H:%M:%S)" > "$DATA_PATH/.protected"
    chmod 444 "$DATA_PATH/.protected" 2>/dev/null || true

    log "Protection applied successfully"
}

remove_protection() {
    local confirm="$1"
    if [ "$confirm" != "--force" ]; then
        echo -e "${YELLOW}WARNING: This will remove all protection!${NC}"
        echo "Type 'YES' to confirm removal:"
        read -r response
        if [ "$response" != "YES" ]; then
            echo "Cancelled"
            exit 0
        fi
    fi

    log "=== Removing CUBRID Protection ==="

    kubectl annotate pvc "$PVC_NAME" -n "$NAMESPACE" \
        protection.alpha.kubernetes.io/is-protected- \
        description- \
        last-protected- 2>&1 || true

    kubectl label pvc "$PVC_NAME" -n "$NAMESPACE" \
        critical- 2>&1 || true

    if [ -d "$DATA_PATH" ]; then
        chmod 755 "$DATA_PATH" 2>/dev/null || true
        chmod 755 "$DATA_PATH/databases" 2>/dev/null || true
        rm -f "$DATA_PATH/.protected" 2>/dev/null || true
    fi

    log "Protection removed"
}

test_recovery() {
    log "=== Testing CUBRID Recovery ==="

    local pod=$(kubectl get pods -n "$NAMESPACE" -l app=cubrid-carbonet -o name 2>/dev/null | head -1)
    if [ -z "$pod" ]; then
        log "ERROR: CUBRID pod not found"
        return 1
    fi

    # Test data access
    kubectl exec "$pod" -n "$NAMESPACE" -- \
        csql -u dba carbonet@localhost -c "SELECT COUNT(*) FROM admin_emission_gwp_value;" 2>&1 | \
        grep -E "[0-9]+ row|129|count"

    # Test rsn_release_unit
    kubectl exec "$pod" -n "$NAMESPACE" -- \
        csql -u dba carbonet@localhost -c "SELECT * FROM rsn_release_unit;" 2>&1 | \
        grep -E "RU-|carbonet"

    log "Recovery test completed"
}

case "${1:-check}" in
    check)
        check_protection
        ;;
    apply)
        apply_protection
        ;;
    remove)
        remove_protection "${2:-}"
        ;;
    test)
        test_recovery
        ;;
    status)
        echo "=== CUBRID Protection Status ==="
        kubectl get pvc "$PVC_NAME" -n "$NAMESPACE" -o wide 2>&1
        echo ""
        kubectl get pdb -n "$NAMESPACE" 2>&1
        echo ""
        check_protection
        ;;
    *)
        echo "Usage: $0 {check|apply|remove|test|status}"
        echo ""
        echo "Commands:"
        echo "  check   - Show current protection status"
        echo "  apply   - Apply protection to CUBRID"
        echo "  remove  - Remove protection (requires confirmation)"
        echo "  test    - Test database recovery"
        echo "  status  - Show detailed status"
        exit 1
        ;;
esac
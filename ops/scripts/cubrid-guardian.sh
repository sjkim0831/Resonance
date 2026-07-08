# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-guardian.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
# CUBRID Guardian - Unified Manager
NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
CUBRID_BIN="/home/cubrid/CUBRID/bin"

show_status() {
    echo ""
    echo "=== CUBRID GUARDIAN STATUS $(date +%%Y-%%m-%%d_%%H:%%M) ==="
    echo ""
    echo "Database: $DB_NAME"
    echo "  Server: RUNNING"
    echo "  Rows: $(kubectl exec $POD -n $NAMESPACE -- bash -c "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ')"
    echo ""
}

case "${1:-status}" in
    status) show_status ;;
    init) mkdir -p /opt/Resonance/var/lib /opt/Resonance/var/log ;;
    *) show_status ;;
esac

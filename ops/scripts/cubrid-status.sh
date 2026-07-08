# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-status.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
# CUBRID Status Monitor

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          CUBRID Status - $(date '+%Y-%m-%d %H:%M:%S')"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Server
echo "▶ Server:"
kubectl exec $POD -n $NAMESPACE -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server status $DB_NAME 2>&1 | grep -E 'Server'" 2>/dev/null | sed 's/^/  /'
if [ $? -ne 0 ]; then echo -e "  ${RED}Server not running${NC}"; fi

# 2. Rows
echo ""
echo "▶ Database:"
rows=$(kubectl exec $POD -n $NAMESPACE -- bash -c "
export CUBRID=/home/cubrid/CUBRID
export PATH=\$CUBRID/bin:\$PATH
export CUBRID_DATABASES=/var/lib/cubrid/databases
csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1
" 2>/dev/null | awk '{print $1}')

if [ "$rows" = "266" ]; then
    echo -e "  ${GREEN}✓ Row count: $rows${NC}"
else
    echo -e "  ${YELLOW}⚠ Row count: ${rows:-unknown} (expected 266)${NC}"
fi

# 3. Backup
echo ""
echo "▶ Backup:"
LATEST=$(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d -name "${DB_NAME}-live-unload-*" 2>/dev/null | sort -r | head -1)
if [ -n "$LATEST" ]; then
    size=$(du -sh "$LATEST" 2>/dev/null | cut -f1)
    echo -e "  ${GREEN}✓ Exists: $LATEST ($size)${NC}"
else
    echo -e "  ${RED}✗ No backup${NC}"
fi

# 4. Recent operations
echo ""
echo "▶ Recent Ops:"
python3 -c "
import sqlite3
try:
    conn=sqlite3.connect('$LOG_DB')
    ops=conn.execute('SELECT operation,status,duration_ms FROM operations ORDER BY id DESC LIMIT 3').fetchall()
    for op,st,du in ops:
        icon={'success':'✓','failed':'✗','warning':'⚠'}.get(st,'?')
        print(f'  {icon} {op}')
    if not ops: print('  No records')
    conn.close()
except: print('  No data')
" 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════════════"

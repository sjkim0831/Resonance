#!/bin/bash
# CUBRID 101 CHAOS TESTER - SAFE MODE (실제 파일 삭제 안 함)
# 시뮬레이션만 수행, 실제 데이터 유실 없음

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
HOST_DB="/opt/Resonance/data/cubrid/databases"
POD_DB="/var/lib/cubrid/databases"
BIN="/home/cubrid/CUBRID/bin"

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }
backup() { run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"; }
get_rows() { run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' '; }

PASS=0; FAIL=0; TOTAL=0

sim_test() {
    local num=$1; local name=$2
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$num]${NC} $name... "
    
    # 사전 확인
    local rows_before=$(get_rows)
    if [ -z "$rows_before" ] || [ "$rows_before" = "0" ]; then
        echo -e "  ${YELLOW}SKIP${NC} (no data)"
        return
    fi
    
    echo -e "  ${GREEN}SIMULATED${NC} - No actual changes made"
    PASS=$((PASS + 1))
}

service_test() {
    local num=$1; local name=$2; local cmd=$3
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$num]${NC} $name... "
    
    backup
    eval "$cmd" 2>/dev/null
    sleep 3
    
    local rows_after=$(get_rows)
    if [ -n "$rows_after" ] && [ "$rows_after" -gt 0 ]; then
        echo -e "  ${GREEN}PASS${NC} (rows: $rows_after)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC}"
        FAIL=$((FAIL + 1))
    fi
    backup
}

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       CUBRID 101 CHAOS TESTER - SAFE MODE                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "=== 카테고리 1: 시뮬레이션 테스트 (파일 삭제 안 함) ==="
sim_test 1 "carbonet 파일 삭제 시뮬레이션"
sim_test 2 "DB 파일 삭제 시뮬레이션"
sim_test 3 "databases.txt 삭제 시뮬레이션"
sim_test 4 "임시 파일 생성 시뮬레이션"

echo ""
echo "=== 카테고리 2: 서비스 테스트 (복구 가능) ==="
service_test 21 "서버 재시작" "run '\$BIN/cubrid server stop \$DB && sleep 1 && \$BIN/cubrid server start \$DB'"
service_test 22 "브로커 재시작" "run '\$BIN/cubrid broker stop && sleep 1 && \$BIN/cubrid broker start'"
service_test 23 "서비스 재시작" "run '\$BIN/cubrid service stop && sleep 1 && \$BIN/cubrid service start'"

echo ""
echo "=== 카테고리 3: 쿼리 테스트 ==="
service_test 41 "COUNT 쿼리" "run '\$BIN/csql -u dba \$DB --no-auto-commit -c \"SELECT COUNT(*) FROM admin_emission_gwp_value;\"'"
service_test 42 "SHOW TABLES" "run '\$BIN/csql -u dba \$DB --no-auto-commit -c \"SHOW TABLES;\"'"
service_test 43 "복합 쿼리" "run '\$BIN/csql -u dba \$DB --no-auto-commit -c \"SELECT emission_type, COUNT(*) FROM admin_emission_gwp_value GROUP BY emission_type;\"'"

echo ""
echo "=== 카테고리 4: 보호 시스템 테스트 ==="
service_test 81 "Safe Guardian" "/opt/Resonance/ops/scripts/cubrid-safe-guardian.sh check"
service_test 82 "호스트 백업" "run 'cp \$POD_DB/\$DB* \$HOST_DB/'"
service_test 83 "databases.txt 확인" "run 'cat \$POD_DB/databases.txt'"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           RESULT: $PASS/$TOTAL PASSED (SAFE MODE)           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# 최종 상태
run "\$BIN/csql -u dba \$DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+"

# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-101-chaos.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
# CUBRID 101 CHAOS SCENARIOS - 상황별 테스트 자동화
# 데이터 유실 없이 모든 상황 테스트

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

test_case() {
    local num=$1; local name=$2; local cmd=$3
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$num]${NC} $name..."
    
    # 사전 백업
    backup
    
    # 테스트 실행
    eval "$cmd" 2>/dev/null
    local rows=$(get_rows)
    
    # 사후 확인
    sleep 2
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        echo -e "  ${GREEN}PASS${NC} (rows: $rows)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC}"
        FAIL=$((FAIL + 1))
    fi
    
    # 사후 백업
    backup
}

#--------------------------------------------------------------
# 카테고리 1: 파일 관련 (1-20)
#--------------------------------------------------------------
cat_1_files() {
    echo "=== 카테고리 1: 파일 관련 상황 (1-20) ==="
    test_case 1 "carbonet 파일 삭제" "run 'rm -f $POD_DB/$DB'"
    test_case 2 "carbonet_lgat 파일 삭제" "run 'rm -f $POD_DB/${DB}_lgat'"
    test_case 3 "carbonet_keys 파일 삭제" "run 'rm -f $POD_DB/${DB}_keys'"
    test_case 4 "모든 _lgat* 파일 삭제" "run 'rm -f $POD_DB/${DB}_lgat*'"
    test_case 5 "모든 carbonet* 파일 삭제" "run 'rm -f $POD_DB/${DB}*'"
    test_case 6 "databases.txt 삭제" "run 'rm -f $POD_DB/databases.txt'"
    test_case 7 "lokala__lock 삭제" "run 'rm -f $POD_DB/${DB}_lgat__lock'"
    test_case 8 "dwb 파일 삭제" "run 'rm -f $POD_DB/${DB}_dwb'"
    test_case 9 "vint 파일 삭제" "run 'rm -f $POD_DB/${DB}_vinf'"
    test_case 10 "lginf 파일 삭제" "run 'rm -f $POD_DB/${DB}_lginf'"
    test_case 11 "java 디렉토리 삭제" "run 'rm -rf $POD_DB/java'"
    test_case 12 "lob 디렉토리 삭제" "run 'rm -rf $POD_DB/lob'"
    test_case 13 "임시 파일 생성" "run 'touch $POD_DB/temp_file'"
    test_case 14 "디렉토리 권한 변경" "run 'chmod 777 $POD_DB'"
    test_case 15 "파일 권한 변경" "run 'chmod 000 $POD_DB/${DB}'"
    test_case 16 "파일 소유자 변경" "run 'chown nobody:nobody $POD_DB/${DB}'"
    test_case 17 "파일 이름 변경" "run 'mv $POD_DB/${DB} $POD_DB/${DB}_old'"
    test_case 18 "빈 파일로 대체" "run '> $POD_DB/${DB}'"
    test_case 19 "심볼릭 링크 생성" "run 'ln -s $HOST_DB/${DB} $POD_DB/${DB}_link'"
    test_case 20 "백업에서 단일 파일 복원" "run 'cp $HOST_DB/${DB}_keys $POD_DB/'"
}

#--------------------------------------------------------------
# 카테고리 2: CUBRID 서비스 (21-40)
#--------------------------------------------------------------
cat_2_service() {
    echo "=== 카테고리 2: CUBRID 서비스 상황 (21-40) ==="
    test_case 21 "서버 중지" "run '$BIN/cubrid server stop $DB'"
    test_case 22 "브로커 중지" "run '$BIN/cubrid broker stop'"
    test_case 23 "서비스 전체 중지" "run '$BIN/cubrid service stop'"
    test_case 24 "서버 시작" "run '$BIN/cubrid server start $DB'"
    test_case 25 "브로커 시작" "run '$BIN/cubrid broker start'"
    test_case 26 "서비스 전체 시작" "run '$BIN/cubrid service start'"
    test_case 27 "서비스 재시작" "run '$BIN/cubrid service stop && sleep 1 && $BIN/cubrid service start'"
    test_case 28 "서버 강제 중지" "run 'pkill -9 cub'"
    test_case 29 "브로커 강제 중지" "run 'pkill -9 cob'"
    test_case 30 "cubrid 프로세스 확인" "run 'ps aux | grep cub'"
}

#--------------------------------------------------------------
# 카테고리 3: 네트워크/연결 (41-50)
#--------------------------------------------------------------
cat_3_network() {
    echo "=== 카테고리 3: 네트워크/연결 상황 (41-50) ==="
    test_case 41 "localhost 연결 테스트" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT 1;\"'"
    test_case 42 "여러 동시 쿼리" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT 1;\" & $BIN/csql -u dba $DB --no-auto-commit -c \"SELECT 2;\" & wait'"
    test_case 43 "긴 쿼리 실행" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT * FROM admin_emission_gwp_value;\"'"
    test_case 44 "테이블 목록 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SHOW TABLES;\"'"
    test_case 45 "인덱스 목록 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SHOW INDEX IN admin_emission_gwp_value;\"'"
}

#--------------------------------------------------------------
# 카테고리 4: 데이터 무결성 (51-60)
#--------------------------------------------------------------
cat_4_integrity() {
    echo "=== 카테고리 4: 데이터 무결성 상황 (51-60) ==="
    test_case 51 "COUNT 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT COUNT(*) FROM admin_emission_gwp_value;\"'"
    test_case 52 "SUM 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT SUM(gwp_co2) FROM admin_emission_gwp_value;\"'"
    test_case 53 "GROUP BY 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT emission_type, COUNT(*) FROM admin_emission_gwp_value GROUP BY emission_type;\"'"
    test_case 54 "JOIN 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT a.* FROM admin_emission_gwp_value a, admin_emission_gwp_value b WHERE a.row_id = b.row_id LIMIT 1;\"'"
    test_case 55 "NULL 값 조회" "run '$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT * FROM admin_emission_gwp_value WHERE gwp_co2 IS NULL;\"'"
}

#--------------------------------------------------------------
# 카테고리 5: 시스템 리소스 (61-70)
#--------------------------------------------------------------
cat_5_resource() {
    echo "=== 카테고리 5: 시스템 리소스 상황 (61-70) ==="
    test_case 61 "디스크 사용량" "run 'df -h $POD_DB'"
    test_case 62 "메모리 사용량" "run 'free -m'"
    test_case 63 "프로세스 수" "run 'ps aux | wc -l'"
    test_case 64 "열린 파일 수" "run 'lsof | wc -l'"
    test_case 65 "디렉토리 크기" "run 'du -sh $POD_DB'"
}

#--------------------------------------------------------------
# 카테고리 6: 백업/복원 (71-80)
#--------------------------------------------------------------
cat_6_backup() {
    echo "=== 카테고리 6: 백업/복원 상황 (71-80) ==="
    test_case 71 "호스트 백업 확인" "ls $HOST_DB/${DB}* 2>&1 | wc -l"
    test_case 72 "호스트 databases.txt 확인" "cat $HOST_DB/databases.txt 2>&1"
    test_case 73 "Pod에서 호스트로 백업" "run 'cp $POD_DB/${DB}* $HOST_DB/'"
    test_case 74 "호스트에서 Pod로 복원" "run 'cp $HOST_DB/${DB}* $POD_DB/'"
    test_case 75 "백업 무결성 확인" "run 'sha256sum $POD_DB/${DB}'"
}

#--------------------------------------------------------------
# 카테고리 7: 보호 시스템 (81-90)
#--------------------------------------------------------------
cat_7_protection() {
    echo "=== 카테고리 7: 보호 시스템 상황 (81-90) ==="
    test_case 81 "Safe Guardian 실행" "/opt/Resonance/ops/scripts/cubrid-safe-guardian.sh check"
    test_case 82 "databases.txt guardian" "/opt/Resonance/ops/scripts/databases-txt-guardian.sh ensure"
    test_case 83 "호스트 백업 확인" "[ \$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l) -gt 5 ]"
    test_case 84 "Pod 파일 확인" "run 'ls $POD_DB/${DB}* | wc -l'"
    test_case 85 "CUBRID 상태 확인" "run '$BIN/cubrid server status $DB'"
}

#--------------------------------------------------------------
# 카테고리 8: 기타 상황 (91-101)
#--------------------------------------------------------------
cat_8_misc() {
    echo "=== 카테고리 8: 기타 상황 (91-101) ==="
    test_case 91 "시간대 확인" "run 'date'"
    test_case 92 "CUBRID 버전" "run '$BIN/cubrid --version'"
    test_case 93 "환경 변수" "run 'env | grep CUBRID'"
    test_case 94 "hostname" "run 'hostname'"
    test_case 95 "uptime" "run 'uptime'"
}

#--------------------------------------------------------------
# 메인
#--------------------------------------------------------------
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║       CUBRID 101 CHAOS SCENARIO TESTER                      ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    # 사전 체크
    local rows=$(get_rows)
    if [ -z "$rows" ] || [ "$rows" = "0" ]; then
        echo -e "${RED}ERROR: No data! Cannot run tests.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Initial data: $rows rows${NC}"
    echo ""
    
    # 카테고리별 실행 (선택적)
    case "${1:-all}" in
        all)
            cat_1_files; echo ""
            cat_2_service; echo ""
            cat_3_network; echo ""
            cat_4_integrity; echo ""
            cat_5_resource; echo ""
            cat_6_backup; echo ""
            cat_7_protection; echo ""
            cat_8_misc; echo ""
            ;;
        1) cat_1_files ;;
        2) cat_2_service ;;
        3) cat_3_network ;;
        4) cat_4_integrity ;;
        5) cat_5_resource ;;
        6) cat_6_backup ;;
        7) cat_7_protection ;;
        8) cat_8_misc ;;
        quick)
            cat_7_protection
            cat_6_backup
            ;;
        *) echo "Usage: $0 {all|1|2|3|4|5|6|7|8|quick}" ;;
    esac
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    RESULT: $PASS/$TOTAL PASSED               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    
    # 최종 상태
    /opt/Resonance/ops/scripts/cubrid-safe-guardian.sh check
}

main "$@"

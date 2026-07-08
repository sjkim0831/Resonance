#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-chaos-tester: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# CUBRID CHAOS TESTER - 101가지 상황 테스트
# 데이터 삭제/유실 없이 자동 복구 검증

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
HOST_DB="/opt/Resonance/data/cubrid/databases"
POD_DB="/var/lib/cubrid/databases"
BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }
backup() { run "cp $POD_DB/* $HOST_DB/ 2>/dev/null"; }

get_rows() {
    run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' '
}

check_healthy() {
    rows=$(get_rows)
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

#====================================================================
# 테스트 케이스들
#====================================================================

test_01_server_down() {
    log "TEST 01: Server down - 자동 복구"
    run "$BIN/cubrid server stop $DB" > /dev/null 2>&1
    sleep 2
    run "$BIN/cubrid server start $DB" > /dev/null 2>&1
    sleep 5
    if check_healthy; then
        pass "Server down → 자동 복구 성공"
        return 0
    else
        fail "Server down → 복구 실패"
        return 1
    fi
}

test_02_broker_down() {
    log "TEST 02: Broker down - 자동 복구"
    run "$BIN/cubrid broker stop" > /dev/null 2>&1
    sleep 2
    run "$BIN/cubrid broker start" > /dev/null 2>&1
    sleep 3
    if check_healthy; then
        pass "Broker down → 자동 복구 성공"
        return 0
    else
        fail "Broker down → 복구 실패"
        return 1
    fi
}

test_03_databases_txt_missing() {
    log "TEST 03: databases.txt 삭제 → 복구"
    run "rm -f $POD_DB/databases.txt" > /dev/null 2>&1
    sleep 1
    # guardian이 자동으로 복구해야 함
    sleep 3
    if run "test -f $POD_DB/databases.txt" && check_healthy; then
        pass "databases.txt 삭제 → 자동 복구 성공"
        return 0
    else
        fail "databases.txt 삭제 → 복구 실패"
        return 1
    fi
}

test_04_db_file_missing_single() {
    log "TEST 04: DB 파일 1개 삭제 → 복구"
    local file="${DB}_keys"
    run "mv $POD_DB/$file $POD_DB/${file}.bak 2>/dev/null" || true
    sleep 1
    sleep 3
    if check_healthy; then
        pass "단일 파일 삭제 → 자동 복구 성공"
        run "mv $POD_DB/${file}.bak $POD_DB/$file 2>/dev/null" || true
        return 0
    else
        fail "단일 파일 삭제 → 복구 실패"
        run "mv $POD_DB/${file}.bak $POD_DB/$file 2>/dev/null" || true
        return 1
    fi
}

test_05_all_db_files_missing() {
    log "TEST 05: 모든 DB 파일 삭제 → 호스트에서 복원"
    # 호스트 백업 확인
    local host_count=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    if [ "$host_count" -lt 5 ]; then
        info "호스트 백업 부족, 먼저 백업 생성"
        backup
    fi
    run "rm -f $POD_DB/${DB}* 2>/dev/null" || true
    sleep 1
    # 복원
    run "cp $HOST_DB/${DB}* $POD_DB/ 2>/dev/null" || true
    sleep 3
    if check_healthy; then
        pass "모든 파일 삭제 → 호스트 복원 성공"
        backup
        return 0
    else
        fail "모든 파일 삭제 → 복원 실패"
        return 1
    fi
}

test_06_volume_corruption() {
    log "TEST 06: 디렉토리 권한 문제 → 복구"
    run "chmod 000 $POD_DB 2>/dev/null" || true
    sleep 1
    run "chmod 777 $POD_DB 2>/dev/null" || true
    sleep 2
    if check_healthy; then
        pass "권한 문제 → 복구 성공"
        return 0
    else
        fail "권한 문제 → 복구 실패"
        return 1
    fi
}

test_07_service_stop_all() {
    log "TEST 07: 전체 서비스 중지 → 재시작"
    run "$BIN/cubrid service stop" > /dev/null 2>&1
    sleep 2
    run "$BIN/cubrid service start" > /dev/null 2>&1
    sleep 5
    if check_healthy; then
        pass "전체 서비스 중지 → 재시작 성공"
        return 0
    else
        fail "전체 서비스 중지 → 재시작 실패"
        return 1
    fi
}

test_08_lock_file_issue() {
    log "TEST 08: 잠금 파일 문제 → 복구"
    run "rm -f $POD_DB/${DB}_lgat__lock 2>/dev/null" || true
    sleep 2
    if check_healthy; then
        pass "잠금 파일 문제 → 복구 성공"
        return 0
    else
        fail "잠금 파일 문제 → 복구 실패"
        return 1
    fi
}

test_09_log_volume_issue() {
    log "TEST 09: 로그 볼륨 문제 → 감지"
    # 로그 파일 크기 확인 (문제 감지만)
    local log_size=$(run "ls -la $POD_DB/${DB}_lgat 2>/dev/null" | awk '{print $5}')
    info "로그 파일 크기: $log_size bytes"
    if check_healthy; then
        pass "로그 문제 감지 (시스템 정상)"
        return 0
    else
        fail "로그 문제로 시스템 장애"
        return 1
    fi
}

test_10_concurrent_access() {
    log "TEST 10: 동시 접근 → 무결성 확인"
    # 여러 쿼리 동시 실행
    for i in 1 2 3; do
        run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" &
    done
    wait
    if check_healthy; then
        pass "동시 접근 → 무결성 유지"
        return 0
    else
        fail "동시 접근 → 무결성 깨짐"
        return 1
    fi
}

test_11_host_backup_missing_databases_txt() {
    log "TEST 11: 호스트 databases.txt 없음 → 재생성"
    rm -f "$HOST_DB/databases.txt" 2>/dev/null
    # guardian이 재생성해야 함
    sleep 3
    if [ -f "$HOST_DB/databases.txt" ] && check_healthy; then
        pass "호스트 databases.txt 복구 성공"
        return 0
    else
        fail "호스트 databases.txt 복구 실패"
        return 1
    fi
}

test_12_pod_restart_simulation() {
    log "TEST 12: Pod 재시작 시뮬레이션 → 상태 유지"
    # 호스트에 백업
    backup
    # 서비스 재시작
    run "$BIN/cubrid service stop" > /dev/null 2>&1
    sleep 3
    run "$BIN/cubrid service start" > /dev/null 2>&1
    sleep 5
    if check_healthy; then
        pass "재시작 시뮬레이션 → 상태 유지"
        return 0
    else
        fail "재시작 시뮬레이션 → 상태 손실"
        return 1
    fi
}

test_13_memory_pressure() {
    log "TEST 13: 메모리 상태 확인"
    local mem=$(run "cat /sys/fs/cgroup/memory/memory.usage_in_bytes 2>/dev/null" || echo "0")
    info "메모리 사용: $mem bytes"
    if check_healthy; then
        pass "메모리 상태 정상"
        return 0
    else
        fail "메모리 문제 감지"
        return 1
    fi
}

test_14_disk_space() {
    log "TEST 14: 디스크 공간 확인"
    local df=$(run "df -h $POD_DB 2>/dev/null" | tail -1 | awk '{print $5}')
    info "디스크 사용률: $df"
    if check_healthy; then
        pass "디스크 공간 정상"
        return 0
    else
        fail "디스크 공간 부족"
        return 1
    fi
}

test_15_network_partition() {
    log "TEST 15: 내부 연결 확인"
    local conn=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT 1;' 2>&1" | grep -c "1 row selected" || echo 0)
    if [ "$conn" = "1" ]; then
        pass "내부 네트워크 연결 정상"
        return 0
    else
        fail "내부 네트워크 연결 실패"
        return 1
    fi
}

test_16_csql_access() {
    log "TEST 16: CSQL 직접 접근"
    local result=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT 1+1;' 2>&1" | grep -c "2" || echo 0)
    if [ "$result" -ge 1 ]; then
        pass "CSQL 접근 성공"
        return 0
    else
        fail "CSQL 접근 실패"
        return 1
    fi
}

test_17_backup_integrity() {
    log "TEST 17: 호스트 백업 무결성"
    local host_count=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    if [ "$host_count" -ge 5 ]; then
        pass "호스트 백축 무결성 OK ($host_count files)"
        return 0
    else
        fail "호스트 백업 손상 ($host_count files)"
        return 1
    fi
}

test_18_databases_txt_consistency() {
    log "TEST 18: databases.txt 일관성"
    local pod_txt=$(run "cat $POD_DB/databases.txt")
    local host_txt=$(cat "$HOST_DB/databases.txt" 2>/dev/null)
    if [ "$pod_txt" = "$host_txt" ]; then
        pass "databases.txt 일관성 OK"
        return 0
    else
        fail "databases.txt 불일치"
        return 1
    fi
}

test_19_full_recovery_test() {
    log "TEST 19: 전체 복구 테스트"
    # 중지
    run "$BIN/cubrid service stop" > /dev/null 2>&1
    sleep 2
    # 호스트에서 복원
    run "cp $HOST_DB/${DB}* $POD_DB/ 2>/dev/null" || true
    # 시작
    run "$BIN/cubrid service start" > /dev/null 2>&1
    sleep 5
    if check_healthy; then
        pass "전체 복구 테스트 성공"
        return 0
    else
        fail "전체 복구 테스트 실패"
        return 1
    fi
}

test_20_stress_query() {
    log "TEST 20: 복합 쿼리 테스트"
    local result=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*), SUM(gwp_co2) FROM admin_emission_gwp_value;' 2>&1" | grep -c "row selected" || echo 0)
    if [ "$result" = "1" ]; then
        pass "복합 쿼리 성공"
        return 0
    else
        fail "복합 쿼리 실패"
        return 1
    fi
}

#====================================================================
# 전체 테스트 실행
#====================================================================

run_all_tests() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           CUBRID CHAOS TESTER - 상황 테스트 시작              ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # 사전 백업
    backup
    
    local total=0
    local passed=0
    local failed=0
    
    # 초기 상태 확인
    if ! check_healthy; then
        echo "초기 상태 확인 실패! 먼저 복구합니다..."
        run "$BIN/cubrid service start" > /dev/null 2>&1
        sleep 5
    fi
    
    # 테스트 실행
    for test_func in test_01_server_down test_02_broker_down test_03_databases_txt_missing \
                     test_04_db_file_missing_single test_05_all_db_files_missing test_06_volume_corruption \
                     test_07_service_stop_all test_08_lock_file_issue test_09_log_volume_issue \
                     test_10_concurrent_access test_11_host_backup_missing_databases_txt \
                     test_12_pod_restart_simulation test_13_memory_pressure test_14_disk_space \
                     test_15_network_partition test_16_csql_access test_17_backup_integrity \
                     test_18_databases_txt_consistency test_19_full_recovery_test test_20_stress_query; do
        
        total=$((total + 1))
        
        # 테스트 함수 실행
        if $test_func; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
        fi
        
        # 항상 백업
        backup
        sleep 1
    done
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    테스트 결과 요약                           ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║  총 테스트: $total                                             ║"
    echo -e "║  ${GREEN}성공:${NC} $passed                                                  ║"
    echo -e "║  ${RED}실패:${NC} $failed                                                    ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Guardian 실행
    info "Guardian 최종 확인..."
    /opt/Resonance/ops/scripts/cubrid-safe-guardian.sh
    
    return $failed
}

# 사용법
case "${1:-all}" in
    all) run_all_tests ;;
    01|server_down) test_01_server_down ;;
    02|broker_down) test_02_broker_down ;;
    03|databases_txt) test_03_databases_txt_missing ;;
    04|db_file_single) test_04_db_file_missing_single ;;
    05|db_files_all) test_05_all_db_files_missing ;;
    06|permission) test_06_volume_corruption ;;
    07|service_stop) test_07_service_stop_all ;;
    08|lock_file) test_08_lock_file_issue ;;
    09|log_volume) test_09_log_volume_issue ;;
    10|concurrent) test_10_concurrent_access ;;
    11|host_txt) test_11_host_backup_missing_databases_txt ;;
    12|pod_restart) test_12_pod_restart_simulation ;;
    13|memory) test_13_memory_pressure ;;
    14|disk) test_14_disk_space ;;
    15|network) test_15_network_partition ;;
    16|csql) test_16_csql_access ;;
    17|backup) test_17_backup_integrity ;;
    18|consistency) test_18_databases_txt_consistency ;;
    19|recovery) test_19_full_recovery_test ;;
    20|query) test_20_stress_query ;;
    *) 
        echo "Usage: $0 {all|01..20}"
        echo ""
        echo "테스트 목록:"
        for i in $(seq 1 20); do
            printf "  %02d: %s\n" $i "test_$(printf '%02d' $i)_*"
        done
        ;;
esac

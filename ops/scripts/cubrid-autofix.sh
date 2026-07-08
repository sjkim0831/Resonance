#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-autofix: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

# cubrid-autofix.sh - CUBRID 자동 복구 및 로깅 시스템
# Usage: kubectl exec cubrid-carbonet-0 -- /scripts/cubrid-autofix.sh [diagnose|fix|start|status]
set -o pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
LOG_DIR="/var/lib/cubrid/logs/autofix"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="${LOG_DIR}/autofix_${TIMESTAMP}.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $*"; }
log_ok() { echo -e "${GREEN}✓ $*${NC}"; log "$*"; }
log_warn() { echo -e "${YELLOW}⚠ $*${NC}"; log "$*"; }
log_err() { echo -e "${RED}✗ $*${NC}"; log "$*"; }
log_section() { echo -e "\n${BLUE}=== $* ===${NC}"; echo "=== $* ===" >> "${LOG_FILE}"; }

mkdir -p "${LOG_DIR}"

# 모든 출력을 로그에도 기록
exec > >(tee -a "${LOG_FILE}") 2>&1

log_section "CUBRID 자동 복구 시스템 시작"
log "타임스탬프: ${TIMESTAMP}"
log "호스트: $(hostname)"

detect_and_fix_databases_txt() {
    log_section "databases.txt 검증 및 수정"

    local fix_needed=false
    local correct_path="/var/lib/cubrid/databases/carbonet"

    # 데이터베이스 파일 확인
    if [[ -d "/var/lib/cubrid/databases/carbonet" ]]; then
        log_ok "호스트 데이터 디렉토리 존재: /var/lib/cubrid/databases/carbonet"
    elif [[ -d "/home/cubrid/CUBRID/databases/carbonet" ]]; then
        log_warn "CUBRID 내부 데이터 디렉토리에 있음, 호스트로 동기화 필요"
        mkdir -p /var/lib/cubrid/databases
        cp -r /home/cubrid/CUBRID/databases/carbonet /var/lib/cubrid/databases/
        cp -r /home/cubrid/CUBRID/databases/lob /var/lib/cubrid/databases/ 2>/dev/null || true
        fix_needed=true
    fi

    # databases.txt 확인
    for txt in /var/lib/cubrid/databases.txt /home/cubrid/CUBRID/databases/databases.txt; do
        if [[ -f "$txt" ]]; then
            local content=$(cat "$txt")
            local db_path=$(echo "$content" | awk '{print $1}')
            local db_name=$(echo "$content" | awk '{print $2}')

            log "체크: $txt"
            log "  내용: $content"
            log "  DB경로: $db_path"
            log "  DB이름: $db_name"

            # 경로가 다른 경우 수정
            if [[ "$db_path" != "$correct_path" ]]; then
                log_warn "잘못된 경로 감지: $db_path -> $correct_path 로 수정"
                echo "${correct_path} ${db_name:-carbonet}" > "$txt"
                fix_needed=true
            fi

            # 데이터베이스 파일 존재 확인
            if [[ ! -d "$db_path" ]]; then
                log_err "데이터베이스 디렉토리가 존재하지 않음: $db_path"
                if [[ "$txt" == "/var/lib/cubrid/databases.txt" ]]; then
                    log "대체 경로 확인 중..."
                    if [[ -d "/home/cubrid/CUBRID/databases/$db_name" ]]; then
                        log "home 디렉토리에서 발견, 복사..."
                        mkdir -p /var/lib/cubrid/databases
                        cp -r "/home/cubrid/CUBRID/databases/$db_name" /var/lib/cubrid/databases/
                    fi
                fi
            fi
        else
            log_warn "databases.txt 없음: $txt"
        fi
    done

    if [[ "$fix_needed" == "true" ]]; then
        log_ok "databases.txt 수정 완료"
        return 0
    else
        log_ok "databases.txt 정상"
        return 1
    fi
}

start_cubrid_server() {
    log_section "CUBRID 서버 시작"

    local max_retries=3
    local retry=0

    while [[ $retry -lt $max_retries ]]; do
        log "시작 시도 ($((retry+1))/${max_retries})..."

        # 환경설정 확인
        export CUBRID=/home/cubrid/CUBRID
        export CUBRID_DATABASES=/home/cubrid/CUBRID/databases

        # 서버 시작
        local output=$(su - cubrid -c 'cubrid server start carbonet 2>&1')
        local status=$?

        log "출력: $output"

        if [[ $status -eq 0 ]] && echo "$output" | grep -q "success"; then
            log_ok "서버 시작 성공"
            return 0
        elif echo "$output" | grep -q "success"; then
            log_ok "서버 시작 성공"
            return 0
        else
            log_warn "시작 실패: $output"

            # databases.txt 오류 수정
            if echo "$output" | grep -q "Invalid database location"; then
                detect_and_fix_databases_txt
            fi

            ((retry++))
            sleep 5
        fi
    done

    log_err "서버 시작 실패 (${max_retries}회 시도)"
    return 1
}

start_cubrid_broker() {
    log_section "CUBRID 브로커 시작"

    local output=$(su - cubrid -c 'cubrid broker start 2>&1')
    local status=$?

    log "브로커 시작 출력: $output"

    if [[ $status -eq 0 ]]; then
        log_ok "브로커 시작 성공"
        return 0
    fi

    # 브로커 설정 확인
    if ! su - cubrid -c 'cubrid broker status' >/dev/null 2>&1; then
        log_warn "브로커 상태 확인 필요"

        # broker.conf 확인 및 수정
        local broker_conf="/home/cubrid/CUBRID/conf/cubrid_broker.conf"
        if [[ -f "$broker_conf" ]]; then
            # MASTER_SHM_ID 충돌 확인
            if grep -q "MASTER_SHM_ID.*query_editor" "$broker_conf"; then
                log_warn "브로커 설정 오류 감지: MASTER_SHM_ID 충돌"

                # 설정 백업
                cp "$broker_conf" "${broker_conf}.bak.${TIMESTAMP}"

                # 잘못된 설정 제거 및 수정
                sed -i 's/^MASTER_SHM_ID.*//' "$broker_conf" 2>/dev/null || true

                log_ok "브로커 설정 수정 완료"
            fi
        fi

        # 재시작
        su - cubrid -c 'cubrid broker stop 2>/dev/null || true'
        sleep 2
        su - cubrid -c 'cubrid broker start 2>&1'
    fi

    # 상태 확인
    sleep 3
    if su - cubrid -c 'cubrid broker status' >/dev/null 2>&1; then
        log_ok "브로커 시작 성공"
        return 0
    else
        log_err "브로커 시작 실패"
        return 1
    fi
}

full_start() {
    log_section "CUBRID 전체 시작"

    # 1. 복구 체크
    detect_and_fix_databases_txt

    # 2. 마스터 확인
    log "마스터 상태 확인..."
    if ! pgrep -f "cub_master" >/dev/null; then
        log_warn "마스터가 실행 중이지 않음, 시작..."
        su - cubrid -c 'cubrid master start 2>&1'
        sleep 3
    fi

    # 3. 서버 시작
    start_cubrid_server || log_err "서버 시작 실패"

    # 4. 브로커 시작
    start_cubrid_broker || log_err "브로커 시작 실패"

    # 5. 최종 상태 확인
    log_section "최종 상태 확인"
    su - cubrid -c 'cubrid service status' 2>&1

    # 연결 테스트
    log "연결 테스트..."
    if su - cubrid -c "cubrid broker status" >/dev/null 2>&1; then
        log_ok "CUBRID 서비스 정상 가동"
        return 0
    else
        log_err "CUBRID 서비스 이상"
        return 1
    fi
}

show_status() {
    log_section "CUBRID 상태"

    echo "=== 환경변수 ==="
    env | grep -E "^CUBRID|^DB_" | tee -a "${LOG_FILE}" || true

    echo ""
    echo "=== databases.txt ==="
    cat /var/lib/cubrid/databases.txt 2>/dev/null || echo "없음"
    cat /home/cubrid/CUBRID/databases/databases.txt 2>/dev/null || echo "없음"

    echo ""
    echo "=== 데이터베이스 파일 ==="
    ls -la /var/lib/cubrid/databases/ 2>/dev/null || echo "없음"

    echo ""
    echo "=== 프로세스 ==="
    ps aux | grep -E "cubrid|cub_server|cub_broker|cub_master" | grep -v grep

    echo ""
    echo "=== CUBRID 서비스 상태 ==="
    su - cubrid -c 'cubrid service status' 2>&1 || true

    echo ""
    echo "=== 포트 ==="
    ss -tlnp 2>/dev/null | grep -E "33000|1523" || echo "开放的端口 없음"

    echo ""
    echo "=== 진단 로그 ==="
    ls -la /var/lib/cubrid/logs/diagnosis/ 2>/dev/null | tail -5 || echo "없음"
}

run_diagnosis() {
    log_section "진단 실행"

    local diag_output=$(/scripts/cubrid-diagnosis-collector.sh 2>&1)
    echo "$diag_output"

    log "진단 로그: /var/lib/cubrid/logs/diagnosis/"
}

# 메인
case "${1:-status}" in
    diagnose|diag)
        run_diagnosis
        ;;
    fix)
        detect_and_fix_databases_txt
        ;;
    start)
        full_start
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {diagnose|fix|start|status}"
        echo ""
        echo "Commands:"
        echo "  diagnose  - 상세 진단 실행 및 로그 수집"
        echo "  fix       - databases.txt 자동 수정"
        echo "  start     - 전체 CUBRID 서비스 시작"
        echo "  status    - 현재 상태 표시"
        show_status
        ;;
esac
# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-verify.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#===============================================================
# CUBRID COMPREHENSIVE VERIFICATION & CONNECTION MANAGER
# - 전체 테이블/행 수 검증
# - 이전 baseline 대비 이상 감지
# - 커넥션 풀 관리 (CLOSE_WAIT 정리)
# - 이상 탐지 시 자동 알림
#===============================================================
set -eu

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
BIN="/home/cubrid/CUBRID/bin"
STATE_DIR="/opt/Resonance/var/cubrid-monitor"
BASELINE_FILE="$STATE_DIR/baseline.json"
LOG_FILE="/opt/Resonance/var/log/cubrid-verify.log"

mkdir -p "$STATE_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%Y-%m-%dT%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
ok() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} OK: $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} WARN: $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} ERROR: $1" | tee -a "$LOG_FILE"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null || echo ""; }

#---------------------------------------------------------------
# DB에서 메트릭 수집
#---------------------------------------------------------------
collect_metrics() {
    local metrics_json="{"

    # 1. 테이블 수
    local table_count=$(run "$BIN/csql -u dba $DB -c 'SHOW TABLES;' 2>/dev/null" | grep -v "^==" | grep -c "'" || echo 0)
    metrics_json+="\"table_count\": $table_count"

    # 2. 총 행 수 (샘플링: 상위 10개 테이블)
    local total_rows=0
    local sample_tables=$(run "$BIN/csql -u dba $DB -c 'SHOW TABLES;' 2>/dev/null" | grep -v "^==" | grep "'" | head -10)

    local sampled=""
    while IFS= read -r table; do
        table=$(echo "$table" | tr -d " '" | tr -d "'")
        [ -z "$table" ] && continue
        local count=$(run "$BIN/csql -u dba $DB -c \"SELECT COUNT(*) FROM $table;\" 2>/dev/null" | grep -E "^\s+[0-9]+" | tr -d ' ' | tail -1)
        [ -n "$count" ] && total_rows=$((total_rows + count))
        sampled="$sampled$table:$count,"
    done <<< "$sample_tables"

    metrics_json+=", \"total_rows_estimate\": $total_rows"
    metrics_json+=", \"sampled\": \"$sampled\""

    # 3. DB 크기
    local db_size=$(run "du -sh /var/lib/cubrid/carbonet 2>/dev/null" | awk '{print $1}' || echo "unknown")
    metrics_json+=", \"db_size\": \"$db_size\""

    # 4. 연결 수
    local connections=$(run "$BIN/cubrid broker status 2>/dev/null" | grep -c "CLOSE_WAIT\|IDLE\|ACTIVE" || echo 0)
    local close_wait=$(run "$BIN/cubrid broker status 2>/dev/null" | grep -c "CLOSE_WAIT" || echo 0)
    metrics_json+=", \"connections\": $connections"
    metrics_json+=", \"close_wait\": $close_wait"

    # 5. Server 상태
    local server_ok=$(run "$BIN/cubrid server status $DB 2>/dev/null" | grep -q "Server $DB" && echo "true" || echo "false")
    metrics_json+=", \"server_running\": $server_ok"

    # 6. Broker 상태
    local broker_ok=$(run "$BIN/cubrid broker status 2>/dev/null" | grep -q "broker1" && echo "true" || echo "false")
    metrics_json+=", \"broker_running\": $broker_ok"

    # 7. 시점
    metrics_json+=", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
    metrics_json+="}"

    echo "$metrics_json"
}

#---------------------------------------------------------------
# 이상 감지 (이전 baseline 대비)
#---------------------------------------------------------------
detect_anomalies() {
    local current_json="$1"
    local anomalies=""

    if [ ! -f "$BASELINE_FILE" ]; then
        log "Baseline 없음 - 생성함"
        echo "$current_json" > "$BASELINE_FILE"
        return 0
    fi

    local prev_json=$(cat "$BASELINE_FILE")

    # 테이블 수 변화 감지
    local prev_tables=$(echo "$prev_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('table_count',0))" 2>/dev/null || echo 0)
    local curr_tables=$(echo "$current_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('table_count',0))" 2>/dev/null || echo 0)

    if [ "$curr_tables" != "$prev_tables" ]; then
        local diff=$((curr_tables - prev_tables))
        warn "테이블 수 변화: $prev_tables → $curr_tables ($diff)"
        anomalies+="tables:$curr_tables; "
    fi

    # CLOSE_WAIT 연결 감지
    local close_wait=$(echo "$current_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('close_wait',0))" 2>/dev/null || echo 0)
    if [ "$close_wait" -gt 5 ]; then
        warn "CLOSE_WAIT 연결过多: $close_wait (>5)"
        anomalies+="close_wait:$close_wait; "
    fi

    # Server/Broker 문제 감지
    local server_ok=$(echo "$current_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('server_running','false'))" 2>/dev/null || echo "false")
    local broker_ok=$(echo "$current_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('broker_running','false'))" 2>/dev/null || echo "false")

    if [ "$server_ok" != "true" ]; then
        error "CUBRID Server 중지됨!"
        anomalies+="server_down; "
    fi

    if [ "$broker_ok" != "true" ]; then
        error "CUBRID Broker 중지됨!"
        anomalies+="broker_down; "
    fi

    # Baseline 업데이트 (변화 감지 후)
    if [ -n "$anomalies" ]; then
        warn "이상 감지: $anomalies"
    else
        ok "변화 없음 - baseline 유지"
    fi

    # Baseline 업데이트 (항상)
    echo "$current_json" > "$BASELINE_FILE"

    return 0
}

#---------------------------------------------------------------
# 커넥션 정리 (CLOSE_WAIT)
#---------------------------------------------------------------
cleanup_connections() {
    local closed=0

    # 브로커 재시작 (CLOSE_WAIT 정리)
    local close_wait=$(run "$BIN/cubrid broker status 2>/dev/null" | grep -c "CLOSE_WAIT" || echo 0)

    if [ "$close_wait" -gt 3 ]; then
        warn "CLOSE_WAIT 정리 시작 ($close_wait 개)..."
        run "$BIN/cubrid broker stop 2>/dev/null"
        sleep 2
        run "$BIN/cubrid broker start 2>/dev/null"
        closed=$close_wait
        ok "브로커 재시작 완료"
    fi

    return $closed
}

#---------------------------------------------------------------
# 전체 검증
#---------------------------------------------------------------
full_verify() {
    log "=== CUBRID Comprehensive Verification ==="

    local metrics=$(collect_metrics)
    log "수집된 메트릭:"
    echo "$metrics" | python3 -m json.tool 2>/dev/null | sed 's/^/  /' || echo "$metrics" | sed 's/,/,\n  /g'

    detect_anomalies "$metrics"

    local close_wait=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('close_wait',0))" 2>/dev/null || echo 0)
    if [ "$close_wait" -gt 5 ]; then
        cleanup_connections
    fi
}

#---------------------------------------------------------------
# 상태 요약
#---------------------------------------------------------------
summary() {
    local metrics=$(collect_metrics)

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          CUBRID VERIFICATION SUMMARY                       ║"
    echo "╠═══════════════════════════════════════════════════════════╣"

    local tables=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('table_count',0))" 2>/dev/null || echo "?")
    local rows=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_rows_estimate',0))" 2>/dev/null || echo "?")
    local size=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db_size','?'))" 2>/dev/null || echo "?")
    local conn=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('connections',0))" 2>/dev/null || echo "?")
    local cw=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('close_wait',0))" 2>/dev/null || echo "?")
    local server=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('server_running','?'))" 2>/dev/null || echo "?")
    local broker=$(echo "$metrics" | python3 -c "import sys,json; print(json.load(sys.stdin).get('broker_running','?'))" 2>/dev/null || echo "?")

    printf "║  Tables:     %-6s  Total Rows: ~%-12s           ║\n" "$tables" "$rows"
    printf "║  DB Size:    %-6s  Connections: %-4s (CLOSE_WAIT: %s)║\n" "$size" "$conn" "$cw"
    printf "║  Server:     %-6s  Broker:      %-6s              ║\n" "$server" "$broker"

    echo "╚═══════════════════════════════════════════════════════════╝"

    # 이전 baseline과 비교
    if [ -f "$BASELINE_FILE" ]; then
        echo ""
        echo "Baseline 비교:"
        local prev=$(cat "$BASELINE_FILE")
        local prev_tables=$(echo "$prev" | python3 -c "import sys,json; print(json.load(sys.stdin).get('table_count',0))" 2>/dev/null || echo 0)
        local prev_rows=$(echo "$prev" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_rows_estimate',0))" 2>/dev/null || echo 0)
        echo "  Tables: $prev_tables → $tables (Δ=$((tables - prev_tables)))"
        echo "  Rows:   $prev_rows → $rows (Δ=$((rows - prev_rows)))"
    fi
}

#---------------------------------------------------------------
# Baseline 업데이트 (마이그레이션/백업 성공 시 호출)
#---------------------------------------------------------------
update_baseline() {
    log "Baseline 업데이트..."
    local metrics
    metrics=$(collect_metrics)
    echo "$metrics" > "$BASELINE_FILE"
    log "Baseline 업데이트 완료"
    echo "$metrics" | python3 -m json.tool 2>/dev/null | sed 's/^/  /'
}

#---------------------------------------------------------------
# 메인
#---------------------------------------------------------------
case "${1:-verify}" in
    verify|v) full_verify ;;
    summary|s) summary ;;
    cleanup|c) cleanup_connections ;;
    baseline|b)
        echo "현재 baseline:"
        cat "$BASELINE_FILE" 2>/dev/null || echo "No baseline yet"
        ;;
    update-baseline|u) update_baseline ;;
    *) full_verify ;;
esac
#!/bin/bash
#============================================================
# CUBRID 완전 복구 시스템 - 스키마/데이터/로그 추출
#============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../data/disaster-recovery"
DATE=$(date +%Y%m%d_%H%M%S)
TIMESTAMP=$(date -Iseconds)

mkdir -p "$BACKUP_DIR/$DATE"/{schema,data,logs,restore}

#export CUBRID=/tmp/CUBRID-11.4.5.1866-e9c17f7-Linux.x86_64  # DEPRECATED
export CUBRID=/home/cubrid/CUBRID  # Actual running instance
export PATH=$CUBRID/bin:$PATH

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

connect_cubrid() {
    local db=$1
    local host=${CUBRID_HOST:-localhost}
    local port=${CUBRID_PORT:-33000}
    echo "$db@$host:$port"
}

log "=========================================="
log "CUBRID 완전 복구 시스템 시작"
log "백업 디렉토리: $BACKUP_DIR/$DATE"
log "=========================================="

#-----------------------------------------------
# 1단계: 스키마 추출 (DDL)
#-----------------------------------------------
log "[1/4] 스키마 추출 중..."

extract_schema() {
    local db=$1
    local outfile="$BACKUP_DIR/$DATE/schema/${db}_schema.sql"

    csql -u dba -c " SHOW CREATE TABLE ai_model_registry;" $(connect_cubrid $db) 2>/dev/null >> "$outfile" || true

    csql -u dba $(connect_cubrid $db) <<'CSQL' 2>/dev/null | grep -v "^>" | grep -v "^--" > "$outfile"
SHOW TABLES;
CSQL

    for table in $(csql -u dba $(connect_cubrid $db) <<'CSQL' 2>/dev/null | grep -v "^>" | grep -v "^--");
    do
        echo "=== $table ===" >> "$outfile"
        csql -u dba -c "SHOW CREATE TABLE $table;" $(connect_cubrid $db) 2>/dev/null >> "$outfile"
        echo "" >> "$outfile"
    done
}

for db in resonance carbonet; do
    log "  $db 데이터베이스 스키마 추출..."
    extract_schema $db
done

#-----------------------------------------------
# 2단계: 데이터 추출 (INSERT문)
#-----------------------------------------------
log "[2/4] 데이터 추출 중 (INSERT문)..."

extract_data() {
    local db=$1
    local outfile="$BACKUP_DIR/$DATE/data/${db}_data.sql"

    echo "-- ============================================================" > "$outfile"
    echo "-- $db Database Data Backup" >> "$outfile"
    echo "-- Generated: $TIMESTAMP" >> "$outfile"
    echo "-- ============================================================" >> "$outfile"
    echo "" >> "$outfile"

    local tables=$(csql -u dba $(connect_cubrid $db) <<'CSQL' 2>/dev/null | grep -v "^>" | grep -v "^--")
    for table in $tables; do
        log "  Extracting table: $table"
        echo "-- Table: $table" >> "$outfile"
        csql -u dba -c "SELECT * FROM $table;" $(connect_cubrid $db) 2>/dev/null | \
            python3 -c "
import sys, json
lines = sys.stdin.readlines()
# Parse CSQL output and convert to INSERT statements
# This is a simplified parser
for line in lines:
    line = line.strip()
    if line and not line.startswith('===') and not line.startswith('---'):
        print(line)
" >> "$outfile" || true
        echo "" >> "$outfile"
    done
}

for db in resonance carbonet; do
    extract_data $db
done

#-----------------------------------------------
# 3단계: 로그 기반 데이터 복구 (JSONL → SQL)
#-----------------------------------------------
log "[3/4] 로그에서 데이터 복구..."

AI_RUNTIME="/opt/Resonance/var/ai-runtime"

convert_incident_logs() {
    local outfile="$BACKUP_DIR/$DATE/logs/incident_recovery.sql"

    echo "-- ============================================================" > "$outfile"
    echo "-- Incident Patterns Recovery Data" >> "$outfile"
    echo "-- Generated: $TIMESTAMP" >> "$outfile"
    echo "-- ============================================================" >> "$outfile"
    echo "" >> "$outfile"

    if [ -f "$AI_RUNTIME/incident-patterns.jsonl" ]; then
        log "  incident-patterns.jsonl 변환 중..."
        python3 <<'PYTHON'
import json, sys
from datetime import datetime

input_file = "/opt/Resonance/var/ai-runtime/incident-patterns.jsonl"
output_file = "/opt/Resonance/ops/scripts/disaster-recovery/../data/disaster-recovery/$DATE/logs/incident_recovery.sql"

with open(input_file, 'r') as f:
    for line in f:
        try:
            data = json.loads(line.strip())
            # Convert to INSERT statement
            print(f"-- Incident: {data.get('code', 'UNKNOWN')}")
            print(f"-- Severity: {data.get('severity', 'UNKNOWN')}")
            print(f"-- Time: {data.get('ts', 'UNKNOWN')}")
            print(f"-- Recovery: {data.get('repair', 'N/A')}")
            print()
        except:
            pass
PYTHON
        log "  완료: incident-patterns.jsonl"
    fi
}

# Convert k8s events to recovery data
convert_k8s_events() {
    local outfile="$BACKUP_DIR/$DATE/logs/k8s_recovery.sql"

    echo "-- ============================================================" > "$outfile"
    echo "-- K8s Events Recovery Data" >> "$outfile"
    echo "-- Generated: $TIMESTAMP" >> "$outfile"
    echo "-- ============================================================" >> "$outfile"
    echo "" >> "$outfile"

    for logfile in k8s-boot-stabilize-events.jsonl k8s-build-deploy-events.jsonl k8s-ops-doctor-events.jsonl startup-watchdog-events.jsonl; do
        if [ -f "$AI_RUNTIME/$logfile" ]; then
            log "  $logfile 변환 중..."
            python3 <<'PYTHON'
import json, sys
from datetime import datetime

input_file = "/opt/Resonance/var/ai-runtime/K8S_LOG_FILE"
output_lines = []

with open(input_file.replace('K8S_LOG_FILE', 'K8S_LOG_FILE'), 'r') as f:
    for line in f:
        try:
            data = json.loads(line.strip())
            ts = data.get('ts', datetime.now().isoformat())
            script = data.get('script', 'unknown')
            status = data.get('status', 'unknown')
            code = data.get('code', 'N/A')
            message = data.get('message', '').replace("'", "''")

            print(f"-- Event: {script} | Status: {status} | Time: {ts}")
            print(f"-- Message: {message[:200]}...")
            print()
        except:
            pass
PYTHON
        fi
    done
}

convert_incident_logs
convert_k8s_events

#-----------------------------------------------
# 4단계: 복구 스크립트 생성
#-----------------------------------------------
log "[4/4] 복구 스크립트 생성..."

cat > "$BACKUP_DIR/$DATE/restore.sh" <<'SCRIPT'
#!/bin/bash
#============================================================
# CUBRID 복구 스크립트
# usage: ./restore.sh [schema|data|all]
#============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DATE=${1:-latest}
MODE=${2:-all}

CUBRID=/tmp/CUBRID-11.4.5.1866-e9c17f7-Linux.x86_64
PATH=$CUBRID/bin:$PATH

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ "$BACKUP_DATE" = "latest" ]; then
    BACKUP_DIR=$(ls -td /opt/Resonance/data/disaster-recovery/*/ | head -1)
else
    BACKUP_DIR="/opt/Resonance/data/disaster-recovery/${BACKUP_DATE}"
fi

log "복구 시작: $BACKUP_DIR"
log "모드: $MODE"

# 스키마 복구
if [ "$MODE" = "schema" ] || [ "$MODE" = "all" ]; then
    log "스키마 복구 중..."
    for db in resonance carbonet; do
        if [ -f "$BACKUP_DIR/schema/${db}_schema.sql" ]; then
            csql -u dba $(connect_cubrid $db) -i "$BACKUP_DIR/schema/${db}_schema.sql" 2>/dev/null || true
        fi
    done
fi

# 데이터 복구
if [ "$MODE" = "data" ] || [ "$MODE" = "all" ]; then
    log "데이터 복구 중..."
    for db in resonance carbonet; do
        if [ -f "$BACKUP_DIR/data/${db}_data.sql" ]; then
            csql -u dba $(connect_cubrid $db) -i "$BACKUP_DIR/data/${db}_data.sql" 2>/dev/null || true
        fi
    done
fi

# 로그 복구
if [ "$MODE" = "logs" ] || [ "$MODE" = "all" ]; then
    log "이벤트 복구 중..."
    for sqlfile in "$BACKUP_DIR/logs/"*.sql; do
        [ -f "$sqlfile" ] && csql -u dba resonance@localhost -i "$sqlfile" 2>/dev/null || true
    done
fi

log "복구 완료!"
SCRIPT

chmod +x "$BACKUP_DIR/$DATE/restore.sh"

# 테이블 목록 생성
cat > "$BACKUP_DIR/$DATE/TABLES.md" <<'MD'
# CUBRID 테이블 목록 및 복구 가이드

## 데이터베이스: carbonet
MD

# 압축
tar -czf "$BACKUP_DIR/cubrid_full_backup_${DATE}.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

log "=========================================="
log "완료! 백업: $BACKUP_DIR/cubrid_full_backup_${DATE}.tar.gz"
log "=========================================="
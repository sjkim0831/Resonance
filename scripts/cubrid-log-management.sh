#!/bin/bash
#========================================
# CUBRID Log & Backup Management Script
# 매일 cron으로 실행
#========================================

set -e
NAMESPACE="carbonet-prod"
POD="cubrid-carbonet-0"
CUBRID_DATA="/var/lib/cubrid"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
RETENTION_DAYS=2  # 개발용 로그 2일 후 삭제

log_info() { echo "[INFO] $(date) $1"; }
log_warn() { echo "[WARN] $(date) $1"; }
log_err() { echo "[ERR] $(date) $1"; }

pod_exec() {
    kubectl -n "$NAMESPACE" exec "$POD" -- bash -c "$1" 2>&1
}

# 1. CUBRID 아카이브 로그 삭제 (2일 이상)
cleanup_archive_logs() {
    log_info "아카이브 로그 정리 중..."
    local count=$(pod_exec "find $CUBRID_DATA -name '*.lgar*' -mtime +$RETENTION_DAYS 2>/dev/null | wc -l")
    if [ "$count" -gt 0 ]; then
        pod_exec "find $CUBRID_DATA -name '*.lgar*' -mtime +$RETENTION_DAYS -delete 2>/dev/null"
        log_info "아카이브 로그 $count개 삭제 완료"
    else
        log_info "삭제할 아카이브 로그 없음"
    fi
}

# 2. 백업에서 7일 이상된 것 삭제 (운영 백업은 보존)
cleanup_old_backups() {
    log_info "오래된 백업 정리 중..."
    local backup_dir="$CUBRID_DATA/backup/physical"

    # 오늘 백업 제외, 7일 이상된 백업 삭제
    local old_backups=$(pod_exec "find $backup_dir -maxdepth 1 -type d -mtime +7 ! -name '$(date +%Y%m%d)*' 2>/dev/null")
    if [ -n "$old_backups" ]; then
        for backup in $old_backups; do
            pod_exec "rm -rf $backup" 2>/dev/null && log_info "백업 삭제: $backup" || log_warn "백업 삭제 실패: $backup"
        done
    else
        log_info "삭제할 오래된 백업 없음"
    fi
}

# 3. 디스크 사용량 보고
report_usage() {
    log_info "=== 디스크 사용량 ==="
    pod_exec "df -h $CUBRID_DATA | tail -1"
    log_info "CUBRID 데이터: $(pod_exec "du -sh $CUBRID_DATA 2>/dev/null | cut -f1")"
    log_info "LOB 데이터: $(pod_exec "du -sh $CUBRID_DATA/com/lob 2>/dev/null | cut -f1")"
    log_info "백업: $(pod_exec "du -sh $CUBRID_DATA/backup 2>/dev/null | cut -f1")"
}

# 4. hermes/execution 로그 테이블 정리 (resonance DB)
cleanup_hermes_logs() {
    log_info "Hermes 실행 로그 정리 중..."
    # 30일 이상된 hermes 로그 삭제
    pod_exec "$CUBRID_BIN/csql -C -u dba resonance -c \"
        DELETE FROM hermes_execution_log WHERE action_time < DATE_SUB(NOW(), INTERVAL 30 DAY);
        DELETE FROM hermes_verification_log WHERE action_time < DATE_SUB(NOW(), INTERVAL 30 DAY);
        DELETE FROM hermes_failure_pattern WHERE detected_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    \" 2>/dev/null" || log_warn "Hermes 로그 정리 실패"
}

# 5. ai 트레이스 로그 정리
cleanup_ai_logs() {
    log_info "AI 트레이스 로그 정리 중..."
    pod_exec "$CUBRID_BIN/csql -C -u dba resonance -c \"
        DELETE FROM ai_trace_detail WHERE trace_time < DATE_SUB(NOW(), INTERVAL 7 DAY);
    \" 2>/dev/null" || log_warn "AI 로그 정리 실패"
}

# 메인
main() {
    log_info "=== CUBRID 정리 시작 ==="
    report_usage
    cleanup_archive_logs
    cleanup_old_backups
    cleanup_hermes_logs
    cleanup_ai_logs
    report_usage
    log_info "=== CUBRID 정리 완료 ==="
}

main "$@"
#!/bin/bash
# 17개 세션 병렬 실행 launcher
# 사용법: ./launch-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LAUNCH_LOG="$LOG_DIR/launch-$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "========================================"
echo "병렬 세션 실행 시작"
echo "시각: $(date)"
echo "========================================"

# 17개 세션을 백그라운드로 실행
for i in {0..16}; do
  echo "세션 $i 실행 중..."
  
  (
    "$SCRIPT_DIR/run-parallel.sh" $i >> "$LOG_DIR/session-$i.log" 2>&1
  ) &
  
  # PID 저장
  echo $! >> "$LOG_DIR/pids.txt"
  
  # 부하 방지 위해 1초 대기
  sleep 1
done

echo ""
echo "========================================"
echo "17개 세션 모두 실행됨"
echo "========================================"
echo ""
echo "로그 파일 확인:"
echo "  $LOG_DIR/session-*.log"
echo ""
echo "완료 확인:"
echo "  tail -f $LOG_DIR/session-*.log"
echo ""
echo "PID 목록: $LOG_DIR/pids.txt"
echo "중지하려면: kill \$(cat $LOG_DIR/pids.txt)"

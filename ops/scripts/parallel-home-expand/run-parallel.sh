#!/bin/bash
# 4개 배치를 동시 실행 (병렬)
# Usage: bash run-parallel.sh <KEY_1> <KEY_2> ... <KEY_16>

set -e

if [ $# -lt 16 ]; then
  echo "Error: 16개 API 키가 필요합니다."
  echo "Usage: bash run-parallel.sh <KEY_1> <KEY_2> ... <KEY_16>"
  exit 1
fi

KEYS=("$@")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "===== 4배치 동시 실행 시작 ====="
echo "Keys: ${#KEYS[@]}"
echo "Time: $(date)"
echo ""

# 4개 배치를 동시에 백그라운드 실행
echo "[MASTER] Starting all 4 batches in parallel..."

bash "$SCRIPT_DIR/batch1.sh" "${KEYS[@]}" &
PID1=$!
echo "  Batch 1 started (PID: $PID1)"

bash "$SCRIPT_DIR/batch2.sh" "${KEYS[@]}" &
PID2=$!
echo "  Batch 2 started (PID: $PID2)"

bash "$SCRIPT_DIR/batch3.sh" "${KEYS[@]}" &
PID3=$!
echo "  Batch 3 started (PID: $PID3)"

bash "$SCRIPT_DIR/batch4.sh" "${KEYS[@]}" &
PID4=$!
echo "  Batch 4 started (PID: $PID4)"

echo ""
echo "[MASTER] All 4 batches running in parallel..."
echo "[MASTER] Waiting for completion..."
echo ""

# 모든 배치 완료 대기
wait $PID1 $PID2 $PID3 $PID4

echo ""
echo "========================================"
echo "===== 모든 배치 완료! ====="
echo "종료: $(date)"
echo "========================================"
echo ""
echo "결과 디렉토리:"
echo "  Batch 1: /tmp/batch1-work/"
echo "  Batch 2: /tmp/batch2-work/"  
echo "  Batch 3: /tmp/batch3-work/"
echo "  Batch 4: /tmp/batch4-work/"
echo ""
echo "다음 단계:"
echo "  1. cd /opt/Resonance/projects/carbonet-frontend/source && npm run build"
echo "  2. cd /opt/Resonance && sudo bash ops/scripts/resonance-k8s-build-deploy-80.sh --hot-reload"

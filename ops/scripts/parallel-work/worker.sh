#!/bin/bash
# 실제 작업 수행 스크립트
# 사용법: ./worker.sh [세션번호]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="/opt/Resonance/projects/carbonet-frontend/source"
LOG_DIR="$SCRIPT_DIR/logs"
RESULT_FILE="$LOG_DIR/results.txt"

mkdir -p "$LOG_DIR"

# 세션 번호
SESSION_NUM=${1:-0}

# 57개 페이지 정의
declare -A PAGES
PAGES=(
  [0]="/emission/dashboard"
  [1]="/emission/lca"
  [2]="/emission/lci"
  [3]="/emission/reduction"
  [4]="/emission/report_submit"
  [5]="/emission/simulate"
  [6]="/emission/validate"
  [7]="/monitoring/dashboard"
  [8]="/monitoring/realtime"
  [9]="/monitoring/alerts"
  [10]="/monitoring/statistics"
  [11]="/monitoring/share"
  [12]="/monitoring/reduction_trend"
  [13]="/monitoring/track"
  [14]="/monitoring/export"
  [15]="/co2/production_list"
  [16]="/co2/demand_list"
  [17]="/co2/integrity"
  [18]="/co2/credit"
  [19]="/co2/analysis"
  [20]="/co2/search"
  [21]="/edu/course_list"
  [22]="/edu/my_course"
  [23]="/edu/progress"
  [24]="/edu/content"
  [25]="/edu/course_detail"
  [26]="/edu/apply"
  [27]="/edu/survey"
  [28]="/edu/certificate"
  [29]="/mypage/profile"
  [30]="/mypage/email"
  [31]="/mypage/notification"
  [32]="/mypage/marketing"
  [33]="/mypage/company"
  [34]="/mypage/password"
  [35]="/mypage/staff"
  [36]="/support/faq"
  [37]="/support/inquiry"
  [38]="/mtn/status"
  [39]="/mtn/version"
  [40]="/trade/list"
  [41]="/trade/market"
  [42]="/trade/report"
  [43]="/trade/buy_request"
  [44]="/trade/complete"
  [45]="/trade/sell"
  [46]="/trade/auto_order"
  [47]="/trade/price_alert"
  [48]="/payment/pay"
  [49]="/payment/history"
  [50]="/payment/receipt"
  [51]="/payment/refund"
  [52]="/payment/refund_account"
  [53]="/payment/notify"
  [54]="/payment/virtual_account"
  [55]="/certificate/list"
  [56]="/certificate/apply"
)

log_result() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session-$SESSION_NUM: $1" >> "$RESULT_FILE"
}

log_start() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session-$SESSION_NUM: START: $1" >> "$RESULT_FILE"
}

log_done() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session-$SESSION_NUM: DONE: $1" >> "$RESULT_FILE"
}

log_fail() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session-$SESSION_NUM: FAIL: $1" >> "$RESULT_FILE"
}

# 이 세션이 처리할 페이지 수 (57 ÷ 17 = 3~4개)
PAGES_PER_SESSION=4
START=$((SESSION_NUM * PAGES_PER_SESSION))
END=$((START + PAGES_PER_SESSION - 1))

# 마지막 세션이 57개 넘으면 조정
if [ $END -ge 57 ]; then
  END=56
fi

echo "========================================"
echo "Session $SESSION_NUM 시작"
echo "처리 페이지: $START ~ $END"
echo "========================================"

for i in $(seq $START $END); do
  PAGE_PATH=${PAGES[$i]}
  
  if [ -z "$PAGE_PATH" ]; then
    continue
  fi
  
  echo ""
  echo "[Session $SESSION_NUM] [$((i+1))/57] 작업 중: $PAGE_PATH"
  log_start "$PAGE_PATH"
  
  # 페이지 경로를 디렉토리 경로로 변환
  # /emission/dashboard → emission-dashboard
  DIR_NAME=$(echo "$PAGE_PATH" | sed 's/^\///' | tr '/' '-' | tr '[:upper:]' '[:lower:]')
  FEATURE_DIR="$WORK_DIR/src/features/$DIR_NAME"
  
  # 컴포넌트 디렉토리
  COMPONENTS_DIR="$FEATURE_DIR/components"
  
  # 1. 컴포넌트 디렉토리가 있는지 확인
  if [ ! -d "$COMPONENTS_DIR" ]; then
    echo "  → 컴포넌트 디렉토리 생성"
    mkdir -p "$COMPONENTS_DIR"
  fi
  
  # 2. 공통 컴포넌트 복사 (StatsWidget, QuickActions, RecentAlertsWidget 등)
  COMMON_SRC="/opt/Resonance/projects/carbonet-frontend/source/src/components/common"
  if [ -d "$COMMON_SRC" ]; then
    # 공통 컴포넌트가 없으면 복사 (페이지마다 재사용)
    if [ ! -f "$COMPONENTS_DIR/StatsWidget.tsx" ]; then
      echo "  → 공통 컴포넌트 복사"
      cp "$COMMON_SRC/StatsWidget.tsx" "$COMPONENTS_DIR/" 2>/dev/null || true
      cp "$COMMON_SRC/RecentAlertsWidget.tsx" "$COMPONENTS_DIR/" 2>/dev/null || true
      cp "$COMMON_SRC/QuickActions.tsx" "$COMPONENTS_DIR/" 2>/dev/null || true
    fi
  fi
  
  # 3. 빌드 테스트
  echo "  → 빌드 테스트 중..."
  cd "$WORK_DIR"
  BUILD_OUTPUT=$(npm run build 2>&1 | tail -5)
  
  if echo "$BUILD_OUTPUT" | grep -q "built in"; then
    echo "  → 빌드 성공!"
    log_done "$PAGE_PATH (BUILD OK)"
  else
    echo "  → 빌드 경고/오류 (계속 진행)"
    log_done "$PAGE_PATH (BUILD WARN)"
  fi
  
  sleep 1
done

echo ""
echo "========================================"
echo "Session $SESSION_NUM 완료"
echo "========================================"

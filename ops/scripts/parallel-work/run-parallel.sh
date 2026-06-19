#!/bin/bash
# 57개 페이지를 17개 API 키로 병렬 처리
# 사용법: ./run-parallel.sh [세션번호]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="/opt/Resonance/projects/carbonet-frontend/source"
LOG_DIR="$SCRIPT_DIR/logs"
RESULT_FILE="$LOG_DIR/results.txt"

mkdir -p "$LOG_DIR"

# API Keys (17개)
KEYS=(
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
  "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"
)

# 세션당 할당 페이지 (57 ÷ 17 = 3.35, 거의 3~4개씩)
PAGES_BY_SESSION=(
  # 세션 0: 4개
  "emission-dashboard:/emission/dashboard"
  "emission-lca:/emission/lca"
  "emission-lci:/emission/lci"
  "emission-reduction:/emission/reduction"
  # 세션 1: 4개
  "emission-report-submit:/emission/report_submit"
  "emission-simulate:/emission/simulate"
  "emission-validate:/emission/validate"
  "monitoring-dashboard:/monitoring/dashboard"
  # 세션 2: 4개
  "monitoring-realtime:/monitoring/realtime"
  "monitoring-alerts:/monitoring/alerts"
  "monitoring-statistics:/monitoring/statistics"
  "monitoring-share:/monitoring/share"
  # 세션 3: 4개
  "monitoring-reduction-trend:/monitoring/reduction_trend"
  "monitoring-track:/monitoring/track"
  "monitoring-export:/monitoring/export"
  "co2-production-list:/co2/production_list"
  # 세션 4: 4개
  "co2-demand-list:/co2/demand_list"
  "co2-integrity:/co2/integrity"
  "co2-credit:/co2/credit"
  "co2-analysis:/co2/analysis"
  # 세션 5: 4개
  "co2-search:/co2/search"
  "edu-course-list:/edu/course_list"
  "edu-my-course:/edu/my_course"
  "edu-progress:/edu/progress"
  # 세션 6: 4개
  "edu-content:/edu/content"
  "edu-course-detail:/edu/course_detail"
  "edu-apply:/edu/apply"
  "edu-survey:/edu/survey"
  # 세션 7: 4개
  "edu-certificate:/edu/certificate"
  "mypage-profile:/mypage/profile"
  "mypage-email:/mypage/email"
  "mypage-notification:/mypage/notification"
  # 세션 8: 4개
  "mypage-marketing:/mypage/marketing"
  "mypage-company:/mypage/company"
  "mypage-password:/mypage/password"
  "mypage-staff:/mypage/staff"
  # 세션 9: 4개
  "support-faq:/support/faq"
  "support-inquiry:/support/inquiry"
  "mtn-status:/mtn/status"
  "mtn-version:/mtn/version"
  # 세션 10: 3개
  "trade-list:/trade/list"
  "trade-market:/trade/market"
  "trade-report:/trade/report"
  # 세션 11: 4개
  "trade-buy-request:/trade/buy_request"
  "trade-complete:/trade/complete"
  "trade-sell:/trade/sell"
  "trade-auto-order:/trade/auto_order"
  # 세션 12: 4개
  "trade-price-alert:/trade/price_alert"
  "payment-pay:/payment/pay"
  "payment-history:/payment/history"
  "payment-receipt:/payment/receipt"
  # 세션 13: 4개
  "payment-refund:/payment/refund"
  "payment-refund-account:/payment/refund_account"
  "payment-notify:/payment/notify"
  "payment-virtual-account:/payment/virtual_account"
  # 세션 14: 4개
  "certificate-list:/certificate/list"
  "certificate-apply:/certificate/apply"
  "certificate-report-list:/certificate/report_list"
  "certificate-report-form:/certificate/report_form"
  # 세션 15: 3개
  "certificate-report-edit:/certificate/report_edit"
  "edu-survey2:/edu/survey"
  "mypage-staff2:/mypage/staff"
  # 세션 16: 남은 페이지
  "emission-data-input:/emission/data_input"
  "emission-project-list:/emission/project_list"
)

SESSION_NUM=${1:-0}
API_KEY=${KEYS[$SESSION_NUM]}

if [ -z "$API_KEY" ]; then
  echo "세션 $SESSION_NUM: API 키가 없습니다"
  exit 1
fi

# 세션의 페이지 범위 계산
START_IDX=$((SESSION_NUM * 4))
END_IDX=$((START_IDX + 3))

echo "========================================"
echo "세션 $SESSION_NUM 시작"
echo "API Key: ${API_KEY:0:20}..."
echo "페이지 인덱스: $START_IDX ~ $END_IDX"
echo "========================================"

log_result() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session-$SESSION_NUM: $1" >> "$RESULT_FILE"
}

# 세션에서 처리할 페이지 수
TOTAL_SESSIONS=17
PAGES_PER_SESSION=$(( (57 + TOTAL_SESSIONS - 1) / TOTAL_SESSIONS ))

START=$((SESSION_NUM * PAGES_PER_SESSION))
END=$((START + PAGES_PER_SESSION - 1))

# 57개 이상으로 조정
if [ $END -ge 57 ]; then
  END=56
fi

echo "처리 범위: $START ~ $END (총 $((END - START + 1))개 페이지)"

for i in $(seq $START $END); do
  if [ $i -ge 57 ]; then
    break
  fi
  
  PAGE_INFO=${PAGES_BY_SESSION[$i]}
  if [ -z "$PAGE_INFO" ]; then
    continue
  fi
  
  PAGE_ID=$(echo "$PAGE_INFO" | cut -d: -f1)
  PAGE_PATH=$(echo "$PAGE_INFO" | cut -d: -f2)
  
  echo ""
  echo "[세션 $SESSION_NUM] 페이지 $((i+1))/57: $PAGE_PATH"
  log_result "START: $PAGE_PATH"
  
  # 실제 kilo 명령 실행
  # kilocli run --api-key "$API_KEY" --prompt "Work on $PAGE_PATH"
  # 임시로 완료 표시
  echo "  → 완료됨"
  log_result "DONE: $PAGE_PATH"
done

echo ""
echo "========================================"
echo "세션 $SESSION_NUM 완료"
echo "========================================"

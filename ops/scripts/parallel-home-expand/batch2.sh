#!/bin/bash
# Batch 2: 16개 페이지 병렬 처리 (16개 키 사용)
# Usage: bash batch2.sh <KEY_1> <KEY_2> ... <KEY_16>

set -e

KEYS=("$@")
PROJECT_ROOT="/opt/Resonance/projects/carbonet-frontend/source"

PAGES=(
  "co2-integrity|Co2Integrity|/co2/integrity|CO2 Integrity"
  "co2-credit|Co2Credit|/co2/credit|CO2 Credit"
  "co2-analysis|Co2Analysis|/co2/analysis|CO2 Analysis"
  "co2-search|Co2Search|/co2/search|MRV Search"
  "trade-list|TradeList|/trade/list|Trade List"
  "trade-market|TradeMarket|/trade/market|Trade Market"
  "trade-report|TradeReport|/trade/report|Trade Report"
  "trade-buy-request|BuyRequest|/trade/buy_request|Buy Request"
  "trade-complete|TradeComplete|/trade/complete|Trade Complete"
  "trade-auto-order|AutoOrder|/trade/auto_order|Auto Order"
  "trade-sell|TradeSell|/trade/sell|Sell"
  "trade-price-alert|PriceAlert|/trade/price_alert|Price Alert"
  "payment-pay|PaymentPay|/payment/pay|Payment"
  "payment-virtual-account|VirtualAccount|/payment/virtual_account|Virtual Account"
  "payment-refund|PaymentRefund|/payment/refund|Refund"
  "payment-refund-account|RefundAccount|/payment/refund_account|Refund Account"
)

WORK_DIR="/tmp/batch2-work"
mkdir -p "$WORK_DIR"
echo "===== Batch 2 Started: $(date) =====" | tee "$WORK_DIR/summary.txt"

process_page() {
  local idx=$1
  local page_info=$2
  local api_key=$3
  
  IFS='|' read -r page_id comp_name ko_path en_path <<< "$page_info"
  
  echo "[Batch2-$idx] Starting: $page_id ($ko_path)"
  
  kilo --api-key "$api_key" "다음 페이지를 최대한 확장하세요.

대상 페이지: $ko_path
pageId: $page_id
componentName: $comp_name

작업 내용:
1. $PROJECT_ROOT/src/features/$page_id/ 디렉토리 분석
2. 기존 페이지 파일 읽기 (MigrationPage.tsx)
3. 최대 15개 섹션 추가 (StatsWidget, TrendChart, RecentAlerts, QuickActions, DataTable, Calendar, ExportPanel 등)
4. components/ 및 types/ 디렉토리 생성 (필요시)
5. 각 섹션별 TypeScript 컴포넌트 생성
6. pageManifests.ts 업데이트 (components 배열에 새 컴포넌트 추가)
7. TypeScript 빌드 확인

완료 후 result-${page_id}.txt에 작업 결과 요약 작성" 2>&1 | tee "$WORK_DIR/log-${page_id}.txt"
  
  echo "[Batch2-$idx] Completed: $page_id" >> "$WORK_DIR/summary.txt"
  echo "[Batch2-$idx] Result: $WORK_DIR/result-${page_id}.txt"
}

for i in $(seq 0 15); do
  idx=$((i + 1))
  api_key="${KEYS[$i]}"
  page_info="${PAGES[$i]}"
  
  if [ -n "$api_key" ] && [ -n "$page_info" ]; then
    process_page $idx "$page_info" "$api_key" &
  fi
done

wait
echo ""
echo "===== Batch 2 Completed: $(date) ====="
echo "Results in: $WORK_DIR/"
ls -la "$WORK_DIR/"

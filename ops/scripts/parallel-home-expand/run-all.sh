#!/bin/bash
# 57개 페이지 병렬 처리 - 에러 핸들링 강화
# 사용법: bash run-all.sh KEY1 KEY2 ... KEY16

set -uo pipefall  # set -e 제거 (에러 발생시 계속)

# 에러 핸들러
error_handler() {
  local line=$1
  local exit_code=$2
  echo "=== ERROR at line $line, exit code $exit_code ===" | tee -a "$LOG"
}
trap 'error_handler $LINENO $?' ERR

if [ ${#} -lt 1 ]; then
  echo "사용법: bash run-all.sh KEY1 KEY2 ... KEY16"
  exit 1
fi

KEYS=("$@")
WORK_DIR="/tmp/parallel-home-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"
LOG="$WORK_DIR/summary.txt"
PROGRESS_FILE="$WORK_DIR/progress.txt"

echo "===== Homepage Expansion Started: $(date) =====" | tee "$LOG"
echo "Keys: ${#KEYS[@]}, Total pages: 57" | tee -a "$LOG"
echo "Work directory: $WORK_DIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# 완료된 페이지 (스킵)
SKIPPED="emission-data-input|emission-project_list|emission-validate|emission-home-validate|emission-dashboard|emission-reduction"

# 57개 페이지 목록
ALL_PAGES=(
  "emission-lci|EmissionLci|/emission/lci"
  "emission-report-submit|ReportSubmit|/emission/report_submit"
  "emission-lca|LcaAnalysis|/emission/lca"
  "emission-simulate|Simulate|/emission/simulate"
  "monitoring-dashboard|MonitorDash|/monitoring/dashboard"
  "monitoring-realtime|Realtime|/monitoring/realtime"
  "monitoring-alerts|AlertStatus|/monitoring/alerts"
  "monitoring-statistics|EsgReport|/monitoring/statistics"
  "monitoring-share|Stakeholder|/monitoring/share"
  "monitoring-reduction-trend|TrendAnalysis|/monitoring/reduction_trend"
  "monitoring-track|TrackReport|/monitoring/track"
  "monitoring-export|Export|/monitoring/export"
  "co2-production-list|Co2Production|/co2/production_list"
  "co2-demand-list|Co2Demand|/co2/demand_list"
  "co2-dashboard|Co2Dash|/co2/dashboard"
  "co2-allocation|Allocation|/co2/allocation"
  "co2-report|Report|/co2/report"
  "co2-market|Market|/co2/market"
  "trade-contract|Contract|/trade/contract"
  "trade-execution|Execution|/trade/execution"
  "trade-settlement|Settlement|/trade/settlement"
  "trade-portfolio|Portfolio|/trade/portfolio"
  "payment-invoice|Invoice|/payment/invoice"
  "payment-history|History|/payment/history"
  "payment-setting|Setting|/payment/setting"
  "payment-vat|Vat|/payment/vat"
  "payment-tax|Tax|/payment/tax"
  "payment-report|PaymentReport|/payment/report"
  "payment-budget|Budget|/payment/budget"
  "certificate-list|CertList|/certificate/list"
  "certificate-detail|CertDetail|/certificate/detail"
  "certificate-issue|Issue|/certificate/issue"
  "certificate-verify|Verify|/certificate/verify"
  "edu-course|Course|/edu/course"
  "edu-survey|Survey|/edu/survey"
  "edu-certificate|Certificate|/edu/certificate"
  "edu-mypass|Mypass|/edu/mypass"
  "support-faq|Faq|/support/faq"
  "support-qna|Qna|/support/qna"
  "support-notice|Notice|/support/notice"
  "support-inquiry|Inquiry|/support/inquiry"
  "download-center|Download|/download/center"
  "download-history|History|/download/history"
  "download-request|Request|/download/request"
  "mypage-main|Mypage|/mypage"
  "mypage-profile|Profile|/mypage/profile"
  "mypage-site|Site|/mypage/site"
  "mypage-staff|Staff|/mypage/staff"
  "mypage-email|Email|/mypage/email"
  "mypage-notification|Noti|/mypage/notification"
  "mypage-alarm|Alarm|/mypage/alarm"
  "mypage-bookmark|Bookmark|/mypage/bookmark"
  "mypage-history|History|/mypage/history"
)

TOTAL=55
START_TIME=$(date +%s)

# 페이지 처리
for i in $(seq 0 $((TOTAL - 1))); do
  idx=$((i + 1))
  page_info="${ALL_PAGES[$i]}"
  key_idx=$((i % ${#KEYS[@]}))
  api_key="${KEYS[$key_idx]}"
  
  IFS='|' read -r page_id component_name page_path <<< "$page_info"
  
  local_log="$WORK_DIR/log-${page_id}.txt"
  
  # 스킵 체크
  if echo "$page_id" | grep -qE "$SKIPPED"; then
    echo "[$idx/$TOTAL] SKIP: $page_id (already done)" | tee -a "$LOG"
    echo "$(date +%H:%M:%S) | SKIP | $page_id" >> "$PROGRESS_FILE"
    continue
  fi
  
  # 디렉토리 체크
  if [ ! -d "/opt/Resonance/projects/carbonet-frontend/source/src/features/$page_id" ]; then
    echo "[$idx/$TOTAL] SKIP: $page_id (no directory)" | tee -a "$LOG"
    echo "$(date +%H:%M:%S) | SKIP | $page_id | no dir" >> "$PROGRESS_FILE"
    continue
  fi
  
  echo "[$idx/$TOTAL] START: $page_id" | tee -a "$LOG"
  echo "$(date +%H:%M:%S) | START | $page_id" >> "$PROGRESS_FILE"
  
  # 프롬프트 생성
  cat > "$WORK_DIR/prompt-${page_id}.txt" << PROMPT
다음 페이지를 최대한 확장하세요.

대상: $page_path, pageId: $page_id, componentName: $component_name

작업 내용:
1. /opt/Resonance/projects/carbonet-frontend/source/src/features/$page_id/ 분석
2. *MigrationPage.tsx 또는 *Page.tsx 파일 읽기
3. 최대 15개 섹션의 컴포넌트를 components/에 생성
4. types/ 디렉토리에 타입 정의 파일 생성 (기존 types/에 추가)
5. pageManifests.ts에 새 컴포넌트 등록
6. MigrationPage.tsx에 import문 추가 + return() JSX에 컴포넌트 추가
7. npm run build로 빌드 확인 (에러나면 TypeScript 에러 직접 수정)
8. 완료 시 "=== COMPLETE: SUCCESS ===" 출력

주의:
- pageManifests.ts 등록만으로 부족 - MigrationPage.tsx에서 import + JSX 사용 필수
- 빌드 에러 발생 시 fix attempt 후 그래도 실패하면 "=== COMPLETE: FAILED ===" 출력
- 완료 페이지: emission-dashboard, emission-reduction, emission-validate, emission-home-validate는 스킵
PROMPT
  
  # Kilo 실행
  success=false
  if timeout 1200 kilo run -- "$(cat "$WORK_DIR/prompt-${page_id}.txt")" \
    --api-key "$api_key" \
    --model nvidia/minimaxai/minimax-m2.7 \
    2>&1 | tee "$local_log"; then
    success=true
  fi
  
  # 빌드 확인
  cd /opt/Resonance/projects/carbonet-frontend/source
  if npm run build > "$WORK_DIR/build-${page_id}.log" 2>&1; then
    build_result="OK"
  else
    build_result="BUILD_ERR"
    echo "=== BUILD FAILED for $page_id ===" | tee -a "$LOG"
    tail -20 "$WORK_DIR/build-${page_id}.log" | tee -a "$LOG"
  fi
  cd /opt/Resonance
  
  # 결과 기록
  if $success && [ "$build_result" = "OK" ]; then
    echo "[$idx/$TOTAL] SUCCESS: $page_id" | tee -a "$LOG"
    echo "$(date +%H:%M:%S) | SUCCESS | $page_id" >> "$PROGRESS_FILE"
  else
    echo "[$idx/$TOTAL] FAILED: $page_id (success=$success, build=$build_result)" | tee -a "$LOG"
    echo "$(date +%H:%M:%S) | FAILED | $page_id | $build_result" >> "$PROGRESS_FILE"
  fi
  
  # 진행률
  elapsed=$(($(date +%s) - START_TIME))
  completed=$idx
  eta=$((elapsed * (TOTAL - completed) / completed))
  echo "--- Progress: $completed/$TOTAL | Elapsed: $((elapsed/60))min | ETA: $((eta/60))min ---" | tee -a "$LOG"
  
  # 배포
  kubectl -n carbonet-prod rollout restart deployment/carbonet-runtime > /dev/null 2>&1
  kubectl -n carbonet-prod rollout status deployment/carbonet-runtime --timeout=60s > /dev/null 2>&1
done

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo "" | tee -a "$LOG"
echo "===== COMPLETED: $(date) =====" | tee -a "$LOG"
echo "Total time: $((TOTAL_TIME/60)) minutes" | tee -a "$LOG"

# 최종 요약
echo "" | tee -a "$LOG"
echo "===== FINAL SUMMARY =====" | tee -a "$LOG"
if [ -f "$PROGRESS_FILE" ]; then
  success_cnt=$(grep -c "| SUCCESS |" "$PROGRESS_FILE" 2>/dev/null || echo 0)
  failed_cnt=$(grep -c "| FAILED |" "$PROGRESS_FILE" 2>/dev/null || echo 0)
  skip_cnt=$(grep -c "| SKIP |" "$PROGRESS_FILE" 2>/dev/null || echo 0)
  echo "SUCCESS: $success_cnt" | tee -a "$LOG"
  echo "FAILED: $failed_cnt" | tee -a "$LOG"
  echo "SKIPPED: $skip_cnt" | tee -a "$LOG"
fi

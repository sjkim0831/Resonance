#!/bin/bash
# Batch 1: 16개 페이지 (emission-lci, emission-report-submit, emission-lca, emission-simulate, monitoring-*, co2-production-list, co2-demand-list + 8개)
cd /opt/Resonance
nohup bash -c '
KEYS=()
while IFS= read -r __nvidia_key; do
    [ -n "$__nvidia_key" ] && KEYS+=("$__nvidia_key")
done < "${NVIDIA_API_KEYS_FILE:-/etc/resonance/secrets/nvidia-api-keys}"
PAGES=(
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
)
for i in $(seq 0 15); do
  IFS="|" read -r page_id comp_name page_path <<< "${PAGES[$i]}"
  api_key="${KEYS[$i]}"
  PROMPT="다음 페이지를 확장: $page_path, pageId: $page_id
1. MigrationPage.tsx 분석
2. 최대 15개 컴포넌트를 components/에 생성
3. types/에 타입 정의 추가
4. pageManifests.ts에 새 컴포넌트 등록
5. MigrationPage.tsx에 import + JSX 사용 추가
6. npm run build (에러나면 수정)
7. 완료 시 COMPLETE 출력"
  (kilo run -- "$PROMPT" --api-key "$api_key" --model nvidia/minimaxai/minimax-m2.7 2>&1 | tee /tmp/batch1-${page_id}.log; echo "BATCH1_DONE:$page_id:$(date)" >> /tmp/batch1-results.txt) &
done
wait
echo "Batch 1 completed" >> /tmp/batch1-done.txt
' > /tmp/batch1-run.log 2>&1 &
echo "Batch 1 started: PID $!"

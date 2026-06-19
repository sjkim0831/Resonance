#!/bin/bash
# Batch 1: 16개 페이지 (emission-lci, emission-report-submit, emission-lca, emission-simulate, monitoring-*, co2-production-list, co2-demand-list + 8개)
cd /opt/Resonance
nohup bash -c '
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
)
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

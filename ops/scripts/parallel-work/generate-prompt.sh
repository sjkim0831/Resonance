#!/bin/bash
# 페이지별 작업 지시문 생성

OUTPUT_DIR="/opt/Resonance/ops/scripts/parallel-work/prompts"
mkdir -p "$OUTPUT_DIR"

cat > "$OUTPUT_DIR/emission-dashboard.txt" << 'EOF'
# /emission/dashboard 페이지 작업 지시

## 현재 상태
기존 DashboardPage.tsx에 hero, metric cards, scope breakdown, trend chart, site emissions, reduction targets, quick actions, data quality, AI insights 섹션이 이미 존재

## 추가할 섹션
1. RecentAlertsWidget - 최근 알림 목록
2. SiteRankingWidget - 배출량 순위 
3. YearOverYearWidget - 전년 대비
4. DataCompletenessAlert - 데이터 완전성 알림

## 작업 내용
1. components/DataCompletenessAlert.tsx, RecentAlertsWidget.tsx, SiteRankingWidget.tsx, YearOverYearWidget.tsx 파일이 있는지 확인
2. 없으면 생성 (이미 생성됨)
3. EmissionDashboardPage.tsx에 새 섹션 import 및 조립
4. pageManifests.ts에 새 컴포넌트 엔트리 추가
5. npm run build로 빌드 검증

## pageManifests 추가 형식
{ componentId: "DataCompletenessAlert", instanceKey: "emission-dashboard-completeness-alert", layoutZone: "content", propsSummary: ["en", "data"] }

## 빌드 후 빌드 출력의 마지막 줄 확인
EOF

cat > "$OUTPUT_DIR/emission-lca.txt" << 'EOF'
# /emission/lca 페이지 작업 지시

## 현재 상태
EmissionLcaMigrationPage.tsx (33KB) - LCA 분석 페이지

## 추가할 섹션 (목표 3~5개)
1. LCI Database Search Widget - 데이터베이스 검색
2. Impact Assessment Chart - 영향 평가 차트
3. Process Flow Diagram - 공정 흐름도
4. Carbon Footprint Summary - 탄소 발자국 요약
5. Comparison Table - 비교 테이블

## 작업 내용
1. components/ 디렉토리 생성 및 새 컴포넌트 생성
2. EmissionLcaMigrationPage.tsx에 import 및 조립
3. pageManifests.ts 업데이트
4. npm run build 검증
EOF

# 나머지 페이지의 지시문 생성
for page in emission-lci emission-reduction emission-report-submit emission-simulate emission-validate monitoring-dashboard monitoring-realtime monitoring-alerts monitoring-statistics co2-production-list co2-demand-list co2-integrity co2-credit co2-analysis co2-search edu-course-list trade-list payment-history certificate-list mypage-profile support-faq; do
  cat > "$OUTPUT_DIR/$page.txt" << EOF
# /$page 또는 /${page//-/\/} 작업 지시

## 현재 상태
해당 페이지 .tsx 파일 확인 필요

## 추가할 섹션 (목표 3~5개)
- StatsWidget - 통계 위젯
- RecentAlertsWidget - 알림
- QuickActions - 빠른 작업
- TrendChart - 트렌드
- DataTable - 데이터 테이블

## 작업 내용
1. 기존 페이지 코드 분석
2. components/ 디렉토리에서 새 컴포넌트 생성
3. 페이지에 새 섹션 import 및 조립
4. pageManifests.ts 업데이트
5. npm run build 검증
EOF
done

echo "작업 지시문 생성 완료: $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/"

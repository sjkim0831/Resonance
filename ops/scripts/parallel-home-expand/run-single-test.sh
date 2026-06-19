#!/bin/bash
# Test single page execution

API_KEY="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"
MODEL="nvidia/minimaxai/minimax-m2.7"
PROJECT_ROOT="/opt/Resonance/projects/carbonet-frontend/source"

PROMPT='다음 페이지를 최대한 확장하세요.

대상 페이지: /emission/dashboard
pageId: emission-dashboard
componentName: CarbonDashboard

작업 내용:
1. /opt/Resonance/projects/carbonet-frontend/source/src/features/emission-dashboard/ 디렉토리 분석
2. MigrationPage.tsx 파일 읽기
3. 최대 15개 섹션 추가 (StatsWidget, TrendChart, RecentAlerts, QuickActions, DataTable, Calendar, ExportPanel 등)
4. components/ 및 types/ 디렉토리 생성 (필요시)
5. 각 섹션별 TypeScript 컴포넌트 생성
6. pageManifests.ts 업데이트 (components 배열에 새 컴포넌트 추가)
7. npm run build로 빌드 확인 (에러나면 직접 수정)
8. 최종 결과: 성공/실패 및 추가된 섹션 목록

주의:
- 완전한 작동하는 코드만 작성
- 빌드 에러 발생 시 TypeScript 에러를 직접 수정'

echo "Starting test at $(date)"
kilo run -- "$PROMPT" --api-key "$API_KEY" --model "$MODEL" 2>&1 | tee /tmp/test-output.txt
echo "Finished at $(date)"

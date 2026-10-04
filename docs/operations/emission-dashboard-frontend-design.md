# 배출량 현황 프론트 적용 (2026-09-29)

- 실제 URL: http://172.16.1.232/emission/index
- 메뉴: 탄소배출 관리 > 현황·프로젝트 > 배출량 현황
- 기존 Route와 EmissionDashboardPage를 재사용. 공통 Shell·CommonSearchSection 유지.
- 제목, 검색, 프로젝트별 목록, 선택 상세를 구성. 상세는 데스크톱 우측, 좁은 화면 하단.
- 목록 API: GET /home/api/emission-project-list-v1 (기존 필터·페이지·세션 유지)
- 사업장 옵션: GET /home/api/emission-project-drafts/options
- 선택 상세: GET /home/api/emission-projects/{projectId}/reports
- 실제 이동: /emission/project/detail?projectId=..., /emission/report-download?projectId=...
- 프로젝트 목록: /emission/project_list
- 오류·재시도·미조회·결과 없음은 유지. 합계나 Scope별 결과·추이 데이터는 생성하지 않음.
- 백엔드, DB, 권한, 메뉴 정본 변경 없음. 기존 등록 메뉴를 그대로 사용.
- 확인 범위: 프론트 시각 검수와 선택·조회. 실제 산정·승인·발급 검증은 범위 밖.

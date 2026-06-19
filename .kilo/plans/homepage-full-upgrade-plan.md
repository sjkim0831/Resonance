# 홈페이지 전체 화면 업그레이드 계획

## 목적
- 기존 페이지들의 기능 확장 및 새 섹션 추가
- 불필요한 기능 통합하여 메뉴 구성
- 체계적인 기획 → 설계 → 구현 진행

## 현재 상태
- Plan Mode: 없음 (Code Mode 진행 중)
- 롤백: 완료
- 59개 페이지 작업 대상

## 페이지 분류

### Group A: 배출량 관리 (7개)
1. /emission/dashboard - 탄소 배출량 대시보드
2. /emission/lca - LCA 분석
3. /emission/lci - LCI DB 조회
4. /emission/reduction - 감축 시나리오
5. /emission/report_submit - 배출량 보고서 작성
6. /emission/simulate - 시뮬레이션
7. /emission/validate - 산정 검증

### Group B: 모니터링 (8개)
8. /monitoring/dashboard - 통합 대시보드
9. /monitoring/realtime - 실시간 모니터링
10. /monitoring/alerts - 경보 현황
11. /monitoring/statistics - ESG 보고서
12-15. /monitoring/share, /reduction_trend, /track, /export

### Group C: CO2 관리 (6개)
16-21. /co2/production_list, /demand_list, /integrity, /credit, /analysis, /search

### Group D: 교육 (8개)
22-29. /edu/course_list, /my_course, /progress, /content, /course_detail, /apply, /survey, /certificate

### Group E: 마이페이지 (7개)
30-36. /mypage/profile, /email, /notification, /marketing, /company, /password, /staff

### Group F: 거래/결제 (19개)
37-55. /trade/*, /payment/*, /certificate/*

### Group G: 고객 지원 (4개)
56-59. /support/faq, /support/inquiry, /mtn/status, /mtn/version

## 확장 패턴

### 공통으로 추가 가능한 섹션
1. StatsWidget - 통계 위젯
2. RecentAlerts - 최근 알림
3. QuickActions - 빠른 작업
4. TrendChart - 트렌드 차트
5. DataTable - 데이터 테이블
6. SearchFilter - 검색 필터
7. ExportOptions - 내보내기 옵션
8. ProgressBar - 진행률 바
9. StatusBadge - 상태 배지
10. TimelineWidget - 타임라인

## 구현 방법

각 페이지별로:
1. components/ 디렉토리 생성
2. 공통 컴포넌트 생성
3. 페이지에 조립
4. pageManifests.ts 업데이트
5. 빌드 검증

## 예상 시간
- 59개 페이지 × 평균 5개 섹션 = 295개 섹션
- 순차 처리: 약 10-15시간

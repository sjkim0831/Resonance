# 현행 시스템 전수조사 보고서

> 자동 수집 시점의 구현 자산 기준입니다. 동적 라우팅과 런타임 생성 항목은 후보 연결로 분리합니다.

## 자산 계수

- menus: 791
- visibleMenus: 240
- menuProcessBindings: 235
- screenBlueprints: 178
- dbActors: 10
- dbProcesses: 16
- dbSteps: 69
- dbScenarios: 154
- databaseTablesAndViews: 232
- databaseColumns: 2,776
- databaseRoutines: 3
- frontendSourceFiles: 557
- frontendPageComponents: 305
- routeLiterals: 1,352
- javaControllers: 96
- javaEndpointAnnotations: 1,300
- referenceAssets: 12,763

## 자동 판정

- URL 정확 일치 메뉴: 429
- 동적 또는 미해결 메뉴 URL: 362
- 라우트 미연결 페이지 컴포넌트: 44
- 파일명 기준 미분류 레퍼런스: 7,475

## 주의

미해결은 곧 미구현을 뜻하지 않습니다. DB 라우트, 동적 레지스트리, 공통 컨트롤러와 SDUI가 존재할 수 있으므로 다음 단계에서 런타임 호출과 메뉴 선택 테스트로 확정해야 합니다.

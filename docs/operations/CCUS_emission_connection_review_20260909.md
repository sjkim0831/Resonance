# 탄소배출 화면 기능·항목 연결 사전 점검

기준일 2026-09-09 · 읽기 전용 점검 · 수정/배포/업무 데이터 변경 없음

## 판정

**현재 전체 업무 연결을 정상으로 판정할 수 없습니다.** 70개 항목의 라우트→컴포넌트와 문맥/API 참조를 일괄 수집했고 68개 컴포넌트를 찾았습니다. 아래 핵심 연결에서 8개 문제/위험을 확인했습니다. 이 검사는 70개 모든 기능의 실제 실행 검증이 아닙니다.

- 확인 범위: 소스 라우트·페이지 입력/URL/API 참조·공유 컴포넌트·등록 정책·사업장 저장/제출/계산 SQL·DB 컬럼.
- 실제 로그인 저장·다른 계정 인계·승인·PDF 발급·진위확인 E2E는 이번에 실행하지 않았습니다.
- SQL 오류는 실제 DB에서 READ ONLY EXPLAIN으로 재현했습니다. 데이터 행을 입력하거나 변경하지 않았습니다.

## 우선 차단 항목

|ID|목록 번호|문제|확인 근거와 영향|소스/증거|다음 조치|
|---|---|---|---|---|---|
|B01|03|등록 필수조건이 최신 요구와 불일치|프로젝트 등록 정책이 owner/dataOwner/calculator/verifier/approver 및 Scope를 필수 검사한다. 등록 간소화 화면만 변경하면 저장 실패.|EmissionProjectCreationPolicy.java:24-28,52|등록과 산정준비 계약 분리, 계산 단계의 필수조건 유지|
|B02|37~38|산정 결과 조회 SQL 오류|accepted CTE는 site_id를 내보내지 않는데 SELECT a.site_id를 사용한다. 운영 DB READ ONLY EXPLAIN으로 column a.site_id does not exist 재현.|EmissionProjectRegistryService.java:530-531|사업장 귀속을 제출 스냅샷부터 계산 결과까지 연결한 후 쿼리 수정|
|B03|22~24 → 37~41|사업장 귀속이 제출·계산 스냅샷에 없음|현재 DB emission_activity_submission_item 및 emission_calculation_item에 site_id가 없다. 입력 시 사업장 선택 저장과 확정 버전별 사업장 집계는 별개다.|information_schema.columns READ ONLY 조회|사업장 식별/표시/Scope를 버전 스냅샷에 보존하는 계약 설계|
|B04|33~36|중복 검사에서 사업장 누락|GROUP BY activity_name/category/activity_period/unit에 site_id가 없다. 두 사업장의 같은 월 같은 항목이 중복으로 잡힐 수 있다.|EmissionProjectRegistryService.java:1541|사업장별 중복 기준과 동일 사업장 반복 측정 기준 확정|
|B05|04 → 57|상세 완료 링크 경로 불일치|현재 업무가 없을 때 /emission/project/completion으로 링크한다. 등록된 완료 화면은 /emission/project-completion이다.|EmissionProjectDetailPage.tsx:62|정식 경로 사용 및 프로젝트 ID 전달 검증|
|B06|04,56|미산정이 0으로 표시될 위험|상세가 Number(metrics?.totalEmission||0)을 표시한다. 응답 없음/미산정/실제 0을 구분하지 않는다.|EmissionProjectDetailPage.tsx:67|산정 여부·로딩·오류 상태를 별도 표현|
|B07|09,50|DB 등록만 있고 라우트 미발견|/emission/project/settings 및 /admin/emission/certificates는 수집한 route family에 loader가 없다.|전체 route family와 기준 목록 대조|기존 상세/발급 화면에 통합하거나 실제 라우트 구현 결정|
|B08|04 → 22~24|사업장 선택값 자동 인계 미완료|활동자료 입력은 URL에서 projectId/requestId를 읽고, siteId는 단일 사업장일 때만 자동 설정한다. 다사업장의 사업장별 상세 링크 연계는 추가 작업 필요.|EmissionDataInputMigrationPage.tsx:17,21|siteId 수신·프로젝트 소속 검증·조회 필터·뒤로가기 유지|

## 확인된 정상 연결의 범위

1. 프로젝트 상세는 id와 projectId를 모두 읽는다. 후속 업무 링크에 projectId를 추가하는 함수가 있다. 실제 권한·데이터 일치 검증은 별도다.
2. 활동자료 입력은 projectId가 없으면 상세에서 열도록 안내한다. 빈 ID를 실제 프로젝트로 대체하지 않는다.
3. 업로드 경로는 upload 탭을 선택하고, 자료 화면은 mapping/quality/submission 탭 구분을 읽는다.
4. 계산 함수에는 미매핑·단위 불일치 차단과 계산 버전·입력 해시 저장이 있다. 하지만 이것만으로 사업장/Scope별 정확한 계산을 보장하지 않는다.
5. 관리자 프로젝트 운영은 menuCode를 읽어 workspace를 선택한다. 모든 menuCode별 기능 차이는 실행 검증이 필요하다.

## 연결 계약: 모든 화면에서 확인할 값

|구간|반드시 유지할 값|현재 판정|
|---|---|---|
|목록→등록→상세|회사·projectId·사업장 ID 목록·기간|사업장 관계 저장은 존재; 등록 정책 불일치|
|상세→배출원·자료|projectId·siteId·기간·Scope/배출원|다사업장 siteId 인계 미완료|
|자료→제출→접수|자료 ID·siteId·버전·증빙·제출자|제출 스냅샷 사업장 누락|
|접수→매핑→계산|제출 버전·계수 버전·단위·Scope·siteId|SQL 오류 및 스냅샷 보강 필요|
|계산→검증→승인|calculationId·버전·지적사항·승인자·잠금|소스 존재와 실제 계정 E2E 분리, 미검증|
|확정→보고→진위|잠금 결과·발급 ID·원본 PDF·해시·취소상태|이번 실제 발급/인증 E2E 미검증|
|모든 구간|회사/사업장 접근권한·오류처리·중복요청|계정별 음성/양성 검증 필요|

## 70개 항목별 점검 원장

컴포넌트의 텍스트에서 projectId/siteId/API/버전 참조를 찾는 것은 연결의 후보 증거다. 참조 없음은 즉시 기능 없음이라는 뜻이 아니며 하위 컴포넌트/API 모듈까지 추가 추적해야 한다.

|번호|화면|페이지 소스|공유 라우트 수|연결 참조 수|현재 판정|
|---:|---|---|---:|---:|---|
|1|[배출량 프로젝트 목록](http://172.16.1.232/emission/project_list)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectListFocusedPage.tsx|1|12|정적 참조 수집 / 기능 E2E 대기|
|2|[사업장·배출원 원장](http://172.16.1.232/admin/emission/site-management)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-site-management/EmissionSiteManagementMigrationPage.tsx|1|3|정적 참조 수집 / 기능 E2E 대기|
|3|[프로젝트 등록](http://172.16.1.232/emission/project/create)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectCreatePage.tsx|1|20|정적 참조 수집 / 기능 E2E 대기|
|4|[프로젝트 상세](http://172.16.1.232/emission/project/detail)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectDetailPage.tsx|1|17|정적 참조 수집 / 기능 E2E 대기|
|5|[프로세스 진행](http://172.16.1.232/emission/project/progress)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-progress/EmissionProjectProgressPage.tsx|1|9|정적 참조 수집 / 기능 E2E 대기|
|6|[프로젝트 포트폴리오](http://172.16.1.232/emission/project-portfolio)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectPortfolioPage.tsx|1|29|정적 참조 수집 / 기능 E2E 대기|
|7|[관리자 프로젝트 운영](http://172.16.1.232/admin/emission/project-operations)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectOperationsPage.tsx|1|4|정적 참조 수집 / 기능 E2E 대기|
|8|[프로젝트 사전 설정](http://172.16.1.232/admin/emission/project-prerequisites)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/AdminEmissionProjectPrerequisitesPage.tsx|1|8|정적 참조 수집 / 기능 E2E 대기|
|9|[프로젝트 설정 후보](http://172.16.1.232/emission/project/settings)|미발견|0|0|라우트 결정 필요|
|10|[배출 정의 관리](http://172.16.1.232/admin/emission/definition-studio)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-definition-studio/index.ts|3|0|정적 참조 수집 / 기능 E2E 대기|
|11|[조직경계·사업장별 범위 설정](http://172.16.1.232/emission/organizational-boundary)|/opt/Resonance/projects/carbonet-frontend/source/src/features/organizational-boundary/index.ts|2|0|정적 참조 수집 / 기능 E2E 대기|
|12|[조직경계 검토](http://172.16.1.232/admin/emission/organizational-boundary)|/opt/Resonance/projects/carbonet-frontend/source/src/features/organizational-boundary/index.ts|2|0|정적 참조 수집 / 기능 E2E 대기|
|13|[배출계수 관리](http://172.16.1.232/admin/emission/factor-management)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-ecoinvent-admin/EmissionEcoinventAdminMigrationPage.tsx|2|5|정적 참조 수집 / 기능 E2E 대기|
|14|[ecoinvent 계수 관리](http://172.16.1.232/admin/emission/ecoinvent)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-ecoinvent-admin/EmissionEcoinventAdminMigrationPage.tsx|2|5|정적 참조 수집 / 기능 E2E 대기|
|15|[산정식 관리](http://172.16.1.232/admin/emission/calculation-rule)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-definition-studio/index.ts|3|0|정적 참조 수집 / 기능 E2E 대기|
|16|[GWP 값 관리](http://172.16.1.232/admin/emission/gwp-values)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-gwp-values/EmissionGwpValuesMigrationPage.tsx|1|9|정적 참조 수집 / 기능 E2E 대기|
|17|[배출 변수 관리](http://172.16.1.232/admin/emission/management)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-management/EmissionManagementMigrationPage.tsx|1|8|정적 참조 수집 / 기능 E2E 대기|
|18|[입력 양식 관리](http://172.16.1.232/admin/emission/input-template)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-definition-studio/index.ts|3|0|정적 참조 수집 / 기능 E2E 대기|
|19|[검증 규칙 관리](http://172.16.1.232/admin/emission/validation-rule)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-validate/EmissionValidateMigrationPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|20|[승인·알림 정책](http://172.16.1.232/admin/emission/approval-workflow)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-validate/EmissionValidateMigrationPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|21|[자료 제출 요청](http://172.16.1.232/emission/data-request)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-carbon-workflow/EmissionCarbonWorkflowPages.tsx|3|7|정적 참조 수집 / 기능 E2E 대기|
|22|[활동자료 관리](http://172.16.1.232/emission/activity-data)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-input/EmissionDataInputMigrationPage.tsx|4|32|정적 참조 수집 / 기능 E2E 대기|
|23|[활동자료 입력 기존 경로](http://172.16.1.232/emission/data_input)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-input/EmissionDataInputMigrationPage.tsx|4|32|정적 참조 수집 / 기능 E2E 대기|
|24|[엑셀 업로드·원본 열 매핑](http://172.16.1.232/emission/excel-upload)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-input/EmissionDataInputMigrationPage.tsx|4|32|정적 참조 수집 / 기능 E2E 대기|
|25|[증빙 자료함](http://172.16.1.232/emission/evidence)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-report-submit/EmissionReportSubmitMigrationPage.tsx|1|21|정적 참조 수집 / 기능 E2E 대기|
|26|[관리자 증빙 관리](http://172.16.1.232/admin/emission/evidence-management)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-admin-data/EmissionSurveyAdminDataMigrationPage.tsx|2|4|정적 참조 수집 / 기능 E2E 대기|
|27|[외부 데이터 연계](http://172.16.1.232/emission/external-data)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-carbon-workflow/EmissionCarbonWorkflowPages.tsx|3|7|정적 참조 수집 / 기능 E2E 대기|
|28|[외부 시스템 연계 관리](http://172.16.1.232/admin/emission/system-link)|/opt/Resonance/projects/carbonet-frontend/source/src/features/external-connection-list/ExternalConnectionListMigrationPage.tsx|2|12|정적 참조 수집 / 기능 E2E 대기|
|29|[내 업무](http://172.16.1.232/emission/my-tasks)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionMyTasksPage.tsx|1|23|정적 참조 수집 / 기능 E2E 대기|
|30|[프로젝트 업무 배정](http://172.16.1.232/emission/work-assignment)|/opt/Resonance/projects/carbonet-frontend/source/src/features/work-assignment/WorkAssignmentPage.tsx|1|22|정적 참조 수집 / 기능 E2E 대기|
|31|[공통 업무 실행](http://172.16.1.232/work/execution)|/opt/Resonance/projects/carbonet-frontend/source/src/features/work-execution/WorkExecutionPage.tsx|1|38|정적 참조 수집 / 기능 E2E 대기|
|32|[마감·지연 현황](http://172.16.1.232/emission/deadline-status)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionDeadlineStatusPage.tsx|1|4|정적 참조 수집 / 기능 E2E 대기|
|33|[데이터 검증](http://172.16.1.232/emission/data-validation)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectReviewPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|34|[검증·보정 공통 화면](http://172.16.1.232/emission/validate)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectReviewPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|35|[관리자 검증](http://172.16.1.232/admin/emission/validate)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-validate/EmissionValidateMigrationPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|36|[보완·재산정](http://172.16.1.232/emission/correction)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-input/EmissionDataInputMigrationPage.tsx|4|32|정적 참조 수집 / 기능 E2E 대기|
|37|[배출량 산정·계수 매핑](http://172.16.1.232/emission/calculation)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectResultPage.tsx|3|34|정적 참조 수집 / 기능 E2E 대기|
|38|[산정 결과](http://172.16.1.232/emission/calculation-results)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectResultPage.tsx|3|34|정적 참조 수집 / 기능 E2E 대기|
|39|[결과 조회 기존 경로](http://172.16.1.232/emission/result)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectResultPage.tsx|3|34|정적 참조 수집 / 기능 E2E 대기|
|40|[관리자 산정 결과 목록](http://172.16.1.232/admin/emission/result_list)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-result-list/EmissionResultListMigrationPage.tsx|1|8|정적 참조 수집 / 기능 E2E 대기|
|41|[관리자 결과 상세](http://172.16.1.232/admin/emission/result_detail)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-result-detail/EmissionResultDetailMigrationPage.tsx|1|7|정적 참조 수집 / 기능 E2E 대기|
|42|[검토·승인](http://172.16.1.232/emission/review-approval)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectReviewPage.tsx|3|9|정적 참조 수집 / 기능 E2E 대기|
|43|[배출량 확정](http://172.16.1.232/emission/finalization)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-carbon-workflow/EmissionCarbonWorkflowPages.tsx|3|7|정적 참조 수집 / 기능 E2E 대기|
|44|[보고서 양식 관리](http://172.16.1.232/admin/emission/report-template)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx|5|34|정적 참조 수집 / 기능 E2E 대기|
|45|[보고서 작성](http://172.16.1.232/emission/report-write)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectReportPage.tsx|2|10|정적 참조 수집 / 기능 E2E 대기|
|46|[보고서 작성 기존 경로](http://172.16.1.232/emission/report_submit)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectReportPage.tsx|2|10|정적 참조 수집 / 기능 E2E 대기|
|47|[관리자 보고서](http://172.16.1.232/admin/emission/survey-report)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx|5|34|정적 참조 수집 / 기능 E2E 대기|
|48|[PDF 출력·발급](http://172.16.1.232/admin/emission/survey-report-print)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx|5|34|정적 참조 수집 / 기능 E2E 대기|
|49|[보고서·인증서 발급 관리](http://172.16.1.232/admin/emission/report-certificates)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/AdminReportCertificatePage.tsx|1|1|정적 참조 수집 / 기능 E2E 대기|
|50|[인증서 관리 후보](http://172.16.1.232/admin/emission/certificates)|미발견|0|0|라우트 결정 필요|
|51|[보고서·인증서 다운로드](http://172.16.1.232/emission/report-download)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionReportDownloadPage.tsx|1|12|정적 참조 수집 / 기능 E2E 대기|
|52|[공개 진위 확인](http://172.16.1.232/home/certificate-verify)|/opt/Resonance/projects/carbonet-frontend/source/src/features/home-entry/HomeCertificateVerifyPage.tsx|1|4|정적 참조 수집 / 기능 E2E 대기|
|53|[관리자 리포트 진위 확인](http://172.16.1.232/admin/emission/survey-report-verify)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx|5|34|정적 참조 수집 / 기능 E2E 대기|
|54|[규제기관 제출](http://172.16.1.232/emission/report-submission)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-regulatory-submission/RegulatorySubmissionPage.tsx|2|16|정적 참조 수집 / 기능 E2E 대기|
|55|[관리자 규제 제출 현황](http://172.16.1.232/admin/emission/regulatory-submissions)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-regulatory-submission/RegulatorySubmissionPage.tsx|2|16|정적 참조 수집 / 기능 E2E 대기|
|56|[배출 현황 대시보드](http://172.16.1.232/emission/index)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-dashboard/EmissionDashboardPage.tsx|1|32|정적 참조 수집 / 기능 E2E 대기|
|57|[프로젝트 완료](http://172.16.1.232/emission/project-completion)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/ProjectCompletionPages.tsx|2|10|정적 참조 수집 / 기능 E2E 대기|
|58|[관리자 프로젝트 완료 관리](http://172.16.1.232/admin/emission/project-completion)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/ProjectCompletionPages.tsx|2|10|정적 참조 수집 / 기능 E2E 대기|
|59|[다운로드·공유 이력](http://172.16.1.232/mypage/download-history)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/ReportAccessHistoryPages.tsx|2|1|정적 참조 수집 / 기능 E2E 대기|
|60|[관리자 보고서 접근 이력](http://172.16.1.232/admin/emission/report-access-history)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-project-list/ReportAccessHistoryPages.tsx|2|1|정적 참조 수집 / 기능 E2E 대기|
|61|[데이터 변경 이력](http://172.16.1.232/admin/emission/data_history)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-history/EmissionDataHistoryMigrationPage.tsx|2|9|정적 참조 수집 / 기능 E2E 대기|
|62|[감사 로그](http://172.16.1.232/admin/emission/audit-log)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-data-history/EmissionDataHistoryMigrationPage.tsx|2|9|정적 참조 수집 / 기능 E2E 대기|
|63|[LCI DB 조회](http://172.16.1.232/emission/lci)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-lci/EmissionLciMigrationPage.tsx|1|8|정적 참조 수집 / 기능 E2E 대기|
|64|[LCI 분류 관리](http://172.16.1.232/admin/emission/lci-classification)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-lci-classification/EmissionLciClassificationMigrationPage.tsx|1|6|정적 참조 수집 / 기능 E2E 대기|
|65|[LCA 분석](http://172.16.1.232/emission/lca)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-lca/EmissionLcaMigrationPage.tsx|1|12|정적 참조 수집 / 기능 E2E 대기|
|66|[설문·제품 데이터 관리](http://172.16.1.232/admin/emission/survey-admin)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx|1|14|정적 참조 수집 / 기능 E2E 대기|
|67|[설문 업로드 데이터](http://172.16.1.232/admin/emission/survey-admin-data)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-admin-data/EmissionSurveyAdminDataMigrationPage.tsx|2|4|정적 참조 수집 / 기능 E2E 대기|
|68|[LCA 요약보고서 출력](http://172.16.1.232/admin/emission/survey-report-lca-summary)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx|5|34|정적 참조 수집 / 기능 E2E 대기|
|69|[감축 시나리오](http://172.16.1.232/emission/reduction)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-reduction/EmissionReductionMigrationPage.tsx|1|9|정적 참조 수집 / 기능 E2E 대기|
|70|[감축 전략 시뮬레이션](http://172.16.1.232/emission/simulate)|/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-simulate/EmissionSimulateMigrationPage.tsx|1|31|정적 참조 수집 / 기능 E2E 대기|

## 작업 순서 조정

1. 기존 번호를 유지한다. 01 목록부터 검수하되 03 등록 전에 B01 정책을 확정한다.
2. 22 활동자료 착수 전에 B02~B04 사업장 스냅샷/중복검사/계산 연결을 함께 설계한다. 화면만 먼저 완성 처리하지 않는다.
3. B05~B08은 해당 번호의 완료조건에 포함한다.
4. 각 화면마다 입력→저장→재조회→다음 화면→다른 계정 권한 검증 결과를 기록한 뒤 사용자 컨펌을 받는다.
5. 미검증 항목을 임의 기본값이나 성공 표시로 덮지 않는다.

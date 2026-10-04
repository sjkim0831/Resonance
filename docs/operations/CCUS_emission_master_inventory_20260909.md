# CCUS 탄소배출 전체 메뉴·페이지 기준 목록 및 작업 순서

기준일: 2026-09-09 / 상태: 목록 작성 완료·사용자 검토 대기 / 실제 업무 E2E: 미검증

## 1. 범위와 집계

- 직접 탄소배출 경로: **67개**. /emission/* 및 /admin/emission/* 기준, 영문 경로는 같은 페이지로 통합.
- 작업 순서표: **70개**. 직접 경로와 공개 진위확인·공통 업무 실행·다운로드 이력 포함. 동일 페이지의 탭은 부록에서 보존하며 독립 완성 화면 수로 세지 않는다.
- 추가 예정/생성형 탄소배출 경로: **64개**. 실제 전용 화면 구현 여부 미확인, 누락시키지 않고 별도 보관.
- 원본 검색 결과: 메뉴 286행, 화면 등록 252행, 관련 절차 72행, 연결 301행, 소스 경로 참조 135행. 이는 LCA·감축·인증 등 연관 후보도 포함한 수이며 독립 화면 수가 아니다.
- 수집원: 운영 PostgreSQL 메뉴·화면 등록·프로세스/절차·연결 + 현재 프런트엔드 src/app/routes + 기존 60항목 체크리스트·19화면 업무 원장.
- 한계: 소스에 등록되었다는 것은 렌더링·API·DB 저장 성공을 뜻하지 않는다. 경로 문자열 기준 수집 외에 런타임 동적 메뉴와 화면 내부 팝업/탭은 페이지별 검수에서 추가 확인한다. 누락 0건의 보증이 아니다.
- 이번 작업은 읽기 조회 및 문서 생성만 수행. 메뉴·업무 단계·업무 데이터·화면 코드 변경 없음.

## 2. 순서 원칙

아래 번호는 **개발·검수 순서**다. 사용자가 매번 70개 화면을 모두 통과하는 순서가 아니다.
- 일반 업무: 프로젝트 선택 → (신규일 때 등록) → 상세 → 사업장/배출원·범위 → 자료 입력 → 검사·보완 → 계산·근거 → 검토·확정 → 보고·발급 → 필요 시 규제 제출 → 마감.
- 사업장이 없으면 02번을 먼저 수행한다. 계수·검증 규칙 등 관리자 기준정보는 최초 준비 또는 변경 시에만 수행한다.
- 등록에 담당자/결재자를 강제하지 않는 것이 최신 요구다. 공유 조회와 업무 수정/결재 권한은 분리한다. 현재 코드가 이 요구를 모두 충족하는 것은 아니다.
- 프로젝트 ID·사업장 ID·산정기간·입력자료 버전·계수 버전·결과 버전의 전달을 페이지별로 검증한다.
- 동일 페이지 재사용은 정상일 수 있다. menuCode/tab/mode에 따라 실제 기능이 달라지는지 확인 후 통합 여부 결정.
- 반려는 원자료 보완→재산정→재검증으로 돌아간다. 보고서·규제 제출의 적용 여부도 별도 조건으로 관리한다.

## 3. 진행 순서표

|순서|업무 묶음|페이지·메뉴|주소|주요 확인 기능|경로 근거|상태|
|---:|---|---|---|---|---|---|
|01|프로젝트·사업장 준비|배출량 프로젝트 목록|[/emission/project_list](http://172.16.1.232/emission/project_list)|프로젝트 검색·선택·새 등록 진입|소스 확인|검수 대기|
|02|프로젝트·사업장 준비|사업장·배출원 원장|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|회사 소속 사업장 등록·활성 상태·배출원 연결; 사업장 없을 때 등록 전에 수행|소스 확인|검수 대기|
|03|프로젝트·사업장 준비|프로젝트 등록|[/emission/project/create](http://172.16.1.232/emission/project/create)|프로젝트명·복수 사업장·산정기간 저장; 담당자 선택은 등록 필수에서 분리|소스 확인|검수 대기|
|04|프로젝트·사업장 준비|프로젝트 상세|[/emission/project/detail](http://172.16.1.232/emission/project/detail)|저장값 재조회·사업장별 현황·후속 업무 진입; 프로젝트 ID 필요|소스 확인|검수 대기|
|05|프로젝트·사업장 준비|프로세스 진행|[/emission/project/progress](http://172.16.1.232/emission/project/progress)|단계 현황·다음 업무; 상세와 중복 통합 여부 확인|소스 확인|검수 대기|
|06|프로젝트·사업장 준비|프로젝트 포트폴리오|[/emission/project-portfolio](http://172.16.1.232/emission/project-portfolio)|여러 프로젝트 비교; 목록과 기능 차이 확인|소스 확인|검수 대기|
|07|프로젝트·사업장 준비|관리자 프로젝트 운영|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|전체 회사 운영·제출·지연·승인 현황; menuCode별 기능 구분 검증|소스 확인|검수 대기|
|08|프로젝트·사업장 준비|프로젝트 사전 설정|[/admin/emission/project-prerequisites](http://172.16.1.232/admin/emission/project-prerequisites)|회사·사업장 준비 상태; 담당자 미지정만으로 등록 차단하지 않도록 검토|소스 확인|검수 대기|
|09|프로젝트·사업장 준비|프로젝트 설정 후보|[/emission/project/settings](http://172.16.1.232/emission/project/settings)|DB 화면 등록만 확인; 전용 소스 경로 미발견, 상세 편집으로 통합 우선 검토|DB 등록만|검수 대기|
|10|배출원·산정 범위|배출 정의 관리|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|시설·배출원·연료·에너지·물질·Scope·단위 기준; menuCode별 하위 기능 점검|소스 확인|검수 대기|
|11|배출원·산정 범위|조직경계·사업장별 범위 설정|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|선택 사업장·배출원별 포함 범위·제외 사유·Scope·기준 버전 확정|소스 확인|검수 대기|
|12|배출원·산정 범위|조직경계 검토|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|경계·통합 기준 검토; 사용자 설정과 동일 프로젝트 연결|소스 확인|검수 대기|
|13|계산 전 기준정보|배출계수 관리|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|계수·단위·적용연도·출처·유효기간 관리|소스 확인|검수 대기|
|14|계산 전 기준정보|ecoinvent 계수 관리|[/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent)|필요한 경우 외부 계수 검색·선택·버전 확인|소스 확인|검수 대기|
|15|계산 전 기준정보|산정식 관리|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|계수·활동량·단위 환산 계산 규칙 관리|소스 확인|검수 대기|
|16|계산 전 기준정보|GWP 값 관리|[/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)|가스별 적용 기준·버전 관리|소스 확인|검수 대기|
|17|계산 전 기준정보|배출 변수 관리|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|변수·사업장·프로젝트 연결; 현황 메뉴와 주소 혼용 점검|소스 확인|검수 대기|
|18|계산 전 기준정보|입력 양식 관리|[/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template)|입력 항목·필수값·단위·파일 양식|소스 확인|검수 대기|
|19|계산 전 기준정보|검증 규칙 관리|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|누락·중복·기간·단위·이상치 검사|소스 확인|검수 대기|
|20|계산 전 기준정보|승인·알림 정책|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|결재·반려·완료 조건; 실제 승인 작업과 설정 구분|소스 확인|검수 대기|
|21|활동자료 수집|자료 제출 요청|[/emission/data-request](http://172.16.1.232/emission/data-request)|필요 시 사업장·기간·자료 항목·수신자 지정 후 요청|소스 확인|검수 대기|
|22|활동자료 수집|활동자료 관리|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|사업장별 자료 조회·입력·수정·저장|소스 확인|검수 대기|
|23|활동자료 수집|활동자료 입력 기존 경로|[/emission/data_input](http://172.16.1.232/emission/data_input)|활동자료 관리와 중복 여부 확인; 무조건 새 화면 생성 금지|소스 확인|검수 대기|
|24|활동자료 수집|엑셀 업로드·원본 열 매핑|[/emission/excel-upload](http://172.16.1.232/emission/excel-upload)|사업장 선택·미리보기·열 매핑·검사·일괄 저장·원본 보존|소스 확인|검수 대기|
|25|활동자료 수집|증빙 자료함|[/emission/evidence](http://172.16.1.232/emission/evidence)|자료행과 증빙 연결·조회·버전|소스 확인|검수 대기|
|26|활동자료 수집|관리자 증빙 관리|[/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)|증빙 누락·접근권한·보관 관리|소스 확인|검수 대기|
|27|활동자료 수집|외부 데이터 연계|[/emission/external-data](http://172.16.1.232/emission/external-data)|선택적으로 외부 자료 수집·중복 방지·오류 확인|소스 확인|검수 대기|
|28|활동자료 수집|외부 시스템 연계 관리|[/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link)|연계 설정·자격정보 보호·연계 실패 재처리|소스 확인|검수 대기|
|29|활동자료 수집|내 업무|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|권한과 배정에 맞는 업무 조회·프로젝트 선택|소스 확인|검수 대기|
|30|활동자료 수집|프로젝트 업무 배정|[/emission/work-assignment](http://172.16.1.232/emission/work-assignment)|업무 인계가 필요할 때 담당자·결재자 선택; 프로젝트 등록과 분리|소스 확인|검수 대기|
|31|활동자료 수집|공통 업무 실행|[/work/execution](http://172.16.1.232/work/execution)|업무 ID·프로젝트·사업장·액터 유지|소스 확인|검수 대기|
|32|활동자료 수집|마감·지연 현황|[/emission/deadline-status](http://172.16.1.232/emission/deadline-status)|요청된 업무의 제출 기한·지연 확인|소스 확인|검수 대기|
|33|자료 품질·보완|데이터 검증|[/emission/data-validation](http://172.16.1.232/emission/data-validation)|자료 오류·누락·단위·기간 검사|소스 확인|검수 대기|
|34|자료 품질·보완|검증·보정 공통 화면|[/emission/validate](http://172.16.1.232/emission/validate)|자료 검토와 산정결과 검증 단계 구분; 승인 탭 포함|소스 확인|검수 대기|
|35|자료 품질·보완|관리자 검증|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|검증 대기·보완 요청·독립 검토|소스 확인|검수 대기|
|36|자료 품질·보완|보완·재산정|[/emission/correction](http://172.16.1.232/emission/correction)|지적사항→원자료 보완→재제출→재산정 흐름|소스 확인|검수 대기|
|37|산정·결과|배출량 산정·계수 매핑|[/emission/calculation](http://172.16.1.232/emission/calculation)|배출원별 활동량·계수·단위·방법 확인 후 계산; 범위 미설정 차단|소스 확인|검수 대기|
|38|산정·결과|산정 결과|[/emission/calculation-results](http://172.16.1.232/emission/calculation-results)|사업장·Scope별 합계·원자료·계수·계산식 추적|소스 확인|검수 대기|
|39|산정·결과|결과 조회 기존 경로|[/emission/result](http://172.16.1.232/emission/result)|산정 결과 화면과 역할·중복 확인|소스 확인|검수 대기|
|40|산정·결과|관리자 산정 결과 목록|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|프로젝트·버전별 결과 검색|소스 확인|검수 대기|
|41|산정·결과|관리자 결과 상세|[/admin/emission/result_detail](http://172.16.1.232/admin/emission/result_detail)|계산 근거·버전·오류·검증 결과; 결과 ID 필요|소스 확인|검수 대기|
|42|검토·승인·확정|검토·승인|[/emission/review-approval](http://172.16.1.232/emission/review-approval)|검토 의견·반려·승인·실제 처리자 기록|소스 확인|검수 대기|
|43|검토·승인·확정|배출량 확정|[/emission/finalization](http://172.16.1.232/emission/finalization)|승인 버전 잠금·변경 승인·확정 이력|소스 확인|검수 대기|
|44|보고·발급·제출|보고서 양식 관리|[/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template)|보고 대상·필수 항목·버전 설정|소스 확인|검수 대기|
|45|보고·발급·제출|보고서 작성|[/emission/report-write](http://172.16.1.232/emission/report-write)|확정 결과 반영·필수 정보·미리보기|소스 확인|검수 대기|
|46|보고·발급·제출|보고서 작성 기존 경로|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|작성·발급 주 화면과 중복 통합 여부 확인|소스 확인|검수 대기|
|47|보고·발급·제출|관리자 보고서|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|기존 설문 리포트와 기업 배출 보고서 용도 구분|소스 확인|검수 대기|
|48|보고·발급·제출|PDF 출력·발급|[/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print)|원본 생성·발급 식별자·해시·다운로드|소스 확인|검수 대기|
|49|보고·발급·제출|보고서·인증서 발급 관리|[/admin/emission/report-certificates](http://172.16.1.232/admin/emission/report-certificates)|발급·재발급·취소·원본 연결|소스 확인|검수 대기|
|50|보고·발급·제출|인증서 관리 후보|[/admin/emission/certificates](http://172.16.1.232/admin/emission/certificates)|DB 등록만 확인; 실제 라우트 확인 전 완료 처리 금지|DB 등록만|검수 대기|
|51|보고·발급·제출|보고서·인증서 다운로드|[/emission/report-download](http://172.16.1.232/emission/report-download)|권한 검사·발급 원본 다운로드|소스 확인|검수 대기|
|52|보고·발급·제출|공개 진위 확인|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|발급 원장·업로드 원본·해시 검증|소스 확인|검수 대기|
|53|보고·발급·제출|관리자 리포트 진위 확인|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|공개 진위확인과 판정 일치|소스 확인|검수 대기|
|54|보고·발급·제출|규제기관 제출|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|대상 업무에 한해 제출본·접수번호·접수증·반려 결과|소스 확인|검수 대기|
|55|보고·발급·제출|관리자 규제 제출 현황|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|제출 상태·오류·재제출·접수 이력|소스 확인|검수 대기|
|56|마감·조회·감사|배출 현황 대시보드|[/emission/index](http://172.16.1.232/emission/index)|실제 산정 결과의 기간·사업장별 집계; 미산정과 0 구분|소스 확인|검수 대기|
|57|마감·조회·감사|프로젝트 완료|[/emission/project-completion](http://172.16.1.232/emission/project-completion)|마감 조건·미완료 업무·차기 프로젝트 연결|소스 확인|검수 대기|
|58|마감·조회·감사|관리자 프로젝트 완료 관리|[/admin/emission/project-completion](http://172.16.1.232/admin/emission/project-completion)|마감·해제·차기 복사 검토|소스 확인|검수 대기|
|59|마감·조회·감사|다운로드·공유 이력|[/mypage/download-history](http://172.16.1.232/mypage/download-history)|보고서 접근·공유 기록|소스 확인|검수 대기|
|60|마감·조회·감사|관리자 보고서 접근 이력|[/admin/emission/report-access-history](http://172.16.1.232/admin/emission/report-access-history)|다운로드·공유·접근 감사|소스 확인|검수 대기|
|61|마감·조회·감사|데이터 변경 이력|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|원자료·계수·결과 변경자·변경 전후 연결|소스 확인|검수 대기|
|62|마감·조회·감사|감사 로그|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|프로젝트·업무·실패 추적 및 보관 정책|소스 확인|검수 대기|
|63|선택 연계·별도 업무|LCI DB 조회|[/emission/lci](http://172.16.1.232/emission/lci)|필요한 계수 선택 시만 연계; 프로젝트 등록의 선행 필수 아님|소스 확인|검수 대기|
|64|선택 연계·별도 업무|LCI 분류 관리|[/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)|LCA 연계용 기준 분류|소스 확인|검수 대기|
|65|선택 연계·별도 업무|LCA 분석|[/emission/lca](http://172.16.1.232/emission/lca)|제품 LCA 별도 업무; 기업 배출량 산정과 구분|소스 확인|검수 대기|
|66|선택 연계·별도 업무|설문·제품 데이터 관리|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|제품·공정·LCA 업무와 기업 배출량 업무 구분|소스 확인|검수 대기|
|67|선택 연계·별도 업무|설문 업로드 데이터|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|원본 데이터셋·제품/공정 매핑; 활동자료 업로드와 역할 구분|소스 확인|검수 대기|
|68|선택 연계·별도 업무|LCA 요약보고서 출력|[/admin/emission/survey-report-lca-summary](http://172.16.1.232/admin/emission/survey-report-lca-summary)|제품 LCA용 선택 연계|소스 확인|검수 대기|
|69|선택 연계·별도 업무|감축 시나리오|[/emission/reduction](http://172.16.1.232/emission/reduction)|확정 배출량을 활용하는 별도 감축 업무|소스 확인|검수 대기|
|70|선택 연계·별도 업무|감축 전략 시뮬레이션|[/emission/simulate](http://172.16.1.232/emission/simulate)|시나리오 분석; 배출량 산정 필수 단계 아님|소스 확인|검수 대기|

## 4. 기존 60항목 체크리스트의 누락 방지

기존 60항목은 기능 검토 단위이고 현재 순서표는 URL 단위다. 60개를 폐기하거나 70개로 단순 치환하지 않는다. 다음 전용 기능은 URL 존재만으로 완료 처리하지 않는다.

|기존 검토 항목|연결할 순서|판정|
|---|---|---|
|시설·배출원 관리 / 사업장·배출원 검토|02,10,11,12|원장·정의·경계 화면 기능 검수|
|산정기간·범위 계획 / 기준연도·재산정 정책 / 산정 계획 검토 / 기준 버전 확정|03,11~16|별도 필수 기능 누락 여부 검토; 새 URL 아직 확정 안 함|
|제출 현황·독촉 / 보완 요청·처리|07,21,32~36|공유 화면의 실제 동작 확인|
|단위·환산·GWP / 배출원별 계수 매핑|10,13~16,37|기준→입력→계산 연결 확인|
|버전 비교·재산정 / 실행 실패 관리 / 실패 재처리|36~41,28,62|전용 기능 구현 여부 미확인|
|내 결재함 / 확정 해제·변경 승인|20,29,42,43|프로젝트·실제 결재 권한 검증|
|기간·사업장 비교 / 차기 복사 / 전체 실적|06,56~58|별도 화면 신설보다 기존 화면 기능 우선 검수|
|사용자 이력 / 결재·알림 정책 / 변경 감사|20,29~32,59~62|후속 기능과 보관 정책 점검|

## 5. 우선 확인된 불일치

1. 기존 원장은 담당자 사전 배정을 완료 조건으로 기술하지만 최신 요구는 등록 시 담당자 선택 불필요다. 이전 DESIGN_APPROVED 표시는 이번 기준 목록의 승인으로 승계하지 않는다.
2. 등록·상세는 H102 하위 메뉴에 use_at=Y, expsr_at=N으로 존재한다. 메뉴에서 숨겨진 것과 미구현을 구분한다.
3. 관리자 A103의 여러 메뉴가 project-operations 하나에 menuCode만 다르게 연결된다. 서로 다른 기능이 실제 제공되는지 검증 필요.
4. 활동자료/data_input, 결과/result, 보고서/report_submit 등 유사 경로를 모두 보존했다. 중복 판정 전 삭제하지 않는다.
5. project/settings, admin/emission/certificates는 DB 등록이 있으나 수집한 소스 라우트에 없다. 정상 화면으로 취급하지 않는다.
6. 일부 메뉴명과 대상이 부자연스럽다: 프로젝트 진행 현황→site-management, 자료 수집 상위→factor-management 등. 하위 메뉴와 액터 관점으로 다시 검수한다.

## 6. 메뉴 원본 전체 후보 — 비활성·숨김·쿼리 차이 보존

LCA·감축·교육 인증처럼 검색에 포함된 인접 업무도 삭제하지 않고 보존한다. 탄소배출 구현 필수로 자동 편입하지 않는다. use=사용, expose=표시이며 실제 계정의 권한 필터는 별도다.

|코드|메뉴명|원본 주소|use/expose|
|---|---|---|---|
|A002|배출량 관리|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|N/N|
|A0020101|배출지·배출원 원장|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|N/N|
|A0020102|배출계수 관리|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|N/N|
|A0020103|산정식 관리|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|N/N|
|A0020104|입력 템플릿 관리|[/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template)|N/N|
|A0020105|배출지 관리|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|N/N|
|A0020201|검증 관리|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|N/N|
|A0020202|검증 규칙 관리|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|N/N|
|A0020203|승인 워크플로우 관리|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|N/N|
|A00203|산정·보고|#|N/N|
|A0020301|산정 결과 관리|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|N/N|
|A0020302|보고서 템플릿 관리|[/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template)|N/N|
|A0020303|GWP 값 관리|[/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)|N/N|
|A0020304|ecoinvent 배출계수 관리|[/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent)|N/N|
|A0020401|증빙 관리|[/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)|N/N|
|A0020402|데이터 변경 이력|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|N/N|
|A0020403|감사 로그|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|N/N|
|A0020404|외부 시스템 연계|[/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link)|N/N|
|A0020501|LCA 데이터 수집|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|N/N|
|A0020502|LCA 업로드 데이터|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|N/N|
|A0020503|LCI 분류 관리|[/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)|N/N|
|A0020504|LCA 데이터 정의|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|N/N|
|A0020513|리포트 진위확인|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|N/N|
|A00303|인증서|#|N/N|
|A0030301|인증서 발급 대기|[/admin/certificate/pending_list](http://172.16.1.232/admin/certificate/pending_list)|N/N|
|A0030302|인증서 승인|[/admin/certificate/approve](http://172.16.1.232/admin/certificate/approve)|N/N|
|A0030304|인증서 통계|[/admin/certificate/statistics](http://172.16.1.232/admin/certificate/statistics)|N/N|
|A0030306|인증서 감사 로그|[/admin/certificate/audit-log](http://172.16.1.232/admin/certificate/audit-log)|N/N|
|A1010103|프로젝트 진행 현황|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|Y/Y|
|A1010105|마감·지연 현황|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|Y/Y|
|A1010106|데이터 품질 현황|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|Y/Y|
|A10103|프로젝트 진행 현황|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|Y/Y|
|A1010301|프로젝트 진행 현황|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|N/N|
|A10104|승인 대기|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|Y/Y|
|A1010401|승인 대기|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|N/N|
|A10105|마감·지연 현황|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|Y/Y|
|A1010501|마감·지연 현황|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|N/N|
|A10106|데이터 품질 현황|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|Y/Y|
|A1010601|데이터 품질 현황|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|N/N|
|A1020204|사업장|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|Y/Y|
|A103|탄소배출 운영|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|Y/Y|
|A10301|프로젝트 운영|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|Y/Y|
|A1030101|배출량 프로젝트|[/emission/project_list](http://172.16.1.232/emission/project_list)|Y/Y|
|A1030102|프로젝트 상세|[/admin/emission/project-operations?menuCode=A1030102](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030102)|Y/Y|
|A1030103|진행 현황|[/admin/emission/project-operations?menuCode=A1030103](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030103)|Y/Y|
|A1030104|담당자 배정|[/admin/emission/project-operations?menuCode=A1030104](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030104)|Y/Y|
|A1030105|마감·지연 관리|[/admin/emission/project-operations?menuCode=A1030105](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030105)|Y/Y|
|A1030106|프로젝트 확정·해제|[/admin/emission/project-operations?menuCode=A1030106](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030106)|Y/Y|
|A1030107|검증 규칙|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|N/N|
|A1030108|증빙 관리|[/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)|N/N|
|A1030109|보고서 생성·제출·진위 확인 관리자 업무 화면|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|Y/N|
|A1030110|배출량 프로젝트 운영|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|Y/Y|
|A1030111|프로젝트 사전 설정|[/admin/emission/project-prerequisites](http://172.16.1.232/admin/emission/project-prerequisites)|Y/Y|
|A10302|자료 수집|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|Y/Y|
|A1030201|활동자료 제출 현황|[/admin/emission/project-operations?menuCode=A1030201](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030201)|Y/Y|
|A1030202|엑셀 업로드 관리|[/admin/emission/project-operations?menuCode=A1030202](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030202)|Y/Y|
|A1030203|증빙자료 관리|[/admin/emission/project-operations?menuCode=A1030203](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030203)|Y/Y|
|A1030204|데이터 요청 양식|[/admin/emission/project-operations?menuCode=A1030204](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030204)|Y/Y|
|A1030205|외부 연계 현황|[/admin/emission/project-operations?menuCode=A1030205](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030205)|Y/Y|
|A10303|검증·승인|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|Y/Y|
|A1030301|검증 대기열|[/admin/emission/project-operations?menuCode=A1030301](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030301)|Y/Y|
|A1030302|오류·보완 관리|[/admin/emission/project-operations?menuCode=A1030302](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030302)|Y/Y|
|A1030303|승인 대기|[/admin/emission/project-operations?menuCode=A1030303](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030303)|Y/Y|
|A1030304|반려·재제출|[/admin/emission/project-operations?menuCode=A1030304](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030304)|Y/Y|
|A1030305|승인 이력|[/admin/emission/project-operations?menuCode=A1030305](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030305)|Y/Y|
|A1030307|검증 규칙|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|Y/Y|
|A1030308|증빙 관리|[/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)|Y/Y|
|A10304|결과·보고|[/admin/emission/project-operations?menuCode=A10304](http://172.16.1.232/admin/emission/project-operations?menuCode=A10304)|Y/Y|
|A1030401|산정 결과|[/admin/emission/project-operations?menuCode=A1030401](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030401)|Y/Y|
|A1030402|보고서 관리|[/admin/emission/project-operations?menuCode=A1030402](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030402)|Y/Y|
|A1030403|규제 제출 현황|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|Y/Y|
|A1030404|인증서 발급|[/admin/emission/project-operations?menuCode=A1030404](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030404)|Y/Y|
|A1030405|보고서 진위 확인|[/admin/emission/project-operations?menuCode=A1030405](http://172.16.1.232/admin/emission/project-operations?menuCode=A1030405)|Y/Y|
|A104|LCA 운영|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|Y/Y|
|A10401|LCA 프로젝트|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|Y/Y|
|A1040101|LCA 프로젝트 관리|[/admin/emission/survey-admin?menuCode=A1040101](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040101)|Y/Y|
|A1040102|제품·공정 관리|[/admin/emission/survey-admin?menuCode=A1040102](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040102)|Y/Y|
|A1040103|데이터 수집 현황|[/admin/emission/survey-admin?menuCode=A1040103](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040103)|Y/Y|
|A1040104|검토·승인|[/admin/emission/survey-admin?menuCode=A1040104](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040104)|Y/Y|
|A1040105|LCA 요약 보고서|[/admin/emission/survey-report-lca-summary](http://172.16.1.232/admin/emission/survey-report-lca-summary)|N/N|
|A1040106|GWP 값 관리|[/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)|N/N|
|A10402|LCA 데이터|[/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)|Y/Y|
|A1040201|업로드 데이터셋|[/admin/emission/survey-admin?menuCode=A1040201](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040201)|Y/Y|
|A1040202|물질 매핑|[/admin/emission/survey-admin?menuCode=A1040202](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040202)|Y/Y|
|A1040203|LCI 분류|[/admin/emission/survey-admin?menuCode=A1040203](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040203)|Y/Y|
|A1040204|LCI 데이터베이스|[/admin/emission/survey-admin?menuCode=A1040204](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040204)|Y/Y|
|A1040205|제품·부산물 기준|[/admin/emission/survey-admin?menuCode=A1040205](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040205)|Y/Y|
|A1040206|기능 단위·시스템 경계|[/admin/emission/survey-admin?menuCode=A1040206](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040206)|Y/Y|
|A10403|LCA 산정·보고|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|Y/Y|
|A1040301|산정 결과|[/admin/emission/survey-admin?menuCode=A1040301](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040301)|Y/Y|
|A1040302|영향평가 결과|[/admin/emission/survey-admin?menuCode=A1040302](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040302)|Y/Y|
|A1040303|검토·확정|[/admin/emission/survey-admin?menuCode=A1040303](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040303)|Y/Y|
|A1040304|보고서 생성|[/admin/emission/survey-admin?menuCode=A1040304](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040304)|Y/Y|
|A1040305|보고서 양식|[/admin/emission/survey-admin?menuCode=A1040305](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040305)|Y/Y|
|A1040306|진위 확인|[/admin/emission/survey-admin?menuCode=A1040306](http://172.16.1.232/admin/emission/survey-admin?menuCode=A1040306)|Y/Y|
|A1040307|LCA 데이터 수집|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|Y/Y|
|A1040308|LCA 업로드 데이터|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|Y/Y|
|A1040309|LCI 분류 관리|[/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)|Y/Y|
|A1040310|LCA 데이터 정의|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|Y/Y|
|A105|감축 운영|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|Y/Y|
|A10501|목표·과제|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|Y/Y|
|A1050101|감축 목표 관리|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|Y/Y|
|A1050102|감축 과제 관리|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|Y/Y|
|A1050103|과제 검토·승인|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|Y/Y|
|A1050104|감축 실적 관리|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|Y/Y|
|A1050105|시나리오 관리|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|Y/Y|
|A1050106|감축계수·산정 기준|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|Y/Y|
|A1050107|비용·투자 관리|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|Y/Y|
|A1050108|감축 보고서|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|Y/Y|
|A10502|검토·성과|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|N/N|
|A1050203|감축 결과 관리|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|N/N|
|A10503|기준·비용·보고|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|N/N|
|A1050304|감축 데이터 이력|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|N/N|
|A106|기준정보|[/admin/system/code](http://172.16.1.232/admin/system/code)|N/Y|
|A10601|조직·배출원|[/admin/system/code](http://172.16.1.232/admin/system/code)|N/Y|
|A1060101|조직·사업장|[/admin/emission/definition-studio?menuCode=A1060101](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060101)|Y/Y|
|A1060102|배출시설|[/admin/emission/definition-studio?menuCode=A1060102](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060102)|Y/Y|
|A1060103|배출원|[/admin/emission/definition-studio?menuCode=A1060103](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060103)|Y/Y|
|A1060104|연료·에너지|[/admin/emission/definition-studio?menuCode=A1060104](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060104)|Y/Y|
|A1060105|물질|[/admin/emission/definition-studio?menuCode=A1060105](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060105)|Y/Y|
|A1060106|섹션 관리|[/admin/system/section-management](http://172.16.1.232/admin/system/section-management)|N/N|
|A10602|산정 기준|[/admin/system/page-management](http://172.16.1.232/admin/system/page-management)|N/Y|
|A1060201|배출계수|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|Y/Y|
|A1060202|ecoinvent 배출계수|[/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent)|Y/Y|
|A1060203|GWP|[/admin/emission/definition-studio?menuCode=A1060203](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060203)|Y/Y|
|A1060204|단위·환산식|[/admin/emission/definition-studio?menuCode=A1060204](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060204)|Y/Y|
|A1060205|계산 규칙|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|Y/Y|
|A1060206|Scope 분류|[/admin/emission/definition-studio?menuCode=A1060206](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060206)|Y/Y|
|A1060207|산정 방법론|[/admin/emission/definition-studio?menuCode=A1060207](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060207)|Y/Y|
|A10603|데이터 기준|[/admin/system/theme-management](http://172.16.1.232/admin/system/theme-management)|N/Y|
|A1060301|입력 항목|[/admin/emission/definition-studio?menuCode=A1060301](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060301)|Y/Y|
|A1060302|입력 양식|[/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template)|Y/Y|
|A1060303|데이터 정의|[/admin/emission/definition-studio?menuCode=A1060303](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060303)|Y/Y|
|A1060304|코드·분류|[/admin/emission/definition-studio?menuCode=A1060304](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060304)|Y/Y|
|A1060305|LCI 분류|[/admin/emission/definition-studio?menuCode=A1060305](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060305)|Y/Y|
|A1060306|품질 등급|[/admin/emission/definition-studio?menuCode=A1060306](http://172.16.1.232/admin/emission/definition-studio?menuCode=A1060306)|Y/Y|
|A10604|코드·분류|[/admin/emission/definition-studio?menuCode=A10604](http://172.16.1.232/admin/emission/definition-studio?menuCode=A10604)|Y/Y|
|A107|검증·워크플로|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|Y/Y|
|A10701|검증 규칙|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|Y/Y|
|A1070101|검증 규칙|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|Y/Y|
|A1070102|이상치 규칙|[/admin/emission/validation-rule?menuCode=A1070102](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070102)|Y/Y|
|A1070103|필수 입력 규칙|[/admin/emission/validation-rule?menuCode=A1070103](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070103)|Y/Y|
|A1070104|품질 점수 기준|[/admin/emission/validation-rule?menuCode=A1070104](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070104)|Y/Y|
|A1070105|승인선|[/admin/emission/validation-rule?menuCode=A1070105](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070105)|Y/Y|
|A1070106|승인 워크플로|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|Y/Y|
|A1070107|Task 템플릿|[/admin/emission/validation-rule?menuCode=A1070107](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070107)|Y/Y|
|A1070108|단계별 완료 조건|[/admin/emission/validation-rule?menuCode=A1070108](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070108)|Y/Y|
|A1070109|진행률 가중치|[/admin/emission/validation-rule?menuCode=A1070109](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070109)|Y/Y|
|A1070110|마감·알림 정책|[/admin/emission/validation-rule?menuCode=A1070110](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070110)|Y/Y|
|A1070111|자동 처리 규칙|[/admin/emission/validation-rule?menuCode=A1070111](http://172.16.1.232/admin/emission/validation-rule?menuCode=A1070111)|Y/Y|
|A10702|승인선·워크플로|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|N/N|
|A1070201|워크플로 관리|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|N/N|
|A1070202|승인 워크플로|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|N/N|
|A10703|Task·완료 조건|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|N/N|
|A1070304|감사 로그|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|N/N|
|A10704|마감·자동화 정책|[/admin/emission/validation-rule?menuCode=A10704](http://172.16.1.232/admin/emission/validation-rule?menuCode=A10704)|Y/Y|
|A1090106|인증서 통계|[/admin/certificate/statistics](http://172.16.1.232/admin/certificate/statistics)|N/N|
|A10903|인증서|[/admin/trade/statistics](http://172.16.1.232/admin/trade/statistics)|Y/Y|
|A1090303|인증서 검토|[/admin/trade/approve?menuCode=A1090303](http://172.16.1.232/admin/trade/approve?menuCode=A1090303)|Y/Y|
|A1090304|진위 확인|[/admin/trade/approve?menuCode=A1090304](http://172.16.1.232/admin/trade/approve?menuCode=A1090304)|Y/Y|
|A1090307|인증서 감사 이력|[/admin/trade/approve?menuCode=A1090307](http://172.16.1.232/admin/trade/approve?menuCode=A1090307)|Y/Y|
|A1110304|감사 로그|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|N/Y|
|A1120109|산정 결과 관리|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|Y/Y|
|A1120110|보고서 템플릿 관리|[/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template)|Y/Y|
|A1120111|GWP 값 관리|[/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)|Y/Y|
|A1120112|데이터 변경 이력|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|Y/Y|
|A1120113|외부 시스템 연계|[/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link)|Y/Y|
|A1120117|인증서 승인|[/admin/certificate/approve](http://172.16.1.232/admin/certificate/approve)|Y/Y|
|A1120119|인증서 통계|[/admin/certificate/statistics](http://172.16.1.232/admin/certificate/statistics)|Y/Y|
|A1120121|인증서 감사 로그|[/admin/certificate/audit-log](http://172.16.1.232/admin/certificate/audit-log)|Y/Y|
|H001|탄소배출|emission/index|N/N|
|H00101|배출량 산정|emission/index|N/N|
|H0010101|배출량 관리|emission/project_list|N/N|
|H0010102|데이터 입력|emission/data_input|N/N|
|H0010103|산정/검증|emission/validate|N/N|
|H0010104|보고서 제출|emission/report_submit|N/N|
|H00102|분석|emission/index|N/N|
|H0010201|LCA 분석|emission/lca|N/N|
|H0010202|LCI DB 조회|emission/lci|N/N|
|H0010203|감축 시나리오|emission/reduction|N/N|
|H0010204|시뮬레이션|emission/simulate|N/N|
|H002|보고서·인증서|certificate/index|N/N|
|H00202|인증서|certificate/index|N/N|
|H0020201|인증서 신청|certificate/apply|N/N|
|H0020202|인증서 목록|certificate/list|N/N|
|H0020204|인증서 검증|certificate/verify|N/N|
|H1010102|내 업무 요약|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|Y/Y|
|H1010106|탄소배출·LCA·감축 핵심 지표|#|Y/N|
|H1010107|인증서 진위 확인|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|Y/Y|
|H102|탄소배출 관리|[/emission/index](http://172.16.1.232/emission/index)|Y/Y|
|H10201|현황·프로젝트|[/emission/index](http://172.16.1.232/emission/index)|Y/Y|
|H1020101|배출량 현황|[/emission/index](http://172.16.1.232/emission/index)|Y/Y|
|H1020102|배출량 프로젝트|[/emission/project_list](http://172.16.1.232/emission/project_list)|Y/Y|
|H102010201|새 프로젝트 등록|[/emission/project/create](http://172.16.1.232/emission/project/create)|Y/N|
|H102010202|배출량 프로젝트 상세|[/emission/project/detail](http://172.16.1.232/emission/project/detail)|Y/N|
|H1020103|내 업무|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|Y/Y|
|H1020104|마감·지연 현황|[/emission/deadline-status](http://172.16.1.232/emission/deadline-status)|Y/Y|
|H1020105|검토·승인·확정 사용자 업무 화면|[/emission/validate?tab=approval](http://172.16.1.232/emission/validate?tab=approval)|Y/N|
|H1020106|배출계수 매핑·배출량 산정 사용자 업무 화면|[/emission/calculation](http://172.16.1.232/emission/calculation)|Y/N|
|H1020107|보고서 생성·제출·진위 확인 사용자 업무 화면|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|Y/N|
|H1020108|프로젝트 기본정보 및 책임 확정 사용자 업무 화면|[/emission/project/create](http://172.16.1.232/emission/project/create)|Y/N|
|H10202|활동자료|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|Y/Y|
|H1020201|활동자료 관리|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|Y/Y|
|H1020202|자료 제출 요청|[/emission/data-request](http://172.16.1.232/emission/data-request)|Y/Y|
|H1020203|엑셀 업로드|[/emission/excel-upload](http://172.16.1.232/emission/excel-upload)|Y/Y|
|H1020204|증빙자료|[/emission/evidence](http://172.16.1.232/emission/evidence)|Y/Y|
|H1020205|외부 데이터 연계|[/emission/external-data](http://172.16.1.232/emission/external-data)|Y/Y|
|H10203|산정·검증|[/emission/validate](http://172.16.1.232/emission/validate)|Y/Y|
|H1020301|배출량 산정|[/emission/calculation](http://172.16.1.232/emission/calculation)|Y/Y|
|H1020302|산정 결과|[/emission/calculation-results](http://172.16.1.232/emission/calculation-results)|Y/Y|
|H1020303|데이터 검증|[/emission/data-validation](http://172.16.1.232/emission/data-validation)|Y/Y|
|H1020304|보완·재산정|[/emission/correction](http://172.16.1.232/emission/correction)|Y/Y|
|H10204|확정·보고|#|Y/Y|
|H1020401|검토·승인|[/emission/review-approval](http://172.16.1.232/emission/review-approval)|Y/Y|
|H1020402|배출량 확정|[/emission/finalization](http://172.16.1.232/emission/finalization)|Y/Y|
|H1020403|보고서 작성|[/emission/report-write](http://172.16.1.232/emission/report-write)|Y/Y|
|H1020404|규제기관 제출|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|Y/Y|
|H1020405|인증서·보고서 다운로드|[/emission/report-download](http://172.16.1.232/emission/report-download)|Y/Y|
|H1020406|Scope 1·2·3|#|N/N|
|H1020407|단위 환산|#|N/N|
|H1020408|배출계수 매핑|[/emission/activity-data?tab=mapping](http://172.16.1.232/emission/activity-data?tab=mapping)|N/N|
|H1020409|계산 근거|#|N/N|
|H1020410|변경 이력|#|N/N|
|H1020411|검증 오류|#|N/N|
|H1020412|승인 이력|#|N/N|
|H103|제품 LCA|[/emission/lca](http://172.16.1.232/emission/lca)|Y/Y|
|H10301|LCA 프로젝트|[/emission/lca](http://172.16.1.232/emission/lca)|Y/Y|
|H1030101|LCA 현황|[/emission/lca?menu=H1030101](http://172.16.1.232/emission/lca?menu=H1030101)|Y/Y|
|H1030102|LCA 프로젝트|[/emission/lca?menu=H1030102](http://172.16.1.232/emission/lca?menu=H1030102)|Y/Y|
|H1030103|제품·공정 정보|[/emission/lca?menu=H1030103](http://172.16.1.232/emission/lca?menu=H1030103)|Y/Y|
|H1030104|시스템 경계|[/emission/lca?menu=H1030104](http://172.16.1.232/emission/lca?menu=H1030104)|Y/Y|
|H1030105|기능 단위|[/emission/lca?menu=H1030105](http://172.16.1.232/emission/lca?menu=H1030105)|Y/Y|
|H10302|인벤토리|[/emission/lci](http://172.16.1.232/emission/lci)|Y/Y|
|H1030201|원료·보조재|[/emission/lca?menu=H1030201](http://172.16.1.232/emission/lca?menu=H1030201)|Y/Y|
|H1030202|에너지·스팀|[/emission/lca?menu=H1030202](http://172.16.1.232/emission/lca?menu=H1030202)|Y/Y|
|H1030203|운송|[/emission/lca?menu=H1030203](http://172.16.1.232/emission/lca?menu=H1030203)|Y/Y|
|H1030204|제품·부산물|[/emission/lca?menu=H1030204](http://172.16.1.232/emission/lca?menu=H1030204)|Y/Y|
|H1030205|폐기물·배출물|[/emission/lca?menu=H1030205](http://172.16.1.232/emission/lca?menu=H1030205)|Y/Y|
|H1030206|LCI 데이터 매핑|[/emission/lca?menu=H1030206](http://172.16.1.232/emission/lca?menu=H1030206)|Y/Y|
|H10303|산정·분석|[/emission/lca](http://172.16.1.232/emission/lca)|Y/Y|
|H1030301|LCI 산정|[/emission/lca?menu=H1030301](http://172.16.1.232/emission/lca?menu=H1030301)|Y/Y|
|H1030302|LCIA 영향평가|[/emission/lca?menu=H1030302](http://172.16.1.232/emission/lca?menu=H1030302)|Y/Y|
|H1030303|공정별 기여도|[/emission/lca?menu=H1030303](http://172.16.1.232/emission/lca?menu=H1030303)|Y/Y|
|H1030304|원료별 기여도|[/emission/lca?menu=H1030304](http://172.16.1.232/emission/lca?menu=H1030304)|Y/Y|
|H1030305|민감도 분석|[/emission/lca?menu=H1030305](http://172.16.1.232/emission/lca?menu=H1030305)|Y/Y|
|H1030306|시나리오 비교|[/emission/lca?menu=H1030306](http://172.16.1.232/emission/lca?menu=H1030306)|Y/Y|
|H10304|보고|[/emission/lca](http://172.16.1.232/emission/lca)|Y/Y|
|H1030401|LCA 결과|[/emission/lca?menu=H1030401](http://172.16.1.232/emission/lca?menu=H1030401)|Y/Y|
|H1030402|요약 보고서|[/emission/lca?menu=H1030402](http://172.16.1.232/emission/lca?menu=H1030402)|Y/Y|
|H1030403|상세 보고서|[/emission/lca?menu=H1030403](http://172.16.1.232/emission/lca?menu=H1030403)|Y/Y|
|H1030404|제품 탄소발자국|[/emission/lca?menu=H1030404](http://172.16.1.232/emission/lca?menu=H1030404)|Y/Y|
|H1030405|검토·확정|[/emission/lca?menu=H1030405](http://172.16.1.232/emission/lca?menu=H1030405)|Y/Y|
|H104|감축 관리|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H10401|목표·계획|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040101|감축 목표|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040102|기준연도|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040103|조직·사업장 목표|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040104|감축 로드맵|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H10402|감축 과제|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040201|감축 과제 목록|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040202|감축 과제 등록|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040203|담당자·예산·일정|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040204|예상 감축량|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040205|과제 승인|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H10403|성과 관리|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040301|감축 실적|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040302|목표 대비 실적|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040303|비용 대비 효과|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040305|시나리오 비교|[/emission/simulate](http://172.16.1.232/emission/simulate)|Y/Y|
|H10404|포트폴리오|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040401|감축 수단 분석|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040402|한계감축비용|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040403|우선순위|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040404|투자 계획|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1040405|성과 보고서|[/emission/reduction](http://172.16.1.232/emission/reduction)|Y/Y|
|H1050102|실시간 배출 현황|[/monitoring/realtime](http://172.16.1.232/monitoring/realtime)|Y/Y|
|H1050103|조직·사업장 분석|[/monitoring/index](http://172.16.1.232/monitoring/index)|Y/Y|
|H1060402|인증서|[/certificate/index](http://172.16.1.232/certificate/index)|Y/Y|
|H1060404|진위 확인|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|Y/Y|
|H1080104|내 프로젝트|[/emission/project_list](http://172.16.1.232/emission/project_list)|N/N|
|H1080105|승인·결재함|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|N/N|
|H10802|업무·승인|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|Y/Y|
|H1080201|내 프로젝트|[/emission/project_list](http://172.16.1.232/emission/project_list)|Y/Y|
|H1080202|승인·결재함|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|Y/Y|
|H1090101|기존 탄소배출|[/emission/index](http://172.16.1.232/emission/index)|N/N|
|H1090102|기존 보고서·인증서|[/certificate/index](http://172.16.1.232/certificate/index)|N/N|

## 7. 메뉴·등록·소스·프로세스 대조표

|주소|메뉴 코드(활성/표시 여부는 부록6)|소스|화면 등록|연결 프로세스|
|---|---|---|---|---|
|[/emission/project_list](http://172.16.1.232/emission/project_list)|A1030101, H1020102, H1080104, H1080201|확인|확인|EMISSION_PROJECT_PORTFOLIO, BUSINESS_SITE_ADMINISTRATION, EMISSION_PROJECT|
|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|A002, A0020101, A0020105, A1010103, A1020204|확인|확인|BUSINESS_SITE_ADMINISTRATION, COMPANY_ONBOARDING, EMISSION_PROJECT|
|[/emission/project/create](http://172.16.1.232/emission/project/create)|H102010201, H1020108|확인|확인|EMISSION_PROJECT|
|[/emission/project/detail](http://172.16.1.232/emission/project/detail)|H102010202|확인|확인|ACTIVITY_DATA, EMISSION_PROJECT, EMISSION_CALCULATION|
|[/emission/project/progress](http://172.16.1.232/emission/project/progress)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/emission/project-portfolio](http://172.16.1.232/emission/project-portfolio)|없음: 숨은/연계 화면 후보|확인|확인|EMISSION_PROJECT_PORTFOLIO|
|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|A1030102, A1030103, A1030104, A1030105, A1030106, A1030110, A1030201, A1030202, A1030203, A1030204, A1030205, A1030301, A1030302, A1030303, A1030304, A1030305, A10304, A1030401, A1030402, A1030404, A1030405|확인|확인|ACTIVITY_DATA, EMISSION_PROJECT_PORTFOLIO, EMISSION_PROJECT, CUSTOMER_WORK_COORDINATION, COMPANY_ONBOARDING, EMISSION_CALCULATION|
|[/admin/emission/project-prerequisites](http://172.16.1.232/admin/emission/project-prerequisites)|A1030111|확인|확인|활성 연결 없음|
|[/emission/project/settings](http://172.16.1.232/emission/project/settings)|없음: 숨은/연계 화면 후보|미발견|확인|ACTIVITY_DATA|
|[/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)|A0020504, A1040310, A105, A10501, A1050101, A1060101, A1060102, A1060103, A1060104, A1060105, A1060203, A1060204, A1060206, A1060207, A1060301, A1060303, A1060304, A1060305, A1060306, A10604|확인|확인|LCA_EXECUTION|
|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|없음: 숨은/연계 화면 후보|확인|확인|ORGANIZATIONAL_BOUNDARY, EMISSION_PROJECT|
|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|없음: 숨은/연계 화면 후보|확인|확인|ORGANIZATIONAL_BOUNDARY|
|[/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)|A0020102, A10302, A1050106, A1060201|확인|확인|EMISSION_PROJECT|
|[/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent)|A0020304, A1060202|확인|확인|EMISSION_PROJECT|
|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|A0020103, A1050105, A1060205|확인|확인|EMISSION_PROJECT, CUSTOMER_WORK_COORDINATION, EMISSION_CALCULATION|
|[/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)|A0020303, A1040106, A1120111|확인|확인|활성 연결 없음|
|[/admin/emission/management](http://172.16.1.232/admin/emission/management)|A1010105, A10103, A1010301, A10105, A1010501, A1050102|확인|확인|활성 연결 없음|
|[/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template)|A0020104, A1060302|확인|확인|활성 연결 없음|
|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|A0020202, A1030107, A1030307, A1070101, A1070102, A1070103, A1070104, A1070105, A1070107, A1070108, A1070109, A1070110, A1070111, A10704|확인|확인|활성 연결 없음|
|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|A0020203, A10104, A1010401, A1050103, A107, A1070106, A10702, A1070201, A1070202|확인|확인|EMISSION_PROJECT, ACTIVITY_DATA, CUSTOMER_WORK_COORDINATION|
|[/emission/data-request](http://172.16.1.232/emission/data-request)|H1020202|확인|확인|ACTIVITY_DATA|
|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|H10202, H1020201, H1020408|확인|확인|CUSTOMER_WORK_COORDINATION, ACTIVITY_DATA, EMISSION_PROJECT|
|[/emission/data_input](http://172.16.1.232/emission/data_input)|없음: 숨은/연계 화면 후보|확인|확인|EMISSION_PROJECT|
|[/emission/excel-upload](http://172.16.1.232/emission/excel-upload)|H1020203|확인|확인|EMISSION_PROJECT|
|[/emission/evidence](http://172.16.1.232/emission/evidence)|H1020204|확인|확인|활성 연결 없음|
|[/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)|A0020401, A1030108, A1030308|확인|확인|활성 연결 없음|
|[/emission/external-data](http://172.16.1.232/emission/external-data)|H1020205|확인|확인|활성 연결 없음|
|[/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link)|A0020404, A1120113|확인|확인|활성 연결 없음|
|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|H1010102, H1020103, H1080105, H10802, H1080202|확인|확인|CUSTOMER_WORK_COORDINATION|
|[/emission/work-assignment](http://172.16.1.232/emission/work-assignment)|없음: 숨은/연계 화면 후보|확인|확인|WORK_ASSIGNMENT, EMISSION_PROJECT|
|[/work/execution](http://172.16.1.232/work/execution)|없음: 숨은/연계 화면 후보|확인|미발견|활성 연결 없음|
|[/emission/deadline-status](http://172.16.1.232/emission/deadline-status)|H1020104|확인|확인|활성 연결 없음|
|[/emission/data-validation](http://172.16.1.232/emission/data-validation)|H1020303|확인|확인|활성 연결 없음|
|[/emission/validate](http://172.16.1.232/emission/validate)|H1020105, H10203|확인|확인|ACTIVITY_DATA, EMISSION_PROJECT, EMISSION_CALCULATION, CUSTOMER_WORK_COORDINATION|
|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|A0020201, A1010106, A10106, A1010601, A10701|확인|확인|ACTIVITY_DATA, EMISSION_CALCULATION, CUSTOMER_WORK_COORDINATION, EMISSION_PROJECT|
|[/emission/correction](http://172.16.1.232/emission/correction)|H1020304|확인|확인|활성 연결 없음|
|[/emission/calculation](http://172.16.1.232/emission/calculation)|H1020106, H1020301|확인|확인|EMISSION_PROJECT, CUSTOMER_WORK_COORDINATION, EMISSION_CALCULATION|
|[/emission/calculation-results](http://172.16.1.232/emission/calculation-results)|H1020302|확인|확인|EMISSION_PROJECT, EMISSION_CALCULATION|
|[/emission/result](http://172.16.1.232/emission/result)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|A0020301, A1050104, A10502, A1050203, A1120109|확인|확인|EMISSION_CALCULATION|
|[/admin/emission/result_detail](http://172.16.1.232/admin/emission/result_detail)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/emission/review-approval](http://172.16.1.232/emission/review-approval)|H1020401|확인|확인|활성 연결 없음|
|[/emission/finalization](http://172.16.1.232/emission/finalization)|H1020402|확인|확인|활성 연결 없음|
|[/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template)|A0020302, A1120110|확인|확인|활성 연결 없음|
|[/emission/report-write](http://172.16.1.232/emission/report-write)|H1020403|확인|확인|활성 연결 없음|
|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|H1020107|확인|확인|REPORT_CERTIFICATION, CERTIFICATE_ISSUANCE, CUSTOMER_WORK_COORDINATION, EMISSION_PROJECT|
|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|A1030109, A10303, A1050108|확인|확인|CERTIFICATE_ISSUANCE, REPORT_CERTIFICATION, EMISSION_PROJECT|
|[/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print)|없음: 숨은/연계 화면 후보|확인|확인|REPORT_CERTIFICATION, CERTIFICATE_ISSUANCE|
|[/admin/emission/report-certificates](http://172.16.1.232/admin/emission/report-certificates)|없음: 숨은/연계 화면 후보|확인|확인|REPORT_CERTIFICATION, CUSTOMER_WORK_COORDINATION|
|[/admin/emission/certificates](http://172.16.1.232/admin/emission/certificates)|없음: 숨은/연계 화면 후보|미발견|확인|CERTIFICATE_ISSUANCE|
|[/emission/report-download](http://172.16.1.232/emission/report-download)|H1020405|확인|확인|REPORT_CERTIFICATION|
|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|H1010107, H1060404|확인|확인|CUSTOMER_WORK_COORDINATION, REPORT_CERTIFICATION, CERTIFICATE_ISSUANCE|
|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|A0020513, A10403|확인|확인|CERTIFICATE_ISSUANCE, REPORT_CERTIFICATION, CUSTOMER_WORK_COORDINATION|
|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|H1020404|확인|확인|REGULATORY_SUBMISSION|
|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|A1030403|확인|확인|REGULATORY_SUBMISSION|
|[/emission/index](http://172.16.1.232/emission/index)|H102, H10201, H1020101, H1090101|확인|확인|활성 연결 없음|
|[/emission/project-completion](http://172.16.1.232/emission/project-completion)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/admin/emission/project-completion](http://172.16.1.232/admin/emission/project-completion)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/mypage/download-history](http://172.16.1.232/mypage/download-history)|없음: 숨은/연계 화면 후보|확인|미발견|활성 연결 없음|
|[/admin/emission/report-access-history](http://172.16.1.232/admin/emission/report-access-history)|없음: 숨은/연계 화면 후보|확인|확인|활성 연결 없음|
|[/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)|A0020402, A1050107, A10503, A1050304, A1120112|확인|확인|활성 연결 없음|
|[/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)|A0020403, A10703, A1070304, A1110304|확인|확인|활성 연결 없음|
|[/emission/lci](http://172.16.1.232/emission/lci)|H10302|확인|확인|활성 연결 없음|
|[/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)|A0020503, A10402, A1040309|확인|확인|LCA_EXECUTION|
|[/emission/lca](http://172.16.1.232/emission/lca)|H103, H10301, H1030101, H1030102, H1030103, H1030104, H1030105, H1030201, H1030202, H1030203, H1030204, H1030205, H1030206, H10303, H1030301, H1030302, H1030303, H1030304, H1030305, H1030306, H10304, H1030401, H1030402, H1030403, H1030404, H1030405|확인|확인|활성 연결 없음|
|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|A0020501, A103, A10301, A104, A10401, A1040101, A1040102, A1040103, A1040104, A1040201, A1040202, A1040203, A1040204, A1040205, A1040206, A1040301, A1040302, A1040303, A1040304, A1040305, A1040306, A1040307|확인|확인|REPORT_CERTIFICATION, LCA_EXECUTION|
|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|A0020502, A1040308|확인|확인|CUSTOMER_WORK_COORDINATION, ACTIVITY_DATA, EMISSION_PROJECT|
|[/admin/emission/survey-report-lca-summary](http://172.16.1.232/admin/emission/survey-report-lca-summary)|A1040105|확인|확인|활성 연결 없음|
|[/emission/reduction](http://172.16.1.232/emission/reduction)|H104, H10401, H1040101, H1040102, H1040103, H1040104, H10402, H1040201, H1040202, H1040203, H1040204, H1040205, H10403, H1040301, H1040302, H1040303, H10404, H1040401, H1040402, H1040403, H1040404, H1040405|확인|확인|활성 연결 없음|
|[/emission/simulate](http://172.16.1.232/emission/simulate)|H1040305|확인|확인|REDUCTION_EXECUTION|

## 8. 예정·생성형 탄소배출 경로 전체

|경로|상태|
|---|---|
|[/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s1](http://172.16.1.232/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s2](http://172.16.1.232/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s3](http://172.16.1.232/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s4](http://172.16.1.232/admin/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/chain-of-custody/chain-of-custody-s1](http://172.16.1.232/admin/planned/emission/chain-of-custody/chain-of-custody-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/chain-of-custody/chain-of-custody-s2](http://172.16.1.232/admin/planned/emission/chain-of-custody/chain-of-custody-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/chain-of-custody/chain-of-custody-s3](http://172.16.1.232/admin/planned/emission/chain-of-custody/chain-of-custody-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/chain-of-custody/chain-of-custody-s4](http://172.16.1.232/admin/planned/emission/chain-of-custody/chain-of-custody-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/disclosure-correction/disclosure-correction-s1](http://172.16.1.232/admin/planned/emission/disclosure-correction/disclosure-correction-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/disclosure-correction/disclosure-correction-s2](http://172.16.1.232/admin/planned/emission/disclosure-correction/disclosure-correction-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/disclosure-correction/disclosure-correction-s3](http://172.16.1.232/admin/planned/emission/disclosure-correction/disclosure-correction-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/disclosure-correction/disclosure-correction-s4](http://172.16.1.232/admin/planned/emission/disclosure-correction/disclosure-correction-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/external-verification-engagement/external-verification-engagement-s1](http://172.16.1.232/admin/planned/emission/external-verification-engagement/external-verification-engagement-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/external-verification-engagement/external-verification-engagement-s2](http://172.16.1.232/admin/planned/emission/external-verification-engagement/external-verification-engagement-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/external-verification-engagement/external-verification-engagement-s3](http://172.16.1.232/admin/planned/emission/external-verification-engagement/external-verification-engagement-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/external-verification-engagement/external-verification-engagement-s4](http://172.16.1.232/admin/planned/emission/external-verification-engagement/external-verification-engagement-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/leakage-incident-response/leakage-incident-response-s1](http://172.16.1.232/admin/planned/emission/leakage-incident-response/leakage-incident-response-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/leakage-incident-response/leakage-incident-response-s2](http://172.16.1.232/admin/planned/emission/leakage-incident-response/leakage-incident-response-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/leakage-incident-response/leakage-incident-response-s3](http://172.16.1.232/admin/planned/emission/leakage-incident-response/leakage-incident-response-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/leakage-incident-response/leakage-incident-response-s4](http://172.16.1.232/admin/planned/emission/leakage-incident-response/leakage-incident-response-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/measurement-data-quality/measurement-data-quality-s1](http://172.16.1.232/admin/planned/emission/measurement-data-quality/measurement-data-quality-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/measurement-data-quality/measurement-data-quality-s2](http://172.16.1.232/admin/planned/emission/measurement-data-quality/measurement-data-quality-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/measurement-data-quality/measurement-data-quality-s3](http://172.16.1.232/admin/planned/emission/measurement-data-quality/measurement-data-quality-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/measurement-data-quality/measurement-data-quality-s4](http://172.16.1.232/admin/planned/emission/measurement-data-quality/measurement-data-quality-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/mrv-traceability/mrv-traceability-s1](http://172.16.1.232/admin/planned/emission/mrv-traceability/mrv-traceability-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/mrv-traceability/mrv-traceability-s2](http://172.16.1.232/admin/planned/emission/mrv-traceability/mrv-traceability-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/mrv-traceability/mrv-traceability-s3](http://172.16.1.232/admin/planned/emission/mrv-traceability/mrv-traceability-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/mrv-traceability/mrv-traceability-s4](http://172.16.1.232/admin/planned/emission/mrv-traceability/mrv-traceability-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s1](http://172.16.1.232/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s2](http://172.16.1.232/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s3](http://172.16.1.232/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s4](http://172.16.1.232/admin/planned/emission/project-lifecycle-control/project-lifecycle-control-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s1](http://172.16.1.232/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s2](http://172.16.1.232/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s3](http://172.16.1.232/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s4](http://172.16.1.232/planned/emission/ccus-lifecycle-mrv/ccus-lifecycle-mrv-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/chain-of-custody/chain-of-custody-s1](http://172.16.1.232/planned/emission/chain-of-custody/chain-of-custody-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/chain-of-custody/chain-of-custody-s2](http://172.16.1.232/planned/emission/chain-of-custody/chain-of-custody-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/chain-of-custody/chain-of-custody-s3](http://172.16.1.232/planned/emission/chain-of-custody/chain-of-custody-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/chain-of-custody/chain-of-custody-s4](http://172.16.1.232/planned/emission/chain-of-custody/chain-of-custody-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/disclosure-correction/disclosure-correction-s1](http://172.16.1.232/planned/emission/disclosure-correction/disclosure-correction-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/disclosure-correction/disclosure-correction-s2](http://172.16.1.232/planned/emission/disclosure-correction/disclosure-correction-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/disclosure-correction/disclosure-correction-s3](http://172.16.1.232/planned/emission/disclosure-correction/disclosure-correction-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/disclosure-correction/disclosure-correction-s4](http://172.16.1.232/planned/emission/disclosure-correction/disclosure-correction-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/external-verification-engagement/external-verification-engagement-s1](http://172.16.1.232/planned/emission/external-verification-engagement/external-verification-engagement-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/external-verification-engagement/external-verification-engagement-s2](http://172.16.1.232/planned/emission/external-verification-engagement/external-verification-engagement-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/external-verification-engagement/external-verification-engagement-s3](http://172.16.1.232/planned/emission/external-verification-engagement/external-verification-engagement-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/external-verification-engagement/external-verification-engagement-s4](http://172.16.1.232/planned/emission/external-verification-engagement/external-verification-engagement-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/leakage-incident-response/leakage-incident-response-s1](http://172.16.1.232/planned/emission/leakage-incident-response/leakage-incident-response-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/leakage-incident-response/leakage-incident-response-s2](http://172.16.1.232/planned/emission/leakage-incident-response/leakage-incident-response-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/leakage-incident-response/leakage-incident-response-s3](http://172.16.1.232/planned/emission/leakage-incident-response/leakage-incident-response-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/leakage-incident-response/leakage-incident-response-s4](http://172.16.1.232/planned/emission/leakage-incident-response/leakage-incident-response-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/measurement-data-quality/measurement-data-quality-s1](http://172.16.1.232/planned/emission/measurement-data-quality/measurement-data-quality-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/measurement-data-quality/measurement-data-quality-s2](http://172.16.1.232/planned/emission/measurement-data-quality/measurement-data-quality-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/measurement-data-quality/measurement-data-quality-s3](http://172.16.1.232/planned/emission/measurement-data-quality/measurement-data-quality-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/measurement-data-quality/measurement-data-quality-s4](http://172.16.1.232/planned/emission/measurement-data-quality/measurement-data-quality-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/mrv-traceability/mrv-traceability-s1](http://172.16.1.232/planned/emission/mrv-traceability/mrv-traceability-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/mrv-traceability/mrv-traceability-s2](http://172.16.1.232/planned/emission/mrv-traceability/mrv-traceability-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/mrv-traceability/mrv-traceability-s3](http://172.16.1.232/planned/emission/mrv-traceability/mrv-traceability-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/mrv-traceability/mrv-traceability-s4](http://172.16.1.232/planned/emission/mrv-traceability/mrv-traceability-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/project-lifecycle-control/project-lifecycle-control-s1](http://172.16.1.232/planned/emission/project-lifecycle-control/project-lifecycle-control-s1)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/project-lifecycle-control/project-lifecycle-control-s2](http://172.16.1.232/planned/emission/project-lifecycle-control/project-lifecycle-control-s2)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/project-lifecycle-control/project-lifecycle-control-s3](http://172.16.1.232/planned/emission/project-lifecycle-control/project-lifecycle-control-s3)|DB/절차 후보·전용 화면 및 업무 동작 미검증|
|[/planned/emission/project-lifecycle-control/project-lifecycle-control-s4](http://172.16.1.232/planned/emission/project-lifecycle-control/project-lifecycle-control-s4)|DB/절차 후보·전용 화면 및 업무 동작 미검증|

## 9. 관련 프로세스·절차 원본

|프로세스|업무 종류 코드|순번·절차|사용자 경로|관리자 경로|
|---|---|---|---|---|
|CERTIFICATE_FEE_TAX_REFUND · 인증 수수료·세금계산서·환불 통합 처리|CERTIFICATE|1. 수수료·가상계좌·청구 생성|[/work/certificate-fee-tax-refund?step=cftr_bill](http://172.16.1.232/work/certificate-fee-tax-refund?step=cftr_bill)|[/admin/work/certificate-fee-tax-refund?step=cftr_bill](http://172.16.1.232/admin/work/certificate-fee-tax-refund?step=cftr_bill)|
|CERTIFICATE_FEE_TAX_REFUND · 인증 수수료·세금계산서·환불 통합 처리|CERTIFICATE|2. 입금·세금계산서·정산 확인|[/work/certificate-fee-tax-refund?step=cftr_settle](http://172.16.1.232/work/certificate-fee-tax-refund?step=cftr_settle)|[/admin/work/certificate-fee-tax-refund?step=cftr_settle](http://172.16.1.232/admin/work/certificate-fee-tax-refund?step=cftr_settle)|
|CERTIFICATE_FEE_TAX_REFUND · 인증 수수료·세금계산서·환불 통합 처리|CERTIFICATE|3. 철회·취소·환불 종결|[/work/certificate-fee-tax-refund?step=cftr_refund](http://172.16.1.232/work/certificate-fee-tax-refund?step=cftr_refund)|[/admin/work/certificate-fee-tax-refund?step=cftr_refund](http://172.16.1.232/admin/work/certificate-fee-tax-refund?step=cftr_refund)|
|CERTIFICATE_ISSUANCE · 인증서 신청·발급·검증|CERTIFICATE|1. 보고서 확정·발급 준비|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|
|CERTIFICATE_ISSUANCE · 인증서 신청·발급·검증|CERTIFICATE|2. 인증서·PDF 발급|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print)|
|CERTIFICATE_ISSUANCE · 인증서 신청·발급·검증|CERTIFICATE|3. 공개 진위·OCR·시각지문 검증|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|
|CERTIFICATE_ISSUANCE · 인증서 신청·발급·검증|CERTIFICATE|4. 폐기·재발급·감사 확정|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/certificates](http://172.16.1.232/admin/emission/certificates)|
|CERTIFICATE_OBJECTION · 인증서 이의신청·감사|CERTIFICATE|1. 인증서 이의신청·감사 - 요청·범위·필수정보 확인|[/generated/certificate-objection/certificate-objection-s1](http://172.16.1.232/generated/certificate-objection/certificate-objection-s1)|[/admin/generated/certificate-objection/certificate-objection-s1](http://172.16.1.232/admin/generated/certificate-objection/certificate-objection-s1)|
|CERTIFICATE_OBJECTION · 인증서 이의신청·감사|CERTIFICATE|2. 인증서 이의신청·감사 - 업무 실행·중간 결과 저장|[/generated/certificate-objection/certificate-objection-s2](http://172.16.1.232/generated/certificate-objection/certificate-objection-s2)|[/admin/generated/certificate-objection/certificate-objection-s2](http://172.16.1.232/admin/generated/certificate-objection/certificate-objection-s2)|
|CERTIFICATE_OBJECTION · 인증서 이의신청·감사|CERTIFICATE|3. 인증서 이의신청·감사 - 독립 검토·보완·권한 검증|[/generated/certificate-objection/certificate-objection-s3](http://172.16.1.232/generated/certificate-objection/certificate-objection-s3)|[/admin/generated/certificate-objection/certificate-objection-s3](http://172.16.1.232/admin/generated/certificate-objection/certificate-objection-s3)|
|CERTIFICATE_OBJECTION · 인증서 이의신청·감사|CERTIFICATE|4. 인증서 이의신청·감사 - 승인·확정·통지·후속업무 연결|[/generated/certificate-objection/certificate-objection-s4](http://172.16.1.232/generated/certificate-objection/certificate-objection-s4)|[/admin/generated/certificate-objection/certificate-objection-s4](http://172.16.1.232/admin/generated/certificate-objection/certificate-objection-s4)|
|CERTIFICATE_REVIEW_ISSUANCE · 인증서 검토·발급|CERTIFICATE|1. 인증서 검토·발급 - 요청·범위·필수정보 확인|[/generated/certificate-review-issuance/certificate-review-issuance-s1](http://172.16.1.232/generated/certificate-review-issuance/certificate-review-issuance-s1)|[/admin/generated/certificate-review-issuance/certificate-review-issuance-s1](http://172.16.1.232/admin/generated/certificate-review-issuance/certificate-review-issuance-s1)|
|CERTIFICATE_REVIEW_ISSUANCE · 인증서 검토·발급|CERTIFICATE|2. 인증서 검토·발급 - 업무 실행·중간 결과 저장|[/generated/certificate-review-issuance/certificate-review-issuance-s2](http://172.16.1.232/generated/certificate-review-issuance/certificate-review-issuance-s2)|[/admin/generated/certificate-review-issuance/certificate-review-issuance-s2](http://172.16.1.232/admin/generated/certificate-review-issuance/certificate-review-issuance-s2)|
|CERTIFICATE_REVIEW_ISSUANCE · 인증서 검토·발급|CERTIFICATE|3. 인증서 검토·발급 - 독립 검토·보완·권한 검증|[/generated/certificate-review-issuance/certificate-review-issuance-s3](http://172.16.1.232/generated/certificate-review-issuance/certificate-review-issuance-s3)|[/admin/generated/certificate-review-issuance/certificate-review-issuance-s3](http://172.16.1.232/admin/generated/certificate-review-issuance/certificate-review-issuance-s3)|
|CERTIFICATE_REVIEW_ISSUANCE · 인증서 검토·발급|CERTIFICATE|4. 인증서 검토·발급 - 승인·확정·통지·후속업무 연결|[/generated/certificate-review-issuance/certificate-review-issuance-s4](http://172.16.1.232/generated/certificate-review-issuance/certificate-review-issuance-s4)|[/admin/generated/certificate-review-issuance/certificate-review-issuance-s4](http://172.16.1.232/admin/generated/certificate-review-issuance/certificate-review-issuance-s4)|
|CERTIFICATE_VERIFICATION · 인증서 진위 확인|CERTIFICATE|1. 인증서 진위 확인 - 요청·범위·필수정보 확인|[/generated/certificate-verification/certificate-verification-s1](http://172.16.1.232/generated/certificate-verification/certificate-verification-s1)|[/admin/generated/certificate-verification/certificate-verification-s1](http://172.16.1.232/admin/generated/certificate-verification/certificate-verification-s1)|
|CERTIFICATE_VERIFICATION · 인증서 진위 확인|CERTIFICATE|2. 인증서 진위 확인 - 업무 실행·중간 결과 저장|[/generated/certificate-verification/certificate-verification-s2](http://172.16.1.232/generated/certificate-verification/certificate-verification-s2)|[/admin/generated/certificate-verification/certificate-verification-s2](http://172.16.1.232/admin/generated/certificate-verification/certificate-verification-s2)|
|CERTIFICATE_VERIFICATION · 인증서 진위 확인|CERTIFICATE|3. 인증서 진위 확인 - 독립 검토·보완·권한 검증|[/generated/certificate-verification/certificate-verification-s3](http://172.16.1.232/generated/certificate-verification/certificate-verification-s3)|[/admin/generated/certificate-verification/certificate-verification-s3](http://172.16.1.232/admin/generated/certificate-verification/certificate-verification-s3)|
|CERTIFICATE_VERIFICATION · 인증서 진위 확인|CERTIFICATE|4. 인증서 진위 확인 - 승인·확정·통지·후속업무 연결|[/generated/certificate-verification/certificate-verification-s4](http://172.16.1.232/generated/certificate-verification/certificate-verification-s4)|[/admin/generated/certificate-verification/certificate-verification-s4](http://172.16.1.232/admin/generated/certificate-verification/certificate-verification-s4)|
|REPORT_CERTIFICATION · 보고서·인증서 발급|CERTIFICATE|1. 보고서 작성 범위·양식 확정|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)|
|REPORT_CERTIFICATION · 보고서·인증서 발급|CERTIFICATE|2. 보고서 생성·데이터셋 봉인|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|
|REPORT_CERTIFICATION · 보고서·인증서 발급|CERTIFICATE|3. 보고서·인증 데이터 교차검증|[/emission/report_submit?mode=verify](http://172.16.1.232/emission/report_submit?mode=verify)|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|
|REPORT_CERTIFICATION · 보고서·인증서 발급|CERTIFICATE|4. 보고서 확정·인증서 발급|[/emission/report-download](http://172.16.1.232/emission/report-download)|[/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|1. 내 업무·프로젝트 선택|[/emission/my-tasks](http://172.16.1.232/emission/my-tasks)|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|2. 활동자료 수집·제출|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|3. 배출계수 매핑·배출량 산정|[/emission/calculation](http://172.16.1.232/emission/calculation)|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|4. 산정 결과 검증·보완|[/emission/validate](http://172.16.1.232/emission/validate)|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|5. 검토·승인|[/emission/validate](http://172.16.1.232/emission/validate)|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|6. 보고서·인증서 발급|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/report-certificates](http://172.16.1.232/admin/emission/report-certificates)|
|CUSTOMER_WORK_COORDINATION · 통합 업무 조정|COMMON|7. 공개 진위 확인·완료|[/home/certificate-verify](http://172.16.1.232/home/certificate-verify)|[/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)|
|REGULATORY_SUBMISSION · 규제기관 제출·접수·보완|COMPLIANCE|1. 제출 범위·기한 확인|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|
|REGULATORY_SUBMISSION · 규제기관 제출·접수·보완|COMPLIANCE|2. 제출 패키지 생성·서명|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|
|REGULATORY_SUBMISSION · 규제기관 제출·접수·보완|COMPLIANCE|3. 기관 제출·접수 추적|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|
|REGULATORY_SUBMISSION · 규제기관 제출·접수·보완|COMPLIANCE|4. 보완·수리·종결|[/emission/report-submission](http://172.16.1.232/emission/report-submission)|[/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)|
|TRAINING_CERTIFICATE · 교육 수료·수료증 발급|EDUCATION|1. 교육 수료·수료증 발급 - 요청·범위·필수정보 확인|[/generated/training-certificate/training-certificate-s1](http://172.16.1.232/generated/training-certificate/training-certificate-s1)|[/admin/generated/training-certificate/training-certificate-s1](http://172.16.1.232/admin/generated/training-certificate/training-certificate-s1)|
|TRAINING_CERTIFICATE · 교육 수료·수료증 발급|EDUCATION|2. 교육 수료·수료증 발급 - 업무 실행·중간 결과 저장|[/generated/training-certificate/training-certificate-s2](http://172.16.1.232/generated/training-certificate/training-certificate-s2)|[/admin/generated/training-certificate/training-certificate-s2](http://172.16.1.232/admin/generated/training-certificate/training-certificate-s2)|
|TRAINING_CERTIFICATE · 교육 수료·수료증 발급|EDUCATION|3. 교육 수료·수료증 발급 - 독립 검토·보완·권한 검증|[/generated/training-certificate/training-certificate-s3](http://172.16.1.232/generated/training-certificate/training-certificate-s3)|[/admin/generated/training-certificate/training-certificate-s3](http://172.16.1.232/admin/generated/training-certificate/training-certificate-s3)|
|TRAINING_CERTIFICATE · 교육 수료·수료증 발급|EDUCATION|4. 교육 수료·수료증 발급 - 승인·확정·통지·후속업무 연결|[/generated/training-certificate/training-certificate-s4](http://172.16.1.232/generated/training-certificate/training-certificate-s4)|[/admin/generated/training-certificate/training-certificate-s4](http://172.16.1.232/admin/generated/training-certificate/training-certificate-s4)|
|ACTIVITY_DATA · 활동자료 수집·보완|EMISSION|1. 활동자료 수집 계획 확정|[/emission/data-request](http://172.16.1.232/emission/data-request)|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|
|ACTIVITY_DATA · 활동자료 수집·보완|EMISSION|2. 활동자료 입력·증빙 제출|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|
|ACTIVITY_DATA · 활동자료 수집·보완|EMISSION|3. 활동자료 품질검증·보완|[/emission/validate](http://172.16.1.232/emission/validate)|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|
|ACTIVITY_DATA · 활동자료 수집·보완|EMISSION|4. 활동자료 승인·스냅샷 확정|[/emission/validate?tab=approval](http://172.16.1.232/emission/validate?tab=approval)|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|
|BUSINESS_SITE_ADMINISTRATION · 사업장 관리|EMISSION|1. 사업장 관리 - 요청·범위·필수정보 확인|[/mypage/company](http://172.16.1.232/mypage/company)|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|
|BUSINESS_SITE_ADMINISTRATION · 사업장 관리|EMISSION|2. 사업장 관리 - 업무 실행·중간 결과 저장|[/mypage/company](http://172.16.1.232/mypage/company)|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|
|BUSINESS_SITE_ADMINISTRATION · 사업장 관리|EMISSION|3. 사업장 관리 - 독립 검토·보완·권한 검증|[/emission/project_list](http://172.16.1.232/emission/project_list)|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|
|BUSINESS_SITE_ADMINISTRATION · 사업장 관리|EMISSION|4. 사업장 관리 - 승인·확정·통지·후속업무 연결|[/mypage/company](http://172.16.1.232/mypage/company)|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|
|EMISSION_CALCULATION · 배출량 산정·검증|EMISSION|1. 산정 기준·입력 스냅샷 확정|[/emission/calculation?mode=plan](http://172.16.1.232/emission/calculation?mode=plan)|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|
|EMISSION_CALCULATION · 배출량 산정·검증|EMISSION|2. 배출량 계산·결과 생성|[/emission/calculation](http://172.16.1.232/emission/calculation)|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|
|EMISSION_CALCULATION · 배출량 산정·검증|EMISSION|3. 산정 결과 검증·오류 보완|[/emission/validate](http://172.16.1.232/emission/validate)|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|
|EMISSION_CALCULATION · 배출량 산정·검증|EMISSION|4. 산정 결과 승인·버전 잠금|[/emission/calculation-results](http://172.16.1.232/emission/calculation-results)|[/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|1. 프로젝트·조직경계 설정|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|2. 활동자료 수집·품질검사|[/emission/activity-data](http://172.16.1.232/emission/activity-data)|[/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|3. 계수 매핑·Scope 배출량 산정|[/emission/calculation](http://172.16.1.232/emission/calculation)|[/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|4. 독립 검증·보완 판정|[/emission/validate](http://172.16.1.232/emission/validate)|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|5. 보완·재산정|[/emission/activity-data?mode=correction](http://172.16.1.232/emission/activity-data?mode=correction)|[/admin/emission/validate](http://172.16.1.232/admin/emission/validate)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|6. 검토·승인·결과 잠금|[/emission/validate?tab=approval](http://172.16.1.232/emission/validate?tab=approval)|[/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)|
|EMISSION_PROJECT · 탄소배출 프로젝트 수행|EMISSION|7. 보고·제출·인증서 발급|[/emission/report_submit](http://172.16.1.232/emission/report_submit)|[/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)|
|EMISSION_PROJECT_PORTFOLIO · 배출량 프로젝트 포트폴리오 관리|EMISSION|1. 프로젝트 검색·현황 확인·다음 업무 선택|[/emission/project-portfolio](http://172.16.1.232/emission/project-portfolio)|[/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)|
|ORGANIZATIONAL_BOUNDARY · 조직경계·다사업장 연결·통합|EMISSION|1. 법인·사업장·소유구조 수집|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|
|ORGANIZATIONAL_BOUNDARY · 조직경계·다사업장 연결·통합|EMISSION|2. 경계 기준·포함 여부 판정|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|
|ORGANIZATIONAL_BOUNDARY · 조직경계·다사업장 연결·통합|EMISSION|3. 내부거래 제거·통합 계산|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|
|ORGANIZATIONAL_BOUNDARY · 조직경계·다사업장 연결·통합|EMISSION|4. 경계 승인·버전 확정|[/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)|[/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)|
|COMPANY_ONBOARDING · 회원사 가입|MEMBER|3. 조직·사업장 등록|[/mypage/company](http://172.16.1.232/mypage/company)|[/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)|
|MONITORING_ANALYSIS · 모니터링·분석|MONITORING|2. 지표·품질·이상치 분석|[/monitoring/statistics](http://172.16.1.232/monitoring/statistics)|[/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)|
|REDUCTION_EXECUTION · 감축 과제 수행|REDUCTION|1. 계획·범위 확정|[/emission/reduction](http://172.16.1.232/emission/reduction)|[/admin/system/process-workspace](http://172.16.1.232/admin/system/process-workspace)|
|REDUCTION_EXECUTION · 감축 과제 수행|REDUCTION|2. 자료 입력·업무 수행|[/emission/simulate](http://172.16.1.232/emission/simulate)|[/admin/system/process-workspace](http://172.16.1.232/admin/system/process-workspace)|
|REDUCTION_EXECUTION · 감축 과제 수행|REDUCTION|3. 검증·보완|[/emission/reduction?tab=verification](http://172.16.1.232/emission/reduction?tab=verification)|[/admin/system/process-workspace](http://172.16.1.232/admin/system/process-workspace)|
|REDUCTION_EXECUTION · 감축 과제 수행|REDUCTION|4. 승인·확정|[/emission/reduction?tab=approval](http://172.16.1.232/emission/reduction?tab=approval)|[/admin/system/process-workspace](http://172.16.1.232/admin/system/process-workspace)|
|WORK_ASSIGNMENT · 프로젝트 업무 배정|RETIRED|1. 업무 종류·프로젝트 선택|[/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT](http://172.16.1.232/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT)||
|WORK_ASSIGNMENT · 프로젝트 업무 배정|RETIRED|2. 액터별 계정 배정|[/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT](http://172.16.1.232/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT)||
|WORK_ASSIGNMENT · 프로젝트 업무 배정|RETIRED|3. 단계별 계정 배정|[/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT](http://172.16.1.232/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT)||
|WORK_ASSIGNMENT · 프로젝트 업무 배정|RETIRED|4. 배정 확정·인계|[/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT](http://172.16.1.232/emission/work-assignment?workTypeCode=EMISSION&processCode=EMISSION_PROJECT)||

## 10. 페이지별 완료 기준

각 번호별로 ①설계/입출력 확정 ②KRDS 공통 UI ③권한 ④저장·재조회 ⑤선행/다음 업무 연결 ⑥오류·빈값 ⑦도움말·화면설계·QA·길잡이·전체업무보기 동기화 ⑧스크린샷 ⑨사용자 컨펌을 기록한다. 하나라도 미확인인 항목은 검증 완료로 올리지 않는다.
첫 작업: 01 프로젝트 목록. 이후 02 사업장 원장을 확인한 다음 03 등록으로 진행한다. 기존 프로젝트/사업장이 있는 사용자는 등록 단계를 건너뛰어도 된다.
계정·사업장·기간 등 실제 테스트 입력값은 해당 페이지 착수 시 한 번에 제시하고 사용자 데이터 변경은 범위를 한정한다.

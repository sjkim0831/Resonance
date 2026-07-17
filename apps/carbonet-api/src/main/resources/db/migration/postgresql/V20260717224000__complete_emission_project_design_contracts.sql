-- Separate design completeness from post-implementation verification.  A screen
-- may enter development only after its UX, command, API, data and test contracts
-- are complete; runtime evidence remains a delivery gate after implementation.
CREATE OR REPLACE VIEW framework_professional_screen_design_readiness AS
SELECT c.*,
  ((CASE WHEN length(trim(business_purpose)) >= 20 THEN 10 ELSE 0 END) +
   (CASE WHEN length(trim(entry_condition)) >= 10 AND length(trim(exit_condition)) >= 20 THEN 10 ELSE 0 END) +
   (CASE WHEN kpi_contract <> '[]' THEN 10 ELSE 0 END) +
   (CASE WHEN section_contract <> '[]' AND field_contract <> '[]' THEN 15 ELSE 0 END) +
   (CASE WHEN command_contract <> '[]' THEN 10 ELSE 0 END) +
   (CASE WHEN state_contract LIKE '%LOADING%' AND state_contract LIKE '%EMPTY%'
          AND state_contract LIKE '%ERROR%' AND state_contract LIKE '%FORBIDDEN%' THEN 10 ELSE 0 END) +
   (CASE WHEN api_contract <> '[]' AND data_contract <> '[]' THEN 15 ELSE 0 END) +
   (CASE WHEN evidence_contract <> '[]' THEN 10 ELSE 0 END) +
   (CASE WHEN length(trim(responsive_contract)) >= 20
          AND length(trim(accessibility_contract)) >= 20
          AND length(trim(security_contract)) >= 20 THEN 10 ELSE 0 END))::integer AS design_readiness_score,
  concat_ws(', ',
    CASE WHEN length(trim(business_purpose)) < 20 THEN '업무 목적' END,
    CASE WHEN length(trim(entry_condition)) < 10 OR length(trim(exit_condition)) < 20 THEN '진입·완료 조건' END,
    CASE WHEN kpi_contract = '[]' THEN 'KPI' END,
    CASE WHEN section_contract = '[]' OR field_contract = '[]' THEN '섹션·필드' END,
    CASE WHEN command_contract = '[]' THEN '명령·화면 연결' END,
    CASE WHEN api_contract = '[]' OR data_contract = '[]' THEN 'API·데이터 계약' END,
    CASE WHEN evidence_contract = '[]' THEN '테스트·증적 계약' END
  ) AS design_readiness_gaps
FROM framework_professional_screen_contract c;

WITH design(step_code,purpose,entry_rule,exit_rule,kpis,sections,fields,commands,apis,data_items,evidence) AS (
 VALUES
 ('EMISSION_PROJECT_SETUP','조직경계, 산정기간, Scope, 적용 기준, 책임 액터와 단계별 마감을 확정하여 자료 수집을 시작한다.','기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.','필수 설정이 버전으로 저장되고 업무분리가 검증되며 프로젝트가 PLANNED 상태로 전이된다.',
  '["설정완료율","미배정 액터 수","기한 미설정 수"]','["업무 요약","기본정보","조직·운영경계","Scope·방법론","액터·마감","검토·시작"]','["프로젝트명","보고목적","산정기간","조직·사업장","경계방법","Scope 1·2·3","Scope 2 방식","GWP 버전","배출계수 버전","책임자","단계별 마감"]','["임시저장","설정 검증","프로젝트 시작","사업장 관리","권한 관리","다음 업무 이동"]','["GET /home/api/emission-projects/{id}","POST /home/api/emission-projects","PUT /home/api/emission-projects/{id}/settings","POST /home/api/emission-projects/{id}/start"]','["emission_project_registry","emission_project_site","emission_project_task","framework_account_actor_assignment","framework_process_execution"]','["필수값 검증","업무분리 403","교차 테넌트 차단","중복 생성 멱등성","설정 버전 및 감사로그"]'),
 ('EMISSION_PROJECT_COLLECT','사업장·배출원별 활동자료의 값, 단위, 기간, 출처와 원본 증빙을 수집하고 제출 품질을 관리한다.','프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.','필수 자료와 증빙이 품질검사를 통과하고 제출 스냅샷이 DATA_SUBMITTED 상태로 잠긴다.',
  '["제출완료율","증빙연결률","기한초과 건수","품질오류 건수"]','["수집 현황","제출 요청","엑셀·직접 입력","증빙 연결","품질검사","제출 이력"]','["사업장","배출원","활동자료","값","단위","기간","출처","증빙","담당자","마감","품질상태"]','["자료 요청","엑셀 업로드","임시저장","품질검사","제출","보완 요청","다음 업무 이동"]','["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities/import","POST /home/api/emission-projects/{id}/activities/submit"]','["emission_project_activity","emission_project_activity_request","emission_project_evidence","emission_project_submission"]','["양식 좌측 표 파싱","단위·기간 검증","증빙 누락 차단","대용량 업로드 원자성","재제출 버전 이력"]'),
 ('EMISSION_PROJECT_CALCULATE','승인된 배출계수와 단위환산 정책으로 Scope별 배출량을 재현 가능하게 산정하고 계산 근거를 보존한다.','활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.','모든 대상 행에 계산식과 계수 출처가 연결되고 합계 검증을 통과한 CALCULATED 버전이 생성된다.',
  '["계수매핑률","산정완료율","미매핑 건수","Scope별 배출량"]','["산정 요약","계수 매핑","단위 환산","상세 계산","Scope 결과","버전 비교"]','["활동자료","사용량","원단위","배출계수","계수 출처·버전","환산식","GWP","배출량","Scope","계산 버전"]','["AI 매핑","매핑 확정","일괄 단위 적용","산정 실행","재산정","계산근거 보기","검증 이동"]','["GET /home/api/emission-projects/{id}/calculation","POST /home/api/emission-projects/{id}/factor-mappings","POST /home/api/emission-projects/{id}/calculation","GET /home/api/emission-projects/{id}/calculation/{version}"]','["emission_factor_mapping","emission_project_calculation","emission_project_calculation_detail","emission_unit_conversion","emission_gwp_value"]','["동일 요청 멱등성","계수 버전 재현","단위 차원 오류","합계 일치","실패 롤백과 재처리"]'),
 ('EMISSION_PROJECT_VALIDATE','활동자료, 증빙, 계수와 산정 결과의 완전성·정확성·일관성을 규칙 기반으로 독립 검증한다.','CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.','차단 오류가 0건이면 VERIFIED, 오류가 있으면 근거·담당자·기한을 포함하여 CORRECTION_REQUIRED로 전이된다.',
  '["검증진행률","차단오류 수","경고 수","재검증 대기 수"]','["검증 요약","규칙 실행","오류 목록","증빙·계산 근거","보완 요청","검증 이력"]','["규칙","대상 위치","심각도","기대값","실제값","근거","담당자","기한","조치상태"]','["검증 실행","오류 확인","보완 요청","검증 통과","재검증","산정근거 이동"]','["GET /home/api/emission-projects/{id}/validation","POST /home/api/emission-projects/{id}/validation/run","POST /home/api/emission-projects/{id}/corrections","POST /home/api/emission-projects/{id}/validation/complete"]','["emission_validation_rule","emission_project_validation_run","emission_project_quality_issue","emission_project_submission"]','["필수·이상치·중복·단위·계수 검증","검증자 권한","오류 0건 통과","규칙 버전 재현","보완 분기"]'),
 ('EMISSION_PROJECT_CORRECT','검증 오류별 원인과 영향 범위를 확인하고 자료 수정, 재산정, 재검증을 통해 보완을 종결한다.','프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.','모든 보완 요청에 전후 값·사유·증빙이 보존되고 영향 범위 재산정 후 재검증 단계로 복귀한다.',
  '["보완완료율","기한초과 보완 수","재발 오류 수","영향 배출량"]','["보완 요약","검증 의견","원자료 수정","영향 범위","재산정 결과","재제출 이력"]','["오류번호","검증의견","수정 전 값","수정 후 값","변경사유","대체 증빙","영향 항목","재산정 버전","재검증 상태"]','["수정 저장","증빙 교체","영향 분석","재산정","재제출","검증 화면 이동"]','["GET /home/api/emission-projects/{id}/corrections","PUT /home/api/emission-projects/{id}/activities/{activityId}","POST /home/api/emission-projects/{id}/recalculate","POST /home/api/emission-projects/{id}/resubmit"]','["emission_project_quality_issue","emission_project_activity_revision","emission_project_calculation","emission_project_submission"]','["전후 값 보존","사유 필수","영향 범위 재산정","중복 재제출 방지","재검증 상태 전이"]'),
 ('EMISSION_PROJECT_APPROVE','검증 완료 결과를 업무분리 원칙에 따라 검토·승인 또는 반려하고 확정 산정 버전을 잠근다.','프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.','권한 있는 승인자의 전자결정과 의견이 저장되고 승인 시 APPROVED 버전이 변경 불가로 확정된다.',
  '["승인대기 건수","평균 처리시간","반려 건수","기한초과 건수"]','["승인 요약","산정·검증 결과","주요 변동","증빙 표본","검토 의견","결정 이력"]','["확정 후보 버전","총 배출량","Scope별 결과","검증 결과","검토 의견","승인자","결정일시","반려사유"]','["검토 완료","승인","반려","추가자료 요청","결과 비교","보고 이동"]','["GET /home/api/emission-projects/{id}/approval","POST /home/api/emission-projects/{id}/approval/approve","POST /home/api/emission-projects/{id}/approval/reject","GET /home/api/emission-projects/{id}/approval/history"]','["emission_project_approval","emission_project_submission","emission_project_calculation","framework_process_execution_event"]','["승인자만 승인","자기승인 차단","반려사유 필수","확정 버전 잠금","동시 승인 충돌"]'),
 ('EMISSION_PROJECT_REPORT','확정 산정 결과로 다국어 보고서를 생성·검토·제출하고 정규화 데이터셋과 지문으로 진위를 검증한다.','프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.','PDF와 정규화 데이터셋이 동일 버전에 묶여 발급·제출되고 OCR·시각지문·데이터 비교 검증이 가능하다.',
  '["보고서 발급상태","제출상태","진위검증 성공률","재발급 건수"]','["보고 요약","양식·언어","미리보기","수치 대조","발급·제출","진위·다운로드 이력"]','["보고서 버전","산정 버전","언어","제출처","총 배출량","Scope 결과","제품·부산물","정규화 데이터셋","OCR","시각지문","발급상태"]','["미리보기","PDF 생성","수치 검증","발급","제출","다운로드","진위확인 이동"]','["GET /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports","POST /home/api/emission-projects/{id}/reports/{reportId}/submit","POST /home/api/report-verification"]','["emission_report","emission_report_dataset","emission_report_fingerprint","emission_report_verification","emission_project_submission"]','["화면·PDF 동일 DOM","폰트·페이지 레이아웃","데이터셋·QR 포함","OCR 전체 항목 대조","재발급·제출 멱등성"]')
)
UPDATE framework_professional_screen_contract c SET
 business_purpose=d.purpose,
 entry_condition=d.entry_rule,
 exit_condition=d.exit_rule,
 kpi_contract=d.kpis,
 section_contract=(CASE c.audience WHEN 'ADMIN' THEN '["운영 현황","검색·필터","대상 목록","상세 작업공간","정책·이력","사용자 화면 연결"]' ELSE d.sections END),
 field_contract=d.fields,
 command_contract=d.commands,
 state_contract='["LOADING","EMPTY","ERROR","FORBIDDEN","READY","SAVING","CONFLICT","STALE_VERSION"]',
 api_contract=d.apis,
 data_contract=d.data_items,
 evidence_contract=d.evidence,
 responsive_contract='360px에서는 단일 열과 하단 주요 명령, 768px에서는 요약과 작업영역 분리, 1280px 이상에서는 목록·상세 2열을 사용하며 표는 열 우선순위와 가로 스크롤을 적용한다.',
 accessibility_contract='KRDS 및 WCAG 2.1 AA를 적용하고 제목 계층, 키보드 순서, 가시적 초점, 오류 요약과 필드 연결, 상태의 비색상 표기, 표 머리글 연결을 보장한다.',
 security_contract='서버에서 tenantId·projectId·actorCode·commandCode·version을 검증하고 최소권한, 업무분리, 객체수준 접근통제, 낙관적 잠금과 감사 이벤트를 적용한다.',
 contract_status='DESIGN_COMPLETE', updated_by='SYSTEM_DESIGN_COMPILER', updated_at=current_timestamp
FROM design d
WHERE c.process_code='EMISSION_PROJECT' AND c.step_code=d.step_code;

-- Canonical design notes and a selected semantic wireframe are generated from
-- the reviewed contract. Query-mode routes intentionally share one adaptive page.
INSERT INTO framework_screen_development_note
(route_key,route_path,page_id,page_title,design_note,function_note,acceptance_note,development_status,updated_by)
SELECT DISTINCT ON (lower(split_part(route_path,'?',1)))
 lower(split_part(route_path,'?',1)),split_part(route_path,'?',1),
 'PG_'||upper(substr(md5(lower(split_part(route_path,'?',1))),1,16)),screen_name,
 'KRDS 공통 헤더 아래 업무 요약, KPI, 검색·필터, 핵심 작업공간, 증적·이력, 다음 업무를 순서대로 배치한다. 모바일은 단일 열이며 데스크톱은 목록·상세 2열이다.',
 business_purpose||' 명령='||command_contract||' API='||api_contract||' 데이터='||data_contract,
 exit_condition||' 정상·예외·권한·격리·복구 시나리오를 통과하고 프론트 링크, API 계약, DB 버전과 감사 증적이 일치해야 한다.',
 'READY','SYSTEM_DESIGN_COMPILER'
FROM framework_professional_screen_contract
WHERE process_code='EMISSION_PROJECT'
ORDER BY lower(split_part(route_path,'?',1)),audience
ON CONFLICT(route_key) DO UPDATE SET
 page_title=excluded.page_title,design_note=excluded.design_note,function_note=excluded.function_note,
 acceptance_note=excluded.acceptance_note,development_status='READY',note_version=framework_screen_development_note.note_version+1,
 updated_by=excluded.updated_by,updated_at=current_timestamp;

INSERT INTO framework_screen_html_mockup
(route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,mockup_status,selected,updated_by)
SELECT n.route_key,n.route_path,n.page_id,1,n.page_title||' 표준 업무 시안',
 '전문 업무 액터가 진입 조건부터 완료 조건까지 한 화면에서 판단하고 다음 업무로 이동할 수 있는 KRDS 반응형 시안',
 format('<main class="krds-page" data-route="%s"><header class="krds-page-header"><p class="krds-eyebrow">탄소배출 프로젝트</p><h1>%s</h1></header><section aria-label="업무 요약" class="krds-summary"></section><section aria-label="검색과 필터" class="krds-filter"></section><div class="krds-workspace"><section aria-label="업무 목록" class="krds-list"></section><section aria-label="상세 작업" class="krds-detail"></section></div><section aria-label="증적과 이력" class="krds-evidence"></section><nav aria-label="다음 업무" class="krds-next-task"></nav></main>',n.route_path,n.page_title),
 'SELECTED',true,'SYSTEM_DESIGN_COMPILER'
FROM framework_screen_development_note n
WHERE n.route_key IN (SELECT lower(split_part(route_path,'?',1)) FROM framework_professional_screen_contract WHERE process_code='EMISSION_PROJECT')
ON CONFLICT(route_key,slot_no) DO UPDATE SET
 mockup_title=excluded.mockup_title,prompt_text=excluded.prompt_text,html_content=excluded.html_content,
 mockup_status='SELECTED',selected=true,mockup_version=framework_screen_html_mockup.mockup_version+1,
 updated_by=excluded.updated_by,updated_at=current_timestamp;

COMMENT ON VIEW framework_professional_screen_design_readiness IS
'개발 전 설계 계약의 완전성. API, DB, E2E 실행 증적은 framework_professional_screen_readiness에서 별도로 검증한다.';

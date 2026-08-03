-- Keep the executable seven-task workflow and enrich every step with the
-- account, actor, data, completion and navigation contract used by the UI.
ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_actor_definition SET
  purpose = CASE actor_code
    WHEN 'COMPANY_MANAGER' THEN '기업 경계·사업장·산정기간과 담당자를 확정하고 최종 보고 책임을 진다.'
    WHEN 'SITE_DATA_OWNER' THEN '수집 방식(직접·엑셀·API)을 관리하고 활동자료·단위·증빙을 제출하며 보완한다.'
    WHEN 'CALCULATOR' THEN '승인된 활동자료에 배출계수와 환산식을 매핑하고 Scope별 배출량을 재현 가능하게 산정한다.'
    WHEN 'VERIFIER' THEN '원천자료·증빙·산정 스냅샷을 독립 검증하고 보완 또는 검증 통과를 결정한다.'
    WHEN 'APPROVER' THEN '검증 완료 결과의 중요 오류와 책임 범위를 확인하고 승인·반려·재개방한다.'
    WHEN 'PLATFORM_OPERATOR' THEN '계정·액터·프로세스·감사·장애 상태를 관리하고 업무 중단을 복구한다.'
    ELSE purpose END,
  capability_codes = CASE actor_code
    WHEN 'COMPANY_MANAGER' THEN 'PROJECT_CREATE,BOUNDARY_CONFIRM,PROJECT_ASSIGN,REPORT_FINALIZE,REPORT_SUBMIT'
    WHEN 'SITE_DATA_OWNER' THEN 'SOURCE_CONFIG,DATA_VIEW,DATA_EDIT,EVIDENCE_UPLOAD,QUALITY_CHECK,SUBMIT,RESUBMIT'
    WHEN 'CALCULATOR' THEN 'FACTOR_SEARCH,FACTOR_MAP,UNIT_CONVERT,SCOPE_CLASSIFY,CALCULATE,RECALCULATE'
    WHEN 'VERIFIER' THEN 'VALIDATE,EVIDENCE_REVIEW,SNAPSHOT_COMPARE,CORRECTION_REQUEST,VALIDATION_PASS'
    WHEN 'APPROVER' THEN 'APPROVE,REJECT,LOCK_RESULT,REOPEN'
    WHEN 'PLATFORM_OPERATOR' THEN 'ACCOUNT_MANAGE,PROCESS_MANAGE,ASSIGNMENT_MANAGE,AUDIT,RECOVER,OVERRIDE'
    ELSE capability_codes END,
  updated_at = current_timestamp
WHERE actor_code IN ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER','PLATFORM_OPERATOR');

UPDATE framework_process_definition SET
  process_version='3.1.0',
  goal='기업 경계와 책임자를 확정한 뒤 활동자료 수집·품질검사·배출계수 매핑·Scope 산정·독립 검증·승인·보고서 및 인증서 발급까지 감사 가능한 하나의 프로젝트로 완료한다.',
  start_condition='승인된 기업과 활성 사업장이 존재하고 COMPANY_MANAGER, SITE_DATA_OWNER, CALCULATOR, VERIFIER, APPROVER 계정이 유효하게 배정되어 있다.',
  completion_condition='승인된 산정 스냅샷과 최종 보고서가 잠금·발행되고 인증서 또는 제출 이력, 해시와 감사 증적이 보존되어 있다.',
  updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT';

UPDATE framework_process_step SET
  step_name='프로젝트·조직경계 설정',
  requirement_text='산정 목적, 조직·운영 경계, 대상 사업장, 기준연도·기간, 방법론, 중요성 기준과 5개 필수 액터 계정을 확정한다.',
  completion_rule='프로젝트 기본정보·조직경계·사업장·산정기간·방법론과 필수 액터 5종의 담당 계정이 저장됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('tenantId','projectName','siteId','periodStart','periodEnd','organizationBoundary','methodologyCode','companyManager','siteDataOwner','calculator','verifier','approver'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('projectId','boundarySnapshot','actorAssignments','dueDates','workflowExecutionId'))::text,
  user_path='/emission/project/create', admin_path='/admin/emission/project-management', api_contract='/home/api/emission-projects'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_SETUP';

UPDATE framework_process_step SET
  step_name='활동자료 수집·품질검사',
  requirement_text='직접입력·엑셀·API 수집원을 등록하고 요청·접수·증빙·단위·기간·중복·누락·이상치 검사를 완료한다.',
  completion_rule='모든 필수 자료 요청이 접수되고 차단 품질오류 0건이며 증빙이 연결된 제출 버전이 승인 대기 상태로 저장됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','sourceType','facilityId','activityType','period','quantity','unit','evidence','dataOwner'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('submissionId','sourceSnapshot','qualityRunId','qualityScore','evidenceHashes','acceptedItems'))::text,
  user_path='/emission/activity-data', admin_path='/admin/emission/activity-data', api_contract='/home/api/emission-projects/{projectId}/activity-data'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_COLLECT';

UPDATE framework_process_step SET
  step_name='계수 매핑·Scope 배출량 산정',
  requirement_text='승인된 활동자료마다 단위 호환성을 확인하고 배출계수·출처·버전을 확정한 뒤 Scope 1·2·3 및 사업장별 배출량을 산정한다.',
  completion_rule='미매핑·단위불일치 0건이고 입력 스냅샷 해시, 계산식, 계수 버전과 Scope별 산정 결과 버전이 저장됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','acceptedSubmissionIds','activityId','quantity','activityUnit','factorId','factorUnit','factorVersion','scopeClass'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('calculationId','calculationVersion','inputSnapshotHash','scopeTotals','siteTotals','calculationItems'))::text,
  user_path='/emission/calculation', admin_path='/admin/emission/calculation-result', api_contract='/home/api/emission-projects/{projectId}/calculation'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CALCULATE';

UPDATE framework_process_step SET
  step_name='독립 검증·보완 판정',
  requirement_text='검증 담당자가 원천자료, 증빙, 계수, 단위, 계산식, 경계와 산정 스냅샷을 확인하여 통과 또는 보완을 판정한다.',
  completion_rule='차단 검증오류 0건이고 검증 체크리스트·판정·검증자·시각·대상 산정버전이 감사이력에 저장됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','calculationId','inputSnapshotHash','evidenceHashes','verificationChecklist'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('verificationId','decision','findings','correctionRequestId','verifiedAt'))::text,
  user_path='/emission/validate', admin_path='/admin/emission/validation-queue', api_contract='/home/api/emission-projects/{projectId}/verification'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_VALIDATE';

UPDATE framework_process_step SET
  step_name='보완·재산정',
  requirement_text='보완 판정된 항목의 원인·담당자·기한을 관리하고 자료 수정, 재제출, 계수 재매핑과 재산정을 수행한다.',
  completion_rule='모든 보완요청이 해결되고 신규 제출·산정 버전이 생성되어 검증 단계로 재진입함',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','correctionRequestId','findingId','reason','assignee','dueDate','changedFields'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('resubmissionId','newCalculationId','changeSummary','resolvedFindings'))::text,
  user_path='/emission/data_input?mode=correction', admin_path='/admin/emission/correction-management', api_contract='/home/api/emission-projects/{projectId}/corrections'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_CORRECT';

UPDATE framework_process_step SET
  step_name='검토·승인·결과 잠금',
  requirement_text='승인권자가 검증 결과, 중요 오류, 예외와 책임 범위를 검토하여 승인·반려하고 승인 버전을 잠근다.',
  completion_rule='권한 있는 승인자의 전자 승인, 승인 의견, 승인 시각과 잠긴 산정 버전이 저장됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','verificationId','calculationId','materialFindings','approvalComment'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('approvalId','decision','lockedCalculationVersion','approvedAt','auditEventId'))::text,
  user_path='/emission/validate?tab=approval', admin_path='/admin/emission/approval-queue', api_contract='/home/api/emission-projects/{projectId}/approval'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_APPROVE';

UPDATE framework_process_step SET
  step_name='보고·제출·인증서 발급',
  requirement_text='승인된 잠금 버전으로 보고서를 생성·제출하고 인증서 ID, QR, 시각지문, 데이터셋·리포트 해시와 진위확인 정보를 발급한다.',
  completion_rule='최종 보고서와 제출 이력, 인증서 ID, 데이터셋 해시, 리포트 해시 및 진위확인 URL이 보존됨',
  input_contract=jsonb_build_object('required',jsonb_build_array('projectId','approvalId','lockedCalculationVersion','reportTemplate','language','recipient'))::text,
  output_contract=jsonb_build_object('produces',jsonb_build_array('reportId','reportFile','submissionReceipt','certificateId','datasetHash','reportHash','verificationUrl'))::text,
  user_path='/emission/report_submit', admin_path='/admin/emission/report-management', api_contract='/home/api/emission-projects/{projectId}/reports'
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_REPORT';

-- Test harness accounts cover each business actor without sharing production authority.
INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
VALUES
 ('qaowner26','TEST_COMPANY_001','*','COMPANY_MANAGER','TEST_COMPANY_001','ACTIVE'),
 ('qadata26','TEST_COMPANY_001','*','SITE_DATA_OWNER','TEST_COMPANY_001','ACTIVE'),
 ('qacalc26','TEST_COMPANY_001','*','CALCULATOR','TEST_COMPANY_001','ACTIVE'),
 ('qaverify26','TEST_COMPANY_001','*','VERIFIER','TEST_COMPANY_001','ACTIVE'),
 ('qaapprove26','TEST_COMPANY_001','*','APPROVER','TEST_COMPANY_001','ACTIVE')
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
 data_scope=excluded.data_scope, assignment_status='ACTIVE', valid_until=null;

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

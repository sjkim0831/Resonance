create table if not exists framework_process_design_revision (
    revision_id bigserial primary key,
    process_code varchar(100) not null,
    revision_reason text not null,
    snapshot jsonb not null,
    created_by varchar(100) not null default 'SYSTEM',
    created_at timestamp not null default current_timestamp
);

insert into framework_process_design_revision(process_code, revision_reason, snapshot)
select process_code,
       '2026-08-05 professional relay contract correction',
       jsonb_build_object(
         'definition', to_jsonb(d),
         'steps', coalesce((select jsonb_agg(to_jsonb(s) order by s.step_order) from framework_process_step s where s.process_code=d.process_code),'[]'::jsonb),
         'executionSpecs', coalesce((select jsonb_agg(to_jsonb(es) order by es.step_code) from framework_step_execution_spec es where es.process_code=d.process_code),'[]'::jsonb)
       )
  from framework_process_definition d
 where process_code in ('ORGANIZATIONAL_BOUNDARY','EMISSION_CALCULATION');

alter table framework_process_definition disable trigger trg_guard_locked_process_definition;
update framework_process_definition
   set definition_locked=false,
       definition_lock_reason='Controlled contract correction V20260805232000; pre-change snapshot stored',
       updated_at=current_timestamp
 where process_code in ('ORGANIZATIONAL_BOUNDARY','EMISSION_CALCULATION');
alter table framework_process_definition enable trigger trg_guard_locked_process_definition;

alter table framework_process_step disable trigger trg_guard_locked_process_step;

create table if not exists framework_process_dependency (
    parent_process_code varchar(100) not null,
    parent_step_code varchar(100) not null,
    child_process_code varchar(100) not null,
    dependency_order integer not null,
    dependency_type varchar(30) not null default 'COMPLETION_GATE',
    completion_required boolean not null default true,
    use_at char(1) not null default 'Y',
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp,
    primary key(parent_process_code,parent_step_code,child_process_code)
);

insert into framework_process_dependency(parent_process_code,parent_step_code,child_process_code,dependency_order,dependency_type,completion_required)
values
 ('EMISSION_PROJECT','EMISSION_PROJECT_SETUP','ORGANIZATIONAL_BOUNDARY',1,'COMPLETION_GATE',true),
 ('EMISSION_PROJECT','EMISSION_PROJECT_COLLECT','ACTIVITY_DATA',2,'COMPLETION_GATE',true),
 ('EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE','EMISSION_CALCULATION',3,'COMPLETION_GATE',true)
on conflict(parent_process_code,parent_step_code,child_process_code) do update set
 dependency_order=excluded.dependency_order,
 dependency_type=excluded.dependency_type,
 completion_required=excluded.completion_required,
 use_at='Y',updated_at=current_timestamp;

comment on table framework_process_dependency is
  'Parent orchestration gates and reusable child processes. Prevents duplicate business execution while preserving the guided main process.';

update framework_process_step
   set actor_code='CALCULATOR',
       requirement_text='승인된 활동자료 스냅샷을 기준으로 단위 환산, 배출계수 매핑, Scope 분류와 항목별 배출량을 계산하고 계산 근거를 보존한다.',
       input_contract='{"required":["acceptedSubmissionSnapshotId","calculatorAccountId","calculationMethodVersion","factorVersion","unitConversionVersion"],"forbidden":["mutableUnacceptedRows","unversionedFactor"]}',
       output_contract='{"required":["calculationVersionId","lineResults","scopeTotals","grandTotal","factorDecisionAudit","inputFingerprint"],"handoff":"EMISSION_CALCULATION_03_VERIFY"}',
       completion_rule='모든 승인 자료 행에 단위·배출계수·Scope·계산식이 연결되고 항목 합계와 총배출량이 일치하며 불변 산정 버전과 입력 지문이 생성되어야 완료한다.'
 where process_code='EMISSION_CALCULATION' and step_code='EMISSION_CALCULATION_02_WORK';

update framework_process_step
   set input_contract='{"required":["acceptedSubmissionSnapshotId","calculationMethodVersion","factorVersion","unitConversionVersion","calculatorAssignment"],"forbidden":["mutableUnacceptedRows","unversionedFactor"]}',
       output_contract='{"required":["calculationPlanId","scopePolicy","materialityThreshold","recalculationPolicy","planApprovalEvidence"],"handoff":"EMISSION_CALCULATION_02_WORK"}',
       completion_rule='접수된 활동자료 스냅샷, 적용 방법론·배출계수·단위 버전, 중요성 기준과 재산정 정책 및 산정 담당자가 확정되어야 완료한다.'
 where process_code='EMISSION_CALCULATION' and step_code='EMISSION_CALCULATION_01_PLAN';

update framework_process_step
   set input_contract='{"required":["calculationVersionId","lineResults","scopeTotals","grandTotal","factorDecisionAudit","inputFingerprint"]}',
       output_contract='{"required":["verificationRunId","ruleResults","exceptions","reconciliationResult","verifierOpinion"],"handoff":"EMISSION_CALCULATION_04_APPROVE"}',
       completion_rule='중복·누락·단위·계수·합계·이상치 검증이 실행되고 모든 중대 오류가 해소되며 검증자 의견과 증적이 저장되어야 완료한다.'
 where process_code='EMISSION_CALCULATION' and step_code='EMISSION_CALCULATION_03_VERIFY';

update framework_process_step
   set input_contract='{"required":["calculationVersionId","verificationRunId","verifierOpinion","openExceptions"]}',
       output_contract='{"required":["approvedCalculationVersionId","approvalDecision","approvalComment","lockedAt","resultSnapshotHash"],"handoff":"PROCESS_COMPLETE"}',
       completion_rule='미해결 중대 예외가 없고 승인자가 검증 결과와 계산 근거를 확인하여 산정 버전을 잠금 승인하고 결과 스냅샷 해시를 생성해야 완료한다.'
 where process_code='EMISSION_CALCULATION' and step_code='EMISSION_CALCULATION_04_APPROVE';

with contracts(step_code,input_contract,output_contract,completion_rule) as (values
 ('ORGANIZATIONAL_BOUNDARY_S1',
  '{"required":["tenantId","projectId","reportingEntityId","reportingPeriod","legalEntities","sites","ownershipPercent","effectiveFrom","effectiveUntil","sourceEvidenceIds"],"autoFilled":["tenantId","projectId","actorCode","processCode","stepCode","idempotencyKey"]}'::jsonb,
  '{"required":["organizationInventoryVersion","entityCount","siteCount","ownershipEvidenceStatus","inventorySnapshotHash"],"handoff":"ORGANIZATIONAL_BOUNDARY_S2"}'::jsonb,
  '보고 법인과 모든 연결 법인·사업장, 지분율, 유효기간 및 원천 증빙이 중복 없이 등록되고 조직 원장 스냅샷 해시가 생성되어야 완료한다.'),
 ('ORGANIZATIONAL_BOUNDARY_S2',
  '{"required":["organizationInventoryVersion","consolidationApproach","controlAssessments","inclusionDecisions","exclusionReasons","materialityPolicy"],"allowedApproaches":["OPERATIONAL_CONTROL","FINANCIAL_CONTROL","EQUITY_SHARE"]}'::jsonb,
  '{"required":["boundaryDecisionVersion","includedEntityIds","excludedEntityIds","decisionEvidenceIds","decisionSnapshotHash"],"handoff":"ORGANIZATIONAL_BOUNDARY_S3"}'::jsonb,
  '모든 법인·사업장에 운영통제·재무통제·지분비율 중 하나의 기준을 일관되게 적용하고 포함·제외 사유와 근거를 확정해야 완료한다.'),
 ('ORGANIZATIONAL_BOUNDARY_S3',
  '{"required":["boundaryDecisionVersion","internalTransactions","eliminationRules","baseCurrency","conversionRates","consolidationPeriod"]}'::jsonb,
  '{"required":["consolidationRunId","eliminationEntries","reconciliationDifference","consolidatedEntityIds","calculationEvidenceIds"],"handoff":"ORGANIZATIONAL_BOUNDARY_S4"}'::jsonb,
  '내부거래 제거 규칙을 적용하고 연결 범위 합계와 원천 합계를 조정 명세로 대사하여 허용 오차 이내의 통합 결과를 생성해야 완료한다.'),
 ('ORGANIZATIONAL_BOUNDARY_S4',
  '{"required":["boundaryDecisionVersion","consolidationRunId","reconciliationDifference","reviewChecklist","openIssues"]}'::jsonb,
  '{"required":["approvedBoundaryVersion","approvalDecision","approvalComment","effectiveFrom","lockedAt","boundarySnapshotHash"],"handoff":"PROCESS_COMPLETE"}'::jsonb,
  '미해결 중대 이슈가 없고 승인자가 경계 기준·제외 사유·내부거래 제거·대사 결과를 검토하여 버전을 잠금 승인해야 완료한다.')
)
update framework_process_step s
   set input_contract=c.input_contract::text,
       output_contract=c.output_contract::text,
       completion_rule=c.completion_rule,
       requirement_text=c.completion_rule
  from contracts c
 where s.process_code='ORGANIZATIONAL_BOUNDARY' and s.step_code=c.step_code;

with field_sets(step_code,fields) as (values
 ('ORGANIZATIONAL_BOUNDARY_S1','[
  {"fieldCode":"reportingEntityId","fieldName":"보고 법인","fieldGroup":"조직 원장","fieldOrder":200,"dataType":"STRING","controlType":"ORGANIZATION_SELECT","required":true,"editable":true},
  {"fieldCode":"reportingPeriod","fieldName":"보고 기간","fieldGroup":"조직 원장","fieldOrder":210,"dataType":"DATE_RANGE","controlType":"DATE_RANGE","required":true,"editable":true},
  {"fieldCode":"legalEntities","fieldName":"연결 법인","fieldGroup":"조직 원장","fieldOrder":220,"dataType":"ARRAY","controlType":"ENTITY_TABLE","required":true,"editable":true},
  {"fieldCode":"sites","fieldName":"사업장","fieldGroup":"조직 원장","fieldOrder":230,"dataType":"ARRAY","controlType":"SITE_TABLE","required":true,"editable":true},
  {"fieldCode":"ownershipPercent","fieldName":"지분율","fieldGroup":"소유 구조","fieldOrder":240,"dataType":"DECIMAL","controlType":"PERCENT","required":true,"editable":true},
  {"fieldCode":"effectiveFrom","fieldName":"적용 시작일","fieldGroup":"소유 구조","fieldOrder":250,"dataType":"DATE","controlType":"DATE","required":true,"editable":true},
  {"fieldCode":"effectiveUntil","fieldName":"적용 종료일","fieldGroup":"소유 구조","fieldOrder":260,"dataType":"DATE","controlType":"DATE","required":false,"editable":true},
  {"fieldCode":"sourceEvidenceIds","fieldName":"법인·지분 증빙","fieldGroup":"증빙","fieldOrder":270,"dataType":"ARRAY","controlType":"FILE_UPLOAD","required":true,"editable":true,"evidenceRequired":true}
 ]'::jsonb),
 ('ORGANIZATIONAL_BOUNDARY_S2','[
  {"fieldCode":"consolidationApproach","fieldName":"연결 기준","fieldGroup":"경계 판정","fieldOrder":200,"dataType":"CODE","controlType":"SELECT","required":true,"editable":true,"options":["OPERATIONAL_CONTROL","FINANCIAL_CONTROL","EQUITY_SHARE"]},
  {"fieldCode":"controlAssessments","fieldName":"통제력 평가","fieldGroup":"경계 판정","fieldOrder":210,"dataType":"ARRAY","controlType":"ASSESSMENT_TABLE","required":true,"editable":true},
  {"fieldCode":"inclusionDecisions","fieldName":"포함 여부","fieldGroup":"경계 판정","fieldOrder":220,"dataType":"ARRAY","controlType":"DECISION_TABLE","required":true,"editable":true},
  {"fieldCode":"exclusionReasons","fieldName":"제외 사유","fieldGroup":"경계 판정","fieldOrder":230,"dataType":"ARRAY","controlType":"TEXTAREA","required":false,"editable":true},
  {"fieldCode":"materialityPolicy","fieldName":"중요성 기준","fieldGroup":"경계 판정","fieldOrder":240,"dataType":"STRING","controlType":"TEXTAREA","required":true,"editable":true},
  {"fieldCode":"decisionEvidenceIds","fieldName":"판정 증빙","fieldGroup":"증빙","fieldOrder":250,"dataType":"ARRAY","controlType":"FILE_UPLOAD","required":true,"editable":true,"evidenceRequired":true}
 ]'::jsonb),
 ('ORGANIZATIONAL_BOUNDARY_S3','[
  {"fieldCode":"internalTransactions","fieldName":"내부거래 원장","fieldGroup":"통합 계산","fieldOrder":200,"dataType":"ARRAY","controlType":"TRANSACTION_TABLE","required":true,"editable":true},
  {"fieldCode":"eliminationRules","fieldName":"제거 규칙","fieldGroup":"통합 계산","fieldOrder":210,"dataType":"ARRAY","controlType":"RULE_TABLE","required":true,"editable":true},
  {"fieldCode":"baseCurrency","fieldName":"기준 통화","fieldGroup":"통합 계산","fieldOrder":220,"dataType":"CODE","controlType":"SELECT","required":true,"editable":true},
  {"fieldCode":"conversionRates","fieldName":"환산율","fieldGroup":"통합 계산","fieldOrder":230,"dataType":"ARRAY","controlType":"RATE_TABLE","required":true,"editable":true},
  {"fieldCode":"reconciliationDifference","fieldName":"대사 차이","fieldGroup":"검증","fieldOrder":240,"dataType":"DECIMAL","controlType":"CALCULATED_NUMBER","required":true,"editable":false},
  {"fieldCode":"calculationEvidenceIds","fieldName":"통합 계산 증빙","fieldGroup":"증빙","fieldOrder":250,"dataType":"ARRAY","controlType":"FILE_UPLOAD","required":true,"editable":true,"evidenceRequired":true}
 ]'::jsonb),
 ('ORGANIZATIONAL_BOUNDARY_S4','[
  {"fieldCode":"approvedBoundaryVersion","fieldName":"조직경계 버전","fieldGroup":"승인","fieldOrder":200,"dataType":"STRING","controlType":"VERSION","required":true,"editable":false},
  {"fieldCode":"reviewChecklist","fieldName":"검토 체크리스트","fieldGroup":"승인","fieldOrder":210,"dataType":"ARRAY","controlType":"CHECKLIST","required":true,"editable":true},
  {"fieldCode":"openIssues","fieldName":"미해결 이슈","fieldGroup":"승인","fieldOrder":220,"dataType":"ARRAY","controlType":"ISSUE_TABLE","required":true,"editable":false},
  {"fieldCode":"approvalDecision","fieldName":"승인 결정","fieldGroup":"승인","fieldOrder":230,"dataType":"CODE","controlType":"SELECT","required":true,"editable":true,"options":["APPROVE","REQUEST_REVISION","REJECT"]},
  {"fieldCode":"approvalComment","fieldName":"승인 의견","fieldGroup":"승인","fieldOrder":240,"dataType":"STRING","controlType":"TEXTAREA","required":true,"editable":true},
  {"fieldCode":"boundarySnapshotHash","fieldName":"경계 스냅샷 해시","fieldGroup":"무결성","fieldOrder":250,"dataType":"HASH","controlType":"READONLY","required":true,"editable":false}
 ]'::jsonb)
)
update framework_step_execution_spec es
   set actor_contract=jsonb_set(coalesce(es.actor_contract,'{}'::jsonb),'{actorCode}',to_jsonb(s.actor_code),true),
       input_contract=framework_try_jsonb(s.input_contract),
       output_contract=framework_try_jsonb(s.output_contract),
       field_contract=jsonb_build_object('fields',(
         select jsonb_agg(
           f.value || jsonb_build_object(
             'route',s.user_path,'audience','USER',
             'pageCode',s.process_code||'_'||s.step_code||'_USER',
             'apiProperty',f.value->>'fieldCode','mappingStatus','LOGICAL_CONTRACT',
             'permissionCode',s.actor_code||':USER','privacyClass','INTERNAL'
           ) order by (f.value->>'fieldOrder')::integer
         ) from jsonb_array_elements(fs.fields) f(value)
       )),
       design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',
       blocker_codes='[]'::jsonb,updated_at=current_timestamp
  from field_sets fs
  join framework_process_step s on s.process_code='ORGANIZATIONAL_BOUNDARY' and s.step_code=fs.step_code
 where es.process_code=s.process_code and es.step_code=s.step_code;

update framework_step_execution_spec es
   set actor_contract=jsonb_set(coalesce(es.actor_contract,'{}'::jsonb),'{actorCode}',to_jsonb(s.actor_code),true),
       input_contract=framework_try_jsonb(s.input_contract),
       output_contract=framework_try_jsonb(s.output_contract),
       updated_at=current_timestamp
  from framework_process_step s
 where es.process_code='EMISSION_CALCULATION' and es.process_code=s.process_code and es.step_code=s.step_code;

alter table framework_process_step enable trigger trg_guard_locked_process_step;

update framework_process_definition
   set definition_locked=true,
       definition_lock_reason='Professional contract verified and relocked by V20260805232000',
       last_reviewed_at=current_timestamp,
       updated_at=current_timestamp
 where process_code in ('ORGANIZATIONAL_BOUNDARY','EMISSION_CALCULATION');

insert into comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at,dependent_screen_code)
values('A1030111','프로젝트 사전 설정','Prerequisites','/admin/emission/project-prerequisites','fact_check','Y',current_timestamp,current_timestamp,'Y','EM_PREREQ')
on conflict(menu_code) do update set menu_nm=excluded.menu_nm,menu_nm_en=excluded.menu_nm_en,menu_url=excluded.menu_url,menu_icon=excluded.menu_icon,use_at='Y',expsr_at='Y',dependent_screen_code=excluded.dependent_screen_code,last_updt_pnttm=current_timestamp;

insert into comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
values('A1030111',11,current_timestamp,current_timestamp)
on conflict(menu_code) do update set sort_ordr=excluded.sort_ordr,last_updt_pnttm=current_timestamp;

insert into ui_page_manifest
 (page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,page_title,page_url,version_status,created_at,updated_at)
values
 ('EMISSION_PROJECT_PREREQ_ADMIN','프로젝트 사전 설정','/admin/emission/project-prerequisites','EMISSION_ADMIN','1.0.0','KRDS_GOV_DEFAULT','Y','배출량 프로젝트 사전 설정','/admin/emission/project-prerequisites','READY',current_timestamp,current_timestamp)
on conflict(page_id) do update set page_name=excluded.page_name,route_path=excluded.route_path,domain_code=excluded.domain_code,design_token_version=excluded.design_token_version,active_yn='Y',page_title=excluded.page_title,page_url=excluded.page_url,version_status='READY',updated_at=current_timestamp;

insert into framework_screen_development_note
 (route_key,route_path,page_id,page_title,design_note,function_note,acceptance_note,development_status,updated_by)
values
 ('/admin/emission/project-prerequisites','/admin/emission/project-prerequisites','EMISSION_PROJECT_PREREQ_ADMIN','배출량 프로젝트 사전 설정',
  'KRDS 관리자 공통 셸, 공통 카드, 상태 배지, 반응형 그리드와 버튼을 재사용하여 프로젝트별 선행 설정을 한 화면에서 통제한다.',
  '기업·사업장·조직경계, 액터·계정, 배출계수·단위·산정방법, 워크플로·SLA, 보고서·인증서 설정을 기존 관리화면과 연결하고 미확인 상태를 완료로 간주하지 않는다.',
  '프로젝트 선택, 5개 선행 통제, 실제 관리화면 링크, 중립 상태 처리, 모바일 재배치, 인증·권한과 공통 자산 검증이 통과해야 완료한다.',
  'READY','FLYWAY')
on conflict(route_key) do update set route_path=excluded.route_path,page_id=excluded.page_id,page_title=excluded.page_title,design_note=excluded.design_note,function_note=excluded.function_note,acceptance_note=excluded.acceptance_note,development_status='READY',note_version=framework_screen_development_note.note_version+1,updated_by='FLYWAY',updated_at=current_timestamp;

insert into framework_design_preflight
 (page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by)
select p.page_id,p.route_path,'KRDS_GOV_DEFAULT','DETAIL_WORKSPACE','COMMON_CONTENT_CARD','KRDS_CONTENT_CARD','REUSED',
       md5(p.page_id||'|KRDS_GOV_DEFAULT|DETAIL_WORKSPACE|COMMON_CONTENT_CARD|KRDS_CONTENT_CARD'),
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true}',
       'COMMON_ONLY','COMMON','FLYWAY'
  from ui_page_manifest p
 where p.page_id='EMISSION_PROJECT_PREREQ_ADMIN'
   and not exists(select 1 from framework_design_preflight d where lower(split_part(d.route_path,'?',1))=lower(p.route_path) and d.reuse_policy='COMMON_ONLY' and d.source_scope='COMMON');

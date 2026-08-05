insert into framework_process_design_revision(process_code,revision_reason,snapshot)
select 'EMISSION_CALCULATION','Close four missing professional field contracts',
       jsonb_build_object('executionSpecs',coalesce(jsonb_agg(to_jsonb(es) order by es.step_code),'[]'::jsonb))
  from framework_step_execution_spec es
 where es.process_code='EMISSION_CALCULATION';

with field_sets(step_code,fields) as (values
 ('EMISSION_CALCULATION_01_PLAN','[
  {"fieldCode":"acceptedSubmissionSnapshotId","fieldName":"접수 활동자료 스냅샷","fieldGroup":"산정 계획","fieldOrder":200,"dataType":"STRING","controlType":"SNAPSHOT_SELECT","required":true,"editable":true},
  {"fieldCode":"calculationMethodVersion","fieldName":"산정 방법론 버전","fieldGroup":"산정 계획","fieldOrder":210,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":true},
  {"fieldCode":"factorVersion","fieldName":"배출계수 버전","fieldGroup":"산정 계획","fieldOrder":220,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":true},
  {"fieldCode":"unitConversionVersion","fieldName":"단위 환산 버전","fieldGroup":"산정 계획","fieldOrder":230,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":true},
  {"fieldCode":"materialityThreshold","fieldName":"중요성 기준","fieldGroup":"통제 기준","fieldOrder":240,"dataType":"DECIMAL","controlType":"PERCENT","required":true,"editable":true},
  {"fieldCode":"recalculationPolicy","fieldName":"재산정 정책","fieldGroup":"통제 기준","fieldOrder":250,"dataType":"STRING","controlType":"TEXTAREA","required":true,"editable":true},
  {"fieldCode":"calculatorAccountId","fieldName":"산정 담당자","fieldGroup":"담당자","fieldOrder":260,"dataType":"STRING","controlType":"ACCOUNT_SELECT","required":true,"editable":true},
  {"fieldCode":"planApprovalEvidence","fieldName":"계획 승인 증빙","fieldGroup":"증빙","fieldOrder":270,"dataType":"ARRAY","controlType":"FILE_UPLOAD","required":true,"editable":true,"evidenceRequired":true}
 ]'::jsonb),
 ('EMISSION_CALCULATION_02_WORK','[
  {"fieldCode":"acceptedSubmissionSnapshotId","fieldName":"접수 활동자료 스냅샷","fieldGroup":"입력","fieldOrder":200,"dataType":"STRING","controlType":"READONLY","required":true,"editable":false},
  {"fieldCode":"calculationVersionId","fieldName":"산정 버전","fieldGroup":"산정 실행","fieldOrder":210,"dataType":"STRING","controlType":"VERSION","required":true,"editable":false},
  {"fieldCode":"activityRows","fieldName":"산정 대상 활동자료","fieldGroup":"산정 실행","fieldOrder":220,"dataType":"ARRAY","controlType":"CALCULATION_TABLE","required":true,"editable":true},
  {"fieldCode":"scopeClassification","fieldName":"Scope 분류","fieldGroup":"산정 실행","fieldOrder":230,"dataType":"ARRAY","controlType":"SCOPE_MAPPING_TABLE","required":true,"editable":true},
  {"fieldCode":"unitConversions","fieldName":"단위 환산","fieldGroup":"산정 실행","fieldOrder":240,"dataType":"ARRAY","controlType":"CONVERSION_TABLE","required":true,"editable":true},
  {"fieldCode":"factorMappings","fieldName":"배출계수 매핑","fieldGroup":"산정 실행","fieldOrder":250,"dataType":"ARRAY","controlType":"FACTOR_MAPPING_TABLE","required":true,"editable":true},
  {"fieldCode":"lineResults","fieldName":"항목별 배출량","fieldGroup":"결과","fieldOrder":260,"dataType":"ARRAY","controlType":"CALCULATED_TABLE","required":true,"editable":false},
  {"fieldCode":"scopeTotals","fieldName":"Scope별 합계","fieldGroup":"결과","fieldOrder":270,"dataType":"OBJECT","controlType":"CALCULATED_SUMMARY","required":true,"editable":false},
  {"fieldCode":"grandTotal","fieldName":"총 배출량","fieldGroup":"결과","fieldOrder":280,"dataType":"DECIMAL","controlType":"CALCULATED_NUMBER","required":true,"editable":false},
  {"fieldCode":"inputFingerprint","fieldName":"입력 데이터 지문","fieldGroup":"무결성","fieldOrder":290,"dataType":"HASH","controlType":"READONLY","required":true,"editable":false}
 ]'::jsonb),
 ('EMISSION_CALCULATION_03_VERIFY','[
  {"fieldCode":"calculationVersionId","fieldName":"검증 대상 산정 버전","fieldGroup":"검증 입력","fieldOrder":200,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":false},
  {"fieldCode":"validationRuleVersion","fieldName":"검증 규칙 버전","fieldGroup":"검증 입력","fieldOrder":210,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":true},
  {"fieldCode":"duplicateCheck","fieldName":"중복 검증","fieldGroup":"자동 검증","fieldOrder":220,"dataType":"RESULT","controlType":"VALIDATION_RESULT","required":true,"editable":false},
  {"fieldCode":"missingCheck","fieldName":"누락 검증","fieldGroup":"자동 검증","fieldOrder":230,"dataType":"RESULT","controlType":"VALIDATION_RESULT","required":true,"editable":false},
  {"fieldCode":"unitCheck","fieldName":"단위 검증","fieldGroup":"자동 검증","fieldOrder":240,"dataType":"RESULT","controlType":"VALIDATION_RESULT","required":true,"editable":false},
  {"fieldCode":"factorCheck","fieldName":"배출계수 검증","fieldGroup":"자동 검증","fieldOrder":250,"dataType":"RESULT","controlType":"VALIDATION_RESULT","required":true,"editable":false},
  {"fieldCode":"reconciliationDifference","fieldName":"합계 대사 차이","fieldGroup":"자동 검증","fieldOrder":260,"dataType":"DECIMAL","controlType":"CALCULATED_NUMBER","required":true,"editable":false},
  {"fieldCode":"exceptions","fieldName":"검증 예외","fieldGroup":"예외 처리","fieldOrder":270,"dataType":"ARRAY","controlType":"ISSUE_TABLE","required":true,"editable":true},
  {"fieldCode":"verifierOpinion","fieldName":"검증자 의견","fieldGroup":"검증 결론","fieldOrder":280,"dataType":"STRING","controlType":"TEXTAREA","required":true,"editable":true}
 ]'::jsonb),
 ('EMISSION_CALCULATION_04_APPROVE','[
  {"fieldCode":"calculationVersionId","fieldName":"승인 대상 산정 버전","fieldGroup":"승인 입력","fieldOrder":200,"dataType":"STRING","controlType":"VERSION_SELECT","required":true,"editable":false},
  {"fieldCode":"verificationRunId","fieldName":"검증 실행 ID","fieldGroup":"승인 입력","fieldOrder":210,"dataType":"STRING","controlType":"READONLY","required":true,"editable":false},
  {"fieldCode":"verifierOpinion","fieldName":"검증자 의견","fieldGroup":"승인 입력","fieldOrder":220,"dataType":"STRING","controlType":"READONLY","required":true,"editable":false},
  {"fieldCode":"openExceptions","fieldName":"미해결 예외","fieldGroup":"승인 입력","fieldOrder":230,"dataType":"ARRAY","controlType":"ISSUE_TABLE","required":true,"editable":false},
  {"fieldCode":"approvalDecision","fieldName":"승인 결정","fieldGroup":"승인","fieldOrder":240,"dataType":"CODE","controlType":"SELECT","required":true,"editable":true,"options":["APPROVE","REQUEST_REVISION","REJECT"]},
  {"fieldCode":"approvalComment","fieldName":"승인 의견","fieldGroup":"승인","fieldOrder":250,"dataType":"STRING","controlType":"TEXTAREA","required":true,"editable":true},
  {"fieldCode":"resultSnapshotHash","fieldName":"결과 스냅샷 해시","fieldGroup":"무결성","fieldOrder":260,"dataType":"HASH","controlType":"READONLY","required":true,"editable":false}
 ]'::jsonb)
)
update framework_step_execution_spec es
   set field_contract=jsonb_build_object('fields',(
         select jsonb_agg(f.value || jsonb_build_object(
           'route',s.user_path,'audience','USER','pageCode',s.process_code||'_'||s.step_code||'_USER',
           'apiProperty',f.value->>'fieldCode','mappingStatus','LOGICAL_CONTRACT',
           'permissionCode',s.actor_code||':USER','privacyClass','INTERNAL'
         ) order by (f.value->>'fieldOrder')::integer)
         from jsonb_array_elements(fs.fields) f(value)
       )),
       design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',
       blocker_codes='[]'::jsonb,approved_by='FLYWAY',approved_at=current_timestamp,updated_at=current_timestamp
  from field_sets fs
  join framework_process_step s on s.process_code='EMISSION_CALCULATION' and s.step_code=fs.step_code
 where es.process_code=s.process_code and es.step_code=s.step_code;

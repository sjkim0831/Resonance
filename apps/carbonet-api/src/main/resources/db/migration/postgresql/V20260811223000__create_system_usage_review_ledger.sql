-- Human review decisions for the ordered system usage/test report.
-- This is an append-only review ledger. It never promotes contract or simulation
-- evidence to business E2E evidence and it never mutates immutable test runs.
CREATE TABLE IF NOT EXISTS framework_system_usage_review (
  review_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  screen_resource_id bigint REFERENCES framework_screen_resource(screen_resource_id),
  capability_code varchar(100) NOT NULL DEFAULT 'ALL',
  idempotency_key varchar(128) NOT NULL,
  review_status varchar(30) NOT NULL,
  review_note text NOT NULL DEFAULT '',
  process_version varchar(20) NOT NULL,
  contract_fingerprint varchar(128) NOT NULL,
  source_commit varchar(40) NOT NULL,
  linked_job_id bigint REFERENCES framework_development_job(job_id) ON DELETE SET NULL,
  reviewed_by varchar(100) NOT NULL,
  reviewed_at timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT framework_system_usage_review_step_fk
    FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE RESTRICT,
  CONSTRAINT framework_system_usage_review_status_ck
    CHECK(review_status IN ('APPROVED','CHANGE_REQUESTED')),
  CONSTRAINT framework_system_usage_review_change_note_ck
    CHECK(review_status<>'CHANGE_REQUESTED' OR length(btrim(review_note))>0),
  CONSTRAINT framework_system_usage_review_fingerprint_ck
    CHECK(length(btrim(contract_fingerprint))>0),
  CONSTRAINT framework_system_usage_review_source_commit_ck
    CHECK(source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT framework_system_usage_review_idempotency_uk UNIQUE(idempotency_key),
  CONSTRAINT framework_system_usage_review_idempotency_ck CHECK(length(btrim(idempotency_key))>0)
);

CREATE INDEX IF NOT EXISTS idx_framework_system_usage_review_latest
  ON framework_system_usage_review(process_code,step_code,reviewed_at DESC,review_id DESC);

CREATE INDEX IF NOT EXISTS idx_framework_simulation_run_latest_case
  ON framework_simulation_run(case_code,executed_at DESC,run_id DESC);

DO $screen_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM framework_screen_resource
     WHERE screen_resource_id=445 AND route_key='/admin/system/actor-process'
  ) THEN RAISE EXCEPTION 'system usage ledger screen 445 route contract is missing or drifted'; END IF;
END $screen_guard$;

INSERT INTO ui_help_page(page_id,title,summary,help_version,active_yn,created_at,updated_at)
VALUES('actor-process-governance','시스템 실사용 검증 대장 도움말',
       '업무 종류부터 화면·기능까지 실제 사용 순서, 증거 수준, 검토와 변경 요청을 확인합니다.','1.0.0','Y',current_timestamp,current_timestamp)
ON CONFLICT(page_id) DO UPDATE SET title=excluded.title,summary=excluded.summary,
  help_version=excluded.help_version,active_yn='Y',updated_at=current_timestamp;

INSERT INTO ui_help_item(item_id,page_id,title,body,anchor_selector,display_order,active_yn,placement,icon_name,highlight_style,created_at,updated_at)
VALUES
 ('actor-process-ledger-summary','actor-process-governance','검증 범위 요약','전체 구조 수와 현재 페이지의 결과를 구분해 확인합니다.','[data-help-id="usage-ledger-summary"]',10,'Y','bottom','monitoring','outline',current_timestamp,current_timestamp),
 ('actor-process-ledger-filter','actor-process-governance','업무·프로세스 필터','업무 종류와 프로세스를 실제 실행 순서로 좁혀 확인합니다.','[data-help-id="usage-ledger-filter"]',20,'Y','bottom','filter_alt','outline',current_timestamp,current_timestamp),
 ('actor-process-ledger-table','actor-process-governance','실사용 검증 대장','액터, 화면, 기능, 입력·출력, 증거 수준과 다음 업무를 순서대로 확인합니다.','[data-help-id="usage-ledger-table"]',30,'Y','top','table_view','outline',current_timestamp,current_timestamp),
 ('actor-process-ledger-detail','actor-process-governance','화면·기능 상세','선택한 한 절차의 전체 화면·기능 목록과 마스킹된 실행 증거를 불러옵니다.','[data-help-id="usage-ledger-detail"]',40,'Y','left','fact_check','outline',current_timestamp,current_timestamp),
 ('actor-process-ledger-review','actor-process-governance','승인·변경 요청','전체 상세를 확인한 뒤 사람 검토만 기록합니다. 승인은 E2E 검증을 승격하지 않습니다.','[data-help-id="usage-ledger-review"]',50,'Y','left','rate_review','outline',current_timestamp,current_timestamp)
ON CONFLICT(item_id) DO UPDATE SET page_id=excluded.page_id,title=excluded.title,body=excluded.body,
  anchor_selector=excluded.anchor_selector,display_order=excluded.display_order,active_yn='Y',placement=excluded.placement,
  icon_name=excluded.icon_name,highlight_style=excluded.highlight_style,updated_at=current_timestamp;

INSERT INTO framework_screen_capability(screen_resource_id,capability_code,capability_name,capability_type,
  command_contract,error_contract,evidence_contract,implementation_status,updated_at)
VALUES
 (445,'VIEW_SYSTEM_USAGE_LEDGER','시스템 실사용 검증 대장 조회','QUERY',
  '{"method":"GET","endpoint":"/admin/api/system/actor-process/system-test-report","role":"PLATFORM_ADMIN_ONLY","pagination":"STRUCTURAL_SCOPE"}',
  '{"401":"AUTHENTICATION_REQUIRED","403":"SYSTEM_REPORT_ADMIN_REQUIRED"}',
  '{"evidenceTier":"DESIGN","businessFunctionsExecuted":false,"runtimeVerified":false}','IMPLEMENTED',current_timestamp),
 (445,'AUDIT_SYSTEM_CONTRACTS','선택 절차 계약 감사 실행','COMMAND',
  '{"method":"POST","endpoint":"/admin/api/system/actor-process/system-test-report/audit","executionMode":"CONTRACT_ONLY"}',
  '{"401":"AUTHENTICATION_REQUIRED","403":"SYSTEM_REPORT_ADMIN_REQUIRED"}',
  '{"evidenceTier":"CONTRACT_SIMULATION","businessFunctionsExecuted":false,"runtimeVerified":false}','IMPLEMENTED',current_timestamp),
 (445,'REVIEW_SYSTEM_DESIGN','화면·기능 사람 검토 기록','COMMAND',
  '{"method":"POST","endpoint":"/admin/api/system/actor-process/system-test-report/reviews","statuses":["APPROVED","CHANGE_REQUESTED"],"autoDeploy":false}',
  '{"401":"AUTHENTICATION_REQUIRED","403":"SYSTEM_REPORT_ADMIN_REQUIRED","409":"IDEMPOTENCY_KEY_REUSE_MISMATCH"}',
  '{"evidenceTier":"HUMAN_REVIEW_ONLY","promotesBusinessE2E":false,"runtimeVerified":false}','IMPLEMENTED',current_timestamp),
 (445,'PRINT_SYSTEM_USAGE_LEDGER','실사용 검증 대장 인쇄','COMMAND',
  '{"action":"window.print","requiresAllStructuralPages":true}',
  '{"incomplete":"PRINT_REQUIRES_ALL_PAGES"}',
  '{"evidenceTier":"DESIGN","runtimeVerified":false}','IMPLEMENTED',current_timestamp),
 (445,'VIEW_SYSTEM_USAGE_LEDGER_DETAIL','선택 절차 전체 상세 조회','QUERY',
  '{"method":"GET","endpoint":"/admin/api/system/actor-process/system-test-report/step-detail","required":["processCode","stepCode"]}',
  '{"401":"AUTHENTICATION_REQUIRED","403":"SYSTEM_REPORT_ADMIN_REQUIRED","404":"SYSTEM_TEST_REPORT_STEP_NOT_FOUND"}',
  '{"evidenceTier":"DESIGN","reviewCriticalFieldsComplete":true,"runtimeVerified":false}','IMPLEMENTED',current_timestamp),
 (445,'EXPORT_SYSTEM_USAGE_LEDGER','실사용 검증 대장 텍스트 내보내기','COMMAND',
  '{"action":"CLIENT_EXPORT","format":"TXT","requiresAllStructuralPages":true}',
  '{"incomplete":"EXPORT_REQUIRES_ALL_PAGES"}',
  '{"evidenceTier":"DESIGN","runtimeVerified":false}','IMPLEMENTED',current_timestamp)
ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET capability_name=excluded.capability_name,
  capability_type=excluded.capability_type,command_contract=excluded.command_contract,error_contract=excluded.error_contract,
  evidence_contract=excluded.evidence_contract,implementation_status=excluded.implementation_status,updated_at=current_timestamp;

COMMENT ON TABLE framework_system_usage_review IS
  'Human design and usability review history. Review status is not runtime verification evidence.';
COMMENT ON COLUMN framework_system_usage_review.review_status IS
  'Human review only; APPROVED must not be interpreted as CONTRACT_SIMULATION or BUSINESS_E2E pass.';

DO $verify$
DECLARE
  missing_columns text;
BEGIN
  SELECT string_agg(required.name,', ' ORDER BY required.name) INTO missing_columns
    FROM (VALUES ('review_id'),('process_code'),('step_code'),('screen_resource_id'),('capability_code'),
                 ('idempotency_key'),('review_status'),('review_note'),('process_version'),
                 ('contract_fingerprint'),('source_commit'),('linked_job_id'),('reviewed_by'),('reviewed_at')) required(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns column_def
      WHERE column_def.table_schema='public' AND column_def.table_name='framework_system_usage_review'
        AND column_def.column_name=required.name
   );
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'framework_system_usage_review schema drift; missing columns: %',missing_columns;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint constraint_def
     WHERE constraint_def.conrelid='framework_system_usage_review'::regclass
       AND constraint_def.conname='framework_system_usage_review_idempotency_uk' AND constraint_def.contype='u'
       AND constraint_def.conkey=ARRAY[(SELECT attnum FROM pg_attribute
         WHERE attrelid='framework_system_usage_review'::regclass AND attname='idempotency_key')]::smallint[]
  ) THEN RAISE EXCEPTION 'framework_system_usage_review idempotency uniqueness is missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='framework_system_usage_review'::regclass
       AND conname='framework_system_usage_review_status_ck'
       AND pg_get_constraintdef(oid) LIKE '%APPROVED%CHANGE_REQUESTED%'
  ) THEN RAISE EXCEPTION 'framework_system_usage_review status check is missing or drifted'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint constraint_def
     WHERE constraint_def.conrelid='framework_system_usage_review'::regclass
       AND constraint_def.conname='framework_system_usage_review_step_fk'
       AND constraint_def.confrelid='framework_process_step'::regclass AND constraint_def.confdeltype='r'
       AND constraint_def.conkey=ARRAY[
         (SELECT attnum FROM pg_attribute WHERE attrelid='framework_system_usage_review'::regclass AND attname='process_code'),
         (SELECT attnum FROM pg_attribute WHERE attrelid='framework_system_usage_review'::regclass AND attname='step_code')]::smallint[]
       AND constraint_def.confkey=ARRAY[
         (SELECT attnum FROM pg_attribute WHERE attrelid='framework_process_step'::regclass AND attname='process_code'),
         (SELECT attnum FROM pg_attribute WHERE attrelid='framework_process_step'::regclass AND attname='step_code')]::smallint[]
  ) THEN RAISE EXCEPTION 'framework_system_usage_review append-only step FK is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='framework_system_usage_review'::regclass
    AND conname='framework_system_usage_review_change_note_ck' AND pg_get_constraintdef(oid) LIKE '%CHANGE_REQUESTED%')
  THEN RAISE EXCEPTION 'framework_system_usage_review change-note check is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='framework_system_usage_review'::regclass
    AND conname='framework_system_usage_review_fingerprint_ck' AND pg_get_constraintdef(oid) LIKE '%contract_fingerprint%')
  THEN RAISE EXCEPTION 'framework_system_usage_review fingerprint check is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='framework_system_usage_review'::regclass
    AND conname='framework_system_usage_review_source_commit_ck' AND pg_get_constraintdef(oid) LIKE '%source_commit%')
  THEN RAISE EXCEPTION 'framework_system_usage_review source-commit check is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='framework_system_usage_review'::regclass
    AND conname='framework_system_usage_review_idempotency_ck' AND pg_get_constraintdef(oid) LIKE '%idempotency_key%')
  THEN RAISE EXCEPTION 'framework_system_usage_review idempotency nonblank check is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_def WHERE constraint_def.conrelid='framework_system_usage_review'::regclass
    AND constraint_def.conname='framework_system_usage_review_screen_resource_id_fkey'
    AND constraint_def.confrelid='framework_screen_resource'::regclass AND constraint_def.confdeltype='a'
    AND constraint_def.conkey=ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='framework_system_usage_review'::regclass AND attname='screen_resource_id')]::smallint[]
    AND constraint_def.confkey=ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='framework_screen_resource'::regclass AND attname='screen_resource_id')]::smallint[])
  THEN RAISE EXCEPTION 'framework_system_usage_review screen FK is missing or drifted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint constraint_def WHERE constraint_def.conrelid='framework_system_usage_review'::regclass
    AND constraint_def.conname='framework_system_usage_review_linked_job_id_fkey'
    AND constraint_def.confrelid='framework_development_job'::regclass AND constraint_def.confdeltype='n'
    AND constraint_def.conkey=ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='framework_system_usage_review'::regclass AND attname='linked_job_id')]::smallint[]
    AND constraint_def.confkey=ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='framework_development_job'::regclass AND attname='job_id')]::smallint[])
  THEN RAISE EXCEPTION 'framework_system_usage_review linked-job FK is missing or drifted'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class index_def
     JOIN pg_namespace namespace_def ON namespace_def.oid=index_def.relnamespace
     WHERE namespace_def.nspname='public' AND index_def.relname='idx_framework_system_usage_review_latest'
       AND pg_get_indexdef(index_def.oid)=
         'CREATE INDEX idx_framework_system_usage_review_latest ON public.framework_system_usage_review USING btree (process_code, step_code, reviewed_at DESC, review_id DESC)'
  ) THEN RAISE EXCEPTION 'framework_system_usage_review latest index is missing or drifted'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND indexname='idx_screen_workflow_test_run_contract_evidence'
      AND indexdef LIKE '%screen_resource_id, process_code, step_code, capability_code%'
      AND indexdef LIKE '%evidence_json ? ''contractFingerprint''%'
  ) THEN RAISE EXCEPTION 'current screen workflow evidence lookup index is missing or drifted'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND indexname='idx_framework_simulation_run_latest_case'
      AND indexdef LIKE '%case_code, executed_at DESC, run_id DESC%'
  ) THEN RAISE EXCEPTION 'latest simulation case index is missing or drifted'; END IF;
  IF (SELECT count(*) FROM ui_help_item WHERE page_id='actor-process-governance' AND active_yn='Y')<>5
  THEN RAISE EXCEPTION 'system usage ledger help anchors are missing or drifted'; END IF;
  IF (SELECT count(*) FROM framework_screen_capability WHERE screen_resource_id=445 AND capability_code IN
      ('VIEW_SYSTEM_USAGE_LEDGER','VIEW_SYSTEM_USAGE_LEDGER_DETAIL','AUDIT_SYSTEM_CONTRACTS',
       'REVIEW_SYSTEM_DESIGN','PRINT_SYSTEM_USAGE_LEDGER','EXPORT_SYSTEM_USAGE_LEDGER')
      AND implementation_status='IMPLEMENTED')<>6
  THEN RAISE EXCEPTION 'system usage ledger screen capabilities are missing or drifted'; END IF;
END $verify$;

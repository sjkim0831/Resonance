-- COMPANY_REAPPLICATION_PUBLIC 1.0.0
--
-- This is a design-complete, implementation-review-required contract for the
-- implemented public reapplication route.  It deliberately creates no QA run,
-- no VERIFIED professional contract and no VERIFIED development job.
--
-- Route-policy effect before BUSINESS_E2E promotion:
--   EXECUTABLE +0, REVIEW_REQUIRED +0, canonical route total +0.
-- The exact PUBLIC binding remains DRAFT.  A successful fail-closed promoter
-- transaction activates it, yielding EXECUTABLE +1 / REVIEW_REQUIRED -1.

-- PUBLIC is a first-class screen audience.  Public contracts must be promotable
-- only after the same fail-closed BUSINESS_E2E evidence as USER/ADMIN screens.
ALTER TABLE framework_professional_screen_contract
  DROP CONSTRAINT IF EXISTS framework_professional_screen_contract_audience_check;
ALTER TABLE framework_professional_screen_contract
  ADD CONSTRAINT framework_professional_screen_contract_audience_check
  CHECK (audience IN ('PUBLIC','USER','ADMIN')) NOT VALID;
ALTER TABLE framework_professional_screen_contract
  VALIDATE CONSTRAINT framework_professional_screen_contract_audience_check;

ALTER TABLE framework_page_design
  DROP CONSTRAINT IF EXISTS framework_page_design_audience_check;
ALTER TABLE framework_page_design
  ADD CONSTRAINT framework_page_design_audience_check
  CHECK (audience IN ('PUBLIC','USER','ADMIN')) NOT VALID;
ALTER TABLE framework_page_design
  VALIDATE CONSTRAINT framework_page_design_audience_check;

-- COMTNINSTTFILE historically keyed files only by globally assumed INSTT_ID.
-- Preserve unresolved legacy rows without inventing a project: add nullable
-- scope, backfill only one-candidate matches and quarantine every unresolved
-- row.  New writes must provide PROJECT_ID/SCOPED; NOT NULL is a follow-up
-- closure after the quarantine is empty.
ALTER TABLE comtninsttfile ADD COLUMN IF NOT EXISTS project_id varchar(100);
ALTER TABLE comtninsttfile ADD COLUMN IF NOT EXISTS scope_status varchar(24);
ALTER TABLE comtninsttfile ADD COLUMN IF NOT EXISTS file_sha256 varchar(64);

UPDATE comtninsttfile
SET scope_status=coalesce(nullif(scope_status,''),'UNSCOPED')
WHERE scope_status IS NULL OR scope_status='';

ALTER TABLE comtninsttfile ALTER COLUMN scope_status SET DEFAULT 'UNSCOPED';
ALTER TABLE comtninsttfile ALTER COLUMN scope_status SET NOT NULL;

WITH candidate AS (
  SELECT trim(file.instt_id) instt_id,
         min(info.project_id) project_id,
         count(DISTINCT info.project_id) candidate_count
  FROM comtninsttfile file
  LEFT JOIN comtninsttinfo info ON trim(info.instt_id)=trim(file.instt_id)
  WHERE file.project_id IS NULL
  GROUP BY trim(file.instt_id)
)
UPDATE comtninsttfile file
SET project_id=candidate.project_id,
    scope_status='SCOPED'
FROM candidate
WHERE trim(file.instt_id)=candidate.instt_id
  AND candidate.candidate_count=1
  AND candidate.project_id IS NOT NULL
  AND file.project_id IS NULL;

UPDATE comtninsttfile file
SET scope_status=CASE
      WHEN file.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM comtninsttinfo info
        WHERE info.project_id=file.project_id AND trim(info.instt_id)=trim(file.instt_id)
      ) THEN 'SCOPED'
      WHEN file.project_id IS NOT NULL THEN 'MISSCOPED'
      WHEN EXISTS (
        SELECT 1 FROM comtninsttinfo info WHERE trim(info.instt_id)=trim(file.instt_id)
      ) THEN 'AMBIGUOUS'
      ELSE 'ORPHAN'
    END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='comtninsttfile'::regclass
      AND conname='ck_comtninsttfile_scope_status'
  ) THEN
    ALTER TABLE comtninsttfile ADD CONSTRAINT ck_comtninsttfile_scope_status
      CHECK (scope_status IN ('UNSCOPED','SCOPED','ORPHAN','AMBIGUOUS','MISSCOPED')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='comtninsttfile'::regclass
      AND conname='ck_comtninsttfile_sha256'
  ) THEN
    ALTER TABLE comtninsttfile ADD CONSTRAINT ck_comtninsttfile_sha256
      CHECK (file_sha256 IS NULL OR file_sha256 ~ '^[0-9a-f]{64}$') NOT VALID;
  END IF;
END $$;
ALTER TABLE comtninsttfile VALIDATE CONSTRAINT ck_comtninsttfile_scope_status;
ALTER TABLE comtninsttfile VALIDATE CONSTRAINT ck_comtninsttfile_sha256;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comtninsttinfo_project_instt
  ON comtninsttinfo(project_id,instt_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comtninsttfile_project_file
  ON comtninsttfile(project_id,file_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comtninsttfile_project_instt_sn
  ON comtninsttfile(project_id,instt_id,file_sn)
  WHERE project_id IS NOT NULL AND scope_status='SCOPED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='comtninsttfile'::regclass
      AND conname='fk_comtninsttfile_project_instt'
  ) THEN
    ALTER TABLE comtninsttfile ADD CONSTRAINT fk_comtninsttfile_project_instt
      FOREIGN KEY(project_id,instt_id)
      REFERENCES comtninsttinfo(project_id,instt_id) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS framework_instt_file_scope_quarantine (
  file_id varchar(60) PRIMARY KEY,
  instt_id varchar(20) NOT NULL,
  observed_project_id varchar(100),
  reason_code varchar(24) NOT NULL
    CHECK (reason_code IN ('ORPHAN','AMBIGUOUS','MISSCOPED')),
  candidate_project_count integer NOT NULL DEFAULT 0,
  detected_at timestamp NOT NULL DEFAULT current_timestamp,
  resolved_project_id varchar(100),
  resolved_at timestamp,
  CHECK ((resolved_project_id IS NULL)=(resolved_at IS NULL))
);

INSERT INTO framework_instt_file_scope_quarantine(
  file_id,instt_id,observed_project_id,reason_code,candidate_project_count
)
SELECT file.file_id,trim(file.instt_id),file.project_id,file.scope_status,
       (SELECT count(DISTINCT info.project_id) FROM comtninsttinfo info
        WHERE trim(info.instt_id)=trim(file.instt_id))
FROM comtninsttfile file
WHERE file.scope_status IN ('ORPHAN','AMBIGUOUS','MISSCOPED')
ON CONFLICT(file_id) DO UPDATE SET
  instt_id=excluded.instt_id,
  observed_project_id=excluded.observed_project_id,
  reason_code=excluded.reason_code,
  candidate_project_count=excluded.candidate_project_count,
  detected_at=current_timestamp,
  resolved_project_id=NULL,
  resolved_at=NULL;

-- Keep the bad value only in quarantine.  A nullable project_id on the source
-- row lets the composite foreign key remain enforceable without inventing a
-- project assignment for legacy evidence.
UPDATE comtninsttfile
SET project_id=NULL
WHERE scope_status='MISSCOPED';

ALTER TABLE comtninsttfile VALIDATE CONSTRAINT fk_comtninsttfile_project_instt;

CREATE OR REPLACE FUNCTION framework_enforce_instt_file_write_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolver_mode boolean := coalesce(current_setting('resonance.file_scope_resolver',true),'')='on';
BEGIN
  IF TG_OP='UPDATE'
     AND (NEW.file_id,NEW.instt_id,NEW.project_id,NEW.scope_status,NEW.file_sha256)
         IS DISTINCT FROM
         (OLD.file_id,OLD.instt_id,OLD.project_id,OLD.scope_status,OLD.file_sha256)
     AND NOT resolver_mode THEN
    RAISE EXCEPTION 'COMTNINSTTFILE_SCOPE_IDENTITY_IMMUTABLE file_id=%',OLD.file_id
      USING ERRCODE='55000';
  END IF;

  IF (TG_OP='INSERT' OR resolver_mode)
     AND NEW.scope_status='SCOPED'
     AND (NEW.project_id IS NULL OR NEW.file_sha256 IS NULL
          OR NEW.file_sha256 !~ '^[0-9a-f]{64}$'
          OR NOT EXISTS (
            SELECT 1 FROM comtninsttinfo info
            WHERE info.project_id=NEW.project_id
              AND trim(info.instt_id)=trim(NEW.instt_id)
          )) THEN
    RAISE EXCEPTION 'COMTNINSTTFILE_PROJECT_SCOPE_REQUIRED file_id=% project_id=% scope_status=%',
      NEW.file_id,NEW.project_id,NEW.scope_status USING ERRCODE='23514';
  END IF;

  IF TG_OP='INSERT' AND NEW.scope_status<>'SCOPED' THEN
    RAISE EXCEPTION 'COMTNINSTTFILE_NEW_WRITE_MUST_BE_SCOPED file_id=% scope_status=%',
      NEW.file_id,NEW.scope_status USING ERRCODE='23514';
  END IF;

  IF resolver_mode AND NEW.scope_status<>'SCOPED' AND NEW.project_id IS NOT NULL THEN
    RAISE EXCEPTION 'COMTNINSTTFILE_UNRESOLVED_SCOPE_MUST_CLEAR_PROJECT file_id=%',NEW.file_id
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_instt_file_write_scope ON comtninsttfile;
CREATE TRIGGER trg_enforce_instt_file_write_scope
BEFORE INSERT OR UPDATE OF file_id,instt_id,project_id,scope_status,file_sha256 ON comtninsttfile
FOR EACH ROW EXECUTE FUNCTION framework_enforce_instt_file_write_scope();

CREATE OR REPLACE FUNCTION framework_nonblank_text_array(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(bool_and(item IS NOT NULL AND btrim(item)<>''),true)
  FROM unnest(coalesce(items,ARRAY[]::text[])) item;
$$;

CREATE OR REPLACE FUNCTION framework_sha256_text_array(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(bool_and(item ~ '^[0-9a-f]{64}$'),true)
  FROM unnest(coalesce(items,ARRAY[]::text[])) item;
$$;

CREATE OR REPLACE FUNCTION framework_unique_text_array(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT cardinality(coalesce(items,ARRAY[]::text[]))=
         (SELECT count(DISTINCT item) FROM unnest(coalesce(items,ARRAY[]::text[])) item);
$$;

CREATE TABLE IF NOT EXISTS framework_company_reapplication_audit (
  audit_id bigserial PRIMARY KEY,
  project_id varchar(100) NOT NULL,
  instt_id varchar(100) NOT NULL,
  application_version integer NOT NULL,
  actor_code varchar(60) NOT NULL DEFAULT 'PUBLIC_APPLICANT',
  command_code varchar(100) NOT NULL DEFAULT 'RESUBMIT_COMPANY_APPLICATION',
  from_state varchar(60) NOT NULL DEFAULT 'REJECTED',
  to_state varchar(60) NOT NULL DEFAULT 'APPLIED',
  evidence_file_count integer NOT NULL DEFAULT 0 CHECK (evidence_file_count >= 0),
  evidence_file_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence_object_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence_sha256 text[] NOT NULL DEFAULT ARRAY[]::text[],
  rejection_reason text,
  change_hash varchar(64) NOT NULL CHECK (length(change_hash)=64),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT ck_company_reapplication_audit_file_ids
    CHECK (cardinality(evidence_file_ids)=evidence_file_count AND framework_nonblank_text_array(evidence_file_ids) AND framework_unique_text_array(evidence_file_ids)),
  CONSTRAINT ck_company_reapplication_audit_object_keys
    CHECK (cardinality(evidence_object_keys)=evidence_file_count AND framework_nonblank_text_array(evidence_object_keys) AND framework_unique_text_array(evidence_object_keys)),
  CONSTRAINT ck_company_reapplication_audit_sha256
    CHECK (cardinality(evidence_sha256)=evidence_file_count AND framework_sha256_text_array(evidence_sha256) AND framework_unique_text_array(evidence_sha256)),
  UNIQUE(project_id,instt_id,application_version)
);
ALTER TABLE framework_company_reapplication_audit
  ADD COLUMN IF NOT EXISTS evidence_file_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE framework_company_reapplication_audit
  ADD COLUMN IF NOT EXISTS evidence_object_keys text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE framework_company_reapplication_audit
  ADD COLUMN IF NOT EXISTS evidence_sha256 text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_company_reapplication_audit'::regclass
      AND conname='ck_company_reapplication_audit_file_ids'
  ) THEN
    ALTER TABLE framework_company_reapplication_audit
      ADD CONSTRAINT ck_company_reapplication_audit_file_ids
      CHECK (cardinality(evidence_file_ids)=evidence_file_count
             AND framework_nonblank_text_array(evidence_file_ids)
             AND framework_unique_text_array(evidence_file_ids)) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_company_reapplication_audit'::regclass
      AND conname='ck_company_reapplication_audit_object_keys'
  ) THEN
    ALTER TABLE framework_company_reapplication_audit
      ADD CONSTRAINT ck_company_reapplication_audit_object_keys
      CHECK (cardinality(evidence_object_keys)=evidence_file_count
             AND framework_nonblank_text_array(evidence_object_keys)
             AND framework_unique_text_array(evidence_object_keys)) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_company_reapplication_audit'::regclass
      AND conname='ck_company_reapplication_audit_sha256'
  ) THEN
    ALTER TABLE framework_company_reapplication_audit
      ADD CONSTRAINT ck_company_reapplication_audit_sha256
      CHECK (cardinality(evidence_sha256)=evidence_file_count
             AND framework_sha256_text_array(evidence_sha256)
             AND framework_unique_text_array(evidence_sha256)) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_company_reapplication_audit'::regclass
      AND conname='ck_company_reapplication_audit_change_hash'
  ) THEN
    ALTER TABLE framework_company_reapplication_audit
      ADD CONSTRAINT ck_company_reapplication_audit_change_hash
      CHECK (change_hash ~ '^[0-9a-f]{64}$') NOT VALID;
  END IF;
END $$;
ALTER TABLE framework_company_reapplication_audit
  VALIDATE CONSTRAINT ck_company_reapplication_audit_file_ids;
ALTER TABLE framework_company_reapplication_audit
  VALIDATE CONSTRAINT ck_company_reapplication_audit_object_keys;
ALTER TABLE framework_company_reapplication_audit
  VALIDATE CONSTRAINT ck_company_reapplication_audit_sha256;
ALTER TABLE framework_company_reapplication_audit
  VALIDATE CONSTRAINT ck_company_reapplication_audit_change_hash;

CREATE OR REPLACE FUNCTION framework_company_reapplication_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'COMPANY_REAPPLICATION_AUDIT_APPEND_ONLY operation=% audit_id=%',
    TG_OP,OLD.audit_id USING ERRCODE='55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_company_reapplication_audit_immutable
  ON framework_company_reapplication_audit;
CREATE TRIGGER trg_company_reapplication_audit_immutable
BEFORE UPDATE OR DELETE ON framework_company_reapplication_audit
FOR EACH ROW EXECUTE FUNCTION framework_company_reapplication_audit_immutable();
CREATE INDEX IF NOT EXISTS idx_company_reapplication_audit_institution
  ON framework_company_reapplication_audit(project_id,instt_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_reapplication_audit_state
  ON framework_company_reapplication_audit(to_state,created_at DESC);

INSERT INTO framework_actor_definition(
  actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
  delegation_allowed,use_at
) VALUES (
  'PUBLIC_APPLICANT','가입 신청자','Public Applicant','BUSINESS',
  '반려된 기업 신청을 본인 식별정보로 조회하고 보완 정보와 증빙을 다시 제출한다.',
  'COMPANY_APPLICATION_LOOKUP,COMPANY_APPLICATION_RESUBMIT,EVIDENCE_UPLOAD',false,'Y'
) ON CONFLICT(actor_code) DO UPDATE SET
  actor_name=excluded.actor_name,
  actor_name_en=excluded.actor_name_en,
  purpose=excluded.purpose,
  capability_codes=CASE
    WHEN position('COMPANY_APPLICATION_RESUBMIT' IN framework_actor_definition.capability_codes)>0
      THEN framework_actor_definition.capability_codes
    ELSE concat_ws(',',nullif(framework_actor_definition.capability_codes,''),excluded.capability_codes)
  END,
  use_at='Y',updated_at=current_timestamp;

INSERT INTO framework_actor_definition(
  actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
  delegation_allowed,use_at
) VALUES (
  'SYSTEM_RECOVERY','시스템 복구 실행자','System Recovery','SYSTEM',
  '사용자 업무와 분리된 예약 실행으로 기관 증빙의 crash-window 잔여 파일을 제한적으로 대사하고 안전한 고아 파일만 정리한다.',
  'EVIDENCE_RECONCILIATION,BOUNDED_SCAN,FAIL_CLOSED_DELETE,MULTI_POD_LOCK',false,'Y'
) ON CONFLICT(actor_code) DO UPDATE SET
  actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,
  actor_type=excluded.actor_type,purpose=excluded.purpose,
  capability_codes=excluded.capability_codes,delegation_allowed=false,
  use_at='Y',updated_at=current_timestamp;

INSERT INTO framework_process_definition(
  process_code,process_name,domain_code,process_version,goal,start_condition,
  completion_condition,process_status,development_order,owner_actor_code,
  risk_level,sla_hours,review_cycle_days,lifecycle_status,effective_from,
  next_review_at,definition_locked
) VALUES (
  'COMPANY_REAPPLICATION_PUBLIC','반려 기업 신청 보완·재신청','IDENTITY','1.0.0',
  '반려 사유를 확인한 신청자가 허용된 기업 정보와 신규 증빙을 보완하여 원자적으로 재접수하고 독립 승인자가 재심사한다.',
  '기업 신청이 프로젝트 범위에서 REJECTED 상태이고 사업자등록번호·대표자명·등록 담당자 연락처가 기존 신청과 일치한다.',
  '재신청 스냅샷과 증빙 및 감사 원장이 저장되고 승인자가 승인하거나 명확한 반려 사유로 신청자에게 되돌린다.',
  'ACTIVE',205,'PUBLIC_APPLICANT','HIGH',48,90,'ACTIVE',current_date,
  current_timestamp+interval '90 days',false
) ON CONFLICT(process_code) DO UPDATE SET
  process_name=excluded.process_name,process_version=excluded.process_version,
  goal=excluded.goal,start_condition=excluded.start_condition,
  completion_condition=excluded.completion_condition,process_status='ACTIVE',
  owner_actor_code=excluded.owner_actor_code,risk_level=excluded.risk_level,
  sla_hours=excluded.sla_hours,lifecycle_status='ACTIVE',definition_locked=false,
  next_review_at=excluded.next_review_at,updated_at=current_timestamp;

-- System-support work is deliberately not a framework_process_step.  It must
-- not appear in, gate, or increment the two sequential user work steps.
CREATE TABLE IF NOT EXISTS framework_system_support_contract (
  support_step_code varchar(100) PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
  support_type varchar(20) NOT NULL CHECK (support_type IN ('AUTOMATED','SUPPORT')),
  test_code varchar(120) NOT NULL,
  task_code varchar(120) NOT NULL,
  execution_mode varchar(30) NOT NULL CHECK (execution_mode IN ('SCHEDULED','ON_DEMAND')),
  scheduler_contract jsonb NOT NULL,
  safety_contract jsonb NOT NULL,
  source_contract jsonb NOT NULL,
  contract_status varchar(30) NOT NULL CHECK (contract_status IN ('DESIGNED','IMPLEMENTED','VERIFIED','BLOCKED')),
  evidence_status varchar(30) NOT NULL CHECK (evidence_status IN ('PENDING','UNIT_TESTED','RUNTIME_VERIFIED')),
  updated_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,test_code),
  UNIQUE(process_code,task_code)
);

INSERT INTO framework_system_support_contract(
  support_step_code,process_code,actor_code,support_type,test_code,task_code,
  execution_mode,scheduler_contract,safety_contract,source_contract,
  contract_status,evidence_status,updated_by
) VALUES (
  'COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION','COMPANY_REAPPLICATION_PUBLIC',
  'SYSTEM_RECOVERY','AUTOMATED','TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW',
  'TASK_COMPANY_REAPPLICATION_EVIDENCE_RECONCILE','SCHEDULED',
  '{"initialDelayMs":300000,"fixedDelayMs":900000,"minimumAgeMinutes":60,"scanLimit":500,"boundedScan":true,"trigger":"Spring @Scheduled"}'::jsonb,
  '{"databaseLookupBeforeDelete":true,"databaseFailureDeleteCount":0,"candidateRecheckedBeforeDelete":true,"multiPodLock":{"local":"ReentrantLock.tryLock","shared":"FileChannel.tryLock"},"legacyFilePreserved":true,"symbolicLinkPreserved":true,"symbolicLinkRootRejected":true,"allowedObjects":["UUID final pdf/png/jpg/jpeg","UUID staged part"]}'::jsonb,
  '{"implementation":"modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconciler.java","scheduler":"modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconciliationScheduler.java","test":"modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconcilerTest.java"}'::jsonb,
  'IMPLEMENTED','UNIT_TESTED','COMPANY_REAPPLICATION_PUBLIC_1_0_0'
) ON CONFLICT(support_step_code) DO UPDATE SET
  process_code=excluded.process_code,actor_code=excluded.actor_code,
  support_type=excluded.support_type,test_code=excluded.test_code,
  task_code=excluded.task_code,execution_mode=excluded.execution_mode,
  scheduler_contract=excluded.scheduler_contract,safety_contract=excluded.safety_contract,
  source_contract=excluded.source_contract,contract_status=excluded.contract_status,
  evidence_status=excluded.evidence_status,updated_by=excluded.updated_by,
  updated_at=current_timestamp;

INSERT INTO framework_process_step(
  process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
  completion_rule,user_path,admin_path,api_contract,step_type,requirement_text,
  input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,
  requires_database,requires_notification,automation_status,sla_hours,
  escalation_actor_code,evidence_required,evidence_types,rollback_command_code,
  decision_rule
) VALUES
(
  'COMPANY_REAPPLICATION_PUBLIC',1,'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT',
  '반려 사유 확인·정보 보완·재신청','PUBLIC_APPLICANT','REJECTED',
  'RESUBMIT_COMPANY_APPLICATION','APPLIED','필수 기업·담당자 정보와 신규 증빙 1~10개가 검증되고 상태 R→A, 감사 버전 증가 및 파일 원장이 하나의 트랜잭션으로 저장된다.',
  '/join/companyReapply',NULL,
  'GET /join/api/company-reapply/page; POST /join/api/company-reapply multipart',
  'FORM','사업자등록번호·대표자명·등록 담당자 이메일 또는 연락처로 본인의 반려 신청만 조회하고 반려 사유에 대응한 변경 정보와 증빙을 재제출한다.',
  '{"required":["bizNo","repName","registeredContact","insttId","agencyName","representativeName","zipCode","companyAddress","chargerName","chargerEmail","chargerTel","fileUploads"],"filePolicy":{"minCount":1,"maxCount":10,"maxSizeMb":10,"extensions":["pdf","jpg","jpeg","png"]}}',
  '{"required":["success","insttId","insttNm","bizrno","status","regDate","receipt"],"receipt":{"required":["applicationVersion","evidenceFileCount","changeHash","fileIds","fileSha256s"]},"state":"APPLIED"}',
  true,false,true,true,false,'IMPLEMENTED',24,'APPROVER',true,
  '기업등록증·법인 증빙 PDF/JPG/JPEG/PNG','CANCEL_REAPPLICATION',
  '현재 상태가 REJECTED이고 사업자등록번호·대표자명·등록 담당자 연락처와 DB 신청이 일치할 때만 한 번 재신청한다.'
),
(
  'COMPANY_REAPPLICATION_PUBLIC',2,'COMPANY_REAPPLICATION_APPROVER_REVIEW',
  '재신청 회원사 승인 또는 재반려','APPROVER','A',
  'DECIDE_COMPANY_REAPPLICATION','P','회원사 승인 목록과 증빙을 검토하고 실제 action API로 승인(P) 또는 반려(R)를 처리하여 결과와 선택 ID를 확인한다.',
  '/join/companyJoinStatusDetail','/admin/member/company-approve',
  'GET /admin/api/admin/member/company-approve/page; POST /admin/api/admin/member/company-approve/action',
  'APPROVAL','마스터 관리자는 회원사 목록·반려 사유·등록 증빙을 확인하고 단건 또는 일괄 승인·반려를 결정한다.',
  '{"required":["action"],"targetOneOf":["insttId","selectedIds"],"actionValues":["approve","batch_approve","reject","batch_reject"],"optional":["rejectReason"]}',
  '{"produces":["success","result","selectedIds","message"],"internalTargetStatus":["P","R"]}',
  false,true,true,true,false,'IMPLEMENTED',24,'PLATFORM_OPERATOR',true,
  '회원사 상세·등록 증빙·현재 반려 사유','REJECT_COMPANY_REAPPLICATION',
  'approve 또는 batch_approve는 targetStatus P, reject 또는 batch_reject는 targetStatus R로 변환하며 API 응답의 result와 selectedIds를 확인한다.'
)
ON CONFLICT(process_code,step_code) DO UPDATE SET
  step_order=excluded.step_order,step_name=excluded.step_name,actor_code=excluded.actor_code,
  from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,
  completion_rule=excluded.completion_rule,user_path=excluded.user_path,
  admin_path=excluded.admin_path,api_contract=excluded.api_contract,
  step_type=excluded.step_type,requirement_text=excluded.requirement_text,
  input_contract=excluded.input_contract,output_contract=excluded.output_contract,
  requires_user_page=excluded.requires_user_page,
  requires_admin_page=excluded.requires_admin_page,requires_api=true,
  requires_database=true,requires_notification=excluded.requires_notification,automation_status='IMPLEMENTED',
  sla_hours=excluded.sla_hours,escalation_actor_code=excluded.escalation_actor_code,
  evidence_required=true,evidence_types=excluded.evidence_types,
  rollback_command_code=excluded.rollback_command_code,
  decision_rule=excluded.decision_rule;

INSERT INTO framework_business_process_sequence(
  work_type_code,process_code,workflow_order,workflow_phase,process_role,
  prerequisite_process_codes,next_process_code,sequence_status
) VALUES (
  'MEMBER','COMPANY_REAPPLICATION_PUBLIC',205,'기업 신청 반려 보완','SUPPORT',
  'MEMBER_REGISTRATION','COMPANY_ONBOARDING','ACTIVE'
) ON CONFLICT(process_code) DO UPDATE SET
  work_type_code=excluded.work_type_code,workflow_order=excluded.workflow_order,
  workflow_phase=excluded.workflow_phase,process_role=excluded.process_role,
  prerequisite_process_codes=excluded.prerequisite_process_codes,
  next_process_code=excluded.next_process_code,sequence_status='ACTIVE',
  updated_at=current_timestamp;

INSERT INTO framework_screen_resource(
  route_key,screen_code,screen_name,screen_type,implementation_status,source_kind,source_ref,
  responsive_contract,accessibility_contract,security_contract,screen_description,
  business_domain_code,layout_type,mobile_strategy,generator_template_code,design_version
) VALUES (
  '/join/companyreapply','SCR_JOIN_COMPANY_REAPPLICATION','사업자 회원 재신청',
  'FORM_WIZARD','IMPLEMENTED','REACT_SOURCE',
  'projects/carbonet-frontend/source/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx',
  '{"mobile":"single-column","tablet":"adaptive-two-column","desktop":"lookup+form+evidence","overflow":"local-only","noTextOverflow":true}',
  '{"standard":"WCAG_2_1_AA","keyboard":true,"labels":true,"errorSummary":true,"focusManagement":true,"statusAnnouncement":true}',
  '{"authentication":"PUBLIC","csrfForWrite":true,"lookupRateLimit":true,"allowListedFields":true,"fileTypeSizeValidation":true,"secretLoggingForbidden":true}',
  '반려 신청 본인 조회, 반려 사유 확인, 기업·담당자 정보 보완, 증빙 업로드 및 재접수 화면',
  'IDENTITY','FORM_WIZARD','REFLOW','KRDS_PUBLIC_REAPPLICATION_V1','1.0.0'
) ON CONFLICT(route_key) DO UPDATE SET
  screen_name=excluded.screen_name,screen_type=excluded.screen_type,
  implementation_status='IMPLEMENTED',source_kind=excluded.source_kind,
  source_ref=excluded.source_ref,responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,
  screen_description=excluded.screen_description,business_domain_code=excluded.business_domain_code,
  layout_type=excluded.layout_type,mobile_strategy=excluded.mobile_strategy,
  generator_template_code=excluded.generator_template_code,design_version=excluded.design_version,
  updated_at=current_timestamp;

INSERT INTO framework_screen_resource(
  route_key,screen_code,screen_name,screen_type,implementation_status,source_kind,source_ref,
  responsive_contract,accessibility_contract,security_contract,screen_description,
  business_domain_code,layout_type,mobile_strategy,generator_template_code,design_version
) VALUES (
  '/admin/member/company-approve','SCR_ADMIN_COMPANY_APPROVE','회원사 승인',
  'REVIEW_DECISION','IMPLEMENTED','REACT_SOURCE',
  'projects/carbonet-frontend/source/src/features/company-approve/CompanyApproveMigrationPage.tsx',
  '{"mobile":"summary+decision","desktop":"queue+evidence+decision","overflow":"local-only"}',
  '{"standard":"WCAG_2_1_AA","keyboard":true,"labels":true,"decisionAnnouncement":true}',
  '{"authentication":"ADMIN","actor":"APPROVER","serverAuthorization":true,"audit":true}',
  '기업 가입·재신청 증빙 검토와 승인·반려 의사결정 화면','IDENTITY',
  'REVIEW_DECISION','REFLOW','KRDS_REVIEW_DECISION_V1','1.0.0'
) ON CONFLICT(route_key) DO NOTHING;

-- Retire only semantically incorrect bindings for the target route.  This
-- guarantees one exact active PUBLIC binding without touching another route.
UPDATE framework_process_step_screen_binding binding
SET binding_status='RETIRED',updated_at=current_timestamp
FROM framework_screen_resource resource
WHERE resource.screen_resource_id=binding.screen_resource_id
  AND resource.route_key='/join/companyreapply'
  AND binding.binding_status='ACTIVE'
  AND (binding.process_code,binding.step_code,binding.audience) <>
      ('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC');

INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,initial_view,
  context_contract,visibility_contract,completion_contract,guide_contract,binding_status,
  screen_sequence,is_required,transition_type,transition_condition,entry_condition,
  completion_action,input_contract,output_contract,permission_codes,api_contract,
  database_lineage,test_contract,design_version,contract_status
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT',
  resource.screen_resource_id,'PUBLIC','PUBLIC_APPLICANT','PRIMARY','REJECTED_APPLICATION_LOOKUP',
  '{"source":"COMPANY_REAPPLICATION_PUBLIC_1_0_0","canonicalRoute":"/join/companyreapply","routeAliases":["/join/companyReapply","/join/companyreapply","/join/en/companyReapply"],"projectId":"institution.projectId","processCode":"COMPANY_REAPPLICATION_PUBLIC","stepCode":"COMPANY_REAPPLICATION_PUBLIC_RESUBMIT","commonCards":{"workGuide":true,"screenDesign":true,"help":true,"qa":true}}',
  '{"authentication":false,"state":"REJECTED","identityMatch":["bizNo","repName","registeredContact"],"publicAdminActionsHidden":true}',
  '{"requiredFieldsValid":true,"evidenceMinCount":1,"conditionalStateTransition":"R_TO_A","auditVersionIncremented":true,"databaseReread":true}',
  '{"title":"반려 기업 신청 보완·재신청","purpose":"반려 사유에 맞게 기업·담당자 정보와 신규 증빙을 보완하여 다시 접수합니다.","sequence":["사업자등록번호·대표자명·등록 연락처 조회","반려 사유 확인","변경 정보 입력","증빙 1~10개 첨부","입력 검증","재신청 제출","접수증 확인"],"helpIds":["join-company-reapply-lookup","join-company-reapply-form","join-company-reapply-files"],"qa":{"prefillFromScreenFields":true,"editable":true,"runSequentially":true,"recordInputOutput":true},"nextStepCode":"COMPANY_REAPPLICATION_APPROVER_REVIEW"}',
  'DRAFT',1,true,'SEQUENTIAL','CURRENT_STATUS=REJECTED',
  '반려 상태이고 조회 식별자와 기존 신청이 일치한다.',
  'RESUBMIT_COMPANY_APPLICATION',
  '{"required":["bizNo","repName","registeredContact","insttId","agencyName","representativeName","zipCode","companyAddress","chargerName","chargerEmail","chargerTel","fileUploads"],"file":{"minCount":1,"maxCount":10,"maxSizeMb":10,"extensions":["pdf","jpg","jpeg","png"]}}',
  '{"required":["success","insttId","insttNm","bizrno","status","regDate","receipt"],"receipt":{"required":["applicationVersion","evidenceFileCount","changeHash","fileIds","fileSha256s"]},"internalAudit":{"auditId":"notExposed","evidenceObjectKeys":"notExposed"}}',
  '["PUBLIC_COMPANY_REAPPLICATION_LOOKUP","PUBLIC_COMPANY_REAPPLICATION_SUBMIT"]',
  '[{"method":"GET","path":"/join/api/company-reapply/page","query":["bizNo","repName","registeredContact"]},{"method":"POST","path":"/join/api/company-reapply","contentType":"multipart/form-data","transactional":true,"maxFileCount":10}]',
  '[{"table":"comtninsttinfo","key":["project_id","instt_id"],"stateColumn":"instt_sttus"},{"table":"comtninsttfile","key":["project_id","file_id"],"join":["project_id","instt_id"],"scopeColumn":"scope_status","requiredScope":"SCOPED","hashColumn":"file_sha256"},{"table":"framework_company_reapplication_audit","key":["project_id","instt_id","application_version"],"appendOnly":true,"evidenceIdentity":["evidence_file_ids","evidence_object_keys","evidence_sha256"]}]',
  '["HAPPY_PATH","VALIDATION","AUTHORITY","ISOLATION","CONFLICT","RECOVERY","DATABASE_REREAD","FILE_CLEANUP"]',
  '1.0.0','DESIGNED'
FROM framework_screen_resource resource
WHERE resource.route_key='/join/companyreapply'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
  actor_code=excluded.actor_code,entry_mode=excluded.entry_mode,initial_view=excluded.initial_view,
  context_contract=excluded.context_contract,visibility_contract=excluded.visibility_contract,
  completion_contract=excluded.completion_contract,guide_contract=excluded.guide_contract,
  binding_status='DRAFT',screen_sequence=1,is_required=true,transition_type='SEQUENTIAL',
  transition_condition=excluded.transition_condition,entry_condition=excluded.entry_condition,
  completion_action=excluded.completion_action,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,permission_codes=excluded.permission_codes,
  api_contract=excluded.api_contract,database_lineage=excluded.database_lineage,
  test_contract=excluded.test_contract,design_version='1.0.0',contract_status='DESIGNED',
  updated_at=current_timestamp;

INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,initial_view,
  context_contract,visibility_contract,completion_contract,guide_contract,binding_status,
  screen_sequence,is_required,transition_type,transition_condition,entry_condition,
  completion_action,input_contract,output_contract,permission_codes,api_contract,
  database_lineage,test_contract,design_version,contract_status
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_APPROVER_REVIEW',
  resource.screen_resource_id,'ADMIN','APPROVER','PRIMARY','REAPPLICATION_REVIEW_QUEUE',
  '{"processCode":"COMPANY_REAPPLICATION_PUBLIC","stepCode":"COMPANY_REAPPLICATION_APPROVER_REVIEW","sourceStepCode":"COMPANY_REAPPLICATION_PUBLIC_RESUBMIT","projectId":"ProjectRuntimeContext.currentProjectId","commonCards":{"workGuide":true,"screenDesign":true,"help":true,"qa":true}}',
  '{"authentication":true,"actor":"APPROVER","institutionStatus":"A","masterAdministratorRequired":true,"projectContextRequired":true}',
  '{"success":true,"resultRecorded":true,"selectedIdsReturned":true,"targetStatusApplied":"P_OR_R"}',
  '{"title":"재신청 회원사 승인 또는 재반려","sequence":["회원사 검색·필터","대상 선택","상세·증빙 열람","단건 또는 일괄 action 선택","반려 사유 입력(선택)","API 결과·선택 ID 확인"],"qa":{"recordInputOutput":true,"authorityNegativeCase":true},"rejectionNextStepCode":"COMPANY_REAPPLICATION_PUBLIC_RESUBMIT"}',
  'ACTIVE',1,true,'CONDITIONAL','targetStatus=P OR targetStatus=R',
  '회원사 상태가 A이고 현재 계정이 마스터 관리자 승인 권한을 보유한다.',
  'DECIDE_COMPANY_REAPPLICATION',
  '{"required":["action"],"targetOneOf":["insttId","selectedIds"],"actionValues":["approve","batch_approve","reject","batch_reject"],"optional":["rejectReason"]}',
  '{"required":["success","result","selectedIds"],"optional":["message"],"resultValues":["approved","batchApproved","rejected","batchRejected"],"internalTargetStatus":["P","R"]}',
  '["COMPANY_REAPPLICATION_REVIEW","COMPANY_REAPPLICATION_APPROVE","COMPANY_REAPPLICATION_REJECT"]',
  '[{"method":"GET","path":"/admin/api/admin/member/company-approve/page","query":["pageIndex","searchKeyword","sbscrbSttus","result"]},{"method":"POST","path":"/admin/api/admin/member/company-approve/action","body":["action","insttId","selectedIds","rejectReason"],"response":["success","result","selectedIds","message"]}]',
  '[{"table":"comtninsttinfo","key":["project_id","instt_id"],"statusColumn":"instt_sttus","adminLookupScope":"CURRENT_PROJECT_MASTER_ADMIN"},{"table":"comtninsttfile","key":["project_id","file_id"],"join":["project_id","instt_id"],"scopeColumn":"scope_status","requiredScope":"SCOPED","hashColumn":"file_sha256"},{"audit":"adminApprovalAuditSupport"}]',
  '["HAPPY_PATH","BATCH_ACTION","REJECT_LOOP","AUTHORITY","INVALID_ACTION","EMPTY_SELECTION","DATABASE_REREAD"]',
  '1.0.0','DESIGNED'
FROM framework_screen_resource resource
WHERE resource.route_key='/admin/member/company-approve'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
  actor_code=excluded.actor_code,entry_mode=excluded.entry_mode,initial_view=excluded.initial_view,
  context_contract=excluded.context_contract,visibility_contract=excluded.visibility_contract,
  completion_contract=excluded.completion_contract,guide_contract=excluded.guide_contract,
  binding_status='ACTIVE',transition_type='CONDITIONAL',
  transition_condition=excluded.transition_condition,entry_condition=excluded.entry_condition,
  completion_action=excluded.completion_action,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,permission_codes=excluded.permission_codes,
  api_contract=excluded.api_contract,database_lineage=excluded.database_lineage,
  test_contract=excluded.test_contract,design_version='1.0.0',contract_status='DESIGNED',
  updated_at=current_timestamp;

WITH contract(step_code,audience,route_path,screen_name,actor_code,purpose,entry_rule,exit_rule,
              fields,commands,states,apis,data_contract,evidence,screen_usage,transition,next_steps) AS (VALUES
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC','/join/companyReapply','사업자 회원 재신청','PUBLIC_APPLICANT',
 '반려 신청자가 본인 신청을 조회하고 반려 사유에 대응한 허용 정보 및 신규 증빙을 원자적으로 재접수한다.',
 '비로그인 공개 세션이며 사업자등록번호·대표자명·등록 담당자 연락처가 프로젝트 범위의 REJECTED 신청과 정확히 일치한다.',
 '필수값·파일 정책·상태 조건을 통과하고 COMTNINSTTINFO R→A, 파일 원장, 재신청 감사 버전이 함께 저장·재조회된다.',
  '["bizNo","repName","registeredContact","insttId","rejectionReason","agencyName","representativeName","bizRegistrationNumber","zipCode","companyAddress","companyAddressDetail","chargerName","chargerEmail","chargerTel","fileUploads"]',
 '["LOOKUP_REJECTED_APPLICATION","UPLOAD_REAPPLICATION_EVIDENCE","RESUBMIT_COMPANY_APPLICATION","RESET_AND_HOME"]',
 '["LOADING","LOOKUP_REQUIRED","REJECTED","EDITING","VALIDATION_ERROR","UPLOADING","SUBMITTING","APPLIED","CONFLICT","ERROR"]',
  '[{"method":"GET","path":"/join/api/company-reapply/page","query":["bizNo","repName","registeredContact"]},{"method":"POST","path":"/join/api/company-reapply","contentType":"multipart/form-data","maxFileCount":10}]',
 '[{"entity":"COMTNINSTTINFO","state":"INSTT_STTUS","scope":["PROJECT_ID","INSTT_ID"]},{"entity":"COMTNINSTTFILE","key":["PROJECT_ID","FILE_ID"],"join":["PROJECT_ID","INSTT_ID"],"scopeStatus":"SCOPED","hash":"FILE_SHA256"},{"entity":"framework_company_reapplication_audit","key":["PROJECT_ID","INSTT_ID","APPLICATION_VERSION"],"versioned":true,"appendOnly":true,"evidenceIdentity":["EVIDENCE_FILE_IDS","EVIDENCE_OBJECT_KEYS","EVIDENCE_SHA256"]}]',
 '["lookup identity decision","validated input snapshot","evidence metadata and hash","R-to-A row count","audit version","DB reread","orphan-file cleanup"]',
 'PRIMARY','SEQUENTIAL','["COMPANY_REAPPLICATION_APPROVER_REVIEW"]'::jsonb),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN','/admin/member/company-approve','기업 재신청 검토·승인','APPROVER',
 '마스터 관리자가 회원사 목록·상세·등록 증빙을 확인하고 실제 action 계약으로 단건 또는 일괄 승인·반려한다.',
 '인증된 APPROVER 계정이 마스터 관리자 권한을 보유하고 처리 대상 회원사를 선택한다.',
 '성공 응답의 result와 selectedIds를 확인하고 COMTNINSTTINFO 상태가 승인 P 또는 반려 R로 재조회된다.',
 '["pageIndex","searchKeyword","sbscrbSttus","insttId","companyName","businessNumber","representativeName","membershipTypeLabel","statusLabel","rejectReason","evidenceFiles","action","selectedIds","success","result","message"]',
 '["LOAD_COMPANY_APPROVAL_PAGE","OPEN_COMPANY_DETAIL","OPEN_EVIDENCE","APPROVE_COMPANY","BATCH_APPROVE_COMPANY","REJECT_COMPANY","BATCH_REJECT_COMPANY"]',
 '["LOADING","EMPTY","A","SUBMITTING","VALIDATION_ERROR","P","R","FORBIDDEN","ERROR"]',
 '[{"method":"GET","path":"/admin/api/admin/member/company-approve/page"},{"method":"POST","path":"/admin/api/admin/member/company-approve/action"}]',
 '[{"entity":"COMTNINSTTINFO","key":["PROJECT_ID","INSTT_ID"],"status":"INSTT_STTUS","values":["A","P","R"],"adminLookupScope":"CURRENT_PROJECT_MASTER_ADMIN"},{"entity":"COMTNINSTTFILE","key":["PROJECT_ID","FILE_ID"],"join":["PROJECT_ID","INSTT_ID"],"scopeStatus":"SCOPED","hash":"FILE_SHA256"},{"audit":"adminApprovalAuditSupport"}]',
 '["action payload","selected institution IDs","API success/result","P-or-R DB reread","approval audit event"]',
 'PRIMARY','CONDITIONAL','[]'::jsonb)
)
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
  entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
  command_contract,state_contract,api_contract,data_contract,evidence_contract,
  responsive_contract,accessibility_contract,security_contract,api_verified,
  database_verified,authority_verified,responsive_verified,accessibility_verified,
  exception_states_verified,audit_evidence_ref,contract_status,updated_by,
  menu_visibility,menu_verified,screen_code,project_context_required,
  tenant_context_required,process_sequence,step_sequence,screen_sequence,
  screen_usage_type,transition_type,previous_step_codes,next_step_codes,
  permission_codes,data_scope_contract,test_contract,design_version
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',c.step_code,c.audience,c.route_path,c.screen_name,
  c.actor_code,c.purpose,c.entry_rule,c.exit_rule,
  '["valid submission rate","rejection recurrence rate","decision SLA","duplicate submit blocked","orphan file count"]',
  '["업무 문맥·반려 사유","식별 조회","기업·담당자 정보","증빙","검증 요약","주요 명령","결과·다음 업무","감사 이력"]',
  c.fields,c.commands,c.states,c.apis,c.data_contract,c.evidence,
  '360px 단일열, 768px 적응형 이중열, 1280px 업무 최적화 배치이며 긴 내용은 줄바꿈하고 표·파일 목록만 내부 스크롤한다.',
  'KRDS 및 WCAG 2.1 AA: 명시적 레이블, 오류 요약과 필드 포커스, 키보드 파일 작업, 상태 알림, 비색상 판정을 제공한다.',
  CASE c.audience WHEN 'PUBLIC' THEN
    '공개 조회 속도제한, 쓰기 CSRF, 입력 허용목록, 서버 상태·식별자 재검증, 파일 MIME·확장자·크기 검증, 개인정보 로그 금지, 원자적 DB 저장을 강제한다.'
  ELSE '관리자 인증, 마스터 관리자 서버 권한, 개인정보 마스킹과 adminApprovalAuditSupport 결정 감사로그를 강제한다.' END,
  false,false,false,false,false,false,'PENDING:validate-company-reapplication-runtime.sh',
  'REVIEW_REQUIRED','COMPANY_REAPPLICATION_PUBLIC_1_0_0','HIDDEN',true,
  resource.screen_code,true,false,205,step.step_order,1,
  c.screen_usage,c.transition,
  CASE WHEN step.step_order=1 THEN '[]'::jsonb ELSE '["COMPANY_REAPPLICATION_PUBLIC_RESUBMIT"]'::jsonb END,
  c.next_steps,
  CASE c.audience WHEN 'PUBLIC' THEN '["PUBLIC_COMPANY_REAPPLICATION_LOOKUP","PUBLIC_COMPANY_REAPPLICATION_SUBMIT"]'::jsonb
       ELSE '["COMPANY_REAPPLICATION_REVIEW","COMPANY_REAPPLICATION_DECIDE"]'::jsonb END,
  jsonb_build_object('scope',CASE c.audience WHEN 'PUBLIC' THEN 'PROJECT_PUBLIC_LOOKUP_IDENTITY' ELSE 'CURRENT_PROJECT_MASTER_ADMIN' END,
                     'authorityScope',CASE c.audience WHEN 'PUBLIC' THEN 'PUBLIC_APPLICANT' ELSE 'GLOBAL_MASTER_ADMIN' END,
                     'tenantIsolation',false,'projectIsolation',true,'fieldAllowList',true),
  '{"families":["HAPPY_PATH","VALIDATION","AUTHORITY","ISOLATION","CONFLICT","RECOVERY","RESPONSIVE","ACCESSIBILITY"],"promotion":"BUSINESS_E2E_REQUIRED"}',
  '1.0.0'
FROM contract c
JOIN framework_process_step step
  ON step.process_code='COMPANY_REAPPLICATION_PUBLIC' AND step.step_code=c.step_code
JOIN framework_screen_resource resource
  ON resource.route_key=lower(split_part(c.route_path,'?',1))
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
  screen_name=excluded.screen_name,actor_code=excluded.actor_code,
  business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,
  exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
  section_contract=excluded.section_contract,field_contract=excluded.field_contract,
  command_contract=excluded.command_contract,state_contract=excluded.state_contract,
  api_contract=excluded.api_contract,data_contract=excluded.data_contract,
  evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
  api_verified=false,database_verified=false,authority_verified=false,
  responsive_verified=false,accessibility_verified=false,exception_states_verified=false,
  audit_evidence_ref=excluded.audit_evidence_ref,contract_status='REVIEW_REQUIRED',
  updated_by=excluded.updated_by,menu_visibility='HIDDEN',menu_verified=true,
  screen_code=excluded.screen_code,project_context_required=excluded.project_context_required,
  tenant_context_required=excluded.tenant_context_required,
  process_sequence=excluded.process_sequence,step_sequence=excluded.step_sequence,
  screen_sequence=1,screen_usage_type=excluded.screen_usage_type,
  transition_type=excluded.transition_type,previous_step_codes=excluded.previous_step_codes,
  next_step_codes=excluded.next_step_codes,permission_codes=excluded.permission_codes,
  data_scope_contract=excluded.data_scope_contract,test_contract=excluded.test_contract,
  design_version='1.0.0',contract_revision=framework_professional_screen_contract.contract_revision+1,
  updated_at=current_timestamp;

WITH pages(step_code,audience,page_code,title,purpose,screen_type,route_path,entity,upstream,downstream,actor,entry_rule,exit_rule) AS (VALUES
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT_PUBLIC','사업자 회원 재신청',
 '반려 신청 조회, 반려 사유 확인, 변경 정보 입력, 증빙 첨부와 재접수를 한 흐름으로 처리한다.',
 'FORM_WIZARD','/join/companyReapply','framework_company_reapplication_audit',NULL,'COMPANY_REAPPLICATION_APPROVER_REVIEW','PUBLIC_APPLICANT',
 'PROJECT_ID 범위의 REJECTED 신청과 사업자등록번호·대표자명·등록 담당자 연락처가 일치한다.',
 'R→A 상태 전이, 파일 원장, 변경 해시와 감사 버전이 트랜잭션으로 저장·재조회된다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN','COMPANY_REAPPLICATION_APPROVER_REVIEW_ADMIN','기업 재신청 검토·승인',
 '회원사 목록·상세·증빙을 확인하고 단건 또는 일괄 승인·반려 action을 실행한다.',
 'REVIEW_DECISION','/admin/member/company-approve','comtninsttinfo','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT',NULL,'APPROVER',
 'A 상태 회원사가 존재하고 마스터 관리자 승인 권한을 충족한다.',
 '실제 API result·selectedIds가 반환되고 대상 회원사의 상태 P 또는 R이 재조회된다.')
)
INSERT INTO framework_page_design(
  process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
  planned_route_path,actual_route_path,route_status,primary_entity,upstream_step_code,
  downstream_step_code,actor_code,entry_condition,exit_condition,responsive_contract,
  accessibility_contract,security_contract,exception_contract,design_status,
  design_version,updated_by
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',step_code,audience,page_code,title,purpose,screen_type,
  route_path,route_path,'IMPLEMENTED',entity,upstream,downstream,actor,entry_rule,exit_rule,
  '{"mobile":"single-column","tablet":"adaptive-two-column","desktop":"task-optimized","noTextOverflow":true,"tableOverflow":"local"}',
  '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"focusManagement":true,"errorSummary":true,"statusAnnouncement":true}',
  jsonb_build_object('audience',audience,'actorCode',actor,'serverAuthorization',true,
                     'projectIsolation',true,'projectContext','ProjectRuntimeContext','auditRequired',true,'fileSecurity',true),
  '{"states":["loading","empty","validation-error","forbidden","conflict","dependency-blocked","server-error","recovery"],"retry":"idempotent-only"}',
  'DESIGN_COMPLETE',1,'COMPANY_REAPPLICATION_PUBLIC_1_0_0'
FROM pages
ON CONFLICT(process_code,step_code,audience) DO UPDATE SET
  page_title=excluded.page_title,page_purpose=excluded.page_purpose,
  screen_type=excluded.screen_type,planned_route_path=excluded.planned_route_path,
  actual_route_path=excluded.actual_route_path,route_status='IMPLEMENTED',
  primary_entity=excluded.primary_entity,upstream_step_code=excluded.upstream_step_code,
  downstream_step_code=excluded.downstream_step_code,actor_code=excluded.actor_code,
  entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
  responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,exception_contract=excluded.exception_contract,
  design_status='DESIGN_COMPLETE',design_version=framework_page_design.design_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;

WITH fields(step_code,audience,ord,grp,code,name,dtype,control,required,editable,list_visible,
            search_enabled,source_table,source_column,api_property,mapping,privacy,permission,evidence,priority,help) AS (VALUES
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',10,'조회','bizNo','사업자등록번호','STRING','TEXT',true,true,false,true,'comtninsttinfo','bizrno','bizNo','DB_RESOLVED','PERSONAL','PUBLIC_LOOKUP',false,10,'숫자 10자리, 기존 반려 신청과 일치해야 합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',20,'조회','repName','대표자명','STRING','TEXT',true,true,false,true,'comtninsttinfo','reprsnt_nm','repName','DB_RESOLVED','PERSONAL','PUBLIC_LOOKUP',false,10,'기존 신청에 등록한 대표자명을 입력합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',25,'조회','registeredContact','등록 담당자 이메일·연락처','STRING','TEXT',true,true,false,false,NULL,NULL,'registeredContact','LOGICAL_CONTRACT','PERSONAL','PUBLIC_LOOKUP',false,10,'기존 신청에 등록된 담당자 이메일 또는 연락처와 일치해야 합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',30,'문맥','insttId','기업 신청 ID','STRING','HIDDEN',true,false,false,false,'comtninsttinfo','instt_id','insttId','DB_RESOLVED','INTERNAL','PUBLIC_RESUBMIT',false,100,'조회 성공 시 서버가 제공합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',40,'반려','rejectionReason','반려 사유','STRING','READ_ONLY_TEXTAREA',true,false,false,false,NULL,NULL,'rejectionReason','LOGICAL_CONTRACT','INTERNAL','PUBLIC_RESUBMIT',false,10,'반려 사유에 해당하는 항목과 증빙을 보완합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',50,'기업','agencyName','기업명','STRING','TEXT',true,true,false,false,'comtninsttinfo','instt_nm','agencyName','DB_RESOLVED','INTERNAL','PUBLIC_RESUBMIT',false,10,'법적 기업명을 입력합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',60,'기업','representativeName','대표자명','STRING','TEXT',true,true,false,false,'comtninsttinfo','reprsnt_nm','representativeName','DB_RESOLVED','PERSONAL','PUBLIC_RESUBMIT',false,10,'증빙과 일치해야 합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',70,'기업','bizRegistrationNumber','사업자등록번호','STRING','TEXT',true,false,false,false,'comtninsttinfo','bizrno','bizRegistrationNumber','DB_RESOLVED','PERSONAL','PUBLIC_RESUBMIT',false,10,'조회한 사업자등록번호는 변경할 수 없습니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',80,'주소','zipCode','우편번호','STRING','POSTCODE',true,true,false,false,'comtninsttinfo','zip','zipCode','DB_RESOLVED','INTERNAL','PUBLIC_RESUBMIT',false,10,'주소 검색 결과를 사용합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',90,'주소','companyAddress','기업 주소','STRING','ADDRESS',true,true,false,false,'comtninsttinfo','adres','companyAddress','DB_RESOLVED','INTERNAL','PUBLIC_RESUBMIT',false,10,'도로명 또는 지번 주소입니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',100,'주소','companyAddressDetail','상세 주소','STRING','TEXT',false,true,false,false,'comtninsttinfo','detail_adres','companyAddressDetail','DB_RESOLVED','INTERNAL','PUBLIC_RESUBMIT',false,20,'건물·층·호 정보를 입력합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',110,'담당자','chargerName','담당자명','STRING','TEXT',true,true,false,false,'comtninsttinfo','charger_nm','chargerName','DB_RESOLVED','PERSONAL','PUBLIC_RESUBMIT',false,10,'재심사 연락 담당자입니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',120,'담당자','chargerEmail','담당자 이메일','EMAIL','EMAIL',true,true,false,false,'comtninsttinfo','charger_email','chargerEmail','DB_RESOLVED','PERSONAL','PUBLIC_RESUBMIT',false,10,'재심사 결과 알림을 받을 이메일입니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',130,'담당자','chargerTel','담당자 연락처','PHONE','TEL',true,true,false,false,'comtninsttinfo','charger_tel','chargerTel','DB_RESOLVED','PERSONAL','PUBLIC_RESUBMIT',false,10,'숫자와 하이픈만 입력합니다.'),
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC',140,'증빙','fileUploads','신규 증빙','FILE_LIST','FILE_UPLOAD',true,true,false,false,'comtninsttfile','stre_file_nm','fileUploads','DB_RESOLVED','CONFIDENTIAL','PUBLIC_RESUBMIT',true,10,'PDF/JPG/JPEG/PNG, 파일당 10MB 이하, 1개 이상 필요합니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',10,'검색','pageIndex','페이지','INTEGER','PAGINATION',false,true,false,false,NULL,NULL,'pageIndex','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,40,'승인 목록의 현재 페이지입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',20,'검색','searchKeyword','검색어','STRING','SEARCH',false,true,false,true,NULL,NULL,'searchKeyword','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,20,'기업명·사업자등록번호 등 실제 목록 검색 조건입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',30,'검색','sbscrbSttus','가입 상태','CODE','SELECT',false,true,false,true,'comtninsttinfo','instt_sttus','sbscrbSttus','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,20,'처리할 가입 상태를 필터링합니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',40,'회원사','insttId','기업 ID','STRING','CHECKBOX',false,true,true,false,'comtninsttinfo','instt_id','insttId','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_DECIDE',false,10,'단건 처리 대상 ID이며 일괄 처리 시 selectedIds에 포함됩니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',50,'회원사','companyName','기업명','STRING','TEXT',false,false,true,true,'comtninsttinfo','instt_nm','companyName','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,10,'목록 조회 응답의 기업명입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',60,'회원사','businessNumber','사업자등록번호','STRING','TEXT',false,false,true,true,'comtninsttinfo','bizrno','businessNumber','DB_RESOLVED','PERSONAL','COMPANY_REAPPLICATION_REVIEW',false,10,'목록 조회 응답의 사업자등록번호입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',70,'회원사','representativeName','대표자명','STRING','TEXT',false,false,true,false,'comtninsttinfo','reprsnt_nm','representativeName','DB_RESOLVED','PERSONAL','COMPANY_REAPPLICATION_REVIEW',false,10,'목록 조회 응답의 대표자명입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',80,'회원사','membershipTypeLabel','회원 유형','STRING','BADGE',false,false,true,false,'comtninsttinfo','entrprs_se_code','membershipTypeLabel','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,20,'회원 유형 코드의 서버 변환 라벨입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',90,'회원사','statusLabel','가입 상태','STRING','BADGE',false,false,true,false,'comtninsttinfo','instt_sttus','statusLabel','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_REVIEW',false,10,'A·P·R 상태의 서버 변환 라벨입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',100,'검토','rejectReason','반려 사유','STRING','TEXTAREA',false,true,false,false,'comtninsttinfo','rjct_rsn','rejectReason','DB_RESOLVED','INTERNAL','COMPANY_REAPPLICATION_DECIDE',true,10,'반려 action에 전달되는 선택 입력이며 최대 1000자입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',110,'검토','evidenceFiles','등록 증빙','FILE_LIST','EVIDENCE_LINK',false,false,false,false,'comtninsttfile','orignl_file_nm','evidenceFiles','DB_RESOLVED','CONFIDENTIAL','COMPANY_REAPPLICATION_REVIEW',true,10,'회원사 등록 증빙 파일명과 권한 있는 다운로드 URL입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',120,'명령','action','처리 작업','CODE','ACTION_GROUP',true,true,false,false,NULL,NULL,'action','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_DECIDE',true,10,'approve·batch_approve·reject·batch_reject 중 하나입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',130,'명령','selectedIds','선택 기업 ID 목록','STRING_LIST','SELECTION',false,true,false,false,NULL,NULL,'selectedIds','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_DECIDE',true,10,'단건 insttId가 없을 때 하나 이상의 ID가 필요합니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',140,'결과','success','처리 성공','BOOLEAN','STATUS',false,false,false,false,NULL,NULL,'success','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_DECIDE',true,10,'API 처리 성공 여부입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',150,'결과','result','처리 결과 코드','CODE','STATUS',false,false,false,false,NULL,NULL,'result','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_DECIDE',true,10,'approved·batchApproved·rejected·batchRejected 중 하나입니다.'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','ADMIN',160,'결과','message','처리 메시지','STRING','ALERT',false,false,false,false,NULL,NULL,'message','LOGICAL_CONTRACT','INTERNAL','COMPANY_REAPPLICATION_DECIDE',false,20,'실패 또는 안내 메시지가 있을 때 반환됩니다.')
)
INSERT INTO framework_page_field_definition(
  page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
  required,editable,list_visible,search_enabled,source_table,source_column,api_property,
  mapping_status,validation_contract,privacy_class,permission_code,evidence_required,
  responsive_priority,help_text,design_source
)
SELECT page.page_design_id,f.ord,f.grp,f.code,f.name,f.dtype,f.control,f.required,
  f.editable,f.list_visible,f.search_enabled,f.source_table,f.source_column,
  f.api_property,f.mapping,
  CASE f.code
    WHEN 'bizNo' THEN '{"pattern":"^[0-9]{10}$"}'::jsonb
    WHEN 'registeredContact' THEN '{"minLength":1,"maxLength":254,"identityMatch":"registered-email-or-phone"}'::jsonb
    WHEN 'chargerEmail' THEN '{"format":"email","maxLength":100}'::jsonb
    WHEN 'chargerTel' THEN '{"pattern":"^[0-9-]{8,20}$"}'::jsonb
    WHEN 'fileUploads' THEN '{"minItems":1,"maxItems":10,"maxFileSizeMb":10,"extensions":["pdf","jpg","jpeg","png"]}'::jsonb
    WHEN 'action' THEN '{"enum":["approve","batch_approve","reject","batch_reject"]}'::jsonb
    WHEN 'selectedIds' THEN '{"minItems":1,"requiredWhen":{"insttId":"absent"}}'::jsonb
    WHEN 'rejectReason' THEN '{"maxLength":1000}'::jsonb
    WHEN 'result' THEN '{"enum":["approved","batchApproved","rejected","batchRejected"]}'::jsonb
    ELSE jsonb_build_object('required',f.required,'maxLength',CASE WHEN f.dtype IN ('STRING','EMAIL','PHONE') THEN 500 ELSE NULL END)
  END,
  f.privacy,f.permission,f.evidence,f.priority,f.help,'COMPANY_REAPPLICATION_PUBLIC_1_0_0'
FROM fields f
JOIN framework_page_design page
  ON page.process_code='COMPANY_REAPPLICATION_PUBLIC'
 AND page.step_code=f.step_code AND page.audience=f.audience
ON CONFLICT(page_design_id,field_code) DO UPDATE SET
  field_order=excluded.field_order,field_group=excluded.field_group,
  field_name=excluded.field_name,data_type=excluded.data_type,
  control_type=excluded.control_type,required=excluded.required,editable=excluded.editable,
  list_visible=excluded.list_visible,search_enabled=excluded.search_enabled,
  source_table=excluded.source_table,source_column=excluded.source_column,
  api_property=excluded.api_property,mapping_status=excluded.mapping_status,
  validation_contract=excluded.validation_contract,privacy_class=excluded.privacy_class,
  permission_code=excluded.permission_code,evidence_required=excluded.evidence_required,
  responsive_priority=excluded.responsive_priority,help_text=excluded.help_text,
  design_source=excluded.design_source,updated_at=current_timestamp;

INSERT INTO framework_screen_capability(
  screen_resource_id,capability_code,capability_name,capability_type,
  command_contract,error_contract,evidence_contract,implementation_status
)
SELECT resource.screen_resource_id,c.code,c.name,c.kind,c.command,c.errors,c.evidence,'IMPLEMENTED'
FROM framework_screen_resource resource
CROSS JOIN (VALUES
  ('LOOKUP_REJECTED_APPLICATION','반려 신청 조회','QUERY','{"method":"GET","path":"/join/api/company-reapply/page","identityKeys":["bizNo","repName","registeredContact"],"requiredState":"REJECTED"}'::jsonb,'{"codes":["REQUIRED_FIELDS_MISSING","APPLICATION_NOT_FOUND","STATE_NOT_REJECTED","RATE_LIMITED"]}'::jsonb,'{"lookupDecision":true,"personalDataMasked":true}'::jsonb),
  ('UPLOAD_REAPPLICATION_EVIDENCE','재신청 증빙 첨부','UPLOAD','{"extensions":["pdf","jpg","jpeg","png"],"maxFileSizeMb":10,"minCount":1,"maxCount":10,"malwareScan":"required"}'::jsonb,'{"codes":["FILE_REQUIRED","FILE_TYPE_INVALID","FILE_SIZE_EXCEEDED","FILE_STORE_FAILED"]}'::jsonb,'{"fileMetadata":true,"sha256":true,"cleanupOnRollback":true}'::jsonb),
 ('RESUBMIT_COMPANY_APPLICATION','기업 신청 재접수','COMMAND','{"method":"POST","path":"/join/api/company-reapply","transactional":true,"idempotencyRequired":true,"conditionalUpdate":"INSTT_STTUS=R"}'::jsonb,'{"codes":["VALIDATION_ERROR","CONFLICT","STATE_CHANGED","DATABASE_ERROR","FILE_CLEANUP_ERROR"]}'::jsonb,'{"beforeAfter":true,"auditVersion":true,"dbReread":true}'::jsonb)
) c(code,name,kind,command,errors,evidence)
WHERE resource.route_key='/join/companyreapply'
ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET
  capability_name=excluded.capability_name,capability_type=excluded.capability_type,
  command_contract=excluded.command_contract,error_contract=excluded.error_contract,
  evidence_contract=excluded.evidence_contract,implementation_status='IMPLEMENTED',
  updated_at=current_timestamp;

INSERT INTO framework_screen_capability(
  screen_resource_id,capability_code,capability_name,capability_type,
  command_contract,error_contract,evidence_contract,implementation_status
)
SELECT resource.screen_resource_id,c.code,c.name,c.kind,c.command,c.errors,c.evidence,'IMPLEMENTED'
FROM framework_screen_resource resource
CROSS JOIN (VALUES
 ('LOAD_COMPANY_REAPPLICATION_REVIEW','기업 재신청 검토 조회','QUERY','{"method":"GET","path":"/admin/api/admin/member/company-approve/page","query":["pageIndex","searchKeyword","sbscrbSttus","result"],"rowFields":["insttId","companyName","businessNumber","representativeName","membershipTypeLabel","statusLabel","rejectReason","evidenceFiles"]}'::jsonb,'{"httpStatus":[403,500]}'::jsonb,'{"approvalRows":true,"evidenceList":true}'::jsonb),
 ('DECIDE_COMPANY_REAPPLICATION','기업 재신청 승인·반려','DECISION','{"method":"POST","path":"/admin/api/admin/member/company-approve/action","body":{"required":["action"],"targetOneOf":["insttId","selectedIds"],"optional":["rejectReason"]},"actions":["approve","batch_approve","reject","batch_reject"],"response":["success","result","selectedIds","message"],"targetStatusMap":{"approve":"P","batch_approve":"P","reject":"R","batch_reject":"R"}}'::jsonb,'{"httpStatus":[400,403,500],"conditions":["EMPTY_SELECTION","INVALID_ACTION","FORBIDDEN","SERVER_ERROR"]}'::jsonb,'{"approvalAudit":true,"targetStatus":"P_OR_R","databaseReread":true}'::jsonb)
) c(code,name,kind,command,errors,evidence)
WHERE resource.route_key='/admin/member/company-approve'
ON CONFLICT(screen_resource_id,capability_code) DO UPDATE SET
  capability_name=excluded.capability_name,capability_type=excluded.capability_type,
  command_contract=excluded.command_contract,error_contract=excluded.error_contract,
  evidence_contract=excluded.evidence_contract,implementation_status='IMPLEMENTED',
  updated_at=current_timestamp;

INSERT INTO framework_step_capability_binding(
  process_code,step_code,capability_id,actor_code,required,permission_contract,completion_effect
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',mapping.step_code,capability.capability_id,
  mapping.actor_code,mapping.required,
  jsonb_build_object('audience',mapping.audience,'actorCode',mapping.actor_code,
                     'serverAuthorization',true,'fieldAllowList',true),mapping.effect
FROM (VALUES
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT','PUBLIC','LOOKUP_REJECTED_APPLICATION',true,'{"state":"REJECTED_CONFIRMED"}'::jsonb),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT','PUBLIC','UPLOAD_REAPPLICATION_EVIDENCE',true,'{"evidenceMinCount":1}'::jsonb),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT','PUBLIC','RESUBMIT_COMPANY_APPLICATION',true,'{"state":"APPLIED","auditVersionIncremented":true}'::jsonb),
 ('COMPANY_REAPPLICATION_APPROVER_REVIEW','APPROVER','ADMIN','LOAD_COMPANY_REAPPLICATION_REVIEW',true,'{"approvalRowsLoaded":true}'::jsonb),
 ('COMPANY_REAPPLICATION_APPROVER_REVIEW','APPROVER','ADMIN','DECIDE_COMPANY_REAPPLICATION',true,'{"state":"P_OR_R","apiResultReturned":true,"selectedIdsReturned":true}'::jsonb)
) mapping(step_code,actor_code,audience,capability_code,required,effect)
JOIN framework_screen_capability capability ON capability.capability_code=mapping.capability_code
JOIN framework_screen_resource resource ON resource.screen_resource_id=capability.screen_resource_id
WHERE resource.route_key=CASE mapping.audience WHEN 'PUBLIC' THEN '/join/companyreapply' ELSE '/admin/member/company-approve' END
ON CONFLICT(process_code,step_code,capability_id) DO UPDATE SET
  actor_code=excluded.actor_code,required=excluded.required,
  permission_contract=excluded.permission_contract,
  completion_effect=excluded.completion_effect;

INSERT INTO framework_state_transition_contract(
  process_code,step_code,actor_code,command_code,from_state,to_state,
  precondition_contract,completion_contract,failure_contract,audit_contract,
  idempotency_required
) VALUES
('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT',
 'RESUBMIT_COMPANY_APPLICATION','REJECTED','APPLIED',
 '{"identityMatch":true,"requiredFieldsValid":true,"evidenceMinCount":1,"conditionalRowState":"R"}',
 '{"institutionRowsUpdated":1,"fileRowsInserted":"gte:1","auditRowsInserted":1,"dbRereadState":"A"}',
 '{"rollbackDatabase":true,"deleteNewFiles":true,"conflictOnStaleState":true,"duplicateSubmitBlocked":true}',
 '{"beforeAfterHash":true,"applicationVersion":true,"actor":"PUBLIC_APPLICANT","correlationId":true}',true),
('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_APPROVER_REVIEW','APPROVER',
 'APPROVE_COMPANY_APPLICATION','A','P',
 '{"masterAdministratorAuthorized":true,"selectionNotEmpty":true,"actionValues":["approve","batch_approve"]}',
 '{"success":true,"resultValues":["approved","batchApproved"],"selectedIdsReturned":true,"dbRereadState":"P"}',
 '{"emptySelection":"HTTP_400","invalidAction":"HTTP_400","unauthorized":"HTTP_403","serverError":"HTTP_500"}',
 '{"adminApprovalAuditSupport":true,"targetStatus":"P","selectedIds":true}',false),
('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_APPROVER_REVIEW','APPROVER',
 'REJECT_COMPANY_APPLICATION','A','R',
 '{"masterAdministratorAuthorized":true,"selectionNotEmpty":true,"actionValues":["reject","batch_reject"],"rejectReasonMaxLength":1000}',
 '{"success":true,"resultValues":["rejected","batchRejected"],"selectedIdsReturned":true,"dbRereadState":"R","nextStep":"COMPANY_REAPPLICATION_PUBLIC_RESUBMIT"}',
 '{"emptySelection":"HTTP_400","invalidAction":"HTTP_400","unauthorized":"HTTP_403","serverError":"HTTP_500"}',
 '{"adminApprovalAuditSupport":true,"targetStatus":"R","selectedIds":true,"rejectReason":true}',false)
ON CONFLICT(process_code,step_code,command_code,from_state,to_state) DO UPDATE SET
  actor_code=excluded.actor_code,precondition_contract=excluded.precondition_contract,
  completion_contract=excluded.completion_contract,
  failure_contract=excluded.failure_contract,audit_contract=excluded.audit_contract,
  idempotency_required=excluded.idempotency_required;

INSERT INTO framework_process_data_handoff(
  process_code,from_step_code,to_process_code,to_step_code,handoff_type,
  context_keys,payload_contract,integrity_contract,authorization_contract,
  failure_contract,design_status
) VALUES
('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT',
 'COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_APPROVER_REVIEW','STEP',
 '["projectId","insttId"]',
 '{"required":["insttId","companyName","businessNumber","representativeName","statusLabel","evidenceFiles"]}',
 '{"sourceState":"A","institutionStateReread":true}',
 '{"targetActor":"APPROVER","masterAdministratorRequired":true}',
 '{"missingApprovalRow":"BLOCK","forbidden":"HTTP_403","loadFailure":"RETRY"}',
 'DESIGN_COMPLETE'),
('COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_APPROVER_REVIEW',
 'COMPANY_REAPPLICATION_PUBLIC','COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','STEP',
 '["projectId","insttId"]',
 '{"required":["insttId","success","result","selectedIds"],"optional":["rejectReason","message"]}',
 '{"sourceState":"R","databaseReread":true}',
 '{"targetActor":"PUBLIC_APPLICANT","publicLookupIdentityRequired":true}',
 '{"databaseRereadFailure":"BLOCK","publicLookupFailure":"RETRY"}',
 'DESIGN_COMPLETE')
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type)
DO UPDATE SET context_keys=excluded.context_keys,payload_contract=excluded.payload_contract,
  integrity_contract=excluded.integrity_contract,
  authorization_contract=excluded.authorization_contract,
  failure_contract=excluded.failure_contract,design_status='DESIGN_COMPLETE',
  updated_at=current_timestamp;

INSERT INTO framework_simulation_case(
  case_code,process_code,case_name,case_type,preconditions,steps_json,
  assertions_json,case_status,severity,required_evidence,automated,
  expected_duration_minutes
) VALUES
('COMPANY_REAPPLICATION_PUBLIC_HAPPY','COMPANY_REAPPLICATION_PUBLIC','반려 기업 재신청·승인 정상 릴레이','HAPPY_PATH',
 '전용 테스트 기업 신청 상태 R, 신규 증빙 파일, 신청자와 승인자 계정이 존재한다.',
 '["GET rejected application","edit allowed fields","attach evidence","POST resubmit","DB reread A","login master approver","GET company approval page","POST action approve","DB reread P"]',
 '["public HTTP 200","state R->A","audit version +1","evidence count >=1","change hash 64","admin success true","result approved","selectedIds contains insttId","state A->P"]',
 'DRAFT','CRITICAL','HTTP transcript, DB before-after, file hash, audit row, approval action response',true,8),
('COMPANY_REAPPLICATION_PUBLIC_VALIDATION','COMPANY_REAPPLICATION_PUBLIC','필수값·증빙 정책 위반 차단','VALIDATION',
 '반려 신청 조회 성공 후 필수값 또는 증빙이 누락된다.',
 '["clear required field","submit","attach forbidden type","submit oversized file","admin POST without insttId and selectedIds","admin POST invalid action"]',
 '["public HTTP 400","field error code","DB changes 0","new files 0","audit rows 0","admin empty selection HTTP 400","admin invalid action HTTP 400"]',
 'DRAFT','MAJOR','validation response and zero-change DB reread',true,3),
('COMPANY_REAPPLICATION_PUBLIC_AUTHORITY','COMPANY_REAPPLICATION_PUBLIC','공개 조회 최소노출·관리 명령 차단','AUTHORITY',
 '비로그인 사용자와 비승인 일반 계정이 존재한다.',
 '["lookup rejected application","inspect response","call admin decision without approver"]',
 '["sensitive fields masked","admin commands hidden","HTTP 401 or 403","DB changes 0"]',
 'DRAFT','CRITICAL','masked response, forbidden response, DB reread',true,3),
('COMPANY_REAPPLICATION_PUBLIC_ISOLATION','COMPANY_REAPPLICATION_PUBLIC','다른 프로젝트·기업 신청 변조 차단','ISOLATION',
 '두 프로젝트의 서로 다른 기업 신청이 존재한다.',
 '["lookup company A","forge company B insttId","submit"]',
 '["HTTP 404 or 409","project scope retained","company B unchanged","audit rows 0"]',
 'DRAFT','CRITICAL','request mutation, scoped DB before-after',true,3),
('COMPANY_REAPPLICATION_PUBLIC_CONFLICT','COMPANY_REAPPLICATION_PUBLIC','동시 재신청·중복 제출 충돌','EXCEPTION',
 '같은 R 상태 신청과 두 개의 동시 요청이 준비된다.',
 '["send concurrent multipart requests","reread institution","count audit and file rows"]',
 '["one success","one HTTP 409","single R->A transition","single audit version","no duplicate files"]',
 'DRAFT','CRITICAL','concurrent HTTP results, row counts, file listing',true,4),
('COMPANY_REAPPLICATION_PUBLIC_RECOVERY','COMPANY_REAPPLICATION_PUBLIC','DB 실패 시 파일·상태 원자 복구','RECOVERY',
 '파일 저장 뒤 DB 트랜잭션 실패를 재현할 수 있다.',
 '["submit with induced DB failure","inspect file store","reread institution and audit","retry valid request"]',
 '["first request fails","state remains R","orphan files 0","audit rows 0","retry succeeds once"]',
 'DRAFT','CRITICAL','failure injection, file listing, DB reread, retry transcript',true,5),
('TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW','COMPANY_REAPPLICATION_PUBLIC','증빙 crash-window 자동 대사 안전성','RECOVERY',
 '60분 이상 경과한 신규 UUID 계약 파일, 참조 파일, 레거시 파일, 심볼릭 링크 및 DB 장애 조건이 준비된다.',
 '["acquire local and shared lock","scan at most configured limit","query all candidate object keys before delete","preserve referenced, legacy and symlink files","delete only rechecked unreferenced UUID candidates","record metrics"]',
 '["actor SYSTEM_RECOVERY","support step COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION","DB failure deletes 0","minimum age 60 minutes","scan bounded","multi-pod lock held","legacy preserved","symlink preserved"]',
 'DRAFT','CRITICAL','InstitutionEvidenceReconcilerTest four passing unit cases; runtime scheduler evidence pending',true,1)
ON CONFLICT(case_code) DO UPDATE SET
  case_name=excluded.case_name,case_type=excluded.case_type,
  preconditions=excluded.preconditions,steps_json=excluded.steps_json,
  assertions_json=excluded.assertions_json,case_status='DRAFT',
  severity=excluded.severity,required_evidence=excluded.required_evidence,
  automated=true,expected_duration_minutes=excluded.expected_duration_minutes,
  updated_at=current_timestamp;

INSERT INTO framework_step_test_binding(
  process_code,step_code,case_code,trace_scope,expected_state,
  assertion_contract,evidence_required
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',mapping.step_code,mapping.case_code,
  mapping.scope,mapping.expected_state,
  jsonb_build_object('runtimeHarness','ops/scripts/validate-company-reapplication-runtime.sh',
                     'promotionEligibleOnlyOnPass',true,'databaseReread',true,
                     'inputOutputRecorded',true),true
FROM (VALUES
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_HAPPY','PROCESS','APPLIED'),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_VALIDATION','STEP','REJECTED'),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_AUTHORITY','STEP','REJECTED'),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_ISOLATION','STEP','REJECTED'),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_CONFLICT','STEP','APPLIED'),
 ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_PUBLIC_RECOVERY','STEP','APPLIED'),
 ('COMPANY_REAPPLICATION_APPROVER_REVIEW','COMPANY_REAPPLICATION_PUBLIC_HAPPY','PROCESS','P'),
 ('COMPANY_REAPPLICATION_APPROVER_REVIEW','COMPANY_REAPPLICATION_PUBLIC_AUTHORITY','STEP','A')
) mapping(step_code,case_code,scope,expected_state)
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET
  trace_scope=excluded.trace_scope,expected_state=excluded.expected_state,
  assertion_contract=excluded.assertion_contract,evidence_required=true;

-- Generator-ready specifications are complete but remain blocked from approval
-- until the dedicated public+admin BUSINESS_E2E harness passes.
WITH spec(step_code,actor_code,scope,step_name,requirement,completion,command_code,from_state,to_state,
          input_schema,output_schema,route_path,audience,apis,persistence,tests,next_step) AS (VALUES
('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','PUBLIC_APPLICANT','PROJECT','반려 사유 확인·정보 보완·재신청',
 '본인 반려 신청만 조회하여 필수 정보와 신규 증빙을 원자적으로 재접수한다.',
 'R→A, 파일 원장, 감사 버전과 변경 해시가 저장·재조회된다.',
 'RESUBMIT_COMPANY_APPLICATION','REJECTED','APPLIED',
  '{"required":["bizNo","repName","registeredContact","insttId","agencyName","representativeName","zipCode","companyAddress","chargerName","chargerEmail","chargerTel","fileUploads"],"fileUploads":{"minItems":1,"maxItems":10,"maxFileSizeMb":10}}'::jsonb,
  '{"required":["success","insttId","insttNm","bizrno","status","regDate","receipt"],"receipt":{"required":["applicationVersion","evidenceFileCount","changeHash","fileIds","fileSha256s"]}}'::jsonb,
 '/join/companyReapply','PUBLIC',
 '[{"declaredContract":"GET /join/api/company-reapply/page","transactional":false,"tenantGuard":false,"projectGuard":true,"actorGuard":true,"idempotencyKey":false,"rowVersion":false,"errorContract":["VALIDATION_ERROR","NOT_FOUND","STATE_NOT_REJECTED","RATE_LIMITED"]},{"declaredContract":"POST /join/api/company-reapply multipart","transactional":true,"tenantGuard":false,"projectGuard":true,"actorGuard":true,"idempotencyKey":true,"rowVersion":true,"errorContract":["VALIDATION_ERROR","CONFLICT","DEPENDENCY_BLOCKED","SERVER_ERROR"]}]'::jsonb,
  '{"schemaVersion":1,"contractType":"STEP_PERSISTENCE","schemaSetVersion":"COMPANY_REAPPLICATION_PUBLIC_1_0_0","policy":{"transactional":true,"migrationRequired":true,"optimisticLock":true,"tenantIsolated":false,"projectIsolated":true},"mappings":[{"table":"comtninsttinfo","key":["project_id","instt_id"]},{"table":"comtninsttfile","key":["project_id","file_id"],"join":["project_id","instt_id"],"scopeColumn":"scope_status","requiredScope":"SCOPED","hashColumn":"file_sha256"},{"table":"framework_company_reapplication_audit","key":["project_id","instt_id","application_version"],"versioned":true,"appendOnly":true,"evidenceIdentity":["evidence_file_ids","evidence_object_keys","evidence_sha256"]}],"extensions":{"legacyFileScopeQuarantine":"framework_instt_file_scope_quarantine","projectIdNotNullClosure":"PLANNED_AFTER_QUARANTINE_EMPTY"}}'::jsonb,
 '[{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_HAPPY"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_VALIDATION"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_AUTHORITY"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_ISOLATION"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_CONFLICT"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_RECOVERY"}]'::jsonb,
 'COMPANY_REAPPLICATION_APPROVER_REVIEW'),
('COMPANY_REAPPLICATION_APPROVER_REVIEW','APPROVER','PROJECT','재신청 회원사 승인 또는 재반려',
 '마스터 관리자가 회원사 목록·상세·증빙을 확인하고 실제 action 계약으로 단건 또는 일괄 승인·반려한다.',
 'API가 success, result, selectedIds를 반환하고 대상 회원사 상태가 P 또는 R로 재조회된다.',
 'DECIDE_COMPANY_REAPPLICATION','A','P',
 '{"required":["action"],"targetOneOf":["insttId","selectedIds"],"actionValues":["approve","batch_approve","reject","batch_reject"],"optional":["rejectReason"]}'::jsonb,
 '{"required":["success","result","selectedIds"],"optional":["message"],"resultValues":["approved","batchApproved","rejected","batchRejected"],"internalTargetStatus":["P","R"]}'::jsonb,
 '/admin/member/company-approve','ADMIN',
 '[{"declaredContract":"GET /admin/api/admin/member/company-approve/page","method":"GET","query":["pageIndex","searchKeyword","sbscrbSttus","result"],"transactional":false,"tenantGuard":false,"projectGuard":true,"projectContext":"ProjectRuntimeContext","actorGuard":true,"idempotencyKey":false,"rowVersion":false,"errorContract":["FORBIDDEN","SERVER_ERROR"]},{"declaredContract":"POST /admin/api/admin/member/company-approve/action","method":"POST","body":["action","insttId","selectedIds","rejectReason"],"response":["success","result","selectedIds","message"],"transactional":false,"tenantGuard":false,"projectGuard":true,"projectContext":"ProjectRuntimeContext","actorGuard":true,"idempotencyKey":false,"rowVersion":false,"errorContract":["EMPTY_SELECTION","INVALID_ACTION","FORBIDDEN","SERVER_ERROR"]}]'::jsonb,
  '{"schemaVersion":1,"contractType":"STEP_PERSISTENCE","schemaSetVersion":"COMPANY_APPROVAL_ACTION_1_0_0","policy":{"transactional":false,"migrationRequired":false,"optimisticLock":false,"tenantIsolated":false,"projectIsolated":true},"mappings":[{"table":"comtninsttinfo","key":["project_id","instt_id"],"statusColumn":"instt_sttus","adminLookupScope":"CURRENT_PROJECT_MASTER_ADMIN"},{"table":"comtninsttfile","key":["project_id","file_id"],"join":["project_id","instt_id"],"scopeColumn":"scope_status","requiredScope":"SCOPED","hashColumn":"file_sha256"},{"adapter":"adminApprovalAuditSupport"}],"extensions":{"authorityScope":"GLOBAL_MASTER_ADMIN","dataScope":"CURRENT_PROJECT","projectContext":"ProjectRuntimeContext","partialBatchFailurePossible":true}}'::jsonb,
 '[{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_HAPPY","adminAction":"approve"},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_AUTHORITY","expectedHttpStatus":403},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_VALIDATION","adminAssertions":["EMPTY_SELECTION","INVALID_ACTION"]},{"caseCode":"COMPANY_REAPPLICATION_PUBLIC_CONFLICT","batchRereadRequired":true}]'::jsonb,
 NULL)
)
INSERT INTO framework_step_execution_spec(
  process_code,step_code,spec_version,actor_contract,business_contract,
  transition_contract,input_contract,output_contract,screen_contract,field_contract,
  command_contract,api_contract,persistence_contract,handoff_contract,test_contract,
  guide_contract,nonfunctional_contract,design_status,approval_status,
  generation_status,blocker_codes,source_hash,approved_by,approved_at
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',s.step_code,1,
  jsonb_build_object('schemaVersion',1,'contractType','STEP_ACTOR_AUTHORITY',
    'actorCode',s.actor_code,'ownerActorCode','PUBLIC_APPLICANT','scope',s.scope,
    'policy',jsonb_build_object('assignmentRequired',false,'serverAuthorization',true,
      'tenantIsolation',false,'projectIsolation',true,
      'delegationChecked',true,'segregationOfDuties',false),
    'permissions',CASE s.audience WHEN 'PUBLIC' THEN '["PUBLIC_COMPANY_REAPPLICATION_SUBMIT"]'::jsonb ELSE '["COMPANY_REAPPLICATION_DECIDE"]'::jsonb END,
    'delegation','{}'::jsonb,
    'extensions',jsonb_build_object('masterAdministratorRequired',s.audience='ADMIN',
      'authorityScope',CASE s.audience WHEN 'ADMIN' THEN 'GLOBAL_MASTER_ADMIN' ELSE 'PUBLIC_APPLICANT' END,
      'dataScope','CURRENT_PROJECT','projectContext','ProjectRuntimeContext')),
  jsonb_build_object('schemaVersion',1,'contractType','STEP_BUSINESS',
    'domainCode','IDENTITY','processName','반려 기업 신청 보완·재신청',
    'stepName',s.step_name,'goal','정확하고 추적 가능한 기업 재신청·재심사 릴레이',
    'requirement',s.requirement,'completionRule',s.completion,'riskLevel','HIGH','slaHours',24,
    'regulationRefs','[]'::jsonb,
    'preconditions',jsonb_build_array(s.from_state),'deliverables',s.output_schema,
    'exceptions','["VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY"]'::jsonb,
    'policy',jsonb_build_object('deliveryAdapterRequired',true,'browserOnlyVerificationForbidden',true),
    'extensions','{}'::jsonb),
  jsonb_build_object('schemaVersion',1,'contractType','STEP_TRANSITION',
    'commandCode',s.command_code,'fromState',s.from_state,'toState',s.to_state,
    'stepOrder',step.step_order,'stepType',step.step_type,'completionRule',s.completion,
    'policy',jsonb_build_object('optimisticLock',s.audience='PUBLIC',
      'idempotencyRequired',s.audience='PUBLIC','auditRequired',true,
      'invalidStatesRejected',s.audience='PUBLIC'),
    'guards',CASE s.audience WHEN 'PUBLIC' THEN jsonb_build_array('server-state','field-validation','authority') ELSE jsonb_build_array('master-authority','non-empty-selection','valid-action') END,
    'sideEffects',CASE s.audience WHEN 'PUBLIC' THEN jsonb_build_array('audit','evidence-file-persistence') ELSE jsonb_build_array('institution-status-update','admin-approval-audit') END,
    'extensions',CASE s.audience WHEN 'PUBLIC' THEN '{}'::jsonb ELSE '{"targetStateMap":{"approve":"P","batch_approve":"P","reject":"R","batch_reject":"R"}}'::jsonb END),
  s.input_schema,s.output_schema,
  jsonb_build_array(jsonb_build_object('audience',s.audience,'routePath',s.route_path,
    'screenCode',resource.screen_code,'screenType',resource.screen_type,
    'sourceRef',resource.source_ref,'commonCards',jsonb_build_object('workGuide',true,'screenDesign',true,'help',true,'qa',true))),
  coalesce((SELECT jsonb_agg(jsonb_build_object('fieldCode',field.field_code,'fieldName',field.field_name,
    'required',field.required,'editable',field.editable,'apiProperty',field.api_property,
    'sourceTable',field.source_table,'sourceColumn',field.source_column,'validation',field.validation_contract)
    ORDER BY field.field_order)
    FROM framework_page_field_definition field
    JOIN framework_page_design page ON page.page_design_id=field.page_design_id
    WHERE page.process_code='COMPANY_REAPPLICATION_PUBLIC' AND page.step_code=s.step_code AND page.audience=s.audience),'[]'::jsonb),
  jsonb_build_array(jsonb_build_object('commandCode',s.command_code,'actorCode',s.actor_code,
    'entryState',s.from_state,'resultState',s.to_state,'serverAuthorization',true,
    'validationRequired',true,'auditRequired',true,'idempotencyRequired',s.audience='PUBLIC')),
  s.apis,s.persistence,
  CASE WHEN s.next_step IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
    'type','STEP','toProcessCode','COMPANY_REAPPLICATION_PUBLIC','toStepCode',s.next_step,
    'contextKeys',jsonb_build_array('projectId','insttId'),
    'integrity',jsonb_build_object('sourceState','A','databaseReread',true))) END,
  s.tests,
  jsonb_build_object('schemaVersion',1,'contractType','STEP_GUIDE',
    'workTypeCode','MEMBER','processCode','COMPANY_REAPPLICATION_PUBLIC',
    'stepCode',s.step_code,'stepOrder',step.step_order,'actorCode',s.actor_code,
    'title',s.step_name,'purpose',s.requirement,'entryCondition',s.from_state,
    'completionCondition',s.completion,
    'userPath',CASE WHEN s.audience='PUBLIC' THEN s.route_path ELSE NULL END,
    'adminPath',CASE WHEN s.audience='ADMIN' THEN s.route_path ELSE NULL END,
    'nextStepCode',s.next_step,'actions',jsonb_build_array('LOAD','PREFILL','VALIDATE','EXECUTE','RECORD_INPUT_OUTPUT'),
    'help',jsonb_build_object('screenLinked',true,'fieldGuideLinked',true,'errorRecoveryLinked',true),
    'policy',jsonb_build_object('followServerState',true,'autoSwitchActorInQa',true),
    'extensions','{}'::jsonb),
  jsonb_build_object('schemaVersion',1,'contractType','STEP_NONFUNCTIONAL',
    'security',jsonb_build_object('tenantIsolation',false,
      'projectIsolation',true,'projectContext','ProjectRuntimeContext','serverAuthorization',true,'segregationOfDuties',false,
      'rateLimitRequired',s.audience='PUBLIC','secretLoggingForbidden',true,'sensitiveValueMasking',true),
    'performance',jsonb_build_object('targetP95Ms',800,'paginationRequired',s.audience='ADMIN','searchIndexRequired',false),
    'accessibility',jsonb_build_object('standard','WCAG 2.1 AA','keyboard',true,'focus',true,'errorSummary',true),
    'responsive',jsonb_build_object('mobile','single-column','tablet','adaptive-two-column','desktop','task-optimized','noTextOverflow',true),
    'recovery',jsonb_build_object('retry',CASE s.audience WHEN 'PUBLIC' THEN 'idempotent-only' ELSE 'manual-reread-before-retry' END,
      'resumeFromLastVerifiedState',true,'idempotencyRequired',s.audience='PUBLIC'),
    'audit',jsonb_build_object('required',true,'actorRecorded',true,
      'beforeAfterRecorded',s.audience='PUBLIC','correlationIdRequired',false),
    'sla',jsonb_build_object('configured',true,'targetHours',24,
      'timerStartsAt','STEP_ASSIGNED','timerStopsAt','STEP_COMPLETED','breachAlertRequired',true),
    'policy','{}'::jsonb,'extensions','{}'::jsonb),
  'DESIGN_COMPLETE','REVIEW_REQUIRED','BLOCKED',
  '["BUSINESS_E2E_PENDING","PUBLIC_AUTHORITY_EVIDENCE_PENDING","ATOMIC_DB_FILE_RECOVERY_EVIDENCE_PENDING"]',
  repeat('0',64),NULL,NULL
FROM spec s
JOIN framework_process_step step
  ON step.process_code='COMPANY_REAPPLICATION_PUBLIC' AND step.step_code=s.step_code
JOIN framework_screen_resource resource ON resource.route_key=lower(s.route_path)
ON CONFLICT(process_code,step_code) DO UPDATE SET
  actor_contract=excluded.actor_contract,business_contract=excluded.business_contract,
  transition_contract=excluded.transition_contract,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,screen_contract=excluded.screen_contract,
  field_contract=excluded.field_contract,command_contract=excluded.command_contract,
  api_contract=excluded.api_contract,persistence_contract=excluded.persistence_contract,
  handoff_contract=excluded.handoff_contract,test_contract=excluded.test_contract,
  guide_contract=excluded.guide_contract,nonfunctional_contract=excluded.nonfunctional_contract,
  design_status='DESIGN_COMPLETE',approval_status='REVIEW_REQUIRED',generation_status='BLOCKED',
  blocker_codes=excluded.blocker_codes,approved_by=NULL,approved_at=NULL,
  updated_at=current_timestamp;

-- Contract normalizers run as BEFORE triggers.  Recompute the final hash after
-- every normalized layer has reached its persisted form.
UPDATE framework_step_execution_spec
SET source_hash=encode(sha256(convert_to(concat_ws('|',
      actor_contract::text,business_contract::text,transition_contract::text,
      input_contract::text,output_contract::text,screen_contract::text,
      field_contract::text,command_contract::text,api_contract::text,
      persistence_contract::text,handoff_contract::text,test_contract::text,
      guide_contract::text,nonfunctional_contract::text
    ),'UTF8')),'hex'),
    updated_at=current_timestamp
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC';

INSERT INTO framework_development_job(
  process_code,step_code,job_type,job_name,target_path,specification_json,
  dependency_job_ids,job_status,approval_status,created_by
)
SELECT 'COMPANY_REAPPLICATION_PUBLIC',step.step_code,job.job_type,
  step.step_name||' '||job.job_name,job.target_path,
  jsonb_build_object('designVersion','1.0.0','route',step.user_path,
    'adminRoute',step.admin_path,'acceptance',job.acceptance,
    'runtimeHarness','ops/scripts/validate-company-reapplication-runtime.sh',
    'e2eRequired',true,
    'fileScopeContract',CASE WHEN job.job_type IN ('DATABASE','BACKEND') THEN
      jsonb_build_object('key',jsonb_build_array('project_id','file_id'),
        'join',jsonb_build_array('project_id','instt_id'),'scopeStatus','SCOPED',
        'sha256RequiredForNewWrites',true,
        'legacyQuarantine','framework_instt_file_scope_quarantine',
        'projectIdNotNullClosure','PLANNED_AFTER_QUARANTINE_EMPTY')
      ELSE NULL END,
    'auditContract',CASE WHEN job.job_type IN ('DATABASE','BACKEND','TEST') THEN
      jsonb_build_object('appendOnly',true,
        'evidenceIdentity',jsonb_build_array('evidence_file_ids','evidence_object_keys','evidence_sha256'))
      ELSE NULL END)::text,'','PLANNED','APPROVED','COMPANY_REAPPLICATION_PUBLIC_1_0_0'
FROM framework_process_step step
CROSS JOIN LATERAL (VALUES
 ('DATABASE','DB·감사 원장 구현','apps/carbonet-api/src/main/resources/db/migration/postgresql',
  'R→A 조건부 갱신, 감사 버전 유일성, 트랜잭션 롤백과 DB 재조회'),
 ('BACKEND','API·트랜잭션 구현','modules/resonance-common/carbonet-common-core',
  '필수값·파일 서버 검증, 원자 저장, 동시 충돌 409, 실패 파일 정리'),
 ('FRONTEND','공통 KRDS 화면 계약','projects/carbonet-frontend/source/src/features',
  '공통 컴포넌트 재사용, 필드 가이드, 오류 요약, 반응형과 접근성'),
 ('TEST','BUSINESS E2E·회귀 검증','ops/scripts/validate-company-reapplication-runtime.sh',
  '공개 조회·재신청·DB 재조회·관리자 결정·복구·정리 증적')
) job(job_type,job_name,target_path,acceptance)
WHERE step.process_code='COMPANY_REAPPLICATION_PUBLIC'
ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET
  job_name=excluded.job_name,specification_json=excluded.specification_json,
  dependency_job_ids='',job_status=CASE
    WHEN framework_development_job.job_status='VERIFIED' THEN 'VERIFIED' ELSE 'PLANNED' END,
  approval_status='APPROVED',created_by=excluded.created_by,
  updated_at=current_timestamp;

DO $$
DECLARE
  step_count integer;
  active_target_count integer;
  draft_target_count integer;
  professional_count integer;
  page_count integer;
  simulation_count integer;
  spec_count integer;
  planned_job_count integer;
  support_count integer;
  forged_count integer;
BEGIN
  SELECT count(*) INTO step_count FROM framework_process_step
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC';

  SELECT count(*) INTO active_target_count
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  WHERE resource.route_key='/join/companyreapply' AND binding.binding_status='ACTIVE';

  SELECT count(*) INTO draft_target_count
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  WHERE resource.route_key='/join/companyreapply' AND binding.binding_status='DRAFT';

  SELECT count(*) INTO professional_count
  FROM framework_professional_screen_contract
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND contract_status='REVIEW_REQUIRED'
    AND NOT api_verified AND NOT database_verified AND NOT authority_verified
    AND NOT responsive_verified AND NOT accessibility_verified
    AND NOT exception_states_verified;

  SELECT count(*) INTO page_count FROM framework_page_design
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC' AND design_status='DESIGN_COMPLETE';
  SELECT count(*) INTO simulation_count FROM framework_simulation_case
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC' AND case_status='DRAFT';
  SELECT count(*) INTO spec_count FROM framework_step_execution_spec
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND design_status='DESIGN_COMPLETE' AND approval_status='REVIEW_REQUIRED'
    AND generation_status='BLOCKED';
  SELECT count(*) INTO planned_job_count FROM framework_development_job
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND job_status='PLANNED'
    AND created_by='COMPANY_REAPPLICATION_PUBLIC_1_0_0';
  SELECT count(*) INTO support_count
  FROM framework_system_support_contract
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND support_step_code='COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION'
    AND actor_code='SYSTEM_RECOVERY'
    AND test_code='TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW'
    AND task_code='TASK_COMPANY_REAPPLICATION_EVIDENCE_RECONCILE'
    AND support_type='AUTOMATED' AND execution_mode='SCHEDULED'
    AND contract_status='IMPLEMENTED' AND evidence_status='UNIT_TESTED';
  SELECT count(*) INTO forged_count
  FROM framework_professional_screen_contract
  WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
    AND (contract_status='VERIFIED' OR audit_evidence_ref NOT LIKE 'PENDING:%');

  IF step_count<>2 OR active_target_count<>0 OR draft_target_count<>1 OR professional_count<>2
     OR page_count<>2 OR simulation_count<>7 OR spec_count<>2
     OR planned_job_count<>8 OR support_count<>1 OR forged_count<>0 THEN
    RAISE EXCEPTION
      'COMPANY_REAPPLICATION_PUBLIC_CONTRACT_INVALID steps=% activeTargetBindings=% draftTargetBindings=% contracts=% pages=% cases=% specs=% plannedJobs=% support=% forged=%',
      step_count,active_target_count,draft_target_count,professional_count,page_count,simulation_count,
      spec_count,planned_job_count,support_count,forged_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM framework_process_step_screen_binding binding
    JOIN framework_screen_resource resource USING(screen_resource_id)
    WHERE binding.process_code='COMPANY_REAPPLICATION_PUBLIC'
      AND binding.step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
      AND binding.audience='PUBLIC' AND binding.actor_code='PUBLIC_APPLICANT'
      AND binding.binding_status='DRAFT'
      AND binding.contract_status='DESIGNED'
      AND resource.route_key='/join/companyreapply'
  ) THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_PUBLIC_EXACT_BINDING_MISSING';
  END IF;

  IF to_regclass('public.framework_company_reapplication_audit') IS NULL THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_AUDIT_TABLE_MISSING';
  END IF;
END $$;

DO $$
DECLARE
  scoped_without_project integer;
  scoped_relation_mismatch integer;
  unquarantined_legacy integer;
  nullable_project_column integer;
BEGIN
  SELECT count(*) INTO scoped_without_project
  FROM comtninsttfile
  WHERE scope_status='SCOPED' AND project_id IS NULL;

  SELECT count(*) INTO scoped_relation_mismatch
  FROM comtninsttfile file
  WHERE file.scope_status='SCOPED'
    AND NOT EXISTS (
      SELECT 1 FROM comtninsttinfo info
      WHERE info.project_id=file.project_id
        AND trim(info.instt_id)=trim(file.instt_id)
    );

  SELECT count(*) INTO unquarantined_legacy
  FROM comtninsttfile file
  LEFT JOIN framework_instt_file_scope_quarantine quarantine
    ON quarantine.file_id=file.file_id AND quarantine.reason_code=file.scope_status
  WHERE file.scope_status IN ('ORPHAN','AMBIGUOUS','MISSCOPED')
    AND quarantine.file_id IS NULL;

  SELECT count(*) INTO nullable_project_column
  FROM information_schema.columns
  WHERE table_schema=current_schema()
    AND table_name='comtninsttfile'
    AND column_name='project_id'
    AND is_nullable='YES';

  IF scoped_without_project<>0 OR scoped_relation_mismatch<>0
     OR unquarantined_legacy<>0 OR nullable_project_column<>1 THEN
    RAISE EXCEPTION
      'COMPANY_REAPPLICATION_FILE_SCOPE_INVALID scopedWithoutProject=% scopedRelationMismatch=% unquarantined=% nullableProjectColumn=%',
      scoped_without_project,scoped_relation_mismatch,unquarantined_legacy,nullable_project_column;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='comtninsttfile'::regclass
      AND conname='fk_comtninsttfile_project_instt' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='comtninsttfile'::regclass
      AND tgname='trg_enforce_instt_file_write_scope' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_FILE_SCOPE_GUARD_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='framework_company_reapplication_audit'::regclass
      AND tgname='trg_company_reapplication_audit_immutable' AND NOT tgisinternal
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='framework_company_reapplication_audit'::regclass
      AND conname IN (
        'ck_company_reapplication_audit_file_ids',
        'ck_company_reapplication_audit_object_keys',
        'ck_company_reapplication_audit_sha256',
        'ck_company_reapplication_audit_change_hash'
      ) AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_AUDIT_GUARD_MISSING';
  END IF;
END $$;

COMMENT ON TABLE framework_company_reapplication_audit IS
  'Immutable versioned evidence for rejected company application resubmission. A row proves R-to-A command input, file count and change hash; BUSINESS_E2E remains external evidence.';


-- Public status/reapplication enumeration protection shared by every runtime pod.
-- REMOTE_ADDR is never persisted; only a one-way SHA-256 digest is stored.
CREATE TABLE IF NOT EXISTS framework_public_lookup_rate_limit (
  project_id varchar(100) NOT NULL,
  remote_addr_hash char(64) NOT NULL CHECK (remote_addr_hash ~ '^[0-9a-f]{64}$'),
  endpoint_code varchar(64) NOT NULL,
  window_bucket bigint NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(project_id,remote_addr_hash,endpoint_code,window_bucket)
);
CREATE INDEX IF NOT EXISTS idx_public_lookup_rate_limit_expiry
  ON framework_public_lookup_rate_limit(expires_at,updated_at);
COMMENT ON TABLE framework_public_lookup_rate_limit IS
  'Bounded TTL ledger for cross-pod public lookup rate limiting; remote address is SHA-256 only.';
COMMENT ON COLUMN framework_public_lookup_rate_limit.remote_addr_hash IS
  'SHA-256 of HttpServletRequest.getRemoteAddr(); X-Forwarded-For is intentionally not trusted.';

-- Separate the applicant's corrective response from the administrator's rejection reason.
ALTER TABLE framework_company_reapplication_audit
  ADD COLUMN IF NOT EXISTS applicant_response TEXT;

COMMENT ON COLUMN framework_company_reapplication_audit.applicant_response IS
  'Applicant-authored corrective action for this reapplication version; never overwrites rejection_reason.';

CREATE OR REPLACE FUNCTION framework_validate_company_reapplication_response()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.command_code = 'RESUBMIT_COMPANY_APPLICATION'
     AND (NEW.applicant_response IS NULL
          OR length(btrim(NEW.applicant_response)) < 10
          OR length(NEW.applicant_response) > 2000) THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_APPLICANT_RESPONSE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_framework_company_reapplication_response
  ON framework_company_reapplication_audit;
CREATE TRIGGER trg_framework_company_reapplication_response
BEFORE INSERT ON framework_company_reapplication_audit
FOR EACH ROW EXECUTE FUNCTION framework_validate_company_reapplication_response();

UPDATE framework_process_step_screen_binding
SET input_contract = jsonb_set(
      jsonb_set(input_contract, '{required}',
        COALESCE(input_contract->'required', '[]'::jsonb) || '["applicantResponse"]'::jsonb),
      '{applicantResponse}',
      '{"minLength":10,"maxLength":2000,"purpose":"REJECTION_RESPONSE"}'::jsonb,
      true),
    completion_contract = jsonb_set(completion_contract, '{applicantResponseRecorded}', 'true'::jsonb, true),
    database_lineage = database_lineage ||
      '[{"table":"framework_company_reapplication_audit","column":"applicant_response","versioned":true,"appendOnly":true}]'::jsonb,
    guide_contract = jsonb_set(guide_contract, '{sequence}',
      '["사업자등록번호·대표자명·등록 연락처 조회","관리자 반려 사유 확인","보완·재신청 답변 작성","변경 정보 입력","증빙 1~10개 첨부","입력 검증","재신청 제출","접수증 확인"]'::jsonb),
    binding_status = 'DRAFT', contract_status = 'DESIGNED', design_version = '1.1.0',
    updated_at = current_timestamp
WHERE process_code = 'COMPANY_REAPPLICATION_PUBLIC'
  AND step_code = 'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
  AND audience = 'PUBLIC';

UPDATE framework_professional_screen_contract
SET section_contract = '["업무 문맥·관리자 반려 사유","식별 조회","보완·재신청 답변","기업·담당자 정보","증빙","검증 요약","주요 명령","결과·다음 업무","감사 이력"]'::jsonb,
    field_contract = field_contract ||
      '[{"fieldCode":"applicantResponse","label":"보완·재신청 내용","controlType":"TEXTAREA","required":true,"minLength":10,"maxLength":2000,"sourceTable":"framework_company_reapplication_audit","sourceColumn":"applicant_response"}]'::jsonb,
    api_verified = false, database_verified = false, authority_verified = false,
    responsive_verified = false, accessibility_verified = false, exception_states_verified = false,
    audit_evidence_ref = 'PENDING:validate-company-reapplication-runtime.sh',
    contract_status = 'REVIEW_REQUIRED', design_version = '1.1.0',
    contract_revision = contract_revision + 1, updated_by = 'COMPANY_REAPPLICATION_PUBLIC_1_1_0',
    updated_at = current_timestamp
WHERE process_code = 'COMPANY_REAPPLICATION_PUBLIC'
  AND step_code = 'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
  AND audience = 'PUBLIC'
  AND lower(route_path) = '/join/companyreapply';

INSERT INTO framework_page_field_definition(
  page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
  required,editable,list_visible,search_enabled,source_table,source_column,api_property,
  mapping_status,validation_contract,privacy_class,permission_code,evidence_required,
  responsive_priority,help_text,design_source)
SELECT page_design_id,45,'반려','applicantResponse','보완·재신청 내용','STRING','TEXTAREA',
  true,true,false,false,'framework_company_reapplication_audit','applicant_response','applicantResponse',
  'DB_RESOLVED','{"minLength":10,"maxLength":2000}'::jsonb,'INTERNAL','PUBLIC_RESUBMIT',true,
  10,'반려 사유별 조치 내용과 이를 입증하는 첨부 근거를 작성합니다.','COMPANY_REAPPLICATION_PUBLIC_1_1_0'
FROM framework_page_design
WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
  AND step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT' AND audience='PUBLIC'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET
  field_order=excluded.field_order,field_group=excluded.field_group,field_name=excluded.field_name,
  required=true,editable=true,source_table=excluded.source_table,source_column=excluded.source_column,
  api_property=excluded.api_property,mapping_status='DB_RESOLVED',
  validation_contract=excluded.validation_contract,help_text=excluded.help_text,
  design_source=excluded.design_source,updated_at=current_timestamp;

DO $$
DECLARE v_column integer; v_binding integer; v_field integer;
BEGIN
  SELECT count(*) INTO v_column FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='framework_company_reapplication_audit'
     AND column_name='applicant_response';
  SELECT count(*) INTO v_binding FROM framework_process_step_screen_binding
   WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
     AND step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT' AND audience='PUBLIC'
     AND input_contract->'required' ? 'applicantResponse';
  SELECT count(*) INTO v_field FROM framework_page_field_definition f
   JOIN framework_page_design p ON p.page_design_id=f.page_design_id
   WHERE p.process_code='COMPANY_REAPPLICATION_PUBLIC'
     AND p.step_code='COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'
     AND p.audience='PUBLIC' AND f.field_code='applicantResponse';
  IF v_column<>1 OR v_binding<>1 OR v_field<>1 THEN
    RAISE EXCEPTION 'COMPANY_REAPPLICATION_RESPONSE_CONTRACT_INVALID column=% binding=% field=%',v_column,v_binding,v_field;
  END IF;
END;
$$;

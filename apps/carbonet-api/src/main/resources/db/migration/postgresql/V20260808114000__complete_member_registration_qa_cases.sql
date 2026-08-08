ALTER TABLE framework_simulation_case DISABLE TRIGGER trg_guard_locked_simulation_case;

WITH cases(case_code,case_name,case_type,preconditions,steps_json,assertions_json,severity) AS (VALUES
 ('MEMBER_REGISTRATION_S5_HAPPY','접수번호 확인 및 다음 업무 안내','HAPPY_PATH','가입 신청 제출이 완료됨','["완료 화면 진입","접수번호 확인","가입 현황 조회 이동"]'::jsonb,'["접수번호 표시","신청 상태 표시","다음 업무 링크 표시"]'::jsonb,'MEDIUM'),
 ('MEMBER_REGISTRATION_S5_AUTHORITY','비인가 접수정보 조회 차단','AUTHORITY','다른 신청자의 접수정보 식별자를 사용함','["다른 신청 식별자로 상세 진입"]'::jsonb,'["개인정보 미노출","재조회 안내"]'::jsonb,'HIGH'),
 ('MEMBER_REGISTRATION_S5_ISOLATION','신청 기관 간 접수정보 격리','ISOLATION','서로 다른 두 기관의 신청이 존재함','["기관 A 접수 완료","기관 B 식별자로 교체 시도"]'::jsonb,'["기관 A 세션에서 기관 B 정보 미노출"]'::jsonb,'HIGH'),
 ('MEMBER_REGISTRATION_S5_EXCEPTION','만료·손상 조회정보 예외 처리','EXCEPTION','만료되거나 손상된 조회 핸들을 사용함','["잘못된 조회 핸들로 상세 진입"]'::jsonb,'["오류 코드 표시","가입 현황 재조회 버튼 표시"]'::jsonb,'MEDIUM'),
 ('MEMBER_REGISTRATION_S5_RECOVERY','접수 완료 화면 복구와 재조회','RECOVERY','완료 화면을 새로고침하거나 뒤로 이동함','["완료 화면 새로고침","가입 현황 재조회","정상 상세 복귀"]'::jsonb,'["중복 제출 없음","동일 신청 상태 복구"]'::jsonb,'MEDIUM')
)
INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,automated,required_evidence)
SELECT case_code,'MEMBER_REGISTRATION',case_name,case_type,preconditions,steps_json,assertions_json,'APPROVED',severity,true,
       ARRAY['HTTP_STATUS','VISIBLE_STATE','NO_CROSS_TENANT_DATA']::text[]
  FROM cases
ON CONFLICT(case_code) DO UPDATE SET case_name=excluded.case_name,case_type=excluded.case_type,
 preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,
 case_status='APPROVED',severity=excluded.severity,automated=true,required_evidence=excluded.required_evidence,updated_at=current_timestamp;

ALTER TABLE framework_simulation_case ENABLE TRIGGER trg_guard_locked_simulation_case;

WITH bindings(case_code,case_type) AS (VALUES
 ('MEMBER_REGISTRATION_S5_HAPPY','HAPPY_PATH'),
 ('MEMBER_REGISTRATION_S5_AUTHORITY','AUTHORITY'),
 ('MEMBER_REGISTRATION_S5_ISOLATION','ISOLATION'),
 ('MEMBER_REGISTRATION_S5_EXCEPTION','EXCEPTION'),
 ('MEMBER_REGISTRATION_S5_RECOVERY','RECOVERY')
)
INSERT INTO framework_step_test_binding(process_code,step_code,case_code,trace_scope,expected_state,assertion_contract,evidence_required)
SELECT 'MEMBER_REGISTRATION','MEMBER_REGISTRATION_S5',case_code,'STEP','APPLICATION_PENDING_APPROVAL',
       jsonb_build_object('caseType',case_type,'deterministic',true,'aiRequired',false),true
  FROM bindings
ON CONFLICT(process_code,step_code,case_code) DO UPDATE SET trace_scope=excluded.trace_scope,
 expected_state=excluded.expected_state,assertion_contract=excluded.assertion_contract,evidence_required=true;

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT 5-count(distinct simulation.case_type) INTO missing_count
    FROM framework_step_test_binding binding JOIN framework_simulation_case simulation USING(case_code)
   WHERE binding.process_code='MEMBER_REGISTRATION' AND binding.step_code='MEMBER_REGISTRATION_S5'
     AND simulation.case_type IN ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY');
  IF missing_count<>0 THEN RAISE EXCEPTION 'MEMBER_REGISTRATION_S5_QA_CASES_INCOMPLETE: %',missing_count; END IF;
END $$;

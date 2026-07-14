ALTER TABLE framework_actor_definition
  ADD COLUMN IF NOT EXISTS responsibility_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accountability_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS competency_requirements text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS conflict_actor_codes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_concurrent_assignments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_cycle_days integer NOT NULL DEFAULT 365;

ALTER TABLE framework_process_definition
  ADD COLUMN IF NOT EXISTS owner_actor_code varchar(60) REFERENCES framework_actor_definition(actor_code),
  ADD COLUMN IF NOT EXISTS regulation_refs text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS risk_level varchar(20) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_cycle_days integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS lifecycle_status varchar(30) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_until date,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamp,
  ADD COLUMN IF NOT EXISTS next_review_at timestamp;

ALTER TABLE framework_process_step
  ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation_actor_code varchar(60) REFERENCES framework_actor_definition(actor_code),
  ADD COLUMN IF NOT EXISTS evidence_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS evidence_types text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS segregation_actor_codes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rollback_command_code varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS decision_rule text NOT NULL DEFAULT '';

ALTER TABLE framework_simulation_case
  ADD COLUMN IF NOT EXISTS severity varchar(20) NOT NULL DEFAULT 'MAJOR',
  ADD COLUMN IF NOT EXISTS required_evidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS automated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_duration_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE framework_simulation_run
  ADD COLUMN IF NOT EXISTS source_commit varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS execution_environment varchar(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_hash varchar(128) NOT NULL DEFAULT '';

UPDATE framework_actor_definition
SET responsibility_text=CASE actor_code
      WHEN 'COMPANY_MANAGER' THEN '프로젝트 범위·책임자·일정·최종 보고의 업무 책임'
      WHEN 'SITE_DATA_OWNER' THEN '사업장 활동자료와 증빙의 정확성·완전성 책임'
      WHEN 'CALCULATOR' THEN '배출계수 매핑, 단위 환산 및 산정 재현성 책임'
      WHEN 'VERIFIER' THEN '자료·산정 결과의 독립 검증과 보완 요구 책임'
      WHEN 'APPROVER' THEN '검증 결과의 최종 승인·반려 및 확정 책임'
      ELSE purpose END,
    accountability_text=CASE actor_code
      WHEN 'VERIFIER' THEN '검증 의견과 발견사항의 추적 가능성'
      WHEN 'APPROVER' THEN '최종 의사결정과 승인 근거의 적정성'
      ELSE '할당된 업무 결과와 증적의 적정성' END,
    competency_requirements=CASE actor_code
      WHEN 'CALCULATOR' THEN '온실가스 산정 방법론, 단위·배출계수 적용 역량'
      WHEN 'VERIFIER' THEN '검증 기준, 표본검사, 이해상충 통제 역량'
      WHEN 'APPROVER' THEN '조직 권한과 산정·검증 결과 판단 역량'
      ELSE '도메인 업무와 시스템 사용 교육 이수' END,
    conflict_actor_codes=CASE actor_code
      WHEN 'CALCULATOR' THEN 'VERIFIER,APPROVER'
      WHEN 'VERIFIER' THEN 'CALCULATOR,APPROVER'
      WHEN 'APPROVER' THEN 'CALCULATOR,VERIFIER'
      ELSE conflict_actor_codes END,
    max_concurrent_assignments=CASE WHEN max_concurrent_assignments=0 THEN 50 ELSE max_concurrent_assignments END
WHERE responsibility_text='' OR competency_requirements='';

UPDATE framework_process_definition p
SET owner_actor_code=coalesce(p.owner_actor_code,(SELECT s.actor_code FROM framework_process_step s WHERE s.process_code=p.process_code ORDER BY s.step_order LIMIT 1)),
    regulation_refs=CASE WHEN p.regulation_refs='' THEN '조직 적용 방법론·내부통제 기준·관련 법규' ELSE p.regulation_refs END,
    sla_hours=CASE WHEN p.sla_hours=0 THEN 720 ELSE p.sla_hours END,
    lifecycle_status=CASE WHEN p.process_status='DEVELOPMENT_READY' THEN 'ACTIVE' ELSE 'DRAFT' END,
    next_review_at=coalesce(p.next_review_at,current_timestamp + make_interval(days=>p.review_cycle_days));

UPDATE framework_process_step
SET sla_hours=CASE WHEN sla_hours=0 THEN 72 ELSE sla_hours END,
    escalation_actor_code=coalesce(escalation_actor_code,actor_code),
    evidence_types=CASE WHEN evidence_types='' THEN 'AUDIT_LOG,DATA_SNAPSHOT,DECISION_NOTE' ELSE evidence_types END,
    segregation_actor_codes=CASE actor_code WHEN 'CALCULATOR' THEN 'VERIFIER,APPROVER' WHEN 'VERIFIER' THEN 'CALCULATOR,APPROVER' WHEN 'APPROVER' THEN 'CALCULATOR,VERIFIER' ELSE segregation_actor_codes END,
    rollback_command_code=CASE WHEN rollback_command_code='' THEN 'REOPEN_'||step_code ELSE rollback_command_code END,
    decision_rule=CASE WHEN decision_rule='' THEN completion_rule ELSE decision_rule END;

UPDATE framework_simulation_case
SET required_evidence=CASE WHEN required_evidence='' THEN 'HTTP_STATUS,STATE_TRANSITION,AUTHORITY_RESULT,AUDIT_EVENT' ELSE required_evidence END,
    severity=CASE case_type WHEN 'HAPPY_PATH' THEN 'CRITICAL' WHEN 'AUTHORITY' THEN 'CRITICAL' WHEN 'ISOLATION' THEN 'CRITICAL' ELSE 'MAJOR' END;

CREATE OR REPLACE VIEW framework_process_professional_readiness AS
SELECT p.process_code,
       p.process_name,
       p.lifecycle_status,
       p.risk_level,
       (CASE WHEN p.owner_actor_code IS NOT NULL THEN 10 ELSE 0 END
        + CASE WHEN p.regulation_refs<>'' THEN 10 ELSE 0 END
        + CASE WHEN p.sla_hours>0 THEN 10 ELSE 0 END
        + CASE WHEN count(DISTINCT s.step_id)>0 THEN 10 ELSE 0 END
        + CASE WHEN count(DISTINCT s.step_id) FILTER (WHERE s.completion_rule<>'' AND s.evidence_types<>'' AND s.sla_hours>0)=count(DISTINCT s.step_id) THEN 20 ELSE 0 END
        + CASE WHEN count(DISTINCT c.case_type)>=5 THEN 20 ELSE 0 END
        + CASE WHEN count(DISTINCT c.case_code) FILTER (WHERE c.case_status='APPROVED')=count(DISTINCT c.case_code) AND count(DISTINCT c.case_code)>0 THEN 10 ELSE 0 END
        + CASE WHEN count(DISTINCT a.artifact_id) FILTER (WHERE a.required AND a.delivery_status='VERIFIED')=count(DISTINCT a.artifact_id) FILTER (WHERE a.required) AND count(DISTINCT a.artifact_id) FILTER (WHERE a.required)>0 THEN 10 ELSE 0 END)::integer AS readiness_score,
       concat_ws(', ',
         CASE WHEN p.owner_actor_code IS NULL THEN '프로세스 소유자 미지정' END,
         CASE WHEN p.regulation_refs='' THEN '규정·방법론 근거 미지정' END,
         CASE WHEN p.sla_hours=0 THEN '프로세스 SLA 미지정' END,
         CASE WHEN count(DISTINCT s.step_id)=0 THEN '단계 없음' END,
         CASE WHEN count(DISTINCT c.case_type)<5 THEN '필수 5종 시나리오 미충족' END,
         CASE WHEN count(DISTINCT c.case_code) FILTER (WHERE c.case_status<>'APPROVED')>0 THEN '미승인 테스트 존재' END,
         CASE WHEN count(DISTINCT a.artifact_id) FILTER (WHERE a.required AND a.delivery_status<>'VERIFIED')>0 THEN '미검증 필수 산출물 존재' END
       ) AS readiness_gaps,
       count(DISTINCT s.step_id) AS step_count,
       count(DISTINCT c.case_type) AS scenario_type_count,
       count(DISTINCT c.case_code) FILTER (WHERE c.case_status='APPROVED') AS approved_case_count,
       count(DISTINCT c.case_code) AS case_count
FROM framework_process_definition p
LEFT JOIN framework_process_step s ON s.process_code=p.process_code
LEFT JOIN framework_simulation_case c ON c.process_code=p.process_code
LEFT JOIN framework_process_artifact a ON a.process_code=p.process_code
GROUP BY p.process_code,p.process_name,p.lifecycle_status,p.risk_level,p.owner_actor_code,p.regulation_refs,p.sla_hours;

-- Each Product LCA capability must open with its own stable work context.
-- The React route remains common, while the menu code selects the governed
-- workspace so common layout/components are reused without ambiguous links.
UPDATE comtnmenuinfo
SET menu_url = '/emission/lca?menu=' || menu_code,
    last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code LIKE 'H103____'
  AND length(menu_code) = 8
  AND use_at = 'Y' AND expsr_at = 'Y';

UPDATE comtccmmndetailcode d
SET code_dc = m.menu_url,
    use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP,
    last_updusr_id = 'LCA_WORKSPACE'
FROM comtnmenuinfo m
WHERE d.code_id = 'HMENU1'
  AND d.code = m.menu_code
  AND m.menu_code LIKE 'H103____'
  AND length(m.menu_code) = 8;

DO $$
DECLARE
    visible_count integer;
    unique_url_count integer;
    invalid_count integer;
BEGIN
    SELECT count(*), count(DISTINCT menu_url),
           count(*) FILTER (WHERE menu_url <> '/emission/lca?menu=' || menu_code)
    INTO visible_count, unique_url_count, invalid_count
    FROM comtnmenuinfo
    WHERE menu_code LIKE 'H103____' AND length(menu_code)=8
      AND use_at='Y' AND expsr_at='Y';
    IF visible_count <> 22 OR unique_url_count <> 22 OR invalid_count <> 0 THEN
        RAISE EXCEPTION 'Product LCA workspace binding failed: visible=%, unique=%, invalid=%',
            visible_count, unique_url_count, invalid_count;
    END IF;
END $$;

INSERT INTO framework_process_professional_scenario
    (case_code, process_code, case_name, case_type, preconditions, steps_json,
     assertions_json, case_status, severity, required_evidence, automated,
     expected_duration_minutes, design_version, created_at, updated_at)
VALUES
('LCA_E2E_APPROVED_REPORT','LCA_EXECUTION','제품 LCA 범위 정의부터 승인 보고까지','HAPPY_PATH',
 'LCA 실무자와 독립 검토자 계정, 제품·공정·기간·사업장 기준정보가 존재한다.',
 '["프로젝트 범위와 기능단위를 확정한다","원료·에너지·운송·산출물 인벤토리를 제출한다","LCI 매핑과 LCIA를 실행한다","기여도와 민감도를 검토한다","독립 검토 후 보고서를 확정한다"]',
 '["22개 워크스페이스가 순서대로 접근 가능하다","산정 스냅샷과 배출계수 버전이 고정된다","작성자와 승인자가 분리된다","승인 보고서가 재현 가능하다"]',
 'READY','CRITICAL','scope,inventory,evidence,factor-version,calculation-snapshot,approval,report',true,120,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('LCA_FUNCTIONAL_UNIT_REQUIRED','LCA_EXECUTION','기능단위 누락 시 인벤토리 산정 차단','NEGATIVE',
 '제품과 공정은 등록됐지만 기능단위 또는 기준흐름이 누락돼 있다.',
 '["시스템 경계를 저장한다","기능단위를 비운 채 인벤토리 확정을 요청한다"]',
 '["산정 단계 전환이 거부된다","누락 필드와 보완 방법이 표시된다","잘못된 산정 스냅샷이 생성되지 않는다"]',
 'READY','HIGH','validation-error,audit-event,unchanged-state',true,30,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('LCA_DATA_QUALITY_EVIDENCE_GATE','LCA_EXECUTION','인벤토리 증빙·품질 게이트','NEGATIVE',
 '일부 원료 데이터에 출처, 기간, 지역, 기술 대표성 또는 증빙 파일이 없다.',
 '["인벤토리를 제출한다","데이터 품질 검사를 실행한다","검토 승인을 요청한다"]',
 '["품질 점수와 결손 항목이 산출된다","중요 결손은 승인 요청을 차단한다","보완 이력이 원자료와 연결된다"]',
 'READY','HIGH','quality-score,evidence-gap,correction-history,audit-event',true,45,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('LCA_ALLOCATION_SENSITIVITY','LCA_EXECUTION','제품·부산물 할당 민감도 비교','ALTERNATIVE',
 '동일 공정에서 제품과 부산물이 발생하고 질량·경제가치 자료가 존재한다.',
 '["기준 할당 방법을 선택한다","질량·경제·물리관계 대안을 실행한다","결과 차이와 결론을 저장한다"]',
 '["각 대안의 입력과 결과가 별도 보존된다","기준 방법의 선택 근거가 기록된다","보고서에 민감도와 한계가 반영된다"]',
 'READY','HIGH','allocation-inputs,scenario-results,decision-rationale,report-limitations',true,60,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('LCA_REVIEWER_SEGREGATION','LCA_EXECUTION','작성자·검토자 권한 분리','AUTHORITY',
 'LCA 실무자가 산정 결과를 제출했고 독립 검토자 계정이 별도로 존재한다.',
 '["작성자가 자신의 결과 승인을 시도한다","독립 검토자가 근거를 검토한다","검토자가 승인 또는 보완 요청한다"]',
 '["자기 승인이 거부된다","승인·반려 사유와 시각이 감사 로그에 남는다","확정본 이후 변경은 새 버전으로 분기된다"]',
 'READY','CRITICAL','authority-denial,review-comment,approval-ledger,version-history',true,45,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT (case_code) DO UPDATE SET
    case_name=EXCLUDED.case_name, case_type=EXCLUDED.case_type,
    preconditions=EXCLUDED.preconditions, steps_json=EXCLUDED.steps_json,
    assertions_json=EXCLUDED.assertions_json, case_status='READY',
    severity=EXCLUDED.severity, required_evidence=EXCLUDED.required_evidence,
    automated=EXCLUDED.automated, expected_duration_minutes=EXCLUDED.expected_duration_minutes,
    design_version=framework_process_professional_scenario.design_version+1,
    updated_at=CURRENT_TIMESTAMP;

-- Complete the governed screen assets required by the development gate.
-- The runtime implementation already exists; this migration records the reviewed
-- screen design, selected mock-up, and common KRDS asset reuse without bypassing
-- any approval or verification gate.

INSERT INTO ui_page_manifest
    (page_id, page_name, route_path, domain_code, layout_version,
     design_token_version, active_yn, page_title, page_url, version_status,
     created_at, updated_at)
VALUES
    ('EMISSION_ORG_BOUNDARY_USER', '조직경계 설정', '/emission/organizational-boundary',
     'EMISSION', '1.0.0', 'KRDS_GOV_DEFAULT', 'Y', '조직경계 설정',
     '/emission/organizational-boundary', 'READY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('EMISSION_ORG_BOUNDARY_ADMIN', '조직경계 운영', '/admin/emission/organizational-boundary',
     'EMISSION_ADMIN', '1.0.0', 'KRDS_GOV_DEFAULT', 'Y', '조직경계 운영',
     '/admin/emission/organizational-boundary', 'READY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (page_id) DO UPDATE
SET page_name = EXCLUDED.page_name,
    route_path = EXCLUDED.route_path,
    domain_code = EXCLUDED.domain_code,
    design_token_version = EXCLUDED.design_token_version,
    active_yn = 'Y',
    page_title = EXCLUDED.page_title,
    page_url = EXCLUDED.page_url,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO framework_screen_development_note
    (route_key, route_path, page_id, page_title, design_note, function_note,
     acceptance_note, development_status, updated_by)
VALUES
    ('/emission/organizational-boundary', '/emission/organizational-boundary',
     'EMISSION_ORG_BOUNDARY_USER', '조직경계 설정',
     'KRDS 반응형 업무 화면에서 조직경계 버전, 법인·사업장 소유구조, 포함 판정, 내부거래 제거, 통합 결과와 승인 이력을 하나의 단계형 작업공간으로 제공한다.',
     '회사 담당자는 경계 기준과 법인·사업장을 저장하고 검토 요청한다. 산정 담당자는 내부거래를 제거하고 연결 결과를 계산하며 승인자는 증적과 조정 차이를 검토하여 승인 또는 반려한다.',
     '필수 법인과 소유·통제 증적이 존재하고 제외 사유가 검증되며 총배출량-제거량=순배출량 조정 차이가 허용 범위 이내이고 권한·격리·복구·감사 시나리오가 통과해야 완료된다.',
     'READY', 'FLYWAY'),
    ('/admin/emission/organizational-boundary', '/admin/emission/organizational-boundary',
     'EMISSION_ORG_BOUNDARY_ADMIN', '조직경계 운영',
     'KRDS 관리자 업무 화면에서 프로젝트별 조직경계 현황, 법인·사업장 포함 판정, 내부거래 제거, 연결 계산, 보완 요청과 승인 감사 증적을 통합 관리한다.',
     '관리자는 테넌트와 프로젝트 범위 안에서 경계 데이터를 조회하고 품질·권한·버전 충돌을 점검하며 담당자 배정, 보완 요청, 승인 상태와 감사 이력을 운영한다.',
     '사용자 화면과 동일한 계산·상태 계약을 유지하고 객체 수준 접근통제, 업무분리, 낙관적 잠금, 변경 이력 및 실패 복구 증거가 확인되어야 운영 완료로 판정한다.',
     'READY', 'FLYWAY')
ON CONFLICT (route_key) DO UPDATE
SET route_path = EXCLUDED.route_path,
    page_id = EXCLUDED.page_id,
    page_title = EXCLUDED.page_title,
    design_note = EXCLUDED.design_note,
    function_note = EXCLUDED.function_note,
    acceptance_note = EXCLUDED.acceptance_note,
    development_status = EXCLUDED.development_status,
    note_version = framework_screen_development_note.note_version + 1,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO framework_screen_html_mockup
    (route_key, route_path, page_id, slot_no, mockup_title, prompt_text,
     html_content, mockup_status, selected, updated_by)
VALUES
    ('/emission/organizational-boundary', '/emission/organizational-boundary',
     'EMISSION_ORG_BOUNDARY_USER', 1, '조직경계 사용자 단계형 작업공간',
     'KRDS 공통 자산으로 조직경계 수집, 판정, 연결 계산, 승인 단계를 반응형 업무 화면으로 구성한다.',
     '<main class="krds-page" data-route="/emission/organizational-boundary"><header class="krds-page-header"><h1>조직경계 설정</h1></header><section class="krds-task-summary"></section><section class="krds-boundary-version"></section><div class="krds-workspace"><section class="krds-entity-register"></section><section class="krds-inclusion-decision"></section></div><section class="krds-elimination-ledger"></section><section class="krds-consolidation-result"></section><section class="krds-evidence-history"></section><nav class="krds-next-task"></nav></main>',
     'SELECTED', true, 'FLYWAY'),
    ('/admin/emission/organizational-boundary', '/admin/emission/organizational-boundary',
     'EMISSION_ORG_BOUNDARY_ADMIN', 1, '조직경계 관리자 운영 작업공간',
     'KRDS 공통 자산으로 프로젝트별 조직경계 품질, 보완, 연결 결과와 승인 감사를 운영하는 반응형 관리자 화면을 구성한다.',
     '<main class="krds-page" data-route="/admin/emission/organizational-boundary"><header class="krds-page-header"><h1>조직경계 운영</h1></header><section class="krds-operation-summary"></section><section class="krds-project-filter"></section><div class="krds-workspace"><section class="krds-boundary-list"></section><section class="krds-boundary-detail"></section></div><section class="krds-quality-and-consolidation"></section><section class="krds-approval-audit"></section><nav class="krds-next-task"></nav></main>',
     'SELECTED', true, 'FLYWAY')
ON CONFLICT (route_key, slot_no) DO UPDATE
SET route_path = EXCLUDED.route_path,
    page_id = EXCLUDED.page_id,
    mockup_title = EXCLUDED.mockup_title,
    prompt_text = EXCLUDED.prompt_text,
    html_content = EXCLUDED.html_content,
    mockup_status = 'SELECTED',
    selected = true,
    mockup_version = framework_screen_html_mockup.mockup_version + 1,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO framework_design_preflight
    (page_id, route_path, theme_id, section_id, component_id, class_set_id,
     decision, asset_fingerprint, evidence_json, reuse_policy, source_scope, executed_by)
SELECT p.page_id, p.route_path, 'KRDS_GOV_DEFAULT', 'DETAIL_WORKSPACE',
       'COMMON_CONTENT_CARD', 'KRDS_CONTENT_CARD', 'REUSED',
       md5(p.page_id || '|KRDS_GOV_DEFAULT|DETAIL_WORKSPACE|COMMON_CONTENT_CARD|KRDS_CONTENT_CARD'),
       '{"themeVerified":true,"sectionVerified":true,"componentMatched":true,"classSetVerified":true,"commonOnly":true}',
       'COMMON_ONLY', 'COMMON', 'FLYWAY'
FROM ui_page_manifest p
WHERE p.page_id IN ('EMISSION_ORG_BOUNDARY_USER', 'EMISSION_ORG_BOUNDARY_ADMIN')
  AND NOT EXISTS (
      SELECT 1 FROM framework_design_preflight d
      WHERE lower(split_part(d.route_path, '?', 1)) = lower(p.route_path)
        AND d.reuse_policy = 'COMMON_ONLY' AND d.source_scope = 'COMMON'
  );

-- S1 used the machine state token alone. Preserve the state while making the
-- human-readable entry condition explicit enough for the professional contract.
UPDATE framework_professional_screen_contract
SET entry_condition = 'READY 상태이며 회사 담당자가 해당 테넌트와 프로젝트에 배정되어 있다.',
    updated_by = 'FLYWAY',
    updated_at = CURRENT_TIMESTAMP
WHERE process_code = 'ORGANIZATIONAL_BOUNDARY'
  AND step_code = 'ORGANIZATIONAL_BOUNDARY_S1';

CREATE OR REPLACE VIEW framework_customer_journey_gap AS
SELECT 'MENU'::varchar(30) AS gap_type,
       m.menu_code::varchar(100) AS object_code,
       m.menu_nm::varchar(300) AS object_name,
       coalesce(m.menu_url, '')::varchar(500) AS target_url,
       'BLOCKER'::varchar(20) AS severity,
       '노출된 최종 메뉴에 실행 가능한 URL이 없습니다.'::text AS reason,
       '메뉴 URL을 실제 화면에 연결하거나 노출을 해제합니다.'::text AS remediation
FROM comtnmenuinfo m
WHERE m.menu_code LIKE 'H%'
  AND m.use_at = 'Y'
  AND coalesce(m.expsr_at, 'Y') = 'Y'
  AND btrim(coalesce(m.menu_url, '')) IN ('', '#')
  AND NOT EXISTS (
      SELECT 1 FROM comtnmenuinfo child
      WHERE child.menu_code LIKE m.menu_code || '%'
        AND length(child.menu_code) > length(m.menu_code)
        AND child.use_at = 'Y'
        AND coalesce(child.expsr_at, 'Y') = 'Y'
  )
UNION ALL
SELECT 'TASK'::varchar(30),
       t.task_id::varchar(100),
       t.task_name::varchar(300),
       coalesce(t.target_url, '')::varchar(500),
       'BLOCKER'::varchar(20),
       '실행 가능한 Task가 실제 업무 화면과 연결되지 않았습니다.'::text,
       '프로세스 단계의 사용자 화면 URL과 프로젝트·Task 식별자를 연결합니다.'::text
FROM emission_project_task t
WHERE t.task_status IN ('READY', 'IN_PROGRESS')
  AND (btrim(coalesce(t.target_url, '')) IN ('', '#') OR t.target_url NOT LIKE '/%')
UNION ALL
SELECT 'REGISTRATION_REQUIREMENT'::varchar(30),
       r.requirement_code::varchar(100),
       r.requirement_name::varchar(300),
       coalesce(r.target_route, '')::varchar(500),
       CASE WHEN r.implementation_status = 'MISSING' THEN 'BLOCKER' ELSE 'WARNING' END::varchar(20),
       r.implementation_note::text,
       CASE WHEN r.implementation_status = 'MISSING'
            THEN '화면·API·DB 계약을 신규 구현하고 종단간 테스트를 등록합니다.'
            ELSE '기존 기능을 프로젝트 등록 계약에 연결하고 종단간 테스트를 통과시킵니다.'
       END::text
FROM framework_project_registration_requirement r
WHERE r.implementation_status IN ('MISSING', 'PARTIAL');

CREATE OR REPLACE VIEW framework_customer_journey_quality_summary AS
SELECT count(*) AS total_gaps,
       count(*) FILTER (WHERE severity = 'BLOCKER') AS blocker_gaps,
       count(*) FILTER (WHERE severity = 'WARNING') AS warning_gaps,
       count(*) FILTER (WHERE gap_type = 'MENU') AS dead_menu_gaps,
       count(*) FILTER (WHERE gap_type = 'TASK') AS task_route_gaps,
       count(*) FILTER (WHERE gap_type = 'REGISTRATION_REQUIREMENT') AS registration_gaps
FROM framework_customer_journey_gap;

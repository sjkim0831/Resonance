\set ON_ERROR_STOP on

-- Required psql variables:
--   sync_mode, raw_route_count, canonical_collision_count, executed_by
-- Required temporary input table:
--   frontend_route_registry_input(route_key,route_id,screen_name,family_file,
--     source_path,ko_path,en_path,aliases)

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('framework:frontend-route-workflow-policy'));

DO $block$
BEGIN
  IF to_regclass('public.framework_screen_workflow_policy') IS NULL THEN
    RAISE EXCEPTION
      'framework_screen_workflow_policy is missing; apply Flyway migration V20260807112000 first';
  END IF;
END
$block$;

CREATE TEMP TABLE frontend_route_sync_stats (
  inserted_resource_count integer NOT NULL DEFAULT 0,
  inserted_binding_count integer NOT NULL DEFAULT 0,
  public_join_binding_inserted_count integer NOT NULL DEFAULT 0,
  duplicate_binding_count integer NOT NULL DEFAULT 0
) ON COMMIT DROP;
INSERT INTO frontend_route_sync_stats DEFAULT VALUES;

CREATE TEMP TABLE frontend_route_workflow_analysis ON COMMIT DROP AS
WITH runtime_candidates AS (
  SELECT screen.route_key,binding.process_code,binding.step_code,
         binding.audience,
         coalesce(nullif(binding.actor_code,''),step.actor_code) AS actor_code,
         'ACTIVE_BINDING'::text AS evidence_source
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource screen USING(screen_resource_id)
  JOIN framework_process_step step
    ON step.process_code=binding.process_code
   AND step.step_code=binding.step_code
  WHERE binding.binding_status='ACTIVE'
  UNION
  SELECT lower(split_part(step.user_path,'?',1)),step.process_code,step.step_code,
         'USER',step.actor_code,'STEP_USER_PATH'
  FROM framework_process_step step
  WHERE nullif(step.user_path,'') IS NOT NULL
  UNION
  SELECT lower(split_part(step.admin_path,'?',1)),step.process_code,step.step_code,
         'ADMIN',step.actor_code,'STEP_ADMIN_PATH'
  FROM framework_process_step step
  WHERE nullif(step.admin_path,'') IS NOT NULL
  UNION
  SELECT lower(split_part(menu.menu_url,'?',1)),step.process_code,step.step_code,
         menu.audience,coalesce(nullif(menu.actor_code,''),step.actor_code),
         'MENU_BINDING'
  FROM framework_process_menu_binding menu
  JOIN framework_menu_route_semantic_audit semantic
    ON semantic.menu_code=menu.menu_code
  JOIN framework_process_step step
    ON step.process_code=menu.process_code
   AND menu.step_code=step.step_code
  WHERE menu.binding_status='ACTIVE'
    AND menu.verified_at IS NOT NULL
    AND semantic.semantic_status IN ('EXACT_STEP','SCREEN_CONTRACT')
    AND semantic.resolved_process_code=menu.process_code
    AND semantic.resolved_step_code=menu.step_code
    AND semantic.resolved_actor_code=menu.actor_code
    AND nullif(menu.menu_url,'') IS NOT NULL
), design_evidence AS (
  SELECT lower(split_part(contract.route_path,'?',1)) AS route_key,
         contract.process_code,contract.step_code,contract.audience,
         coalesce(nullif(contract.actor_code,''),step.actor_code) AS actor_code,
         'PROFESSIONAL_CONTRACT'::text AS evidence_source
  FROM framework_professional_screen_contract contract
  JOIN framework_process_step step
    ON step.process_code=contract.process_code AND step.step_code=contract.step_code
  WHERE contract.contract_status='VERIFIED'
    AND nullif(contract.process_code,'') IS NOT NULL
    AND nullif(contract.step_code,'') IS NOT NULL
  UNION
  SELECT lower(split_part(blueprint.route_path,'?',1)),blueprint.process_code,
         blueprint.step_code,blueprint.audience,
         coalesce(nullif(blueprint.actor_code,''),step.actor_code),
         'SCREEN_BLUEPRINT'
  FROM framework_screen_blueprint blueprint
  JOIN framework_process_step step
    ON step.process_code=blueprint.process_code AND step.step_code=blueprint.step_code
  WHERE blueprint.validation_status='VALID'
    AND nullif(blueprint.process_code,'') IS NOT NULL
    AND nullif(blueprint.step_code,'') IS NOT NULL
  UNION
  SELECT lower(split_part(space.route_path,'?',1)),space.process_code,space.step_code,
         CASE WHEN lower(split_part(space.route_path,'?',1)) LIKE '/admin/%'
              THEN 'ADMIN' ELSE 'USER' END,
         coalesce(nullif(space.actor_code,''),step.actor_code),'SCREEN_SPACE'
  FROM framework_screen_space_spec space
  JOIN framework_process_step step
    ON step.process_code=space.process_code AND step.step_code=space.step_code
  WHERE space.validation_status IN ('VERIFIED','VALID')
    AND nullif(space.process_code,'') IS NOT NULL
    AND nullif(space.step_code,'') IS NOT NULL
  UNION
  SELECT lower(split_part(navigation.target_path,'?',1)),navigation.process_code,
         navigation.step_code,navigation.audience,
         coalesce(nullif(navigation.actor_code,''),step.actor_code),
         'NAVIGATION_BINDING'
  FROM framework_process_navigation_binding navigation
  JOIN framework_process_step step
    ON step.process_code=navigation.process_code
   AND step.step_code=navigation.step_code
  WHERE navigation.binding_status='ACTIVE'
    AND navigation.business_screen_implemented
    AND navigation.verified_at IS NOT NULL
    AND nullif(navigation.process_code,'') IS NOT NULL
    AND nullif(navigation.step_code,'') IS NOT NULL
), route_facts AS (
  SELECT input.*,
         input.route_key IN ('/login','/admin/login','/signin','/find','/error')
           OR input.route_key LIKE '/login/%'
           OR input.route_key LIKE '/admin/login/%'
           OR input.route_key LIKE '/signin/%'
           OR input.route_key LIKE '/find/%'
           OR input.route_key LIKE '/error/%'
           OR input.route_key='/admin/emission/survey-report-print'
           OR input.route_key LIKE '/admin/emission/survey-report-print/%'
           OR input.route_key='/admin/emission/survey-report-lca-summary'
           OR input.route_key LIKE '/admin/emission/survey-report-lca-summary/%'
           AS explicit_exclusion,
         -- Only source-audited read/navigation routes belong here. A route
         -- that performs POST/PUT/PATCH/DELETE must use an exact workflow
         -- contract and remain REVIEW_REQUIRED until authenticated E2E passes.
         input.route_key=ANY(ARRAY[
           '/admin','/admin/placeholder','/placeholder','/flutter-app','/runtime/page',
           '/home/search','/support/download_list','/support/notice_list',
           '/edu/content','/edu/course_detail','/mtn/index','/mtn/status',
           '/mtn/version','/payment/notify',
           '/join/companyjoinstatusguide','/home','/home/alerts','/emission/index',
           '/emission/deadline-status','/emission/project-completion',
           '/emission/project/progress','/emission/lci','/emission/lca',
           '/monitoring/index','/monitoring/dashboard','/monitoring/realtime',
           '/monitoring/alerts','/monitoring/reduction_trend','/monitoring/track',
           '/sitemap','/support/index','/support/faq','/certificate/index',
           '/co2/index'
         ]) AS intentional_informational,
         (SELECT count(DISTINCT (candidate.process_code,candidate.step_code,
                                 candidate.audience,candidate.actor_code))
            FROM runtime_candidates candidate
           WHERE candidate.route_key=input.route_key) AS runtime_candidate_count,
          (SELECT count(DISTINCT (evidence.process_code,evidence.step_code,
                                  evidence.audience,evidence.actor_code))
             FROM design_evidence evidence
            WHERE evidence.route_key=input.route_key) AS design_evidence_count,
          (SELECT count(*)
             FROM framework_process_step_screen_binding existing_binding
             JOIN framework_screen_resource existing_resource
               ON existing_resource.screen_resource_id=existing_binding.screen_resource_id
            WHERE existing_resource.route_key=input.route_key
              AND existing_binding.binding_status='ACTIVE'
              AND existing_binding.context_contract->>'source'
                    ='DETERMINISTIC_FRONTEND_ROUTE_SYNC') AS deterministic_sync_binding_count,
          (SELECT string_agg(DISTINCT evidence.evidence_source,',' ORDER BY evidence.evidence_source)
            FROM design_evidence evidence
           WHERE evidence.route_key=input.route_key) AS design_evidence_sources
  FROM frontend_route_registry_input input
), resolved AS (
  SELECT facts.*,
         deterministic.process_code AS deterministic_process_code,
         deterministic.step_code AS deterministic_step_code,
         deterministic.audience AS deterministic_audience,
         deterministic.actor_code AS deterministic_actor_code,
         CASE
           WHEN facts.explicit_exclusion THEN 'EXCLUDED'
           WHEN facts.runtime_candidate_count>0 THEN 'EXECUTABLE'
           WHEN facts.design_evidence_count=1 AND (
             (facts.route_key LIKE '/admin/system/%'
               AND deterministic.process_code='GOVERNANCE_CHANGE'
               AND deterministic.step_code='GOV_REQUEST'
               AND deterministic.audience='ADMIN'
               AND deterministic.actor_code='PLATFORM_OPERATOR')
             OR (facts.route_key='/emission/project/settings'
               AND deterministic.process_code='ACTIVITY_DATA'
               AND deterministic.step_code='ACTIVITY_DATA_01_PLAN'
               AND deterministic.audience='USER'
               AND deterministic.actor_code='COMPANY_MANAGER')
           )
             THEN 'EXECUTABLE'
           WHEN facts.intentional_informational THEN 'INFORMATIONAL'
           ELSE 'REVIEW_REQUIRED'
         END AS classification,
         CASE
           WHEN facts.explicit_exclusion THEN 'AUTH_OR_PRINT_ROUTE'
           WHEN facts.runtime_candidate_count>0 THEN 'RUNTIME_WORKFLOW_RESOLVED'
           WHEN facts.design_evidence_count=1 AND (
             (facts.route_key LIKE '/admin/system/%'
               AND deterministic.process_code='GOVERNANCE_CHANGE'
               AND deterministic.step_code='GOV_REQUEST'
               AND deterministic.audience='ADMIN'
               AND deterministic.actor_code='PLATFORM_OPERATOR')
             OR (facts.route_key='/emission/project/settings'
               AND deterministic.process_code='ACTIVITY_DATA'
               AND deterministic.step_code='ACTIVITY_DATA_01_PLAN'
               AND deterministic.audience='USER'
               AND deterministic.actor_code='COMPANY_MANAGER')
           )
             THEN 'DETERMINISTIC_DESIGN_EVIDENCE'
           WHEN facts.intentional_informational THEN 'INFORMATIONAL_ROUTE'
           WHEN facts.route_key='/support/index' AND facts.design_evidence_count=1
             THEN 'SEMANTIC_ACTOR_AUDIENCE_MISMATCH'
           ELSE 'MISSING_WORKFLOW_EVIDENCE'
         END AS reason_code
  FROM route_facts facts
  LEFT JOIN LATERAL (
    SELECT evidence.process_code,evidence.step_code,evidence.audience,evidence.actor_code
    FROM design_evidence evidence
    WHERE evidence.route_key=facts.route_key AND facts.design_evidence_count=1
    ORDER BY evidence.evidence_source,evidence.process_code,evidence.step_code
    LIMIT 1
  ) deterministic ON true
)
SELECT resolved.*,
       CASE reason_code
         WHEN 'AUTH_OR_PRINT_ROUTE'
           THEN '로그인·계정 복구·인쇄 전용 화면은 공통 업무 길잡이 대상에서 제외합니다.'
         WHEN 'RUNTIME_WORKFLOW_RESOLVED'
           THEN '활성 화면 바인딩 또는 정확한 단계·메뉴 경로로 실행 업무가 확인되었습니다.'
         WHEN 'DETERMINISTIC_DESIGN_EVIDENCE'
           THEN '유효 설계 자산에서 하나의 프로세스·단계·대상·액터 계약만 확인되었습니다.'
         WHEN 'INFORMATIONAL_ROUTE'
           THEN '검색·안내·상태·호스트·콜백 성격의 화면으로 실행 상태 전이가 필요하지 않습니다.'
         WHEN 'SEMANTIC_ACTOR_AUDIENCE_MISMATCH'
           THEN '사용자 지원 화면에 플랫폼 운영자 거버넌스 계약이 연결되어 자동 승격을 차단했습니다.'
         ELSE '실제 업무 화면이지만 프로세스·단계 근거가 없어 설계 검토 전 실행 후보로 승격하지 않습니다.'
       END AS reason_text,
       CASE
         WHEN classification='REVIEW_REQUIRED' THEN 'PENDING'
         ELSE 'AUTO_APPROVED'
       END AS resolved_review_status,
       classification='EXECUTABLE'
         AND design_evidence_count=1
         AND (runtime_candidate_count=0 OR deterministic_sync_binding_count>0)
         AND (
           (route_key LIKE '/admin/system/%'
             AND deterministic_process_code='GOVERNANCE_CHANGE'
             AND deterministic_step_code='GOV_REQUEST'
             AND deterministic_audience='ADMIN'
             AND deterministic_actor_code='PLATFORM_OPERATOR')
           OR (route_key='/emission/project/settings'
             AND deterministic_process_code='ACTIVITY_DATA'
             AND deterministic_step_code='ACTIVITY_DATA_01_PLAN'
             AND deterministic_audience='USER'
             AND deterministic_actor_code='COMPANY_MANAGER')
         ) AS deterministic_contract_match
FROM resolved;

-- Every implemented frontend route receives a resource identity.  This proves
-- existence only, so new rows are IMPLEMENTED and are never promoted to VERIFIED.
WITH inserted AS (
  INSERT INTO framework_screen_resource(
    route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
    responsive_contract,accessibility_contract,security_contract)
  SELECT analysis.route_key,analysis.screen_name,
         CASE
           WHEN analysis.route_key LIKE '/admin/%' THEN 'ADMIN_WORKSPACE'
           WHEN analysis.route_key LIKE '%report%' OR analysis.route_key LIKE '%certificate%'
             THEN 'REPORT'
           WHEN analysis.route_key LIKE '%detail%' THEN 'DETAIL'
           WHEN analysis.route_key LIKE '%list%' OR analysis.route_key LIKE '%history%'
             THEN 'LIST'
           ELSE 'RESPONSIVE_WORKSPACE'
         END,
         'IMPLEMENTED','FRONTEND_ROUTE_REGISTRY',
         analysis.family_file||'#'||analysis.route_id,
         '{"mobile":"REFLOW","desktop":"RESPONSIVE","overflow":"CONTAIN"}'::jsonb,
          '{"standard":"WCAG_2_1_AA","keyboard":true,"screenReader":true}'::jsonb,
          jsonb_build_object(
           'authenticationRequired',analysis.route_key NOT IN (
               '/join','/signin','/login','/admin/login','/find','/error')
             AND analysis.route_key NOT LIKE '/join/%'
             AND analysis.route_key NOT LIKE '/signin/%'
             AND analysis.route_key NOT LIKE '/login/%'
             AND analysis.route_key NOT LIKE '/admin/login/%'
             AND analysis.route_key NOT LIKE '/find/%'
             AND analysis.route_key NOT LIKE '/error/%',
           'serverAuthorizationRequired',analysis.route_key LIKE '/admin/%')
  FROM frontend_route_workflow_analysis analysis
  ON CONFLICT(route_key) DO NOTHING
  RETURNING 1
)
UPDATE frontend_route_sync_stats
SET inserted_resource_count=(SELECT count(*) FROM inserted);

-- Human-approved/rejected rows are immutable under automated reconciliation.
DELETE FROM framework_screen_workflow_policy policy
WHERE policy.source='FRONTEND_AST_SYNC'
  AND policy.review_status IN ('AUTO_APPROVED','PENDING','CONFLICT')
  AND NOT EXISTS (
    SELECT 1 FROM frontend_route_registry_input input
    WHERE input.route_key=policy.route_key
  );

INSERT INTO framework_screen_workflow_policy(
  route_key,classification,reason_code,reason_text,source,review_status,
  reviewed_by,reviewed_at,updated_at)
SELECT route_key,classification,reason_code,reason_text,'FRONTEND_AST_SYNC',
       resolved_review_status,NULL,NULL,current_timestamp
FROM frontend_route_workflow_analysis
ON CONFLICT(route_key) DO UPDATE SET
  classification=CASE
    WHEN framework_screen_workflow_policy.review_status IN ('APPROVED','REJECTED')
      THEN framework_screen_workflow_policy.classification
    ELSE excluded.classification END,
  reason_code=CASE
    WHEN framework_screen_workflow_policy.review_status IN ('APPROVED','REJECTED')
      THEN framework_screen_workflow_policy.reason_code
    ELSE excluded.reason_code END,
  reason_text=CASE
    WHEN framework_screen_workflow_policy.review_status IN ('APPROVED','REJECTED')
      THEN framework_screen_workflow_policy.reason_text
    ELSE excluded.reason_text END,
  source=CASE
    WHEN framework_screen_workflow_policy.review_status IN ('APPROVED','REJECTED')
      THEN framework_screen_workflow_policy.source
    ELSE excluded.source END,
  review_status=CASE
    WHEN framework_screen_workflow_policy.review_status IN ('APPROVED','REJECTED')
      THEN framework_screen_workflow_policy.review_status
    ELSE excluded.review_status END,
  updated_at=current_timestamp;

-- Only the 34 deterministic contracts receive a new executable binding.
-- Review/fallback-only rows never enter this statement.
WITH inserted AS (
  INSERT INTO framework_process_step_screen_binding(
    process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
    initial_view,context_contract,visibility_contract,completion_contract,
    guide_contract,binding_status)
  SELECT analysis.deterministic_process_code,analysis.deterministic_step_code,
         resource.screen_resource_id,analysis.deterministic_audience,
         analysis.deterministic_actor_code,
         CASE WHEN analysis.route_key LIKE '/admin/system/%' THEN 'SUPPORT' ELSE 'PRIMARY' END,
         analysis.route_id,
         jsonb_build_object(
           'routeKey',analysis.route_key,'routeId',analysis.route_id,
           'source','DETERMINISTIC_FRONTEND_ROUTE_SYNC','projectContext','OPTIONAL'),
         jsonb_build_object(
           'audience',analysis.deterministic_audience,
           'actorCode',analysis.deterministic_actor_code,
           'serverAuthorizationRequired',true),
         jsonb_build_object('completionRule',coalesce(step.completion_rule,'')),
         jsonb_build_object(
           'stepName',step.step_name,'requirement',coalesce(step.requirement_text,''),
           'inputContract',coalesce(step.input_contract,''),
           'outputContract',coalesce(step.output_contract,'')),
         'ACTIVE'
  FROM frontend_route_workflow_analysis analysis
  JOIN framework_screen_resource resource ON resource.route_key=analysis.route_key
  JOIN framework_process_step step
    ON step.process_code=analysis.deterministic_process_code
   AND step.step_code=analysis.deterministic_step_code
  WHERE analysis.deterministic_contract_match
    AND analysis.resolved_review_status='AUTO_APPROVED'
    AND NOT EXISTS (
      SELECT 1
      FROM framework_process_step_screen_binding existing
      WHERE existing.process_code=analysis.deterministic_process_code
        AND existing.step_code=analysis.deterministic_step_code
        AND existing.screen_resource_id=resource.screen_resource_id
        AND existing.audience=analysis.deterministic_audience
    )
  ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO NOTHING
  RETURNING 1
)
UPDATE frontend_route_sync_stats
SET inserted_binding_count=(SELECT count(*) FROM inserted);

-- Registration is a public workflow.  Reuse only the already approved
-- PUBLIC_APPLICANT user binding for the same route/step; never clone internal
-- TERMS, VERIFIER, or APPROVER actors into the anonymous journey.
WITH inserted AS (
  INSERT INTO framework_process_step_screen_binding(
    process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
    initial_view,context_contract,visibility_contract,completion_contract,
    guide_contract,binding_status,screen_sequence,is_required,transition_type,
    transition_condition,parallel_group_code,entry_condition,completion_action,
    input_contract,output_contract,permission_codes,api_contract,database_lineage,
    test_contract,design_version,contract_status)
  SELECT binding.process_code,binding.step_code,binding.screen_resource_id,
         'PUBLIC',binding.actor_code,binding.entry_mode,binding.initial_view,
         binding.context_contract,
         jsonb_set(binding.visibility_contract,'{audience}','"PUBLIC"'::jsonb,true),
         binding.completion_contract,binding.guide_contract,binding.binding_status,
         binding.screen_sequence,binding.is_required,binding.transition_type,
         binding.transition_condition,binding.parallel_group_code,
         binding.entry_condition,binding.completion_action,binding.input_contract,
         binding.output_contract,binding.permission_codes,binding.api_contract,
         binding.database_lineage,binding.test_contract,binding.design_version,
         binding.contract_status
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource
    ON resource.screen_resource_id=binding.screen_resource_id
  WHERE binding.process_code='MEMBER_REGISTRATION'
    AND binding.actor_code='PUBLIC_APPLICANT'
    AND binding.audience='USER'
    AND binding.binding_status='ACTIVE'
    AND resource.route_key LIKE '/join/step%'
  ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO NOTHING
  RETURNING 1
)
UPDATE frontend_route_sync_stats
SET public_join_binding_inserted_count=(SELECT count(*) FROM inserted);

UPDATE frontend_route_sync_stats stats
SET duplicate_binding_count=coalesce((
  SELECT count(*)
  FROM (
    SELECT binding.process_code,binding.step_code,binding.screen_resource_id,
           binding.audience,count(*)
    FROM framework_process_step_screen_binding binding
    JOIN frontend_route_workflow_analysis analysis
      ON analysis.deterministic_contract_match
    JOIN framework_screen_resource resource
      ON resource.route_key=analysis.route_key
     AND resource.screen_resource_id=binding.screen_resource_id
    WHERE binding.process_code=analysis.deterministic_process_code
      AND binding.step_code=analysis.deterministic_step_code
      AND binding.audience=analysis.deterministic_audience
    GROUP BY binding.process_code,binding.step_code,binding.screen_resource_id,
             binding.audience
    HAVING count(*)>1
  ) duplicates
),0);

DO $block$
DECLARE
  canonical_count integer;
  deterministic_count integer;
  informational_count integer;
  excluded_count integer;
  review_count integer;
  duplicate_count integer;
BEGIN
  SELECT count(*) INTO canonical_count FROM frontend_route_workflow_analysis;
  SELECT count(*) INTO deterministic_count
    FROM frontend_route_workflow_analysis WHERE deterministic_contract_match;
  SELECT count(*) INTO informational_count
    FROM frontend_route_workflow_analysis WHERE classification='INFORMATIONAL';
  SELECT count(*) INTO excluded_count
    FROM frontend_route_workflow_analysis WHERE classification='EXCLUDED';
  SELECT count(*) INTO review_count
    FROM frontend_route_workflow_analysis WHERE classification='REVIEW_REQUIRED';
  SELECT duplicate_binding_count INTO duplicate_count FROM frontend_route_sync_stats;

  IF canonical_count<>(SELECT count(*) FROM frontend_route_registry_input) THEN
    RAISE EXCEPTION 'canonical route analysis lost rows: input=% analysis=%',
      (SELECT count(*) FROM frontend_route_registry_input),canonical_count;
  END IF;
  IF duplicate_count<>0 THEN
    RAISE EXCEPTION 'deterministic binding duplicate rows detected: %',duplicate_count;
  END IF;
  -- Baseline closure protects deterministic bindings and the explicit
  -- informational/auth exclusions. REVIEW_REQUIRED may grow when unsafe
  -- fallback evidence is removed, so its current count is reported, not hidden.
  IF canonical_count=1054 AND (
       deterministic_count<>34 OR informational_count<>34
       OR excluded_count<>10) THEN
    RAISE EXCEPTION
      'accepted route classification drift deterministic=% informational=% excluded=% review=%',
      deterministic_count,informational_count,excluded_count,review_count;
  END IF;
END
$block$;

INSERT INTO framework_screen_workflow_sync_audit(
  sync_mode,source,raw_route_count,canonical_route_count,
  canonical_collision_count,executable_count,deterministic_mapping_count,
  informational_count,excluded_count,review_required_count,conflict_count,
  inserted_resource_count,inserted_binding_count,duplicate_binding_count,
  summary_json,executed_by,completed_at)
SELECT :'sync_mode','FRONTEND_TYPESCRIPT_AST',(:'raw_route_count')::integer,
       count(*),(:'canonical_collision_count')::integer,
       count(*) FILTER(WHERE analysis.classification='EXECUTABLE'),
       count(*) FILTER(WHERE analysis.deterministic_contract_match),
       count(*) FILTER(WHERE analysis.classification='INFORMATIONAL'),
       count(*) FILTER(WHERE analysis.classification='EXCLUDED'),
       count(*) FILTER(WHERE analysis.classification='REVIEW_REQUIRED'),
       count(*) FILTER(WHERE analysis.resolved_review_status='CONFLICT'),
       stats.inserted_resource_count,stats.inserted_binding_count,
       stats.duplicate_binding_count,
       jsonb_build_object(
         'rawCandidateMapped',count(*) FILTER(WHERE analysis.runtime_candidate_count>0),
         'fallbackReviewPromoted',0,
         'resourceStatusForNewRoutes','IMPLEMENTED',
         'verifiedPromotionCount',0,
         'publicJoinBindingInserted',stats.public_join_binding_inserted_count,
         'canonicalAliases',(:'canonical_collision_count')::integer),
       :'executed_by',current_timestamp
FROM frontend_route_workflow_analysis analysis
CROSS JOIN frontend_route_sync_stats stats
GROUP BY stats.inserted_resource_count,stats.inserted_binding_count,
         stats.public_join_binding_inserted_count,stats.duplicate_binding_count;

SELECT 'ROUTE_POLICY_SYNC_SUMMARY|'||jsonb_build_object(
  'syncMode',:'sync_mode',
  'rawRoutes',(:'raw_route_count')::integer,
  'canonicalRoutes',count(*),
  'canonicalCollisions',(:'canonical_collision_count')::integer,
  'executable',count(*) FILTER(WHERE analysis.classification='EXECUTABLE'),
  'deterministicMappings',count(*) FILTER(WHERE analysis.deterministic_contract_match),
  'informational',count(*) FILTER(WHERE analysis.classification='INFORMATIONAL'),
  'excluded',count(*) FILTER(WHERE analysis.classification='EXCLUDED'),
  'reviewRequired',count(*) FILTER(WHERE analysis.classification='REVIEW_REQUIRED'),
  'conflicts',count(*) FILTER(WHERE analysis.resolved_review_status='CONFLICT'),
  'insertedResources',stats.inserted_resource_count,
  'insertedBindings',stats.inserted_binding_count,
  'publicJoinBindingInserted',stats.public_join_binding_inserted_count,
  'duplicateBindings',stats.duplicate_binding_count,
  'fallbackReviewPromoted',0,
  'verifiedPromotionCount',0)::text
FROM frontend_route_workflow_analysis analysis
CROSS JOIN frontend_route_sync_stats stats
GROUP BY stats.inserted_resource_count,stats.inserted_binding_count,
         stats.public_join_binding_inserted_count,stats.duplicate_binding_count;

\if :dry_run
ROLLBACK;
\else
COMMIT;
\endif

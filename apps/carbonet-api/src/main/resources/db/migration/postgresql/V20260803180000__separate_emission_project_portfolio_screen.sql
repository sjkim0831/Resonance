-- Separate portfolio monitoring from the operational project list while keeping
-- both screens available. The process guide now opens the portfolio first.
INSERT INTO framework_screen_resource(
  route_key,screen_name,screen_type,implementation_status,source_kind,source_ref,
  responsive_contract,accessibility_contract,security_contract
)
VALUES(
  '/emission/project-portfolio','배출량 프로젝트 포트폴리오','PORTFOLIO_DASHBOARD','VERIFIED','REACT_SOURCE',
  'features/emission-project-list/EmissionProjectPortfolioPage.tsx',
  '{"mobile":"single column metrics, pipeline and project cards","tablet":"adaptive two-column portfolio","desktop":"metrics, pipeline, risks, site portfolio and deliverables","overflow":"wrap content; no page-level horizontal overflow"}',
  '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"emptyState":true,"retry":true}',
  '{"authentication":"required","tenantIsolation":true,"projectActorIsolation":true,"mutation":"none"}'
)
ON CONFLICT(route_key) DO UPDATE SET
  screen_name=excluded.screen_name,
  screen_type=excluded.screen_type,
  implementation_status='VERIFIED',
  source_kind='REACT_SOURCE',
  source_ref=excluded.source_ref,
  responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,
  updated_at=current_timestamp;

UPDATE framework_process_navigation_binding
SET target_path='/emission/project-portfolio',
    navigation_type='IMPLEMENTED_SCREEN',
    business_screen_implemented=true,
    binding_status='ACTIVE',
    binding_source='PORTFOLIO_SCREEN_SEPARATION',
    verified_at=current_timestamp,
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO';

UPDATE framework_process_step_screen_binding
SET entry_mode='SUPPORT',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  AND audience='USER';

INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,
  initial_view,context_contract,visibility_contract,completion_contract,guide_contract,binding_status
)
SELECT 'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST',r.screen_resource_id,
  'USER','COMPANY_MANAGER','PRIMARY','PORTFOLIO_OVERVIEW',
  '{"tenantId":"session","actorId":"session","filters":"query state","projectMetrics":"derived from actor-scoped API response"}',
  '{"requiresAuthentication":true,"projectScope":"active actor assignment"}',
  '{"command":"SELECT_PROJECT","state":"PROJECT_SELECTED","evidence":"selected project and authorized target route"}',
  '{"sequence":["review portfolio metrics","check risks and pipeline","select project","continue next task"]}',
  'ACTIVE'
FROM framework_screen_resource r
WHERE r.route_key='/emission/project-portfolio'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
  actor_code=excluded.actor_code,
  entry_mode='PRIMARY',
  initial_view=excluded.initial_view,
  context_contract=excluded.context_contract,
  visibility_contract=excluded.visibility_contract,
  completion_contract=excluded.completion_contract,
  guide_contract=excluded.guide_contract,
  binding_status='ACTIVE',
  updated_at=current_timestamp;

UPDATE framework_page_design
SET page_title='배출량 프로젝트 포트폴리오',
    page_purpose='권한 범위 프로젝트의 진행률·위험·단계·사업장·보고서 및 인증서 준비 상태를 종합 점검하고 다음 업무로 진입한다.',
    screen_type='PORTFOLIO_DASHBOARD',
    planned_route_path='/emission/project-portfolio',
    actual_route_path='/emission/project-portfolio',
    route_status='IMPLEMENTED',
    responsive_contract='{"mobile":"single-column portfolio","tablet":"adaptive two-column","desktop":"metrics-pipeline-risk-site-deliverable","overflow":"no page-level horizontal overflow"}',
    design_status='DESIGN_COMPLETE',
    design_version=design_version+1,
    updated_by='PORTFOLIO_SCREEN_SEPARATION',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  AND audience='USER';

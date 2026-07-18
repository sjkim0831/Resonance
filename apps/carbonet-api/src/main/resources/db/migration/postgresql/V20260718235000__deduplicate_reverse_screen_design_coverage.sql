CREATE OR REPLACE VIEW framework_existing_screen_reverse_design_coverage AS
WITH pages AS (
  SELECT DISTINCT ON (lower(split_part(route_path,'?',1))) *
  FROM ui_page_manifest
  WHERE active_yn='Y' AND route_path IS NOT NULL AND btrim(route_path)<>'' AND route_path LIKE '/%'
  ORDER BY lower(split_part(route_path,'?',1)),(version_status='PUBLISHED') DESC,updated_at DESC,page_id
)
SELECT p.page_id,p.page_name,p.route_path,p.domain_code,p.version_status,
       b.blueprint_id,b.blueprint_code,b.process_code,b.step_code,b.actor_code,b.audience,
       b.validation_status,b.validation_message,b.implementation_strategy,b.transition_status,
       b.source_reference,
       c.contract_id AS professional_contract_id,
       coalesce(c.design_readiness_score,0) AS design_readiness_score,
       d.design_asset_id,d.source_path,
       CASE
         WHEN b.blueprint_id IS NULL THEN 'BLUEPRINT_MISSING'
         WHEN c.contract_id IS NULL THEN 'PROFESSIONAL_CONTRACT_MISSING'
         WHEN c.design_readiness_score<100 THEN 'DETAIL_DESIGN_INCOMPLETE'
         WHEN d.design_asset_id IS NULL THEN 'SOURCE_ASSET_MISSING'
         ELSE 'GENERATOR_READY'
       END AS reverse_registration_status
FROM pages p
LEFT JOIN LATERAL (
  SELECT candidate.* FROM framework_screen_blueprint candidate
  WHERE lower(split_part(candidate.route_path,'?',1))=lower(split_part(p.route_path,'?',1))
  ORDER BY (candidate.validation_status='VALID') DESC,candidate.updated_at DESC,candidate.blueprint_id
  LIMIT 1
) b ON true
LEFT JOIN LATERAL (
  SELECT candidate.* FROM framework_professional_screen_design_readiness candidate
  WHERE candidate.audience=b.audience
    AND lower(split_part(candidate.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
  ORDER BY candidate.design_readiness_score DESC,candidate.contract_id
  LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT r.design_asset_id,r.source_path
  FROM framework_design_asset_registry r
  WHERE r.active_yn='Y'
    AND lower(split_part(r.route_path,'?',1))=lower(split_part(p.route_path,'?',1))
  ORDER BY r.updated_at DESC,r.design_asset_id
  LIMIT 1
) d ON true;

COMMENT ON VIEW framework_existing_screen_reverse_design_coverage IS
'고유한 실제 URL별 기개발 화면, 전문 설계, 청사진, 소스 자산의 역등록 준비도';

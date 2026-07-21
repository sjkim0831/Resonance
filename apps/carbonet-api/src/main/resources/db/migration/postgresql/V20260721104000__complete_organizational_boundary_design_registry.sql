UPDATE framework_process_step
SET output_contract=jsonb_set(coalesce(nullif(output_contract,'')::jsonb,'{}'::jsonb),'{toState}',to_jsonb(to_state),true)::text
WHERE process_code='ORGANIZATIONAL_BOUNDARY';

INSERT INTO framework_api_endpoint_registry(endpoint_key,http_method,route_path,implementation_ref,active_yn)
VALUES
 ('ORG_BOUNDARY_GET','GET','/home/api/emission-projects/{id}/organizational-boundary','EmissionProjectRegistryController#organizationalBoundary','Y'),
 ('ORG_BOUNDARY_PUT','PUT','/home/api/emission-projects/{id}/organizational-boundary','EmissionProjectRegistryController#saveOrganizationalBoundary','Y'),
 ('ORG_BOUNDARY_REVIEW','POST','/home/api/emission-projects/{id}/organizational-boundary/review-ready','EmissionProjectRegistryController#markOrganizationalBoundaryReviewReady','Y'),
 ('ORG_BOUNDARY_CONSOLIDATE','POST','/home/api/emission-projects/{id}/organizational-boundary/consolidate','EmissionProjectRegistryController#consolidateOrganizationalBoundary','Y'),
 ('ORG_BOUNDARY_DECISION','POST','/home/api/emission-projects/{id}/organizational-boundary/decision','EmissionProjectRegistryController#decideOrganizationalBoundary','Y')
ON CONFLICT(http_method,route_path) DO UPDATE SET
 implementation_ref=excluded.implementation_ref,active_yn='Y',verified_at=current_timestamp;

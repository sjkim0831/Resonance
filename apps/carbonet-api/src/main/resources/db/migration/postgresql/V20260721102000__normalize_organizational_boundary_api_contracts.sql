WITH contracts(step_code,api_contract) AS (VALUES
  ('ORGANIZATIONAL_BOUNDARY_S1','["GET /home/api/emission-projects/{id}/organizational-boundary","PUT /home/api/emission-projects/{id}/organizational-boundary"]'),
  ('ORGANIZATIONAL_BOUNDARY_S2','["PUT /home/api/emission-projects/{id}/organizational-boundary","POST /home/api/emission-projects/{id}/organizational-boundary/review-ready"]'),
  ('ORGANIZATIONAL_BOUNDARY_S3','["POST /home/api/emission-projects/{id}/organizational-boundary/consolidate"]'),
  ('ORGANIZATIONAL_BOUNDARY_S4','["POST /home/api/emission-projects/{id}/organizational-boundary/decision"]')
)
UPDATE framework_process_step step
SET api_contract=contracts.api_contract
FROM contracts
WHERE step.process_code='ORGANIZATIONAL_BOUNDARY' AND step.step_code=contracts.step_code;

WITH contracts(step_code,api_contract) AS (VALUES
  ('ORGANIZATIONAL_BOUNDARY_S1','["GET /home/api/emission-projects/{id}/organizational-boundary","PUT /home/api/emission-projects/{id}/organizational-boundary"]'),
  ('ORGANIZATIONAL_BOUNDARY_S2','["PUT /home/api/emission-projects/{id}/organizational-boundary","POST /home/api/emission-projects/{id}/organizational-boundary/review-ready"]'),
  ('ORGANIZATIONAL_BOUNDARY_S3','["POST /home/api/emission-projects/{id}/organizational-boundary/consolidate"]'),
  ('ORGANIZATIONAL_BOUNDARY_S4','["POST /home/api/emission-projects/{id}/organizational-boundary/decision"]')
)
UPDATE framework_professional_screen_contract screen
SET api_contract=contracts.api_contract,updated_at=current_timestamp
FROM contracts
WHERE screen.process_code='ORGANIZATIONAL_BOUNDARY' AND screen.step_code=contracts.step_code;

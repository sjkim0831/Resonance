-- Prevent the development generator from reintroducing the reduction simulator
-- as the carbon-emission calculation workspace.
UPDATE framework_process_artifact
SET target_path = '/emission/calculation',
    evidence_ref = concat_ws(';', nullif(evidence_ref,''), 'canonical-route:/emission/calculation'),
    updated_at = current_timestamp
WHERE process_code = 'EMISSION_PROJECT'
  AND step_code = 'EMISSION_PROJECT_CALCULATE'
  AND artifact_type = 'FRONTEND_USER'
  AND target_path = '/emission/simulate';

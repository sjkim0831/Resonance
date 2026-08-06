-- Latest deterministic contract evidence is resolved by the immutable
-- contract fingerprint. Keep this lookup bounded when a screen exposes many
-- capabilities and has accumulated many historical audit runs.
CREATE INDEX IF NOT EXISTS idx_screen_workflow_test_run_contract_evidence
  ON framework_screen_workflow_test_run (
    screen_resource_id,
    process_code,
    step_code,
    capability_code,
    (coalesce(evidence_json->>'audience','')),
    (evidence_json->>'contractFingerprint'),
    executed_at DESC,
    run_id DESC
  )
  WHERE evidence_json ? 'contractFingerprint';

COMMENT ON INDEX idx_screen_workflow_test_run_contract_evidence IS
  'Supports bounded latest-evidence lookup for system-wide contract audit reporting.';

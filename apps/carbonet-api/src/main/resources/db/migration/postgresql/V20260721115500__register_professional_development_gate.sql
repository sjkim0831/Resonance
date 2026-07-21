INSERT INTO framework_quality_gate(
  gate_code,
  gate_name,
  gate_group,
  verification_command,
  failure_pattern,
  mandatory,
  use_at
) VALUES (
  'PROFESSIONAL_CONTRACT',
  '전문 개발 계약 사전 검증',
  'DESIGN',
  'bash ops/scripts/validate-professional-development-contract.sh',
  'actor, process step, screen contract, route, API, DB, authority, responsive, accessibility, or exception-state evidence missing',
  true,
  'Y'
)
ON CONFLICT(gate_code) DO UPDATE SET
  gate_name = excluded.gate_name,
  gate_group = excluded.gate_group,
  verification_command = excluded.verification_command,
  failure_pattern = excluded.failure_pattern,
  mandatory = excluded.mandatory,
  use_at = excluded.use_at,
  updated_at = current_timestamp;

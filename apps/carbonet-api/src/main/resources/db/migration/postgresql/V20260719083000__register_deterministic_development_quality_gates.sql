INSERT INTO framework_quality_gate(
  gate_code,
  gate_name,
  gate_group,
  verification_command,
  failure_pattern,
  mandatory,
  use_at
) VALUES
  (
    'DETERMINISTIC_FIRST',
    '결정적 개발 우선 검증',
    'SOURCE',
    'registered deterministic validator or generator evidence',
    '',
    true,
    'Y'
  ),
  (
    'ADOPT_EXISTING_SOURCE',
    '기개발 소스 채택 검증',
    'SOURCE',
    'exact route inventory, page manifest, source existence and targeted validation',
    '',
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


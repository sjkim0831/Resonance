INSERT INTO framework_quality_gate(
  gate_code, gate_name, gate_group, verification_command, failure_pattern, mandatory
) VALUES (
  'ADOPT_EXISTING_SOURCE', '기개발 화면 소스 채택 검증', 'SOURCE',
  'exact route inventory, page manifest, source existence and TypeScript check', '', true
)
ON CONFLICT(gate_code) DO UPDATE SET
  gate_name=excluded.gate_name,
  gate_group=excluded.gate_group,
  verification_command=excluded.verification_command,
  failure_pattern=excluded.failure_pattern,
  mandatory=excluded.mandatory,
  use_at='Y',
  updated_at=current_timestamp;

COMMENT ON COLUMN framework_quality_gate.gate_code IS
  'Stable verification code. ADOPT_EXISTING_SOURCE proves an existing registered frontend implementation without regenerating it.';

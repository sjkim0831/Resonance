# Verified existing database adoption: CALCULATION_ENGINE_PARITY / CEP_GATE

- Job: 21282
- Job type: DATABASE
- Source commit: 6503b497d4f62cd2c5e09c171dc255ab2c56aa65
- Requirement: 미승인 차이가 있으면 배포를 차단하고 승인된 차이만 기준 버전에 반영한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CALCULATION_ENGINE_PARITY","stepCode":"CEP_GATE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21282/projects/carbonet-backend-metadata/process-runtime/generated/CALCULATION_ENGINE_PARITY/CALCULATION_ENGINE_PARITY__CEP_GATE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21282/var/test-evidence/process-package-tests/CALCULATION_ENGINE_PARITY__CEP_GATE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

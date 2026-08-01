# Verified existing database adoption: CALCULATION_ENGINE_PARITY / CEP_BASELINE

- Job: 21272
- Job type: DATABASE
- Source commit: 6503b497d4f62cd2c5e09c171dc255ab2c56aa65
- Requirement: 기준 입력·수식·계수·LCI·단위·반올림·기대결과를 버전 잠금한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CALCULATION_ENGINE_PARITY","stepCode":"CEP_BASELINE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21272/projects/carbonet-backend-metadata/process-runtime/generated/CALCULATION_ENGINE_PARITY/CALCULATION_ENGINE_PARITY__CEP_BASELINE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21272/var/test-evidence/process-package-tests/CALCULATION_ENGINE_PARITY__CEP_BASELINE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

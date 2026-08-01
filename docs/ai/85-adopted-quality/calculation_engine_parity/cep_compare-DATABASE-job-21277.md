# Verified existing database adoption: CALCULATION_ENGINE_PARITY / CEP_COMPARE

- Job: 21277
- Job type: DATABASE
- Source commit: cd075202ac7345b1dadb498037e2b8b64e8181c9
- Requirement: 동일 입력을 두 엔진에 실행해 중간값·최종값·단위·반올림을 비교한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CALCULATION_ENGINE_PARITY","stepCode":"CEP_COMPARE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21277/projects/carbonet-backend-metadata/process-runtime/generated/CALCULATION_ENGINE_PARITY/CALCULATION_ENGINE_PARITY__CEP_COMPARE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21277/var/test-evidence/process-package-tests/CALCULATION_ENGINE_PARITY__CEP_COMPARE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

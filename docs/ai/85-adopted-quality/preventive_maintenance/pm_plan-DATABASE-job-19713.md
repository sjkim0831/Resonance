# Verified existing database adoption: PREVENTIVE_MAINTENANCE / PM_PLAN

- Job: 19713
- Job type: DATABASE
- Source commit: 268a6b82812034d160f540f07acf9926478e7cc5
- Requirement: 설비 중요도·고장모드·주기·부품·정지창을 계획한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PREVENTIVE_MAINTENANCE","stepCode":"PM_PLAN","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19713/projects/carbonet-backend-metadata/process-runtime/generated/PREVENTIVE_MAINTENANCE/PREVENTIVE_MAINTENANCE__PM_PLAN.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19713/var/test-evidence/process-package-tests/PREVENTIVE_MAINTENANCE__PM_PLAN.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

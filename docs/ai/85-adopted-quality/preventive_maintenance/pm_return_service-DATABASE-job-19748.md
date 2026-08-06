# Verified existing database adoption: PREVENTIVE_MAINTENANCE / PM_RETURN_SERVICE

- Job: 19748
- Job type: DATABASE
- Source commit: 682ee472dbd379a597de81ed8be33da4ef387231
- Requirement: 기능시험·누설시험·보호장치 확인 후 재가동을 승인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PREVENTIVE_MAINTENANCE","stepCode":"PM_RETURN_SERVICE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19748/projects/carbonet-backend-metadata/process-runtime/generated/PREVENTIVE_MAINTENANCE/PREVENTIVE_MAINTENANCE__PM_RETURN_SERVICE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19748/var/test-evidence/process-package-tests/PREVENTIVE_MAINTENANCE__PM_RETURN_SERVICE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

# Verified existing database adoption: PRIVACY_RETENTION_DESTRUCTION / PRD_CLASSIFY

- Job: 21242
- Job type: DATABASE
- Source commit: 39c1a9b497a5f6aacb6cbf9b9454f38f22666d8e
- Requirement: 데이터별 처리목적·법정기간·분쟁·감사 보류 여부를 판정한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PRIVACY_RETENTION_DESTRUCTION","stepCode":"PRD_CLASSIFY","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21242/projects/carbonet-backend-metadata/process-runtime/generated/PRIVACY_RETENTION_DESTRUCTION/PRIVACY_RETENTION_DESTRUCTION__PRD_CLASSIFY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21242/var/test-evidence/process-package-tests/PRIVACY_RETENTION_DESTRUCTION__PRD_CLASSIFY.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

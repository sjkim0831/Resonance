# Verified existing database adoption: SCHEDULED_STATISTICS_REPORTING / SSR_DEFINE

- Job: 21257
- Job type: DATABASE
- Source commit: a35d4c21c295e3ad97046600c25a99daffca09ce
- Requirement: 설비·시장·배출·인증·수수료 지표와 집계식·일정·수신처를 정의한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"SCHEDULED_STATISTICS_REPORTING","stepCode":"SSR_DEFINE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21257/projects/carbonet-backend-metadata/process-runtime/generated/SCHEDULED_STATISTICS_REPORTING/SCHEDULED_STATISTICS_REPORTING__SSR_DEFINE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21257/var/test-evidence/process-package-tests/SCHEDULED_STATISTICS_REPORTING__SSR_DEFINE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

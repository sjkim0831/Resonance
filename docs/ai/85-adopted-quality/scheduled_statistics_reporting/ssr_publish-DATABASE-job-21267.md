# Verified existing database adoption: SCHEDULED_STATISTICS_REPORTING / SSR_PUBLISH

- Job: 21267
- Job type: DATABASE
- Source commit: cdf55f5ec3bd542704f77ae27cb60a0c28707cf2
- Requirement: 승인된 통계를 차트·지도·PDF·엑셀 및 연계기관으로 배포한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"SCHEDULED_STATISTICS_REPORTING","stepCode":"SSR_PUBLISH","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21267/projects/carbonet-backend-metadata/process-runtime/generated/SCHEDULED_STATISTICS_REPORTING/SCHEDULED_STATISTICS_REPORTING__SSR_PUBLISH.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21267/var/test-evidence/process-package-tests/SCHEDULED_STATISTICS_REPORTING__SSR_PUBLISH.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

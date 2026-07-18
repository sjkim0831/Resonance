# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

- Job: 292
- Job type: DATABASE
- Source commit: 9c494700972f8d4cd07c070dad4c0b17830b726e
- Requirement: 입력·산정·증빙의 완전성, 정확성, 일관성과 이상치를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_VALIDATE","jobType":"DATABASE","relations":["emission_activity_quality_run","emission_activity_quality_issue","emission_activity_submission","emission_activity_submission_evidence"],"migrationCount":2,"indexCount":17,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

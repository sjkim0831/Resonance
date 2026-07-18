# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 715
- Job type: DATABASE_QUALITY
- Source commit: 9c494700972f8d4cd07c070dad4c0b17830b726e
- Requirement: Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE","jobType":"DATABASE_QUALITY","relations":["emission_submission_review","emission_activity_submission","emission_calculation_run","emission_project_report"],"migrationCount":2,"indexCount":17,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

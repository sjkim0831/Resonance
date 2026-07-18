# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

- Job: 679
- Job type: DATABASE_QUALITY
- Source commit: d32a545c37296f8579c4a4302ac740fd18d1c740
- Requirement: Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_VALIDATE","jobType":"DATABASE_QUALITY","relations":["emission_activity_quality_run","emission_activity_quality_issue","emission_activity_submission","emission_activity_submission_evidence"],"migrationCount":2,"indexCount":17,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

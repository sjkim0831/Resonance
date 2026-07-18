# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 697
- Job type: DATABASE_QUALITY
- Source commit: 89323633dcf3ab8ff1209409abd27d0108551644
- Requirement: Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","jobType":"DATABASE_QUALITY","relations":["emission_activity_quality_issue","emission_activity_data","emission_activity_submission_event","emission_activity_submission_item"],"migrationCount":2,"indexCount":9,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

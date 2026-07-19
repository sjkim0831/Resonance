# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_COLLECT

- Job: 643
- Job type: DATABASE_QUALITY
- Source commit: a6afbc985682e887128b3659ac5d475be58110fb
- Requirement: Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_COLLECT","jobType":"DATABASE_QUALITY","relations":["emission_activity_request","emission_activity_data","emission_activity_submission","emission_activity_submission_item","emission_activity_submission_evidence"],"migrationCount":4,"indexCount":19,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

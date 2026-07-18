# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 300
- Job type: DATABASE
- Source commit: 1267c35acf078113717b590f19ccb51f10e9e57e
- Requirement: 검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","jobType":"DATABASE","relations":["emission_activity_quality_issue","emission_activity_data","emission_activity_submission_event","emission_activity_submission_item"],"migrationCount":2,"indexCount":9,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

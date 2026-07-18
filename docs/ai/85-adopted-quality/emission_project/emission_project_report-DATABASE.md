# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 316
- Job type: DATABASE
- Source commit: 1267c35acf078113717b590f19ccb51f10e9e57e
- Requirement: 승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","jobType":"DATABASE","relations":["emission_project_report","emission_report_certificate_audit","emission_report_access_ledger","emission_calculation_run"],"migrationCount":3,"indexCount":9,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

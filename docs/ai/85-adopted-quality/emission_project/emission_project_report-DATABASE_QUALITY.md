# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 733
- Job type: DATABASE_QUALITY
- Source commit: 89323633dcf3ab8ff1209409abd27d0108551644
- Requirement: Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","jobType":"DATABASE_QUALITY","relations":["emission_project_report","emission_report_certificate_audit","emission_report_access_ledger","emission_calculation_run"],"migrationCount":3,"indexCount":9,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

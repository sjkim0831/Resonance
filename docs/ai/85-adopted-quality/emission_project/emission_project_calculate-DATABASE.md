# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 284
- Job type: DATABASE
- Source commit: 1267c35acf078113717b590f19ccb51f10e9e57e
- Requirement: 승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","jobType":"DATABASE","relations":["emission_factor_reference","emission_activity_data","emission_calculation_run","emission_calculation_item"],"migrationCount":2,"indexCount":7,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

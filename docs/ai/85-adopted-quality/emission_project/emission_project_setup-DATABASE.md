# Verified existing database adoption: EMISSION_PROJECT / EMISSION_PROJECT_SETUP

- Job: 268
- Job type: DATABASE
- Source commit: 9c494700972f8d4cd07c070dad4c0b17830b726e
- Requirement: 프로젝트 범위, 조직 경계, 담당 액터, 일정과 책임을 확정한다.
- Validation result: {"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_SETUP","jobType":"DATABASE","relations":["emission_project_registry","emission_project_member","emission_project_task","emission_project_history"],"migrationCount":3,"indexCount":14,"failedFlyway":0,"unvalidatedForeignKeys":0}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

# Verified existing database adoption: DATA_INTEGRATION / DATA_INTEGRATION_02_WORK

- Job: 9354
- Job type: DATABASE
- Source commit: 098791d053d53ce18a977f53c75dd8ec5d6669a9
- Requirement: 승인된 계약 버전으로 멱등 수집을 실행하고 원천 생성시각, 수신시각, 건수, 체크섬, 스키마 검사, 재시도 정책과 원본 증적을 기록한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_02_WORK","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-9354/projects/carbonet-backend-metadata/process-runtime/generated/DATA_INTEGRATION/DATA_INTEGRATION__DATA_INTEGRATION_02_WORK.json","evidence":"/opt/Resonance/var/ai-worktrees/job-9354/var/test-evidence/process-package-tests/DATA_INTEGRATION.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

# Verified existing database adoption: DATA_INTEGRATION / DATA_INTEGRATION_03_VERIFY

- Job: 9340
- Job type: DATABASE
- Source commit: 922dddbc886c25b9dd6c543721d7d805e0bf5996
- Requirement: 검증자는 스키마 적합성, 누락·중복·이상치, 원천 대사, 품질 점수, 격리 데이터와 보완 결과를 검증하고 재실행 전후 증적을 비교한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_03_VERIFY","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-9340/projects/carbonet-backend-metadata/process-runtime/generated/DATA_INTEGRATION/DATA_INTEGRATION__DATA_INTEGRATION_03_VERIFY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-9340/var/test-evidence/process-package-tests/DATA_INTEGRATION.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

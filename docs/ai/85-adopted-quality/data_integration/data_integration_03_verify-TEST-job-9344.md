# Verified actor journey adoption: DATA_INTEGRATION / DATA_INTEGRATION_03_VERIFY

- Job: 9344
- Job type: TEST
- Source commit: 123613ae9462ef9bfb54199196d9187685c4000a
- Requirement: 검증자는 스키마 적합성, 누락·중복·이상치, 원천 대사, 품질 점수, 격리 데이터와 보완 결과를 검증하고 재실행 전후 증적을 비교한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_03_VERIFY","dimension":"TEST","package":"/opt/Resonance/var/ai-worktrees/job-9344/projects/carbonet-backend-metadata/process-runtime/generated/DATA_INTEGRATION/DATA_INTEGRATION__DATA_INTEGRATION_03_VERIFY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-9344/var/test-evidence/process-package-tests/DATA_INTEGRATION.json","status":"PASSED"}
- Live runtime evidence: /opt/Resonance/var/ai-worktrees/job-9344/var/test-evidence/process-package-tests/DATA_INTEGRATION.json

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, a real rolled-back state transition, idempotency, runtime p95 evidence, and two ready replicas.

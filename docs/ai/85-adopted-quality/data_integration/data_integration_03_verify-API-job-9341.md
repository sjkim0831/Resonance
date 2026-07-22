# Verified existing server adoption: DATA_INTEGRATION / DATA_INTEGRATION_03_VERIFY

- Job: 9341
- Job type: API
- Source commit: fbef545ae154adba80a14274252aaf6dcb22b212
- Requirement: 검증자는 스키마 적합성, 누락·중복·이상치, 원천 대사, 품질 점수, 격리 데이터와 보완 결과를 검증하고 재실행 전후 증적을 비교한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_03_VERIFY","dimension":"API","package":"/opt/Resonance/var/ai-worktrees/job-9341/projects/carbonet-backend-metadata/process-runtime/generated/DATA_INTEGRATION/DATA_INTEGRATION__DATA_INTEGRATION_03_VERIFY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-9341/var/test-evidence/process-package-tests/DATA_INTEGRATION.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

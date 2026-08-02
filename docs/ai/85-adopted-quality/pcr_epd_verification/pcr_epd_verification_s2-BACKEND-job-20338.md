# Verified existing server adoption: PCR_EPD_VERIFICATION / PCR_EPD_VERIFICATION_S2

- Job: 20338
- Job type: BACKEND
- Source commit: 575728b23938fae82f82cfc61950dfa64500e036
- Requirement: PCR 적합성·유효기간 판정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PCR_EPD_VERIFICATION","stepCode":"PCR_EPD_VERIFICATION_S2","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-20338/projects/carbonet-backend-metadata/process-runtime/generated/PCR_EPD_VERIFICATION/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20338/var/test-evidence/process-package-tests/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S2.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

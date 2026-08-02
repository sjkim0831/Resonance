# Verified existing server adoption: PCR_EPD_VERIFICATION / PCR_EPD_VERIFICATION_S1

- Job: 20333
- Job type: BACKEND
- Source commit: 1ffd17bb3c188c0cf84f2ae963f38a34ccd16f7a
- Requirement: 제품 분류·PCR 탐색 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PCR_EPD_VERIFICATION","stepCode":"PCR_EPD_VERIFICATION_S1","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-20333/projects/carbonet-backend-metadata/process-runtime/generated/PCR_EPD_VERIFICATION/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S1.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20333/var/test-evidence/process-package-tests/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S1.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

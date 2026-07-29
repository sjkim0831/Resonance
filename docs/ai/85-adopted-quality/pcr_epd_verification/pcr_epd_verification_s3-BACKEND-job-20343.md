# Verified existing server adoption: PCR_EPD_VERIFICATION / PCR_EPD_VERIFICATION_S3

- Job: 20343
- Job type: BACKEND
- Source commit: 128457941a4cd7a0a2aaa2c5204fb7632037bcdb
- Requirement: EPD·PCF 필수항목 검증 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PCR_EPD_VERIFICATION","stepCode":"PCR_EPD_VERIFICATION_S3","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-20343/projects/carbonet-backend-metadata/process-runtime/generated/PCR_EPD_VERIFICATION/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20343/var/test-evidence/process-package-tests/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S3.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

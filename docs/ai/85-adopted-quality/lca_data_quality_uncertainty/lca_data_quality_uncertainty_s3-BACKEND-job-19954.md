# Verified existing server adoption: LCA_DATA_QUALITY_UNCERTAINTY / LCA_DATA_QUALITY_UNCERTAINTY_S3

- Job: 19954
- Job type: BACKEND
- Source commit: 3f8939db370dbd407009cac6e63b2a61c1c504fe
- Requirement: 불확도·민감도 계산 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_DATA_QUALITY_UNCERTAINTY","stepCode":"LCA_DATA_QUALITY_UNCERTAINTY_S3","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-19954/projects/carbonet-backend-metadata/process-runtime/generated/LCA_DATA_QUALITY_UNCERTAINTY/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19954/var/test-evidence/process-package-tests/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S3.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

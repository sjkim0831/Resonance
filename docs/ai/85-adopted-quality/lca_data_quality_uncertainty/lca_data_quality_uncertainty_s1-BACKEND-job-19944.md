# Verified existing server adoption: LCA_DATA_QUALITY_UNCERTAINTY / LCA_DATA_QUALITY_UNCERTAINTY_S1

- Job: 19944
- Job type: BACKEND
- Source commit: 75ace7c6667154673b8f7afa31aac1b363e39435
- Requirement: 품질 메타데이터 수집 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_DATA_QUALITY_UNCERTAINTY","stepCode":"LCA_DATA_QUALITY_UNCERTAINTY_S1","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-19944/projects/carbonet-backend-metadata/process-runtime/generated/LCA_DATA_QUALITY_UNCERTAINTY/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S1.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19944/var/test-evidence/process-package-tests/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S1.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

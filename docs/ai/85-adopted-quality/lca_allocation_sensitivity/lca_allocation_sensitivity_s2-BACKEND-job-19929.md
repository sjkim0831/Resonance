# Verified existing server adoption: LCA_ALLOCATION_SENSITIVITY / LCA_ALLOCATION_SENSITIVITY_S2

- Job: 19929
- Job type: BACKEND
- Source commit: 75315e4cfd200188f2de68788ad1419983dac7db
- Requirement: 할당 회피·규칙 선택 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_ALLOCATION_SENSITIVITY","stepCode":"LCA_ALLOCATION_SENSITIVITY_S2","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-19929/projects/carbonet-backend-metadata/process-runtime/generated/LCA_ALLOCATION_SENSITIVITY/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19929/var/test-evidence/process-package-tests/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S2.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

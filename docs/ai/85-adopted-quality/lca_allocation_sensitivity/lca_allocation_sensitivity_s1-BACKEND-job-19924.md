# Verified existing server adoption: LCA_ALLOCATION_SENSITIVITY / LCA_ALLOCATION_SENSITIVITY_S1

- Job: 19924
- Job type: BACKEND
- Source commit: de0c318305ac65bf82959fd09aa05b602eb9e037
- Requirement: 다중 산출물·관계자료 확인 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_ALLOCATION_SENSITIVITY","stepCode":"LCA_ALLOCATION_SENSITIVITY_S1","dimension":"BACKEND","package":"/opt/Resonance/var/ai-worktrees/job-19924/projects/carbonet-backend-metadata/process-runtime/generated/LCA_ALLOCATION_SENSITIVITY/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S1.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19924/var/test-evidence/process-package-tests/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S1.json","status":"PASSED"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

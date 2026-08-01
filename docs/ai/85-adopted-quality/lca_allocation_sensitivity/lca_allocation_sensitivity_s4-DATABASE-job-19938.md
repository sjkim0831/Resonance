# Verified existing database adoption: LCA_ALLOCATION_SENSITIVITY / LCA_ALLOCATION_SENSITIVITY_S4

- Job: 19938
- Job type: DATABASE
- Source commit: 9ad25ee3658312fb62603a37375d85f61c3f679b
- Requirement: 규칙 정당성·결론 승인 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_ALLOCATION_SENSITIVITY","stepCode":"LCA_ALLOCATION_SENSITIVITY_S4","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19938/projects/carbonet-backend-metadata/process-runtime/generated/LCA_ALLOCATION_SENSITIVITY/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S4.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19938/var/test-evidence/process-package-tests/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S4.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

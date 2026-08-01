# Verified existing database adoption: LCA_ALLOCATION_SENSITIVITY / LCA_ALLOCATION_SENSITIVITY_S3

- Job: 19933
- Job type: DATABASE
- Source commit: 214ff4d09f40f496ab2776e740c9a3c6c1942b08
- Requirement: 대안별 재계산·민감도 비교 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_ALLOCATION_SENSITIVITY","stepCode":"LCA_ALLOCATION_SENSITIVITY_S3","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19933/projects/carbonet-backend-metadata/process-runtime/generated/LCA_ALLOCATION_SENSITIVITY/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19933/var/test-evidence/process-package-tests/LCA_ALLOCATION_SENSITIVITY__LCA_ALLOCATION_SENSITIVITY_S3.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

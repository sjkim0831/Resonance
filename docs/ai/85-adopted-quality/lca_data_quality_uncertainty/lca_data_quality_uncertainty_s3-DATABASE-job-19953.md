# Verified existing database adoption: LCA_DATA_QUALITY_UNCERTAINTY / LCA_DATA_QUALITY_UNCERTAINTY_S3

- Job: 19953
- Job type: DATABASE
- Source commit: a3a66c28889fb3786d2afa9bd9a6502879507002
- Requirement: 불확도·민감도 계산 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"LCA_DATA_QUALITY_UNCERTAINTY","stepCode":"LCA_DATA_QUALITY_UNCERTAINTY_S3","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19953/projects/carbonet-backend-metadata/process-runtime/generated/LCA_DATA_QUALITY_UNCERTAINTY/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19953/var/test-evidence/process-package-tests/LCA_DATA_QUALITY_UNCERTAINTY__LCA_DATA_QUALITY_UNCERTAINTY_S3.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

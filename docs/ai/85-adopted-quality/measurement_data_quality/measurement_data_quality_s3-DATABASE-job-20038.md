# Verified existing database adoption: MEASUREMENT_DATA_QUALITY / MEASUREMENT_DATA_QUALITY_S3

- Job: 20038
- Job type: DATABASE
- Source commit: 83e8ffdc923a4c077a00d761ed62cb6ee6e73d27
- Requirement: 결측·이상치 판정·대체 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"MEASUREMENT_DATA_QUALITY","stepCode":"MEASUREMENT_DATA_QUALITY_S3","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-20038/projects/carbonet-backend-metadata/process-runtime/generated/MEASUREMENT_DATA_QUALITY/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20038/var/test-evidence/process-package-tests/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S3.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

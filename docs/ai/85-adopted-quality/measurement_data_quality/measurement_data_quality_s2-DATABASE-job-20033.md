# Verified existing database adoption: MEASUREMENT_DATA_QUALITY / MEASUREMENT_DATA_QUALITY_S2

- Job: 20033
- Job type: DATABASE
- Source commit: 83e8ffdc923a4c077a00d761ed62cb6ee6e73d27
- Requirement: 교정·가동상태 검증 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"MEASUREMENT_DATA_QUALITY","stepCode":"MEASUREMENT_DATA_QUALITY_S2","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-20033/projects/carbonet-backend-metadata/process-runtime/generated/MEASUREMENT_DATA_QUALITY/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20033/var/test-evidence/process-package-tests/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S2.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

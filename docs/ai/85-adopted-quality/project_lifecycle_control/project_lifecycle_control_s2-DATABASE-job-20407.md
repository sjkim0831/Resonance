# Verified existing database adoption: PROJECT_LIFECYCLE_CONTROL / PROJECT_LIFECYCLE_CONTROL_S2

- Job: 20407
- Job type: DATABASE
- Source commit: 39c1a9b497a5f6aacb6cbf9b9454f38f22666d8e
- Requirement: 보존·잠금·영향평가 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PROJECT_LIFECYCLE_CONTROL","stepCode":"PROJECT_LIFECYCLE_CONTROL_S2","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-20407/projects/carbonet-backend-metadata/process-runtime/generated/PROJECT_LIFECYCLE_CONTROL/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20407/var/test-evidence/process-package-tests/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S2.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

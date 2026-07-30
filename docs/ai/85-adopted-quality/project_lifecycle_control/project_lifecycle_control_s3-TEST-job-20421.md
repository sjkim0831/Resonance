# Verified actor journey adoption: PROJECT_LIFECYCLE_CONTROL / PROJECT_LIFECYCLE_CONTROL_S3

- Job: 20421
- Job type: TEST
- Source commit: 03469132c57593e13c390daa182da960fe657f26
- Requirement: 권한분리 승인 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PROJECT_LIFECYCLE_CONTROL","stepCode":"PROJECT_LIFECYCLE_CONTROL_S3","dimension":"TEST","package":"/opt/Resonance/var/ai-worktrees/job-20421/projects/carbonet-backend-metadata/process-runtime/generated/PROJECT_LIFECYCLE_CONTROL/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20421/var/test-evidence/process-package-tests/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S3.json","status":"PASSED"}
- Live runtime evidence: /opt/Resonance/var/ai-worktrees/job-20421/var/test-evidence/process-package-tests/PROJECT_LIFECYCLE_CONTROL__PROJECT_LIFECYCLE_CONTROL_S3.json

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, a real rolled-back state transition, idempotency, runtime p95 evidence, and two ready replicas.

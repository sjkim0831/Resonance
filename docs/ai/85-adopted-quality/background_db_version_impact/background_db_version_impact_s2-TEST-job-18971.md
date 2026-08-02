# Verified actor journey adoption: BACKGROUND_DB_VERSION_IMPACT / BACKGROUND_DB_VERSION_IMPACT_S2

- Job: 18971
- Job type: TEST
- Source commit: 709f1553bb84d554cb363355f8a527eba7cc977c
- Requirement: 버전 잠금·재현성 스냅샷 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"BACKGROUND_DB_VERSION_IMPACT","stepCode":"BACKGROUND_DB_VERSION_IMPACT_S2","dimension":"TEST","package":"/opt/Resonance/var/ai-worktrees/job-18971/projects/carbonet-backend-metadata/process-runtime/generated/BACKGROUND_DB_VERSION_IMPACT/BACKGROUND_DB_VERSION_IMPACT__BACKGROUND_DB_VERSION_IMPACT_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-18971/var/test-evidence/process-package-tests/BACKGROUND_DB_VERSION_IMPACT__BACKGROUND_DB_VERSION_IMPACT_S2.json","status":"PASSED"}
- Live runtime evidence: /opt/Resonance/var/ai-worktrees/job-18971/var/test-evidence/process-package-tests/BACKGROUND_DB_VERSION_IMPACT__BACKGROUND_DB_VERSION_IMPACT_S2.json

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, a real rolled-back state transition, idempotency, runtime p95 evidence, and two ready replicas.

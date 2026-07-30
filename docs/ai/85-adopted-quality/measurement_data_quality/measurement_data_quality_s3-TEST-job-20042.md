# Verified actor journey adoption: MEASUREMENT_DATA_QUALITY / MEASUREMENT_DATA_QUALITY_S3

- Job: 20042
- Job type: TEST
- Source commit: cdbcd2157a160e02a201e940f127575670532d64
- Requirement: 결측·이상치 판정·대체 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"MEASUREMENT_DATA_QUALITY","stepCode":"MEASUREMENT_DATA_QUALITY_S3","dimension":"TEST","package":"/opt/Resonance/var/ai-worktrees/job-20042/projects/carbonet-backend-metadata/process-runtime/generated/MEASUREMENT_DATA_QUALITY/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S3.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20042/var/test-evidence/process-package-tests/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S3.json","status":"PASSED"}
- Live runtime evidence: /opt/Resonance/var/ai-worktrees/job-20042/var/test-evidence/process-package-tests/MEASUREMENT_DATA_QUALITY__MEASUREMENT_DATA_QUALITY_S3.json

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, a real rolled-back state transition, idempotency, runtime p95 evidence, and two ready replicas.

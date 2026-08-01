# Verified existing database adoption: PCR_EPD_VERIFICATION / PCR_EPD_VERIFICATION_S4

- Job: 20347
- Job type: DATABASE
- Source commit: 6504fc3c883bdce333d5a192a244e80720cc6b47
- Requirement: 독립 검증·공개본 승인 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PCR_EPD_VERIFICATION","stepCode":"PCR_EPD_VERIFICATION_S4","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-20347/projects/carbonet-backend-metadata/process-runtime/generated/PCR_EPD_VERIFICATION/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S4.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20347/var/test-evidence/process-package-tests/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S4.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

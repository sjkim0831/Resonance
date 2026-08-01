# Verified existing database adoption: PCR_EPD_VERIFICATION / PCR_EPD_VERIFICATION_S2

- Job: 20337
- Job type: DATABASE
- Source commit: 541d5621874fc59dc92fab2a59f499506835581b
- Requirement: PCR 적합성·유효기간 판정 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"PCR_EPD_VERIFICATION","stepCode":"PCR_EPD_VERIFICATION_S2","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-20337/projects/carbonet-backend-metadata/process-runtime/generated/PCR_EPD_VERIFICATION/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S2.json","evidence":"/opt/Resonance/var/ai-worktrees/job-20337/var/test-evidence/process-package-tests/PCR_EPD_VERIFICATION__PCR_EPD_VERIFICATION_S2.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

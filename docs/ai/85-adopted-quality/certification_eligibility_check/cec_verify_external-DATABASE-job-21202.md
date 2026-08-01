# Verified existing database adoption: CERTIFICATION_ELIGIBILITY_CHECK / CEC_VERIFY_EXTERNAL

- Job: 21202
- Job type: DATABASE
- Source commit: 0f64f4dc0a49cbe76a85f3644fbca23c9fb3708e
- Requirement: 전력량·REC·외부기관 자료와 중복수혜·중복발급 여부를 조회한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATION_ELIGIBILITY_CHECK","stepCode":"CEC_VERIFY_EXTERNAL","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21202/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATION_ELIGIBILITY_CHECK/CERTIFICATION_ELIGIBILITY_CHECK__CEC_VERIFY_EXTERNAL.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21202/var/test-evidence/process-package-tests/CERTIFICATION_ELIGIBILITY_CHECK__CEC_VERIFY_EXTERNAL.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

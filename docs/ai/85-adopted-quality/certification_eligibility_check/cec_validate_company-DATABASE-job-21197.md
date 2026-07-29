# Verified existing database adoption: CERTIFICATION_ELIGIBILITY_CHECK / CEC_VALIDATE_COMPANY

- Job: 21197
- Job type: DATABASE
- Source commit: 72ef00437093728e745f2145727fd93114b8474c
- Requirement: 법인인증서·신청 권한·회원사 상태·첨부 원본을 검증한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATION_ELIGIBILITY_CHECK","stepCode":"CEC_VALIDATE_COMPANY","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21197/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATION_ELIGIBILITY_CHECK/CERTIFICATION_ELIGIBILITY_CHECK__CEC_VALIDATE_COMPANY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21197/var/test-evidence/process-package-tests/CERTIFICATION_ELIGIBILITY_CHECK__CEC_VALIDATE_COMPANY.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

# Verified existing database adoption: CERTIFICATION_ELIGIBILITY_CHECK / CEC_DECIDE

- Job: 21207
- Job type: DATABASE
- Source commit: 72ef00437093728e745f2145727fd93114b8474c
- Requirement: 산정·품질·물량·외부 검증 결과를 종합해 발급 가능 여부를 결정한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATION_ELIGIBILITY_CHECK","stepCode":"CEC_DECIDE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21207/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATION_ELIGIBILITY_CHECK/CERTIFICATION_ELIGIBILITY_CHECK__CEC_DECIDE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21207/var/test-evidence/process-package-tests/CERTIFICATION_ELIGIBILITY_CHECK__CEC_DECIDE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

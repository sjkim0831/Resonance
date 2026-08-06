# Verified existing database adoption: REDUCTION_EXECUTION / REDUCTION_EXECUTION_03_VERIFY

- Job: 21165
- Job type: DATABASE
- Source commit: cdf55f5ec3bd542704f77ae27cb60a0c28707cf2
- Requirement: 감축 목표를 과제로 실행하고 실적을 검증한다. 목표를 위해 검증·보완 단계에서 VERIFY 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"REDUCTION_EXECUTION","stepCode":"REDUCTION_EXECUTION_03_VERIFY","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21165/projects/carbonet-backend-metadata/process-runtime/generated/REDUCTION_EXECUTION/REDUCTION_EXECUTION__REDUCTION_EXECUTION_03_VERIFY.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21165/var/test-evidence/process-package-tests/REDUCTION_EXECUTION__REDUCTION_EXECUTION_03_VERIFY.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

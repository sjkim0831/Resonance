# Verified existing database adoption: REDUCTION_EXECUTION / REDUCTION_EXECUTION_02_WORK

- Job: 21152
- Job type: DATABASE
- Source commit: 682ee472dbd379a597de81ed8be33da4ef387231
- Requirement: 감축 목표를 과제로 실행하고 실적을 검증한다. 목표를 위해 자료 입력·업무 수행 단계에서 WORK 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"REDUCTION_EXECUTION","stepCode":"REDUCTION_EXECUTION_02_WORK","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21152/projects/carbonet-backend-metadata/process-runtime/generated/REDUCTION_EXECUTION/REDUCTION_EXECUTION__REDUCTION_EXECUTION_02_WORK.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21152/var/test-evidence/process-package-tests/REDUCTION_EXECUTION__REDUCTION_EXECUTION_02_WORK.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

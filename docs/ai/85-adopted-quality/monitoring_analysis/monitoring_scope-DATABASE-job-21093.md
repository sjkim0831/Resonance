# Verified existing database adoption: MONITORING_ANALYSIS / MONITORING_SCOPE

- Job: 21093
- Job type: DATABASE
- Source commit: 541d5621874fc59dc92fab2a59f499506835581b
- Requirement: 배출·LCA·감축 데이터를 품질과 목표 관점에서 분석하고 공유한다. 목표를 위해 분석 범위 선택 단계에서 SELECT_SCOPE 명령의 선행 상태, 담당 액터, 필수 입력, 권한, 증적을 확인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"MONITORING_ANALYSIS","stepCode":"MONITORING_SCOPE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21093/projects/carbonet-backend-metadata/process-runtime/generated/MONITORING_ANALYSIS/MONITORING_ANALYSIS__MONITORING_SCOPE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21093/var/test-evidence/process-package-tests/MONITORING_ANALYSIS__MONITORING_SCOPE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

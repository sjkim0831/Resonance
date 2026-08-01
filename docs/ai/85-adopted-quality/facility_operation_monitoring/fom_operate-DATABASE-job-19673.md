# Verified existing database adoption: FACILITY_OPERATION_MONITORING / FOM_OPERATE

- Job: 19673
- Job type: DATABASE
- Source commit: c75c870e9af3d50bc38d3382102422636b884ae3
- Requirement: 운전값·처리량·에너지·알람과 현장 조치를 기록한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"FACILITY_OPERATION_MONITORING","stepCode":"FOM_OPERATE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19673/projects/carbonet-backend-metadata/process-runtime/generated/FACILITY_OPERATION_MONITORING/FACILITY_OPERATION_MONITORING__FOM_OPERATE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19673/var/test-evidence/process-package-tests/FACILITY_OPERATION_MONITORING__FOM_OPERATE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

# Verified existing database adoption: METER_CALIBRATION_MANAGEMENT / MCM_REGISTER

- Job: 19688
- Job type: DATABASE
- Source commit: f9c0875bb9792fa46995925250922b2f23768951
- Requirement: 계측기 사양·범위·정확도·측정지점·MRV 용도를 등록한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"METER_CALIBRATION_MANAGEMENT","stepCode":"MCM_REGISTER","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19688/projects/carbonet-backend-metadata/process-runtime/generated/METER_CALIBRATION_MANAGEMENT/METER_CALIBRATION_MANAGEMENT__MCM_REGISTER.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19688/var/test-evidence/process-package-tests/METER_CALIBRATION_MANAGEMENT__MCM_REGISTER.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

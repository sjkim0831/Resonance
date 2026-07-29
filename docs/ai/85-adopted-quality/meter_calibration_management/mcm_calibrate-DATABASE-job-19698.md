# Verified existing database adoption: METER_CALIBRATION_MANAGEMENT / MCM_CALIBRATE

- Job: 19698
- Job type: DATABASE
- Source commit: f9c0875bb9792fa46995925250922b2f23768951
- Requirement: 표준기 소급성·교정성적서·전후 오차·보정값을 기록한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"METER_CALIBRATION_MANAGEMENT","stepCode":"MCM_CALIBRATE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19698/projects/carbonet-backend-metadata/process-runtime/generated/METER_CALIBRATION_MANAGEMENT/METER_CALIBRATION_MANAGEMENT__MCM_CALIBRATE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19698/var/test-evidence/process-package-tests/METER_CALIBRATION_MANAGEMENT__MCM_CALIBRATE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

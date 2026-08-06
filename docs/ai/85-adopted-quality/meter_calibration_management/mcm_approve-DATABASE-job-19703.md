# Verified existing database adoption: METER_CALIBRATION_MANAGEMENT / MCM_APPROVE

- Job: 19703
- Job type: DATABASE
- Source commit: 01de89ab99ef01cbeabed344e61fba66b58d4ccc
- Requirement: 측정불확도와 사용 가능 기간 및 영향 데이터를 승인한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"METER_CALIBRATION_MANAGEMENT","stepCode":"MCM_APPROVE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19703/projects/carbonet-backend-metadata/process-runtime/generated/METER_CALIBRATION_MANAGEMENT/METER_CALIBRATION_MANAGEMENT__MCM_APPROVE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19703/var/test-evidence/process-package-tests/METER_CALIBRATION_MANAGEMENT__MCM_APPROVE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

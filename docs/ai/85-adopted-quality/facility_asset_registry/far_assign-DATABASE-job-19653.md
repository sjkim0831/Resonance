# Verified existing database adoption: FACILITY_ASSET_REGISTRY / FAR_ASSIGN

- Job: 19653
- Job type: DATABASE
- Source commit: 8d9f845b833f2aff674fc92f6bfeef26fee4b8bc
- Requirement: 운영·정비 책임자, 인허가, 검사·정비주기를 연결한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"FACILITY_ASSET_REGISTRY","stepCode":"FAR_ASSIGN","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19653/projects/carbonet-backend-metadata/process-runtime/generated/FACILITY_ASSET_REGISTRY/FACILITY_ASSET_REGISTRY__FAR_ASSIGN.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19653/var/test-evidence/process-package-tests/FACILITY_ASSET_REGISTRY__FAR_ASSIGN.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

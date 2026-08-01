# Verified existing database adoption: FACILITY_ASSET_REGISTRY / FAR_REGISTER

- Job: 19643
- Job type: DATABASE
- Source commit: 60c9ead208384d810cf8027257b9c041be631949
- Requirement: 설비 식별자·공정·위치·사양·용량·위험등급을 등록한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"FACILITY_ASSET_REGISTRY","stepCode":"FAR_REGISTER","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-19643/projects/carbonet-backend-metadata/process-runtime/generated/FACILITY_ASSET_REGISTRY/FACILITY_ASSET_REGISTRY__FAR_REGISTER.json","evidence":"/opt/Resonance/var/ai-worktrees/job-19643/var/test-evidence/process-package-tests/FACILITY_ASSET_REGISTRY__FAR_REGISTER.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

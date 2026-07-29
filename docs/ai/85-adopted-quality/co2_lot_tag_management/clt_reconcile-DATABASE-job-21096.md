# Verified existing database adoption: CO2_LOT_TAG_MANAGEMENT / CLT_RECONCILE

- Job: 21096
- Job type: DATABASE
- Source commit: bbab11f9c82cd4f75a68eae0b4eb5af4003405fe
- Requirement: 분할·병합·이동·인수·거래·취소량을 로트 원장에 반영한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CO2_LOT_TAG_MANAGEMENT","stepCode":"CLT_RECONCILE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21096/projects/carbonet-backend-metadata/process-runtime/generated/CO2_LOT_TAG_MANAGEMENT/CO2_LOT_TAG_MANAGEMENT__CLT_RECONCILE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21096/var/test-evidence/process-package-tests/CO2_LOT_TAG_MANAGEMENT__CLT_RECONCILE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

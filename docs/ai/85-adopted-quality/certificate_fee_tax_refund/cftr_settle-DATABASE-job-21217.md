# Verified existing database adoption: CERTIFICATE_FEE_TAX_REFUND / CFTR_SETTLE

- Job: 21217
- Job type: DATABASE
- Source commit: 19c31d4ded8e5b6d2fb6e084d6cc5f174f7cf7f7
- Requirement: 입금과 청구를 대사하고 승인 후 세금계산서·정산 이력을 확정한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATE_FEE_TAX_REFUND","stepCode":"CFTR_SETTLE","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21217/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATE_FEE_TAX_REFUND/CERTIFICATE_FEE_TAX_REFUND__CFTR_SETTLE.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21217/var/test-evidence/process-package-tests/CERTIFICATE_FEE_TAX_REFUND__CFTR_SETTLE.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

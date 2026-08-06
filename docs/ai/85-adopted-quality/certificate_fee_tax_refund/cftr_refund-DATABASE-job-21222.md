# Verified existing database adoption: CERTIFICATE_FEE_TAX_REFUND / CFTR_REFUND

- Job: 21222
- Job type: DATABASE
- Source commit: e7049cc4e01ec64a6de3217eeb07cb7eef83d6b2
- Requirement: 법인 환불계좌와 사유·원거래·승인을 검증해 환불한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATE_FEE_TAX_REFUND","stepCode":"CFTR_REFUND","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21222/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATE_FEE_TAX_REFUND/CERTIFICATE_FEE_TAX_REFUND__CFTR_REFUND.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21222/var/test-evidence/process-package-tests/CERTIFICATE_FEE_TAX_REFUND__CFTR_REFUND.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

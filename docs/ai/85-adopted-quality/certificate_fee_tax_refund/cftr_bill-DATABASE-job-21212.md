# Verified existing database adoption: CERTIFICATE_FEE_TAX_REFUND / CFTR_BILL

- Job: 21212
- Job type: DATABASE
- Source commit: 12bf3c4a7c15be3f09a684341d48d34b7d1e87c5
- Requirement: 인증 종류·물량·요율로 수수료와 세금계산서 발행정보를 생성한다.
- Validation result: {"strategy":"APPROVED_FULL_STACK_PACKAGE","processCode":"CERTIFICATE_FEE_TAX_REFUND","stepCode":"CFTR_BILL","dimension":"DATABASE","package":"/opt/Resonance/var/ai-worktrees/job-21212/projects/carbonet-backend-metadata/process-runtime/generated/CERTIFICATE_FEE_TAX_REFUND/CERTIFICATE_FEE_TAX_REFUND__CFTR_BILL.json","evidence":"/opt/Resonance/var/ai-worktrees/job-21212/var/test-evidence/process-package-tests/CERTIFICATE_FEE_TAX_REFUND__CFTR_BILL.json","status":"PASSED"}

The deterministic validator checked the exact versioned migrations, all required live PostgreSQL relations, index coverage, Flyway failures, and unvalidated emission foreign keys. This evidence adopts existing implementation only; any failed check leaves the job incomplete.

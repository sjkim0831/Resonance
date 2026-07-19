# Verified existing server adoption: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 310
- Job type: BACKEND
- Source commit: ddc27df6f3bf1f8226f0a33bd486154432592641
- Requirement: 검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE","methods":4,"routes":3,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

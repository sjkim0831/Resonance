# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 309
- Job type: API
- Source commit: e71b8c78bc17f28717e5cdb8b5ec909658dab59f
- Requirement: 검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE","methods":4,"routes":3,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

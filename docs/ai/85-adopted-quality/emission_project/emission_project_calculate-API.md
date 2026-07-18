# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 285
- Job type: API
- Source commit: e71b8c78bc17f28717e5cdb8b5ec909658dab59f
- Requirement: 승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","methods":2,"routes":1,"tests":1,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

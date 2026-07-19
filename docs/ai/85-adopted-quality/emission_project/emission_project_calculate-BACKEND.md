# Verified existing server adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 286
- Job type: BACKEND
- Source commit: ddc27df6f3bf1f8226f0a33bd486154432592641
- Requirement: 승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","methods":2,"routes":1,"tests":1,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

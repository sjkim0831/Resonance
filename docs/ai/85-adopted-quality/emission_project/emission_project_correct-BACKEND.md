# Verified existing server adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 302
- Job type: BACKEND
- Source commit: ddc27df6f3bf1f8226f0a33bd486154432592641
- Requirement: 검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","methods":4,"routes":4,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

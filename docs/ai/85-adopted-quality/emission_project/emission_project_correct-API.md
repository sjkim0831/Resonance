# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 301
- Job type: API
- Source commit: e71b8c78bc17f28717e5cdb8b5ec909658dab59f
- Requirement: 검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","methods":4,"routes":4,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

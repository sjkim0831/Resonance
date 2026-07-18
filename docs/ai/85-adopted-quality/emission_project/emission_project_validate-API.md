# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

- Job: 293
- Job type: API
- Source commit: 894359a84e2158c08cc4663e4409fbbfc457823d
- Requirement: 입력·산정·증빙의 완전성, 정확성, 일관성과 이상치를 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_VALIDATE","methods":3,"routes":2,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

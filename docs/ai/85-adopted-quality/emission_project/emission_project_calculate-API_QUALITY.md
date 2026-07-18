# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 660
- Job type: API_QUALITY
- Source commit: 196c0cf74ee4b611e71a1dd2f9b4ca88ba5084ad
- Requirement: 입출력 계약, 액터 권한, 멱등성, 트랜잭션과 오류 응답을 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","methods":2,"routes":1,"tests":1,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

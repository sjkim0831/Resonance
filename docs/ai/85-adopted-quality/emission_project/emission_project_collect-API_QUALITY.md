# Verified existing server adoption: EMISSION_PROJECT / EMISSION_PROJECT_COLLECT

- Job: 642
- Job type: API_QUALITY
- Source commit: 44c5ae1b4dc46c7e05bc839575e11ad4bb03e683
- Requirement: 입출력 계약, 액터 권한, 멱등성, 트랜잭션과 오류 응답을 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_COLLECT","methods":6,"routes":3,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing server contract leaves the job incomplete.

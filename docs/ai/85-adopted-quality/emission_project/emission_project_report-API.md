# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 317
- Job type: API
- Source commit: 894359a84e2158c08cc4663e4409fbbfc457823d
- Requirement: 승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","methods":5,"routes":4,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

# Verified existing API adoption: EMISSION_PROJECT / EMISSION_PROJECT_SETUP

- Job: 269
- Job type: API
- Source commit: 894359a84e2158c08cc4663e4409fbbfc457823d
- Requirement: 프로젝트 범위, 조직 경계, 담당 액터, 일정과 책임을 확정한다.
- Validation result: {"handled":true,"strategy":"EXACT_API_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_SETUP","methods":6,"routes":3,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the step-specific controller routes, service methods, executable SQL tests, tenant boundary evidence, and a healthy live emission workflow. A missing contract leaves the job incomplete.

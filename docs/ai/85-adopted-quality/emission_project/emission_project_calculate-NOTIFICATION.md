# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 289
- Source commit: 61222930fd8de20d987b0943f8a8de929f6ffca8
- Requirement: 승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.
- Validation result: {"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","events":1,"readers":2,"tests":1,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.

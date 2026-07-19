# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 313
- Source commit: 61222930fd8de20d987b0943f8a8de929f6ffca8
- Requirement: 검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.
- Validation result: {"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE","events":3,"readers":2,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.

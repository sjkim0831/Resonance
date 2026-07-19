# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 321
- Source commit: a510dbe52f896207cf0d0c66729e0f060324125c
- Requirement: 승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.
- Validation result: {"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","events":3,"readers":2,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.

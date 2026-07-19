# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_SETUP

- Job: 273
- Source commit: a510dbe52f896207cf0d0c66729e0f060324125c
- Requirement: 프로젝트 범위, 조직 경계, 담당 액터, 일정과 책임을 확정한다.
- Validation result: {"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_SETUP","events":1,"readers":2,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.

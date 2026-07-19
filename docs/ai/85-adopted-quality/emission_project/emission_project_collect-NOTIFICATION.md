# Verified existing in-app notification adoption: EMISSION_PROJECT / EMISSION_PROJECT_COLLECT

- Job: 281
- Source commit: acf3245f6ca63f066fce823f4d435c55baaaf40c
- Requirement: 산정에 필요한 활동자료와 원본 증빙을 책임자별로 수집하고 품질을 관리한다.
- Validation result: {"handled":true,"strategy":"EXACT_IN_APP_NOTIFICATION_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_COLLECT","events":3,"readers":2,"tests":2,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires persisted step-specific workflow events, authenticated user-facing readers, executable workflow tests, and a healthy live project workflow. Missing event or reader contracts leave this job incomplete.

# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_VALIDATE

- Job: 682
- Job type: ACTOR_TEST
- Source commit: 46346c6504c7826a6002ff4346824483d1564dce
- Requirement: 액터가 선행 화면부터 후속 화면까지 프로세스 기대값을 충족하는지 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_VALIDATE","jobType":"ACTOR_TEST","executableTests":2,"runtime":"[activity-runtime] PASS project=PRJ-2026-AD5D0F api=6 protected=2 pages=7 p95=82ms replicas=2/2","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=95ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

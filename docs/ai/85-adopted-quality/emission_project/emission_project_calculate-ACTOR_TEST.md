# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 664
- Job type: ACTOR_TEST
- Source commit: b033c1f32e091bd8edd4b58955b697652f45be6e
- Requirement: 액터가 선행 화면부터 후속 화면까지 프로세스 기대값을 충족하는지 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","jobType":"ACTOR_TEST","executableTests":1,"runtime":"[calculation-runtime] PASS project=PRJ-2026-001 api=5 protected=2 pages=8 formula=reconciled p95=133ms replicas=2/2 commit=b033c1f32e091bd8edd4b58955b697652f45be6e","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=83ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

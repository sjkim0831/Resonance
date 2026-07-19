# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 306
- Job type: TEST
- Source commit: b033c1f32e091bd8edd4b58955b697652f45be6e
- Requirement: 검증 결과의 보완 요청을 처리하고 영향 범위를 재산정·재검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","jobType":"TEST","executableTests":2,"runtime":"[activity-runtime] PASS project=PRJ-2026-AD5D0F api=6 protected=2 pages=7 p95=134ms replicas=2/2","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=48ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

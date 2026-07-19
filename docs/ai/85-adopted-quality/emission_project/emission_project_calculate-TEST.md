# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 290
- Job type: TEST
- Source commit: a1fbd7b55438cdff5d00d7cf0edf2d93990976b1
- Requirement: 승인된 배출계수와 단위 환산 규칙으로 재현 가능한 배출량을 산정한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","jobType":"TEST","executableTests":1,"runtime":"[calculation-runtime] PASS project=PRJ-2026-001 api=5 protected=2 pages=8 formula=reconciled p95=161ms replicas=2/2 commit=a1fbd7b55438cdff5d00d7cf0edf2d93990976b1","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=103ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

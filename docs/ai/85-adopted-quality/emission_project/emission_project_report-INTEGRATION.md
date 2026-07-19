# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 323
- Job type: INTEGRATION
- Source commit: 444cbdd7681cae6930a4a4b1402a156a797b4469
- Requirement: 승인된 결과로 검증 가능한 보고서를 생성·제출·발급한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","jobType":"INTEGRATION","executableTests":2,"runtime":"[report-runtime] PASS project=PRJ-2026-001 report=2 certificate=CER-2026-7A47B8CF-984 authenticatedApi=3 publicValid=1 publicInvalid=1 protected=2 pages=7 integrityHash=64 p95=52ms replicas=2/2","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=82ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

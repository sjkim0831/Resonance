# Verified actor journey adoption: EMISSION_PROJECT / EMISSION_PROJECT_APPROVE

- Job: 315
- Job type: INTEGRATION
- Source commit: 46346c6504c7826a6002ff4346824483d1564dce
- Requirement: 검토자와 승인자가 확정 결과를 독립적으로 검토하고 승인한다.
- Validation result: {"handled":true,"strategy":"EXACT_ACTOR_JOURNEY_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_APPROVE","jobType":"INTEGRATION","executableTests":2,"runtime":"[report-runtime] PASS project=PRJ-2026-001 report=2 certificate=CER-2026-7A47B8CF-984 authenticatedApi=3 publicValid=1 publicInvalid=1 protected=2 pages=7 integrityHash=64 p95=128ms replicas=2/2","workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0","customerJourney":"[customer-journey] PASS project=PRJ-2026-001 actors=6 tasks=6/6 api=7 protected=4 pages=11 certificate=valid formula=reconciled p95=70ms replicas=2/2"}

The deterministic validator requires executable SQL scenarios, authenticated and protected APIs, actor and tenant isolation, linked user/admin pages, state transitions, runtime p95 evidence, and two ready replicas.

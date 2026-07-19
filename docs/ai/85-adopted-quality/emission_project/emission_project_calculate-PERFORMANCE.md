# Verified runtime performance adoption: EMISSION_PROJECT / EMISSION_PROJECT_CALCULATE

- Job: 662
- Source commit: 8a90b4c9edb3bfb5d68fb80282a3f7c69dc367b3
- Requirement: 변경 전후 빌드 시간과 검색 응답 시간 및 회귀 여부를 기록한다.
- Validation result: {"handled":true,"strategy":"EXACT_RUNTIME_PERFORMANCE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CALCULATE","incrementalBuild":true,"searchP95Millis":30,"readyReplicas":2,"runtime":"[calculation-runtime] PASS project=PRJ-2026-001 api=5 protected=2 pages=8 formula=reconciled p95=274ms replicas=2/2 commit=8a90b4c9edb3bfb5d68fb80282a3f7c69dc367b3"}

The deterministic validator requires incremental-build controls, a recent successful deployment, the step-specific end-to-end runtime gate, two ready replicas, and measured integrated-search p95 latency.

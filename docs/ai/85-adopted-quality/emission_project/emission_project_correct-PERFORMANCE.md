# Verified runtime performance adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 698
- Source commit: 1bc45d1c359c6e895a3f105c806964ae4aa76afd
- Requirement: 변경 전후 빌드 시간과 검색 응답 시간 및 회귀 여부를 기록한다.
- Validation result: {"handled":true,"strategy":"EXACT_RUNTIME_PERFORMANCE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","incrementalBuild":true,"searchP95Millis":11,"readyReplicas":2,"runtime":"[activity-runtime] PASS project=PRJ-2026-AD5D0F api=6 protected=2 pages=7 p95=259ms replicas=2/2"}

The deterministic validator requires incremental-build controls, a recent successful deployment, the step-specific end-to-end runtime gate, two ready replicas, and measured integrated-search p95 latency.

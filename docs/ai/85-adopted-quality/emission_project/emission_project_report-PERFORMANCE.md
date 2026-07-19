# Verified runtime performance adoption: EMISSION_PROJECT / EMISSION_PROJECT_REPORT

- Job: 734
- Source commit: 8a90b4c9edb3bfb5d68fb80282a3f7c69dc367b3
- Requirement: 변경 전후 빌드 시간과 검색 응답 시간 및 회귀 여부를 기록한다.
- Validation result: {"handled":true,"strategy":"EXACT_RUNTIME_PERFORMANCE_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_REPORT","incrementalBuild":true,"searchP95Millis":107,"readyReplicas":2,"runtime":"[report-runtime] PASS project=PRJ-2026-001 report=2 certificate=CER-2026-7A47B8CF-984 authenticatedApi=3 publicValid=1 publicInvalid=1 protected=2 pages=7 integrityHash=64 p95=54ms replicas=2/2"}

The deterministic validator requires incremental-build controls, a recent successful deployment, the step-specific end-to-end runtime gate, two ready replicas, and measured integrated-search p95 latency.

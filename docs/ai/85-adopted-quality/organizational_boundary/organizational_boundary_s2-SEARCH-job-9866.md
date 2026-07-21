# Verified integrated search adoption: ORGANIZATIONAL_BOUNDARY / ORGANIZATIONAL_BOUNDARY_S2

- Job: 9866
- Source commit: 631c506551cf4947c8d861d655c9742406569959
- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_INTEGRATED_SEARCH_ADOPTION","process":"ORGANIZATIONAL_BOUNDARY","step":"ORGANIZATIONAL_BOUNDARY_S2","indexedRoute":"/emission/organizational-boundary","scopes":["menu","work","post"],"liveStatus":200,"workflow":"runtime-evidence:/opt/Resonance/var/test-evidence/process-runtime-smoke/20260721T013116Z.json"}

The deterministic validator requires the DB-backed menu, work, and post scopes, list/detail navigation, the exact process route in the generated route index, and a healthy live search page.

# Verified integrated search adoption: EMISSION_PROJECT / EMISSION_PROJECT_CORRECT

- Job: 695
- Source commit: 1bc45d1c359c6e895a3f105c806964ae4aa76afd
- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.
- Validation result: {"handled":true,"strategy":"EXACT_INTEGRATED_SEARCH_ADOPTION","process":"EMISSION_PROJECT","step":"EMISSION_PROJECT_CORRECT","indexedRoute":"/emission/data_input","scopes":["menu","work","post"],"liveStatus":200,"workflow":"[emission-workflow] PASS projects=7 ready=7 invalid=0"}

The deterministic validator requires the DB-backed menu, work, and post scopes, list/detail navigation, the exact process route in the generated route index, and a healthy live search page.

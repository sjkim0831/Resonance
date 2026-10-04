# P006 생산망 3공장 Pilot 설계·검증

검증일: 2026-09-23. 정본: 기존 Factory Composer `factory_layout` 저장 API와 공장별 USD Stage. 실제 제품 제조 공정이 아니라 **FUNCTIONAL_DEMO**이다.

## 원씽

공장 내부 레이아웃을 복제하지 않고 `layoutId + version`으로 참조하며, 생산망 지도 좌표와 공장 내부 설비 좌표를 분리한다. 생산·운송·BOM·조립·검사·출고 상태도 USD Geometry가 아니라 별도 실행 문서로 저장한다.

## 현재 근거와 제품 선정

| 후보 | 부품·BOM | 설비 후보 | 현재 가능한 것 | 미확인 |
|---|---|---|---|---|
| 2부품 나사 체결 시연 | DEMO_PART_A 1 + DEMO_PART_B 1 | A: E001, E034 / B: A410, E034 / C: A203, E122, E053 | 두 부품 생산 완료 이벤트, 출고·운송·입고, BOM 대기, 조립 완료·검사·출고 이벤트 | 실제 부품/완제품 모델, 원본 BOM, E122 실제 가동부/축/피벗, 체결·검사 기준, 공장 간 이송 장치 |
| 선재 하니스 조립 후보 | 미확정 | A195, A203, E053 | 설비 후보 표시 | 케이블·커넥터 원본, 배선 도면, BOM, 가동부 근거 |
| 주조품 트리밍·검사 후보 | 미확정 | E001, E034, E053 | 단일 부품 공정 후보 표시 | 트리밍 전후 작업물 형상, 실제 절삭 동작, 검사 기준 |

첫 후보를 선택한 이유는 부품 2종의 합류·BOM Gate를 데이터 상태로 검증할 수 있기 때문이다. 이 선택은 E001에서 부품 A를 실제 가공한다거나 E122가 해당 제품을 체결한다는 승인·증명이 아니다. 제조사·제품 규격·정확한 가공 시간은 미확인이다. 가동부 애니메이션을 추가하지 않았다.

## 요구사항 → 설계 → 코드 → 검증

| 요구사항 | 설계·저장 필드 | 코드 | 검증 |
|---|---|---|---|
| 공장 3개 참조 | `networkDesign.factories[].layoutId/layoutVersion/factoryInstanceId/mapPosition` | `production-network-core.js`, `composer_api.py` | 실제 DB GET, 새로고침, 공장 3/3 |
| 지도·진입·복귀 | 생산망 `camera`, factory 내부 `instances[].position`; Composer `returnNetwork` | `production-network.js`, `composer.html` | 지도 이동 후 내부 transform 불변, 복귀 링크 |
| 생산·운송·BOM·조립 | `networkRuntime.events/inventory/workpieces/processedEventIds` | `production-network-core.js` | 9이벤트, 완제품 1, Lot 3, BOM 부족/중복 이벤트 Gate |
| 설계와 실행 분리 | 생산망 설계 문서와 별도의 실행 문서 | `production-network.js`, `composer_api.py` | 설계·실행 DB 저장/복원 각각 PASS |
| 공장별 USD 참조 | `networkDesign.stageRefs`와 `ProductionNetwork.usda` Reference | `stage_api.py`, `network_usd_api.py` | USD Open, 3/3 Factory Prim, 참조 경로·transform 일치 |
| 증거 경계 | `FUNCTIONAL_DEMO`, 기계 동작 미검증 | 화면 후보/상태/도움말 | 실제 공정/애니메이션으로 승격 0 |

## 데이터·좌표·이벤트 인터페이스

Production Network 설계는 기존 `/composer/layouts` 문서의 `settings.networkDesign` 안에 저장한다. 공장 내부 문서는 독립 `factory_layout`로 유지한다. 실행 상태는 다른 레이아웃 문서의 `settings.networkRuntime`에 저장하며 `networkId`로 설계를 참조한다. 이 구조는 기존 DB/API를 재사용한 Pilot이며 전용 production-network 테이블이나 대량 실행 이벤트 로그로 승격한 것은 아니다.

좌표는 미터·Y-up. `mapPosition`은 상위 Stage의 공장 Xform만 이동한다. 내부 `canvas_instance` 좌표/회전/Scale은 바뀌지 않는다. 참조 버전이 변경되면 화면에 `갱신 필요`로 표시하고 자동 덮어쓰지 않는다.

순서: `PRODUCE_A → PRODUCE_B → SHIP_A → RECEIVE_A → SHIP_B → RECEIVE_B → ASSEMBLE → INSPECT_PASS → DISPATCH`. `ASSEMBLE`은 부품 A/B 각각 1개와 stationReady가 필요하다. 시연의 자동 단계는 stationReady를 `DEMO_ASSUMPTION`으로만 넣으며 실제 설비 가용성 검증이 아니다. 이벤트 ID는 `runId:type`이며 이미 처리한 ID의 재실행은 `DUPLICATE_EVENT`로 거절한다. 순서 위반은 `PROCESS_ORDER_BLOCKED`로 거절한다. C 입고 버퍼 기본값 2는 시연용 설정이며 실제 용량 근거가 아니다. Lot ID, 위치, 상태, 검사 상태, 구성 부품 Lot을 별도 보존한다. `DEMO_PASS`는 검사 알고리즘의 실제 합격 판정이 아니다.

공장별 `Factory.usda`는 독립 유지한다. 상위 `ProductionNetwork.usda`는 각 Stage를 상대 경로로 참조하고 지도 배치를 Xform에 쓴다. USD는 공간 구성 검증이고 이벤트 실행 증거가 아니다.

## 실제 QA 결과

| Gate | 결과 |
|---|---|
| 선행 v6 E001+E034+E075 저장·새로고침 | PASS, 9/9 Instance transform 및 세트 Metadata 일치, 관계 상태 허위 승격 0 |
| Factory A/B/C 개별 DB 저장 | PASS, 각 2/2/3 설비 Instance |
| Network 3공장/2경로 DB 저장·새로고침 | PASS |
| 9개 이벤트 실행, BOM 충족 후 조립, 완제품 1 | PASS, FUNCTIONAL_DEMO |
| 작업물 Lot 3개, 실행 상태 새로고침 | PASS |
| 지도 공장 이동 후 공장 내부 transform | 3/3 불변 |
| 일시정지·초기화 | PASS |
| BOM 부족·순서 위반·중복 이벤트·버퍼 초과·설비 비가용 | 로컬 실행 코어 20개 assertion PASS; 실제 운영 장애 주입은 미실시 |
| USD 내보내기 버튼과 Stage 3개 | PASS |
| USD 라이브러리 Stage Open/참조·transform | 3/3 PASS |
| 기계 실제 연속 애니메이션 | NOT_VERIFIED |
| 실제 부품/완제품 모델과 제조사 BOM | NOT_AVAILABLE |
| 100개 간략 공장 노드 지도 부하 | 헤드리스 Chromium 1700×1000: 저장 지도 로드 565.4 ms, 약 60.9 FPS, JS Heap 5,274,257 B, 리소스 전송 추정 202,998 B. 100개 실제 공정은 0건 |
| 장애 복구, 충돌, 물류 장치/높이 | NOT_VERIFIED |

테스트 계정은 실제 P006 프로젝트 관리자 로그인 세션이며 임의 세션을 사용하지 않았다. 사용 계정 식별자는 결과물에 노출하지 않았다. v6 QA와 생산망 QA는 별도 테스트 레이아웃을 만들었고 기존 사용자 레이아웃을 수정하지 않았다. Pilot QA의 브라우저 단계 실행 7.96초. 공장 3개 Stage 생성·상위 조합은 측정된 명령 구간 약 7.6초이다. 이번 전체 작업의 시작·종료 계측은 별도로 기록되지 않아 총 소요 시간을 단정하지 않는다.

4개 USD 출력 디렉터리의 합계는 53,173바이트이며 새 생산망 정적 웹 파일 40,144바이트다. 이 값은 DB 행·기존 원본 GLB·작업 중 백업을 제외한다. 기존 로컬 서버·자산·라이브러리를 사용했고 확인된 신규 라이선스/외부 API 비용은 0원이다. 운영 저장소/CPU 비용은 별도 계측 대상이다.

## QA·도움말·다음 업무 카드

현재 UI의 우측 `업무 길잡이 · 화면 설계 · QA · 다음 업무`에 3공장 선택 → 설계 저장 → 기능 시연 → 근거 확보 절차를 표시한다. 다음 바위는 실제 완제품/부품 A/B 도면·BOM 1세트를 입수하고, E122 가동부·체결 작업물 Anchor·높이·검사 기준을 제품 자료와 Geometry로 연결하는 것이다. 이 Gate 전에는 현재 시연을 실제 조립 애니메이션으로 표시하지 않는다.

# P006 주조 셀 물리 E2E 검증

2026-09-10. 판정: 물리 E2E 미완료. 신규 자산0. 장비 명령 송신0. Kit/DB/웹 서비스 재시작0(구조 검사 전용 별도 Kit 프로세스만 실행 후 종료).

## 실제 조사

현재 데이터 공정이 사용하는 PostgreSQL woosu_digital_twin(127.0.0.1:35433)에 PLC profile, tag registry, tag reading 테이블이 없다. 이는 다른 서버나 현장에 PLC가 없다는 뜻은 아니다. 확인한 현재 경로에서 검증된 접속 설정을 찾지 못했다.

기존 telemetry_collector.py는 FILE/REST 지표를 읽으며 명시적 설비 상태가 없으면 집계 지표로 RUNNING 등을 추정한다. plc_tag_store.py는 지표로 온도/압력/사이클 값을 산출하여 GOOD으로 기록하는 경로가 있다. 따라서 source_name이나 GOOD만으로 실제 PLC 신호라고 인정하지 않는다. 남은 상태 파일의 source는 P006 MES DEMO SIMULATOR이고 마지막 확인은 2026-09-07이다. 장비 신호로 재사용하지 않았다. 기존 수집기는 변경하지 않았다.

## 구조

E001, E012, E013, E014, E015, E016, E123 USD 7개를 pxr로 실제 열었다. 각 파일의 합성 오류0. 관절/강체/충돌체/시간 샘플/검사한 제어·입출력 관계 모두0. 파일별 변환과 AABB는 casting-structure-result.json에 기록했다. 체결점·공동 조립 좌표가 없어 실제 하나의 작동 셀이라고 승인하지 않았다. 전체 렌더/충돌/기계적 안전 검사는 하지 않았다.

## 구현

- casting-physical-contract.json: 10개 물리 구성요소 상태, 14개 논리 신호, OPC UA/Modbus 주소 필드, 출처 모드, 체인 완료 근거. 미확정 주소는 null, UNBOUND. 임의 주소를 실제 매핑이라고 만들지 않았다.
- casting_signal_contract.py: 서버 어댑터 모드와 신호 출처, 작업물/설비/명령 식별자, 수신 신선도, 순서, 품질, 값 타입, 시작/완료 순서 및 모의 인터록을 검증하는 경계 함수. REAL은 명시 거부. 실제 OPC/Modbus 클라이언트 및 실시간 수집 연결은 아직 없다. 일반 통신 비트를 안전 PLC의 안전 기능으로 대체하지 않는다.
- casting_store.py: 새 이벤트에 DB/SIMULATED 신호/물리 미검증/USD 미반영/RTX 미관측의 증거 필드를 저장. 과거 이벤트에 증거를 소급하지 않았다. 이 변경은 기존 시뮬레이터 시작/완료를 실제 신호로 대체한 것이 아니다.
- casting.html: 데이터 완료와 물리 완료 차이를 직접 표시하고 검증 페이지 연결.
- casting-physical.html: 전체 상태·구조·매핑·시험·필요 입력을 한 페이지로 제공.

## 검증

계약 fixture 19건 PASS: MOCK/SIMULATED 수락, REAL 및 위장 REAL 차단, 잘못된 command/workpiece/equipment 차단, 중복 순서/오래된 수신/미래 수신 차단, BAD/UNCERTAIN 차단, 미확인/열린 가드 차단, 시작 전 완료 차단, 값 타입/미등록 태그 차단, 목적지 감지 없는 인계 차단. MOCK 시험은 물리 증거가 아니다.

배포 후 기존 계정으로 API 합격/재작업/폐기 3경로를 다시 실행했다. job 1077e23b-1942-4faa-a81b-199f349e7ccf(10이력), 5d445781-1d20-45e5-ac39-cb186e5c0d3b(15이력), 775e59f8-f686-4c84-a1d3-fdb263c4d97f(10이력). 전체35개 이벤트에 분리된 증거가 저장되고 재조회되는 것을 확인했다. 각 이벤트의 신호는 SIMULATED, USD NOT_APPLIED, RTX NOT_OBSERVED다.

공개 증거 페이지 HTTP200, 표6개, 미완료 표시, JS오류0 확인 및 casting-physical-qa.png 시각 검수. 초기 브라우저 테스트의 표 개수 예상5를 실제6으로 수정 후 통과. USD 스캔0.120초(Kit기동 제외), API 회귀3.152초. 전체 작업/배포 시간을 연속 계측하지 않아 임의 추정하지 않는다.

## 다음 바위: 실제 연결을 위한 입력 전체

1. 장비 모델, 실제 조립도/좌표, I/O 표.
2. OPC UA endpoint/NodeId/인증서 정책 또는 Modbus host/unitId/register map.
3. 읽기 전용 시험 접근과 담당자 확인.
4. START/RUNNING/DONE/투입·배출/인계 신호 및 command correlation 규칙.
5. 작업물 치수·질량·공정 조건·검사 규격.
6. 가드·비상정지·안전 인터록·에너지 격리 및 승인 기록.

위 정보가 없으므로 물리 체인 완료를 선언하지 않는다. 원씽은 검증된 주조 장비 신호 확보다. 그다음 실제 신호→상태→USD prim 좌표→목적지 감지→저장/복원을 동일 식별자로 증명해야 한다.

기술 근거: [OPC Foundation DataValue](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11), [Modbus 공식 규격](https://www.modbus.org/modbus-specifications). OPC UA 원시 값 변경 시각과 수집 신선도를 분리한다. Modbus transaction ID는 요청/응답 대응 식별자이며 공정 사이클 완료 자체가 아니다.

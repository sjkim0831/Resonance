# P006 실장비 연동 준비 — 설계·검증·인수 절차

2026-09-10. 목표: 물리 E2E PASS가 아니라 장비 자료 수령 후 읽기 검증을 단계적으로 진행할 준비. 신규 자산0, 장비 쓰기0, 실장비 접속0. 기존 DB 시뮬레이터 변경0.

## 1. 산출물과 상태

- physical.json: 기존 USD7개 역할/조립 판단, 물리 관계6개 영역, 이동·신호 발생 경로6구간, 필수 구조 부족5개 영역. 검증되지 않은 좌표·조인트·형상을 임의 생성하지 않았다.
- signals.json: 14개 신호에 logical name, 설비, 위치, P006 기준 IN/OUT, 분류, 자료형, 정상값, UTC시각, timeout, source, protocol/address/tag, sourceMode, bindingState를 정의했다.
- qualification.json: 서버에서 검증기로 계산하고 저장한 결과. 현재 UNBOUND14, 나머지0. UI에서 체크리스트를 체크해도 승격되지 않는다.
- gate.py / qualify.py: 장비 식별→읽기 접속→실제 태그→시각·샘플→값 변화→상관관계→반복·검토를 검증한다.
- read_adapter.py: 연결된 OPC UA/Modbus 클라이언트의 읽기만 호출하는 어댑터. 연결 생성·PKI 핀닝·장비 식별 수집·수집기 서명 발급은 담당 장비 정보로 현장 인수 시 구성해야 한다. 이 준비 패키지는 자동 장비 탐색이나 무인 연결 완성을 주장하지 않는다.
- handoff-checklist.md: 장비 담당자에게 전달할21개 자료 요청 항목. 웹 작성본은 브라우저 임시 저장이며 서버 제출이 아니다.

## 2. 두 상태 축

SIMULATED는 신호 출처다. BOUND는 주소 계약 상태다. 둘은 동시에 존재할 수 있다. 단계는 UNBOUND→BOUND→READ_ONLY_VERIFIED→REAL이며 REAL이어도 writeEnabled=false, productionControlEnabled=false, physicalE2E=false다. 실제 제어용 기존 casting_signal_contract.py의 REAL 차단을 해제하지 않았다.

BOUND는 장비 식별 필드와 읽기 전용 주소 형식이 채워졌다는 뜻이다. REAL 승격은 원시 응답 hash와 신뢰된 수집기 서명이 맞고, 해당 binding hash와 signal이 일치해야 한다. 장비/접속/태그가 verified이어야 하고 자료형·품질·시각 검증을 통과해야 READ_ONLY_VERIFIED다.

REAL은 실제 값 변화, 증가하는 샘플 순서, 최소3개 독립 사이클의 작업물·공정 이벤트와 샘플 연결, 담당 검토 승인, 정상값/timeout/반복기준의 현장 승인이 더 필요하다. 3회 및5초 신선도는 초기 프로젝트 검증 기준이며 안전 등급이나 장비 성능 보장이 아니다. 장비 특성에 맞는 기준 승인을 받는다. 안전 인터록은 승인된 정비/안전 시험 기록으로 확인하며 위험 상태를 인위적으로 유발하지 않는다.

주소 변경이나 증거 만료 후 기존 REAL 문자열을 신뢰하지 않고 다시 평가한다. 이 도구는 실행 시점의 자격 스냅샷을 생성하며 연속 감시 서비스가 아니다. 실시간 어댑터 연결 시 각 세션/설정 변경 및 증거 유효기간에 재평가하도록 통합해야 한다.

## 3. 증거 번들 계약

입력 evidence.json은 envelope 배열이다. envelope는 collectorId, payload, raw, signature를 가진다. signature는 payload의 UTF-8 정렬 JSON(canonical)의 HMAC-SHA256이며 raw의 SHA256을 payload.rawSha256과 비교한다.

payload 공통 필드: evidenceId, kind(identity/connection/tag/sample/correlation/review), signal, bindingHash, sourceMode=REAL_OBSERVATION, access=READ_ONLY, writeCalls=0, observedAt(UTC), rawSha256.

- identity: verified, deviceId, identityDocumentHash.
- connection: verified 및 읽기 연결 결과 원문(raw).
- tag: verified, dataType 및 태그 조회 원문(raw).
- sample: value, sequence, quality, receivedAt, timestampValidated. OPC UA는 sourceTimestamp를 보존; Modbus는 timestampOrigin=COLLECTOR로 표시.
- correlation: workpieceId, processEventId, cycleId, sampleEvidenceId, eventMeaning.
- review: reviewerId, approved.

서명은 출처·무결성 확인이지 장비 진위를 자동 증명하는 기술이 아니다. 현장 장비/시리얼·인증서·원문과 담당자 승인이 필요하다. HMAC 신뢰키는 현장 확인 후 관리자가 별도 안전 경로에 provision하며 root0600 또는 동등한 권한으로 관리한다. 웹에서 업로드하는 JSON에 키를 넣지 않는다. 현재 운영 신뢰키0, 실제 서명 수집기0이다. test_gate.py의 키·DEVICE는 시험 전용이며 운영에 등록하지 않는다.

## 4. 장비 정보 도착 후 절차

1. 체크리스트21항목 수령, 비밀은 별도 보안 채널로 수령한다.
2. physical.json의 체결 좌표/금형/투입·배출/작업물 경로를 담당자와 확인한다.
3. signals.json의 장비·읽기 주소·정상값·시간조건을 작성한다. 정상·시간·사이클 기준은 담당자 승인 후 siteApproved를 설정한다.
4. 검증기를 실행하여 BOUND까지만 확인한다. protocol은 OPC_UA 또는 MODBUS_TCP. Modbus는 FC01~04와0-based PDU주소만 허용한다. OUT은 명령을 보내지 않고 장비의 명령 미러 태그를 읽는다.
5. 승인된 읽기 전용 계정/정비 시간/수집 주기로 실제 클라이언트를 구성한다. OPC UA 서버 인증서를 핀닝하고 PLC 식별을 확인한다. Modbus는 장비 식별 표와 네트워크 경로·unitId를 교차 확인한다.
6. read_adapter.py로 원시 읽기를 수집하고 장비별 encoding/scale를 적용한다. 이 함수 자체는 신호를 REAL로 바꾸지 않는다. 별도 신뢰 수집기가 UTC시각·원문·메타데이터를 봉인한다.
7. qualify.py로 읽기 근거와 반복 관찰을 평가한다. 결과가 REAL이어도 쓰기는 활성화하지 않는다. 실패 이유 목록을 해결한 후 재평가한다.
8. 실제 신호와 DB 상태·USD prim·RTX 관측을 연결하는 후속 물리 E2E는 별도 인수 시험이다.

## 5. 실행·자동화

서버 실행 위치: /opt/Resonance/projects/P006/runtime/casting-readiness

```
python3 qualify.py --signals signals.json --output qualification.json
python3 qualify.py --signals signals.json --evidence evidence.json --trust /secure/collector-keys.json --output qualification.json
```

첫 명령은 증거 없이 현재 UNBOUND 상태를 검증한다. 두번째는 실제 수집기 증거를 준비한 후에만 사용한다. 결과는 임시 파일 fsync 후 atomic replace로 저장한다. 운영 서비스의 재시작·빌드는 필요하지 않았다.

화면 생성: build.cjs로 물리/I/O/체크리스트 설계를 출력하고 qualify.py로 상태를 계산한 다음 build-page.cjs로 한 페이지를 출력한다. 상태 배포 시 최신 qualification.json과 화면을 함께 재생성해야 한다. 관리 문서는 사람이 작성한 인수 근거를 함께 유지한다.

## 6. 테스트·시각 검수

23개 게이트 테스트 +3개 읽기 facade 테스트 =26개 PASS,0.026초. 서명 변조·원문 변조·잘못된 장비/태그 타입·접속 실패·BAD품질·시각 미확인·MOCK·쓰기 이력·쓰기 FC·주소 변경·증거 만료·반복 부족·상관관계 부족·검토/현장 승인 누락을 검사했다. 초기 fixture의 수신 지연이5초 기준을 초과해 실패했고 시험 시각을 수정했다. 실제 장비 기준을 느슨하게 바꾸지 않았다.

공개 URL에서 브라우저10개 검사 PASS,2.248초: 경로200,7개역할,14개계약,4개탭,21개체크리스트,작성본 재로드,21항목 JSON다운로드,쓰기금지값,390px 가로넘침없음,JS오류0. physical.png/io.png/checklist.png 시각 확인. UI 작성 테스트는 임시 브라우저에만 저장했으며 업무 DB 쓰기0.

현재 실제 확인된 것은 준비 계약·검증 코드·화면이다. 실제 프로토콜 통신·PKI·실장비 성능·기계 안전·USD 충돌·RTX 이동 시험은 미실시다. 전체 소요시간은 연속 계측하지 않아 임의 추정하지 않는다.

## 7. 원씽

담당자에게 체크리스트를 전달해 장비 I/O 원본과 읽기 전용 접속 정보를 받는다. 자산 수 확대가 아니라 해당 자료로 UNBOUND를 BOUND로 만드는 것이 다음 바위다.

참조: [OPC UA DataValue](https://reference.opcfoundation.org/specs/OPC-10000-4/7.11), [asyncua 읽기 API](https://opcua-asyncio.readthedocs.io/en/latest/api/asyncua.client.html), [Modbus 공식 규격](https://www.modbus.org/modbus-specifications), [PyModbus 읽기 API 예제](https://github.com/pymodbus-dev/pymodbus/blob/dev/examples/client_calls.py). 현재 어댑터 facade는 이 읽기 호출 인터페이스를 대상으로 시험했으며 현장 SDK 버전 고정과 통합은 인수 시 확인한다.

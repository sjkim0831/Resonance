# P006 724종 준비도 기준선

{
  "baseline": {
    "count": 724,
    "sha256": "bef76a59ca7050aebcc0e1924b583152b0ad73ba648a62eb2e261efd397ebc95",
    "candidateDiscovery": "PAUSED"
  },
  "counts": {
    "CATALOGED": 0,
    "USD_REQUIRED": 58,
    "USD_CREATED": 656,
    "DIMENSION_VERIFIED": 0,
    "FLOOR_ORIGIN_VERIFIED": 0,
    "PROCESS_CONNECTED": 0,
    "ASSET_READY": 10
  },
  "scope": "REFERENCE_LAYOUT"
}

## 판정 경계

- ASSET_READY는 이번 프로젝트 기준 설계 레이아웃 범위이며 실측 장비 복제/물리 시뮬레이션/안전 인증/REAL 승격이 아님.
- 작업물 이동은 SIMULATED_OPERATOR_TRANSFER_KINEMATIC이다. 자동 장비 시작/완료 신호가 아니다.
- 기존 USD 176개를 재열었지만 파일 존재만으로 승격하지 않았다. 신규 548종 전체 제작은 하지 않았다.
- 문·울타리·벽은 정적 배치 모델이다. 작동 관절·안전 기능 구현/검증은 별도.

## 상태

CATALOGED → USD_REQUIRED → USD_CREATED → DIMENSION_VERIFIED → FLOOR_ORIGIN_VERIFIED → PROCESS_CONNECTED → ASSET_READY

REAL 별도: UNBOUND → BOUND → READ_VERIFIED → REAL. 기존 실장비 게이트 READ_ONLY_VERIFIED와 표시명을 매핑하고 실제 연결은 하지 않음.

## 우선순위

1. 범용 사용: 20%
2. 공정 재사용: 15%
3. 배치 기준: 15%
4. 물류 연결: 15%
5. 공간/안전 영향: 10%
6. 제어 연결: 10%
7. 부모/기준: 5%
8. E2E 단절 영향: 10%

도메인 기본값에 항목별 역할 보정을 적용한 휴리스틱. 시장 빈도 실측이 아님. 핵심 세트는 점수 순번 대신 수동 조립 공정 의존성으로 선택.

## 재생성

readiness-design.json → build-readiness-usd.py → 구조/치수/바닥/공정 증거 → 시각 검수 → build-asset-readiness.cjs → registry.json/HTML. 근거 해시가 다르면 READY를 유지하지 않음.

## 자동 검사

1. PASS 724종 ID 및 기준선 해시 고정
2. PASS 724종 모두 8개 우선순위 기준
3. PASS 가중치 합 100
4. PASS 파일 존재만으로 READY 불가
5. PASS USD 변경 시 증거 무효화
6. PASS 기준 설계 변경 시 증거 무효화
7. PASS 필수 검증 누락 차단: type
8. PASS 필수 검증 누락 차단: dimensions
9. PASS 필수 검증 누락 차단: units
10. PASS 필수 검증 누락 차단: floorOrigin
11. PASS 필수 검증 누락 차단: orientation
12. PASS 필수 검증 누락 차단: workpieceIO
13. PASS 필수 검증 누락 차단: connectionPoints
14. PASS 필수 검증 누락 차단: hierarchy
15. PASS 필수 검증 누락 차단: process
16. PASS 필수 검증 누락 차단: sensorMotionStructure
17. PASS 필수 검증 누락 차단: logistics
18. PASS 필수 검증 누락 차단: visual
19. PASS 필수 검증 누락 차단: layout
20. PASS 724종 REAL 상태 UNBOUND
21. PASS 신호 없는 REAL 승격 거부
22. PASS 핵심 10종 및 13개 배치
23. PASS 3개 경로 SQLite 및 USD 저장 복원
24. PASS 작업물 19개 위치 상태 이벤트
25. PASS 핵심 10종 기준 레이아웃 READY

## 다음 바위

coverage666에서 자료 확보 666종 USD 연결. 남은58종은 자료 대기 BLOCKED. 다음 병목은 기준 모델의 종류·실측·기능·물리·공정 연결 검증이며 핵심10종 동작 보강과 REAL 연결은 별도.

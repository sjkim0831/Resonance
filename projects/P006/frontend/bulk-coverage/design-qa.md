# P006 724종 USD 공통화 설계 및 검증

기준일 2026-09-10T03:56:09.425Z

## 원씽

724개 ID를 유지하고 재사용 구조 단위로 USD 연결률을 높인다. 파일 수는 KPI가 아니다.

## KPI

{
  "baselineLinked": 176,
  "currentLinked": 372,
  "baselinePercent": 24.31,
  "currentPercent": 51.38,
  "coverageIncreasePoints": 27.07,
  "remainingUnlinked": 352,
  "baselineLayoutVerified": 10,
  "currentLayoutVerified": 206,
  "ready": 10,
  "readyPromotions": 0,
  "unbound": 724,
  "previousLinked": 196,
  "previousPercent": 27.07,
  "thisRunConnected": 176,
  "thisRunIncreasePoints": 24.31,
  "real": 0,
  "blocked": 58,
  "designRequired": 294,
  "sharedBases": 16,
  "variants": 73,
  "assetsPerBase": 11,
  "maxAssetsPerBase": 36,
  "standaloneReferenceModelingAvoided": 176,
  "functionalModelingAvoidedNotProven": true
}

## 제작 방법별 결과

[
  {
    "method": "MODIFY",
    "start": 213,
    "connected": 110,
    "remaining": 103
  },
  {
    "method": "COMPOSE",
    "start": 74,
    "connected": 66,
    "remaining": 8
  },
  {
    "method": "NEW_BASE",
    "start": 183,
    "connected": 0,
    "remaining": 183
  },
  {
    "method": "WAIT_DATA",
    "start": 58,
    "connected": 0,
    "remaining": 58
  }
]

## 자동화 경로

고정 기준선 → 528종 plan → 공통 베이스/파라미터/모듈/수정/신규 검토 → 13개 원본 구성요소 정규화 → 16개 구조 베이스/73 Variants → ID별 구성 연결 → 17개 독립 레이아웃 저장 복원 → RTX 렌더 → 724개 resolver/보고 화면 생성.

## 재생성

node plan-bulk-coverage.cjs → Kit Python build-bulk-usd.py → verify-package-bulk.py → render-bulk-coverage.py → node finalize-bulk-coverage.cjs → node build-asset-readiness.cjs. 입력 스냅샷 196개와 기준선 SHA를 고정하므로 반복 실행 시 숫자가 중복 증가하지 않는다.

## 검증 경계

- 구성 연결은 완제품 동등성/동작 보장이 아님
- 실측/핀맵/기능 미검증이며 READY/REAL 승격 금지
- 기존 수정/조합 분류 중 실제 기구를 표현할 수 없는 항목은 DESIGN_REQUIRED 유지
- 베이스 개수는 기본 Cube 수가 아니라 조립 구조 템플릿 수. Variant 수 별도 공개
- 이번 176종은 기준 크기의 구조 조합/배치 모델. 공정 실행·실측·제어 핀맵 미검증.
- 전체 연결 372종에는 품질 검증 전의 기존 모델이 포함됨. ASSET_READY는 기존 기준 레이아웃 10종뿐.
- 공장 스튜디오의 로그인·드래그·RTX 스트리밍 업무 E2E는 이번 검증에 포함되지 않음.
- 176종 독립 제작 회피는 배치용 외형 모델에 한정. 기능부 신규 설계가 필요 없다는 뜻이 아님.

모든 신규 모델: meter / Y-up / +X-forward / bbox bottom Y=0. 치수는 P006-BULK-REFERENCE-1 기준 설계값이며 실측이 아님. 입력/출력/장착 포트는 논리 앵커이며 실제 핀맵이 아니다. 상위 장착 모듈은 별도 mountPolicy=PARENT_ANCHOR. 정적 collider는 접촉 테스트나 작동 joint 검증을 의미하지 않는다.

## QA

1. PASS: 528개 전수 5단계 재사용 검토
2. PASS: 176개 연결 ID 중복 없음 및 계획 일치
3. PASS: 176개 USD 9개 검사 통과
4. PASS: 17개 레이아웃 저장 복원, AABB 중복 0
5. PASS: 자료 대기 58종 연결 금지
6. PASS: READY 및 REAL 신규 승격 0
7. PASS: 이동식 ZIP 176개 복원
8. PASS: 17개 독립 RTX 렌더 존재
9. PASS: 최종 724 = 연결 372 + 미연결 352

## 시간/용량

USD 생성 1.06초, 패키지 검증 0.19초, RTX 17장 14.55초. USD 1046676 bytes, ZIP 64367 bytes. 대화 중 분석/수정 시간과는 별도.

## 다음 바위

다음 바위: 미연결 수정 103종·조합 8종의 전용 기구/헤드 구조를 전체 비교하여 재사용 가능한 다음 베이스 선정. 신규 베이스 183종은 그 다음, 자료 대기 58종은 BLOCKED 유지.

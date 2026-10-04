# P006 724종 고정 / 666종 USD 연결

2026-09-10T04:21:20.648Z

## 원씽
294종을 개별 모델이 아닌 16구조 베이스/178 Variant로 연결. 기존16베이스를 검토하고7개를 실제 참조 재사용.

## 생성 흐름
coverage666-design.cjs → plan-coverage666.cjs → build-coverage666.py → verify-coverage666-all.py → render-coverage666.py → finalize-coverage666.cjs → 준비도 게이트/HTML.

## 검증
1. PASS 352종 전수 검토 및 고정 724 ID
2. PASS 수정103+조합8+신규183 =294
3. PASS 294 USD 단위 원점 재열기 9검사
4. PASS 19 레이아웃 저장복원 및 겹침0
5. PASS 666 현재 USD 재열기 및 형상 존재
6. PASS 58 BLOCKED 유지 및 READY/REAL 승격0
7. PASS 294 이동식 패키지 복원 및 해시
8. PASS 19 레이아웃+178 Variant RTX 캡처

## KPI
{
  "previousLinked": 372,
  "thisRunConnected": 294,
  "currentLinked": 666,
  "currentPercent": 91.99,
  "remainingUnlinked": 58,
  "blocked": 58,
  "ready": 10,
  "readyPromotions": 0,
  "real": 0,
  "newBases": 16,
  "reusedBases": 7,
  "oldBasesReviewed": 16,
  "variants": 178,
  "assetsPerNewBase": 18.375,
  "standaloneReferenceModelsAvoided": 294,
  "referencePlacementVerified": 470
}

## 시간과 용량
{
  "timings": {
    "usdBuildSeconds": 2.8617217540740967,
    "allConnectionsSeconds": 0.7031018733978271,
    "rtxCaptureSeconds": 156.2100863456726
  },
  "capacity": {
    "assets": 294,
    "zipBytes": 140421,
    "usdBytes": 2674084,
    "sha256": "b2417729aca7a75a8e7e6ddefbc2a29e7f73731db32ea07dae3da6b80d7f0cae",
    "portableRoundtrip": true,
    "readyPromotions": 0
  }
}

## 판정 경계
- 새294종은 공정별 구조를 구분한 배치용 기준 모델이며 실측 완제품이나 기능 검증 모델이 아님.
- 기준 크기·Y-up·+X-forward·바닥 원점과 논리 포트만 검증. 실제 핀맵/안전거리/관절 동작은 미검증.
- 666 연결은 USD 경로+prim 재열기와 형상 존재 기준. 724 카탈로그 ID는 변경하지 않음.
- 기존 READY10은 프로젝트 기준 레이아웃 범위. 이번 신규 승격0, REAL0, PLC쓰기0.
- 공장 스튜디오의 로그인/드래그/실시간 스트리밍 E2E는 이번 정적 카탈로그 연결 검사와 별도.

## 다음 바위
남은58종은 실제 장비 자료 대기. 연결된 기준 형상의 종류·실측/기준치수·장착/입출력·작동/물리 검증이 다음 병목이며 ASSET_READY/REAL은 별도.

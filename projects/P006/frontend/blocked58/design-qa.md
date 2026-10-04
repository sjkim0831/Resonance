# BLOCKED58 전수 해소 판정

2026-09-10T04:44:06.084Z

## 원씽
666 연결 보존. 전용 장비 정보 없는 형상 대체와 READY/REAL 승격 금지.

## 집계
{
  "summary": {
    "blocked": 58,
    "immediate": 0,
    "existingReuseConfirmed": 0,
    "variantConfirmed": 0,
    "modifyCombinationConfirmed": 0,
    "conditionalMethods": {
      "EXISTING_REUSE": 0,
      "VARIANT": 0,
      "MODIFY": 8,
      "COMBINATION": 22,
      "NEW_MODEL": 28
    },
    "partialBaseCandidates": 46,
    "externalMaterialsRequired": 58,
    "siteMeasurementConfirmed": 0,
    "siteMeasurementConditional": 58,
    "cannotResolveNow": 58,
    "manufacturerConfirmed": 0,
    "modelConfirmed": 0,
    "publicTypeReferences": 50,
    "originalFilenameHitAssets": 0,
    "legacyMetadataHitAssets": 0,
    "causeCounts": {
      "DOCUMENT_MISSING": 58,
      "MODEL_UNKNOWN": 58,
      "DIMENSION_MISSING": 58,
      "PORT_INFO_MISSING": 58,
      "FUNCTION_UNKNOWN": 58,
      "PHOTO_INSUFFICIENT": 58,
      "BASE_NOT_FOUND": 12,
      "REAL_MEASUREMENT_REQUIRED": 0,
      "OTHER": 0
    },
    "priority": {
      "P1": 14,
      "P2": 36,
      "P3": 8
    }
  },
  "metrics": [
    {
      "stage": "USD_CONNECTED",
      "count": 666,
      "total": 724,
      "percent": 91.99,
      "definition": "현재 USD/prim 연결, 실물 기능 승인 아님"
    },
    {
      "stage": "FUNCTION_VERIFIED",
      "count": 0,
      "total": 724,
      "percent": 0,
      "definition": "장비 기능의 독립된 검증 증거. 단순 process/정적 훅 제외"
    },
    {
      "stage": "PHYSICAL_VERIFIED",
      "count": 0,
      "total": 724,
      "percent": 0,
      "definition": "실물/승인 설계의 물리 적합성과 검증 증거. 임의 기준 외형/정적 bbox 검사 제외"
    },
    {
      "stage": "PORT_VERIFIED",
      "count": 0,
      "total": 724,
      "percent": 0,
      "definition": "해당 장비 포트 수량/규격/방향/위치 검증. 논리 앵커 제외"
    },
    {
      "stage": "ASSET_READY",
      "count": 10,
      "total": 724,
      "percent": 1.38,
      "definition": "기존 프로젝트 기준 레이아웃 READY 보존; 현장 사용 인증 아님"
    },
    {
      "stage": "REAL_VERIFIED",
      "count": 0,
      "total": 724,
      "percent": 0,
      "definition": "실장비 신호 증거 및 REAL 게이트 통과"
    }
  ]
}

## 판정 경계
- 해소 확정과 자료 확보 후 조건부 제작 경로는 별개이며 중복 집계 가능.
- 모든58개는 장비 유형 카탈로그다. 공개 업체를 실제 보유 장비 제조사로 지정하지 않음.
- 현재 해결 불가58은 영구 불가가 아니라 현 증거로 연결 승인을 내릴 수 없음을 의미.
- 현장 실측 필수 여부58개 모두 조건부. 필수0은 실측 불필요를 뜻하지 않음.
- 6개 지표는 누적 파이프라인이 아닌 독립 증거 지표. 기존 READY10과 실제 기능/물리/포트 미검증은 범위가 다름.

## 다음 바위
P1 항목의 대상 모델/승인 기준 설계를 확정하고 GA·포트표·공정 매뉴얼을 확보. 파일 제작 전 항목별 자료 게이트 재평가.

## 자동검사
724/666/58 수 일치,58 ID 전수 규칙, 재사용 후보는 기존666에 포함, 원본5개 기준 파일 SHA 불변. 실제 USD 해시는 별도 remote-preservation.json 참조.

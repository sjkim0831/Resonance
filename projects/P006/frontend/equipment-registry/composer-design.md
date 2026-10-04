# P006 Factory Composer MVP 설계

## 원씽 / 범위
공통 724종·Entry 666종·원장 후보 62개를 복제하지 않고 Layout에서 참조한다.
36 REFERENCE_MATCH 및 후속 판정 6 MODIFICATION / 20 INFO_REQUIRED는 보존한다.
62개는 실제 설치 확정 원장이 아니다. 업체 UNKNOWN과 원본 증거는 그대로 둔다.
현재 작업 화면은 미니 썸네일 기반 2D 상면 배치도다. 실제 USD 메시를 렌더한 3D Stage가 아니다.
자산 썸네일은 기존 출처를 표시하며, 파라미터 도형은 설계 표시용이다.

## 개념 / DB
- Asset: 공유 p006_registry.asset, Asset ID FK + 공통 Entry 경로 검증. 58개 USD 미연결은 브라우저에 보이되 드롭 불가.
- Equipment: 실제 equipment_instance FK 또는 미확정 equipment_intake FK. 동시 지정 금지. 이 참조는 설비 매칭 승인/소유자 변경이 아니다.
- Canvas Instance: (layout_id, instance_id UUID) PK, 동일 Asset 복수 배치 가능. 복사 시 새 UUID, 실제 설비 참조 해제.
- Factory Layout: factory_layout, JSON settings, optimistic version. factory_layout_revision에 저장마다 전체 문서 보존.
- Relationship: layout_relationship 끝점 복합 FK. 객체 삭제 시 연관 관계도 제거. 실제 포트 검증 상태와 독립.
- Asset relationship: composer_relationship_rule. 기존 metadata.catalog.connections의 정확한 Asset ID/Domain만 가져온다.
  유형이 정의되지 않은 기존 관계는 OPTIONAL_WITH(설계 후보)로만 취급한다. 기존 DB 데이터를 UI가 조회하며 JS 장비별 추천 하드코딩은 없다.
  존재하지 않는 ID/도메인 토큰은 관계를 추측하지 않고 unresolved 목록에 보존한다.

## 좌표 / 크기
미터, 오른손 좌표, Y up, Canvas X/Z 상면도, XYZ Euler degrees, Scale 양수.
카탈로그 크기는 model_xyz_m(USD 경계)이며 실측 확정이 아니다. 미제공 시 1m 표시용 기본값을 명시한다.
Canvas 아이콘은 최소 24px로 확대 표시될 수 있으므로 픽셀 크기가 실측 치수를 보증하지 않는다.
Parametric width(X), length(Z), height(Y). 기존 Entry는 기준 자산 참조일 뿐, 파라미터가 원본 USD에 적용됐다고 주장하지 않는다.
바닥/벽/통로/기둥/문/셔터/펜스/구역/계단/랙/경로/트레이를 같은 파라미터 계약으로 관리한다.
향후 3D renderer는 templateId+parameter+transform으로 해당 Instance용 형상을 생성한다.

## 화면 / 재사용
좌측 Asset Browser: 724개 미니 카드, 한글/영문/ID 검색, 공정/종류 분류, Building 탭, 62개 원장 후보 탭.
중앙 Canvas: HTML drag/drop, UUID Instance, Shift 다중 선택, 이동, X/Y/Z/회전/Scale, 복사, X/Delete 삭제, Undo/Redo, Grid/Snap/RotationSnap/Align.
우측 Inspector: 참조 ID/Entry/치수 출처, 파라미터, 원장/실제 설비 참조, 8유형 설계 관계 생성/삭제.
우클릭: 관계 API로 후보 조회, 출처/한계 표시, 선택 시 새 Instance와 설계 연결 생성.
헤더: DB 저장·목록·다시 열기·새 문서·JSON 내보내기. 미저장 이동 경고 및 실패 시 편집 상태 보존.
공통 KRDS 지향 색상/폼/포커스/모달 토큰 사용. 인증은 기존 P006 PROJECT_ADMIN만. 권한/계정 임의 추가 없음.

## API
- GET /projects/P006/registry-api/composer/catalog
- GET /projects/P006/registry-api/composer/related?assetId=...
- GET /projects/P006/registry-api/composer/layouts
- GET /projects/P006/registry-api/composer/layouts/{uuid}
- POST /projects/P006/registry-api/composer/layouts (atomic save, version check)
모든 API는 기존 P006 세션/관리자 권한 필요. POST는 Origin+JSON+X-P006-Requested-With 검사.
서버가 Entry/Asset/원장/관계 참조, 유한한 좌표, 양수 Scale/파라미터, 중복 UUID, 단위, 허용 필드를 검증한다.
DB 버전 충돌은 409, overwrite 금지. JSON으로 로컬 문서를 보존하고 최신 DB를 다시 연다.
저장 오류 시 무조건 재저장하지 않는다. 저장됐을 수 있는 통신 장애는 목록/DB 버전 재조회로 확인한다.

## 검증 절차 / E2E
기존 P006 관리자 → 자산 검색 → 실제 Drag → Canvas UUID 생성 → 이동/회전 → 우클릭 후보 조회/추가 → 바닥/벽 파라미터 → 복사/삭제/다중 선택 → 관계 생성 → 원장 참조 → DB 저장 → 새로고침 → 전체 JSON 동일성 확인.
별도 음성 테스트: 비로그인/비관리자, CSRF, 잘못된 Entry/미연결58/잘못된 FK, NaN/음수Scale, 중복ID, 관계 없는 끝점, 버전 충돌.
기존 724 asset/62 intake/26 review 전체 row hash 보존 검증. USD Entry 파일은 변경하지 않는다.
테스트 데이터는 이름에 QA를 명시한 전용 Layout만 생성한다. 기존 사용자 Layout을 수정하지 않는다.
브라우저 스크린샷과 자동 검증 JSON을 결과로 남긴다.

## 후속 업무
1. 이번 Layout Instance/파라미터를 실제 USD Stage로 전달하여 RTX/3D 크기·원점 확인.
2. 실제 포트/설비 정보가 확보된 경우에만 8종 설계 관계를 물리·공정 연결 검증으로 발전.
3. 원장 후속 6개 도면 적용 여부 + 20개 방식 확인은 별도 진행. READY/REAL 자동 승격 없음.

## 생성 계약
SHA256: a90bf3433ab82f382cd5b6709a8815fbbfa339df57f5906437d5becfb4c0e171

{
  "version": 1,
  "name": "3D Factory Composer · Layout Editor",
  "coordinateSystem": "RIGHT_HANDED_Y_UP",
  "unit": "m",
  "rotation": "XYZ_EULER_DEGREES",
  "plane": "XZ",
  "maxInstances": 2000,
  "relationshipTypes": [
    "REQUIRES",
    "CONNECTS_TO",
    "INPUT_FROM",
    "OUTPUT_TO",
    "OPTIONAL_WITH",
    "SAFETY_FOR",
    "CONTROLLED_BY",
    "UTILITY_FOR"
  ],
  "parameterFields": [
    "width",
    "length",
    "height"
  ],
  "templates": [
    {
      "id": "floor",
      "name": "바닥",
      "shape": "slab",
      "assetId": "E023",
      "width": 20,
      "length": 15,
      "height": 0.15,
      "color": "#dce5eb"
    },
    {
      "id": "wall",
      "name": "벽",
      "shape": "box",
      "assetId": "E024",
      "width": 8,
      "length": 0.2,
      "height": 3,
      "color": "#8195a9"
    },
    {
      "id": "column",
      "name": "기둥",
      "shape": "box",
      "assetId": "E026",
      "width": 0.5,
      "length": 0.5,
      "height": 3,
      "color": "#65798e"
    },
    {
      "id": "door",
      "name": "문",
      "shape": "opening",
      "assetId": "E025",
      "width": 1.2,
      "length": 0.15,
      "height": 2.2,
      "color": "#79b9c6"
    },
    {
      "id": "shutter",
      "name": "셔터",
      "shape": "opening",
      "assetId": "E035",
      "width": 4,
      "length": 0.2,
      "height": 3.5,
      "color": "#93a9bd"
    },
    {
      "id": "aisle",
      "name": "통로",
      "shape": "zone",
      "assetId": "E030",
      "width": 2,
      "length": 10,
      "height": 0.01,
      "color": "#f4ca58"
    },
    {
      "id": "fence",
      "name": "안전 펜스",
      "shape": "fence",
      "assetId": "E031",
      "width": 4,
      "length": 0.1,
      "height": 1.8,
      "color": "#dcad23"
    },
    {
      "id": "zone",
      "name": "작업구역",
      "shape": "zone",
      "assetId": "E029",
      "width": 6,
      "length": 5,
      "height": 0.01,
      "color": "#b8dccf"
    },
    {
      "id": "stairs",
      "name": "계단",
      "shape": "stairs",
      "assetId": "E039",
      "width": 1.2,
      "length": 3,
      "height": 2,
      "color": "#92a3b7"
    },
    {
      "id": "rack",
      "name": "랙",
      "shape": "rack",
      "width": 3,
      "length": 1,
      "height": 2.5,
      "color": "#c5b2a1"
    },
    {
      "id": "pipe",
      "name": "배관/덕트 경로",
      "shape": "route",
      "width": 0.3,
      "length": 5,
      "height": 0.3,
      "color": "#68b6b4"
    },
    {
      "id": "tray",
      "name": "케이블 트레이",
      "shape": "route",
      "width": 0.4,
      "length": 5,
      "height": 0.1,
      "color": "#a5abbb"
    }
  ],
  "guidance": {
    "help": "검색 → 썸네일 드래그 → 이동/회전 → 우클릭 연관 자산 → 건축 객체 → DB 저장 → USD Stage 생성 → 검증 결과 → Omniverse File/Open. Shift+클릭 다중 선택, Delete 삭제, Ctrl+D 복사, Ctrl+Z 실행 취소.",
    "design": "Asset는 공유 원장, Equipment는 실제 설비/원장 후보, Canvas Instance는 독립 UUID, Relationship은 설계 연결, Layout은 버전 관리 문서입니다. 실제 포트/안전 조건 검증은 별도입니다.",
    "qa": "실제 로그인·DB 저장/재조회·Instance/Relationship 동일성·버전 충돌에 더해 USD Reference·단위·독립 수학식 Transform·건축 치수·재질 의존성·Stage 재오픈을 검증합니다. GUI/RTX 상태는 별도 실제 화면 증거가 있을 때만 PASS입니다.",
    "next": "DB 저장 후 USD Stage 생성으로 서버 경로와 7단계 결과를 확인하세요. 현재 저장된 높이·방향·크기가 의도한 배치인지 검수한 뒤 다음 Layout에 같은 Export를 적용합니다. 양방향 동기화와 설비 정보 후속 6+20개는 별도입니다."
  }
}

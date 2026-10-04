# Factory Composer → USD Stage 설계 v1

## 원씽 / 업무 절차

P006 프로젝트 관리자가 저장된 Layout을 USD Stage로 단방향 재현합니다.
DB 저장 → USD Stage 생성 → 검증 결과 → 서버 Omniverse File / Open → GUI 검수.
미저장 변경과 이전 버전 요청은 차단합니다. 저장 Revision과 실제 Instance 원장을 대조합니다.
자산·설비 원장·Layout·READY·REAL은 수정하지 않습니다. 양방향 동기화는 없습니다.

## API / 저장

POST `/projects/P006/registry-api/composer/stages` 입력 `{layoutId,version}`.
GET `/projects/P006/registry-api/composer/stages/{jobId}` 상태/독립 검증 결과.
GET `/projects/P006/registry-api/composer/stages/{jobId}/{usd|report|snapshot}` 인증된 다운로드.
기존 P006_SESSION / PROJECT_ADMIN 권한 및 CSRF 헤더 사용. 임의 경로 입력 금지.
전역 worker 잠금, 최대 180초, 독립 프로세스, 불변 UUID 산출물, 실패 시 Layout 유지.
작업 결과는 디스크 보존. 서비스 재시작 시에도 작업/결과 파일로 조회합니다.
경로: `/home/sjkim/OmniverseProjects/factory-layouts/{jobId}/Factory.usda`.

## 좌표 계약

|항목|계약|
|---|---|
|version|1|
|direction|COMPOSER_TO_USD_ONLY|
|units|m|
|metersPerUnit|1|
|upAxis|Y|
|axes|{"X": "Canvas right", "Y": "height", "Z": "Canvas down"}|
|origin|Layout origin; Entry authored root retained; building bottom-center|
|position|identity XYZ|
|rotation|rotateXYZ degrees (canvas.rx, -canvas.ry, canvas.rz); positive Canvas yaw is clockwise in X-right Z-down view|
|scale|identity XYZ; positive only|
|xformOpOrder|["xformOp:translate", "xformOp:rotateXYZ", "xformOp:scale"]|
|entryPolicy|Y-up metre Entries only; fail unsupported metadata; Reference child preserves Entry transforms/materials|
|relationships|["REQUIRES", "CONNECTS_TO", "INPUT_FROM", "OUTPUT_TO", "OPTIONAL_WITH", "SAFETY_FOR", "CONTROLLED_BY", "UTILITY_FOR"]|
|guiGate|OMNIVERSE_VERIFIED and RTX_VERIFIED require separately reviewed actual GUI evidence; exporter never grants these states|


현재 Canvas의 Y 회전은 화면에서 시계방향이므로 USD RH Y 회전에만 부호를 반전합니다.
X/Z는 저장된 오른손 Euler 각도를 그대로 사용합니다. 적용 순서는 Scale → Rx → Ry → Rz → Translate입니다.
저장된 Y=0.5는 0.5m로 유지합니다. 자동 바닥 맞춤이나 설비 원점 보정은 하지 않습니다.
건축 기준점은 바닥 중앙입니다. 바닥 Y=-0.15m, height=0.15m이면 상단은 0m입니다.

## Prim / 재사용 / 관계

`/Factory/Equipment/I_{uuid}/Asset`는 Entry defaultPrim에 대한 Reference입니다.
부모 Instance에 Layout 변환, 자식 Asset에 원본 Entry 계층·재질·원점을 유지합니다.
장비 geometry를 복제하거나 flatten하지 않습니다. `/Catalog` 임의 대체 참조 금지.
`/Factory/Building/I_{uuid}`는 width=X, length=Z, height=Y의 파라미터 형상입니다.
12개 유형을 지원하며 문·셔터·펜스·계단·랙·트레이는 구성요소로 생성합니다.
문은 닫힌 잎판이며 벽 Boolean 개구부/동작/물리 검증은 포함하지 않습니다.
배관/덕트는 직선 직육면체 경로 표현이며 원형 관·곡관·실제 포트가 아닙니다.
건축 자산의 기존 Entry 경로는 추적 메타데이터로 보존하되, 고정 모델을 중복 참조하지 않습니다.
`/Factory/Relationships/R_{uuid}`에 원본 관계 JSON과 from/to USD relationship을 저장합니다.
Instance에도 8개 관계 유형별 target을 저장합니다. 실제 배관/포트/안전 조건 검증이 아닙니다.
`/Factory/Presentation`의 카메라·조명은 검수용이며 Layout 객체 수에서 제외됩니다.

## QA / 승격 게이트

저장 Revision 일치, 자산 ID/Entry identity, 단위/Up Axis, Reference 및 의존 파일,
Instance 수, SRT op 순서, 독립 수학식 기반 5개 점 Transform,
건축 구성요소 꼭짓점의 로컬 치수와 하단 원점, 재질 바인딩,
8종 관계/원본 메타데이터, 저장 후 재오픈 signature, 원본 파일 SHA256을 검사합니다.
반복 자산 2개·건축 12종·관계 8종·복합 XYZ 회전·비균일 Scale 회귀검사 및
잘못된 단위/축/자산 ID 거부 검사를 포함합니다.
CAD 실측·동작·PLC·실제 포트·ASSET_READY 검증은 별도입니다.
Exporter는 OMNIVERSE_VERIFIED/RTX_VERIFIED를 자동 부여하지 않습니다.
실제 GUI 화면과 해당 Stage·카메라·렌더 증거를 별도로 검토한 경우에만 별도 증거 기록을 남깁니다.

## 다음 업무 / 깨달음

Stage가 정확히 재현되어도 배치 자체의 안전성과 실물 정확성이 보장되지는 않습니다.
저장된 높이·간격을 먼저 사용자 설계로 확인하고 다음 Layout을 같은 Export로 검수합니다.
양방향 동기화·실장비 연결은 이번 작업에 포함하지 않습니다.

## 근거

OpenUSD Xformable: https://openusd.org/dev/api/class_usd_geom_xformable.html
계약 SHA256: `59bba3f709fc9ebe2494b1476e96e2aa7f4c79f54b54294b537ebf0152c177ac`

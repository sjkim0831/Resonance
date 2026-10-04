# P006 RC Car USD 구조 부품 검토 화면 설계

작성일: 2026-09-26  
URL: `product-planner-rc-car-structure.html`  
데이터: `p006-rc-car-component-structure.json`

## 목적

제품 플래너의 첫 단계에서 공개 RC Car USD Stage의 실제 prim 묶음과 검토 가능한 순서를 확인한다. 현재 P006 제품 카탈로그/생산계획에 외부 USD를 등록하지 않는다.

## 근거와 한계

- 원본 `_Class1RC.usd`: 33,843,828 bytes, SHA-256 `b7101cc8918fc958ac1c80ef01499587c12227adbdb4f3df1aefedaac06afaf1`.
- Stage Open과 Omniverse RTX 정적 렌더 PASS. 원본 Stage 59 prim / 36 Mesh / 23 Xform, Z-up, `metersPerUnit=0.01`.
- 실제 Xform 그룹 9개를 이름과 계층으로 여섯 구조 항목에 집계했다. Mesh 합계 36개, point 합계 1,762,662, face 합계 587,554.
- group 개수는 CAD Stage의 구조 묶음 수다. 부품 BOM 수량이나 구매 단위가 아니다.
- USD에서 Joint 0, 시간 샘플 속성 0. 기계 동작·재생 애니메이션 근거는 없다.
- 구조화된 BOM 파일을 찾지 못했다. component-to-component mechanical attachment, 조립 순서와 공정 시간도 미확정이다.
- 현재 data의 5단계 순서는 정적 구조를 설명하기 위한 검토 제안이다. 실제 제조 Sequence로 쓰지 않는다.

## 요구사항 → 데이터 → 화면 → 확인

| 요구 | 데이터 | 화면 | 완료 상태 |
|---|---|---|---|
| USD에서 확인된 구조 후보 나열 | component prim path, group/mesh counts, name evidence | 제품 플래너 첫 단계 카드와 상세 표 | 구현 |
| 후보 조립 흐름 열람 | `STRUCTURAL_REVIEW_ORDER_PROPOSAL`, 단계별 component IDs | 번호 순서 카드 | 제안 순서만 표시 |
| BOM·수량·공정·동작 경계 표시 | NOT_VERIFIED / UNRESOLVED 상태 | 경고·상태 배지 | 구현 |
| 출처·시각 근거 확인 | USD hash, original repo, Omniverse screenshot, stage report | 출처 버튼과 screenshot | 구현 |
| 원본 모델 편집/가져오기 | 범위 밖 | 없음 | 미구현 |

## 모델과 생산 계획 사이 경계

이 화면은 `PRODUCT_CANDIDATE`에 대한 구조 조사 결과다. Planner의 기존 `carExample()` 전기차 FUNCTIONAL_DEMO 계획과 자동으로 연결하지 않는다. 독립 prim group USD export와 차량 설계자 검토, BOM 관계, 조립 위치/조인트가 확보된 뒤 Product/Part 모델 계약 및 runtime animation을 설계한다.

## 다음 단계 카드

1. 설계자가 신규 `product-planner-rc-car-review.html`에서 부품 실명·BOM 수량·좌우·조립 순서·결합 관계·동작 축/범위·근거·검토자를 기록한다.
2. 근거 없는 항목은 후보로 남기고, 검토자 승인 후 JSON을 내보내 CAD/BOM 원본 문서와 함께 보관한다. 입력 초안은 현재 브라우저 localStorage이며 서버 DB 자동 저장이 아니다.
3. USD 원본/구조 후보 SHA가 가져온 JSON과 일치하는지 확인하고, 승인 JSON은 다시 가져와도 자동 승인을 신뢰하지 않고 후보로 되돌린다.
4. CAD 담당자로부터 독립 부품 USD/GLB 재사용 권한, 실제 조립 joint/Pivot/Axis/허용량을 확보한다.
5. 그 뒤 승인된 component assets만 Product Planner의 각 공정에 연결하고 시간 기반 assembly preview를 구현.

## 구조 그룹 3D 시연 Pilot · 2026-09-26

- 경로: `product-planner-rc-car-assembly.html`; 진입: 제품 단계의 `3D 구조 그룹 조립 시연`.
- 파생 GLB: `assets/rc-car-structure/rc-car-structure.glb`; manifest와 MIT LICENSE를 같은 디렉터리에 둔다.
- 입력 USD: 기존 Omniverse 검사본 `_Class1RC.usd`, SHA-256 `b7101cc8918fc958ac1c80ef01499587c12227adbdb4f3df1aefedaac06afaf1`, 59 prim / 36 Mesh / Z-up / 0.01 m per unit.
- 변환: OpenUSD `Usd.Stage.Open` 및 `UsdGeom.XformCache`의 mesh world matrix로 점 좌표를 변환하고 metersPerUnit을 적용한다. glTF는 Y-up, meters를 사용한다. Mesh 경로는 여섯 구조 category node로 매핑하며 지오메트리 크기와 좌표를 수정하지 않는다.
- GLB geometry gate: 각 component의 Mesh/point/face 개수가 구조 JSON 및 source report와 일치해야 내보낸다. Fan triangulation으로 원본 face 587,554개와 GLB Triangle 587,554개가 일치한다.
- 화면은 Three.js GLTFLoader로 명시적 사용자 로드 후 모델을 표시한다. 분해 위치는 각 category의 bounding-box 중심에서 전체 중심 방향으로 0.11 m 이동한다. 조립 시연은 구조 검토 순서의 1~4단계별 translation easing이며 한 단계에서 여러 그룹은 동시에 이동한다. 기본 단계 시간은 2초이며 사용자가 0.3~10초로 조절한다.
- 카메라 조작: 드래그 회전, 휠 줌. 재생 중 Pause/Continue, 원본 USD 기준 위치 초기화, 분해 보기를 제공한다.
- 검증 레벨: Mesh 형상/개수·좌표 변환과 화면 재생은 확인 가능. joint, 실제 체결, 공정 적합성, 제조 순서, real work time은 미검증이다. 이동 경로와 분해 offset은 화면 검토 convenience parameter이며 설계/안전 기준이 아니다.
- 사용 가정: 단일 화면에 28.2 MB GLB를 한 번 가져오며, 다운로드 완료 후 WebGL에 36 Mesh와 약 0.59M triangles를 유지한다. 초기 페이지 로드는 GLB를 받지 않는다.
- 데이터 흐름: `source USD → OpenUSD extraction → six-category GLB + manifest → explicit browser GLTFLoader → review-only translation demo`. Production product plan/asset registry/relationship/DB에는 쓰지 않는다.

## CAD·BOM 검토 기록 화면 · 2026-09-26

- 새 경로: `product-planner-rc-car-review.html`; 제품 Planner와 구조 후보 상세에서 진입한다.
- 6개 구조 후보별 공식 부품명, BOM 수량, 좌우/적용범위, 조립 순서, 결합 상대, 동작 유형·좌표축·범위, 근거 식별자, 검토자를 입력한다.
- 필수 값/근거가 비어있거나 동작 축·범위가 불완전하면 승인 버튼을 차단한다. `UNKNOWN_CONFIRMED`는 자료상 미확인을 명시적으로 기록하는 값이며 물리 동작 승인이 아니다.
- 임시 저장은 브라우저 localStorage, 교환은 원본 USD SHA가 포함된 JSON 파일로 한정한다. 서버 DB·Production 카탈로그/BOM에 기록하지 않는다.
- JSON import는 스키마와 USD SHA를 확인하며, import된 승인 표시는 신뢰하지 않고 후보로 재설정한다. 승인 후 입력 수정도 후보로 강등한다.
- 이 단계의 사용자 승인은 검토 입력 상태일 뿐 Product/Process/Animation/Flow eligibility가 아니다.

원씽: `USD Xform group`은 부품 구조 후보이며, BOM/조립 가능성을 확정하려면 CAD 설계 근거가 추가로 필요하다.

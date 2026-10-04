# 자동차 주요 모듈 모델 확보 목록

기준일: 2026-09-25  
범위: P006 Asset Registry 724건과 웹 Asset Catalog 724건의 이름·분류·모델 경로 확인. 차량 부품으로의 매칭은 이름 유사성만으로 확정하지 않음.

## P006 자산 실사 · 2026-09-26

- 서버에서 `entry-catalog/entries.json` 724건과 `3d-derived/manifest.json` 724건을 대조했다. 자동차 완제품 또는 자동차 주요 부품으로 명시된 제품 형상은 0건이다.
- 자동차/부품 용어 검색에서 잡힌 A176 타이어 빌딩기, A387 안전 범퍼, A530 배터리 팩 시험기, E046 차량 진입 방지 기둥, N008 차량 차단기는 모두 설비·안전·인프라 자산이다. 제품 부품 USD/GLB로 세지 않는다.
- P006 frontend에는 USD/GLB/GLTF 파일 905개가 있으나, 파일명 검색에서 자동차 제품/차체/섀시/배터리팩/휠·타이어/시트 등 제품 모델 파일은 발견되지 않았다. 이 결과는 파일명과 원장 메타데이터 기준이며, 905개 파일의 내부 mesh 의미를 전부 수작업 판독했다는 뜻은 아니다.
- 웹으로 열리는 GLB는 모델 점검기에서 7/7 서명 확인했고 HEAD 요청도 7/7 HTTP 200을 확인했다. 후보 설비 5개(N076, E148, E121, E053, A195)와 범용 구성요소 참고 2개(E240, E245)다. 모두 차량의 대응 부품으로 승인되지 않았다.
- 설비 후보 5개와 범용 구성요소 참고 2개는 별도 3D Pilot에서 실제 Three.js GLTFLoader로 7/7 파싱하고 브라우저에 표시했다. 총 Mesh 138, Triangle 2,492, GLB 내장 Animation Clip 0개였다. 파싱 성공은 자동차 부품 의미·공정 적합성·기계 동작 승인과 다르다.
- 따라서 실제 자동차 형상의 조립 시연은 현재 BLOCKED: 완성차 1종과 주요 부품 12종의 실제 USD/GLB, 차종/BOM 및 조립 위치 근거가 필요하다. 현재 간략 모듈 애니메이션은 `FUNCTIONAL_DEMO`로만 사용한다.
- 기계 GLB 후보는 실제 페이지에서 모델 파싱/외형/가동부 검증을 통과한 것으로 간주하지 않는다. HTTP·파일 시그니처와 파일 존재 확인만 PASS다.

상세 기계 후보 경로와 파일 크기: [`PRODUCT-PLANNER-CAR-MODEL-INVENTORY-2026-09-26.json`](PRODUCT-PLANNER-CAR-MODEL-INVENTORY-2026-09-26.json).

## 경로 입력·검증 흐름 · 2026-09-26

제품 플래너 `공정·운송 > 완제품·부품·설비 USD 연결`에서 모델 경로를 입력하고 `모델 연결·시간 근거 적용`으로 설계에 반영한다. 이후 `모델 경로 점검`은 계획에 입력된 GLB와 카탈로그 설비 참고 GLB에 대해 같은 출처의 P006 웹 자산 경로인지, HTTP 응답이 성공인지, 응답 본문 앞부분이 GLB `glTF` 서명인지 확인한다. 동시 요청은 최대 4개이며 Range 요청/응답 스트림의 첫 부분만 읽고 취소한다.

이 점검은 파일 접근·서명 확인일 뿐 전체 GLBLoader 파싱, USD 구성, 차량 제품/차종/BOM 적합성, Anchor·조립 호환성 검증이 아니다. 로컬 PC 경로와 서버 내부 절대경로(`/home/...`)는 브라우저에서 직접 읽을 수 없으며, 외부 Origin URL은 요청하지 않는다. 제품 모델은 여전히 실제 USD와 웹용 GLB의 승인된 자산 경로를 별도 등록해야 한다.

## 제품·주요 부품 모델

| 항목 | 필요 수량(완제품 1대) | 카탈로그 결과 | 현재 처리 |
|---|---:|---|---|
| 완성차 | 1 | 차량 제품 모델 확인 안 됨 | USD/GLB 확보 필요 |
| 차체·도어 패널 세트 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 구동 모터·감속기 모듈 | 1 | 완성 모듈 확인 안 됨. E240 서보 모터, E245 감속기는 범용 개별 자산 | 차량 규격·조립 대응 검토 전 참고만 |
| 배터리 팩 | 1 | 제품 형상 확인 안 됨. A530은 배터리 팩 시험 설비 | 팩 USD/GLB 확보 필요 |
| 서스펜션·조향·제동 모듈 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 열관리 모듈 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 배선·전력전자 모듈 | 1 | 제품 형상 확인 안 됨. A195/A197은 하니스 조립·테이핑 설비 | 모듈 USD/GLB 확보 필요 |
| 시트·내장 세트 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 대시보드·제어기 모듈 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 유리 세트 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 범퍼·외장 세트 | 1 | 제품 형상 확인 안 됨. A387은 안전 범퍼 자산 | 차량 외장 대응 검토 및 모델 확보 필요 |
| 등화 모듈 세트 | 1 | 제품 형상 확인 안 됨 | USD/GLB 확보 필요 |
| 휠·타이어 조립체 | 4 | 제품 형상 확인 안 됨. A176은 타이어 빌딩기 | 휠·타이어 제품 USD/GLB 확보 필요 |

카탈로그에서 관련 용어가 포함된 설비 이름이 발견되어도, 그것은 부품 제품 모델의 확보로 계산하지 않는다. E240/E245를 완성차 구동 모듈로 조립하거나 제품 계획에 자동 연결하지 않는다.

## 외부 RC Car CAD 후보 실사 · 2026-09-26

- NVIDIA-Omniverse 공개 `RC-Car-CAD` 저장소를 읽기 전용으로 조사했다. README는 원격 조종 자동차 설계 자료에 CAD·CAE·BOM이 포함되고 전체 NX 조립 진입 파일은 `_Class1RC.prt`라고 설명한다.
- GitHub tree에서 NX assembly 717,885 bytes, 변환 USD 후보 33,843,828 bytes, GLB 후보 6,757,152 bytes를 확인했다. NX는 원격 목록에서만 확인했다. USD와 GLB는 각각 임시 격리 검사 경로이며 Production asset/catalog에는 반입하지 않았다.
- 최초 실사에서는 GLB HTTP Range 0–262,143 bytes만 읽고 전체 parse를 미검증으로 기록했다. 이 당시 결론은 아래 `외부 RC Car GLB 실제 브라우저 파싱` 후속 검사에서 실제 전체 GLTFLoader/3D 렌더 결과로 갱신했다. 메타데이터만으로 완성차/부품 여부를 확정하지 않는 기준은 유지한다.
- 현재 페이지는 외부 후보 1건을 표시하되 `EXTERNAL_CANDIDATE_NOT_IMPORTED`로 유지한다. P006 제품 카탈로그 완성차/부품 숫자에는 합산하지 않는다.
- README에는 데이터가 의도적으로 미완성이며 일부 부품·조립 정리가 정확하지 않을 수 있다고 명시되어 있다. 저장소 파일 트리에서 CSV/XLSX/PDF 형태의 독립 구조 BOM은 찾지 못했다. 따라서 BOM은 `BOM_MENTIONED_FILE_NOT_LOCATED`다.
- 라이선스 파일은 MIT이며 배포 시 저작권/허가문 고지가 필요하다. 저장소에 포함된 서드파티 표준 부품/브랜드 형상 권리까지 별개로 정리됐는지는 미검증이다.
- USD Stage 검사: OpenUSD `usd-core 26.8`로 Stage Open PASS. SHA-256 `b7101cc8918fc958ac1c80ef01499587c12227adbdb4f3df1aefedaac06afaf1`, 33,843,828 bytes, default prim `/World`, Z-up, `metersPerUnit=0.01`, 총 59 prim(23 Xform, 36 Mesh), 1,762,662 points, 587,554 faces, 외부 참조 0개. joint 계열 prim 0개, time-sampled attribute 0개이므로 이 USD에서 재생 가능한 애니메이션/리그는 확인되지 않았다.
- 호환성 경고: OpenUSD가 USDC crate version `0.7.0`을 deprecated로 경고했으며 미래 USD 구현에서 읽지 못할 수 있다고 알렸다. Stage가 열렸다는 것만으로 Omniverse GUI 렌더·시각적 차량 식별·NX assembly completeness를 PASS하지 않는다.
- 라이선스 파일 SHA-256 `1c707da9108fbb592b938a6dc2969f5f4d13663974b9bd02c34d2a8dd5a745fc`를 임시 검사 중 확인했다. MIT 고지 및 저장소 내 서드파티 형상 권리는 실제 재배포 전에 별도 검토해야 한다.
- 다음 Gate: Prim별 모델 의미/단위/제품·BOM 확인 및 출처·권리 범위 점검. 이들을 통과하기 전 `RC_CAR_FUNCTIONAL_DEMO` 외 제품/공정 자산으로 취급하지 않으며 승용차 생산 검증과 분리한다.

## RC Car USD Scene 구조와 Omniverse GUI 재검증 · 2026-09-26

- 후속 검증 결과: 위에 `미검증`으로 기록했던 Omniverse Kit RTX GUI 렌더는 PASS로 갱신한다. source USD와 LICENSE는 `/tmp/p006-rc-omniverse-review-20260926`에만 두었고 외부 후보 상태 및 미반입 상태를 유지한다.
- Kit Stage tree의 `/World/Geometry/_Class1RC` 아래에는 chassis, upper/lower arm, trailing arm, front/rear unsprung mass 등 9개 명명 Xform group이 있다. 실제 mesh bounds는 중심 섀시와 앞/뒤·좌/우 바퀴 위치에 분포한다. 이름/배치는 구조적 단서이지 물리 조인트나 완성 BOM 검증이 아니다.
- 시각 캡처에는 RC 하부 섀시 판, 서스펜션 링크, 네 모서리의 바퀴/타이어가 보인다. 외장 차체 쉘은 뷰에서 확인되지 않았으며, `완성 승용차`, 특정 제품 품번, 모듈 BOM으로 분류하지 않는다.
- Kit 세션에서 Prim 74개가 보인 것은 source의 59 Prim보다 15개 많다. Kit가 `/Render` 설정, viewport camera와 light rig prim을 추가했기 때문이다. source geometry 통계(36 Mesh, 23 Xform)는 바꾸지 않는다.
- 실제 schema 검사에서 `UsdPhysics.Joint=0`, `UsdSkel.Skeleton=0`, `UsdSkel.Animation=0`, time-sampled attrs=0. 따라서 USD 자체 애니메이션은 없음/미확인으로 표시하고, 뷰어의 40 FPS 안팎 overlay는 한 장면의 UI 표기일 뿐 성능 벤치마크로 쓰지 않는다.
- 전체 world bounds는 stage 단위 약 40.12×27.08×8.62 units, 0.01 m/unit 환산 약 0.4012×0.2708×0.0862 m, Z-up이다.
- 증거: `evidence/p006-rc-car-omniverse-20260926.png`, `p006-rc-car-usd-structure-report.json`. P006 catalog, plan, database 및 relationship을 변경하지 않았다.

## 현재 시각화 설비 후보

## 외부 RC Car GLB 실제 브라우저 파싱 · 2026-09-26

- 위 `미검증` 상태였던 외부 GLB 전체 다운로드/GLTFLoader 확인을 완료했다. 원본은 immutable Git commit `407bd553ee57668ceb58d81ffd7f4d617dee3dfa`이며 파일 크기 6,757,152 bytes, SHA-256 `3297b6d06830f0ceb1f023488610ba8bb9da0f9f165dc1f4fec273788fc62486`이다.
- P006 웹 페이지에서 고정 revision 원본을 fetch하고 Three.js `GLTFLoader.parseAsync`로 실제 Object3D Scene을 만들었다. Parse/Three.js WebGL 표시 PASS: GLB JSON node 1(unnamed), Three.js Scene Object3D 2(unnamed Group + mesh_0), Mesh 1, Vertex 28,648, Triangle 49,999, Material 1, Texture 3, Animation Clip 0.
- 원본 Bounds는 GLB 단위 미확정 값으로 약 `0.0975 × 0.0772 × 0.1077`이다. 화면에서 하나의 작고 어두운 텍스처 객체가 보였으나 전체 RC 차량이 아니며, 실제 부품 정체성/실측 크기는 특정하지 않았다.
- 첫 화면 실행은 HTTP origin에서 `crypto.subtle`이 없어 해시 표시 단계에서 중단됐다. UI를 조정해 HTTP Web Crypto 부재는 별도 상태로 처리하고 GLTFLoader 파싱이 계속 진행하도록 수정; 후속 실행은 전체 Parse와 WebGL 표시 PASS했다.
- 확인 화면: `product-planner-external-rc-glb-review.html?rev=glb-gltfloader-1`; 실사 인벤토리에는 버튼으로 연결했다. 정적 JSON·화면·설계·QA만 수정했고 실제 카탈로그/DB/레이아웃·P006 asset 경로에는 GLB를 넣지 않았다.
- 다음 Gate는 제품 정체성·단위/스케일·구조화 BOM·권리 확인이다. 이 후보를 차량 부품·완성차 또는 애니메이션 가능 자산으로 세지 않는다.

다음은 실제 카탈로그의 USD 경로와 웹 GLB 경로가 있는 공정 설비 후보다. 차종·공정 적합성, 설치 위치, 실제 동작은 별도 근거가 없어 미검증이다.

| 공정 예시 | Asset ID | 원장 자산명 | 처리 |
|---|---|---|---|
| 차체 패널 성형 | N076 | 유압 딥드로잉 프레스 | 시각화 후보 |
| 차체 접합 | E148 | 스폿 용접기 | 시각화 후보 |
| 구동 모듈 제작 | E121 | 머시닝센터 | 시각화 후보 |
| 구동 모듈 검사 | E053 | 검사 작업대 | 시각화 후보 |
| 전장 모듈 조립 | A195 | 선재 하니스 자동 조립기 | 시각화 후보 |

## 확보 요청 시 필요한 파일과 근거

각 완제품·부품에 대해 실제 품번/차종, 출처와 사용 권한, 원본 USD, 대응 웹 GLB, 단위·축 방향·바닥 기준을 함께 제공한다. 조립 시연에 사용할 경우 부품별 조립 위치 또는 앵커 근거, 실제 모듈 수량, 가시화할 공정 순서도 필요하다. 설비 동작까지 표현할 경우 별도 가동부 Prim, Pivot/Axis, 이동 범위, 시간 또는 클립 근거를 제공한다.

모델의 경로가 현황표에 입력되기 전까지 부품 모델 보유 수는 0/12로 유지한다. 외형이 비슷하거나 이름이 유사한 자산은 임의로 제품에 끼워 맞추지 않는다.

## RC Car USD 구조 그룹 검토 · 2026-09-26

제품 플래너 첫 단계의 `USD 부품 목록·순서 열기`는 NVIDIA Omniverse `RC-Car-CAD`의 외부 USD Stage에서 추출한 구조 후보를 보여준다. Xform 그룹 9개를 섀시 1, 전륜 상부 암 그룹 2, 전륜 하부 암 그룹 2, 트레일링 암 그룹 2, 전륜 비현가 질량 1, 후륜 비현가 질량 1의 6개 표시 항목으로 묶었다. 괄호의 수는 CAD 그룹 수이며 BOM 수량이 아니다.

Stage는 정적 구조다. Joint와 시간 애니메이션이 검출되지 않았고, 조립 순서는 구조 검토용 제안이다. 외부 USD 및 그룹을 P006 자산에 반입하지 않았다. 상세 prim 경로·Mesh 수는 `p006-rc-car-component-structure.json`에서 본다. 화면/데이터 계약은 `PRODUCT-PLANNER-RC-CAR-STRUCTURE-DESIGN.md`를 참고한다.

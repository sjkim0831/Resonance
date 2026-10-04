# 외부 GLB 전체 파싱·3D 검토 화면 설계

## 목적과 범위

- URL: `product-planner-external-rc-glb-review.html?rev=glb-gltfloader-1`
- 역할: 외부 후보 1개의 출처 고정 → 전체 파일 다운로드 → 실제 Three.js `GLTFLoader.parseAsync` → `Object3D`/bounds 계측 → WebGL 미리보기 순으로 읽기 전용 실사한다.
- P006 제품 카탈로그, 공장 레이아웃, 관계 원장 및 DB에는 쓰지 않는다. 다운로드는 브라우저 메모리와 임시 검토 파일에 한정하고 Production 모델 경로에는 복사하지 않는다.
- 검토 자료: NVIDIA Omniverse `RC-Car-CAD`, immutable revision `407bd553ee57668ceb58d81ffd7f4d617dee3dfa`, GLB `poly 2022-10-13 17_03_55.glb`.

## 화면 흐름

1. 상단 경고에서 외부 후보/비승인 범위와 원본 출처·라이선스를 확인한다.
2. 사용자가 `GLB 전체 다운로드 · 파싱 · 3D 표시`를 누른다.
3. URL 응답 상태·GLB magic header·바이트 수를 확인한 뒤 P006 제공 Three.js와 GLTFLoader로 전체 파싱한다.
4. `matrixWorld`를 갱신하고 Node hierarchy, Mesh, topology, material/texture, animation clip과 world bounds를 계산한다.
5. Renderer에는 원본 Geometry를 유지하고 화면 중앙·바닥 정렬용 최상위 Transform만 적용한다.
6. 결과 상태와 제한을 인벤토리 정적 JSON에 반영하고 사용자가 원본 인벤토리로 돌아간다.

## 데이터 매핑 및 상태

| 표시값 | 원천/규칙 | 상태 |
|---|---|---|
| 파일 크기 | 전체 HTTP 응답의 `ArrayBuffer.byteLength` | 실측 |
| SHA-256 | immutable revision 원본을 격리 임시 경로에서 계산 | 실측; HTTP 웹 Crypto 제한으로 브라우저 내 digest와 분리 |
| GLB Node/Mesh/Vertex/Triangle | 실제 GLTFLoader가 생성한 Three.js Scene과 geometry attribute/index | 실측 |
| Material/Texture/Animation | Scene에 부착된 material, texture map, `gltf.animations` | 실측 |
| Bounds | `scene.updateMatrixWorld(true)` 이후 `Box3.setFromObject` | 원본 축/단위 유지; 물리 단위로 환산하지 않음 |
| 제품 정체성·단위·차종/BOM | 외형과 모델 메타데이터만으로 확정 불가 | `UNRESOLVED` 유지 |

브라우저 실패는 빈 결과/성공으로 대체하지 않고 오류를 표시한다. HTTP 페이지에서 `crypto.subtle`이 없는 경우 해시 부재가 파싱을 막지 않도록 하며, 해시 근거는 immutable 원본 복사본의 SHA로 별도 기재한다. Node 이름은 HTML escape 처리한다.

## 검증 Gate

- UI Parse PASS는 형상 파일을 읽고 표시했다는 뜻이다. 완성차 정체성, 실제 크기, BOM, 자동차 부품 대응, 동작·조립·생산 적합성 또는 P006 반입 승인이 아니다.
- 외부 GLB의 animation clip이 0이면 재생 컨트롤/합성 동작은 제공하지 않는다.
- 원본 사용권/재배포 권리, 저장소 문서에 기재된 불완전성 및 공급망 모델 안전성을 별도 검토한다.
- 새로고침은 정적 결과만 다시 읽는다. 모델을 자동 재다운로드하지 않는다.

## 도움말/QA/다음 업무 카드

- 화면 첫 경고가 사용자용 도움말이다. GLB Parse PASS와 제품 승인 상태를 구별한다.
- QA 및 모델 확보 문서에서 실제 브라우저 Parse/Render 결과와 미확정 항목을 함께 업데이트한다.
- 다음 업무: GLB 개체의 제품 정체성/단위/용도 확인, BOM 원문 및 권리 검토. 이 검토가 끝날 때까지 외부 후보는 제품 수 집계에서 제외한다.

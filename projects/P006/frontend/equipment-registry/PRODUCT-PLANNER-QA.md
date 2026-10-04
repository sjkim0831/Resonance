# 제품 생산 설계 QA · 2026-09-26

## 단일 조립 셀 시연 · 2026-09-28

- 실행 검토에 별도 `조립 공정 셀 · 설비와 작업물 순차 결합`을 추가했다. 전체 공장 흐름의 넓은 카메라와 분리해 E032 실제 GLB 작업대와 차체 프레임·구동 모듈·배터리의 설명용 Proxy 3개를 한 화면에서 보여준다.
- 4개 단계 `투입 → 구동 결합 → 배터리 결합 → 시연 완료`, 재생·일시정지·처음으로, 자동 맞춤 카메라를 제공한다. 드래그 회전·Alt+드래그 Pan·휠 Zoom 조작을 포함한다.
- 현재 E032 Registry 근거는 GLB_READY이나 Motion/Port evidence는 없고 관계/Flow도 unresolved다. 화면은 정적 설비와 FUNCTIONAL_DEMO Proxy로 제한한다. AABB top은 연출용 위치이며 실제 작업면으로 승인하지 않는다.
- 설계 문서 `PRODUCT-PLANNER-ASSEMBLY-CELL-PILOT.md`와 화면 내 미검증 범위 안내를 추가했다. DB·공정 계획·Asset Registry·관계 원장·GLB 변경은 0, 추가 비용 $0.
- 자동 검증: 인라인 ES Module `node --check` PASS, Product Planner 공정 테스트 16/16 PASS.
- Production 브라우저: E032 GLTFLoader Scene 생성 PASS, bounds `1.20 × 0.80 × 0.75m`; 실제 작업대와 Proxy 3개 렌더를 확인했다. 6초 전체 재생에서 각 단계 전환과 마지막 조립 시연 완료 상태를 캡처로 확인했다.
- 재생→일시정지→재개→완료→완료 후 재시작(첫 단계 복귀)을 확인했다. 반복 재생 경과시간 버그를 발견·수정한 뒤 재시험 PASS.
- 통합 `product-planner.html#run`의 실행 단계 안에서 iframe lazy-load, E032 GLB 로드 및 셀 재생을 확인했다.
- 실제 Alt-drag 입력은 미확인이다. DB·계획·관계 원장·GLB 변경 0이며 제품 BOM/물리 조립/작업면은 미검증이다.

원씽: 실제 설비 한 대 주변에서 작업물이 순서대로 모이는 장면을 전체 공장 배치와 분리한다.
깨달음: 실제 설비 GLB와 애니메이션된 작업물이 같은 화면에 있어도 작업면·Port·조립 조건의 물리 검증은 별도 근거 없이는 성립하지 않는다.
다음 업무 카드: 실제 제품 부품 모델, 작업면/Anchor, 고정 방식과 조립 절차 근거를 확보해 Proxy를 실제 구성으로 교체하고 공정-설비 Gate를 검증한다.

## 부지별 설비 카메라 표시 대상 · 2026-09-27

- 원인: 부지 카메라가 해당 부지의 설비와 가상 작업물을 한 Bounds로 맞추므로, 작업물/완제품이 멀리 배치된 시점에는 설비가 작아지거나 한 공정만 보이는 것처럼 인식될 수 있었다.
- 해결: 각 부지 카메라에 `설비 보기`(기본값), `설비·작업물`, `작업물 보기`를 추가했다. 객체 종류와 부지로 먼저 필터링한 뒤 선택된 그룹만 카메라 프레임을 계산한다. 카메라 모드와 회전·확대 상태는 부지별 독립이다.
- 자동화: `product-planner-multiview.test.cjs` 모드·부지 필터 단언 6/6 PASS, Product Planner 전체 테스트 16/16 PASS; JS 문법 검사 PASS.
- Production 브라우저: 카메라 로딩 후 3개 부지 카드 모두 별도 3D 카메라/설비 표시를 확인했다. 전체 공정 재생은 255.0/255.0분, 부지별 작업 4/4·8/8·19/19 완료, 가상 모듈 12/12 결합, 완제품 1/1 출고로 종료됐다. 첫/둘째 부지는 각자 배정된 여러 설비가 보이고, 셋째 부지는 조립 설비가 별도 프레임에 표시됐다. 첫 카드에서 `설비·작업물` 전환과 안내 텍스트/aria-label 갱신도 확인했다.
- 범위 한계: 예시 공정은 `FUNCTIONAL_DEMO`; 실제 자동차 생산검증이 아니다. 현재 설비 GLB 후보 5/13만 연결, 실제 설비 Animation Clip/검증된 기계 동작 0개다. 나머지 8개 미배정 설비는 3D에 표시되지 않는 상태가 정상적으로 안내된다. 운송 중/완료 상태에 따라 작업물이 부지에서 사라지거나 도착지로 이동하는 것은 동일 실행시간 기준이다.
- 배포: 정적 HTML/JS/CSS만 반영, 이전 3개 파일은 `/home/sjkim/backups/product-planner-site-camera-modes-20260927/`에 보존. DB·레이아웃·USD/GLB 변경 0, 서비스 재시작 0. HTTP 정적 파일 3/3 200과 신규 query revision 응답을 확인했다.
- 후속: 실제 요구에서 모든 공장의 설비가 반드시 상시 화면에 남아야 한다면 이 요구는 완료/소비 상태를 반영하는 작업물 표시와 분리해 설비 목록·고정 표시 옵션으로 보완한다. 실제 설비 동작은 가동부 근거와 Clip/Pivot 계약이 확보된 설비부터 별도 검증한다.

## 실제 설비 가동부 Pilot 준비 · E096

- 전체 724 GLB의 기존 spatial node inventory에서 `ORIGINAL_NODE_ANIMATABLE=273`, `WHOLE_MESH_ONLY=451`을 확인했다. 이 분류는 별도 Mesh Object3D를 대상으로 transform 시험이 가능한 후보 분류이며 실제 가동부·제조사 동작 증명이 아니다.
- Pilot `E096 소형 프레스`에는 독립 Mesh `Scene/Asset/Model/ram`이 있고 기존 node inventory에는 parent `Model`, local position `[0,0,-1.21]`로 기록돼 있다. 원본 GLB에 내장된 애니메이션 또는 실제 stroke 근거는 확인되지 않았다.
- 제품 플래너 실행 검토에 별도 `E096 Ram 왕복 검토 열기` 링크를 제공한다. Pilot은 Production GLB를 읽기 전용 GLTFLoader로 로드하고 UI 입력 변위로만 Mesh를 움직이며 계획·DB를 저장하지 않는다.
- Production URL `product-planner-e096-motion-pilot.html?rev=e096-ram-pilot-2`에서 E096 GLB browser Range HTTP 206(일반 fetch HTTP 200) 및 `glTF` 서명, 실제 Three.js GLTFLoader Scene 생성 PASS. 독립 `ram` Mesh 발견 PASS, GLB 내장 Animation Clip 0.
- CUA 화면에서 프레스 Geometry를 확인하고 왕복 시연 중 Ram Mesh 위치 변화 프레임을 시각 확인했다. Pause 후 위치 유지, 원위치 버튼 후 GLB 기준 transform 복구 문구/화면을 확인했다.
- 변환축 계산 결과 `local +Z → world (0.000, -1.000, -0.000)`이다. 화면에는 후보 축으로만 표시하며 실제 기계의 기준축/제어축으로 승인하지 않는다.
- 입력 `0.10m / 4s`는 조절 가능한 FUNCTIONAL_DEMO 초기값이다. 제조사 Stroke·Pivot·실제 Kinematics·작업물 접촉은 미검증. DB·생산계획·Asset Registry·원본 GLB는 변경하지 않았다.
- 정적 검사: `node --check product-planner.js`, `node --check product-planner-details.js`; `node --test product-planner.test.cjs` 15/15 PASS. Pilot/문서 URL을 Production 정적 경로에서 읽을 수 있도록 반영했다.
- Production 백업: `/home/sjkim/backups/p006-e096-motion-pilot-20260926-170219/` (66,104 bytes, 반영 전 planner HTML 및 설계·QA·CAR-V2). 배포 후 Pilot HTML 12,902 bytes와 Pilot 설계 3,657 bytes; DB 변경 0, 서비스 재시작 0, USD/GLB 변경 0, 비용 $0.
- 다음 Gate: 제조사 Stroke/Pivot 자료와 별도 작업물 모델·접촉/거치 높이 증거를 확보한 뒤에만 실제 공정 애니메이션 controller에 연결한다.

## 전체 공정 애니메이션 단일 실행 · 2026-09-26

- `실행 검토`에 `전체 공정 애니메이션 재생`을 추가했다. 클릭 시 일정 유효성을 검사하고, 꺼져 있던 흐름 애니메이션은 명시적 요청에 따라 켠 뒤 3D 가상 모듈과 사이트별 카메라를 준비하고 0분에서 전체 실행을 시작한다.
- 재생 전 모델을 별도 로딩해야 하는 단절을 없앴다. 기존 `ProductPlannerDetails.load()`에 로딩 성공/실패와 준비 상태를 반환하게 해, 준비 실패 시 거짓 3D PASS 대신 일정 흐름도만 재생하고 안내한다. 개별 단계 버튼은 `일정만 실행`으로 구분했다.
- 도움말·설계·자동차 데모 절차도 새 단일 재생 버튼과 재생 재시작 동작 기준으로 갱신했다.
- 정적 검사: `node --check product-planner.js`, `node --check product-planner-details.js` PASS. 기존 일정/계산 회귀 테스트 15/15 PASS. 운영 정적 파일 HTML/JS/설계/QA URL 200.
- Runtime/browser 검증: 실제 페이지에서 전체 공정 버튼을 눌러 3D와 부지 카메라 자동 준비, 진행 시간 79.7분의 이동 장면, 운송 중 동기화, 완성 형상을 CUA 화면 캡처로 확인했다. 최종 상태 `255.0/255.0분`, `준비 12/12`, `운송 중 0`, `조립 완료 12/12`, `완제품 출고 1/1`; 실행 완료가 브라우저 저장에 기록됨.
- 성능 시연 배속 600×에서 255분 계획의 산술상 재생 구간은 25.5초(모델 준비 시간 제외; 실측 전체 벽시계 시간으로 혼동하지 않음). 기능 작업·문서·검증은 2026-09-26 16:21~16:48 KST, 약 27분.
- 범위: 현재 자동차 모듈은 기존 12모듈/15개 수량의 `FUNCTIONAL_DEMO`; 제조사 검증 BOM, 실제 부품 USD/GLB, 설비 기계 동작, 물리 시뮬레이션이 아니다. 제품/설비/레이아웃/관계 DB 작성은 하지 않는다.
- 산출물/다음 카드: 실제 차량 BOM·부품 USD/GLB 확보, 확인된 설비 가동부 Node/Pivot 근거 수집 후 실제 설비 애니메이션을 별도 Gate로 추가한다.
- 운영 백업: `/home/sjkim/backups/p006-whole-process-animation-20260926/` (115,352 bytes). 정적 리소스만 교체, 기존 대비 배포 파일 순증 약 6 KB, 백업 포함 총 추가 저장량 약 0.12 MB. DB 변경 0, 서비스 재시작 0, 원본 USD/GLB 변경 0, 신규 비용 $0.
- 인라인 시각 증거: 실행 중(가상 부품 이동/차체 frame) 및 완료(청록색 가상 완성차) 화면 캡처를 현재 Codex 작업에 남김. 운영 DB 저장이나 Omniverse 동작으로 확대 해석하지 않음.

## 외부 RC Car GLB 전체 GLTFLoader·WebGL 검증 · 2026-09-26

- 인벤토리에서 별도 후보 검증 화면으로 진입 가능한 버튼을 추가했다. NVIDIA 공개 저장소 immutable revision `407bd553ee57668ceb58d81ffd7f4d617dee3dfa`의 GLB를 브라우저에서 직접 전체 fetch하여 실제 Three.js `GLTFLoader.parseAsync`로 파싱했다.
- 실제 응답 6,757,152 bytes; 임시 원본 파일 SHA-256 `3297b6d06830f0ceb1f023488610ba8bb9da0f9f165dc1f4fec273788fc62486`; 1 Mesh, 28,648 Vertex, 49,999 Triangle, Material 1, Texture 3, animation clip 0. GLB JSON node 1 unnamed; Three.js Scene Object3D 2. `matrixWorld` 갱신 후 `Box3` 측정 및 실제 WebGL 화면 표시 PASS.
- 시각 검수 화면에는 작고 어두운 단일 텍스처 물체가 보인다. 전체 차량이나 특정 부품이라고 판정하지 않았다. 범위/단위 미확정: Bounds 약 0.0975×0.0772×0.1077 GLB 단위; 실측 m로 주장하지 않는다.
- 1차 실행은 HTTP origin에 Web Crypto `crypto.subtle`이 없어 파싱 전 멈췄다. UI를 보완해 브라우저 해시 API가 없는 경우 해시 표시만 분리하고 GLTFLoader 작업을 지속하도록 수정했다. 후속 실제 운영 브라우저 실행은 Parse/Render PASS.
- 스크린샷은 현재 3D 검증 화면을 CUA 브라우저 캡처로 시각 확인했다. 페이지는 외부 원본을 읽기만 하며 P006 DB/제품/관계/레이아웃에 쓰지 않고 GLB 파일도 서버 자산에 복사하지 않았다.
- 정적 반영: 검토 화면, 인벤토리 버튼/상태, 정적 JSON, 화면 설계 문서와 모델 확보/QA 문서를 갱신. 백업: `/home/sjkim/backups/product-planner-external-rc-glb-review-20260926`. 정적 페이지이므로 서비스 재시작 없음.
- 다음 업무 카드: 1) GLB 개체 정체성·단위·용도 원문 확인, 2) 구조화 BOM/제품 대응 증거 조사, 3) 라이선스의 실제 파생·재배포 범위 확인. 근거가 들어오기 전까지 외부 후보/비승인 및 제품 0/12 집계를 유지한다.

## RC Car USD Prim 구조 및 GUI 시각 검증 · 2026-09-26

- 기존 정적 USD 실사에서 미검증이던 Omniverse GUI Gate를 NVIDIA Omniverse Kit RTX 2.0에서 실제 확인했다. 임시 읽기 전용 확장으로 `/tmp/p006-rc-omniverse-review-20260926/_Class1RC.usd`를 열었으며 `STAGE_OPEN_PASS`, defaultPrim `/World`, source USD SHA 일치가 확인됐다.
- 실제 뷰포트와 Stage tree에서 섀시 플레이트, suspension-arm Xform 그룹, 앞/뒤 unsprung-mass 그룹, 좌우 타이어/휠 메시가 표시되는 것을 확인했다. 모델 외형은 RC 차량의 하부 섀시/주행부로 한정 확인했다. 완전한 외장 바디나 완성 RC카 BOM을 증명하지 않는다.
- Kit 활성 Stage는 74 Prim을 표시하지만 source USD는 59 Prim(36 Mesh/23 Xform)이다. 나머지 15 Prim은 `/Render`, viewport camera, light rig 등 Kit가 세션에 추가한 씬 요소이며 소스 USD Geometry 수에 포함하지 않는다.
- `UsdPhysics.Joint` 0, `UsdSkel.Skeleton` 0, `UsdSkel.Animation` 0, time-sampled attribute 0. 따라서 현 USD 안에는 재생 가능한 suspension/steering 애니메이션이 확인되지 않았다. 소스 README의 physics-joint 작업 언급은 이 변환 USD의 동작 증거가 아니다.
- USD 공간 범위는 stage 단위 x=[-20.06,20.06], y=[-13.54,13.54], z=[0,8.62]. `metersPerUnit=0.01`이므로 대략 0.4012×0.2708×0.0862 m이다. stage Z-up.
- 결과물: `evidence/p006-rc-car-omniverse-20260926.png`, `p006-rc-car-usd-structure-report.json`. 화면/JSON/QA/모델 확보 문서만 갱신. P006 제품 원장·카탈로그·계획·DB·레이아웃 변경 0.
- Kit 부팅 중 기존 `libxml2.so.2` 미설치로 asset-converter 확장이 실패하고 debugpy 3000 포트 점유 경고가 남았으나, USD Open과 RTX 렌더는 성공했다. 이 오류는 변환기/디버거 쪽으로 분리하며 이번 USD 검수 결과와 혼동하지 않는다.
- 자동 검증: inventory JSON schema parse, UI inline JS syntax, 기존 제품 플래너 회귀 테스트를 수행한다. 실제 웹 배포 이후 스크린샷/HTTP/JSON 경로를 별도 재검증한다.

## 자동차 모델 실사 결과 화면 · 2026-09-26

- 제품 단계 모델 현황 옆에 `자동차 모델 실사 결과` 링크와 단독 읽기 화면을 추가했다.
- 화면은 inventory JSON을 읽어 1개 완성차 + 12개 주요 부품 모델의 미확보 상태와 7개 참고 GLB 후보의 실제 경로/파일 크기/확인 수준을 렌더링한다.
- 데이터는 같은 출처의 P006 정적 JSON이며, 설비 후보를 차량 부품으로 표시하지 않고 제품 적합성 미검증 경고를 포함한다.
- JSON 문법 검사 PASS. 실제 배포 브라우저에서 JSON 로딩, 제품 모델 미확보 0/12, GLB 후보 7/7 표, 안내 문구 및 레이아웃을 시각 검수했다.
- 제품 첫 단계의 모델 현황 표에서 `자동차 모델 실사 결과` 진입 링크가 보이는 것을 확인했다. 원래 저장 계획은 편집·저장하지 않았다.

## 설비 GLB 실제 3D 파싱 Pilot · 2026-09-26

- 실사 페이지에 독립적인 GLTFLoader 3D 검증 링크를 추가했다. 테스트용 고정 자산 N076/E148/E121/E053/A195만 로드하며 기존 계획·저장소는 편집하지 않는다.
- 초기 설비 후보 5/5 GLTFLoader 파싱 PASS (Mesh 115, Triangle 1,828)에 이어 범용 구성요소 E240/E245도 실제 Scene 파싱·표시 PASS했다. 총 7/7, Mesh 138, Triangle 2,492.
- 7개 모두 GLB 내장 Animation Clip 0개. 애니메이션 재생 버튼은 비활성화되어 있고 합성 동작은 제공하지 않는다. 이는 설비에 가동부가 없다는 판정이 아니라 GLB에 애니메이션 클립이 없다는 뜻이다.
- 자동차 완제품/부품으로의 의미 매칭, 공정 적합성, 실제 설비 동작은 검증 범위 밖이다.
- 최종 실사 화면(`product-planner-model-inventory.html?rev=pilot-3`)에서 7/7 GLTFLoader 지표와 자산별 PASS 상태, 0/12 제품 모델 미확보, GLB 7개 목록 및 별도 3D 검증 링크를 브라우저에서 재확인했다. 3D 화면에서 7개 실물 Scene을 시각 확인했다.
- 정적 파일만 Production 경로에 반영했다. 기존 4개 산출물은 `/home/sjkim/backups/product-planner-glb-pilot-final-20260926`에 보존했고, 설치 후 SHA-256 확인을 통과했다. DB·레이아웃·제품 계획은 변경하지 않았다.

## 자동차 실제 모델 자산 원장 실사 · 2026-09-26

- Production `entries.json` 724건과 GLB manifest 724건을 읽기 전용으로 대조; 차종/자동차 제품으로 명시된 실제 완제품·주요 부품 모델은 0건.
- 자동차 관련 이름 매칭 5건(A176, A387, A530, E046, N008)은 타이어 제조 설비, 안전 범퍼, 배터리 시험기, 차량 인프라 등 제품 부품이 아님.
- P006 frontend에 905개 USD/GLB/GLTF 파일이 있으나 자동차 제품 모델 파일명 검색 결과는 0건. 내부 Mesh 의미 전체 판독은 하지 않았으므로 부재 판정은 파일명·카탈로그 메타데이터 범위로 제한.
- 설비/범용 참고 GLB 7개(N076, E148, E121, E053, A195, E240, E245)는 HTTP HEAD 200·GLB 서명 PASS 및 GLTFLoader 전체 파싱·화면 표시 7/7 PASS. 총 Mesh 138, Triangle 2,492, Animation Clip 0. 자동차 제품 부품 의미와 공정 적합성은 미검증.
- 상세 증거와 다음 입력 요건: `PRODUCT-PLANNER-CAR-MODEL-INVENTORY-2026-09-26.json` 및 `PRODUCT-PLANNER-MODEL-ACQUISITION.md`.
- 관계/레이아웃/DB 데이터 변경 없음. 자동차 실제 형상 조립은 완제품·부품 USD/GLB와 BOM/앵커 자료가 제공되기 전까지 미완료로 유지.

## 모델 경로 점검 · 2026-09-26

- 제품·부품·설비 연결 화면에 `모델 경로 점검`과 안내 상태 영역을 추가했다.
- 입력된 계획 GLB와 기존 카탈로그 참고 GLB를 서로 구분해 검사한다. 동일 origin 및 `/projects/P006/assets/` 경로만 요청하고, HTTP 상태·HTML fallback·GLB `glTF` magic header를 확인한다.
- 동시 요청은 최대 4개. Range 요청 후 응답 스트림의 첫 chunk만 읽고 중단해 GLB 전체를 계측 목적으로 다운로드하지 않는다.
- USD는 웹 브라우저에서 원본 USD 검증을 수행하지 않으며, 로컬/서버 내부 경로·외부 URL은 검사 불가 또는 제외 상태로 명시한다.
- PASS 의미 제한: HTTP+헤더 접근성만 확인. GLBLoader 파싱, USD composition, 자동차 부품/차종/BOM/설비 적합성 및 조립 검증으로 승격하지 않는다.
- 자동화 검증: `product-planner-details.js`, `product-planner.js`, `product-planner-multiview.js`, `product-planner-car-demo.js` 구문 검사 PASS; `node --test product-planner.test.cjs` 15/15 PASS.
- Production 브라우저 검증: 제품 계획의 연결 GLB 0/0, 카탈로그 후보 GLB 7/7이 HTTP 응답 및 GLB `glTF` 서명 점검 PASS. 결과는 후보 모델 경로만 확인하며 실제 자동차 제품 모델 연결을 뜻하지 않는다.
- 미적용 임시 경로를 입력한 상태에서는 검사 차단 안내가 표시되는 것을 확인했다. 임시 변경은 저장·적용하지 않고 페이지를 새로고침해 기존 계획 상태로 복귀했다.
- 시각 검수: `모델 경로 점검` 결과와 모델 연결 표가 화면에 표시되는 것을 확인했다.
- 제한: USD 원본, GLTFLoader 전체 파싱, 제품/설비 적합성, BOM 및 조립 가능성은 이 점검의 대상이 아니며 별도 미검증이다. DB·관계·레이아웃 데이터 변경과 서비스 재시작은 없었다.

## 2026-09-26 자동차 주요 모듈 3D·부지 카메라 회귀

- 검증 URL: `product-planner.html?rev=repeat-render-1` (운영 정적 페이지)
- JS syntax: `product-planner-details.js`, `product-planner-multiview.js`, `product-planner-car-demo.js` PASS.
- Schedule regression: `node --test product-planner.test.cjs` 15/15 PASS.
- Browser: 가상 조립 Scene 및 3개 부지 전용 카메라 생성, 부지 카메라 반복 로딩 후 화면 유지, 공통 시간 255.0분 완료를 확인.
- 완료 결과: 준비 12/12, 운송 중 0, 조립 12/12, 완제품 출고 1/1. 완성차 조립 부지에는 FUNCTIONAL_DEMO 완성 형상이 표시되고 부품 원산지 부지는 후속 이동 완료에 따라 빈 상태 안내를 표시.
- WebGL 복구성: `renderer.dispose()`만으로 리소스를 정리하고 Canvas Context 강제 소실은 피하도록 수정. 반복 로딩을 실제 브라우저에서 재확인.
- 범위 제한: 자동차 실제 제품 USD/GLB 0개, 차종 BOM/치수/실제 제조 적합성·설비 애니메이션·물리 이송 미검증. DB 서버 저장·새로고침 복원과 USD/Omniverse는 미측정.
- 데이터 영향: Product plan demo만 실행. Production layout, 관계 원장, 설비 Geometry 및 DB는 변경하지 않음.

다음 업무 카드: (1) 실제 차량/주요 모듈 USD·GLB 확보, (2) 차종 기준 BOM와 실제 공정시간의 출처 등록, (3) 설비별 가동부/anchor 증거 수집, (4) 실제 공장 layout 좌표와 부지 카메라 연결, (5) 서버 저장·복원 E2E와 브라우저 성능 프로파일링.

## 범위
신규 product-planner.html. 기존 공장·Geometry·관계 승인 데이터 변경 없음.
Luna: HTML/CSS·화면 설계. 주 작업: 일정·재고 계산, 입력 연결, 테스트와 배포.

## 실제 화면 검증
1. 가상 예시 선택: 부품3종·부지2개·공장2개 표시 PASS.
2. 입력: 하우징 제작20분/마감10분, 모듈 구매25분, 커버 외주35분.
3. 운송: 하우징·커버 각각12km, 운송20분+하역5분.
4. 출력: 하우징55분·커버60분 도착 → 60분 조립 시작 PASS.
5. 조립8분 → 검사5분 → 출고2분: 총75분·완제품1개 PASS.
6. 일시정지·재개·다음 단계·초기화 버튼 동작 PASS.
7. 애니메이션OFF: SVG 비표시, 단계 실행 유지 PASS.
8. 새로고침 후 입력·완료 상태75/75분·1/1개 복원 PASS (브라우저 저장).
9. 서버DB 저장·복원: 미검증. 위 브라우저 저장과 별개.
10. 실제 기계3D 동작은 범위 외. 입력 시간 기반 FUNCTIONAL_DEMO.

## 자동화
`node product-planner.test.cjs`: 12/12 PASS.
병렬 조달 합류, 마지막 부품 대기, 이벤트 중복 방지, 개당시간·수량,
운송 누락, 순환 참조, 조달 미정, 0분 처리, 애니메이션 독립성,
JSON 왕복, 중복 운송, 출고 미연결 검증. JS 문법검사2개 PASS.

## 다음 업무 카드
1. Asset Registry candidate mapping: N076/E148/E121/E053/A195; 자동차 공정 적합성은 미검증.
2. 실제 자동차 완제품·주요 부품 USD/GLB 확보 후 부품/조립 모델 연결.
3. 설비별 가동부 Pivot/Axis와 실제 Animation Clip 조사; 위치 링을 기계 애니메이션으로 오인하지 않는지 확인.
4. 공유 설비 자원 경합·다중 공장 가공·완제품 운송 확장.
5. 서버 저장·복원 별도 E2E 검증. 완료 전 DB PASS로 보고하지 않음.

## Asset Registry/3D 연결 QA · 2026-09-25
- JS syntax check (`product-planner-details.js`, `product-planner.js`, `product-planner-core.js`): PASS.
- Core schedule regression: 15/15 PASS.
- Catalog list: 724 registry rows and 724 GLB manifest rows; exact browser runtime confirmation pending.
- Candidate button fills only asset IDs found in catalog; mapping remains user-applied and marks automotive fit unverified.
- Runtime 3D preview loads real GLB files; orange ring is process-location emphasis only. Actual machine movement, product mesh, and car assembly remain unverified/not available.
- Production route browser visual confirmation, HTTP/model response, and screenshot: pending this deployment.

## 모델 현황표 · 2026-09-25
- 제품 첫 단계에 완제품·BOM 부품·설비 후보의 USD/GLB 상태 표와 카탈로그 경로 요약을 추가.
- 후보 5개는 등록 모델 경로와 계획 연결 상태를 구분하고, 공정 적합성은 미검증 상태를 유지.
- 배포 URL `product-planner.html?rev=model-coverage-1` HTTP 200 및 JS 버전 확인.
- 브라우저 표기: 완제품 GLB 미연결, 주요 부품 GLB 0/12, 카탈로그 설비 후보 GLB 5/5.
- 화면에서 N076/E148/E121/E053/A195의 Asset ID와 `.usda`/`.glb` 파일명을 확인; 각 행은 `카탈로그 후보 · 계획 미연결`.
- 제품 단계의 구성 요약과 현황표를 실제 화면으로 시각 확인. 기존 저장 계획의 입력은 수정하지 않음.
- 이 턴에서 모델 파일 로드·자동화 테스트는 실행하지 않았으므로 파일 접근성과 3D 렌더는 별도 검증 대상으로 유지.

## 모델 확보 조사 · 2026-09-25
- Asset Registry 724건 및 entry-catalog 724건을 이름/분류/표현 경로로 대조.
- 차체, 배터리 팩, 섀시, 열관리, 전장, 시트, 대시보드, 유리, 외장, 등화, 휠/타이어의 차량 제품 형상 모델은 확인되지 않음. 제품 보유 수 0/12 유지.
- E240 서보 모터와 E245 감속기는 GLB가 있는 범용 개별 자산 참고로만 표시; 차량 규격·제품 대응 미검증, 자동 연결 금지.
- A530은 배터리 시험 설비, A176은 타이어 빌딩기, A195/A197은 하니스 설비로 분류하여 제품 부품으로 세지 않음.
- 제품 단계에 모델 확보 CSV 다운로드 추가. CSV 다운로드/내용은 이번 시각 검수에서 실행하지 않음.

## 모델 현황표 집계 보정 · 2026-09-25
- 렌더링된 현황 행을 단일 집계 원본으로 사용하도록 요약 수 계산 수정.
- 검증 기대값: 완제품 미연결, 주요 부품 GLB 0/12, 설비 후보 GLB 5/5, 범용 구동 참고 자산 2개(E240/E245); 차량 부품 적합성은 미검증.
- 이 변경은 표시 집계만 수정하며 계획 연결, 관계 상태, 저장 데이터를 변경하지 않음.
- 새 배포 URL에서 요약/행 일치와 CSV 버튼 표시를 시각 확인. CSV 파일 내용 다운로드 검증은 별도 미수행.

## 비용·시간
실행 파일·설계 약60KB (이미지·테스트 제외), 별도 유료 서비스 추가0개.
인프라·AI 사용료 미산정. 시작22:07:20 KST, 구현·검증 약16분.
원본 설계 수정·서비스 재시작 없이 신규 정적 파일 추가.

## 핵심
부품 도착과 공정 순서를 먼저 계산하고 애니메이션은 그 상태를 표시한다.
표시를 꺼도 재고·실행 결과는 동일하다.

## 외부 RC Car CAD 후보 추가 · 2026-09-26
- 모델 인벤토리 JSON에 NVIDIA Omniverse RC-Car-CAD 1개를 외부 후보로 추가했으며 P006의 실제 제품 모델 집계(0/1, 0/12)는 변경하지 않음.
- UI는 외부 후보/미도입, RC카이며 승용차 아님, 크기 미확인, MIT 고지 필요, BOM 파일 미발견, 소스 데이터 의도적 미완성 상태를 명시함.
- 후보의 NX/USD/GLB 링크 및 원격 Git tree 파일 크기를 표시. GLB는 HTTP Range 262,144/6,757,152 bytes만 메모리에서 받아 JSON 메타데이터를 확인: 무명 Node 1, Mesh 1, Animation 0. 실제 파일 저장·P006 서버 자산 반입·전체 GLTFLoader·USD stage parse는 미실행.
- HTML inline JavaScript syntax PASS, JSON classification/count assertions PASS, 기존 15개 product-planner tests PASS.
- 운영 브라우저에서 `?rev=rc-car-source-1#externalModels`를 열어 외부 후보 카드, 4개 파일의 크기/상태, GLB 메타데이터, BOM 제한, MIT 고지, 원본 링크를 AX 트리와 스크린샷으로 시각 확인. HTTP 화면/JSON/문서 4개 경로 모두 200.
- Production 변경 범위는 모델 인벤토리 정적 HTML/JSON과 안내문서만. DB, 제품 계획, layout, 관계 데이터는 미수정.

## 외부 RC Car USD Stage 읽기 전용 검사 · 2026-09-26

- USD 후보 `_Class1RC.usd`를 `/tmp/p006-usd-readonly-inspect`에만 받아 SHA-256을 기록했다. `usd-core 26.8`을 격리 경로에 임시 설치하고 실제 `Usd.Stage.Open` 수행: PASS.
- 검사 결과: 33,843,828 bytes; SHA-256 `b7101cc8918fc958ac1c80ef01499587c12227adbdb4f3df1aefedaac06afaf1`; `/World`; Z-up; 0.01 m/unit; 59 prims, 36 Mesh, 23 Xform; 1,762,662 points, 587,554 faces; external references 0.
- 동작 Gate: joint prim 0, time-sampled attribute 0. 따라서 이 USD Stage 자체에는 검출된 rig/joint/시간 애니메이션이 없다. README의 physics-joint 작업 이정표는 현 USD에 완성된 애니메이션이 들어있다는 증거가 아니다.
- OpenUSD가 deprecated USDC crate version `0.7.0` 경고를 출력했다. 현 parser에서 Stage Open은 됐지만, 향후 USD 구현과의 호환 위험을 별도 기록했다.
- 이번 검사로 Omniverse GUI render, 시각적 자동차 식별, NX assembly 완결성, 차종 BOM/제품 모델 적합성은 PASS하지 않았다. GLB Full GLTFLoader parse도 미실행이다.
- UI/JSON에 수치와 검증 범위를 업데이트했다. 상태는 외부 후보·미도입 유지. P006 제품 원장/카탈로그/레이아웃/DB 변경 0.
- 임시 inspection 및 전송 staging 디렉터리를 검증 후 삭제했다. USD 33,843,828 bytes + LICENSE 1,073 bytes + 격리 OpenUSD 패키지를 포함해 제거된 임시 공간은 `du -sb` 기준 251,491,634 bytes. 실제 반영된 Production 파일은 47,430 bytes, 롤백 백업은 42,057 bytes이며 백업 경로는 `/home/sjkim/backups/product-planner-usd-stage-inspection-20260926`.
- 정적 화면과 JSON은 HTTP 200으로 재확인했다. 브라우저 페이지에서 USD Stage 결과 카드, 59/36/23 Prim·Mesh·Xform 수치, 정적 애니메이션 부재, P006 미반입 상태를 시각 확인했다. 15/15 제품 플래너 회귀 테스트 PASS, inline JS 문법·JSON assertion PASS.

## RC Car USD 구조 부품 후보·검토 순서 화면 · 2026-09-26

- 작업 범위: 외부 RC Car `_Class1RC.usd`의 기존 Stage 보고에서 상위 Xform 그룹 9개를 추출하고 6개 표시 항목에 정리. 제품 단계 카드, 구조 상세 화면, 구조 JSON 및 설계·도움말·QA 자료를 추가.
- 계층/mesh 확인: chassis 2 Mesh; front upper arms 2 그룹/6 Mesh; front lower arms 2/6; trailing arms 2/6; front unsprung group 8; rear unsprung group 8. 합계 9 Xform group, 36 Mesh, 1,762,662 points, 587,554 faces.
- 조립 순서 화면은 `STRUCTURAL_REVIEW_ORDER_PROPOSAL`. 제품 BOM 수량·구매/제작 방식·공정 순서·작업시간·기계 애니메이션 승인을 뜻하지 않는다.
- USD 원본을 P006에 반입하지 않음. plan/catalog/relationship/layout/DB 변경 0. 기존 12종 자동차 functional demo에도 자동 연결하지 않음.
- 자동 검증: JSON 구조 집계와 경로 수 assertion PASS; planner 회귀 테스트 15/15 PASS; inline JS 문법 PASS.
- 운영 HTTP 확인: Planner·상세 화면·구조 JSON·설계/QA 문서 5개 URL 모두 HTTP 200. 브라우저 AX로 6개 항목·5단계·59 prim/9 그룹/36 Mesh/0 joint·0 animation 표시를 확인했다. 시각 캡처에서 prim 경로 표와 검토 순서 섹션이 보인다. Planner 제품 단계에서 구조 검토 카드 및 상세 화면 진입 링크도 확인했다.
- 다음 업무 카드: 독립 USD/GLB 부품 export 권리 확인 → CAD 소유자의 부품명/BOM 수량/좌우 및 실제 조립 순서 확인 → joint/pivot/axis/범위 근거 취득 → 승인된 모듈만 공정·3D에 연결.

원씽: 정적 CAD 그룹을 제품 BOM이나 동작 애니메이션으로 오인하지 않고, 승인 가능한 구조 후보를 Planner에서 검토하게 했다.

깨달음: USD의 계층 분리는 검토 가능한 구조 단위이지 곧바로 BOM·조립 공정·애니메이션 근거가 되지 않는다.

## RC Car 실제 USD Mesh 3D 구조 그룹 조립 검토 파일럿 · 2026-09-26

- 제품 Planner에서 RC Car 구조 검토 화면과 별도 3D 시연 화면을 연결했다. GLB는 사용자 버튼을 눌러 로드하므로 화면 진입만으로 28.2 MB를 내려받지 않는다.
- 원본 `_Class1RC.usd` 33,843,828 bytes, SHA-256 `b7101cc8918fc958ac1c80ef01499587c12227adbdb4f3df1aefedaac06afaf1`; 실제 변환 GLB 28,242,564 bytes, SHA-256 `16eed1958b41de70266d27e47f93c4aefc04ef8de17091a266308de8b3b79bff`.
- 실제 로드된 모델 결과: 구조 그룹 6, Mesh 36, Vertex 1,762,662, Triangle 587,554. 원본 USD 비교 검증은 Mesh·점·면 수 일치로 통과. GLB 변환 시 OpenUSD world transform과 0.01 m/unit 적용, Z-up → Y-up 변환.
- 실제 브라우저에서 GLTFLoader 모델 로드 PASS; 분해 보기 PASS; 조립 시연 끝까지 재생 PASS; 일시정지 PASS; 이어서 재생 PASS; USD 원본 위치 초기화 PASS. 완료 UI 문구 및 모델 캔버스를 실제 화면에서 시각 확인.
- Planner 제품 카드의 3D 구조 그룹 조립 시연/구조 근거 링크를 확인. 회귀 테스트 `node --test product-planner.test.cjs`: 15/15 PASS.
- 범위 제한: 원본 USD에서 joint 0, animation clip 0. 따라서 재생은 구조 그룹을 설정된 2초/단계로 이동하는 `USER_DEFINED_TRANSLATION_ASSEMBLY_REVIEW` 데모이며, 차량의 실제 조립·체결·가동부 애니메이션이나 승인된 공정 순서가 아니다. BOM·제품 적합성·실제 조립 가능성은 계속 미검증.
- 변경 범위는 별도 정적 뷰어·변환 GLB·manifest·라이선스·도움말/설계/QA 링크뿐. 제품 DB·BOM·카탈로그·layout·관계 데이터·원본 USD/GLB는 변경하지 않았고 서비스 재시작도 없다.
- 신규 변환 GLB는 28,242,564 bytes(약 26.9 MiB). DB 추가 용량 0 bytes. 별도 유료 서비스 추가 0개, 비용 $0; 기존 인프라/모델 사용료는 별도 산정하지 않음.
- QA 링크에서 전체 브라우저 조작 검증 후 확인된 화면 캡처는 이 작업 기록에 포함. 배포 대상 Planner·구조 근거·3D 뷰어·GLB·manifest·license의 HTTP 상태는 200으로 확인.

원씽: 정적 USD Mesh를 손상 없이 웹 3D로 열고, 구조 그룹 이동 데모의 재생·일시정지·복원까지 실제 화면에서 확인했다.

깨달음: CAD의 구조 그룹은 3D 검토 시연을 가능하게 하지만, joint/animation이나 검증된 조립 순서의 대체 근거는 아니다.

다음 업무 카드: CAD/BOM 담당자에게 부품 실명·수량·좌우 대응·조립 순서와 체결 기준을 승인받고, 필요한 경우 pivot/axis/limit이 포함된 원본 animation/joint 자료를 확보한다. 그 후에만 제조 공정 애니메이션 Pilot을 별도로 시작한다.

## RC Car CAD·BOM 검토 입력·인계 UI · 2026-09-26

- 신규 화면: `product-planner-rc-car-review.html`; Planner와 구조 검토 페이지에 진입 링크를 추가했다. 원본 후보 JSON의 SHA를 로컬 초안 키와 가져오기 검증에 사용한다.
- 6개 구조 그룹 각각에 공식 부품명, 정수 BOM 수량, 좌우/적용 범위, 조립 순서, 결합 상대, 동작 구분·축·범위, 근거 식별자, 검토자를 기록한다. 비어 있거나 잘못된 필드가 있으면 승인 차단. 동작 미확인 확정은 구조/BOM 입력 검토만 허용하며 애니메이션 Gate와 분리한다.
- 저장은 현재 브라우저 `localStorage`에 한정되고 JSON 내보내기/가져오기를 지원한다. 가져온 승인 상태는 신뢰하지 않고 전부 후보로 강등하며 원본 USD SHA가 다르면 가져오기를 거절한다. 생산 DB, BOM 원장, 제품 카탈로그, 관계·Flow API에는 쓰지 않는다.
- 브라우저 검증: 후보 6개·사용자 승인 0개 표시 확인; 누락 필드로 승인 시 차단 확인; `QA_FIXTURE_ONLY` 임시 입력으로 필수 항목을 채웠을 때 UI의 승인 Gate가 통과하는 것 확인; 새로고침 후 로컬 초안/승인 수 복원; 임시 QA 데이터를 삭제한 후 0 승인 및 빈 입력 상태 복귀 확인. QA fixture는 사람의 설계 검토나 실제 BOM 사실이 아니며, 기록된 실제 승인 수는 0이다.
- 정적 HTML 인라인 JavaScript 문법 검사 PASS; 기존 Planner 회귀 자동화 `node --test product-planner.test.cjs` 15/15 PASS. 브라우저에서 신규 페이지 및 진입 링크 시각 확인. HTTP 200·배포 SHA는 최종 배포 확인 후 여기에 기록한다.
- 배포 범위는 정적 화면·설계·QA 문서와 Planner/구조 페이지의 링크다. DB·공장 레이아웃·생산 공정·기존 CAD/USD/GLB 자료 변경 0, 서비스 재시작 0. 저장 데이터 용량 추가 0; 유료 서비스 추가 0, 비용 $0(기존 인프라 비용 미산정).

원씽: CAD 소유자가 구조 후보를 실제 부품/BOM 근거로 확인할 수 있는 승인 입력면을 마련하되, 미검증 추정이 생산 자료로 승격되지 않게 했다.

깨달음: 입력 UI에서의 승인 Gate 통과는 검토 입력 형식의 완성도만 뜻하며 CAD 사실의 진위나 조립 기능 검증을 대신하지 않는다.

다음 업무 카드: 설계 담당자가 원본 CAD/도면을 대조하여 6개 항목을 입력·검토하고 JSON을 인계한다. 검토된 결과를 별도 승인한 뒤에만 서버 BOM/API 연동과 실제 Joint 기반 제조 애니메이션을 설계한다.

## 제품 시간표 ↔ E096 프레스 작업물 동기화 · 2026-09-26

- 두 화면을 같은 브라우저 출처에서 열고 `BroadcastChannel` 기반으로 전체 계획 시간을 E096 시연에 연결했다. 테스트 시에만 `차체 패널 성형` 공정에 E096을 임시 연결했으며, 재생 중 `전체 공정 동기화 · 재생`, `작업물 투입`, 계획 시간/위치 표시를 확인했다.
- 전체 계획 일시정지 시 파일럿 화면도 `전체 공정 동기화 · 일시정지`로 바뀌고 공정 완료 상태를 반영하는 것을 AX 화면에서 확인했다. 기존 계획의 E096 임시 연결은 해제했으며 현재 모델 연결표에는 USD 경로 0, GLB 경로 0이다.
- 최종 전체 공정 시연: UI의 600× 설정에서 실행 후 20초 대기 시 완료 확인, `255.0/255.0분`, `완제품 1/1개 출고`, `12/12 가상 조립 모듈 완료`, 이벤트 로그 54개(시작/완료 기록) 확인. 실제 완료 시각을 고정 벤치마크로 측정한 것은 아니다. 계획 시간 기반 `FUNCTIONAL_DEMO`이며 실제 제조 성능·자동차 BOM/부품 형상/물리 조립 검증은 아니다.
- 안정성 메모: 먼저 열린 오래된 Planner 탭은 이전 JavaScript를 캐시해 BroadcastChannel 연동 UI를 갱신하지 않았다. 두 탭을 최신 리비전으로 다시 불러온 뒤 동기화 확인을 통과했다. 같은 출처·최신 리비전 탭 조건을 도움말에 명시한다.
- 화면 캡처에서 실제 E096 GLB와 주황색 BoxGeometry 작업물의 상대 위치를 시각 확인했다. 캡처 시점은 계획 완료 후이므로 움직임 연속 영상 증거로 간주하지 않는다. DB 저장·서버 저장·설비 배치·관계 데이터 변경은 0.

원씽: 일정 실행 시간과 별도 E096 화면을 실제 동기화하여 작업물 투입 상태를 보여주되, 시연용 Box를 실제 자동차 부품으로 오인하지 않게 했다.

깨달음: 동기화 계약이 있어도 오래된 브라우저 코드가 남아 있으면 화면 반응이 끊긴다. 배포 후에는 리비전 갱신/탭 재로딩도 검증 경로에 포함해야 한다.

다음 업무 카드: E096을 테스트 계획에 다시 임시 연결해 동작 전 구간의 화면 녹화를 남긴 뒤 연결을 원복한다. 이후 실제 부품 Geometry·재료·금형·Stroke/Pivot 자료가 확보될 때만 제조 적합성 Gate를 진행한다.

## Product Planner 안 E096 공정 화면 임베드 · 2026-09-26

- 제품 Planner의 실행 단계에 E096 프레스 작업물 화면을 same-origin iframe으로 포함했다. 사용자는 저장된 계획에서 E096 설비 연결 후 **전체 공정 애니메이션 재생**을 한 번만 눌러 일정과 프레스 Pilot을 같은 화면에서 볼 수 있다. 별도 창 링크는 보조 수단이다.
- 검증 계획: `E096 프레스 작업물 공정 시연 · 자동차 모듈` (브라우저 `localStorage` 저장). 차체 패널 성형 25분/배치 행에 E096을 연결, USD/GLB 경로는 `/home/sjkim/OmniverseProjects/assets/catalog/E096.usda`, `/projects/P006/assets/3d-derived/E096.glb`; 해당 설비 적합성 및 시간은 검증되지 않았고 가상 예시다.
- 배포 화면에서 임베드 iframe의 Production GLTFLoader를 확인했다: E096 모델 응답 HTTP 206 Range 및 GLB PASS, `bed/ram/tool` 설명과 장면 상태 출력. 작업물은 Box Proxy이며 FUNCTIONAL_DEMO로 표시된다.
- 전체 공정 재생 1회로 255.0/255.0분 완료, 완제품 1/1 출고, 가상 조립 12/12, 이벤트 54개를 확인했다. iframe도 `전체 공정 동기화 · 완료`, `시연 완료 · 배출됨`으로 완료했다. 600× 속도는 짧은 UI 동작 검증용이며 생산시간 성능 측정이 아니다.
- 재생 중 32.8분에서 일시정지하여 상위 일정 `일시정지`와 iframe `전체 공정 동기화 · 일시정지`를 확인했다. 이후 전체 재생 버튼은 0분부터 재시작했다. 중단 지점에서 이어 재생하는 resume은 현재 제공/검증되지 않았다.
- `설계 저장` 후 새로고침하고 저장 계획을 불러와 제품명·12종 BOM·E096 연결을 확인했다. 저장 당시 25.0/255.0분 일시정지 실행 상태도 복원됐고, 전체 재생을 다시 실행해 완료까지 확인했다. 저장 위치는 브라우저 localStorage이며 서버 DB 저장은 아니다.
- 완료 시점 스크린샷에서 통합 실행 화면, E096 실제 GLB, 완료 상태, 작업물 위치를 시각 확인했다. 2D/3D 공장 배치, 실제 차체 패널 형상, 제조사 Stroke/금형/접촉·공정 적합성은 검증하지 않았다. DB·서버 공용 계획·레이아웃·관계 원장·원본 USD/GLB의 변경은 0.
- Production 변경은 Planner 정적 HTML 및 도움말/설계/QA 문서만. DB, 공장 레이아웃, 기존 관계 원장, 원본 USD/GLB 변경은 없다. 계획 저장 위치는 현재 브라우저 `localStorage`이며 서버 공용 저장은 아니다.
- 범위 제한: iframe은 실제 E096 GLB의 확인된 `bed/ram/tool` Mesh와 주황색 FUNCTIONAL_DEMO 박스를 표시한다. 실제 자동차 부품, Stroke, 기구학, 접촉, 제조사 공정 적합성은 미검증이다. 전체 자동차 계획 중 첫 연결 공정 25분에서만 E096 동작하고 나머지 공정 시간에는 대기 상태로 남는다.

원씽: 두 화면을 오가던 재생 절차를 제품 계획 안 한 번의 실행으로 묶었다.

깨달음: 화면 동기화 구조가 있어도 사용자가 보던 페이지에 장면이 없으면 ‘재생해도 안 보임’ 문제가 남는다. 동일-origin 임베드가 조작 단계를 줄인다.

다음 업무 카드: 실제 공정 실행의 다음 구현은 pause 지점에서 재시작하지 않고 이어가는 `resume` 동작과 reset을 계획·iframe 양쪽에서 일치시키는 것이다. 이후 실물 작업물 모델·제조사 Stroke/Pivot 자료를 확보해도 제조 적합성 Gate를 별도로 유지한다.

## E096 작업물·제조사 근거 재확인 · 2026-09-26

- 기존 724자산 인벤토리, E096 모션 적격성 레코드, GLB Node 인벤토리, Planner의 차량 부품 모델 실사 문서를 대조했다. E096은 `소형 프레스` / `PROCESS_EQUIPMENT`, USD 원본 경로 메타데이터와 웹 GLB를 보유하며 `ram`·`bed`·`tool` Mesh는 보이지만 제조사·모델 번호, 제조사 Stroke·Pivot·사이클 자료는 등록되어 있지 않다. `manufacturerVerified=false`, `kinematicsVerified=false` 상태를 유지한다.
- 차량/주요 부품 실사에서는 실제 승용차 완제품 및 부품 모델이 0건이다. 별도 NVIDIA RC-Car-CAD 외부 후보는 원격조종차 하부 구조 연구용이며 차체 패널 프레스 작업물로 대체하지 않았다. 해당 저장소도 CAD 데이터가 개발 중이며 완전하지 않다고 명시한다.
- 결과: E096과 주황색 `FUNCTIONAL_DEMO` Box의 같은 장면 동기화는 화면 시연 PASS로 유지한다. 실제 자동차 패널·물리 접촉·성형 공정으로 표시하거나 애니메이션을 `ANIMATION_VERIFIED`로 승격하지 않는다. 근거 부재는 자산 파일을 임의 수정하여 해결하지 않는다.
- 검증 방법: 로컬 등록 인벤토리/문서 정적 대조 및 공개 원본 저장소 설명 확인. Production 데이터·DB·설계·GLB/USD 변경 0. 실제 제조사 문서 확보 여부는 `NOT_FOUND_IN_AVAILABLE_SOURCES`; 공급자 전체를 검색한 증명은 아니다.

원씽: E096 화면 시연의 성공과 실제 성형 공정의 증거를 분리했다.

깨달음: Asset ID와 움직이는 Mesh는 장비의 정체성·실제 스트로크를 증명하지 않는다.

다음 업무 카드: 실제 프레스의 제조사/모델 식별 정보와 작업물 품번·크기·데이텀이 포함된 승인 USD/GLB가 들어오기 전까지 현재 화면은 `FUNCTIONAL_DEMO`로 유지한다. 자료 등록 후에만 수치·Anchor·접촉조건을 다시 산출한다.

## E096 전체 공정 이어 재생·초기화 동기화 수정 · 2026-09-26

- 회귀 원인/수정: 일시정지 후 전체 공정 버튼이 실행 위치를 유지하지 않고 처음부터 재생하던 경로를 고쳤다. 일시정지 상태에서는 버튼이 `▶ 이어서 재생`으로 바뀌고 저장된 simulation minute에서 계속한다. 완료 후에는 `↻ 처음부터 다시 재생`을 제공한다.
- 브라우저 검증: E096 Pilot 계획에서 60× 속도로 재생 후 19.8분에 일시정지, `이어 재생`을 눌러 22.9분까지 진행되는 것을 확인했다(0분 재시작 아님). 실행 중 E096 GLB 1/1이 로드되고 실제 프레스 Scene이 보였으며, 별도 표본에서 `Stroke 후보 0.298m` 시연 상태를 시각 확인했다.
- 초기화 검증: 초기화 완료 후 전체 공정 상태 `실행 전`, `0.0 / 255.0분`, 일시정지 버튼 비활성, 시작 버튼 원래 라벨을 확인했다. 세 부지 카메라가 모두 `공통 시간 0.0분`으로 돌아왔고 E096 상태는 `작업물 투입`, `Stroke 후보 0.000m`, 준비/운송/조립 완료 카운트 0으로 수렴했다. 따라서 상위 타임라인·부지 카메라·E096 작업물/프레스가 같은 초기 시점으로 동기화된다.
- 검증 제한: 전체 255분 계획을 이번 수정 검증에서 끝까지 재생하지 않았다. 작업물은 `FUNCTIONAL_DEMO` Box이며 0.298m는 geometry-derived 시연 후보이지 제조사 Stroke나 검증된 기구학/접촉이 아니다. 화면 동작 확인은 browser-local demo plan에 한정되고 서버 DB 저장/복원은 검증하지 않았다.
- 자동 검사: `node --check product-planner.js` PASS; `node --test product-planner.test.cjs` 16/16 PASS (paused runtime resumes from saved time 포함). HTTP 배포 파일 200 및 로컬/원격 SHA 일치 확인.
- 변경 범위: Planner 정적 JS/HTML 및 설계·QA 문서. DB/레이아웃/관계 원장/GLB/USD 원본 변경 0, 서비스 재시작 0, 신규 저장 데이터 0, 추가 비용 $0. 배포 전 정적 백업 생성.

원씽: 이어 재생은 일시정지 시각을 보존하고, 초기화는 타임라인·부지 카메라·E096 시연을 모두 0분 상태로 맞춘다.

깨달음: 설비 GLB가 화면에 보이고 움직이는 FUNCTIONAL_DEMO와 실제 제조 공정 검증은 별개다. 현재는 설비 표시와 시계 연동은 확인했지만 작업물·Stroke 물리는 아직 미검증이다.

다음 업무 카드: 전체 255분 시연의 연속 화면 녹화를 확보하고, 작업물 USD/GLB와 프레스 제조사 stroke/pivot 자료가 확보된 뒤에만 물리 공정 Gate를 재검증한다.

## 공정별 설비·작업물 연결표 · 2026-09-26

- 실행 검토 화면에 시간순 일정과 함께 `공정별 설비·작업물 연결표`를 추가했다. 각 행은 순번·작업 종류·부품/수량·부지/공장·시간 구간·설비 Asset/모델 경로·실행 화면 동작 상태를 표시하며, 일정 행과 같은 task ID로 진행 중/완료 강조를 연결한다. `공정·설비 연결 편집` 버튼은 기존 공정 편집 탭을 재사용한다.
- Production 브라우저 화면에서 저장된 `E096 프레스 작업물 공정 시연 · 자동차 모듈` 계획을 열어 확인했다: 27/27 시간표 행이 연결표에 출력되고, 설비 대상 공정 1/14개만 배정됨, E096 GLB 경로 입력 1개, 부품 GLB 0/12개, E096 동작 Pilot 1개, 자동차 작업물은 `FUNCTIONAL_DEMO`로 요약된다. E096 행에는 `E096.usda`와 GLB 경로 입력 상태, `E096 프레스·작업물 왕복 시연 · FUNCTIONAL_DEMO`가 표시되고, 나머지 미배정 공정은 `설비 미지정 · 동작 미연결`로 구분된다. 이 브라우저 확인에서는 별도 3D 모델 캔버스가 `모델 미로딩`이었으므로 GLB 경로 존재를 실제 로딩 성공으로 세지 않는다. 조달 행은 설비 대상 아님, 운송 행은 운송 설비 미지정 및 물리 운송 미검증으로 표시된다.
- 브라우저 표 렌더링과 스크린샷을 시각 검수했고 브라우저 error 로그 0건을 확인했다. 기존 설계의 계획 시간·자동차 주요 모듈 모델 미확보·물리/공정 적합성 미검증 제한을 그대로 유지한다. 실제 애니메이션은 연결된 E096의 검토용 `FUNCTIONAL_DEMO`뿐이며, 설비 미지정 13개 공정이나 부품 0/12 GLB를 완성된 설비 동작으로 간주하지 않는다.
- 저장 계획·DB·BOM·관계 원장·공장 Layout은 수정하지 않았다. UI 정적 자산만 배포하고 이전 파일은 `backups/process-links-20260926` 아래에 보존했다. 자동 테스트는 이번 UI 확인에 추가 실행하지 않았으며, JS 문법 검사와 실제 브라우저 렌더/콘솔 확인으로 범위를 제한한다. DB 추가 용량 0, 유료 서비스 추가 0, 신규 외부 비용 $0; 기존 서버 비용은 미산정.

원씽: 시간표 각 단계에서 작업물과 공장·설비·화면 동작의 연결 상태를 한 행으로 대조하게 했다.

깨달음: 설비·부품 경로가 계획에 들어 있는 것과 그 단계의 물리 공정/제품 적합성이 검증된 것은 별개다. 미지정과 `FUNCTIONAL_DEMO`를 가리지 않고 보여주는 것이 다음 연결 작업을 정확히 만든다.

다음 업무 카드: 설비 대상 공정 13개(출고 이벤트 제외) 중 현재 1개만 Asset 지정 상태다. 나머지 12개에서 실제 설비 Asset ID와 검토된 GLB 경로를 하나씩 연결하고, 포트·작업물 적합성이 입증되지 않은 동안 동작 상태는 계속 미연결로 둔다.

## 공정별 설비 Asset 후보 선택 · 2026-09-26

- 공정 편집 화면에 Asset Registry의 category와 GLB 경로 보유 자산을 이용하는 후보 표를 추가했다. 계획의 공정 종류별로 후보 범주를 표시하고 Asset을 선택해 기존 모델 입력란에 복사한다. `DISPATCH`는 설비 대상 공정 집계에서 제외한다.
- 후보 복사는 입력란만 채우며 `모델 연결·시간 근거 적용`을 누르기 전 계획 저장 상태는 바뀌지 않는다. 저장 적용 여부와 후보 선택 상태를 분리한다. 자동 범주 제안은 공정명 텍스트를 이용하는 검색 힌트다.
- 모든 후보에 기능/작업물 적합성, 실제 GLB 파싱, Port/Interface, 공정 동작은 미검증으로 표시한다. 관계·Flow·애니메이션 상태의 자동 승격은 없다. 선택 후보의 GLB 경로가 브라우저에서 열리는지 별도 점검하기 전에는 모델 로딩으로 간주하지 않는다.
- 구현 파일: `product-planner.html`, `product-planner.css`, `product-planner-details.js`. 설계 계약은 `PRODUCT-PLANNER-DESIGN.md`에 연결했다.
- 자동 검증: `node --check product-planner-details.js`, `node --check product-planner.js`, `node --test product-planner.test.cjs` PASS (16/16).
- Production 브라우저: 저장된 `E096 프레스 작업물 공정 시연 · 자동차 모듈`의 공정 단계에서 설비 후보 표를 확인했다. 총 14행 중 출고 1행 제외, 설비 대상 13개, 배정 1개, 미배정 12개로 표시된다. 카탈로그 724개와 GLB 경로 필드 724개를 후보 원천으로 읽으며, 이는 GLB 전체 파일 파싱 성공 수가 아니다. 차체 접합에서 `용접·접합` 범주와 21개 후보가 표시되고 `E148 · 스폿 용접기` 선택 시 USD/GLB 경로와 후보 출처가 기존 입력란에 채워짐을 확인했다. 후보 선택은 `저장 전` 상태이며, `모델 연결·시간 근거 적용`은 누르지 않았다. 설비 적합성, 실제 GLB 파싱·동작, 제품/작업물 호환성은 검증하지 않았다.
- 공정명만으로 범주를 정할 수 없는 `구동 모듈 제작`, `섀시 모듈 제작`은 자동 분류하지 않고 사용자 범주 선택 전 후보를 비워둔다. 이는 의도된 근거 경계다.
- 변경 범위: Product Planner 정적 HTML/CSS/JS 및 설계·QA 문서만 배포했다. DB/저장 계획/관계 원장/레이아웃/원본 USD·GLB 변경은 0, 서비스 재시작 0. 변경 전 QA 문서는 `backups/asset-candidates-qa-20260926/PRODUCT-PLANNER-QA.md`에 보존한다.

원씽: 공정별로 카탈로그 후보를 검색·입력하는 길을 만들되 선택만으로 생산 가능 판정을 내리지 않는다.

깨달음: 범주 일치와 GLB 경로 유무는 실제 설비 기능·작업물 호환성의 증거가 아니다.

다음 업무 카드: 후보 Asset을 실제 GLTFLoader로 개별 로드하고 hierarchy·bounds·가동부를 조사한 후에만 설비 대상 공정별 연결 검토를 진행한다. 자동차 제품·부품 적합성, Port/Anchor, 공정 시간은 별도 근거가 생기기 전까지 미검증으로 유지한다.

## 공정 시간 연동 설비 가시성 · 2026-09-26

- 실행 3D 구역에 설비 상태 칩을 추가해 공정·Asset ID·대기/현재 작업/완료·실제 표시 상태를 한곳에 노출한다. 개별 `보기`는 해당 설비 Bounds에 카메라를 맞춘다.
- 일정상 실행 중인 설비는 3D 바닥 footprint를 주황색 링으로 강조하고 `현재 작업 설비 따라가기` 옵션으로 단계 전환 시 카메라를 이동한다. 링/상태칩은 기계 동작이나 작업물 접촉을 뜻하지 않는다.
- GLB에 Animation Clip이 실제 있을 때에만 AnimationMixer로 시간표 진행률에 맞춰 Clip을 샘플링한다. Clip 없음은 정적 설비로 표시한다. E096은 내장 Clip이 없을 때 기존 명시된 FUNCTIONAL_DEMO ram 후보를 사용한다.
- 도움말과 설계 계약에 정적 설비·Clip 재생·E096 시연 경계를 추가했다. 페이지 UI는 `product-planner-equipment-status.css`로 분리해 KRDS 공통 색상/형태를 재사용한다.
- 수행 기록: 구현/문서 수정 단계 완료. 자동화/브라우저 실행 검증은 이번 요청에서 실행하지 않았으므로 PASS로 주장하지 않는다. Production DB/레이아웃/계획 저장은 수정하지 않았다.

원씽: 계획 시간표의 현재 설비를 화면에서 찾게 하되, 실제 가동부 근거가 없는 자산은 움직이는 척하지 않는다.

깨달음: 모델이 화면에 로드되는 것, 공정 단계가 활성인 것, 기계가 물리적으로 동작하는 것은 서로 다른 상태이므로 UI에서도 나눠야 한다.

다음 업무 카드: E148 GLB에 Animation Clip/독립 가동 Node가 존재하는지 실제 실행 화면에서 조사하고, 0 Clip이면 제조사 동작·Pivot 근거를 확보하기 전 정적 표시를 유지한다. 이후 작업물의 실제 모델/치수/거치 Anchor를 연결해 설비 앞뒤 이동을 검증한다.

## E096 공정 사이클 실제 화면 재검증 · 2026-09-27

- Production Product Planner에서 저장된 `E096 프레스 작업물 공정 시연 · 자동차 모듈`을 불러와 실행 검토에서 전체 공정을 시작했다. 공정 연결표는 27단계 중 설비 대상 1/13개만 배정, E096 GLB 경로 1개, E096 Pilot 1개로 표시했다.
- 실제 실행 상태: GLB 로드 `1/1`, 실패 `0`; 주 3D 화면에서 E096 프레스와 주황색 작업물 Proxy가 함께 표시됐다. 시간표 진행 중 `E096 프레스 하강 · Stroke 후보 0.263m`, 후속 구간 `가공 시연 · 0.298m`, 종료 직전 `작업물 배출`, 이후 `E096 시연 배출 완료 · 0.000m` 상태를 확인했다. 설비 하이라이트만이 아니라 독립 ram/tool 변환과 작업물 이동을 화면 상태 및 GLB 장면에서 확인했다.
- 전체 공정 일시정지 때 계획 시간과 상태가 `일시정지`로 바뀌고, 초기화 때 `0.0 / 255.0분`, 준비/조립 카운트 0, E096 투입 위치 및 Stroke 후보 0으로 돌아왔다. 검증 후 기존에 열려 있던 `전기차 주요 모듈 조립 계획` 화면으로 복원했다.
- 검증은 기존 Production 기능의 브라우저 재생 확인이다. 소스 코드·서버 DB·제품 설계·BOM·공정 설비 연결·공장 Layout·원본 USD/GLB는 수정하지 않았다. 테스트 계획의 브라우저 실행 상태만 초기화했다. 실제 차체 패널, Press stroke/pivot, 금형 접촉, 작업물 재료, 제조 적합성은 여전히 미검증이며 이 애니메이션을 생산 시뮬레이션 또는 `ANIMATION_VERIFIED`로 승격하지 않는다.

원씽: 현재 E096 배정 공정은 작업물 투입 → 램 하강 → 가공 시연 → 램 복귀 → 작업물 배출로 실제 3D 장면에서 보인다.

깨달음: 화면 작동은 확인했지만 생성 Box 작업물과 Geometry 기반 Stroke 후보만 사용하므로, 실제 프레스 공정의 증거와는 분리해야 한다.

다음 업무 카드: E096의 제조사/모델·정식 Stroke/Pivot·금형 정보와 품번/치수/데이텀이 있는 작업물 USD/GLB를 연결하고 동일 사이클의 연속 녹화를 남긴다. 자료가 오기 전에는 본 기능을 `FUNCTIONAL_DEMO`로 유지한다.

## E096 실제 작업물 모델 재검색 · 2026-09-27

- Production의 724개 자산/905개 모델 파일 기준 인벤토리와 모델 파일명을 다시 대조했다. 차체 패널·자동차 주요 부품으로 식별되고 크기·데이텀이 확인된 작업물 USD/GLB는 `0`건이다.
- E096 원본 USDA는 Y-up, metersPerUnit=1이며 `bed`, `ram`, `tool` Geometry를 가진다. 실제 GLB는 11,632 bytes, SHA-256 `08e5a3723ee40516fa67e25130439cdc6870f7d407a8b4c911c7d477de7962c0`이다. 제조사/모델, 공식 Stroke, Pivot 및 사이클 근거는 찾지 못했다.
- P006에는 RC-Car-CAD 구조 검토 GLB 28,242,564 bytes가 있으나 정적 섀시/서스펜션 그룹 모델이다. 원본 USD의 joint 0, time-sampled attribute 0, BOM 미검증이며 E096에 넣을 프레스 작업물이 아니므로 연결하지 않았다.
- 현재 주황색 Box Proxy(0.18 × 0.05 × 0.12m)는 변경하지 않고 `FUNCTIONAL_DEMO`로 유지한다. 실제 모델을 대신해 제품 화면에 연결하거나 작업물 호환성을 승격하지 않았다.
- 읽기 전용 서버 자산 조사에서 코드·DB·계획·레이아웃·원본 USD/GLB 변경은 `0`이다. 전체 제작자 저장소를 검색했다는 뜻은 아니며, 확인 범위는 P006 등록 인벤토리·Production frontend 모델 루트·Omniverse catalog와 E096 원본 경로다.
- 세부 경로, 크기, SHA, 배제 근거와 필요한 입력은 `P006-E096-WORKPIECE-ASSET-AUDIT-20260927.json`에 기록했다.

원씽: 실제로 사용할 수 있는 E096 작업물은 현재 등록 자산에서 발견되지 않았으며, RC 섀시 모델은 프레스 작업물과 의미가 달라 제외했다.

깨달음: 화면에서 움직이는 모델이 존재해도 그 모델의 부품 정체·기준 좌표·공정 적합성이 확인되지 않으면 실제 작업물로 연결할 수 없다.

다음 업무 카드: 품번이 지정된 작업물 USD와 대응 GLB, 단위/축/기준점/치수, E096 제조사·모델 및 금형/Stroke/Pivot 자료를 등록한다. 자료가 들어오면 현재 기능의 모델 연결부만 사용해 E096 사이클에 시험 적용하고, 실제 모델 Bounds와 작업면 간격을 확인한다.

## 전체 공정 3D 카메라 프레이밍 수정 · 2026-09-27

- 현재 계획: `전기차 주요 모듈 조립 계획`; UI에서 설비대상 공정 `0/13` 배정, GLB 경로 `0/13`, 3D 상태 `모델 미로딩` 확인.
- 원인: `현재 작업 설비 따라가기`가 기본 체크되어 활성 단계의 카메라 프레임으로 이동한다. 설비 모델 미배정 상태에서는 카메라가 따라갈 Geometry도 없다.
- 변경: 전체 배치 bounds를 모든 로드된 설비·부품 모델에서 계산하고, `전체 배치 보기` 버튼으로 복귀한다. 공정 따라가기는 기본 해제하고 사용자 선택으로 켠다.
- 변경: 로딩 상태에 설비 배정과 GLB 연결 수를 넣고 미배정 설비는 표시 모델이 없음을 안내한다.
- Production 브라우저 확인: 기본 전체보기 체크 해제, `전체 배치 보기` 클릭 시 전체보기 체크 상태 복귀를 확인했다. 저장 계획 상태 문구는 `설비 배정 0/13 · GLB 경로 0/13`이다.
- 임시 브라우저 탭에서 5개 기존 카탈로그 후보(N076, E148, E121, E053, A195)를 연결하여 GLTFLoader 성공 `5/5`, 설비 연결 `5/13`, 3개 부지 Canvas 표시를 확인했다. 전체 화면에는 5개 설비 후보와 가상 완성 모듈이 함께 표시되었다.
- 임시 후보 연결 계획은 브라우저 저장/서버 저장을 누르지 않았고 탭 종료로 폐기했다. 사용자 저장 계획과 DB 변경은 `0`이다.
- 한계: 현재 저장 계획에서는 설비 GLB가 `0/13`이므로 실제 설비 Geometry는 표시되지 않는다. 남은 8개를 이름·형상으로 추정해 연결하지 않았다. 후보 Asset은 자동차 공정 적합성/실제 Animation을 증명하지 않는다.

원씽: 카메라 기본값과 전체 bounds를 안정화하고, 설비 모델 미연결의 원인을 실행 화면에서 바로 확인한다.
깨달음: 카메라가 한 공정에 맞춰졌던 현상과 설비 자체가 없는 현상은 별개의 두 원인이었다.
다음 업무 카드: 공정별 설비 후보를 실제 검토·적용한 계획에서 전체 공장 카메라와 여러 부지 카메라를 확인하고, 적합성/Animation Evidence가 검증된 설비만 실공정 시연에 포함한다.

## E096 프레스+작업물 사이클 실행 화면 통합 · 2026-09-27

- 실행 검토의 E096 Ram 단독 링크를 보완해, 실제 E096 GLB와 주황 `FUNCTIONAL_DEMO` 작업물을 함께 보는 동기화 Pilot을 같은 화면의 iframe으로 연결했다. 별도 창 링크와 기존 Ram 단독 Pilot도 유지했다.
- 계획에 `Asset ID=E096` 작업이 배정되어 실행 중이면 기존 same-origin BroadcastChannel이 시간·상태를 전달한다. E096 배정이 없는 계획은 동기화된 것으로 표시하지 않으며, 내장 화면에서 모델 로드 후 독립 시연을 선택한다.
- 작업물 치수, 진입/배출 방향 및 Geometry 계산 Stroke 후보를 화면에 명시했다. 자동차 작업물 USD/GLB, 제조사 Stroke/Pivot, 금형 접촉과 공정 적합성은 여전히 미검증이며 관계·Flow·Animation Evidence 상태는 바뀌지 않는다.
- DB 저장, 공장 레이아웃, USD/GLB 원본은 수정하지 않았다. 별도 Production QA 탭에서 브라우저 저장 계획 `E096 프레스 작업물 공정 시연 · 자동차 모듈`을 불러왔고, 실제 저장 시각 표시를 확인했다. 서버 저장은 호출하지 않았다.
- Production 화면에서 iframe compact 모드의 E096 GLB 로드(`HTTP 206`, bed 상면 후보 0.660m, 하강 이동량 후보 0.298m)를 확인했다. 독립 30초 사이클에서 프레스와 주황 작업물이 함께 렌더링되고 ram 하강·일시정지·초기화를 확인했다.
- 저장 계획 연결표가 `E096 동작 Pilot 1개`, `실제 GLB 1/1`, `실패 0개`로 복원됐다. 전체 재생 중 공통 시간이 8.2분일 때 상태가 `E096 프레스 하강 · 작업물 FUNCTIONAL_DEMO · Stroke 후보 0.275m`로 진행했고, 설비별 `보기`를 눌러 통합 3D에서 프레스와 주황 작업물을 확대 표시했다. 재생 속도 60×에서 중간 구간까지 확인한 뒤 QA 탭을 초기화했다. 전체 255분 완료나 녹화 영상은 검증하지 않았다.
- 첫 프레임은 다부지 전체 배치 Bounds를 포함해 설비가 작게 보일 수 있다. 설비 Legend의 `보기` 또는 `현재 작업 설비 따라가기`로 관심 설비를 프레이밍한다. 현재 E096 계획은 설비 1/13만 배정돼 나머지 미배정 설비가 나타나지 않는 것이 정상이다. 이 결과는 카메라 프레이밍 제약과 미배정 설비 범위를 구분해 기록하며 실제 설비 누락을 숨기지 않는다.

원씽: 사용자가 실행 화면을 벗어나지 않고 실제 프레스 모델과 시연 작업물의 전체 사이클을 확인한다.
깨달음: 부품 애니메이션과 실제 설비가 동시에 보이려면 모델이 로드되었다는 것뿐 아니라, 올바른 공정 Asset ID와 동일한 실행 시간축이 연결되어야 한다.
다음 업무 카드: 자동차 공정 각 단계에 실제 역할이 확인된 설비 GLB를 사용자 검토로 배정하고, 초기 전체 배치 프레이밍과 다부지 카메라에서 설비가 보이는지 단계별로 확인한다. E096 주황 작업물은 Proxy로 유지하며 자동차 작업물 모델·제조사 기구학·공정 적합성은 근거 확보 전까지 미검증이다.

## 공정 설비 후보·부지별 카메라 가시성 개선 · 2026-09-27

- 설비 대상 공정 13개를 후보 표에 전부 표시한다. 기존 카탈로그 후보 5개에 N088 표면처리, E123 치수검사, E053 최종검사 후보 3개를 추가해 총 8/13개 공정에 Asset ID 후보가 보인다.
- 후보 근거는 Asset 명칭/분류와 GLB manifest 경로뿐이다. N088의 자동차 도장 적용, E123의 섀시/차량 기능시험, E053의 차량 최종검사와 각 설비의 공정 적합성은 미검증으로 명시한다.
- 차체·섀시·구동·배터리 결합, 내장/조종석/유리 장착, 외장/등화/휠 장착은 전용 설비 및 수행 방법 근거가 부족하여 후보를 자동 지정하지 않는다. 후보표는 별도 입력·적용 단계를 유지하고 관계/Flow/Animation 승인 상태를 바꾸지 않는다.
- 부지별 카메라 카드에 부지의 설비대상 수, Asset+GLB 경로 연결 수, 3D Scene 로드 수 및 GLB 미연결 공정명을 표시한다. 카메라에 설비가 안 보이는 이유를 미배정/GLB 없음과 아직 3D 미로드로 구분할 수 있다.
- `node --check product-planner-details.js` 및 `node --check product-planner-multiview.js` 통과. Production의 HTML, JS, CSS, QA 문서, 설계 문서 요청은 HTTP 200으로 확인했다.
- Production 임시 QA 탭에서 후보 8개를 시각화 미리보기로 입력하고, GLTFLoader `8/8`, 실패 `0`을 확인했다. 각 부지 Canvas가 모두 표시됐다: 차체 `3/3`, 모듈 `3/4`, 완성차 `2/6`. 미배정 공정은 각각 카메라 카드에 표시되며, 후보 입력은 `적용 전` 상태였다.
- 원인: 설비 GLB 로딩 완료 후 다부지 카메라 갱신 함수에 현재 계획/Scene을 전달하지 않아 로드 수가 계속 `0`으로 보였다. `product-planner-details.js` 로딩 완료 경로에서 `ProductPlannerMultiView.update(latestRun, plan, viewer)`를 호출하고 HTML script 버전을 갱신했다.
- Production 임시 탭에서 수정 코드를 다시 열어 후보 미리보기→부지 카메라 로딩을 반복 확인했다. 화면 캡처에서 3개 부지에 설비 Mesh가 그려지는 것을 확인했고 브라우저 console error/warning은 0건이다.
- `node --check product-planner-details.js` 통과. Production HTML/JS 요청 HTTP 200. 설계 추적표도 함께 갱신했다.
- 서버 DB와 서버 저장 계획 변경은 0이다. 후보 적용 버튼과 설계 저장은 누르지 않았다. 페이지 재로드 때 앱의 기존 `pagehide` 저장기가 현재 E096 브라우저 계획을 다시 기록해 저장 시각 메타데이터가 갱신됐을 수 있으나, 설비 배정 등 설계 필드는 바꾸지 않았다.

원씽: 설비가 보이지 않는 부지에서 실제 연결이 비었는지 카메라가 문제인지 먼저 구분한다.
깨달음: 13개 공정의 빈칸을 아무 설비로나 채우기보다 후보 8개와 근거가 부족한 5개를 나누어야 3D 화면이 의미를 유지한다.
다음 업무 카드: 미배정 5개 공정의 필요한 작업·설비 사양을 입력하고 후보를 보강한다. 현재 후보 GLB에는 일정 연동 기계 동작이 없어 정적 설비 표시이며, 실제 기계 가동부/제품 적합성을 입증하는 자료가 확보되면 공정 시간과 동기화한다.

## 기존 E096 배정 보존 및 공정 후보 동시 표시 · 2026-09-27

- 설비 후보 일괄 입력 동작을 수정했다. Asset ID 또는 GLB 경로가 이미 지정된 공정은 건너뛰고, 후보가 있고 비어 있는 공정만 채운다. 화면은 추가 후보 수와 보존한 연결 수를 각각 보고한다.
- Production QA 탭에서 `E096 프레스 작업물 공정 시연 · 자동차 모듈` 계획의 차체 성형 설비가 `N076`으로 덮여 E096 동작이 0개로 표시되는 상태를 확인했다. 이 브라우저 QA 계획에서는 차체 성형을 E096으로 복구하고, 이후 후보 일괄 입력 시 해당 연결을 건너뛰는지 확인한다.
- 별도 브라우저 로컬 자동차 시연 계획에서 E096을 유지하면서 카탈로그 후보 7개가 추가되는지 확인한다. 전체 3D 모델 로딩, 부지별 카메라, 재생/일시정지/완료와 새로고침 복원 상태를 기록한다. 서버 DB 저장은 하지 않는다.
- 후보 연결은 시각화 참고다. 자동차 설비 적합성·제조 공정 적합성은 미검증이며 실제 애니메이션은 GLB Clip 또는 E096 Geometry 기반 `FUNCTIONAL_DEMO` 왕복에서만 표시한다. 해당 근거가 없는 후보는 정적 GLB다.

## E096 단일 공정 셀 프레이밍 · 2026-09-28

- 재현 원인: 전체 GLB bounds 크기에 1.55 배수를 곱하고 최소 카메라 거리를 2.8m로 고정해 좁은 프레스 셀에도 과도하게 멀리서 보였다. 임베드 모드에서 공정 단계 타임라인도 숨겨 현재 무엇을 처리하는지 읽기 어려웠다.
- 변경: 실제 E096 GLB bounds + FUNCTIONAL_DEMO 작업물 + 이송 양 끝을 합친 bounds를 구해 카메라 시야각/캔버스 비율에서 자동 맞춤한다. `설비+작업물 맞춤` 버튼으로 복구 가능하다. 모델/원본 GLB scale은 바꾸지 않는다.
- 임베드에서 5단계 `투입 → ram/tool 하강 → 처리 유지 → 복귀 → 배출` strip과 현재 단계 badge를 노출한다. 설비는 E096 소형 프레스, 구조 Anchor는 bed/ram/tool로 식별한다.
- 3D 조작 안내와 동작을 맞췄다: 드래그 회전, Alt+드래그 화면 평행이동, 휠 확대/축소. Product Planner 다중 모델 화면의 설비별 `보기` 및 자동 추적 bounds도 설비 + 화면에 보이는 연결 부품/가상 모듈을 포함한다.
- 자동 검증: `node --check product-planner-details.js` PASS; `node --test product-planner.test.cjs` 16/16 PASS.
- 배포 후 직접 E096 Pilot URL에서 GLTFLoader의 `E096 · 소형 프레스 · GLB PASS`, bed 상면 후보 0.660m, `FUNCTIONAL_DEMO` proxy, 5단계 timeline을 확인했다. 캡처상 실제 프레스 전체와 주황 작업물이 같은 프레임에 읽히는 크기로 보였다.
- 독립 8초 시연 시작 후 1.2초 시점에 상태가 `독립 시연 · 투입 → 가동부 하강/정지/복귀 → 배출`로 바뀌고 2단계 하강 표시 및 일시정지 버튼 활성화를 확인했다. 이어 일시정지·설비+작업물 맞춤·초기화를 실행했고 초기 위치로 복귀했다.
- Product Planner 내 lazy iframe은 한 초기 관측에서 응답 시간 초과 화면이 한 번 발생했다. 새로고침 후 실행 단계를 다시 열고 iframe의 GLTFLoader `GLB PASS`, E096+Proxy 프레이밍, 5단계 표시를 확인했다. 임베드 내부의 독립 시연 시작, 일시정지, 초기화도 동작했다. 초기 timeout은 재현되지 않았으나 변동성 때문에 후속 반복 확인 대상으로 기록한다. Alt-drag는 조작 안내와 코드 경로만 확인했고 실제 modifier-drag 입력은 미검증이다.
- Product Planner 저장 계획·서버 DB·레이아웃·관계 데이터·GLB는 수정하지 않았다.
- 범위 경계: 주황 상자는 `FUNCTIONAL_DEMO`; 실제 자동차 작업물, 제조사 Stroke/Pivot, 금형 접촉, 기계 적합성 또는 `ANIMATION_VERIFIED`를 의미하지 않는다. DB/계획/자산/관계 데이터와 GLB는 수정하지 않는다.

원씽: 한 공정의 설비와 작업물이 같은 프레임에 함께 보이고, 어떤 단계인지 바로 읽히게 한다.
깨달음: GLB 로딩 성공만으로는 가독성이 확보되지 않는다. bounds와 시야각에 맞춘 카메라 거리 및 단계 안내가 있어야 설비-작업물 공정으로 읽힌다.
다음 업무 카드: 배포된 화면에서 E096 프레스 전체, Proxy, 5단계 표시, 재생/일시정지/초기화, Alt-pan을 시각 검증하고 결과 캡처를 남긴다. 이 셀 Gate가 PASS한 뒤 다음 공정 셀을 연결한다.

## Product Planner 전체 시간표 ↔ E032 조립 셀 동기화 · 2026-09-28

- Production 배포 화면 `product-planner.html?rev=assembly-cell-4`와 독립 조립 셀 `product-planner-assembly-cell-pilot.html?rev=assembly-cell-4`를 같은 Origin의 별도 탭으로 열어 검증했다.
- 기존 브라우저 저장 예시 `E096 프레스 작업물 공정 시연 · 자동차 모듈`의 27개 일정 task가 셀의 시간표로 수신됐다. 각 행에서 작업명, 부지/공장, 입력 부품, 예정 시작·종료, 할당 Asset ID 또는 설비 미배정 상태를 확인했다.
- `실제 E032 작업대 로드` 실행 후 Production GLTFLoader 상태 `PASS`, E032 bounds `1.20 × 0.80 × 0.75m`를 확인했다. 이는 정적 작업대 표시 검증이며 공정 설비 할당이나 실제 조립 검증은 아니다.
- 전체 공정 재생을 시작하자 셀 상태가 `메인 공정 동기화 · 차체 패널 성형 · MAKE · 가상 차체·도장 공장 · 18.8/255.0분 · 배정 설비 E096 · 시각 Proxy 매핑 3/3`로 갱신됐다. 이후 메인 계획을 일시정지하자 셀도 일시정지로 전환됐다. 같은 화면의 실행 상태와 시간이 전달되는 동기화 Gate를 PASS로 판정한다.
- 재생은 QA 중 19.8/255.0분에서 일시정지했다. 실행 상태는 브라우저 로컬 런타임에만 반영됐고 서버 DB 저장·설계 저장·USD/GLB·레이아웃 변경은 하지 않았다.
- 화면의 부품은 차체/구동/배터리 슬롯만 이름 규칙으로 연결한 `FUNCTIONAL_DEMO` Proxy다. 실제 부품 USD/GLB, BOM·물리 결합, 부지 간 물리 운송, E032 생산 설비 적합성, 제조사 애니메이션은 검증되지 않았다. 관계·Flow·Animation 증거 상태를 승격하지 않았다.
- 실제 브라우저 화면과 셀의 Timeline/HUD를 시각 확인했다. 이 검증은 특정 기존 예시 계획의 27개 task 일정 전달을 확인한 것이며, 전체 255분 완료·완제품 출고까지의 장시간 재생은 검증하지 않았다.

원씽: Product Planner 실행 상태·공정·부품·공장·지정 설비를 조립 셀에 같은 시간축으로 전달한다.
깨달음: 동기화 신호와 정적 셀 설비를 연결하는 것만으로 실제 생산 라인이 되는 것은 아니다. Proxy 이동, 실제 작업물 모델, 설비 배정·기능 근거는 각각 별도 Gate다.
다음 업무 카드: 사용자 검토로 실제 부품 USD/GLB와 각 공정 설비를 배정하고, 한 조립 공정의 투입·작업·결합 Anchor 근거가 확보된 경우에만 시연 Proxy를 실제 모델로 교체한다.

## E096 단일 설비 공정 사이클 재생 확인 · 2026-09-28

- Production 단일 Pilot `product-planner-e096-press-cycle.html?rev=e096-cell-focus-1`에서 `실제 E096 모델 로드`를 실행했다. Production GLTFLoader 로딩 PASS, 실제 `bed / ram / tool` Mesh, HTTP 206 GLB 응답을 확인했다.
- 실제 bed Mesh Bounds에서 work-surface 상면 후보 `0.660m`를 표시했다. E096의 ram/tool 검토 이동 후보는 `0.298m`였다. 제조사 Stroke나 정식 기구학 값은 아니며 화면에도 후보/시연으로 표시된다.
- 8초 FUNCTIONAL_DEMO 사이클에서 `작업물 투입 → ram/tool 하강 → 처리 유지 → 복귀 → 작업물 배출`을 순서대로 표시하고 `시연 완료 · 작업물 배출 완료` 상태까지 확인했다. 캡처에서 실제 프레스와 주황 시연 작업물이 같은 3D 셀에 보인다.
- Product Planner에 연결된 별도 E096 iframe은 브라우저에 보존된 계획 시간 `19.8/255.0분`과 일시정지 상태를 표시했다. 이번 독립 사이클 검증은 완료했으나, 255분 전체 계획은 실행하지 않았다.
- 판정: 단일 설비·시연 작업물 화면 흐름은 완료까지 동작한다. 자동차 차체 패널 USD/GLB는 0개이며 Proxy는 `0.18×0.05×0.12m` 생성 형상이다. 작업물/금형 접촉, 입력·배출 축, Stroke, 자동차 공정 적합성, 실제 성형 결과는 미검증이다. `FLOW_ELIGIBLE`, `ANIMATION_VERIFIED`, `DIRECT_VERIFIED` 승격은 0이다.
- 데이터 변경: 계획/서버 DB/공장 레이아웃/USD/GLB 원본 변경 0. 실행은 독립 Browser 시연 시간축에서 수행했다.

원씽: 실제 E096 설비와 시연 작업물 1개가 한 화면에서 투입부터 배출까지 이어지는 Pilot을 완료 상태로 확인했다.
깨달음: 설비 Mesh 동작과 작업물의 시각적 왕복은 확인됐지만, 제조 공정의 실제 작업물 변형과 접촉은 CAD·금형·기구학 근거가 있어야 검증할 수 있다.
다음 업무 카드: 부품 식별자와 치수가 명시된 작업물 USD/GLB 및 E096 제조사·금형·Stroke/Pivot 자료를 확보한다. 확보 전에는 이 사이클을 `FUNCTIONAL_DEMO`로 유지한다.

## 실행 3D 설비 가시성·카메라 표시 개선 · 2026-09-28

- 기존 브라우저 화면을 확인: GLB 로드 성공 `8/8`, 실패 `0`, 공정 설비 연결 `8/13`; 나머지 5개는 설비/GLB 미배정으로 주황 작업점만 표시된다. 기존 8개 연결은 그대로 보존했다.
- 현상 원인: 모든 연결 설비에 150px 고정 화면 라벨이 겹쳤고, 미배정 공정 작업점마다 6.8m 폭의 Billboard 라벨이 추가되어 전체 배치 bounds와 시각 가독성을 해쳤다. 다부지 전체 프레임은 상세 설비를 작게 보이게 했다.
- 수정: 실제 설비 이름표는 현재 자동 추적 또는 사용자가 `셀 보기`를 선택한 단일 설비에만 작은 크기로 표시하고, 가림을 줄이기 위해 depth test를 적용했다. 전체 배치 모드에서는 이름표를 숨긴다. 미배정 작업점에는 주황 ring/mast만 유지하고 이름은 공정·설비 목록에서 확인하도록 했다. 모델의 transform, scale, GLB, 설비 배정은 수정하지 않았다.
- 브라우저에서 확인한 입력 계획은 `E096 프레스 작업물 공정 시연 · 자동차 모듈`이며 실행은 19.8/255.0분 paused 상태다. 재생 상태, 로컬 계획, 서버 계획/DB, 공장 레이아웃은 변경하지 않았다.
- 검증 전: `node --check`는 수정 후 실행 예정. 배포 후 시각 검수/회귀 확인 결과를 아래에 이어 기록한다.
- 원씽: Geometry를 더하지 않고 기존 설비 모델과 작업점 표현을 분리해, 기계 Mesh가 라벨에 가려지지 않게 한다.
- 깨달음: 설비가 사라진 문제와 미배정 공정이 주황 작업점으로만 보이는 문제는 서로 다르다. `8/8`은 연결된 GLB만 성공한 수치이고 `8/13`은 설비 대상 공정 전체의 연결 상태다.
- 다음 업무 카드: 남은 5개는 요구 작업/설비 사양과 Asset 증거를 확인한 후 사용자 검토로 배정한다. 이번에는 추정 연결하지 않는다.

## 실행 3D 설비 정보 카드 크기·내용 보정 · 2026-09-28

- 확인된 원인: Billboard가 GLB 실제 크기에 비례한 고정 월드 크기(`0.9–2.2m`)여서 카메라 근접/축소 시 viewport를 과도하게 덮었다. 카드 내용도 설비/Asset ID와 상태만 포함했다.
- 수정: Billboard를 Mesh bounds 상단에서 더 띄우고, Perspective camera 거리·FOV·canvas 높이에서 화면상 크기를 역산해 최대 320px/최소 210px로 제한했다. 카메라 이동 시 재계산한다.
- 카드 정보: 공정명, 카탈로그 설비명·Asset ID, 제품명, 작업 대상 주요 부품, 실행 상태, 현재/예정 공정 시간, 정적/Clip/시연 동작 상태를 표시한다. 현재 추적 또는 선택 설비 한 개만 노출한다.
- HTML 도움말에 정보 항목·카드 위치·화면 크기 정책을 갱신했다. 쿼리 버전은 `20260928-process-card-2`로 올려 구 캐시 렌더러 재사용을 막는다.
- 보존 조건: 계획, 공정시간, Asset 배정, GLB 원본, 설비/부품 Geometry는 수정하지 않았다. 과정 적합성·물리 조립 검증 상태를 승격하지 않는다.
- 검증 예정: JavaScript 구문 검사, 페이지 재로드 후 새 JS 버전 확인, 3D 카드 가독성/가림/회전·줌 확인 및 콘솔 오류 검사.
- 원씽: 카드 크기를 장비의 임의 world-scale이 아닌 실제 화면 픽셀로 제어한다.
- 깨달음: 카드의 위치를 높이는 것만으로는 카메라 줌에 따른 확대를 막지 못한다. Perspective 투영에서 카메라 깊이와 viewport를 반영해야 한다.
- 다음 업무 카드: 미배정 5개 공정은 별도 자산/작업 사양 검토 대상으로 유지한다. 이번 UI 정보 카드 수정과 설비/공정 배정은 분리한다.

## E096 외부 탭 재생 간섭 방지 · 2026-09-28

- 재현: Product Planner의 같은-origin 다른 탭이 `RUNNING` snapshot을 BroadcastChannel로 내보내면 E096 pilot의 독립 시연이 차단된다. 부모 탭은 자기 탭의 runtime이 실행 중이 아니면 일시정지 버튼을 비활성화하므로, 외부 탭 실행을 멈추지 않고서는 해당 프레임에서 독립 cycle을 시작할 수 없었다.
- 수정: E096 화면에 `시간표 연결 해제/시간표 연결` 토글을 추가했다. 연결 해제는 이 뷰의 채널 구독만 닫고 시연 상태를 초기 위치로 놓는다. 다른 탭의 계획·시간·저장 데이터에는 쓰지 않는다. 재연결하면 같은-origin 최신 snapshot을 다시 수신한다.
- 실제 배포본 독립 Pilot과 Product Planner 임베드 양쪽에서 시간표 연결 해제 → 8초 시연 시작 → 일시정지 → 초기화 → 시간표 재연결을 순서대로 실행했다. 임베드에서도 E096 GLB PASS, 실제 프레스와 주황 Proxy 동시 표시, 재생 상태 활성화, 독립 일시정지, 베드 입구 초기 위치 복원을 확인했다. 별도 탭의 전체 계획은 시간표 재연결 후 그대로 수신했다.
- 판정: 동일 브라우저에서 다른 탭이 `RUNNING`이어도 이 프레임을 독립 시연 모드로 분리하면 재생할 수 있다. 동기화 해제는 현재 Pilot 화면의 구독만 닫으며 전체 공정 시간을 수정하지 않는다. Production database/layout/plan writes=0.
- 증거 제한: 작업물은 여전히 `FUNCTIONAL_DEMO`; 실제 자동차 부품·금형 접촉·제조사 Stroke/기구학은 미검증. 전체 공정과 DB/설계/레이아웃을 수정하지 않았다.

원씽: 전체 계획 시간축과 독립 프레스 시연을 사용자에게 분명히 분리한다.
깨달음: BroadcastChannel의 다른 탭 상태는 현재 탭의 runtime 버튼 상태와 같지 않으므로, 구독 차단 시에도 사용 가능한 제어가 필요하다.
다음 업무 카드: 동기화 켜짐/꺼짐 각각의 8초 E096 재생과 재연결 복원을 시각 확인한다.

## 전체 공정 카드와 설비 미표시 상태 · 2026-09-28

- 변경: 실행 전·진행 중·완료 후에 13개 설비 대상 공정을 모두 카드로 표시한다. 카드에는 제품, 작업 부품/수량, 공장, 일정, Asset 이름/ID, GLB 표시 상태와 동작 근거를 나타낸다.
- 변경: 미배정, GLB 경로 미연결, 요청/파싱 실패 상태를 구분하고, 표시 가능한 GLB가 없는 단계는 주황 작업점으로 표시한다. `작업점 보기`가 해당 좌표로 카메라를 옮긴다.
- 변경: 자동 추적은 실행 중에만 활성화하고 시간 0 및 완료 시 전체 배치 카메라로 복귀한다.
- 불변 조건: 설비 배정, GLB 원본, 제품/BOM, 시간표, 설비/부품 Transform, DB 상태는 변경하지 않는다. 8/13 설비 연결을 전부 연결된 것처럼 표시하지 않는다.
- 시각 검수: 배포 후 전체 공정 카드 목록과 3D 상태를 캡처해 근거 파일 경로, 브라우저 콘솔/모델 표시 결과를 기록한다.
- 원씽: 설비가 보이지 않는 경우를 GLB 미배정·경로 미연결·로드 실패·표시 성공으로 바로 구별한다.
- 깨달음: 카메라가 한 공정을 추적하는 동안 다른 단계가 사라진 것처럼 보일 수 있고, GLB 없는 설비는 실제 형상 없이 작업점만 존재하므로 카드와 3D 위치를 연결해서 보여줘야 한다.
- 다음 업무 카드: 미연결 5개 공정의 요구 설비와 모델 근거를 확보한 뒤 사용자 검토로 매핑한다. 이 작업에서는 추정 배정을 하지 않는다.

### 전체 공정 카드 / 설비 Callout 시각 검수 보완 · 2026-09-28

- 실제 서버 URL `product-planner.html?rev=20260928-all-process-cards-3#run`에서 E096 예시 계획을 읽기 전용으로 열어 확인했다.
- 화면 상태: 전체 공정 카드 13개, 설비 대상 공정 13개, GLB 표시 8/13, 설비 미연결/미표시 5개, GLB 요청 실패 0개. 브라우저 콘솔 error 0건.
- 카드에서 공정명·현재 상태·제품·대상 부품/수량·부지/공장·계획 시간·Asset ID/설비명 및 GLB/작업점 상태를 확인했다. 미연결 설비에는 주황 작업점과 `작업점 보기`가 제공되며 설비로 오인시키지 않는다.
- 3D의 선택 설비 Billboard가 설비를 가리던 잔여 문제를 확인해, 최대 220px(기존 320px), 캔버스 폭의 18%(기존 42%), Mesh 상단에서 최소 2.2m(기존 1.1m)로 축소·상향했다. 최신 JS 버전 query를 올려 실제 브라우저에서 재확인했다.
- 실행·완료 전체 27단계 재생은 변경하거나 검증하지 않았다. 현재 브라우저의 기존 19.8분 상태를 보존했고, 계획/서버 저장/Asset 배정/Geometry 변경은 수행하지 않았다.
- 시각 캡처는 Codex 브라우저 검수 결과에 포함했다. 화면에서 확인한 모델은 설비 GLB 8개이며, 나머지 5개는 미배정/미표시 작업점이다.
- 원씽: 모든 공정 상태·부품·필요 설비 정보를 목록으로 고정해 3D 카메라가 한 설비를 추적해도 다른 공정 카드가 사라지지 않는다.
- 깨달음: 목록을 유지하는 것만으로 3D 모델이 모두 표시되는 것은 아니다. GLB 연결 범위와 작업점만 있는 공정을 숫자와 카드 동작으로 분리해야 한다.
- 다음 업무 카드: 설비 미연결 5개는 요구 설비/모델 증거가 확보된 후 명시적으로 매핑한다. 실제 조립 애니메이션 완성으로 간주하지 않는다.

### 미배정 복합 공정 카드의 필요 설비/후보 정보 · 2026-09-28

- 변경: 설비 미연결 5개 공정 카드에 요구 설비 역할군, GLB 경로가 있는 Asset Registry 후보 이름/ID, 후보가 확정되지 않은 이유를 참고 영역으로 표시한다.
- 고정 경계: 후보는 카탈로그 참고에 불과하며 저장 계획의 Asset 배정, 설비 Geometry 생성, 흐름/애니메이션 연결을 수행하지 않는다. 차량 BOM·차종 적합성·지그/공법 증거가 없어 공정 적합성은 미검증이다.
- 브라우저 검수 완료: `?rev=20260928-process-equipment-needs-1#run`에서 실행 탭을 열고 기존 설계 `E096 프레스 작업물 공정 시연 · 자동차 모듈`을 읽은 뒤 `공정 설비와 모듈 흐름 보기`를 눌렀다. 13개 카드, 설비/GLB 연결 8/13, 미배정 카드 5개, 기존 연결 모델 로드 8/8, 실패 0개를 확인했다.
- 다섯 미배정 카드의 표시 근거: 섀시 모듈 제작(E121/E135/E148/E123), 차체 투입·조립 기준 설정(E148/A123/N143), 차체·섀시·구동·배터리 결합(A042/E032/E122), 내장·조종석·유리 장착(E032/E146/N143/A203), 외장·등화·휠 장착(A203/E032/E122/A042). 모든 줄에 카탈로그 참고·미검증 경고와 요구조건 미확인 사유가 보인다.
- 읽기 전용 검증: `설비 보기`, `작업점 보기` 동작은 카드에 남아 있고, 후보 입력·설계 저장·서버 저장은 실행하지 않았다. 따라서 이 검수 turn에서 계획/DB 쓰기 0건이다. 브라우저 콘솔 로그는 이 검수 경로에서 읽지 않았으므로 별도 미측정이며, 화면상 모델 실패 수는 0개다.
- 자동 확인: `node --check product-planner-details.js`와 HTML/CSS 변경 diff 확인.
- 원씽: 현재 작업 위치나 모델이 없는 공정도 카드만 읽으면 무엇이 필요한지 알 수 있게 한다.
- 깨달음: 자산명이 공정명과 비슷하다는 사실은 설비 적합성 근거가 아니므로, 후보를 읽기 쉽게 보여주되 실제 배정과 별도 상태로 유지해야 한다.
- 다음 업무 카드: 다섯 복합 셀의 BOM·가공/조립 요구사항과 설비/지그 기능 근거를 확정한 뒤에만 후보를 실제 계획에 선택적으로 매핑한다.

## 13개 공정 설비 후보 연결·전체보기 보완 · 2026-09-28

- 원인: 13개 설비 대상 중 8개만 후보 연결표에 있었고, 나머지 5개 복합 셀은 후보 모델 미리보기만 제공해 기본 계획이 계속 8/13으로 남았다. 실행 버튼은 Candidate action을 통해 브라우저 저장 및 3D를 호출하지만 5개 매핑 후보가 없어 해당 공정은 계속 미배정이었다.
- 변경: 복합 셀마다 Asset Registry GLB 경로가 확인된 대표 표시 후보를 하나 추가하고, 나머지 필요 설비군은 참고/미검증 상태로 보존한다. 부분 GLB 경로가 비어도 현재 Asset ID가 후보와 동일할 때만 USD/GLB 경로를 보충한다.
- 안전: 다른 Asset ID나 수동 경로가 이미 있으면 덮지 않는다. 계획 재생 중에는 변경을 거부한다. 후보 적합성/실제 기계 동작/전체 설비군 구성/서버 DB 저장을 PASS로 승격하지 않는다.
- 자동 후보 경로 존재 확인: E121, E148, A042, E032, A203 각 catalog entry와 3D manifest GLB path 존재.
- 브라우저 저장은 `ProductPlannerActions → changed() → localStorage`; 서버 DB 저장은 별도임을 UI에서 명시한다.
- 실제 Production 브라우저에서 13개 모델 로딩·새로고침 복원·재생은 후속 검증 대상이며 현재 PASS 주장 0.
- 코드·화면 도움말·설계/QA 문서 갱신. 추가 모델 자산 0개, 원본 Asset/USD/GLB 수정 0개.

원씽: 누락된 5개 공정에도 후보 모델을 보여줘 전체 시나리오가 8/13 지점에서 끊기지 않게 한다.

깨달음: 하루 종일 남은 “미배정”은 사용자의 조작 문제가 아니라 다섯 복합 공정에 저장 가능한 대표 후보 경로가 없었던 구조 문제였다.

다음 업무 카드: Production 화면에서 명시적으로 `후보 연결·브라우저 저장·전체 3D 보기`를 실행하고, 실제 로딩 성공/실패·새로고침 복원·전체 재생 상태를 QA 기록에 추가한다. 이후 제품별 공정 적합성 자료를 받아 후보를 승인하거나 교체한다.


## 완제품·인프라·운반 옵션

- 자동 확인: `node --check product-planner-car-demo.js`, `node --check product-planner-details.js` PASS.
- 서버 반영 확인: 정식 `product-planner.html` 경로에 HTML을 반영하고, 자동차 시연 스크립트 cache key를 `20260928-finished-product-2`로 갱신했다. 처음에는 임시 `live-product-planner.html`에만 반영되어 실페이지가 구버전을 제공했으나, 실제 제공 URL을 대조해 정식 파일에 재반영했다.
- 실제 Codex 브라우저 재생: 저장 계획 `E096 프레스 작업물 공정 시연 · 자동차 모듈`, 600×로 재생. 진행 시각 13.5 → 166.5 → 255.0분을 확인했고, 최종 상태 `완료`, `완제품 출고 1/1`, `공정 완료`를 확인했다.
- 실제 3D 로딩: 설비 GLB 13/13, 설비 배정 13/13, 실패 0, 시연 모듈 12종. 255분 완료 시 자동차형 FUNCTIONAL_DEMO 프록시 12종이 완성차 조립 위치에 모이고 카메라가 완제품을 확대했다. 운송수단 트럭 옵션·부지/공장 레이어가 화면에 보였고, 완료 후 포장 옵션을 켜자 외곽 포장 프레임이 표시됐다.
- 캡처: `tmp/finished-product-animation.png` (완료된 완제품 조립체, 부지/공장 배경, 포장 프레임).
- 설계 범위: 부지/공장 가상 Infrastructure toggle, truck/AGV/forklift/conveyor selector, 운반 예약대기 marker, 제품조립 visibility toggle, package frame toggle.
- 기대 동작: 최종 ASSEMBLE 완료에서 12개 주요 module proxy가 마지막 조립 작업점에 배열되고 final view에 카메라를 맞춘다.
- 주의: 구매/외주품까지 포함한 자동차 실제 형상, USD 완제품, 물리 조립, 운반자원 용량/경합/실제 대기열은 검증되지 않음.
- 백업: `/home/sjkim/backups/p006/final-product-transport-20260928`.
- 원씽: 완료 후 부품을 최종 조립 작업점에 모아 결과를 한눈에 보여준다.
- 깨달음: 완료 상태/출고수량으로는 공간상 완제품이 만들어지지 않아, 완료 화면에 명시적 시연 조립 배치가 필요하다.
- 다음 업무 카드: AGV/지게차/컨베이어 선택 동작을 각각 확인하고, 사용자 선택 운송수단을 설계 저장 데이터와 연결할지 결정한다. 현재 모델은 시각 프록시이며 자원 용량·배차 경합은 모델링하지 않는다.

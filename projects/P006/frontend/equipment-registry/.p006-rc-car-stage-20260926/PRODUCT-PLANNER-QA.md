# 제품 생산 설계 QA · 2026-09-26

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



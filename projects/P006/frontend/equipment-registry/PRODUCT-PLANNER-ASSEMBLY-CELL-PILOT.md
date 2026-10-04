# Product Planner 조립 셀 Pilot

## 목적

전체 공정 뷰에서 기계와 작업물이 서로 떨어져 보여 “설비에서 조립”되는 과정으로 읽히지 않는 문제를 좁은 단일 셀 화면에서 검토한다. Production 계획 데이터, 관계, Asset 원장, 원본 GLB는 수정하지 않는다.

## 매핑

| 요구 | 화면/데이터 | 구현 | 확인 |
|---|---|---|---|
| 실제 설비와 작업물을 함께 보기 | `product-planner.html#run` 조립 공정 셀 | E032 정적 Pilot + 공정 지정 GLB(있을 때) + 차체/구동/배터리/섀시 Proxy | E032 및 지정 GLB 파싱, 미배정은 별도 상태 |
| 단계별 조립을 보기 | 공정 시간표 동기화 | schedule의 component slot과 task 시간 사용 | 4개 주요 모듈의 시간 연동 표시 |
| 화면 조작 | 셀 카메라 | 드래그 회전, Alt+드래그 Pan, 휠 Zoom | 포인터 입력 smoke test |
| 근거 경계 보존 | 상태/도움말 | `FUNCTIONAL_DEMO`, 실제 작업면·Port/BOM·물리 결합 미검증 | 화면 경고 및 QA 기록 |

## 좌표와 배치 규칙

1. E032 GLB를 `GLTFLoader`로 읽고 `Box3.setFromObject()`로 Scene Bounds를 얻는다.
2. 표시 편의를 위해 복제된 Scene root만 바닥 y=0, x/z 중앙으로 옮긴다. 원본 GLB 파일·Asset Transform·저장 계획은 수정하지 않는다.
3. 설명용 Proxy 모듈의 비율은 현재 Scene bounds에서 계산한다. AABB의 최상단은 시연 위치 기준으로만 사용하고 실제 작업면이라고 주장하지 않는다.
4. 네 단계의 사용자 지정 시연 진행률에 따라 모듈을 대기 지점에서 시연 위치로 이동한다. 이 동작은 실제 설비 제어·제품 BOM·Port 관계를 승인하지 않는다.

## 설비 근거

- Asset: E032 `작업대·버퍼`
- Registry 상태: `GLB_READY`, 실제 GLB path `/projects/P006/assets/3d-derived/E032.glb`
- Motion evidence: 없음
- Port: 없음, `UNRESOLVED` / `PENDING_EVIDENCE`
- 관계/Flow: 미검증
- task에 설비 GLB가 지정되면 현재/다음 단계에 실제 GLB를 셀 옆에 표시한다. 옆 배치는 화면 확인용이며 실제 설치 위치가 아니다.

## 자동 QA 순서

1. HTML/JS 정적 파싱 확인.
2. 브라우저에서 페이지 열기, E032 GLTFLoader 성공 및 실제 설비 렌더를 확인.
3. 차체·구동·배터리·섀시 4개 Proxy와 공정 시간표를 확인.
4. 재생 → 일시정지 → 재생 → 초기화를 확인.
5. 카메라 orbit·Alt-pan·wheel 입력을 확인.
6. 같은 조립 셀을 반복 열어 화면 예외/중복 렌더 루프를 확인.

## 현재 승인 범위와 다음 업무 카드

- `DIRECT_VERIFIED = 0`, `FLOW_ELIGIBLE = 0`, `ANIMATION_VERIFIED = 0` 유지.
- 자동차 실제 부품 모델, 조립 절차·공차, 작업면, 포트, 고정구 및 설비의 기계 동작 근거가 확보되면 Proxy를 실제 모델/Anchor에 매핑한다.
- 다음 단계: 검증된 작업면/작업물 Anchor와 실제 부품 모델을 한 셀에 연결한다. 근거가 없으면 시연용 상태를 유지한다.

## 메인 계획 시간표와의 동기화

- Product Planner 실행 상태를 same-origin BroadcastChannel로 받는다. 조달/운송/공정/조립/검사/출고 전체 일정, 관련 part, 공장/부지, 지정 Asset ID, start/end를 사용한다.
- 현재 실행 단계와 계획 시간은 HUD/전체 일정 Timeline에 표시한다. 계획 입력부품 이름으로 식별 가능한 3개 `FUNCTIONAL_DEMO` Proxy만 일정 `consume`이 조립 단계에 있을 때 작업점에서 합류 위치로 움직인다.
- `전체 공정 시간표와 동기화`는 전체 계획 실행 시간축을 따른다. `셀 단독 시연`은 별도 타이머다.
- E032는 static Pilot asset이고 생산 계획의 공정 설비가 자동 지정됐다는 의미가 아니다. 실제 작업물/Port/물리적 조립 Evidence는 미검증이다.
- 구현·테스트 매핑은 `PRODUCT-PLANNER-RUN-CELL-SYNC.md`에서 관리한다.

## 원씽·깨달음

- 원씽: 넓은 전체 배치 카메라와 분리해 실제 설비 1대 주변에서 각 작업물이 순서대로 모이는 것을 한눈에 보인다.
- 깨달음: GLB가 로드되고 부품이 움직인다는 사실만으로 기계에서 조립된다고 증명되지는 않는다. 작업면·Port·고정·절차 근거가 다음 Gate다.

# Product Planner 실행 시간표 ↔ 조립 셀 동기화

## 목적

Product Planner 실행기가 만든 같은 계획의 시간표를 조립 셀 화면에 전달한다. 전체 공정 보기와 단일 셀 보기에서 현재 단계·작업물 Proxy 이동·계획 시간을 일치시켜 “설비와 부품이 따로 논다”는 인상을 줄인다.

## 데이터 흐름

`ProductPlannerCore.compile(plan)` 일정 → `P006_PRODUCT_PLAN_SYNC_V1` BroadcastChannel → 실행 상태/공정/부품/공장/Asset ID/시작·종료 시각 → 조립 셀 Timeline/HUD/Proxy 표시

- 동기화는 같은 브라우저 Origin의 탭·iframe 사이에서 `p006-product-planner-run-v1` 채널을 사용한다.
- 부모 화면은 READY/RUNNING/PAUSED/COMPLETE snapshot을 보내며 실행 중에는 약 100ms 간격으로 현재 계획시각을 공유한다.
- 제품 부품 ID/이름에서 차체·구동·배터리·섀시의 4개 시각 Proxy slot을 좁게 매핑한다. 이름이 매칭되지 않는 부품은 임의 분류하지 않는다. snapshot은 `components`의 원 ID·이름·수량·slot과 task의 `consume`/`produce`를 함께 전달한다.
- MAKE/PROCESS/ACQUIRE 단계는 해당 Proxy를 셀 대기·작업점에 표시하고, ASSEMBLE 단계에서 `consume` 데이터에 명시된 입력 Proxy만 완성 배치로 이동한다.
- 전체 schedule task는 조달·운송·공정·검사를 포함해 Timeline 카드로 표시한다. 각 행은 예정시각·공장·부품·배정 설비를 보여준다. 공정 지정 설비 GLB는 `assetGlbPath`로 함께 전달한다.
- 셀은 현재 또는 다음 작업의 지정 설비 GLB를 실제 표시한다. 셀 옆 배치는 시각 확인용이며 실제 설치 배치로 간주하지 않는다. 설비 미배정·경로 누락·로드 실패는 E032로 대신하지 않고 이유를 표시한다.
- 셀 단독 시연은 별도 버튼으로 남기며, 단독 시연 시간은 메인 공정의 시간과 다른 축임을 화면에 표시한다.

## 판정과 한계

- E032 GLB는 정적 Pilot 설비다. 계획의 해당 공정에 E032가 지정 설비로 배정되지 않는 한 생산 설비로 간주하지 않는다.
- Proxy 좌표·합류는 시각 시연이며 실제 제품 USD/GLB, BOM, 작업면, 고정구, Port, 실제 조립/검사 수행을 의미하지 않는다.
- Asset ID가 표시되어도 모델이 해당 공정에 적합하거나 가동한다는 증거가 아니다. 연결 Evidence, `FLOW_ELIGIBLE`, `ANIMATION_VERIFIED`, `DIRECT_VERIFIED`는 동기화로 승격하지 않는다.
- 운송 단계는 일정 상태를 표시한다. 단일 셀 화면에서 부지 간 물리 경로를 재현하거나 운송 차량을 생성하지 않는다.
- 채널은 같은 Origin에서만 동작한다. 별도 Origin/브라우저 프로필은 동기화되지 않는다.

## 업무 사용 순서

1. Product Planner에서 대상 계획을 열고 실행 검증을 통과시킨다.
2. `실행` 패널에서 전체 공정 재생을 시작한다.
3. 조립 셀에서 `전체 공정 시간표와 동기화`를 누르거나 링크가 snapshot을 수신하게 둔다.
4. 현재 공정·작업물·공장·배정 설비가 일치하는지 확인한다. 매칭되지 않은 Proxy는 움직이지 않으며 상태에서 수를 확인한다.
5. 별도 예시 재생은 `셀 단독 시연`으로 구분한다.

## 설계 → 구현 → QA 추적

| 요구 | 구현 위치 | 검증 |
|---|---|---|
| 실제 실행 시간표 전달 | `product-planner.js` snapshot publisher | task 전체 필드, 시간, 상태 포함 여부 |
| 같은 계획 수신/복귀 | 조립 셀 Pilot `BroadcastChannel` 수신기 | 동일 Origin iframe/탭, request-state 응답 |
| 현재 단계와 전체 일정 표시 | 셀 Timeline/HUD | READY/RUNNING/PAUSED/COMPLETE 상태별 강조 |
| 부품-조립 시간 연동 | `components`, `componentSlots`, task `consume` 연결 | 4개 slot 엄격 매핑, 이름 미확인 부품은 임의 매핑하지 않음 |
| 설비-공정 시점 동기화 | task의 `assetId`, `assetGlbPath` | 현재/다음 지정 모델 표시, 미배정·실패 이유 노출 |
| 실제 근거 경계 유지 | Pilot 안내/상태 문구 | 관계·BOM·공정 승인 자동 변경 없음 |

## 다음 업무 카드

이 동기화 Gate 이후 실제 부품 USD/GLB와 공정 설비를 사용자 확인으로 배정하고, 각 셀의 실제 Anchor/가동부 근거가 생긴 단계만 Proxy를 교체한다. 관계 없는 공정의 부품 이동, 다른 부지의 운송, 실제 자동차 조립 적합성을 한 번에 PASS 처리하지 않는다.

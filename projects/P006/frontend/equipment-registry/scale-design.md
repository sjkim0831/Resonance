# P006 Factory Composer 규모 검증 설계

## 1. 범위와 기준선
724 Asset / 666 Entry / 62 intake / 기존 4-instance Layout 및 Stage 불변. READY/REAL 승격 없음.
64-instance REFERENCE 후보와 50/100/250/500 합성 성능 Layout을 별도 저장한다. 실제 EquipmentInstance는 0개이다.

## 2. 증거 계약
`settings.evidence`와 `settings.evidence.instances[instanceId]`에 출처, 분류, 이미지 좌표, 계획 좌표 변환, UNKNOWN/REFERENCE를 저장한다. 최대 1.5MB. Stage에는 `composer:evidence` 문자열 metadata로 보존한다.
CHECK LIST 원문명·원장 ID는 변경하지 않는다. 이미지 pixel 관계는 실측 좌표가 아니며 0.08m/pixel 계획 축척으로만 사용한다. 주조기 정보 부족은 6개 구역 표시로 남기며 임의 본체를 만들지 않는다.

## 3. 업무·액터·입출력
PROJECT_ADMIN → 724종 검색/분류 → asset key를 드래그 → 독립 instance UUID → XYZ/Rotation/Scale 편집 → 데이터 기반 OPTIONAL_WITH 등 추천 → Parametric 건축 → 원장 후보 ID 참조 → DB version 저장 → reload → 동일 JSON 확인 → 저장 revision만 USD Export → 구조/Reference/Transform/종속성 검증 → GUI open/reopen → 증거 확인.
실제 EquipmentInstance 입력 자료가 없으므로 실제 장비 귀속/포트/안전 검증은 이번 PASS 범위가 아니다.

## 4. 성능과 재발 예방
pointermove 전체 DOM 재생성을 제거하고 requestAnimationFrame 단위 선택 객체 위치/연결선만 갱신한다. pointerup/cancel에서 Inspector 갱신. 이전 checkpoint 기반 Undo/Redo 유지.
표시 Grid는 최소 12px로 성기게 표현하되 실제 Snap은 저장된 grid값을 유지한다. 전체 이름 표시 토글을 제공하고 기본은 선택/호버 표시로 과밀 라벨을 완화한다.
Stage export는 기존 파일 lock, 180초 timeout, atomic revision 검증을 유지한다. 실패 시 원본과 저장 Layout을 변경하지 않는다.

## 5. QA Camera
QA worker는 Stage 원본의 카메라를 읽고 session layer `/QA/FixedCamera`를 만들어 open/reopen 후 초기 100프레임을 고정한다. 이후 사용자 카메라 조작은 허용한다. 원본 Stage는 저장하지 않고 SHA를 재확인한다.
고정은 QA helper 세션에서 검증됐다. helper 없이 일반 Open 시 Kit 자동 프레이밍까지 영구 수정한 것은 아니다. 객체 Transform 동일성 검증과 이 UI 문제는 별도다.

## 6. 검증 상태
LAYOUT_SAVED → STAGE_GENERATED → USD_STRUCTURE_VERIFIED / TRANSFORM_VERIFIED / REFERENCE_VERIFIED → 실제 GUI 캡처 검수 시 OMNIVERSE_VERIFIED / RTX_VERIFIED.
마지막 2개는 GUI 증거 SHA와 Stage SHA가 일치할 때만 조회 응답에서 반영한다. Asset READY/REAL과 완전히 분리한다.

## 7. 측정 해석 및 다음 업무
Browser 초기 로딩은 composerReady까지, 저장은 UI busy/dirty 해제까지, 복원은 reload composerReady까지다. 12단계 마우스 드래그 전체시간과 20회 전체 재그리기 P95를 분리한다.
Kit load는 이미 실행된 세션에서 100 settling frames를 포함한다. 단일 정지 프레임 FPS와 연속 세션 RSS를 표시하며 cold start / 지속 이동 FPS로 과장하지 않는다.
다음 바위: PERFORMANCE_OPTIMIZATION. 500개 Canvas 전체 재그리기 P95 59.8ms와 Stage 생성 20.677s가 우선 병목이다. 가시영역 렌더링·차등 선택/Inspector 갱신·Entry/Base 검증 캐시 후 3D 웹 뷰어/양방향 동기화를 검토한다.

## 8. 자동화 산출물
scale-build-layout.py / scale-browser-bench.cjs / scale-functional.cjs / scale-export-all.py / scale-gui-worker.py / scale-finalize.py.
화면: `scale-report.html`, API: GET `/projects/P006/registry-api/composer/scale/report`.
한 페이지에서 업무 테스트·성능·GUI 이미지·64개 배치 근거·UNKNOWN 한계·다음 업무를 확인한다.

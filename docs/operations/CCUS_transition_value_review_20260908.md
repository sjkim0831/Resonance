# 단계 순서 및 상태 변경 상세 검토

2026-09-08, 약 2분. 삭제/수정/재시작 0회. 읽기 전용 JSON 비교.

## 단계 순서 23건 재분류

23건 모두 이전 step.transition.stepOrder의 숫자가 현재 step.guide.stepOrder에 그대로 존재한다. 현재 transition.stepOrder는 null이다. 따라서 앞선 '순서 변경 23건'은 필드 수준 차이이며, 실제 순서가 23건 바뀌었다는 의미가 아니다. 런타임이 어느 필드를 읽는지는 이번에 검증하지 않았다.

- ACCOUNT_LOCK_RECOVERY: 4단계
- ACTIVITY_DATA: 4단계
- EMISSION_CALCULATION: 4단계
- EMISSION_PROJECT: 7단계
- ORGANIZATIONAL_BOUNDARY: 4단계

## 실제 상태 값 차이

ACCOUNT_LOCK_RECOVERY의 도착 상태는 STEP_1_COMPLETED~STEP_4_COMPLETED에서 REQUESTED → IDENTITY_VERIFIED → REVIEW_APPROVED → COMPLETED로 바뀌었다. 뒤 단계 시작 상태 3건도 앞 단계 도착 상태와 연결되도록 변경되어 있다. 명칭상 더 구체적이며 이 네 단계 간 연결은 일치하지만, 실제 API·DB 동작 및 사용자 승인 이력은 별도 확인이 필요하다.

ORGANIZATIONAL_BOUNDARY_S4: 도착 상태 STEP_4_COMPLETED → COMPLETED.

## 남은 확인 지점

ACCOUNT_LOCK_RECOVERY 4단계의 transition.commandCode가 기존 문자열에서 null로 변경되어 있다. 다른 실행 경로로 대체되었는지 확인하지 않았으므로 정상 또는 장애로 단정하지 않는다. 다음은 해당 4단계의 명령 처리 코드와 API 연결을 읽기 전용으로 확인하는 것.

과거 파일 삭제나 자동 복원 없음. 현재 화면/설계 변경 없음. 신규 스크린샷 및 브라우저 E2E 미실행. 이전값/현재값 전체는 changes.csv, 현재 JSON 내 동일 키 위치는 changes.json에 기록.

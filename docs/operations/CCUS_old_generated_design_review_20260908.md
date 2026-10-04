# 과거 생성 코드 및 설계 미리보기 검토

2026-09-08. 약 2분. 읽기 전용 비교. 삭제 0건, 서비스 변경 0회.

대상 루트: /opt/Resonance/runtime/platform-data/control-plane/source
비교 루트: /opt/Resonance

|항목|검토 파일|판정|논리 용량|
|---|---:|---|---:|
|projects/carbonet-backend-metadata/process-runtime/design-preview|611|현재 동일 경로가 모두 있으나 내용이 다름|49,684,688 bytes|
|projects/carbonet-backend-metadata/process-runtime/generated|230|123개 상이, 107개 현재 동일 경로 없음|11,296,214 bytes|
|ai-builder/output|6,292|현재 동일 경로 없음|16,229,450 bytes|

합계 7,133파일, 77,210,352바이트. 디렉터리 du와 논리 파일 크기는 다름.

## 의미

설계 JSON은 단순 공백이나 타임스탬프 차이가 아님. 샘플에서 step, tests, testExecution, database, backend, frontend, nonfunctional, generationStatus와 해시가 변경됨. JSON 파싱 후 동일 여부도 비교했으나 동일 항목 없음.

현재 같은 경로가 없다는 사실은 다른 위치에 구현이 없다는 의미가 아님. 반대로 현재 파일이 있다는 이유만으로 과거 설계의 기능이 모두 포함되었다고 볼 수 없음.

현재 ops 스크립트에는 design-preview 및 generated를 사용하는 생성·검증 작업이 있음. 이번 검색으로 과거 복사본 전체가 동적으로 참조되지 않는다는 사실까지 증명하지는 않음.

## 조치 및 다음

현재 설계와 기능 차이가 있는 자료를 임의 삭제하지 않음. 전체 과거 복사본은 앞선 부분 삭제로 실행 또는 완전 복구 가능한 백업이 아님.
다음은 611개 설계의 프로세스/단계 식별자, 입력·출력, API·DB·테스트 차이를 비교하여 현재 설계가 대체한 항목과 과거에만 존재하는 항목을 구분하는 것.
화면 기능 및 설계 변경 없음. 이번은 파일 비교만 수행했으며 신규 브라우저 검수나 로그인/PDF E2E는 수행하지 않음.

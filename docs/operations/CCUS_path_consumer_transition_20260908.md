# 기존 경로 소비자 전환 1차

2026-09-08, 약2분. 실제 변경1파일. 링크 제거0건, 삭제0건, 서비스 재시작0회.

## 적용

/opt/Resonance/ops/scripts/ccus-record-real-pages.cjs의 녹화 저장 루트를 runtime/recordings에서 var/test-evidence/recordings로 변경. node --check 통과 및 변경된 값 확인. 녹화 작업을 실제 실행하지는 않음: 실행 시 QA 상태 파일이 갱신되므로 문법 검사와 경로 확인만 진행.

## 발견 및 보류

현재 설치된 carbonet-java-fast-dev 서비스의 drop-in 설정2개가 이전 platform-data/cache/gradle/java-fast-dev 경로 참조. 해당 서비스는 failed 상태. 현재 정상 실행 중인 carbonet-frontend-fast-dev 및 carbonet-production-direct와 다른 서비스임.
실패한 서비스 재가동이나 설정 전체 전환은 이번에 진행하지 않음. 이전 캐시 경로의 호환 링크 유지.
ops/maintenance/archive의 과거 정리 스크립트에도 이전 캐시 경로가 있으나 과거 기록을 일괄 치환하지 않음.

## 검증 범위

현재 주요5개 서비스 active. 이번 변경은 녹화 출력 경로1개뿐이며 웹앱 소스/DB/AI 모델 미변경. 신규 녹화/시각 검수/전체 E2E 미실행.
이전 경로 링크는 다른 소비자와 동적 참조 검토가 끝나지 않아 그대로 유지. 전체 경로 전환 완료 아님.
다음은 실패한 구 Java 개발 서비스의 현행 대체 관계를 확인한 뒤 폐기 또는 설정 이전 여부 결정.

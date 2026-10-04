# 개발 도구 위치 정리 2차

2026-09-08, 약 2분. 물리 이동 2개 폴더(약 220MiB), 삭제 0건, 재시작 0회.

기준 루트: /opt/Resonance/runtime/host-data

|이전 상대 경로|신규 상대 경로|용도|
|---|---|---|
|user-local/share/opencode|developer-tools/opencode-user-data|개발 도구 DB 및 설정|
|user-local/nvim|developer-tools/neovim|개발용 편집기 설치본|

열린 파일 없음 확인 후 같은 파일시스템에서 rename. 기존 경로에 호환 링크 유지. 이동 전후 2,149개 파일의 inode/크기/모드 동일 확인. 인증 정보 내용은 열람하지 않았으며 삭제하지 않음.

Neovim은 기존 경로로 --version 실행하여 v0.12.3 확인. OpenCode 실제 로그인/대화 테스트는 하지 않음.
현재 서비스 5개 active. CCUS 홈 HTTP200, 페이지 오류0건 및 스크린샷 확인. 최신 빌드, 로그인/PDF, P006 전체 E2E는 미실행.

## 보존 및 분류

user-local/lib/python3.14 약17GiB는 Python 설치 환경이며 AI/웹앱/도구 패키지가 혼합돼 있어 개별 패키지를 임의 이동하지 않음. user-local/share/ov 약5.2GiB는 Omniverse 자원으로 보존. 모델 프로세스 실행도 확인되어 모델은 미변경.
이번은 경로 정돈이며 전체 디스크 사용량을 줄인 작업이 아님. 모든 폴더의 정확한 실행 의존성 분류가 끝난 것은 아님.

## 다음

Python 패키지와 전역 Node 패키지를 실행 소비자별로 식별. 패키지 설치 트리를 파일 단위로 나누면 import/실행이 깨질 수 있으므로 런타임 단위 이동 또는 유지 판단. 호환 링크 제거는 소비자 경로 전환 검증 이후 진행.

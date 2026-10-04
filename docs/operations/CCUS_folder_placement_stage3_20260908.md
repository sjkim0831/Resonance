# 전역 Node 개발 도구 위치 정리 3차

2026-09-08, 약 2분. 이동 2폴더, 약1.54GiB. 삭제 0건, 재시작 0회.

루트 /opt/Resonance/runtime/host-data

|기존|신규|용도|
|---|---|---|
|user-local/lib/node_modules/@kilocode/cli|developer-tools/kilo-cli|Kilo 개발 도구 설치본, 약944MiB|
|user-local/lib/node_modules/opencode-ai|developer-tools/opencode-cli|OpenCode 개발 도구 설치본, 약631MiB|

열린 파일 없음 확인 후 같은 파일시스템에서 rename. 기존 패키지 위치에 호환 심볼릭 링크 유지. 내부 2,078파일의 inode/크기/모드 동일 검증. 데이터/인증정보 삭제 없음.
기존 명령 경로의 이동 전후 버전 동일: Kilo7.4.16, OpenCode1.17.11. pnpm11.9.0 유지. 모델 호출/로그인 등 CLI 전체 기능 테스트는 하지 않음.
향후 npm 전역 업데이트가 호환 링크를 교체해 이전 위치에 재설치할 수 있으므로 설치 관리자 경로 정책을 별도 정리해야 함. 모든 경로 정돈 완료가 아님.

Python3.14 공유 환경 약17GiB는 개별 라이브러리 단위 이동하지 않음. AI/Omniverse/개발 도구가 공유할 가능성이 있어 소비자·환경 경로·의존성을 확인해야 함.
현재 서비스 5개 active, 홈 HTTP200 및 페이지 오류0건, 스크린샷 확인. CCUS/P006 최신 빌드 및 전체 E2E는 이번 미실행.
다음은 Python 환경의 실제 소비자와 전역 설치 정책을 조사. 소스/DB/모델 보존. 이번은 위치 정돈이며 용량 감소 작업이 아님.

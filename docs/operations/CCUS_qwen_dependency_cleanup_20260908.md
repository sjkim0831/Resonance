# 미참조 구형 CLI 의존성 정리

2026-09-08 약3분. 대상 /opt/Resonance/runtime/host-data/developer-tools/.codex/qwen36-legacy-cli/node_modules

일반 파일7,547개,47,392,458bytes 삭제. 폴더 디스크 사용량70MiB→100KiB. 파일 크기 합과 할당 블록 차이 있음. package.json 및 package-lock.json 보존. 실행하려면 패키지 재설치가 필요하며 네트워크/레지스트리 가용성에 의존한다. 재설치 테스트 미수행.

검사: ops/scripts, 사용자 실행 파일 디렉터리, Codex 설정, systemd, cron.d, shell 초기화 파일에서 qwen36-legacy-cli 문자열 참조 미발견. 모든 가능한 수동 실행을 배제하는 근거는 아님. lsof 열린 파일 없음. /home/sjkim 및 /opt/Resonance 내 외부 symlink가 삭제 대상 내부를 가리키지 않음 확인. 내부 링크는 대상 내로만 연결, 일반 파일hardlink1, 삭제 직전 inode/크기/mtime 대조.

4개 구형 CLI 중 cerebras/nvidia/mistral3개는 실제 실행 래퍼에서 참조하므로 유지. 계정/대화 이력 및 CCUS/P006 코드·DB·사용 모델은 변경하지 않음.

검증: 주요서비스5개 active, 홈HTTP200. 재시작0회. 신규 시각검수 및 로그인/PDF 전체 E2E 미수행.

원씽: 실행 경로가 남은 도구는 유지하고 참조가 없는 설치 의존성만 제거한다.
운영: http://172.16.1.232/home

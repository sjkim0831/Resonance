# 오래된 플러그인 임시 체크아웃 정리

2026-09-08 약3분. 삭제 경로 /opt/Resonance/runtime/host-data/developer-tools/.codex/.tmp/plugins

5,295파일,67,634,637bytes(약64.5MiB 파일 합계), 삭제 전 디스크 할당 약88MiB. 2026-08-07 임시 체크아웃.

조건: Git porcelain 상태 깨끗함, 로컬 브랜치에 원격 추적 참조에 없는 커밋 없음(실시간 원격 조회 아님), untracked 파일 없음, 설정 및 운영 스크립트에서 .tmp/plugins 참조 미발견, lsof 열린 파일 없음. /home/sjkim 및 /opt/Resonance symlink 대조에서 대상 또는 하위로 향하는 링크 없음. 내부 symlink 없음, hardlink1, 삭제 직전 inode/크기/mtime 재검증.

보존: 계정/인증 설정, 대화 및 작업 이력, 실행 CLI, Hermes 세션, 모델, CCUS/P006 소스와 서비스. 재사용 시 임시 체크아웃을 다시 받아야 할 수 있다. 플러그인 설치/재다운로드 테스트는 미수행. 자동 삭제 정책 변경 없음.

정리 후 주요서비스5개 active, 홈HTTP200. 재시작0회. 화면 변경 없음, 신규 시각검수/인증 E2E 미수행.

원씽: 변경 없는 미참조 임시 복사본만 제거하고 사용자 작업 이력은 보존한다.
운영: http://172.16.1.232/home

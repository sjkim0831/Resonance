# 구 Java 개발 서비스 자동 시작 해제

2026-09-08, 약1분. 파일 삭제0건, 현재 서비스 재시작0회.

대상 carbonet-java-fast-dev.service: 점검 당시 failed, MainPID0, NRestarts22, enabled. 실행 경로는 runtime/platform-data/dev-worktrees/certificate-verification/ops/scripts/java-fast-dev.sh. 부팅 multi-user.target에 연결됐으며 별도 트리거 없음.
현재18080은 carbonet-production-direct Java 프로세스,5175는 carbonet-frontend-fast-dev Node 프로세스,18000은 socat가 리슨. 구 서비스 자체 실행 프로세스 없음.

systemctl disable로 구 서비스의 부팅 자동 시작만 해제. 실패 기록을 지우거나 서비스를 시작하지 않음. 기존 정의/drop-in/스크립트/개발DB/워크트리 보존. 삭제된 프로그램을 다시 실행하도록 경로만 치환하지 않음.
같은 워크트리에 다른 실행 소비자가 있을 수 있어5.1GiB 폴더 삭제의 근거로 사용하지 않음. 기존 캐시 호환 링크 역시 유지.

주요5서비스 active, 홈HTTP200/페이지 오류0건 및 스크린샷 확인. 로그인/PDF/P006 전체E2E 및 최신 빌드 미실행.
다음: 워크트리의 잔존 소비자와 구 설정 참조를 구분. 자동 시작 해제는 폴더 정리 완료나 구 서비스 기능의 완전 대체 검증을 의미하지 않음.

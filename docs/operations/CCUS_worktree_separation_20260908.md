# 인증서 워크트리 사용처 및 검증 자료 분리

2026-09-08, 약2분. 소스/DB/모델 삭제0건, 서비스 재시작0회.

## 현재 사용 확인

ops/runtime/ccus-dev-proxy.mjs의 resonanceRoot가 runtime/platform-data/dev-worktrees/certificate-verification. 회원 도메인 검증과 설계 지문 스크립트를 이 루트의 cwd로 실행. 검증 결과도 여기서 읽음.
ops/scripts/ccus-runtime-alert-collector.py와 프록시가 같은 var/dev-design-sync/runtime-alert-events.jsonl을 소비/생산. 로그1,700,996,976바이트. 현재 로그를 삭제하거나 전체 워크트리를 과거본으로 삭제하지 않음.

## 이동

이전 /opt/Resonance/runtime/platform-data/dev-worktrees/certificate-verification/var/test-evidence
현재 /opt/Resonance/var/test-evidence/certificate-worktree
3,294파일,986,554,765바이트(약940.9MiB 논리량, 디스크 약951MiB). 열린 파일/경로/상대 링크 검사 후 동일 파일시스템 rename. 전체 파일 inode/크기/모드 유지 확인. 이전 경로 호환 링크 유지.
워크트리 자체 du는5.1GiB에서4.2GiB로 감소했지만 전체 디스크 절감은 아님.

## 검증

주요5서비스 active, 홈HTTP200/페이지 오류0건 및 스크린샷 확인. 회원 검증 작업 실제 실행, 전체 빌드, 로그인/PDF/P006 E2E는 이번 미실행. 소스와 현재 오류 로그 보존.
다음은 기존 로그 보관·집계 및 현재 검증 스크립트의 정식 소스 경로 전환 검토. 운영 스크립트가 전체 워크트리 상대경로에 의존하므로 단순 삭제는 금지.

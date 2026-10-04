# Operations console 과거 JAR 원본 정리

2026-09-08 약3분. 삭제1파일33,252,877bytes(31.71MiB).

대상 /opt/Resonance/apps/operations-console/target/operations-console.jar.original. 수정일2026-07-08. 실행스크립트는 operations-console.jar를 참조하며 .original 직접참조는 ops/systemd 조사에서 미발견. lsof없음, canonical경로/하드링크1/외부파일symlink없음/삭제직전inode크기mtime 검증. 모든 수동실행 가능성을 검사한 것은 아님.

앱폴더97MiB→65MiB. target/classes65MiB는 static/download50MiB 등 원본 대체가능 여부가 미검증되어 유지. src/현재runtime/DB/모델/P006/QA증거·영상보존. .original은 이번 작업으로 복구불가.

서비스5개active, 홈HTTP200. 재시작0회. 신규시각검수/인증E2E미수행. standalone operations-console 실행기능 검증은 하지 않았고 현재서비스가 이 파일을 사용하지 않는지 확인한 정리다.

원씽: 산출물 폴더 전체가 아니라 미참조인 과거 JAR만 삭제했다.
운영: http://172.16.1.232/home

# 과거 18000 JAR 정리

2026-09-08 약3분. /opt/Resonance/var/run/carbonet-18000.jar 151,821,994bytes(144.79MiB) 삭제.

수정일2026-06-16. 열린파일없음.18000리스너는socat이며현재Java프로세스가아님. systemd/cron/ops/scripts조사에서codex-apply-and-deploy.sh, hermes-apply-and-deploy.sh의선택적BACKUP_SOURCE참조만발견. 파일없으면다른target경로로fallback하며둘다없으면백업복사를건너뛰는조건부블록. 스크립트자체는실행하거나변경하지않음. 모든가능한수동참조를배제한것은아님.

실경로/심볼릭링크없음/hardlink1/lsof/외부파일symlink/삭제직전inode크기mtime검사통과. 현재운영runtime·소스·DB·모델·P006유지. 과거JAR는이번작업으로복원할수없음.

검증: 서비스5개active, 홈HTTP200. 재시작0회. 신규시각검수/전체인증E2E미수행.
원씽: 현재실행본이아닌과거선택적백업원본만제거했다.
운영: http://172.16.1.232/home

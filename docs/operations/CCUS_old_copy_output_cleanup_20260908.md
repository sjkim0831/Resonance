# 과거 control-plane 소스 복사본 빌드 산출물 정리

2026-09-08 약3분. 기준 /opt/Resonance/runtime/platform-data/control-plane/source

삭제3폴더: apps/carbonet-api/build(209MiB), platform/control-plane/backstage/packages/app/dist(73MiB), platform/control-plane/backstage/packages/backend/dist(15MiB). 총2,757파일303,322,567bytes. 파일바이트합약289.3MiB, du할당합약297MiB. 복사본전체1.5GiB→1.2GiB.

확인: canonical대상경로, 각부모src존재, systemd/cron/현재ops/scripts에서직접참조미발견, lsof열린파일없음. /home/sjkim과/opt/Resonance의 외부symlink 중복사본루트/대상/대상상위하위연결없음. 내부symlink없음/hardlink1/삭제직전inode크기mtime확인.

보존: 과거복사본src·설계·패키지명세, 현재정규원본 및 실제운영runtime, 개발/운영DB, 모델, P006. 과거복사본즉시실행은불가할수있으며재빌드가필요하다. src존재가재빌드성공이나삭제번들의정확한재현을보증하지는않으며재빌드미수행. 다른미일치파일은유지.

검증: 서비스5개active, 홈브라우저HTTP200/제목CCUS/pageerror0. 스크린샷으로헤더·검색·업무길잡이·QA·화면설계표시확인. 인증된로그인/PDF/P006전체E2E미수행. 재시작0회.

![홈 확인](CCUS_old_copy_cleanup_home_20260908.png)

원씽: 과거소스는보존하고현재실행과무관한과거산출물만삭제한다.
운영: http://172.16.1.232/home

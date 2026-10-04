# Console 빌드 출력 APK 중복 정리

2026-09-08 약3분. /opt/Resonance/apps/operations-console/target/classes/static/download/CarbonetMobile.apk 52,137,559bytes(49.72MiB) 삭제.

정규자산 /opt/Resonance/projects/carbonet-assets/static/download/CarbonetMobile.apk와 크기/SHA256동일 확인. 정규자산은보존. 열린파일없음,실경로,hardlink1,외부파일symlink없음,삭제직전inode크기mtime확인. 현재ops/systemd/scripts의target/classes직접참조미발견. 빌드산출물을향한모든동적참조를검증한것은아님.

전체static비교: 정규자산/CCUS원본/console원본 같은상대경로와일치23개52,198,112bytes, 불일치519개14,520,742bytes. 이번에는 APK1개만삭제했고나머지는보존. 앱폴더65MiB→16MiB. 소스/DB/모델/P006변경없음. 이후console패키징은리소스재복사/재빌드가필요할수있음.

서비스5개active, 홈HTTP200, 재시작0회. 신규시각검수/인증E2E/APK다운로드동작검증미수행.
원씽: 원본자산을보존하면서해시가같은빌드복사본만제거했다.
운영: http://172.16.1.232/home

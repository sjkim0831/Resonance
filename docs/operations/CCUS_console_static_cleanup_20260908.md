# Console 과거 정적 출력 정리

2026-09-08 약2분. /opt/Resonance/apps/operations-console/target/classes/static 삭제.541파일14,581,295bytes(13.91MiB), 앱폴더16MiB→136KiB.

근거: pom.xml79~94행에서 generate-resources/copy-resources로 projects/carbonet-assets/static를 target/classes/static에 복사. Gradle설정34~38행에도 동일원본을다른build출력으로복사. 원본폴더는유지. 과거출력의519파일은현재같은상대경로원본과상이했으므로과거바이트의정확한재현을보장하지않는다. 현재원본기준재패키징에는리소스복사/빌드필요. 빌드미수행.

실경로·원본존재·lsof열린파일없음·외부대상/상위/하위symlink없음·내부symlink없음·hardlink1·삭제직전inode크기mtime검사. 현재runtime·모든원본·DB·AI모델·P006보존.

서비스5개active, 홈HTTP200. 재시작0회. 신규시각검수·인증E2E·standalone console재빌드검증미수행.
원씽: 빌드설정으로출처가확인된미사용과거출력만삭제한다.
운영: http://172.16.1.232/home

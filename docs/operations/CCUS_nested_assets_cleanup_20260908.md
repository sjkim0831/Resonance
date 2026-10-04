# 과거 중첩 프런트엔드 번들 정리

2026-09-08 약3분. 기준 /opt/Resonance/runtime/platform-data/control-plane/source.

삭제2폴더: apps/carbonet-api/src/main/resources/static/react-app/assets(약207MiB), projects/carbonet-frontend/src/main/resources/static/react-app/assets(약30MiB). 7,666파일232,400,378bytes(약221.63MiB파일합), 디스크약237MiB. 상위과거복사본747MiB→507MiB(du반올림/파일블록차이).

사용자의현재버전존재시과거배포본삭제지시에따라과거번들만폐기. 현재frontend소스package.json과현재정적index존재확인. 현재정규소스/실행runtime변경없음. 과거복사본의generated/runtime/ocr/문서/설정은보존. 남아있는과거index는삭제번들을참조할수있어과거복사본자체의즉시실행은지원하지않는다. 과거배포파일의정확한재현을보증하지않음.

실경로/열린파일없음/외부symlink참조없음/내부symlink없음/hardlink1/삭제직전inode크기mtime검사. DB·모델·P006보존.

서비스5개active, 홈브라우저HTTP200/CCUS제목/pageerror0. 스크린샷확인. 재시작0회. 로그인/PDF전체E2E미수행.

![홈 검증](CCUS_nested_assets_cleanup_home_20260908.png)

원씽: 현재실행과분리된과거번들은제거하고현재소스와고유설계는보존한다.
운영: http://172.16.1.232/home

# Dart pub.dev 다운로드 캐시 정리

2026-09-08 약3분. 대상 /opt/Resonance/runtime/host-data/developer-tools/.pub-cache/hosted/pub.dev

536패키지,49,769파일 삭제. 파일 크기 합1,092,990,722bytes(약1.02GiB). .pub-cache 디스크 사용량 약1.3GiB→28MiB. 반올림과 파일별 할당 블록 때문에 파일 바이트 합과 du 감소량은 다르다.

근거: active_roots4건의 package_config 경로 모두 없음. projects/apps 및 정리된 home 프로젝트 범위에서 package_config.json 미발견. systemd/cron.d/ops/scripts 검색에서 해당 모바일 경로, flutter, PUB_CACHE 참조 미발견. lsof 열린 캐시 파일 없음. 이 조사로 모든 미래/수동 사용을 배제하는 것은 아니다.

안전: 정확한 canonical 경로, symlink 없음, hardlink1, 삭제 직전 inode/크기/mtime 재검증. pub.dev 다운로드 패키지만 제거했다. Git 패키지 캐시·모바일 프로젝트 원본 및 pubspec.lock·계정·CCUS/P006·DB·AI 모델은 유지.

재사용: 이후 Dart/Flutter 빌드는 pub get 등으로 패키지를 다시 받아야 하므로 네트워크 및 패키지 공급처 가용성이 필요하다. 오프라인 빌드는 캐시 복구 전 보장하지 않는다. 재다운로드 테스트는 이번에 수행하지 않았다. active_roots 및 hosted-hashes의 소용량 메타데이터는 유지했다.

정리 후 주요서비스5개 active, 홈HTTP200. 재시작0회. 웹앱 변경 없음, 신규 브라우저 시각검수 및 로그인/PDF E2E 미수행.

원씽: 미사용 다운로드 캐시를 줄이고 원본과 현재 실행 의존성은 보존한다.
운영: http://172.16.1.232/home

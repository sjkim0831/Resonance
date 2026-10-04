# Gradle 자동 생성 API 캐시 정리

2026-09-08 약3분. 삭제1파일180,016,384bytes(171.68MiB).

대상 /opt/Resonance/runtime/host-data/build-repositories/resonance-gradle/user-home/caches/8.10/generated-gradle-jars/gradle-api-8.10.jar

Gradle 생성 캐시이며 프로젝트 배포JAR가 아니다. 생성일2026-08-26. 정확한 canonical경로, symlink없음, hardlink1, 부모 폴더lsof열린파일없음, 삭제직전inode/크기/mtime 확인. lock파일은 보존. resonance-gradle 전체465MiB→293MiB.

다음 Gradle 사용 시 캐시 재생성이 필요할 수 있어 첫 실행 시간이 늘어날 수 있다. 이번에는 재생성/빌드를 실행하지 않았다. 다운로드 의존성, wrapper, 프로젝트 코드 및 현재 실행JAR 유지.

GitHub Runner678MiB는 등록 파일과 현재 bin/externals 링크가 있어 보존. 서비스 검색 및lsof상실행미발견은 등록이 폐기됐다는 증거가 아니므로 일괄삭제하지 않았다. 계정값은 출력하지 않음.

서비스5개active, 홈HTTP200 확인. 재시작0회. 화면변경없음, 신규시각검수/로그인/PDF E2E미수행. DB/모델/업무데이터변경없음.

원씽: 재생성 가능한 생성물만 제거하고 등록된 실행도구와 업무데이터는 유지한다.
운영: http://172.16.1.232/home

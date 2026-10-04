# Gradle 배포판 비실행 자원 정리

2026-09-08 약 3분. base=/opt/Resonance/runtime/host-data/build-repositories/gradle-user-home/wrapper/dists/gradle-8.12-all/ejduaidbjup3bmmkhw3rie4zb/gradle-8.12

삭제: base/docs 및 base/src, Gradle 자체 설명서 및 Gradle 소스 21,828파일. 파일 바이트328,412,101(약313.2MiB). 디스크 할당 용량525MiB→145MiB, 약380MiB 감소. CCUS/P006 소스·설계문서가 아니다.

보존: bin/lib/init.d 및 프로젝트가 사용하는 Gradle8.10, 의존성 캐시, DB, AI 모델, 프로젝트 코드. 따라서 Gradle8.12-all은 전체 배포판 원형이 아니라 실행 파일만 남긴 상태다. Gradle 소스 탐색/오프라인 설명서는 사용할 수 없으며 필요하면 다시 배포판을 받아야 한다.

안전 검사: 정확한 canonical 경로, symlink 없음, 일반 파일 hardlink1, lsof 열린 파일 없음, 삭제 직전 inode/크기/mtime 재확인. 최초 lsof는 다른 사용자 GVFS 마운트 경고로 중단되어 삭제하지 않았다. 대상 밖 /run/user/108/gvfs 및 /run/user/1003/gvfs를 검사 제외한 재검사 통과 후 삭제했다.

검증: 정리 후 Gradle8.12 --version 정상 종료, 홈HTTP200. 주요 서비스5개 active는 삭제 전 확인했다. 신규 빌드·로그인/PDF E2E·화면 시각 검수는 수행하지 않았으며 서비스 재시작0회.

예방 방향: 향후 실행 환경은 Gradle bin 배포판을 사용하여 docs/src 재유입을 줄인다. 현재 프로젝트 wrapper는 이미8.10-bin을 사용하며 변경하지 않았다.
원씽: 프로젝트 소스가 아닌 개발 도구의 비실행 자원만 정리한다.
운영: http://172.16.1.232/home

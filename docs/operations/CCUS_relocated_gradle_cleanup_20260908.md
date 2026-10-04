# 이전 경로 Gradle 생성 캐시 정리

2026-09-08 약2분. /opt/Resonance/runtime/host-data/relocated-20260907/.gradle/caches 아래 8.10/javaCompile 및 build-cache-1만 삭제. 81파일38,324,667bytes(약36.55MiB). .gradle79MiB→42MiB.

실제경로 확인, 열린파일없음, 내부symlink없음, hardlink1, 외부symlink 대상/상위참조없음, 삭제직전inode/크기/mtime확인. 서비스/스크립트 직접경로참조 미발견. 미래수동사용까지 배제한 것은 아니다.

Maven저장소 및 Gradle다운로드의존성은 보존. 프로젝트소스·DB·모델·사용자이력변경없음. 해당 캐시 사용시 다시컴파일할수있어 첫빌드시간이늘어날수있음. 재빌드검증미수행.

서비스5개active. 재시작0회. 신규화면변경없음, 시각/E2E검수미수행.
원씽: 소용량 저장소를 통째지우지 않고 재생성 가능한 컴파일캐시만 제거한다.
운영: http://172.16.1.232/home

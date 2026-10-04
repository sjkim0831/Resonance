# 개발 도구 다운로드 캐시 정리

2026-09-08 약4분. 삭제1파일 41,650,304bytes(39.72MiB).

대상: /opt/Resonance/runtime/host-data/developer-cache/pyapp/distributions/15886016152894656430

gzip/tar Python 배포 압축 캐시이며 수정일2026-06-17. 설치된 Python 또는 프로젝트 파일이 아니다. 정확한 실경로, symlink 없음, hardlink1, lsof 사용없음, 삭제 직전 inode/크기/mtime 재확인 후 삭제. 이후 PyApp 설치 작업은 재다운로드 및 네트워크가 필요할 수 있다. 자동 정리 정책은 추가하지 않았다.

보존: Kilo 이력 DB(삭제 동의 미확정), Dart .pub-cache1.3GiB(모바일 프로젝트 pubspec 발견 및 active_roots 존재), Kilo별도홈770MiB(작업/계정 데이터 가능), 실행 라이브러리 및 모든 프로젝트 소스.

삭제 후 주요서비스5개 active, 홈HTTP200. 신규 화면 변경 없음, 시각검수 및 인증 E2E는 미수행. 재시작0회.

원씽: 재다운로드 가능한 설치 압축본만 제거하고 설치된 실행 환경과 작업 이력은 보존한다.
다음: Dart active_roots의 프로젝트 경로를 확인하여 실제 필요한 캐시 범위를 좁힌다.
운영: http://172.16.1.232/home

# 빌드 정적 자원 복사본 정리

2026-09-08 약 2분. 삭제 경로: /opt/Resonance/apps/carbonet-api/build/resources/main/static

1. build/resources 전체 9,546개 비교: 9,543개 동일, 2개 상이, 원본 없는 파일 1개.
2. 상이 파일 application.yml 및 db/migration/postgresql/V20260723051000__close_step_schema_set_blockers.sql, 원본 없는 application.yml.bak는 유지했다. 설정 내용은 공개하지 않았다.
3. static 하위 9,259개만 원본 src/main/resources/static와 크기·SHA-256 전체 일치 확인 후 삭제. 총 파일 크기 295,320,940 bytes(약 281.6MiB).
4. 루트 내 심볼릭 링크 연결, 하드링크, 열린 파일 검사 및 삭제 직전 inode/크기/수정시각 재확인 통과. 현재 systemd 실행 설정의 직접 경로 참조는 발견하지 않았다.
5. build 디스크 사용량 약 490MiB → 189MiB. 파일 크기 합과 디스크 블록 사용량은 다르다.

원본·현재 runtime·build/libs JAR·DB·모델·P006·reference 유지. Gradle processResources가 삭제된 출력물을 재생성할 수 있으므로 영구적인 빌드 크기 최적화는 아니다. 전체 재빌드는 이번 범위에 포함하지 않았다.

검증: 주요 서비스 5개 active, backend health UP, 홈 HTTP 200/pageerror 0. 스크린샷을 열어 헤더·검색·업무 길잡이·QA·화면 설계 표시 확인. 관리자 로그인/PDF/전체 업무 E2E는 미수행. 재시작 0회.

![정리 후 홈](CCUS_static_cleanup_home_20260908.png)

원씽: 해시가 같은 미사용 출력만 지우고 설정 차이는 보존한다.
다음은 남겨둔 설정·SQL 3개가 과거 잔여인지 필요한 변경인지 내용 차이를 검토하는 것이다.

운영: http://172.16.1.232/home

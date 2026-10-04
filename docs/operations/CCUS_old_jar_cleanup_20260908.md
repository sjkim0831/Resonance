# 과거 Maven JAR 정리 결과

2026-09-08 약 2분. 서비스 재시작 0회.

삭제: /opt/Resonance/apps/carbonet-api/target/project-runtime.jar

- 2026-07-08 산출물, 163,646,107 bytes(약 156MiB).
- 현재 서비스는 runtime 하위 exploded Java 런타임을 사용한다.
- 조사한 ops/scripts/.github/.githooks의 해당 파일명 참조 미발견. target/carbonet-api.jar 등 다른 파일명 참조는 구분했다.
- 일반 파일·하드링크 1개, /opt/Resonance 안의 심볼릭 링크 연결 없음, lsof 열린 파일 없음 확인 후 삭제.
- target 폴더는 약 157MiB에서 136KiB로 감소. 남은 클래스·메타데이터는 삭제하지 않았다.

유지: build 전체 490MiB. build/libs/carbonet-api.jar는 start-project-runtime.sh, create-new-project.sh, build-thin-runtimes.sh가 참조하므로 보존했다. 해당 JAR도 7월 산출물이므로 현재 운영의 최신 배포본과 동일하다고 간주해서는 안 된다. 현행 배포 경로 단일화는 별도 검증이 필요하다.

기존 배포 스크립트·systemd 설정은 수정하거나 제거하지 않았다. java-fast-dev.service는 점검 당시 이미 failed 상태였으며 현재 CCUS 실행 서비스와 구분했다.

검증: CCUS 백엔드·프런트엔드·DB·P006·Omniverse 5개 서비스 active, health UP, 홈 HTTP 200/pageerror 0. 캡처 확인 완료. 로그인·PDF·각 업무 전체 E2E 검증은 아니다.

![홈 확인](CCUS_old_jar_cleanup_home_20260908.png)

원씽: 이름이 비슷해도 실제로 참조하는 산출물과 과거 산출물을 구분한다.
다음은 남은 build의 305MiB resources가 소스와 중복인지, 실행·패키징 경로에 어떻게 사용되는지 확인하는 것이다.

운영: http://172.16.1.232/home

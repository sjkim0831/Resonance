# 빌드 백업 설정 및 패키징 경로 검토

2026-09-08 / 약 2분 / 읽기 전용 조사. 삭제 0건, 재시작 0회.

## 증거
1. apps/carbonet-api/build/resources/main/application.yml.bak는 같은 디렉터리 application.yml과 permitAllList 한 행만 다르다. 권한 관련 설정으로 값은 출력하지 않았다.
2. apps/carbonet-api/build/libs/carbonet-api.jar 안에 BOOT-INF/classes/application.yml.bak가 있고, 외부 백업과 바이트가 일치한다. JAR 포함 사실은 확인했으나 Spring이 해당 .bak를 설정으로 읽는다는 의미는 아니다.
3. apps/carbonet-api/build.gradle.kts에는 bootJar의 이름/버전 설정이 있으나 이 파일 자체에 .bak 제외 규칙은 없다. 전역 규칙 전체 검증은 미수행이다.
4. ops/scripts/start-project-runtime.sh는 기본값으로 위 build/libs/carbonet-api.jar를 복사하여 실행한다. 현재 운영 서비스가 이 스크립트를 사용한다는 의미는 아니다.
5. ops/scripts/build-thin-runtimes.sh는 Gradle 경로에서 :apps:project-runtime:bootJar 및 :apps:operations-console:bootJar를 호출한다. 조사 대상 앱 디렉터리명 carbonet-api와 불일치한다. 해당 구형 스크립트를 실행하지 않았다.
6. ops/scripts 및 /etc/systemd/system 범위에서 application.yml.bak 직접 문자열 참조는 발견하지 못했다. 동적 참조 가능성까지 배제한 것은 아니다.

## 판단
백업 파일은 단순 중복이 아니라 과거 접근 허용 정책을 담는다. 이번에는 정책 변경 및 기존 JAR 수정 없이 보존한다. 기존 빌드 JAR를 최신 배포본으로 간주하면 안 된다.

## 다음 정리 설계
실제 사용하는 패키징 진입점과 프로젝트 등록명을 대조하여 구형 스크립트를 사용 중/미사용으로 분류한다. 필요한 빌드 경로에는 백업 제외 및 원본-산출물 파일목록 검증을 적용하고, 검증을 통과한 새로운 산출물 확보 후 과거 JAR 제거를 결정한다. 이 예방 설계는 아직 구현하지 않았다.

이번 작업은 파일/JAR 검사이며 화면 변경이 없어 신규 스크린샷 및 브라우저 E2E를 수행하지 않았다.

원씽: 용량보다 과거 설정이 배포 파일에 섞이지 않도록 하는 것이 우선이다.
운영 확인: http://172.16.1.232/home

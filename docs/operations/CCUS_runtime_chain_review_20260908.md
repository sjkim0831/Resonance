# CCUS 실행 및 패키징 호출 관계 점검

2026-09-08. 약 2분. 대상 /opt/Resonance. 삭제 0건, 빌드 0회, 재시작 0회.

## 실제 확인
1. carbonet-production-direct 서비스 WorkingDirectory는 /opt/Resonance/runtime/platform-data/dev-runtime/certificate-verification/backend이다. build/libs와 다른 경로다.
2. settings.gradle.kts 등록 앱은 apps:carbonet-api 및 apps:operations-console이다. apps:project-runtime 등록은 없다.
3. build-thin-runtimes.sh는 :apps:project-runtime:bootJar를 호출하므로 현재 설정과 맞지 않는다. 실행하지 않았으며 수정하지 않았다.
4. start-project-runtime.sh는 manage-project-runtime.sh의 start에서 실제 호출된다. create-new-project.sh는 해당 명령을 신규 프로젝트 메타데이터에 기록한다. bootstrap-thin-project.sh에도 안내가 남아 있다.
5. 따라서 start-project-runtime.sh와 기본 대상 build/libs/carbonet-api.jar(디스크 약 185MiB)는 현재 운영 경로와 다르더라도 아무 참조 없는 잔여물로 분류할 수 없다.
6. 조사한 ops/scripts, scripts, .github, 루트 Gradle, systemd 및 cron.d 범위에서 build-thin-runtimes.sh 외부 참조는 발견되지 않았다. 수동 사용 및 다른 경로 참조 가능성은 남아 있다.

## 정리 판단
실행 진입점과 호출 관계가 있는 스크립트 및 JAR는 유지했다. 오래된 빌드 명령은 별도의 수리 또는 폐기 대상으로 기록했다. 기존 JAR를 최신 배포본으로 보증하지 않는다.

## 검증
CCUS backend/frontend, PostgreSQL, P006, Omniverse 서비스 5개 active. UI 수정 없음. 새 스크린샷, 로그인 및 PDF E2E 미수행.

## 다음 작업
소용량 스크립트 검토를 반복하기보다 현재 폴더별 용량을 다시 집계하고, 생성물·캐시·미사용 출력물을 묶어 검토한다. 원본, DB, 사용 모델, P006 및 reference는 보호한다.

원씽: 현재 서비스가 사용하지 않는다는 사실만으로 다른 실행 경로의 파일까지 삭제하지 않는다.
운영 확인: http://172.16.1.232/home

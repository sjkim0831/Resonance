# /opt/Resonance 폴더 목록·정리 분류

2026-09-08 14:29 KST 실측. 약 1분 조사. 읽기 전용이며 삭제·이동·재시작 0건.
du -x 기준 디스크 사용량이며 다른 파일시스템을 가로지르거나 심볼릭 링크 대상을 따라 합산하지 않는다. 사람이 읽는 단위 반올림 때문에 합계에 오차가 있다. 공유/하드링크 항목을 다시 측정한 하위 수치는 중복 합산하지 않는다.

## 전체

- 약 249GiB, 최상위 디렉터리 27개(숨김 포함).
- runtime 약 242GiB, 전체의 약 97%.
- reference는 이번 조사·변경 범위에서 제외. 이 루트의 최상위 디렉터리 목록에는 없다.

## 최상위 전체 목록

| 폴더 | 용량 | 용도·권고 |
|---|---:|---|
| runtime | 242GiB | 실제 실행본·DB·모델·이관 자료. 하위별 검토, 통째 삭제 금지 |
| var | 2.4GiB | 로그·상태·AI 런타임 자료. 현재 수집기 체크포인트 포함, 선별 검토 |
| projects | 1.8GiB | CCUS 프런트엔드·P006·공유 자산. 유지 |
| .git | 1.4GiB | 버전 이력. 소스와 별개, 임의 삭제 금지 |
| apps | 1.2GiB | API·운영 콘솔 소스와 build/target. 소스 유지, 산출물 의존성 확인 |
| modules | 102MiB | 공통·인증·SDUI·관측 등 Gradle 등록 모듈. 유지 |
| data | 84MiB | 데이터·설정성 자료. 하위 참조 확인 필요 |
| docs | 23MiB | 설계·운영·검증 문서. 유지 |
| ops | 7.5MiB | 실제 프록시·수집기·서비스 설정·테스트. 유지 |
| db | 1.9MiB | DB 관련 소스/정의 후보. 실제 DB 데이터 디렉터리는 runtime 내부 |
| ai-builder | 740KiB | 생성기 후보. 호출·빌드 참조 확인 후 분류 |
| scripts | 348KiB | 보조 스크립트. ops와 중복 가능성 검토, 즉시 삭제 불가 |
| frontend | 316KiB | 공통/보조 프런트엔드 후보. projects 소스와 참조 비교 필요 |
| templates | 184KiB | 생성 템플릿 후보. 제너레이터 참조 확인 |
| common | 140KiB | 공유 자료 후보. modules와 역할 비교 필요 |
| gradle | 60KiB | Gradle 빌드 도구. 유지 |
| manifests | 56KiB | 배포/선언 자료 후보. 컨테이너 전용인지 확인 후 정리 |
| third_party | 56KiB | 외부 라이브러리/라이선스 후보. 의존성 확인 |
| plans | 32KiB | 작업 계획. 문서 보관 통합 후보 |
| package-sets | 20KiB | 패키지 구성 후보. 참조 확인 |
| skills | 20KiB | 개발 지침 후보. 사용 여부 확인 |
| tests | 20KiB | 테스트. ops/tests와 역할 비교 |
| config | 16KiB | 설정. 사용 경로 확인 후 통합 여부 결정 |
| .github | 16KiB | 저장소 자동화 설정. 참조 확인 |
| catalog | 12KiB | 목록/메타데이터 후보. 참조 확인 |
| .githooks | 8KiB | Git 훅. core.hooksPath 확인 전 삭제 금지 |
| .secrets | 8KiB | 비밀 설정. 내용은 열지 않았으며 유지 |

후보라고 적은 용도는 폴더 이름 기반의 잠정 분류다. 실제 호출·사용 확인 없이 미사용으로 확정하지 않는다.

## 대용량 하위 경로

| 경로 (루트 기준) | 용량 | 판단 |
|---|---:|---|
| runtime/host-data/postgresql-dev | 65GiB | 개발 DB 후보. 프로세스·연결·마운트 확인 전 삭제 금지 |
| runtime/postgresql16 | 64GiB | 현재 운영 native PostgreSQL. 유지 |
| runtime/tools/ai | 63GiB | 모델·AI 도구. 사용 모델 제외 조건 유지 |
| runtime/host-data/user-local | 31GiB | 이관된 사용자 런타임/라이브러리. 현재 psycopg2 등 개발 의존성 가능 |
| runtime/platform-data/dev-worktrees | 5.1GiB | 일부 경로를 현재 프록시·수집기가 실제 참조. 이름만 보고 과거본 삭제 금지 |
| runtime/host-data/home-organized-20260907 | 4.9GiB | 이관 자료. 심볼릭 링크/프로세스 참조 확인 필요 |
| runtime/host-data/developer-tools | 3.2GiB | 개발 도구. 실사용 확인 |
| runtime/host-data/build-repositories | 3.0GiB | Java 의존성·브라우저 테스트 런타임. 최근 테스트에서 사용 |
| var/ai-runtime | 1.9GiB | 세부 사용 현황 검토 |

## 실제 프로젝트 관련

- projects/carbonet-frontend: 771MiB, source 687MiB. 현재 프런트엔드 서비스 사용.
- projects/P006: 238MiB.
- projects/carbonet-assets: 139MiB.
- projects/carbonet-backend-metadata: 677MiB, 이 중 omniverse-assets 531MiB. P006 관련 자산일 수 있어 삭제 금지.
- apps/carbonet-api: 약 1.1GiB. src 305MiB, build 490MiB, target 158MiB. 실제 실행 JAR는 runtime 하위이지만 build/target의 추가 참조는 확인해야 한다.

## 최상위 파일 검토 후보

Dockerfile, .dockerignore, pom.xml, NUL, .auto-deploy.pid, .file-watch.pid, .automation-search-context-fallback.txt, docs_ai.py, .hermes.md 등이 있다. 파일 존재만으로 미사용을 판정하지 않았다. build.gradle.kts/settings.gradle.kts/gradlew/gradlew.bat/gradle.properties는 현재 빌드 체계와 연관된다.

## 다음 순서

1. 작은 폴더의 이름을 바꾸기보다 build/target, 이관 자료, 개발 DB, 모델의 실제 참조부터 확인한다.
2. 유지/통합/삭제 후보마다 서비스·빌드·심볼릭 링크 근거를 붙인다.
3. 삭제 또는 이동은 검증된 후보만 시행하고 웹앱·P006·DB·모델 상태를 확인한다.

원씽: 소스 폴더 개수보다 runtime 안의 실제 저장물 구분이 용량 정리의 핵심이다. 이번에는 구조 변경을 하지 않아 새 화면 검수는 하지 않았다.

운영 확인: http://172.16.1.232/home

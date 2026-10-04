# CCUS·P006 중심 전체 폴더 정리 설계

2026-09-08, 작업 약 5분. 대상 /opt/Resonance 전체 재귀 목록. 파일 내용·비밀키를 수집하지 않고 경로/크기/시간/링크 메타정보만 기록.

## 현재 규모와 조사 범위

- sudo du 기준 약 132GiB.
- 폴더 104,344개, 일반 파일 778,193개, 심볼릭 링크 4,126개, 열거 오류 0건.
- 링크를 따라 재귀 진입하지 않아 중복/외부 탐색을 방지. 파일 목록은 실행 중 변동할 수 있음. 하드링크는 경로별 계산하여 CSV 합계는 du와 다를 수 있음.
- 전체 파일의 목록 수집은 완료. 778,193개 각각의 사용/미사용 판정이나 최신 빌드 검증 완료를 의미하지 않음.

## 필수 경로 지도

|역할|실제 경로|관찰 용량|판정|
|---|---|---:|---|
|CCUS 프런트|projects/carbonet-frontend/source|상위 771MiB|보존, npm build가 ops/scripts/ccus-build-current.sh 호출|
|CCUS 백엔드|apps/carbonet-api|639MiB|보존|
|공통 Gradle 모듈|modules|102MiB|settings.gradle.kts에서 다수 include, 보존|
|CCUS 공유 정적 자원|projects/carbonet-assets|139MiB|보존|
|설계/생성 데이터 및 Omniverse 자원|projects/carbonet-backend-metadata|677MiB|보존, 내부 omniverse-assets 531MiB|
|P006 프로젝트|projects/P006|238MiB|보존|
|P006 실행 웹 뷰어|runtime/host-data/web-viewer-sample|194MiB|2개 서비스 실행 경로, 보존|
|Omniverse Kit/프로젝트|runtime/host-data/home-organized-20260907/linked-projects|4.7GiB|보존|
|CCUS 현재 Java 실행본|runtime/host-data/dev-runtime/certificate-verification|374MiB|보존, 서비스는 platform-data/dev-runtime 링크 사용|
|운영 DB|runtime/postgresql16|7.8GiB|보존|
|개발 DB|runtime/host-data/postgresql-dev|7.4GiB|명시적 보존|
|AI 모델 및 런타임|runtime/tools/ai|약63GiB|사용 모델과 Python/CUDA 의존성 확인 전 보존|
|Python/Omniverse/개발도구 혼합|runtime/host-data/user-local|31GiB|일괄 삭제 금지|
|빌드/브라우저 의존성|runtime/host-data/build-repositories|2.5GiB|최신 빌드 및 PDF/테스트에 필요한 범위 보존|
|운영 스크립트/설계/설정|ops, scripts, docs, config, data, db, gradle 및 루트 빌드 파일|각기 다름|의존성 따라 보존|

## 우선 정리 후보와 차단 이유

|경로|용량|현재 판정/다음 확인|
|---|---:|---|
|runtime/host-data/user-local/share/kilo|5.9GiB|개발 도구 이력 후보. 웹앱 데이터가 아닌지, 다른 도구가 읽는지 및 이력 폐기 범위 확정 필요|
|runtime/platform-data/dev-worktrees|5.1GiB|과거본처럼 보여도 현재 로그 생산/소비 참조 존재. 현재 실행 의존성을 옮긴 후 정리|
|runtime/host-data/developer-tools|1.9GiB|Codex/Hermes/Kilo 및 환경 혼합. 프로세스/서비스/명령 래퍼별 판정 필요|
|var/ai-runtime|1.9GiB|반복 실패 로그와 설계 생성물 혼합. 생산자 중지 없이 삭제하면 재증가|
|var/ai-runtime/system-design-generator|329MiB|설계문서/스냅샷이며 생성·복구 스크립트 참조 있음. 단순 캐시로 삭제하지 않음|
|runtime/platform-data/control-plane|167MiB|이미 부분 정리된 과거 복사본과 구 자동화. 상이한 설계 남아 있음|
|runtime/tools/k9s|124MiB|Python 운영 웹 서비스가 web 하위 폴더에서 실제 실행 중. Kubernetes 도구 이름만으로 전체 삭제 불가|
|.git|1.4GiB|현재 개발 이력/워크트리 메타정보. 이번 삭제 안 함|

## 정돈 목표: 프로젝트 2개 + 공통 기반

현재 프로젝트는 물리적으로 두 폴더에만 갇혀 있지 않다. CCUS/P006 최신 빌드·실행을 보존하려면 다음 역할을 유지한다.

1. projects: CCUS 프런트·자원·메타데이터와 P006 프로젝트.
2. apps/modules: CCUS 백엔드와 공유 모듈.
3. runtime: 운영 실행본, DB, 모델, Omniverse, 도구 의존성.
4. ops/config/gradle/scripts: 실행·빌드·배포·생성 스크립트.
5. docs/tests/data/db: 설계, 검증 및 실제 사용하는 데이터/스키마.
6. var: 크기/보관기한 관리가 필요한 로그와 임시 산출물.

carbonet 이름의 디렉터리는 현재 빌드 및 서비스 참조에 남아 있으므로 CCUS라는 표시명과 별개로 경로를 즉시 변경하지 않는다. /opt/reference는 작업 대상 밖으로 보존.

## 실행 순서

전체 목록 기준으로 독립된 후보를 일괄 선정 → 프로세스·systemd·링크·빌드/생성기 참조 확인 → 안전한 항목만 삭제 → 필수 경로/화면 검증. 삭제 수량을 100개로 맞추기 위해 위험 항목을 포함하지 않는다.
이동은 경로 변경과 소비자 설정 수정이 함께 필요하므로 별도 배치로 수행한다. 정상 실행 중인 서비스를 재시작하거나 모델/DB를 제거하지 않음.

## 이번 수행 결과

전체 재귀 인벤토리와 역할별 정리 설계 작성. 삭제 0건, 이동 0건, 서비스 변경 0회. 전체 최신 빌드와 로그인/PDF/P006 E2E는 이번에 실행하지 않았으며, 완료로 주장하지 않음. 현재 132GiB를 두 웹앱 소스 용량으로 해석하면 안 됨.

# Resonance Gradle 전환 + 모듈 구조 재구성 계획

**최종 업데이트:** 2026-07-07  
**목적:** resonance-core / project-core 이분법 기반 무빌드/무배포 가능架构 + Gradle 전환 동시 진행

---

## 1. 현황 진단 요약

### 1.1 발견된 문제

| # | 문제 |严重影响 |
|---|---|---|
| **P1** | `modules/resonance-common/src/` 디렉토리에 16개 Java 파일 + 3개 SQL이 **어느 모듈にも속하지 않음** | AdminMenuController, MenuService, AuthController 등 Maven 빌드에 포함된 적 없음 → 화면/기능이 보이지 않거나 수정해도 반영 안 됨 |
| **P2** | `common-auth` 모듈에 자체 `src/` 없음 → `<includes>`로 `carbonet-common-core/src/`의 `egovframework/com/feature/auth/**`를 빌려 씀 | Split-package (동일 FQCN 두 jar에 존재 가능), `common-auth`만 단독 빌드 시 런타임 ClassNotFound |
| **P3** | `platform-runtime-control`의 `${project.basedir}/../../src/main/resources` 상대경로가 존재하지 않는 디렉토리를 참조 | mapper XML 누락 가능 |
| **P4** | Spring Boot 버전 혼재: 루트 POM 3.4.5, `operations-console` 데이터 JPA 3.5.6 | 빌드 결과 재현성 저하 |
| **P5** | `operations-console`이 `carbonet-app/src/main/resources/static`를 빌드 단계에서 복사하는 강결합 | carbonet-app 변경 시 operations-console도 재빌드해야 반영 |
| **P6** | 모든 모듈 `target/`에 JAR 산출 but Dockerfile은 `operations-console.jar` 1개만 복사 | carbonet-app, project-runtime 빌드 변경이 컨테이너에 반영 안 됨 |

### 1.2 현재 모듈 의존성 그래프 (핵심만)

```
platform-service-contracts
  ↑ depends on
platform-request-contracts   ← web-support, mapper-infra, stable-execution-gate

carbonet-common-core         ← carbonet-business 도메인, egovframework/com/feature/auth/**
  ↑ depends on
  ├── common-auth            (현재 문제: src/ 없음, carbonet-common-core의 코드를 빌려 씀)
  ├── screenbuilder-carbonet-adapter  (builder → carbonet 연결)
  ├── stable-execution-gate
  └── platform-observability-*

platform-runtime-control     ← runtimecontrol-core + stable-execution-gate + screenbuilder-core

apps/project-runtime         ← carbonet-common-core + screenbuilder-carbonet-adapter + 14개 플랫폼 모듈
apps/carbonet-app            ← carbonet-common-core (JAR only, no java source)
apps/operations-console     ← carbonet-common-core (JAR only, no java source)
```

---

## 2. 목표: 2-Bucket 무빌드/무배포架构

### 2.1 resonance-core (재빌드 필요 없음, 순수 플랫폼)

| 모듈명 | 역할 | 현재 상태 |
|---|---|---|
| `web-support` | 응답 포장, 예외 처리, CORS | ✅ 정상 |
| `platform-request-contracts` | 요청 DTO contract | ✅ 정상 |
| `platform-service-contracts` | 서비스 contract | ✅ 정상 |
| `mapper-infra` | MyBatis 매퍼 인프라 | ✅ 정상 |
| `stable-execution-gate` | 실행 게이트 | ✅ 정상 |
| `common-auth` | 인증/인가 (entity, service, controller) | 🔧 **수정 필요: 소스 부재 → 자체 src/ 이동 완료 (P2 수정됨)** |
| `versioncontrol-core` | 버전 관리 코어 | ✅ 정상 |
| `runtimecontrol-core` | 런타임 제어 코어 | ✅ 정상 |

**의존성 규칙:** `resonance-core` 내부 모듈은 외부 의존 없이 **Spring Boot 계층(starter-web 등)만 사용**. 외부 시스템 연동(ScreenBuilder, Ollama 등)은 모두 `project-core` 또는 `apps`에서 처리.

### 2.2 project-core (재빌드/재배포 대상)

| 모듈명 | 역할 | 현재 상태 |
|---|---|---|
| `carbonet-common-core` | Carbonet 사업 도메인 (auth 구현, workbench, governance, versioncontrol, runtimecontrol, observability) | 🔧 **수정 필요: `com.resonance.common.**` 고아 소스 이동, split-package 해소** |
| `carbonet-contract-metadata` | 화면 계약 메타데이터 | ✅ 정상 |
| `platform-help` | 헬프 화면 | 🔧 **의존: carbonet-builder-observability (builder 분리 전까지 임시)** |
| `platform-help-content` | 헬프 콘텐츠 | ✅ 정상 |
| `platform-observability-web` | 관측성 웹 | ✅ 정상 |
| `platform-observability-query` | 관측성 쿼리 | ✅ 정상 |
| `platform-observability-payload` | 관측성 페이로드 | ✅ 정상 |

**의존성 규칙:** `project-core`는 `resonance-core` 모듈에 의존 가능. `resonance-builder`(ScreenBuilder)是 исключить됨 — 빌더 변경 시에만 별도 재빌드.

### 2.3 apps (무결합 부트 jar)

| 산출물 | 현재 의존 | 변경 후 |
|---|---|---|
| `operations-console.jar` | `carbonet-common-core`, `common-auth`, `platform-observability-*`, `ollama-control-plane` | `project-core` 모음 + `resonance-core` 모음 |
| `project-runtime.jar` | 위 + `screenbuilder-carbonet-adapter`, `carbonet-builder-observability` | 동일 |
| `carbonet-app.jar` | `carbonet-common-core` + 정적 리소스 | 동일 |

### 2.4 resonance-builder — 별도 빌드 단위 (제거 아님, 분리 관리)

ScreenBuilder 기반:* `screenbuilder-core`, `screenbuilder-carbonet-adapter`, `screenbuilder-runtime-common-adapter`, `carbonet-builder-observability`*

**의존성:** `resonance-core` 모듈에만 의존. `project-core`의 도메인 로직에는 의존하지 않음.

---

## 3. 执行 계획

### Phase 1: 잔여 문제 해소 (Gradle 전환 전 필수 선행) — 1~2일

#### Task 1.1: `modules/resonance-common/src/` 고아 소스 정리

**현재 상태:** `com.resonance.common.menu.admin.*`, `com.resonance.common.menu.*`, `com.resonance.common.auth.*` 16개 Java 파일이 어느 모듈에도 속하지 않음.

**실제 FQCN / 패키지 확인 결과:**

| 현재 패키지 | 내용 | 이동 대상 모듈 |
|---|---|---|
| `com.resonance.common.menu.admin.controller.*` | AdminMenuController, LayoutManagementController | `carbonet-common-core` |
| `com.resonance.common.menu.admin.service.*` | AdminMenuService, LayoutManagementService | `carbonet-common-core` |
| `com.resonance.common.menu.admin.dto.*` | LayoutTemplatePayload 등 4개 DTO | `carbonet-common-core` |
| `com.resonance.common.menu.service.*` | MenuService | `carbonet-common-core` |
| `com.resonance.common.menu.entity.*` | MenuInfo, MenuGroup | `carbonet-common-core` |
| `com.resonance.common.auth.service.AuthService` | ✅ `common-auth/src/main/java/com/resonance/common/auth/service/AuthService.java`로 **이미 이동됨** (세션 초반 작업) | `common-auth` (완료) |
| `com.resonance.common.auth.controller.AuthController` | ✅ `common-auth/src/main/java/com/resonance/common/auth/controller/`로 **이미 이동됨** | `common-auth` (완료) |
| `com.resonance.common.auth.entity.*` | ✅ `common-auth/src/main/java/com/resonance/common/auth/entity/`로 **이미 이동됨** | `common-auth` (완료) |

**잔여 11개 Java 파일 → `carbonet-common-core/src/main/java/com/resonance/common/`로 이동:**

```bash
# 이동 대상 (모듈 resonance-common/src/main/java/com/resonance/common/)
# menu/admin/controller/  → carbonet-common-core/src/main/java/com/resonance/common/menu/admin/controller/
# menu/admin/service/     → carbonet-common-core/src/main/java/com/resonance/common/menu/admin/service/
# menu/admin/dto/         → carbonet-common-core/src/main/java/com/resonance/common/menu/admin/dto/
# menu/service/          → carbonet-common-core/src/main/java/com/resonance/common/menu/service/
# menu/entity/           → carbonet-common-core/src/main/java/com/resonance/common/menu/entity/
```

**3개 SQL 파일 이동:**
```
modules/resonance-common/src/main/resources/db/
  ├── auth-schema.sql          → modules/resonance-common/carbonet-common-core/src/main/resources/db/
  ├── screen-builder-schema.sql → modules/resonance-common/carbonet-common-core/src/main/resources/db/
  └── menu-schema.sql           → modules/resonance-common/carbonet-common-core/src/main/resources/db/
```

**이동 후 검증:**
```bash
# 1. resonance-common/src/ 에 남은 파일 없어야 함
find modules/resonance-common/src -type f  # empty expected

# 2. carbonet-common-core에 Menu + AdminMenu Controller 있는지 확인
find modules/resonance-common/carbonet-common-core/src -name "*Menu*" -o -name "*Layout*" | grep "\.java$"

# 3. Maven 빌드 성공 확인
mvn -pl modules/resonance-common/carbonet-common-core -am clean compile -q
```

#### Task 1.2: `platform-runtime-control` 외부 리소스 참조 삭제

`modules/resonance-ops/platform-runtime-control/pom.xml`의 다음 블럭을 삭제:
```xml
<resources>
    <resource>
        <directory>${project.basedir}/../../src/main/resources</directory>
        <includes><include>egovframework/mapper/com/platform/runtimecontrol/**</include></includes>
    </resource>
</resources>
```
대신 `runtimecontrol-core` 모듈이 이미 보유한 mapper XML을 의존으로 참조하도록 수정:
```xml
<dependency>
    <groupId>egovframework</groupId>
    <artifactId>resonance-runtimecontrol-core</artifactId>
    <version>${project.parent.version}</version>
</dependency>
```

#### Task 1.3: `operations-console`의 `carbonet-app` 정적 리소스 강결합 해소

현재: `operations-console`의 maven-resources-plugin이 `${project.basedir}/../carbonet-app/src/main/resources/static`를 복사.

변경: `carbonet-app`의 리소스를 `projects/carbonet-assets/static/`로 이동하고, `operations-console`는 `projects/carbonet-assets/static`를 참조하도록 수정.

**동시에:** `carbonet-app`의 `pom.xml`에 `packaging=war`가 아닌 `packaging=jar`인데 정적 리소스를 보유하고 있음. `carbonet-app`은 더 이상 JAR 산출이 아니라 **리소스 전용 디렉토리**로 격하 (실제 Boot jar는 `operations-console`과 `project-runtime`임).

#### Task 1.4: Spring Boot 버전 통일

루트 `pom.xml`의 `spring-boot.maven-plugin.version=3.4.5`를 BOM으로 올리고, `operations-console`의 `spring-boot-starter-data-jpa` 3.5.6 버전을 루트 BOM으로 일원화.

### Phase 2: Gradle 멀티모듈 전환 — 3~5일

#### Task 2.1: 프로젝트基础的設置

```
resonance-workspace/
├── settings.gradle.kts
├── build.gradle.kts              (루트, 공통 plugins + version catalog import)
├── gradle/
│   └── libs.versions.toml        (BOM 역할)
├── buildSrc/                     (Convention plugins)
│   └── src/main/kotlin/
│       ├── resonance.java-conventions.gradle.kts
│       ├── resonance.library-conventions.gradle.kts
│       ├── resonance.spring-boot-app.gradle.kts
│       └── resonance.graalvm-native.gradle.kts  (optional, native 빌드 시)
└── modules/                       (기존 modules/를 Gradle 프로젝트로 변환)
```

#### Task 2.2: `libs.versions.toml` 작성

현재 사용 중인 모든 의존성 버전을 중앙 관리:

```toml
[versions]
java = "17"
spring-boot = "3.4.5"
jackson = "2.19.0"
lombok = "1.18.34"
graalvm = "23.1.2"
postgresql = "42.7.3"
jjwt = "0.12.6"
native-buildtools = "0.10.6"

[libraries]
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web", version.ref = "spring-boot" }
spring-boot-starter-actuator = { module = "org.springframework.boot:spring-boot-starter-actuator", version.ref = "spring-boot" }
spring-boot-starter-data-jpa = { module = "org.springframework.boot:spring-boot-starter-data-jpa", version.ref = "spring-boot" }
spring-boot-starter-validation = { module = "org.springframework.boot:spring-boot-starter-validation", version.ref = "spring-boot" }
spring-boot-maven-plugin = { module = "org.springframework.boot:spring-boot-maven-plugin", version.ref = "spring-boot" }
lombok = { module = "org.projectlombok:lombok", version.ref = "lombok" }
jackson-databind = { module = "com.fasterxml.jackson.core:jackson-databind", version.ref = "jackson" }
postgresql = { module = "org.postgresql:postgresql", version.ref = "postgresql" }
jjwt-api = { module = "io.jsonwebtoken:jjwt-api", version.ref = "jjwt" }
jjwt-impl = { module = "io.jsonwebtoken:jjwt-impl", version.ref = "jjwt" }
jjwt-jackson = { module = "io.jsonwebtoken:jjwt-jackson", version.ref = "jjwt" }
```

#### Task 2.3: settings.gradle.kts — 2-Bucket 구조 반영

```kotlin
rootProject.name = "resonance-workspace"

include("modules:resonance-core:web-support")
include("modules:resonance-core:platform-request-contracts")
include("modules:resonance-core:platform-service-contracts")
include("modules:resonance-core:mapper-infra")
include("modules:resonance-core:stable-execution-gate")
include("modules:resonance-core:common-auth")
include("modules:resonance-core:versioncontrol-core")
include("modules:resonance-core:runtimecontrol-core")

include("modules:project-core:carbonet-common-core")
include("modules:project-core:carbonet-contract-metadata")
include("modules:project-core:platform-help")
include("modules:project-core:platform-help-content")
include("modules:project-core:platform-observability-web")
include("modules:project-core:platform-observability-query")
include("modules:project-core:platform-observability-payload")

include("modules:resonance-builder:screenbuilder-core")
include("modules:resonance-builder:screenbuilder-carbonet-adapter")
include("modules:resonance-builder:screenbuilder-runtime-common-adapter")
include("modules:resonance-builder:carbonet-builder-observability")

include("modules:resonance-ops:platform-runtime-control")
include("modules:resonance-ops:platform-version-control")
include("modules:resonance-ops:ollama-control-plane")
include("modules:resonance-ops:workbench-core")

include("apps:project-runtime")
include("apps:operations-console")
include("apps:carbonet-app")
```

#### Task 2.4: buildSrc Convention Plugins

**`resonance.java-conventions.gradle.kts`:**
```kotlin
plugins {
    java
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
}
```

**`resonance.library-conventions.gradle.kts`:**
```kotlin
plugins {
    `java-library`
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
}

tasks.named<Jar>("jar") {
    archiveBaseName.set(project.name)
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}
```

**`resonance.spring-boot-app.gradle.kts`:**
```kotlin
plugins {
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

springBoot {
    mainClass.set("egovframework.com.ProjectRuntimeApplication") // overridable
}

tasks.named<BootJar>("bootJar") {
    archiveBaseName.set(project.name)
}

configurations.all {
    exclude(group = "org.apache.logging.log4j", module = "log4j-slf4j2-impl")
    exclude(group = "org.graalvm.polyglot")
    exclude(group = "org.graalvm.sdk", module = "collections")
    exclude(group = "org.graalvm.sdk", module = "nativeimage")
    exclude(group = "org.graalvm.js", module = "js-scriptengine")
    exclude(group = "org.graalvm.regex", module = "regex")
    exclude(group = "org.graalvm.truffle", module = "truffle-api")
}
```

#### Task 2.5: 모듈별 `build.gradle.kts` 변환 (app-level)

**resonance-core/library 모듈 예시 (`web-support`):**
```kotlin
plugins {
    id("resonance.library-conventions")
}

dependencies {
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
}
```

**project-core 모듈 예시 (`carbonet-common-core`):**
```kotlin
plugins {
    id("resonance.library-conventions")
}

dependencyManagement {
    imports(phase = DependencyManagementPhase.NONE) {
        // use libs.versions.toml
    }
}

dependencies {
    api(project(":modules:resonance-core:web-support"))
    api(project(":modules:resonance-core:common-auth"))
    api(project(":modules:resonance-core:mapper-infra"))
    api(project(":modules:resonance-core:stable-execution-gate"))
    api(project(":modules:resonance-core:platform-request-contracts"))
    api(project(":modules:resonance-core:platform-service-contracts"))
    api(project(":modules:resonance-core:versioncontrol-core"))
    api(project(":modules:resonance-core:runtimecontrol-core"))
    api(project(":modules:resonance-builder:screenbuilder-carbonet-adapter"))
    api(project(":modules:project-core:platform-observability-query"))
    api(project(":modules:project-core:platform-observability-payload"))
    api(project(":modules:project-core:platform-help"))
    api(project(":modules:project-core:carbonet-contract-metadata"))
    implementation(libs.springBootStarterWeb)
    implementation(libs.springBootStarterDataJpa)
    implementation(libs.springBootStarterValidation)
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
}
```

**apps/project-runtime 예시:**
```kotlin
plugins {
    id("resonance.spring-boot-app")
}

springBoot {
    mainClass.set("egovframework.com.ProjectRuntimeApplication")
}

dependencies {
    implementation(project(":modules:project-core:carbonet-common-core"))
    implementation(project(":modules:project-core:carbonet-contract-metadata"))
    implementation(project(":modules:project-core:platform-help"))
    implementation(project(":modules:project-core:platform-observability-web"))
    implementation(project(":modules:project-core:platform-observability-payload"))
    implementation(project(":modules:resonance-ops:platform-runtime-control"))
    implementation(project(":modules:resonance-ops:platform-version-control"))
    runtimeOnly(libs.postgresql)
    compileOnly(libs.lombok)
    annotationProcessor(libs.lombok)
}
```

#### Task 2.6: Gradle Wrapper 생성 및 검증

```bash
gradle wrapper --gradle-version=8.10
./gradlew :apps:project-runtime:bootJar -x test
curl -s http://localhost:8080/actuator/health  # 수동 검증
```

### Phase 3: 빌드/배포 스크립트 갱신 — 1~2일

Maven 호출을 Gradle로 교체:

| 기존 | 새 Gradle |
|---|---|
| `mvn -q -pl apps/project-runtime -am -DskipTests clean package` | `./gradlew :apps:project-runtime:bootJar -x test -q` |
| `mvn -pl :common-auth -am clean package` | `./gradlew :modules:resonance-core:common-auth:jar -x test` |
| `mvn dependency:tree` | `./gradlew :modules:project-core:carbonet-common-core:dependencies --configuration runtimeClasspath` |
| `mvn -T 8 package` | `./gradlew assemble --parallel --build-cache` |

**핵심 스크립트 대상:**
- `ops/scripts/build-thin-runtimes.sh`
- `ops/scripts/build-independent-runtimes.sh`
- `ops/scripts/resonance-backend-hotfix.sh`
- `ops/scripts/jenkins-deploy-carbonet.sh`
- `ops/scripts/codex-apply-and-deploy.sh`
- `ops/scripts/resonance-v3-deploy.sh`
- `ops/scripts/resonance-pr-ci.sh`

### Phase 4: Docker 이미지 재구성 — 1일

현재 Dockerfile이 `operations-console.jar`만 복사. 각 app jar를 선택적으로 복사하도록 리팩토링:

```dockerfile
ARG RUNTIME=operations-console
COPY --from=builder /build/apps/${RUNTIME}/build/libs/*.jar /app/${RUNTIME}.jar
```

---

## 4. 무빌드/무배포 운영 계약

### 4.1 빌드 트리거 조건

| 변경 영역 | 빌드 필요 | 배포 필요 |
|---|---|---|
| `resonance-core/*` 내부 (web-support, common-auth, mapper-infra 등) | ❌ 无 | ❌ 无 |
| `project-core/*` 내부 (carbonet-common-core, platform-help 등) | ✅ project-core 재빌드 | ✅ 재배포 |
| `resonance-builder/*` 내부 (screenbuilder-*) | ✅ resonance-builder 재빌드 | ✅ 재배포 |
| `resonance-ops/*` 내부 | ✅ 재빌드 | ✅ 재배포 |
| `apps/*` 내부 | ✅ 해당 app 재빌드 | ✅ 재배포 |
| `projects/carbonet-assets/static/*` (정적 리소스) | ❌ 무빌드 | ✅ 재배포 |

### 4.2 Gradle 빌드 범위 명령

```bash
# project-core만 재빌드 (resonance-core는 이미 빌드된 JAR 사용)
./gradlew :modules:project-core:carbonet-common-core:jar -x test

# 전체 프로젝트 빌드
./gradlew assemble

# 특정 app만 빌드 (의존 모듈 자동 포함)
./gradlew :apps:project-runtime:bootJar -x test

# resonance-builder만 재빌드
./gradlew :modules:resonance-builder:screenbuilder-core:jar -x test
```

---

## 5. 검증 계획

| 단계 | 검증 명령 | 성공 조건 |
|---|---|---|
| P1.1 | `find modules/resonance-common/src -type f` | 빈 출력 |
| P1.1 | `mvn -pl modules/resonance-common/carbonet-common-core -am clean compile -q` | 0 exit |
| P1.1 | `jar tf modules/resonance-common/carbonet-common-core/target/carbonet-common-core-*.jar \| grep MenuService` | 경로 존재 |
| P1.2 | `mvn -pl modules/resonance-ops/platform-runtime-control -am clean package -q` | 0 exit, mapper XML 포함 |
| P1.3 | `mvn -pl apps/operations-console clean package -q` && `jar tf apps/operations-console/target/operations-console.jar \| grep static` | 정적 리소스 포함 |
| P2.6 | `./gradlew :apps:project-runtime:bootJar -x test` | 0 exit, JAR 생성 |
| P2.6 | `./gradlew :apps:project-runtime:dependencies --configuration runtimeClasspath \| grep carbonet-common-core` | 경로 정확 |
| P3 | `grep -rn "mvn " ops/scripts/*.sh` | 0 results |
| P4 | `docker build -t test . && docker run --rm test ls /app/*.jar` | 모든 app jar 존재 |

---

## 6. 리스크 및 대응

| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | `common-auth`의 `AuthService` 두벌 (기존 `carbonet-common-core/.../feature/auth/service/`, 새 `common-auth/src/.../common/auth/service/`) | 컴파일 오류 or split-package | **실행 전** `carbonet-common-core` 내 `com.resonance.common.auth.*` 패키지가 없음을 확인. 기존 `feature/auth/`는 다른 패키지이므로 충돌 없음 |
| R2 | Gradle 전환 중 Maven POM을 삭제하면 롤백 어려움 | CI/CD 중단 | **Maven POM은 Phase 2 전체 완료 후에만 삭제**. Phase 2 중에는 POM + Gradle 동시 유지 |
| R3 | `screenbuilder-carbonet-adapter`가 `carbonet-common-core`에 순환 의존 가능 | 빌드 실패 | `resonance-builder` ↔ `project-core` 의존성 분석 필요. 순환 시 screenbuilder의 `carbonet-common-core` 의존을 제거하고 contract interface만 사용하도록 리팩토링 |
| R4 | `carbonet-builder-observability`가 `platform-help`를 의존 → resonance-builder가 project-core에 의존 | 빌드 분리 의미 약화 | 순환 없을 경우 유지. 순환 시 `platform-help` contract를 `resonance-core`로 이전 |

---

## 7. 미해결 질문 (구현 전确认 필요)

| # | 질문 | 권장 답변 |
|---|---|---|
| Q1 | `screenbuilder-carbonet-adapter`가 `carbonet-common-core`의 어떤 코드를 쓰는가? (순환 의존 여부 확인) | 구현 전 `dependency:tree` + 소스 레퍼런스 분석 필요 |
| Q2 | `carbonet-builder-observability` → `platform-help` 의존을 `resonance-builder`가 `project-core`에 의존하는 것으로 볼 것인가? | 예, resonance-builder가 project-core에 의존하면 "builder만 재빌드"가 의미 없어짐. `platform-help`의 screenbuilder 관련 부분을 `resonance-builder`로 이전하거나 contract interface로 분리 |
| Q3 | Docker 이미지에서 `operations-console`, `project-runtime`, `carbonet-app` 중 무엇을 주력 런타임으로 사용할 것인가? | 현재 `operations-console`이 주력. project-runtime과 명확히 구분해서 사용처 문서화 필요 |
| Q4 | Gradle 전환 중 기존 CI(Jenkins)가 Maven을 쓰고 있는 경우, 전환 기간 동안 이중 빌드 파이프라인 유지 가능한가? | 예 — PR 별로 Maven → Gradle로 마이그레이션하고, 전환 기간은 Gradle이 production, Maven이 fallback 역할 |

---

## 8. 실행 순서 (요약)

```
1. Phase 1 (1~2일)
   1.1 modules/resonance-common/src/ → carbonet-common-core 이동 (11개 Java + 3개 SQL)
   1.2 platform-runtime-control 외부 리소스 참조 제거 → runtimecontrol-core 의존으로 교체
   1.3 operations-console의 carbonet-app 리소스 강결합 해소
   1.4 Spring Boot 버전 통일

2. Phase 2 (3~5일)
   2.1 settings.gradle.kts + root build.gradle.kts 작성
   2.2 gradle/libs.versions.toml 작성
   2.3 buildSrc convention plugins 작성 (4개)
   2.4 resonance-core 모듈 build.gradle.kts (8개)
   2.5 project-core 모듈 build.gradle.kts (7개)
   2.6 resonance-builder / resonance-ops build.gradle.kts
   2.7 apps build.gradle.kts (3개)
   2.8 Gradle Wrapper 생성 + ./gradlew assemble 검증

3. Phase 3 (1~2일)
   3.1 Maven 호출 스크립트 Gradle로 교체 (~7개)
   3.2 Jenkinsfile 등 CI 갱신

4. Phase 4 (1일)
   4.1 Dockerfile multi-target 재작성
   4.2 통합 검증 (로컬 기동 + CI/CD)
```

---

## 9. 현재 완료된 작업 (세션 초반)

| 작업 | 상태 | 비고 |
|---|---|---|
| `common-auth` src 디렉토리 생성 + auth 파일 5개 이동 | ✅ 완료 | `com.resonance.common.auth.{entity,controller,service}` 패키지로 이동됨 |
| `common-auth/pom.xml` 수정 (자신의 src/ 사용, 잘못된 `<includes>` 제거) | ✅ 완료 | Lombok 의존성 추가, plugin includes 제거 |

**잔여 Phase 1 작업:** 위 Task 1.1 ~ 1.4 (모두 미실행 상태)
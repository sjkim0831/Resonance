import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import groovy.json.JsonOutput
import groovy.json.JsonSlurper

fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { "%02x".format(it) }

fun canonicalJson(value: Any?): String = when (value) {
    null -> "null"
    is String -> JsonOutput.toJson(value)
    is Number, is Boolean -> value.toString()
    is Map<*, *> -> value.entries.sortedBy { it.key.toString() }
        .joinToString(prefix = "{", postfix = "}", separator = ",") {
            "${JsonOutput.toJson(it.key.toString())}:${canonicalJson(it.value)}"
        }
    is Iterable<*> -> value.joinToString(prefix = "[", postfix = "]", separator = ",") { canonicalJson(it) }
    else -> error("unsupported canonical JSON value: ${value.javaClass.name}")
}

fun validateCanonicalEndpointProcess(processDir: File): File {
    val processPath = processDir.toPath().toAbsolutePath().normalize()
    require(Files.isDirectory(processPath) &&
        generateSequence(processPath) { it.parent }.none(Files::isSymbolicLink)) {
        "generated endpoint process ${processDir.name} must be a real directory without symlink traversal"
    }
    val manifest = processDir.resolve("manifest.json")
    val release = processDir.resolve("full-stack-release.json")
    val sourceDir = processDir.resolve("src/main/java")
    require(manifest.isFile && release.isFile) {
        "generated endpoint process ${processDir.name} lacks manifest/release evidence"
    }
    require(Files.isDirectory(sourceDir.toPath()) &&
        Files.walk(processPath).use { paths -> paths.noneMatch(Files::isSymbolicLink) }) {
        "generated endpoint process ${processDir.name} contains a symbolic link"
    }
    val manifestJson = JsonSlurper().parse(manifest) as Map<*, *>
    val releaseJson = JsonSlurper().parse(release) as Map<*, *>
    val artifacts = manifestJson["artifacts"] as? List<*>
        ?: error("generated endpoint process ${processDir.name} lacks artifact evidence")
    val manifestPayload = manifestJson.filterKeys { it != "bundleHash" }
    val releasePayload = releaseJson.filterKeys { it != "releaseHash" }
    require(manifestJson["schema"] == "carbonet.generated-endpoints/v1" &&
        releaseJson["schema"] == "carbonet.canonical-full-stack-release/v1" &&
        manifestJson["catalogHash"] == releaseJson["endpointCatalogHash"] &&
        manifestJson["bundleHash"] == releaseJson["endpointBundleHash"] &&
        manifestJson["bundleHash"] == sha256(canonicalJson(manifestPayload).toByteArray(Charsets.UTF_8)) &&
        manifestJson["artifactHash"] == sha256(canonicalJson(artifacts).toByteArray(Charsets.UTF_8)) &&
        releaseJson["releaseHash"] == sha256(canonicalJson(releasePayload).toByteArray(Charsets.UTF_8))) {
        "generated endpoint process ${processDir.name} has invalid release provenance"
    }
    require((manifestJson["artifactCount"] as? Number)?.toInt() == artifacts.size) {
        "generated endpoint process ${processDir.name} artifact count mismatch"
    }
    val expectedJava = artifacts.map { raw ->
        val artifact = raw as? Map<*, *>
            ?: error("generated endpoint process ${processDir.name} has invalid artifact evidence")
        val path = artifact["path"] as? String
            ?: error("generated endpoint process ${processDir.name} has an artifact without a path")
        val expectedHash = artifact["sha256"] as? String
            ?: error("generated endpoint process ${processDir.name} has an artifact without sha256")
        require(path.matches(Regex("^src/main/java/[A-Za-z0-9_./-]+\\.java$")) &&
            !path.split('/').contains("..") && expectedHash.matches(Regex("^[0-9a-f]{64}$"))) {
            "generated endpoint process ${processDir.name} has unsafe artifact evidence"
        }
        val artifactFile = processDir.resolve(path)
        require(artifactFile.isFile && sha256(artifactFile.readBytes()) == expectedHash) {
            "generated endpoint process ${processDir.name} artifact bytes diverge: $path"
        }
        path
    }
    require(expectedJava.size == expectedJava.toSet().size) {
        "generated endpoint process ${processDir.name} has duplicate artifact paths"
    }
    val actualJava = sourceDir.walkTopDown()
        .filter { it.isFile && it.extension == "java" }
        .map { it.relativeTo(processDir).invariantSeparatorsPath }
        .toSet()
    require(expectedJava.toSet() == actualJava) {
        "generated endpoint process ${processDir.name} Java artifact set diverges"
    }
    return sourceDir
}

plugins {
    id("java-library")
    id("maven-publish")
    id("io.spring.dependency-management") version "1.1.7"
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    withSourcesJar()
    withJavadocJar()
}

dependencyManagement {
    imports { mavenBom("org.springframework.boot:spring-boot-dependencies:3.4.5") }
}

group = "egovframework"
version = "1.0.0"

tasks.named<Jar>("jar") { enabled = true }

sourceSets {
    main {
        java {
            // Canonical endpoint generation is published atomically before the
            // backend build. Keeping it as a source directory makes a design
            // release change compile into the runtime without copying files.
            val generatedEndpointRoot = providers.environmentVariable("CANONICAL_ENDPOINT_ROOT")
                .map(::File)
                .orElse(rootProject.layout.projectDirectory.dir("projects/carbonet-backend-metadata/process-runtime/generated-endpoints").asFile)
                .get()
            val stagedSources = providers.environmentVariable("CANONICAL_ENDPOINT_SOURCE_DIRS").orNull
            if (!stagedSources.isNullOrBlank()) {
                val staged = stagedSources.split(File.pathSeparator).filter { it.isNotBlank() }.map(::File)
                require(staged.all { it.name == "java" && it.parentFile?.name == "main" && it.parentFile?.parentFile?.name == "src" }) {
                    "CANONICAL_ENDPOINT_SOURCE_DIRS must contain strict src/main/java directories"
                }
                staged.map { validateCanonicalEndpointProcess(it.parentFile.parentFile.parentFile) }.forEach(::srcDir)
            } else {
                require(!generatedEndpointRoot.resolve("src/main/java").exists()) {
                    "mixed legacy-root and process-scoped generated endpoint layouts are forbidden"
                }
                generatedEndpointRoot.listFiles()
                    ?.filter { it.name.matches(Regex("^[A-Z][A-Z0-9_]{1,79}$")) }
                    ?.sortedBy { it.name }
                    ?.forEach { processDir ->
                        srcDir(validateCanonicalEndpointProcess(processDir))
                    }
            }
            exclude("egovframework/com/platform/screenbuilder/bridge/**")
            exclude("egovframework/com/framework/authority/service/FrameworkAuthorityScreenBuilderConfiguration.java")
            exclude("egovframework/com/framework/authority/service/CarbonetScreenBuilderAuthoritySourceAdapter.java")
            exclude("egovframework/com/feature/admin/service/impl/CarbonetScreenBuilderAuthoritySourceBridge.java")
        }
    }
}

dependencies {
    compileOnly("org.springframework.boot:spring-boot-starter-web")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-fdl-idgnr:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-ptl-mvc:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-ptl-reactive:5.0.0")
    implementation("org.egovframe.boot:egovframe-boot-starter-crypto:5.0.0")
    implementation("org.egovframe.boot:egovframe-boot-starter-security:5.0.0")
    implementation("org.mybatis:mybatis:3.5.19")
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.core:jackson-core")
    implementation("com.fasterxml.jackson.core:jackson-annotations")
    implementation("org.springframework:spring-core")
    implementation("org.springframework:spring-context")
    implementation("org.springframework:spring-web")
    implementation("org.springframework:spring-beans")
    implementation("org.springframework:spring-tx")
    implementation("org.springframework:spring-jdbc")
    implementation("org.springframework:spring-aop")
    implementation("org.springframework.security:spring-security-web")
    implementation("org.springframework.security:spring-security-core")
    implementation("org.springframework.security:spring-security-config")
    implementation("jakarta.annotation:jakarta.annotation-api")
    implementation("org.slf4j:slf4j-api")
    compileOnly(project(":modules:resonance-builder:carbonet-builder-observability"))
    implementation("org.apache.pdfbox:pdfbox:2.0.31")
    implementation("org.apache.poi:poi-ooxml:5.3.0")
    api(project(":modules:resonance-common:web-support"))
    api(project(":modules:resonance-common:common-auth"))
    api(project(":modules:resonance-common:mapper-infra"))
    api(project(":modules:resonance-common:stable-execution-gate"))
    api(project(":modules:resonance-common:platform-request-contracts"))
    api(project(":modules:resonance-common:platform-service-contracts"))
    api(project(":modules:resonance-common:versioncontrol-core"))
    api(project(":modules:resonance-common:runtimecontrol-core"))
    api(project(":modules:resonance-ops:platform-version-control"))
    // screenbuilder-carbonet-adapter 와 mutual compile-time 의존: runtime-stage dependency only.
    runtimeOnly(project(":modules:resonance-builder:screenbuilder-carbonet-adapter"))
    api(project(":modules:resonance-common:platform-observability-query"))
    api(project(":modules:resonance-common:platform-observability-payload"))
    api(project(":modules:resonance-common:platform-help"))
    api(project(":modules:resonance-common:carbonet-contract-metadata"))
    compileOnly("org.springframework.boot:spring-boot-starter-data-jpa")
    compileOnly("org.springframework.boot:spring-boot-starter-validation")
    compileOnly("org.springframework.boot:spring-boot-starter-actuator")
    compileOnly("org.springframework.boot:spring-boot-starter-security")
    compileOnly("org.postgresql:postgresql:42.7.3")
    compileOnly("io.jsonwebtoken:jjwt-api:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
    compileOnly("org.apache.commons:commons-lang3:3.18.0")
    compileOnly("commons-io:commons-io:2.20.0")
    implementation("org.apache.commons:commons-text:1.14.0")
    compileOnly("commons-beanutils:commons-beanutils:1.11.0")
    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("org.mockito:mockito-core")
    testImplementation("io.jsonwebtoken:jjwt-api:0.12.6")
    testRuntimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    testRuntimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
    // AuthService exposes Spring Data pagination types. Keep them available to
    // isolated Mockito contract tests without promoting JPA into the runtime API.
    testImplementation("org.springframework.data:spring-data-commons")
    // CurrentUserContextService has repository fields. Inline Mockito inspects
    // that hierarchy, so the repository API must also exist on the isolated
    // test runtime classpath even though production wiring remains compileOnly.
    testImplementation("org.springframework.data:spring-data-jpa")
}

// Keep isolated contract tests on the application's Logback bridge. Some
// eGov transitive dependencies also contribute the inverse SLF4J -> Log4j
// provider, which forms a logging cycle and fails before the test can start.
configurations.testRuntimeClasspath {
    exclude(group = "org.apache.logging.log4j", module = "log4j-slf4j2-impl")
}

tasks.test { useJUnitPlatform() }

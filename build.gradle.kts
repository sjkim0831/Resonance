// Resonance root project
// Each subproject declares its own plugins including io.spring.dependency-management,
// which is required to resolve Maven BOM coordinates.
//
// Shared configuration is applied via duplicated per-module blocks (Java 17 toolchain,
// repositories, BOM imports). See individual build.gradle.kts files.

val springBootVersion = "3.4.5"
val egovFrameVersion = "5.0.0"

allprojects {
    group = "egovframework"
    version = "1.0.0"

    repositories {
        mavenLocal()
        mavenCentral()
        maven { url = uri("https://repo1.maven.org/maven2/") }
        maven { url = uri("https://maven.egovframe.go.kr/maven/") }
    }
}

subprojects {
    tasks.withType<JavaCompile>().configureEach {
        options.compilerArgs.add("-parameters")
    }
}

val resonanceCoreProjects = listOf(
    ":modules:resonance-common:web-support",
    ":modules:resonance-common:platform-request-contracts",
    ":modules:resonance-common:platform-service-contracts",
    ":modules:resonance-common:mapper-infra",
    ":modules:resonance-common:stable-execution-gate",
    ":modules:resonance-common:common-auth",
    ":modules:resonance-common:versioncontrol-core",
    ":modules:resonance-common:runtimecontrol-core"
)

val resonanceAdaptorProjects = listOf(
    ":modules:resonance-builder:screenbuilder-core",
    ":modules:resonance-builder:screenbuilder-carbonet-adapter",
    ":modules:resonance-builder:screenbuilder-runtime-common-adapter",
    ":modules:resonance-builder:carbonet-builder-observability"
)

val resonanceOpsProjects = listOf(
    ":modules:resonance-ops:platform-runtime-control",
    ":modules:resonance-ops:platform-version-control",
    ":modules:resonance-ops:ollama-control-plane",
    ":modules:resonance-ops:workbench-core"
)

val projectCoreProjects = listOf(
    ":modules:resonance-common:carbonet-common-core",
    ":modules:resonance-common:carbonet-contract-metadata",
    ":modules:resonance-common:platform-help",
    ":modules:resonance-common:platform-help-content",
    ":modules:resonance-common:platform-observability-web",
    ":modules:resonance-common:platform-observability-query",
    ":modules:resonance-common:platform-observability-payload",
    ":apps:carbonet-api"
)

tasks.register("resonanceCoreBuild") {
    group = "resonance"
    description = "Compile shared Resonance framework modules only. No project runtime image or rollout."
    dependsOn(resonanceCoreProjects.map { "$it:compileJava" })
}

tasks.register("resonanceAdaptorBuild") {
    group = "resonance"
    description = "Compile builder/adaptor modules only. No project runtime image or rollout."
    dependsOn(resonanceAdaptorProjects.map { "$it:compileJava" })
}

tasks.register("resonanceOpsBuild") {
    group = "resonance"
    description = "Compile operations modules only. No project runtime image or rollout."
    dependsOn(resonanceOpsProjects.map { "$it:compileJava" })
}

tasks.register("projectCoreBuild") {
    group = "resonance"
    description = "Compile project-core runtime modules and build carbonet-api bootJar. Use for Java/API changes requiring redeploy."
    dependsOn(projectCoreProjects.map { if (it == ":apps:carbonet-api") "$it:bootJar" else "$it:compileJava" })
}


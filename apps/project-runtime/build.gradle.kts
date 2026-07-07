import org.springframework.boot.gradle.tasks.bundling.BootJar

plugins {
    id("java-library")
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

dependencyManagement {
    imports { mavenBom("org.springframework.boot:spring-boot-dependencies:3.4.5") }
}

springBoot {
    mainClass.set("egovframework.com.ProjectRuntimeApplication")
}

tasks.named<BootJar>("bootJar") {
    archiveBaseName.set("project-runtime")
    archiveVersion.set("")
}

tasks.named<Jar>("jar") { enabled = false }

configurations.all {
    exclude(group = "org.apache.logging.log4j", module = "log4j-slf4j2-impl")
    exclude(group = "org.graalvm.polyglot")
    exclude(group = "org.graalvm.sdk", module = "collections")
    exclude(group = "org.graalvm.sdk", module = "nativeimage")
    exclude(group = "org.graalvm.js", module = "js-scriptengine")
    exclude(group = "org.graalvm.regex", module = "regex")
    exclude(group = "org.graalvm.truffle", module = "truffle-api")
}

dependencies {
    implementation(project(":modules:resonance-common:carbonet-common-core"))
    implementation(project(":modules:resonance-common:carbonet-contract-metadata"))
    implementation(project(":modules:resonance-common:platform-help"))
    implementation(project(":modules:resonance-common:platform-help-content"))
    implementation(project(":modules:resonance-common:platform-observability-web"))
    implementation(project(":modules:resonance-common:platform-observability-payload"))
    implementation(project(":modules:resonance-common:platform-observability-query"))
    implementation(project(":modules:resonance-ops:platform-runtime-control"))
    implementation(project(":modules:resonance-ops:platform-version-control"))
    runtimeOnly("org.postgresql:postgresql:42.7.3")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
}

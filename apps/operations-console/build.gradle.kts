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
    mainClass.set("egovframework.com.OperationsConsoleApplication")
}

tasks.named<BootJar>("bootJar") {
    archiveBaseName.set("operations-console")
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

val staticDir = project.rootDir.resolve("projects/carbonet-assets/static")

val copyFrontend by tasks.registering(Copy::class) {
    from(staticDir)
    into("${buildDir}/classes/java/main/static")
}

tasks.named<JavaCompile>("compileJava") {
    dependsOn(copyFrontend)
}

dependencies {
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    implementation(project(":modules:resonance-common:carbonet-common-core"))
    implementation(project(":modules:resonance-common:common-auth"))
    implementation(project(":modules:resonance-common:stable-execution-gate"))
    implementation(project(":modules:resonance-common:web-support"))
    implementation(project(":modules:resonance-common:platform-observability-query"))
    implementation(project(":modules:resonance-common:platform-observability-payload"))
    implementation(project(":modules:resonance-ops:ollama-control-plane"))
    runtimeOnly("com.h2database:h2:2.2.224")
    compileOnly("io.jsonwebtoken:jjwt-api:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
}

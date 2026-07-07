plugins {
    id("java-library")
    id("maven-publish")
    id("io.spring.dependency-management") version "1.1.7"
    id("org.springframework.boot") version "3.4.5"
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

dependencies {
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    api(project(":modules:resonance-common:web-support"))
    api(project(":modules:resonance-common:common-auth"))
    api(project(":modules:resonance-common:mapper-infra"))
    api(project(":modules:resonance-common:stable-execution-gate"))
    api(project(":modules:resonance-common:platform-request-contracts"))
    api(project(":modules:resonance-common:platform-service-contracts"))
    api(project(":modules:resonance-common:versioncontrol-core"))
    api(project(":modules:resonance-common:runtimecontrol-core"))
    api(project(":modules:resonance-builder:screenbuilder-carbonet-adapter"))
    api(project(":modules:resonance-common:platform-observability-query"))
    api(project(":modules:resonance-common:platform-observability-payload"))
    api(project(":modules:resonance-common:platform-help"))
    api(project(":modules:resonance-common:carbonet-contract-metadata"))
    compileOnly("org.springframework.boot:spring-boot-starter-web")
    compileOnly("org.springframework.boot:spring-boot-starter-data-jpa")
    compileOnly("org.springframework.boot:spring-boot-starter-validation")
    compileOnly("org.springframework.boot:spring-boot-starter-actuator")
    compileOnly("org.postgresql:postgresql:42.7.3")
    compileOnly("io.jsonwebtoken:jjwt-api:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
    compileOnly("org.apache.commons:commons-lang3:3.18.0")
    compileOnly("commons-io:commons-io:2.20.0")
    compileOnly("org.apache.commons:commons-text:1.14.0")
    compileOnly("commons-beanutils:commons-beanutils:1.11.0")
}
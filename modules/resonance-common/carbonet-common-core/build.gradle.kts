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
}

tasks.test { useJUnitPlatform() }

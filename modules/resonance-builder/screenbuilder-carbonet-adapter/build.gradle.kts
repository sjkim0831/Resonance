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

dependencies {
    implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0")
    compileOnly("org.springframework.boot:spring-boot-starter-jdbc")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    compileOnly("org.springframework.boot:spring-boot-starter-web")
    compileOnly("org.springframework.boot:spring-boot-starter-security")
    compileOnly("org.springframework.boot:spring-boot-starter-validation")
    compileOnly("io.jsonwebtoken:jjwt-api:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    compileOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
    implementation(project(":modules:resonance-builder:screenbuilder-core"))
    implementation(project(":modules:resonance-builder:carbonet-builder-observability"))
    implementation(project(":modules:resonance-common:web-support"))
    implementation(project(":modules:resonance-common:platform-service-contracts"))
    implementation(project(":modules:resonance-common:carbonet-contract-metadata"))
    implementation(project(":modules:resonance-common:mapper-infra"))
    implementation(project(":modules:resonance-common:common-auth"))
    implementation(project(":modules:resonance-common:platform-request-contracts"))
    // carbonet-common-core depends on this module — using compileOnly to
    // avoid circular dependency at configuration time.
    compileOnly(project(":modules:resonance-common:carbonet-common-core"))
}

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
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    compileOnly("org.springframework.boot:spring-boot-starter-web")
    implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:5.0.0")
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.core:jackson-core")
    implementation("org.springframework:spring-core")
    implementation("org.springframework:spring-context")
    implementation("org.springframework:spring-web")
    implementation("org.springframework:spring-beans")
    implementation("org.springframework:spring-tx")
    implementation("org.springframework:spring-jdbc")
    implementation(project(":modules:resonance-common:platform-request-contracts"))
    implementation(project(":modules:resonance-common:platform-service-contracts"))
    implementation(project(":modules:resonance-common:mapper-infra"))
    implementation(project(":modules:resonance-builder:screenbuilder-core"))
    implementation(project(":modules:resonance-common:web-support"))
}

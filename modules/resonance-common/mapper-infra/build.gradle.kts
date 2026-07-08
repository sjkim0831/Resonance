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

dependencies {
    implementation("org.egovframe.rte:egovframe-rte-psl-dataaccess:5.0.0")
    implementation("org.egovframe.rte:egovframe-rte-fdl-cmmn:5.0.0")
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.core:jackson-core")
    implementation("jakarta.annotation:jakarta.annotation-api")
    implementation("org.mybatis:mybatis")
    implementation("org.slf4j:slf4j-api")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
}
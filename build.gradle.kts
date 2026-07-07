plugins {
    id("com.gradle.enterprise") version "3.17.6" apply false
}

val springBootVersion = "3.4.5"

allprojects {
    group = "egovframework"
    version = "1.0.0"

    repositories {
        mavenCentral()
        maven { url = uri("https://repo1.maven.org/maven2/") }
        maven { url = uri("https://maven.egovframe.go.kr/maven/") }
    }
}
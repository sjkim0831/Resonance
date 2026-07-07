plugins {
    id("java-library")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.named<Jar>("jar") { enabled = false }

val staticDir = project.rootDir.resolve("projects/carbonet-assets/static")

val copyAssets by tasks.registering(Copy::class) {
    from(staticDir)
    into("${buildDir}/resources/main/static")
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(copyAssets)
}

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

rootProject.name = "resonance-workspace"

include("modules:resonance-common:web-support")
include("modules:resonance-common:platform-request-contracts")
include("modules:resonance-common:platform-service-contracts")
include("modules:resonance-common:mapper-infra")
include("modules:resonance-common:stable-execution-gate")
include("modules:resonance-common:common-auth")
include("modules:resonance-common:versioncontrol-core")
include("modules:resonance-common:runtimecontrol-core")

include("modules:resonance-common:carbonet-common-core")
include("modules:resonance-common:carbonet-contract-metadata")
include("modules:resonance-common:platform-help")
include("modules:resonance-common:platform-help-content")
include("modules:resonance-common:platform-observability-web")
include("modules:resonance-common:platform-observability-query")
include("modules:resonance-common:platform-observability-payload")

include("modules:resonance-builder:screenbuilder-core")
include("modules:resonance-builder:screenbuilder-carbonet-adapter")
include("modules:resonance-builder:screenbuilder-runtime-common-adapter")
include("modules:resonance-builder:carbonet-builder-observability")

include("modules:resonance-ops:platform-runtime-control")
include("modules:resonance-ops:platform-version-control")
include("modules:resonance-ops:ollama-control-plane")
include("modules:resonance-ops:workbench-core")

include("apps:carbonet-api")
include("apps:operations-console")

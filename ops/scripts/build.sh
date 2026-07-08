#!/usr/bin/env bash
# build.sh - Maven/Gradle dual build wrapper
# Usage: source ops/scripts/build.sh
#
# Provides:
#   $BUILD_TOOL              : "maven" or "gradle"
#   jbuild <mvn-args...>    : invoke mvn OR ./gradlew with converted args
#   jbooted <module>        : fat jar path detection (target OR build/libs)
#
# The wrapper prefers Gradle when both build systems are present.
# Legacy callers using `mvn ...` keep working unchanged.

set -euo pipefail

BUILD_TOOL_DETECT() {
    if [[ -x "${ROOT_DIR:-.}/gradlew" ]] && [[ -f "${ROOT_DIR:-.}/settings.gradle.kts" ]]; then
        echo "gradle"
    else
        echo "maven"
    fi
}

# Initialize after ROOT_DIR is known
init_build_tool() {
    BUILD_TOOL="$(BUILD_TOOL_DETECT)"
    case "$BUILD_TOOL" in
        gradle)
            GRADLE_BIN=("${ROOT_DIR}/gradlew" "-p" "${ROOT_DIR}")
            export GRADLE_BIN BUILD_TOOL
            ;;
        maven)
            export BUILD_TOOL
            ;;
        *) echo "unknown build tool" >&2; exit 1 ;;
    esac
    return 0
}

# jbuild <mvn-args...> — runs mvn or gradlew equivalent
# Accepts only the patterns we use across ops/scripts:
#   mvn -q -pl apps/<X> -am -DskipTests package
#   mvn -q -pl apps/<X> -am -Dmaven.test.skip=true package
#   mvn clean package -DskipTests
jbuild() {
    local args=("$@")
    if [[ "${BUILD_TOOL:-}" == "gradle" ]]; then
        local projects_dir="apps"  # default lookup under ':'
        local target_app=""
        local skip_tests=false
        local extra=()
        local i=0
        while [[ $i -lt ${#args[@]} ]]; do
            local a="${args[$i]}"
            case "$a" in
                -pl)
                    i=$((i+1)); local mod="${args[$i]}"
                    # Strip apps/ prefix; module aliases map directly to Gradle path
                    mod="${mod#apps/}"
                    if [[ "$mod" == *","* ]]; then
                        echo "jbuild: comma-separated -pl not supported under gradle: $mod" >&2; exit 2
                    fi
                    target_app="$mod"
                    ;;
                -am) ;;  # handled by --all
                -q|--quiet) ;;
                -DskipTests|-Dmaven.test.skip=true) skip_tests=true ;;
                -D*) ;;  # ignore unknown
                -T*) ;;  # ignore parallelism
                --) shift_break=true ;;
                clean|package|install|verify|test) ;;  # known goals -- skip (gradle tasks differ)
                *) extra+=("$a") ;;
            esac
            i=$((i+1))
        done
        if [[ -z "$target_app" ]]; then
            echo "jbuild: missing -pl apps/<X> argument, cannot convert to gradle project" >&2
            exit 3
        fi
        local test_flag=()
        if ! $skip_tests; then test_flag=("test"); fi
        "${GRADLE_BIN[@]}" ":apps:${target_app}:bootJar" "${test_flag[@]}" -q "${extra[@]}"
    else
        mvn "${args[@]}"
    fi
}

jbooted() {
    local module_app="$1"
    if [[ "${BUILD_TOOL:-}" == "gradle" ]]; then
        echo "${ROOT_DIR}/apps/${module_app}/build/libs/${module_app}.jar"
    else
        echo "${ROOT_DIR}/apps/${module_app}/target/${module_app}.jar"
    fi
}

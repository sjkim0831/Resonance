#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
FAIL=0

echo "[validate] screenbuilder bootstrap target: $ROOT_DIR"

check_file() {
  local path="$1"
  if [[ ! -f "$ROOT_DIR/$path" ]]; then
    echo "[validate] missing file: $path"
    FAIL=1
  fi
}

check_text() {
  local path="$1"
  local pattern="$2"
  if [[ ! -f "$ROOT_DIR/$path" ]]; then
    echo "[validate] missing file: $path"
    FAIL=1
    return
  fi
  if ! grep -Fq "$pattern" "$ROOT_DIR/$path"; then
    echo "[validate] missing text in $path: $pattern"
    FAIL=1
  fi
}

check_file "pom.xml"
check_file "src/main/resources/application-screenbuilder.properties"
check_file "src/main/java/com/example/project/screenbuilder/config/ScreenBuilderProjectAdapterConfiguration.java"

check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.project-id="
check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.menu-root="
check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.runtime-class="
check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.menu-scope="
check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.release-unit-prefix="
check_text "src/main/resources/application-screenbuilder.properties" "screenbuilder.project.runtime-package-prefix="

check_text "src/main/java/com/example/project/screenbuilder/config/ScreenBuilderProjectAdapterConfiguration.java" "ScreenBuilderMenuCatalogPort"
check_text "src/main/java/com/example/project/screenbuilder/config/ScreenBuilderProjectAdapterConfiguration.java" "ScreenBuilderRuntimeComparePort"

if [[ $FAIL -ne 0 ]]; then
  echo "[validate] FAILED"
  exit 1
fi

echo "[validate] OK"

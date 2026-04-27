#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[audit] screenbuilder bootstrap assets"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "[audit] missing file: $path"
    FAIL=1
  fi
}

require_text() {
  local path="$1"
  local pattern="$2"
  if [[ ! -f "$path" ]]; then
    echo "[audit] missing file: $path"
    FAIL=1
    return
  fi
  if ! grep -Fq "$pattern" "$path"; then
    echo "[audit] missing text in $path: $pattern"
    FAIL=1
  fi
}

require_file "docs/architecture/installable-module-manifest-contract.md"
require_file "templates/screenbuilder-project-bootstrap/bootstrap-validator-checklist.md"
require_file "templates/screenbuilder-project-bootstrap/validate-screenbuilder-bootstrap.sh"
require_file "templates/screenbuilder-project-bootstrap/manifests/builder-install-manifest.json"
require_file "templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json"
require_file "templates/screenbuilder-project-bootstrap/manifests/api-install-manifest.json"
require_file "templates/screenbuilder-project-bootstrap/manifests/business-process-install-manifest.json"

require_text "templates/screenbuilder-project-bootstrap/manifests/builder-install-manifest.json" "\"moduleType\": \"builder-package\""
require_text "templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json" "\"moduleType\": \"theme-package\""
require_text "templates/screenbuilder-project-bootstrap/manifests/api-install-manifest.json" "\"moduleType\": \"api-package\""
require_text "templates/screenbuilder-project-bootstrap/manifests/business-process-install-manifest.json" "\"moduleType\": \"business-process-package\""
require_text "templates/screenbuilder-project-bootstrap/bootstrap-validator-checklist.md" "ScreenBuilderMenuCatalogPort"
require_text "templates/screenbuilder-project-bootstrap/validate-screenbuilder-bootstrap.sh" "screenbuilder.project.project-id="

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"

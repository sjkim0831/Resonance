#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[audit] framework common/theme/project boundaries"

required_paths=(
  "modules/screenbuilder-core"
  "modules/screenbuilder-runtime-common-adapter"
  "modules/screenbuilder-carbonet-adapter"
  "modules/carbonet-contract-metadata"
  "modules/carbonet-builder-observability"
  "modules/carbonet-mapper-infra"
  "apps/carbonet-app"
  "frontend/src/features/admin-ui"
  "frontend/src/features/admin-entry"
  "frontend/src/features/screen-builder/shared"
  "templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json"
  "docs/architecture/framework-common-theme-project-separation-map.md"
  "docs/architecture/framework-common-theme-project-inventory.md"
  "docs/architecture/installable-business-process-package-model.md"
  "docs/architecture/reusable-read-module-separation-plan.md"
  "docs/architecture/installable-screen-process-inventory.md"
  "docs/architecture/reusable-read-and-executor-candidate-map.md"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$path" ]; then
    echo "[audit] missing required framework boundary asset: $path" >&2
    exit 1
  fi
done

if rg -n "egovframework\\.com\\.feature\\." frontend/src/features/admin-ui frontend/src/features/admin-entry frontend/src/features/screen-builder/shared >/tmp/framework-boundary-common-imports.txt 2>/dev/null; then
  echo "[audit] common frontend layer imports project feature packages:" >&2
  cat /tmp/framework-boundary-common-imports.txt >&2
  exit 1
fi

if ! rg -q '"moduleType": "theme-package"' templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json; then
  echo "[audit] theme manifest missing moduleType theme-package" >&2
  exit 1
fi

if ! rg -q '"componentOverrides"' templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json; then
  echo "[audit] theme manifest missing componentOverrides" >&2
  exit 1
fi

if ! rg -q '"projectBindingMode"' templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json; then
  echo "[audit] theme manifest missing projectBindingMode" >&2
  exit 1
fi

if ! rg -q '"ownershipLane"' templates/screenbuilder-project-bootstrap/manifests/theme-install-manifest.json; then
  echo "[audit] theme manifest missing ownershipLane" >&2
  exit 1
fi

if ! rg -q 'COMMON_PRIMITIVE' docs/architecture/framework-common-theme-project-separation-map.md; then
  echo "[audit] separation map missing COMMON_PRIMITIVE lane" >&2
  exit 1
fi

if ! rg -q 'THEME_PRESENTATION' docs/architecture/framework-common-theme-project-separation-map.md; then
  echo "[audit] separation map missing THEME_PRESENTATION lane" >&2
  exit 1
fi

if ! rg -q 'PROJECT_BINDING' docs/architecture/framework-common-theme-project-separation-map.md; then
  echo "[audit] separation map missing PROJECT_BINDING lane" >&2
  exit 1
fi

if ! rg -q 'PROCESS_DEFINITION' docs/architecture/installable-business-process-package-model.md; then
  echo "[audit] business process model missing PROCESS_DEFINITION lane" >&2
  exit 1
fi

if ! rg -q 'COMMON_READ' docs/architecture/reusable-read-module-separation-plan.md; then
  echo "[audit] reusable read plan missing COMMON_READ lane" >&2
  exit 1
fi

echo "[audit] OK"

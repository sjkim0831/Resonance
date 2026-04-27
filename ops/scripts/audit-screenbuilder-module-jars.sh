#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[audit] screenbuilder module jars"

check_jar_entry() {
  local jar_path="$1"
  local entry="$2"

  if [[ ! -f "$jar_path" ]]; then
    echo "[audit] missing jar: $jar_path"
    FAIL=1
    return
  fi

  if ! jar tf "$jar_path" | grep -Fqx "$entry"; then
    echo "[audit] missing jar entry"
    echo "  jar:   $jar_path"
    echo "  entry: $entry"
    FAIL=1
  fi
}

check_jar_entry \
  "modules/screenbuilder-core/target/screenbuilder-core-1.0.0.jar" \
  "egovframework/com/platform/screenbuilder/service/impl/ScreenBuilderDraftServiceImpl.class"
check_jar_entry \
  "modules/screenbuilder-core/target/screenbuilder-core-1.0.0.jar" \
  "egovframework/com/framework/builder/service/FrameworkBuilderContractService.class"
check_jar_entry \
  "modules/screenbuilder-core/target/screenbuilder-core-1.0.0.jar" \
  "egovframework/com/platform/screenbuilder/support/ScreenBuilderMenuCatalogPort.class"

check_jar_entry \
  "modules/screenbuilder-runtime-common-adapter/target/screenbuilder-runtime-common-adapter-1.0.0.jar" \
  "egovframework/com/platform/screenbuilder/runtime/common/PropertyBackedScreenBuilderPolicyAdapter.class"
check_jar_entry \
  "modules/screenbuilder-runtime-common-adapter/target/screenbuilder-runtime-common-adapter-1.0.0.jar" \
  "egovframework/com/platform/screenbuilder/runtime/common/ScreenBuilderRuntimeCommonAdapterConfiguration.class"

check_jar_entry \
  "modules/screenbuilder-carbonet-adapter/target/screenbuilder-carbonet-adapter-1.0.0.jar" \
  "egovframework/com/feature/admin/screenbuilder/web/ScreenBuilderApiController.class"
check_jar_entry \
  "modules/screenbuilder-carbonet-adapter/target/screenbuilder-carbonet-adapter-1.0.0.jar" \
  "egovframework/com/feature/admin/framework/builder/support/impl/CarbonetFrameworkBuilderMetadataSourceBridge.class"
check_jar_entry \
  "modules/screenbuilder-carbonet-adapter/target/screenbuilder-carbonet-adapter-1.0.0.jar" \
  "egovframework/mapper/com/feature/admin/framework/builder/FrameworkBuilderCompatibilityMapper.xml"

check_jar_entry \
  "modules/carbonet-contract-metadata/target/carbonet-contract-metadata-1.0.0.jar" \
  "egovframework/com/framework/contract/service/FrameworkContractMetadataService.class"
check_jar_entry \
  "modules/carbonet-contract-metadata/target/carbonet-contract-metadata-1.0.0.jar" \
  "framework/contracts/framework-contract-metadata.json"

check_jar_entry \
  "modules/carbonet-builder-observability/target/carbonet-builder-observability-1.0.0.jar" \
  "egovframework/com/framework/builder/runtime/mapper/FrameworkBuilderObservabilityMapper.class"
check_jar_entry \
  "modules/carbonet-builder-observability/target/carbonet-builder-observability-1.0.0.jar" \
  "egovframework/mapper/com/framework/builder/runtime/FrameworkBuilderObservabilityMapper.xml"
check_jar_entry \
  "modules/carbonet-builder-observability/target/carbonet-builder-observability-1.0.0.jar" \
  "egovframework/com/common/trace/UiManifestRegistryService.class"

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"

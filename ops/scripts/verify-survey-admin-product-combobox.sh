#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE_FILE="${SOURCE_FILE:-$ROOT_DIR/projects/carbonet-frontend/source/src/features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx}"
if [[ ! -f "$SOURCE_FILE" ]]; then
  SOURCE_FILE="${SOURCE_FILE_FALLBACK:-$ROOT_DIR/frontend/src/features/emission-survey-admin/EmissionSurveyAdminMigrationPage.tsx}"
fi

BUNDLE_ROOTS=(
  "$ROOT_DIR/apps/carbonet-api/target/classes/static/react-app/assets"
  "$ROOT_DIR/apps/carbonet-api/target/classes/static/react-app/assets"
  "$ROOT_DIR/projects/carbonet-frontend/source/dist/assets"
  "$ROOT_DIR/src/main/resources/static/react-app/assets"
  "$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app/assets"
)

required_source_markers=(
  "productSearchDirty"
  "productActiveOptionIndex"
  "buildDefaultCaseRows(section, \"CASE_3_2\")"
  "setSelectedProductName(\"\")"
  "emission-survey-product-combobox"
  "emission-survey-product-option-"
  "제품명을 입력해 실시간 검색"
  "key !== \"costUnit\" && key !== \"costUnitCategory\""
  "sanitizeAnnualUnitLabel"
  "normalizeAnnualUnitColumns"
)

required_bundle_markers=(
  "emission-survey-product-combobox"
  "emission-survey-product-option-"
  "직접입력 섹션 골격"
  "제품명을 입력해 실시간 검색"
  "productSearchDirty"
  "단위 분류"
)

forbidden_source_markers=(
  "단위(연간)"
  "단위\\n(연간)"
  "(연간) 분류"
)

forbidden_bundle_markers=(
  "단위(연간)"
  "단위\\n(연간)"
  "(연간) 분류"
)

fail() {
  printf '[survey-admin-combobox-verify] FAIL %s\n' "$*" >&2
  exit 1
}

[[ -f "$SOURCE_FILE" ]] || fail "source file not found: $SOURCE_FILE"

for marker in "${required_source_markers[@]}"; do
  grep -Fq "$marker" "$SOURCE_FILE" || fail "source marker missing: $marker"
done

for marker in "${forbidden_source_markers[@]}"; do
  grep -Fq "$marker" "$SOURCE_FILE" && fail "forbidden source marker remains in survey-admin source: $marker"
done

DATA_SOURCE_FILE="${DATA_SOURCE_FILE:-${SOURCE_FILE/emission-survey-admin\\/EmissionSurveyAdminMigrationPage.tsx/emission-survey-admin-data\\/EmissionSurveyAdminDataMigrationPage.tsx}}"
if [[ -f "$DATA_SOURCE_FILE" ]]; then
  for marker in "${forbidden_source_markers[@]}"; do
    grep -Fq "$marker" "$DATA_SOURCE_FILE" && fail "forbidden source marker remains in survey-admin-data source: $marker"
  done
fi

bundle_files=()
for root in "${BUNDLE_ROOTS[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r file; do
    bundle_files+=("$file")
  done < <(find "$root" -maxdepth 1 -type f -name 'EmissionSurveyAdminMigrationPage-*.js' -o -name 'index-*.js')
done

((${#bundle_files[@]} > 0)) || fail "bundle files not found"

for marker in "${required_bundle_markers[@]}"; do
  found=false
  for file in "${bundle_files[@]}"; do
    if grep -Fq "$marker" "$file"; then
      found=true
      break
    fi
  done
  "$found" || fail "bundle marker missing: $marker"
done

manifest_files=()
for root in "${BUNDLE_ROOTS[@]}"; do
  manifest="$root/../.vite/manifest.json"
  [[ -f "$manifest" ]] && manifest_files+=("$manifest")
done

current_bundle_files=()
if ((${#manifest_files[@]} > 0)); then
  while IFS= read -r file; do
    [[ -n "$file" ]] && current_bundle_files+=("$file")
  done < <(python3 - "${manifest_files[@]}" <<'PY'
import json
import pathlib
import sys
for manifest_text in sys.argv[1:]:
    manifest = pathlib.Path(manifest_text)
    root = manifest.parent.parent
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception:
        continue
    for key, value in data.items():
        if "EmissionSurveyAdmin" in key or key == "index.html" or key.endswith("/main.tsx"):
            file_name = value.get("file")
            if file_name:
                print(root / file_name)
            for import_key in value.get("imports") or []:
                imported = data.get(import_key) or {}
                imported_file = imported.get("file")
                if imported_file:
                    print(root / imported_file)
PY
)
fi

if ((${#current_bundle_files[@]} == 0)); then
  current_bundle_files=("${bundle_files[@]}")
fi

for marker in "${forbidden_bundle_markers[@]}"; do
  for file in "${current_bundle_files[@]}"; do
    [[ -f "$file" ]] || continue
    if grep -Fq "$marker" "$file"; then
      fail "forbidden bundle marker remains in current manifest asset: $marker file=$file"
    fi
  done
done

printf '[survey-admin-combobox-verify] OK source=%s bundles=%s\n' "$SOURCE_FILE" "${#bundle_files[@]}"

#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
JPA_CONFIG="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/config/data/JpaConfig.java"
SOURCE_ROOTS=(
  "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java"
  "$ROOT/apps/carbonet-api/src/main/java"
)

[[ -f "$JPA_CONFIG" ]] || {
  echo "[jpa-entity-closure] FAIL JpaConfig is missing" >&2
  exit 1
}

entity_count=0
declare -A entity_packages=()
entity_file_list="$(mktemp)"
trap 'rm -f "$entity_file_list"' EXIT
if command -v rg >/dev/null 2>&1 && rg --version >/dev/null 2>&1; then
  rg -l '^[[:space:]]*@Entity([[:space:](]|$)' "${SOURCE_ROOTS[@]}" -g '*.java' |
    sort > "$entity_file_list"
else
  {
    find "${SOURCE_ROOTS[@]}" -type f -name '*.java' -print0 |
      xargs -0 grep -El '^[[:space:]]*@Entity([[:space:](]|$)' || true
  } |
    sort > "$entity_file_list"
fi
while IFS= read -r entity_file; do
  [[ -n "$entity_file" ]] || continue
  package_name="$(
    sed -n 's/^[[:space:]]*package[[:space:]]\+\([^;]\+\);.*/\1/p' "$entity_file" |
      head -1
  )"
  [[ -n "$package_name" ]] || {
    echo "[jpa-entity-closure] FAIL entity package missing: $entity_file" >&2
    exit 1
  }
  entity_packages["$package_name"]=1
  entity_count=$((entity_count + 1))
done < "$entity_file_list"

(( entity_count > 0 )) || {
  echo "[jpa-entity-closure] FAIL no @Entity classes discovered" >&2
  exit 1
}

missing=0
for package_name in "${!entity_packages[@]}"; do
  if ! grep -Fq "\"$package_name\"" "$JPA_CONFIG"; then
    echo "[jpa-entity-closure] FAIL unregistered entity package: $package_name" >&2
    missing=$((missing + 1))
  fi
done
(( missing == 0 )) || exit 1

echo "[jpa-entity-closure] PASS entities=$entity_count packages=${#entity_packages[@]} scan=bounded"

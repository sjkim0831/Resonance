#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectCreatePage.tsx"

grep -Fq '<option key={v} value={v}>{v}</option>' "$source_file" || {
  echo "[project-create-options] site option must render its visible label" >&2
  exit 1
}

site_block="$(sed -n '/options\.sites\.map/,/<\/select>/p' "$source_file")"
if grep -Fq '<option key={v} value={v} />' <<<"$site_block"; then
  echo "[project-create-options] blank self-closing option remains" >&2
  exit 1
fi

echo "[project-create-options] PASS visible site labels"

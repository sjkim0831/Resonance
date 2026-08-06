#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for index in 1 2 3 4 5; do
  file="$TMP_DIR/react-app-overlay-20260806-00000${index}.tar.gz"
  printf 'backup %s\n' "$index" > "$file"
  touch -d "2026-08-06 00:00:0${index}" "$file"
done
printf 'must remain\n' > "$TMP_DIR/unrelated.tar.gz"

BACKUP_DIR="$TMP_DIR" BACKUP_RETAIN_COUNT=3 bash "$GUARD" prune-backups >/dev/null

actual=$(find "$TMP_DIR" -maxdepth 1 -type f -name 'react-app-overlay-*.tar.gz' | wc -l)
[[ "$actual" -eq 3 ]] || { echo "FAIL expected 3 backups, got $actual" >&2; exit 1; }
[[ -f "$TMP_DIR/react-app-overlay-20260806-000005.tar.gz" ]] || { echo 'FAIL newest backup removed' >&2; exit 1; }
[[ -f "$TMP_DIR/unrelated.tar.gz" ]] || { echo 'FAIL unrelated archive removed' >&2; exit 1; }

echo 'PASS frontend overlay retention keeps only newest matching archives'

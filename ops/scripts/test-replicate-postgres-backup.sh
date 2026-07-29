#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

mkdir -p "$TEMP_DIR/source"
printf 'verified-backup\n' > "$TEMP_DIR/source/test.dump"
hash="$(sha256sum "$TEMP_DIR/source/test.dump" | awk '{print $1}')"
jq -n --arg sha256 "$hash" '{sha256:$sha256}' > "$TEMP_DIR/source/test.dump.json"

set +e
output="$(
  SOURCE_DIR="$TEMP_DIR/source" \
    RESONANCE_BACKUP_DESTINATION="$TEMP_DIR/destination" \
    "$SCRIPT_DIR/replicate-postgres-backup.sh" --dry-run 2>&1
)"
status=$?
set -e

if [[ $status -ne 9 ]] || [[ "$output" != *"share physical storage"* ]]; then
  echo "Expected same-storage rejection, got status=$status output=$output" >&2
  exit 1
fi

echo "PASS same-storage destination is rejected"

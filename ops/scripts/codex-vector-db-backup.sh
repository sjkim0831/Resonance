#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SOURCE_PATH="${1:-data/ai-runtime/hermes-rag-vector.sqlite3}"
if [[ ! -f "$SOURCE_PATH" ]]; then
  printf '[codex-vector-db-backup] not found: %s\n' "$SOURCE_PATH" >&2
  exit 1
fi

BACKUP_DIR="var/backups/vector-db"
mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
base="$(basename "$SOURCE_PATH")"
out="$BACKUP_DIR/$base.$stamp.gz"

gzip -c "$SOURCE_PATH" > "$out"
printf '[codex-vector-db-backup] wrote %s\n' "$out"
sha256sum "$out"
wc -c "$SOURCE_PATH" "$out"

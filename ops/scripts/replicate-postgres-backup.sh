#!/usr/bin/env bash
# Replicate the newest verified PostgreSQL backup to independent storage.
# The destination must be either an SSH target or a mount backed by a different
# physical device. A matching SHA-256 is required before success is reported.

set -Eeuo pipefail

SOURCE_DIR="${SOURCE_DIR:-/opt/resonance-backups/postgresql/on-demand}"
DESTINATION="${RESONANCE_BACKUP_DESTINATION:-}"
SSH_OPTIONS="${RESONANCE_BACKUP_SSH_OPTIONS:--o BatchMode=yes -o StrictHostKeyChecking=yes}"
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: replicate-postgres-backup.sh [--dry-run] [--source DIR] [--destination TARGET]

TARGET:
  /mounted/path             independent local or network-mounted filesystem
  user@host:/absolute/path  SSH destination

The source dump must have a .json manifest containing the same SHA-256.
EOF
}

while (($#)); do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --source) SOURCE_DIR="$2"; shift 2 ;;
    --destination) DESTINATION="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$DESTINATION" ]] || {
  echo "RESONANCE_BACKUP_DESTINATION is required; same-disk fallback is forbidden." >&2
  exit 3
}

command -v sha256sum >/dev/null
command -v jq >/dev/null

latest_dump="$(
  find "$SOURCE_DIR" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' |
    sort -nr | head -n 1 | cut -d' ' -f2-
)"
[[ -n "$latest_dump" && -f "$latest_dump" ]] || {
  echo "No PostgreSQL dump found in $SOURCE_DIR" >&2
  exit 4
}

manifest="${latest_dump}.json"
[[ -f "$manifest" ]] || {
  echo "Missing manifest: $manifest" >&2
  exit 5
}

source_hash="$(sha256sum "$latest_dump" | awk '{print tolower($1)}')"
manifest_hash="$(jq -r '.sha256 // .sha256Hex // .checksum // empty' "$manifest" | tr '[:upper:]' '[:lower:]')"
[[ "$manifest_hash" == "$source_hash" ]] || {
  echo "Source manifest checksum mismatch; replication aborted." >&2
  exit 6
}

source_name="$(basename "$latest_dump")"
manifest_name="$(basename "$manifest")"

physical_root() {
  local path="$1" source parent
  source="$(findmnt -n -o SOURCE --target "$path")"
  [[ "$source" == /dev/* ]] || { printf '%s\n' "$source"; return; }
  parent="$(lsblk -ndo PKNAME "$source" 2>/dev/null | head -n1)"
  [[ -n "$parent" ]] && printf '/dev/%s\n' "$parent" || printf '%s\n' "$source"
}

if [[ "$DESTINATION" == *:* ]]; then
  remote="${DESTINATION%%:*}"
  remote_dir="${DESTINATION#*:}"
  [[ "$remote_dir" == /* ]] || {
    echo "SSH destination path must be absolute." >&2
    exit 7
  }

  local_machine="$(cat /etc/machine-id 2>/dev/null || hostname)"
  remote_machine="$(ssh $SSH_OPTIONS "$remote" 'cat /etc/machine-id 2>/dev/null || hostname')"
  [[ "$remote_machine" != "$local_machine" ]] || {
    echo "Destination resolves to this server; independent copy required." >&2
    exit 8
  }

  if "$DRY_RUN"; then
    echo "READY ssh://${remote}${remote_dir}/${source_name} sha256=${source_hash}"
    exit 0
  fi

  ssh $SSH_OPTIONS "$remote" "mkdir -p -- '$remote_dir'"
  rsync -a --partial -e "ssh $SSH_OPTIONS" "$latest_dump" "$manifest" "${remote}:${remote_dir}/"
  remote_hash="$(ssh $SSH_OPTIONS "$remote" "sha256sum '$remote_dir/$source_name'" | awk '{print tolower($1)}')"
else
  mkdir -p "$DESTINATION"
  source_device="$(physical_root "$latest_dump")"
  destination_device="$(physical_root "$DESTINATION")"
  [[ "$source_device" != "$destination_device" ]] || {
    echo "Source and destination share physical storage ($source_device); replication refused." >&2
    exit 9
  }

  if "$DRY_RUN"; then
    echo "READY file://${DESTINATION}/${source_name} sha256=${source_hash}"
    exit 0
  fi

  rsync -a --partial "$latest_dump" "$manifest" "$DESTINATION/"
  remote_hash="$(sha256sum "$DESTINATION/$source_name" | awk '{print tolower($1)}')"
fi

[[ "$remote_hash" == "$source_hash" ]] || {
  echo "Destination checksum mismatch; replication failed." >&2
  exit 10
}

completed_at="$(date -u +%FT%TZ)"
status_record="$(jq -n \
  --arg completedAt "$completed_at" \
  --arg source "$latest_dump" \
  --arg destination "$DESTINATION/$source_name" \
  --arg sha256 "$source_hash" \
  '{status:"VERIFIED",completedAt:$completedAt,source:$source,destination:$destination,sha256:$sha256}')"

if [[ "$DESTINATION" == *:* ]]; then
  printf '%s\n' "$status_record" |
    ssh $SSH_OPTIONS "$remote" "cat > '$remote_dir/${source_name}.replication.json'"
else
  printf '%s\n' "$status_record" > "$DESTINATION/${source_name}.replication.json"
fi

echo "VERIFIED destination=$DESTINATION/$source_name sha256=$source_hash"

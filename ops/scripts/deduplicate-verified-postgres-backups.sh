#!/usr/bin/env bash
set -euo pipefail

primary="${POSTGRES_BACKUP_PRIMARY_DIR:-/opt/resonance-data/backups/postgres/primary}"
mirror="${POSTGRES_BACKUP_MIRROR_DIR:-/opt/resonance-data/backups/postgres/mirror}"
min_age_minutes="${POSTGRES_BACKUP_DEDUPE_MIN_AGE_MINUTES:-10}"

[[ "$primary" == /opt/resonance-data/backups/postgres/primary ]] || {
  echo "[backup-dedupe] refusing unexpected primary path: $primary" >&2
  exit 2
}
[[ "$mirror" == /opt/resonance-data/backups/postgres/mirror ]] || {
  echo "[backup-dedupe] refusing unexpected mirror path: $mirror" >&2
  exit 2
}
[[ -d "$primary" && -d "$mirror" ]] || exit 0

relinked=0
saved_bytes=0
while IFS= read -r -d '' source_dump; do
  relative="${source_dump#${primary}/}"
  mirror_dump="${mirror}/${relative}"
  [[ -f "$mirror_dump" ]] || continue
  [[ -f "${source_dump}.sha256" && -f "${mirror_dump}.sha256" ]] || continue
  cmp -s "${source_dump}.sha256" "${mirror_dump}.sha256" || continue
  [[ "$(stat -c %s "$source_dump")" == "$(stat -c %s "$mirror_dump")" ]] || continue
  [[ "$(stat -c %i "$source_dump")" != "$(stat -c %i "$mirror_dump")" ]] || continue

  bytes="$(stat -c %s "$source_dump")"
  temporary_link="${source_dump}.dedupe.$$"
  ln "$mirror_dump" "$temporary_link"
  mv -f "$temporary_link" "$source_dump"
  relinked=$((relinked + 1))
  saved_bytes=$((saved_bytes + bytes))
done < <(find "$primary" -type f -name '*.dump' -mmin "+${min_age_minutes}" -print0)

echo "[backup-dedupe] relinked=${relinked} saved_bytes=${saved_bytes}"

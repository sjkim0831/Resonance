#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
KEEP_RECENT_HOURS="${CARBONET_BACKUP_KEEP_RECENT_HOURS:-24}"
KEEP_DAILY_DAYS="${CARBONET_BACKUP_KEEP_DAILY_DAYS:-7}"
DRY_RUN="${CARBONET_BACKUP_PRUNE_DRY_RUN:-false}"

resolved_dir="$(readlink -f "$BACKUP_DIR" 2>/dev/null || true)"
if [[ -z "$resolved_dir" || "$resolved_dir" == / || "$resolved_dir" != /opt/resonance-backups/postgresql/pre-deploy ]]; then
  echo "[backup-retention] refusing unsafe backup directory: $BACKUP_DIR" >&2
  exit 1
fi
[[ "$KEEP_RECENT_HOURS" =~ ^[0-9]+$ ]] || { echo "[backup-retention] invalid recent-hours value" >&2; exit 2; }
[[ "$KEEP_DAILY_DAYS" =~ ^[0-9]+$ ]] || { echo "[backup-retention] invalid daily-days value" >&2; exit 2; }
[[ -d "$resolved_dir" ]] || exit 0

keep_file="$(mktemp)"
delete_file="$(mktemp)"
trap 'rm -f "$keep_file" "$delete_file"' EXIT

# Preserve every fresh artifact so a currently running or recently completed
# deployment always has an exact restore point.
find "$resolved_dir" -maxdepth 1 -type f -mmin "-$((KEEP_RECENT_HOURS * 60))" -print >> "$keep_file"

# Older full dumps are reduced to one verified restore generation per day.
# Keep the role dump with the same timestamp so a full restore remains usable.
mapfile -t backup_days < <(
  find "$resolved_dir" -maxdepth 1 -type f -name 'carbonet-[0-9]*.sql.gz' -printf '%TY-%Tm-%Td\n' \
    | sort -ru | awk -v limit="$KEEP_DAILY_DAYS" 'NR <= limit'
)
for day in "${backup_days[@]}"; do
  full_backup="$(
    find "$resolved_dir" -maxdepth 1 -type f -name 'carbonet-[0-9]*.sql.gz' \
      -newermt "$day 00:00:00" ! -newermt "$day 23:59:59" -printf '%T@ %p\n' \
      | sort -nr | sed -n '1p' | cut -d' ' -f2-
  )"
  [[ -n "$full_backup" ]] || continue
  printf '%s\n' "$full_backup" >> "$keep_file"
  timestamp="$(basename "$full_backup" | sed -E 's/^carbonet-([0-9]{8}-[0-9]{6})-.*/\1/')"
  find "$resolved_dir" -maxdepth 1 -type f -name "postgres-roles-$timestamp-*.sql.gz" -print >> "$keep_file"
done

sort -u "$keep_file" -o "$keep_file"
find "$resolved_dir" -maxdepth 1 -type f -print | sort | comm -23 - "$keep_file" > "$delete_file"

delete_count="$(wc -l < "$delete_file")"
delete_bytes="$(
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] && stat -c %s "$candidate"
  done < "$delete_file" | awk '{ total += $1 } END { print total + 0 }'
)"
echo "[backup-retention] keep=$(wc -l < "$keep_file") delete=$delete_count reclaim_bytes=$delete_bytes dry_run=$DRY_RUN"

if [[ "$DRY_RUN" != "true" ]]; then
  while IFS= read -r candidate; do
    [[ "$candidate" == "$resolved_dir"/* ]] || { echo "[backup-retention] unsafe candidate: $candidate" >&2; exit 3; }
    rm -f -- "$candidate"
  done < "$delete_file"
fi

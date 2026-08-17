#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
KEEP_RECENT_HOURS="${CARBONET_BACKUP_KEEP_RECENT_HOURS:-24}"
KEEP_DAILY_DAYS="${CARBONET_BACKUP_KEEP_DAILY_DAYS:-7}"
DRY_RUN="${CARBONET_BACKUP_PRUNE_DRY_RUN:-false}"
MANIFEST_DIR="${CARBONET_BACKUP_PRUNE_MANIFEST_DIR:-/opt/resonance-backups/postgresql/.predeploy-prune-manifests}"
EXPECTED_BACKUP_DIR=/opt/resonance-backups/postgresql/pre-deploy
EXPECTED_MANIFEST_DIR=/opt/resonance-backups/postgresql/.predeploy-prune-manifests

resolved_dir="$(readlink -f "$BACKUP_DIR" 2>/dev/null || true)"
if [[ -z "$resolved_dir" || "$resolved_dir" == / || "$resolved_dir" != "$EXPECTED_BACKUP_DIR" ]]; then
  echo "[backup-retention] refusing unsafe backup directory: $BACKUP_DIR" >&2
  exit 1
fi
[[ "$KEEP_RECENT_HOURS" =~ ^[0-9]+$ ]] || { echo "[backup-retention] invalid recent-hours value" >&2; exit 2; }
[[ "$KEEP_DAILY_DAYS" =~ ^[0-9]+$ ]] || { echo "[backup-retention] invalid daily-days value" >&2; exit 2; }
[[ "$DRY_RUN" == "true" || "$DRY_RUN" == "false" ]] || { echo "[backup-retention] invalid dry-run value" >&2; exit 2; }
[[ -d "$resolved_dir" ]] || exit 0

# Keep retention manifests on the capacious /opt filesystem. /tmp is a
# user-quota tmpfs on the production host and must never be an implicit
# fallback for this deployment-critical path.
if [[ "$MANIFEST_DIR" != "$EXPECTED_MANIFEST_DIR" || -L "$MANIFEST_DIR" ]]; then
  echo "[backup-retention] refusing unsafe manifest directory: $MANIFEST_DIR" >&2
  exit 1
fi
umask 077
if [[ ! -e "$MANIFEST_DIR" ]]; then
  mkdir -m 0700 -- "$MANIFEST_DIR"
fi
resolved_manifest_dir="$(readlink -f "$MANIFEST_DIR" 2>/dev/null || true)"
if [[ "$resolved_manifest_dir" != "$EXPECTED_MANIFEST_DIR" \
      || ! -d "$resolved_manifest_dir" \
      || -L "$MANIFEST_DIR" \
      || "$(stat -c %u "$resolved_manifest_dir" 2>/dev/null || true)" != "$(id -u)" \
      || "$(stat -c %a "$resolved_manifest_dir" 2>/dev/null || true)" != 700 \
      || "$(stat -c %d "$resolved_manifest_dir" 2>/dev/null || true)" != "$(stat -c %d /opt 2>/dev/null || true)" ]]; then
  echo "[backup-retention] manifest directory failed path/symlink/owner/mode/filesystem validation: $MANIFEST_DIR" >&2
  exit 1
fi

run_dir="$resolved_manifest_dir/run.$$.${BASHPID}.${RANDOM}.${RANDOM}"
keep_file="$run_dir/keep"
delete_file="$run_dir/delete"
stale_schema_dirs_file="$run_dir/stale-schema-dirs"
cleanup() {
  rm -f -- "$keep_file" "$delete_file" "$stale_schema_dirs_file"
  rmdir -- "$run_dir" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -m 0700 -- "$run_dir"
if [[ -L "$run_dir" \
      || "$(readlink -f "$run_dir" 2>/dev/null || true)" != "$run_dir" \
      || "$(stat -c %u "$run_dir" 2>/dev/null || true)" != "$(id -u)" \
      || "$(stat -c %a "$run_dir" 2>/dev/null || true)" != 700 ]]; then
  echo "[backup-retention] run manifest directory failed validation: $run_dir" >&2
  exit 1
fi
: > "$keep_file"
: > "$delete_file"
: > "$stale_schema_dirs_file"

# A SIGKILL can strand the private working directory used to assemble a
# schema-only restore bundle. The global deploy flock prevents another deploy
# from running this pruner concurrently, and the age boundary excludes the
# current attempt. Retire only the exact mktemp namespace with known regular
# files, current ownership, no links/subdirectories, and the same filesystem.
while IFS= read -r -d '' candidate; do
  candidate_name="$(basename -- "$candidate")"
  candidate_resolved="$(readlink -f "$candidate" 2>/dev/null || true)"
  if [[ ! "$candidate_name" =~ ^\.schema-backup\.[A-Za-z0-9]{6}$ \
        || "$candidate_resolved" != "$candidate" \
        || "$(dirname -- "$candidate_resolved")" != "$resolved_dir" \
        || -L "$candidate" \
        || "$(stat -c %u "$candidate" 2>/dev/null || true)" != "$(id -u)" \
        || "$(stat -c %d "$candidate" 2>/dev/null || true)" != "$(stat -c %d "$resolved_dir")" ]]; then
    echo "[backup-retention] refusing unsafe stale schema directory: $candidate" >&2
    exit 4
  fi
  if find "$candidate" -xdev -mindepth 1 \
      \( -type l -o ! -user "$(id -u)" -o ! -type f \
         -o ! \( -name schema.dump -o -name flyway-history.dump \
                   -o -name migrations.manifest -o -name migrations.patch \
                   -o -name restore-evidence.json \) \) \
      -print -quit | grep -q .; then
    echo "[backup-retention] refusing unsafe contents in stale schema directory: $candidate" >&2
    exit 4
  fi
  printf '%s\n' "$candidate" >> "$stale_schema_dirs_file"
done < <(
  find "$resolved_dir" -mindepth 1 -maxdepth 1 -xdev -type d \
    -name '.schema-backup.??????' -mmin "+$((KEEP_RECENT_HOURS * 60))" -print0
)

# Preserve every fresh artifact so a currently running or recently completed
# deployment always has an exact restore point.
find "$resolved_dir" -maxdepth 1 -type f -mmin "-$((KEEP_RECENT_HOURS * 60))" -print >> "$keep_file"

# Older full dumps are reduced to one verified restore generation per day.
# Keep the role dump with the same timestamp so a full restore remains usable.
mapfile -t backup_days < <(
  find "$resolved_dir" -maxdepth 1 -type f -name 'carbonet-[0-9]*.sql.gz' \
    ! -name '*.partial.*' -printf '%TY-%Tm-%Td\n' \
    | sort -ru | awk -v limit="$KEEP_DAILY_DAYS" 'NR <= limit'
)
for day in "${backup_days[@]}"; do
  full_backup="$(
    find "$resolved_dir" -maxdepth 1 -type f -name 'carbonet-[0-9]*.sql.gz' \
      ! -name '*.partial.*' \
      -newermt "$day 00:00:00" ! -newermt "$day 23:59:59" -printf '%T@ %p\n' \
      | sort -nr | sed -n '1p' | cut -d' ' -f2-
  )"
  [[ -n "$full_backup" ]] || continue
  printf '%s\n' "$full_backup" >> "$keep_file"
  timestamp="$(basename "$full_backup" | sed -E 's/^carbonet-([0-9]{8}-[0-9]{6})-.*/\1/')"
  find "$resolved_dir" -maxdepth 1 -type f -name "postgres-roles-$timestamp-*.sql.gz" \
    ! -name '*.partial.*' -print >> "$keep_file"
done

# `comm` requires both inputs to use the exact same collation. Force the byte
# order so Korean or mixed-case backup names cannot fail an otherwise healthy
# deployment under a host-specific locale.
LC_ALL=C sort -u "$keep_file" -o "$keep_file"
find "$resolved_dir" -maxdepth 1 -type f -print \
  | LC_ALL=C sort \
  | LC_ALL=C comm -23 - "$keep_file" > "$delete_file"

delete_count="$(wc -l < "$delete_file")"
stale_schema_dir_count="$(wc -l < "$stale_schema_dirs_file")"
delete_bytes="$(
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] && stat -c %s "$candidate"
  done < "$delete_file" | awk '{ total += $1 } END { print total + 0 }'
)"
stale_schema_bytes="$(
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] && du -sb -- "$candidate" | awk '{print $1}'
  done < "$stale_schema_dirs_file" | awk '{ total += $1 } END { print total + 0 }'
)"
reclaim_bytes="$((delete_bytes + stale_schema_bytes))"
echo "[backup-retention] keep=$(wc -l < "$keep_file") delete=$delete_count stale_schema_dirs=$stale_schema_dir_count reclaim_bytes=$reclaim_bytes dry_run=$DRY_RUN"

if [[ "$DRY_RUN" != "true" ]]; then
  while IFS= read -r candidate; do
    [[ "$candidate" == "$resolved_dir"/* ]] || { echo "[backup-retention] unsafe candidate: $candidate" >&2; exit 3; }
    rm -f -- "$candidate"
  done < "$delete_file"
  while IFS= read -r candidate; do
    candidate_name="$(basename -- "$candidate")"
    candidate_resolved="$(readlink -f "$candidate" 2>/dev/null || true)"
    [[ "$candidate_name" =~ ^\.schema-backup\.[A-Za-z0-9]{6}$ \
      && "$candidate_resolved" == "$candidate" \
      && "$(dirname -- "$candidate_resolved")" == "$resolved_dir" \
      && -d "$candidate" && ! -L "$candidate" \
      && "$(stat -c %u "$candidate" 2>/dev/null || true)" == "$(id -u)" \
      && "$(stat -c %d "$candidate" 2>/dev/null || true)" == "$(stat -c %d "$resolved_dir")" \
      && -z "$(find "$candidate" -xdev -mindepth 1 \
          \( -type l -o ! -user "$(id -u)" -o ! -type f \
             -o ! \( -name schema.dump -o -name flyway-history.dump \
                       -o -name migrations.manifest -o -name migrations.patch \
                       -o -name restore-evidence.json \) \) -print -quit)" ]] || {
      echo "[backup-retention] unsafe stale schema directory at delete time: $candidate" >&2
      exit 4
    }
    rm -rf -- "$candidate"
  done < "$stale_schema_dirs_file"
fi

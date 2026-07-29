#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${RESONANCE_RECOVERY_BACKUP_ROOT:-/opt/resonance-backups/postgresql/on-demand}"
KEEP_MINIMUM="${RESONANCE_RECOVERY_KEEP_MINIMUM:-2}"
RETENTION_DAYS="${RESONANCE_RECOVERY_RETENTION_DAYS:-30}"
MAX_DISK_USAGE_PERCENT="${RESONANCE_RECOVERY_MAX_DISK_USAGE_PERCENT:-85}"
MAX_DELETE_PER_RUN="${RESONANCE_RECOVERY_MAX_DELETE_PER_RUN:-3}"
STALE_PARTIAL_HOURS="${RESONANCE_RECOVERY_STALE_PARTIAL_HOURS:-24}"
DRY_RUN="${RESONANCE_RECOVERY_PRUNE_DRY_RUN:-true}"

for value in \
  "$KEEP_MINIMUM" "$RETENTION_DAYS" "$MAX_DISK_USAGE_PERCENT" \
  "$MAX_DELETE_PER_RUN" "$STALE_PARTIAL_HOURS"; do
  [[ "$value" =~ ^[0-9]+$ ]] || {
    echo "[recovery-retention] numeric policy value is invalid" >&2
    exit 2
  }
done
(( KEEP_MINIMUM >= 2 )) || {
  echo "[recovery-retention] at least two complete backups must be retained" >&2
  exit 2
}
(( MAX_DISK_USAGE_PERCENT >= 50 && MAX_DISK_USAGE_PERCENT <= 95 )) || {
  echo "[recovery-retention] disk threshold must be between 50 and 95" >&2
  exit 2
}
[[ "$DRY_RUN" == "true" || "$DRY_RUN" == "false" ]] || {
  echo "[recovery-retention] dry-run must be true or false" >&2
  exit 2
}

resolved_root="$(readlink -f "$BACKUP_ROOT" 2>/dev/null || true)"
[[ "$resolved_root" == /opt/resonance-backups/postgresql/on-demand ]] || {
  echo "[recovery-retention] unsafe backup root" >&2
  exit 3
}
[[ -d "$resolved_root" ]] || exit 0

mapfile -t archives < <(
  find "$resolved_root" -maxdepth 1 -type f \
    -name 'carbonet-[0-9T]*-[0-9a-f-]*.dump' -printf '%T@ %p\n' \
    | sort -nr | cut -d' ' -f2-
)
disk_usage="$(df -P "$resolved_root" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
now="$(date +%s)"
delete_count=0
reclaim_bytes=0
declare -a candidates=()

for index in "${!archives[@]}"; do
  archive="${archives[$index]}"
  (( index >= KEEP_MINIMUM )) || continue
  [[ "$archive" == "$resolved_root"/carbonet-*.dump ]] || continue
  manifest="$archive.json"
  [[ -f "$manifest" ]] || continue
  jq -e '
    .verified == true
    and (.sha256 | type == "string" and test("^[0-9a-f]{64}$"))
    and (.bytes | type == "number" and . > 0)
  ' "$manifest" >/dev/null || continue
  expected_bytes="$(jq -r '.bytes' "$manifest")"
  actual_bytes="$(stat -c %s "$archive")"
  [[ "$expected_bytes" == "$actual_bytes" ]] || continue
  age_days="$(( (now - $(stat -c %Y "$archive")) / 86400 ))"
  if (( age_days < RETENTION_DAYS && disk_usage < MAX_DISK_USAGE_PERCENT )); then
    continue
  fi
  candidates+=("$archive")
done

# Delete oldest eligible generations first and cap every run to avoid a broad,
# irreversible cleanup caused by one malformed policy update.
if (( ${#candidates[@]} > 0 )); then
  mapfile -t candidates < <(printf '%s\n' "${candidates[@]}" | sort)
fi
for archive in "${candidates[@]}"; do
  (( delete_count < MAX_DELETE_PER_RUN )) || break
  bytes="$(stat -c %s "$archive")"
  delete_count="$((delete_count + 1))"
  reclaim_bytes="$((reclaim_bytes + bytes))"
  if [[ "$DRY_RUN" == "false" ]]; then
    rm -f -- "$archive" "$archive.json"
  fi
done

stale_partial_count=0
while IFS= read -r partial; do
  [[ -n "$partial" ]] || continue
  [[ "$partial" == "$resolved_root"/.carbonet-*.dump.partial ]] || exit 3
  stale_partial_count="$((stale_partial_count + 1))"
  if [[ "$DRY_RUN" == "false" ]]; then
    rm -f -- "$partial"
  fi
done < <(
  find "$resolved_root" -maxdepth 1 -type f \
    -name '.carbonet-*.dump.partial' -mmin "+$((STALE_PARTIAL_HOURS * 60))" \
    -print | sort | head -"$MAX_DELETE_PER_RUN"
)

jq -nc \
  --argjson archiveCount "${#archives[@]}" \
  --argjson keepMinimum "$KEEP_MINIMUM" \
  --argjson diskUsagePercent "$disk_usage" \
  --argjson thresholdPercent "$MAX_DISK_USAGE_PERCENT" \
  --argjson deletedCount "$delete_count" \
  --argjson stalePartialCount "$stale_partial_count" \
  --argjson reclaimBytes "$reclaim_bytes" \
  --argjson dryRun "$DRY_RUN" \
  '{
    archiveCount:$archiveCount,
    keepMinimum:$keepMinimum,
    diskUsagePercent:$diskUsagePercent,
    thresholdPercent:$thresholdPercent,
    deletedCount:$deletedCount,
    stalePartialCount:$stalePartialCount,
    reclaimBytes:$reclaimBytes,
    dryRun:$dryRun
  }'

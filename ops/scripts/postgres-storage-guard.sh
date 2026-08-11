#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
STORAGE_ROOT="${CARBONET_POSTGRES_STORAGE_ROOT:-/opt/resonance-data/postgresql}"
DATA_ROOT="$STORAGE_ROOT/patroni"
BACKUP_ROOT="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
SCHEDULED_BACKUP_ROOT="${CARBONET_SCHEDULED_DB_BACKUP_ROOT:-/opt/resonance-data/backups/postgres}"
DEPLOY_TIMER="${CARBONET_DEPLOY_TIMER:-carbonet-auto-deploy.timer}"
MAINTENANCE_HOLD="${CARBONET_AUTO_DEPLOY_MAINTENANCE_HOLD:-/run/carbonet-auto-deploy-maintenance.hold}"
CACHE_DIR="${CARBONET_POSTGRES_STORAGE_GUARD_CACHE_DIR:-/var/cache/resonance/postgres-storage-guard}"
# The default cuts the minute-level full scan rate by 60x. A caller may choose
# any 1-minute..6-hour bound, but may never extend trust beyond six hours.
# Unit tests override the variable after sourcing this file.
FULL_VALIDATION_TTL_SECONDS="${CARBONET_POSTGRES_STORAGE_GUARD_FULL_VALIDATION_TTL_SECONDS:-3600}"
CACHE_REQUIRED_UID=0
CACHE_REQUIRED_GID=0
CACHE_FORMAT='POSTGRES_STORAGE_GUARD_CACHE_V1'

fail() {
  echo "[postgres-storage-guard] CRITICAL: $*" >&2
  systemctl stop "$DEPLOY_TIMER" 2>/dev/null || true
  exit 1
}

current_epoch() {
  date +%s
}

validate_full_validation_ttl() {
  [[ "$FULL_VALIDATION_TTL_SECONDS" =~ ^[0-9]+$ ]] \
    && [[ "$FULL_VALIDATION_TTL_SECONDS" -ge 60 ]] \
    && [[ "$FULL_VALIDATION_TTL_SECONDS" -le 21600 ]]
}

hash_fields() {
  printf '%s\0' "$@" | sha256sum | awk '{print $1}'
}

capture_regular_file_identity() {
  local input="$1" canonical
  [[ "$input" == /* && "$input" != *$'\n'* && "$input" != *$'\r'* ]] || return 1
  [[ -f "$input" && ! -L "$input" ]] || return 1
  canonical="$(readlink -f -- "$input")" || return 1
  [[ "$canonical" == "$input" ]] || return 1

  CAPTURED_CANONICAL_PATH="$canonical"
  # %y and %z retain nanoseconds. Device/inode also prevent a same-name file
  # replacement from inheriting a prior successful validation.
  CAPTURED_FILE_METADATA="$(stat -c '%d|%i|%s|%y|%z' -- "$canonical")" || return 1
}

path_has_no_symlink_components() {
  local path="$1" component current=''
  local -a components=()
  IFS='/' read -r -a components <<< "$path"
  for component in "${components[@]}"; do
    [[ -n "$component" ]] || continue
    current="$current/$component"
    [[ ! -L "$current" ]] || return 1
  done
}

cache_parent_is_safe() {
  local parent="$1" metadata mode permissions
  [[ -d "$parent" && ! -L "$parent" ]] || return 1
  metadata="$(stat -c '%u:%g' -- "$parent")" || return 1
  [[ "$metadata" == "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID" ]] || return 1
  mode="$(stat -c '%a' -- "$parent")" || return 1
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || return 1
  permissions="${mode: -3}"
  (( (8#$permissions & 0022) == 0 ))
}

ensure_secure_cache_dir() {
  local canonical metadata parent existing_parent
  [[ "$CACHE_DIR" == /* && "$CACHE_DIR" != *$'\n'* && "$CACHE_DIR" != *$'\r'* ]] || return 1
  path_has_no_symlink_components "$CACHE_DIR" || return 1
  if [[ ! -e "$CACHE_DIR" && ! -L "$CACHE_DIR" ]]; then
    parent="$(dirname "$CACHE_DIR")"
    existing_parent="$parent"
    while [[ ! -e "$existing_parent" && ! -L "$existing_parent" && "$existing_parent" != / ]]; do
      existing_parent="$(dirname "$existing_parent")"
    done
    path_has_no_symlink_components "$existing_parent" || return 1
    cache_parent_is_safe "$existing_parent" || return 1
    (umask 077 && mkdir -p -- "$CACHE_DIR") || return 1
    chmod 0700 -- "$CACHE_DIR" || return 1
  fi
  path_has_no_symlink_components "$CACHE_DIR" || return 1
  cache_parent_is_safe "$(dirname "$CACHE_DIR")" || return 1
  [[ -d "$CACHE_DIR" && ! -L "$CACHE_DIR" ]] || return 1
  canonical="$(readlink -f -- "$CACHE_DIR")" || return 1
  [[ "$canonical" == "$CACHE_DIR" ]] || return 1
  metadata="$(stat -c '%u:%g:%a' -- "$CACHE_DIR")" || return 1
  [[ "$metadata" == "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID:700" ]]
}

cache_entry_path() {
  local validator="$1" canonical_path="$2" name
  name="$(hash_fields 'entry-v1' "$validator" "$canonical_path")" || return 1
  CACHE_ENTRY_PATH="$CACHE_DIR/$name.cache"
}

cache_entry_is_safe() {
  local entry="$1" metadata size
  [[ -f "$entry" && ! -L "$entry" ]] || return 1
  metadata="$(stat -c '%u:%g:%a' -- "$entry")" || return 1
  [[ "$metadata" == "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID:600" ]] || return 1
  size="$(stat -c '%s' -- "$entry")" || return 1
  [[ "$size" =~ ^[0-9]+$ && "$size" -le 512 ]]
}

cache_hit_for_identity() {
  local entry="$1" identity="$2" now="$3"
  local magic identity_line validated_line extra validated_at age
  ensure_secure_cache_dir || return 1
  cache_entry_is_safe "$entry" || return 1
  {
    IFS= read -r magic || return 1
    IFS= read -r identity_line || return 1
    IFS= read -r validated_line || return 1
    if IFS= read -r extra; then
      return 1
    fi
  } < "$entry"
  [[ "$magic" == "$CACHE_FORMAT" ]] || return 1
  [[ "$identity_line" == "identity_sha256=$identity" ]] || return 1
  [[ "$validated_line" =~ ^validated_at=([0-9]+)$ ]] || return 1
  validated_at="${BASH_REMATCH[1]}"
  [[ "$now" =~ ^[0-9]+$ && "$now" -ge "$validated_at" ]] || return 1
  age=$((now - validated_at))
  [[ "$age" -lt "$FULL_VALIDATION_TTL_SECONDS" ]]
}

write_validation_cache() {
  local entry="$1" identity="$2" now="$3" tmp metadata
  ensure_secure_cache_dir || return 1
  tmp="$(mktemp "$CACHE_DIR/.validation.XXXXXXXX")" || return 1
  if ! {
    chmod 0600 -- "$tmp" &&
      printf '%s\nidentity_sha256=%s\nvalidated_at=%s\n' \
        "$CACHE_FORMAT" "$identity" "$now" > "$tmp"
  }; then
    rm -f -- "$tmp"
    return 1
  fi
  metadata="$(stat -c '%u:%g:%a' -- "$tmp")" || {
    rm -f -- "$tmp"
    return 1
  }
  if [[ "$metadata" != "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID:600" ]]; then
    rm -f -- "$tmp"
    return 1
  fi
  mv -fT -- "$tmp" "$entry" || {
    rm -f -- "$tmp"
    return 1
  }
  cache_entry_is_safe "$entry"
}

run_gzip_integrity_test() {
  gzip -t -- "$1"
}

cached_gzip_test() {
  local input="$1" before_path before_metadata after_path after_metadata
  local identity entry now
  capture_regular_file_identity "$input" || return 1
  before_path="$CAPTURED_CANONICAL_PATH"
  before_metadata="$CAPTURED_FILE_METADATA"
  identity="$(hash_fields 'gzip-v1' "$before_path" "$before_metadata")" || return 1
  cache_entry_path 'gzip' "$before_path" || return 1
  entry="$CACHE_ENTRY_PATH"
  now="$(current_epoch)" || return 1

  if cache_hit_for_identity "$entry" "$identity" "$now"; then
    return 0
  fi

  echo "[postgres-storage-guard] INFO: full gzip validation: $before_path" >&2
  run_gzip_integrity_test "$before_path" 2>/dev/null || return 1
  capture_regular_file_identity "$input" || return 1
  after_path="$CAPTURED_CANONICAL_PATH"
  after_metadata="$CAPTURED_FILE_METADATA"
  [[ "$before_path" == "$after_path" && "$before_metadata" == "$after_metadata" ]] || return 1
  write_validation_cache "$entry" "$identity" "$now"
}

run_primary_checksum_test() {
  local candidate="$1" checksum="$2"
  (cd "$(dirname "$candidate")" && sha256sum -c "$(basename "$checksum")" >/dev/null 2>&1)
}

checksum_file_targets_candidate() {
  local candidate="$1" checksum="$2" line suffix digest
  local -a lines=()
  mapfile -t lines < "$checksum" || return 1
  [[ "${#lines[@]}" -eq 1 ]] || return 1
  line="${lines[0]}"
  [[ "${#line}" -ge 67 ]] || return 1
  digest="${line:0:64}"
  suffix="${line:64}"
  [[ "$digest" =~ ^[0-9a-fA-F]{64}$ ]] || return 1
  [[ "$suffix" == "  $(basename "$candidate")" || "$suffix" == " *$(basename "$candidate")" ]]
}

run_primary_mirror_compare() {
  cmp -s -- "$1" "$2"
}

cached_scheduled_backup_test() {
  local candidate="$1" mirror="$2" checksum="$3" manifest="$4"
  local candidate_path candidate_metadata mirror_path mirror_metadata
  local checksum_path checksum_metadata manifest_path manifest_metadata
  local identity entry now

  capture_regular_file_identity "$candidate" || return 1
  candidate_path="$CAPTURED_CANONICAL_PATH"
  candidate_metadata="$CAPTURED_FILE_METADATA"
  capture_regular_file_identity "$mirror" || return 1
  mirror_path="$CAPTURED_CANONICAL_PATH"
  mirror_metadata="$CAPTURED_FILE_METADATA"
  capture_regular_file_identity "$checksum" || return 1
  checksum_path="$CAPTURED_CANONICAL_PATH"
  checksum_metadata="$CAPTURED_FILE_METADATA"
  capture_regular_file_identity "$manifest" || return 1
  manifest_path="$CAPTURED_CANONICAL_PATH"
  manifest_metadata="$CAPTURED_FILE_METADATA"
  [[ -s "$candidate_path" && -s "$mirror_path" && -s "$checksum_path" && -s "$manifest_path" ]] || return 1
  [[ "$(dirname "$candidate_path")" == "$(dirname "$checksum_path")" ]] || return 1
  [[ "$(stat -c '%s' -- "$checksum_path")" -le 4096 ]] || return 1
  checksum_file_targets_candidate "$candidate_path" "$checksum_path" || return 1

  identity="$(hash_fields 'scheduled-v1' \
    "$candidate_path" "$candidate_metadata" \
    "$mirror_path" "$mirror_metadata" \
    "$checksum_path" "$checksum_metadata" \
    "$manifest_path" "$manifest_metadata")" || return 1
  cache_entry_path 'scheduled' "$candidate_path" || return 1
  entry="$CACHE_ENTRY_PATH"
  now="$(current_epoch)" || return 1
  if cache_hit_for_identity "$entry" "$identity" "$now"; then
    return 0
  fi

  echo "[postgres-storage-guard] INFO: full scheduled backup validation: $candidate_path" >&2
  run_primary_checksum_test "$candidate_path" "$checksum_path" || return 1
  run_primary_mirror_compare "$candidate_path" "$mirror_path" || return 1

  # Reject a file that changed while SHA-256 or byte comparison was running.
  local post_identity
  capture_regular_file_identity "$candidate" || return 1
  post_identity="$(hash_fields 'scheduled-v1' \
    "$CAPTURED_CANONICAL_PATH" "$CAPTURED_FILE_METADATA" \
    "$mirror_path" "$mirror_metadata" \
    "$checksum_path" "$checksum_metadata" \
    "$manifest_path" "$manifest_metadata")" || return 1
  [[ "$post_identity" == "$identity" ]] || return 1
  capture_regular_file_identity "$mirror" || return 1
  [[ "$CAPTURED_CANONICAL_PATH" == "$mirror_path" && "$CAPTURED_FILE_METADATA" == "$mirror_metadata" ]] || return 1
  capture_regular_file_identity "$checksum" || return 1
  [[ "$CAPTURED_CANONICAL_PATH" == "$checksum_path" && "$CAPTURED_FILE_METADATA" == "$checksum_metadata" ]] || return 1
  capture_regular_file_identity "$manifest" || return 1
  [[ "$CAPTURED_CANONICAL_PATH" == "$manifest_path" && "$CAPTURED_FILE_METADATA" == "$manifest_metadata" ]] || return 1
  write_validation_cache "$entry" "$identity" "$now"
}

latest_valid_backup() {
  local pattern="$1" min_size="$2" candidate
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    if cached_gzip_test "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    echo "[postgres-storage-guard] WARN: skipping incomplete backup: $candidate" >&2
  done < <(find "$BACKUP_ROOT" -maxdepth 1 -type f -name "$pattern" -mmin -1440 -size "$min_size" \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-)
  return 1
}

latest_valid_scheduled_backup() {
  local candidate relative mirror checksum manifest
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    checksum="$candidate.sha256"
    manifest="$candidate.manifest"
    relative="${candidate#"$SCHEDULED_BACKUP_ROOT/primary/"}"
    mirror="$SCHEDULED_BACKUP_ROOT/mirror/$relative"
    if cached_scheduled_backup_test "$candidate" "$mirror" "$checksum" "$manifest"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    echo "[postgres-storage-guard] WARN: skipping invalid scheduled backup: $candidate" >&2
  done < <(find "$SCHEDULED_BACKUP_ROOT/primary/hourly" "$SCHEDULED_BACKUP_ROOT/primary/daily" \
    -maxdepth 1 -type f -name 'carbonet_*.dump' -mmin -1440 -size +100k \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-)
  return 1
}

refresh_role_backup() {
  local pod tmp output
  pod="$(
    kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
      -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.metadata.labels.role}{"\n"}{end}' \
      | awk '$2 == "master" || $2 == "primary" || $2 == "leader" { print $1; exit }'
  )"
  if [[ -z "$pod" ]]; then
    pod="$(
      kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
        -o jsonpath='{.items[0].metadata.name}'
    )"
  fi
  [[ -n "$pod" ]] || return 1

  output="$BACKUP_ROOT/postgres-roles-$(date +%Y%m%d%H%M%S)-storage-guard.sql.gz"
  tmp="$output.tmp"
  rm -f "$tmp"
  if ! kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
      pg_dumpall -U postgres --roles-only -h 127.0.0.1 \
      | gzip -1 > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [[ "$(stat -c %s "$tmp")" -lt 100 ]] || ! gzip -t "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$output"
  echo "[postgres-storage-guard] refreshed PostgreSQL role backup: $output"
}

recover_deploy_timer() {
  if [[ -e "$MAINTENANCE_HOLD" || -L "$MAINTENANCE_HOLD" ]]; then
    echo "[postgres-storage-guard] INFO: deployment maintenance hold is active; timer remains stopped"
    return 0
  fi
  if ! systemctl is-active --quiet "$DEPLOY_TIMER"; then
    systemctl start "$DEPLOY_TIMER" 2>/dev/null \
      || echo "[postgres-storage-guard] WARN: could not restart $DEPLOY_TIMER" >&2
  fi
}

main() {
  local boundary owner mode attrs locked_ancestors pod marker ready ready_members
  local latest_data_backup latest_role_backup

  validate_full_validation_ttl \
    || fail "full validation TTL must be between 60 and 21600 seconds"
  [[ "$EUID" -eq 0 ]] || fail "storage guard must run as root"
  ensure_secure_cache_dir || fail "validation cache directory is not canonical root:root mode 0700: $CACHE_DIR"
  [[ "$STORAGE_ROOT" == /opt/resonance-data/postgresql ]] || fail "unexpected storage root: $STORAGE_ROOT"
  [[ -d "$DATA_ROOT" ]] || fail "Patroni data root is missing"

  for boundary in "$STORAGE_ROOT" "$DATA_ROOT"; do
    owner="$(stat -c '%U:%G' "$boundary")"
    mode="$(stat -c '%a' "$boundary")"
    attrs="$(lsattr -d "$boundary" | awk '{print $1}')"
    [[ "$owner" == "root:root" ]] || fail "$boundary owner is $owner"
    [[ "$mode" == "755" ]] || fail "$boundary mode is $mode"
    [[ "$attrs" == *i* ]] || fail "$boundary is not immutable"
  done

  # Lock the two pod-specific mount boundaries. Keep pgroot itself mutable so
  # Patroni can legitimately remove/recreate its data directory during a replica
  # reinitialization, while broad cleanup cannot unlink the pod storage roots.
  locked_ancestors=0
  while IFS= read -r boundary; do
    attrs="$(lsattr -d "$boundary" | awk '{print $1}')"
    [[ "$attrs" == *i* ]] || fail "$boundary is not immutable"
    locked_ancestors=$((locked_ancestors + 1))
  done < <(find "$DATA_ROOT" -mindepth 1 -maxdepth 1 -type d -print)
  [[ "$locked_ancestors" -ge 3 ]] || fail "expected Patroni pod boundary locks are missing ($locked_ancestors/3)"

  ready_members=0
  while IFS= read -r pod; do
    [[ -n "$pod" ]] || continue
    marker="/home/postgres/pgdata/${pod}/pgroot/data/PG_VERSION"
    kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- test -s "$marker" \
      || fail "PostgreSQL control marker is missing on $pod"
    ready="$(kubectl -n "$NAMESPACE" get pod "$pod" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || true)"
    [[ "$ready" == "true" ]] && ready_members=$((ready_members + 1))
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
  [[ "$ready_members" -ge 2 ]] || fail "Patroni quorum is not ready ($ready_members/3)"

  latest_data_backup="$(latest_valid_backup 'carbonet-*.sql.gz' '+100k' || true)"
  if [[ -z "$latest_data_backup" ]]; then
    latest_data_backup="$(latest_valid_scheduled_backup || true)"
  fi
  latest_role_backup="$(latest_valid_backup 'postgres-roles-*.sql.gz' '+100c' || true)"
  [[ -n "$latest_data_backup" ]] || fail "no valid data backup from the last 24 hours"
  if [[ -z "$latest_role_backup" ]]; then
    # Role metadata is small and safe to refresh online. Self-heal it instead of
    # permanently stopping application deployments at the 24-hour boundary.
    refresh_role_backup || fail "no valid role backup and automatic refresh failed"
    latest_role_backup="$(latest_valid_backup 'postgres-roles-*.sql.gz' '+100c' || true)"
    [[ -n "$latest_role_backup" ]] || fail "refreshed role backup did not pass validation"
  fi

  # A failed guard deliberately pauses deployments. Once every storage boundary,
  # quorum marker, and backup check is healthy again, recover the timer unless an
  # operator has explicitly placed the deployment system in maintenance mode.
  recover_deploy_timer

  echo "[postgres-storage-guard] OK: boundaries, quorum, control markers, and backups verified"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

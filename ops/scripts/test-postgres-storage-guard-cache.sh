#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
guard="$root/ops/scripts/postgres-storage-guard.sh"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT

# shellcheck source=ops/scripts/postgres-storage-guard.sh
source "$guard"

CACHE_DIR="$work/cache"
CACHE_REQUIRED_UID="$(id -u)"
CACHE_REQUIRED_GID="$(id -g)"
FULL_VALIDATION_TTL_SECONDS=21600
TEST_NOW=1700000000
current_epoch() { printf '%s\n' "$TEST_NOW"; }

for valid_ttl in 60 3600 21600; do
  FULL_VALIDATION_TTL_SECONDS="$valid_ttl"
  validate_full_validation_ttl || {
    echo "ASSERTION FAILED: valid TTL rejected ($valid_ttl)" >&2
    exit 1
  }
done
for invalid_ttl in 0 59 21601 invalid; do
  FULL_VALIDATION_TTL_SECONDS="$invalid_ttl"
  if validate_full_validation_ttl; then
    echo "ASSERTION FAILED: out-of-bound TTL accepted ($invalid_ttl)" >&2
    exit 1
  fi
done
FULL_VALIDATION_TTL_SECONDS=21600

real_gzip="$(command -v gzip)"
gzip_calls="$work/gzip.calls"
: > "$gzip_calls"
run_gzip_integrity_test() {
  printf 'gzip\n' >> "$gzip_calls"
  "$real_gzip" -t -- "$1"
}

real_sha256sum="$(command -v sha256sum)"
real_cmp="$(command -v cmp)"
scheduled_calls="$work/scheduled.calls"
: > "$scheduled_calls"
run_primary_checksum_test() {
  local candidate="$1" checksum="$2"
  printf 'sha256\n' >> "$scheduled_calls"
  (cd "$(dirname "$candidate")" && "$real_sha256sum" -c "$(basename "$checksum")" >/dev/null 2>&1)
}
run_primary_mirror_compare() {
  printf 'cmp\n' >> "$scheduled_calls"
  "$real_cmp" -s -- "$1" "$2"
}

count_lines() {
  wc -l < "$1" | tr -d '[:space:]'
}

assert_eq() {
  local expected="$1" actual="$2" message="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "ASSERTION FAILED: $message (expected=$expected actual=$actual)" >&2
    exit 1
  fi
}

elapsed_ms() {
  local started="$1" finished="$2"
  printf '%s\n' $(((finished - started) / 1000000))
}

fixture="$work/carbonet-cache-fixture.sql.gz"
# 32 MiB of zeros produces a bounded fixture that is cheap to create but still
# makes full decompression measurably more expensive than metadata checks.
head -c 33554432 /dev/zero | "$real_gzip" -1 > "$fixture"

started="$(date +%s%N)"
cached_gzip_test "$fixture"
finished="$(date +%s%N)"
first_ms="$(elapsed_ms "$started" "$finished")"
assert_eq 1 "$(count_lines "$gzip_calls")" 'first sight must run gzip -t'

started="$(date +%s%N)"
cached_gzip_test "$fixture"
finished="$(date +%s%N)"
cached_ms="$(elapsed_ms "$started" "$finished")"
assert_eq 1 "$(count_lines "$gzip_calls")" 'unchanged second run must use cache'

cache_entry_path gzip "$fixture"
entry="$CACHE_ENTRY_PATH"
assert_eq "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID:600" \
  "$(stat -c '%u:%g:%a' -- "$entry")" 'cache entry ownership/mode'
assert_eq "$CACHE_REQUIRED_UID:$CACHE_REQUIRED_GID:700" \
  "$(stat -c '%u:%g:%a' -- "$CACHE_DIR")" 'cache directory ownership/mode'
if find "$CACHE_DIR" -maxdepth 1 -name '.validation.*' -print -quit | grep -q .; then
  echo 'ASSERTION FAILED: atomic cache temporary file leaked' >&2
  exit 1
fi

# TTL expiry must force a full revalidation even when every file field is stable.
TEST_NOW=$((TEST_NOW + FULL_VALIDATION_TTL_SECONDS))
cached_gzip_test "$fixture"
assert_eq 2 "$(count_lines "$gzip_calls")" 'TTL expiry must run gzip -t'

# A valid replacement at the same pathname has a new inode/ctime and cannot hit.
replacement="$work/replacement.gz"
printf 'changed fixture\n' | "$real_gzip" -1 > "$replacement"
mv -f -- "$replacement" "$fixture"
cached_gzip_test "$fixture"
assert_eq 3 "$(count_lines "$gzip_calls")" 'changed backup must invalidate cache'

# A corrupt replacement must be scanned, rejected, and never cached as healthy.
cp -- "$fixture" "$work/valid.gz"
truncate -s 8 "$fixture"
if cached_gzip_test "$fixture"; then
  echo 'ASSERTION FAILED: corrupt gzip was accepted' >&2
  exit 1
fi
assert_eq 4 "$(count_lines "$gzip_calls")" 'corrupt backup must run gzip -t'
mv -f -- "$work/valid.gz" "$fixture"
cached_gzip_test "$fixture"
assert_eq 5 "$(count_lines "$gzip_calls")" 'restored backup must be revalidated'

# Cache content, mode, and symlink faults must never be trusted.
cache_entry_path gzip "$fixture"
entry="$CACHE_ENTRY_PATH"
printf '%s\nidentity_sha256=forged\nvalidated_at=%s\n' "$CACHE_FORMAT" "$TEST_NOW" > "$entry"
chmod 0600 "$entry"
cached_gzip_test "$fixture"
assert_eq 6 "$(count_lines "$gzip_calls")" 'forged cache must force full validation'

chmod 0644 "$entry"
cached_gzip_test "$fixture"
assert_eq 7 "$(count_lines "$gzip_calls")" 'wrong-mode cache must force full validation'
assert_eq 600 "$(stat -c '%a' -- "$entry")" 'wrong-mode cache must be atomically replaced'

mv -- "$entry" "$work/cache-target"
ln -s -- "$work/cache-target" "$entry"
cached_gzip_test "$fixture"
assert_eq 8 "$(count_lines "$gzip_calls")" 'symlink cache must force full validation'
[[ ! -L "$entry" ]] || {
  echo 'ASSERTION FAILED: symlink cache was not atomically replaced' >&2
  exit 1
}

# The owner predicate itself rejects a cache entry not owned by the required uid.
original_uid="$CACHE_REQUIRED_UID"
CACHE_REQUIRED_UID=$((original_uid + 10000))
if cache_entry_is_safe "$entry"; then
  echo 'ASSERTION FAILED: wrong-owner cache entry was accepted' >&2
  exit 1
fi
CACHE_REQUIRED_UID="$original_uid"

backup_link="$work/backup-link.gz"
ln -s -- "$fixture" "$backup_link"
if cached_gzip_test "$backup_link"; then
  echo 'ASSERTION FAILED: backup symlink was accepted' >&2
  exit 1
fi
assert_eq 8 "$(count_lines "$gzip_calls")" 'backup symlink must fail before gzip -t'

real_cache="$CACHE_DIR"
mv "$real_cache" "$work/cache-real"
ln -s "$work/cache-real" "$real_cache"
if ensure_secure_cache_dir; then
  echo 'ASSERTION FAILED: symlink cache directory was accepted' >&2
  exit 1
fi
rm "$real_cache"
mv "$work/cache-real" "$real_cache"

parent_real="$work/cache-parent-real"
mkdir "$parent_real"
ln -s "$parent_real" "$work/cache-parent-link"
saved_cache="$CACHE_DIR"
CACHE_DIR="$work/cache-parent-link/cache"
if ensure_secure_cache_dir; then
  echo 'ASSERTION FAILED: symlink cache parent was accepted' >&2
  exit 1
fi
[[ ! -e "$parent_real/cache" ]] || {
  echo 'ASSERTION FAILED: cache directory was created through a symlink parent' >&2
  exit 1
}
CACHE_DIR="$saved_cache"

unsafe_parent="$work/unsafe-cache-parent"
mkdir "$unsafe_parent"
chmod 0777 "$unsafe_parent"
CACHE_DIR="$unsafe_parent/cache"
if ensure_secure_cache_dir; then
  echo 'ASSERTION FAILED: writable cache parent was accepted' >&2
  exit 1
fi
[[ ! -e "$CACHE_DIR" ]] || {
  echo 'ASSERTION FAILED: cache was created below an unsafe parent' >&2
  exit 1
}
CACHE_DIR="$saved_cache"

chmod 0755 "$CACHE_DIR"
if ensure_secure_cache_dir; then
  echo 'ASSERTION FAILED: wrong-mode cache directory was accepted' >&2
  exit 1
fi
chmod 0700 "$CACHE_DIR"

# Scheduled primary/checksum/manifest/mirror validation has the same bounded
# trust rule and detects either-side replacement before skipping SHA/cmp.
primary_dir="$work/scheduled/primary/hourly"
mirror_dir="$work/scheduled/mirror/hourly"
mkdir -p "$primary_dir" "$mirror_dir"
primary="$primary_dir/carbonet_fixture.dump"
mirror="$mirror_dir/carbonet_fixture.dump"
checksum="$primary.sha256"
manifest="$primary.manifest"
head -c 4194304 /dev/zero > "$primary"
cp -- "$primary" "$mirror"
(cd "$primary_dir" && "$real_sha256sum" "$(basename "$primary")" > "$(basename "$checksum")")
printf '{"fixture":true}\n' > "$manifest"

TEST_NOW=$((TEST_NOW + 1))
cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"
assert_eq 2 "$(count_lines "$scheduled_calls")" 'scheduled first sight must run sha256 and cmp'
cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"
assert_eq 2 "$(count_lines "$scheduled_calls")" 'scheduled unchanged run must use cache'

TEST_NOW=$((TEST_NOW + FULL_VALIDATION_TTL_SECONDS))
cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"
assert_eq 4 "$(count_lines "$scheduled_calls")" 'scheduled TTL expiry must run sha256 and cmp'

printf 'x' | dd of="$mirror" bs=1 seek=0 conv=notrunc status=none
if cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"; then
  echo 'ASSERTION FAILED: changed scheduled mirror was accepted' >&2
  exit 1
fi
assert_eq 6 "$(count_lines "$scheduled_calls")" 'scheduled mirror change must run sha256 and cmp'

cp -- "$primary" "$mirror"
(cd "$primary_dir" && "$real_sha256sum" "$(basename "$primary")" > "$(basename "$checksum")")
cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"
assert_eq 8 "$(count_lines "$scheduled_calls")" 'restored scheduled pair must be revalidated'
printf '%064d  another.dump\n' 0 > "$checksum"
if cached_scheduled_backup_test "$primary" "$mirror" "$checksum" "$manifest"; then
  echo 'ASSERTION FAILED: checksum for a different filename was accepted' >&2
  exit 1
fi
assert_eq 8 "$(count_lines "$scheduled_calls")" 'wrong checksum target must fail before expensive validation'

# Timer recovery must honor maintenance explicitly, while preserving the
# existing healthy self-heal behavior when no hold exists.
fake_bin="$work/bin"
mkdir -p "$fake_bin"
systemctl_log="$work/systemctl.log"
: > "$systemctl_log"
cat > "$fake_bin/systemctl" <<'SYSTEMCTL'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
if [[ "$1" == is-active ]]; then
  exit 3
fi
exit 0
SYSTEMCTL
chmod +x "$fake_bin/systemctl"
old_path="$PATH"
PATH="$fake_bin:$PATH"
export SYSTEMCTL_LOG="$systemctl_log"
DEPLOY_TIMER='fixture-deploy.timer'
MAINTENANCE_HOLD="$work/maintenance.hold"
: > "$MAINTENANCE_HOLD"
recover_deploy_timer
if grep -q '^start ' "$systemctl_log"; then
  echo 'ASSERTION FAILED: maintenance hold allowed timer start' >&2
  exit 1
fi
rm "$MAINTENANCE_HOLD"
recover_deploy_timer
assert_eq 1 "$(grep -c '^start fixture-deploy.timer$' "$systemctl_log")" \
  'healthy no-hold guard must retain timer self-heal'
PATH="$old_path"

printf 'POSTGRES_STORAGE_GUARD_CACHE_TIMING fixture_uncompressed_bytes=33554432 first_full_ms=%s unchanged_cached_ms=%s gzip_full_calls=%s scheduled_full_pairs=%s\n' \
  "$first_ms" "$cached_ms" "$(count_lines "$gzip_calls")" "$(( $(count_lines "$scheduled_calls") / 2 ))"
echo 'POSTGRES_STORAGE_GUARD_CACHE_PASS'

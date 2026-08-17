#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/ops/scripts/prune-predeploy-backups.sh"
opt_root=/opt/resonance-backups/postgresql
uid="$(id -u)"
gid="$(id -g)"
run_id="${uid}.$$.${RANDOM}"
fixture="$opt_root/.prune-predeploy-test.$run_id"
fixture_root="$fixture/postgresql"
backup_dir="$fixture_root/pre-deploy"
manifest_dir="$fixture_root/.predeploy-prune-manifests"
mutant_root="$root/.prune-predeploy-mutants.$run_id"

cleanup() {
  if [[ "$fixture" == "$opt_root"/.prune-predeploy-test.* ]]; then
    if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
      sudo -n chown -R "$uid:$gid" "$fixture" 2>/dev/null || true
    fi
    rm -rf -- "$fixture"
  fi
  if [[ "$mutant_root" == "$root"/.prune-predeploy-mutants.* ]]; then
    rm -rf -- "$mutant_root"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p -- "$opt_root" "$backup_dir" "$mutant_root"

namespace_body='set -euo pipefail
fixture_root="$1"
target="$2"
run_uid="$3"
run_gid="$4"
drop_privileges="$5"
test_script="$6"
manifest_override="$7"
mount --bind "$fixture_root" "$target"
env_args=(
  TMPDIR=/proc
  CARBONET_DB_BACKUP_DIR=/opt/resonance-backups/postgresql/pre-deploy
  CARBONET_BACKUP_KEEP_RECENT_HOURS=24
  CARBONET_BACKUP_KEEP_DAILY_DAYS=1
  CARBONET_BACKUP_PRUNE_DRY_RUN=false
)
if [[ -n "$manifest_override" ]]; then
  env_args+=(CARBONET_BACKUP_PRUNE_MANIFEST_DIR="$manifest_override")
fi
if [[ "$drop_privileges" == true ]]; then
  exec setpriv --reuid="$run_uid" --regid="$run_gid" --clear-groups env "${env_args[@]}" bash "$test_script"
fi
exec env "${env_args[@]}" bash "$test_script"'

namespace_mode=""
if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  namespace_mode=sudo
elif unshare --user --map-root-user true >/dev/null 2>&1; then
  namespace_mode=user
else
  echo "[backup-retention-test] mount namespace unavailable" >&2
  exit 1
fi

run_isolated() {
  local test_script="$1" manifest_override="${2:-}"
  if [[ "$namespace_mode" == sudo ]]; then
    sudo -n unshare --mount --propagation private \
      bash -c "$namespace_body" _ \
      "$fixture_root" "$opt_root" "$uid" "$gid" true "$test_script" "$manifest_override"
  else
    unshare --user --map-root-user --mount --propagation private \
      bash -c "$namespace_body" _ \
      "$fixture_root" "$opt_root" 0 0 false "$test_script" "$manifest_override"
  fi
}

# The source contract guards the exact production path, ownership, 0700 mode,
# /opt filesystem, and pre-armed run paths. These assertions make each guard
# independently mutation-sensitive.
for contract in \
  'MANIFEST_DIR="${CARBONET_BACKUP_PRUNE_MANIFEST_DIR:-/opt/resonance-backups/postgresql/.predeploy-prune-manifests}"' \
  '"$(stat -c %u "$resolved_manifest_dir" 2>/dev/null || true)" != "$(id -u)"' \
  '"$(stat -c %a "$resolved_manifest_dir" 2>/dev/null || true)" != 700' \
  '"$(stat -c %d "$resolved_manifest_dir" 2>/dev/null || true)" != "$(stat -c %d /opt 2>/dev/null || true)"' \
  'run_dir="$resolved_manifest_dir/run.$$.${BASHPID}.${RANDOM}.${RANDOM}"' \
  'keep_file="$run_dir/keep"' \
  'delete_file="$run_dir/delete"' \
  'stale_schema_dirs_file="$run_dir/stale-schema-dirs"' \
  'rmdir -- "$run_dir" 2>/dev/null || true' \
  "-name '.schema-backup.??????'" \
  'candidate_name" =~ ^\.schema-backup\.[A-Za-z0-9]{6}$' \
  'rm -rf -- "$candidate"' \
  "! -name '*.partial.*'"
do
  grep -Fq -- "$contract" "$script" || {
    echo "[backup-retention-test] missing manifest safety contract: $contract" >&2
    exit 1
  }
done
[[ "$(grep -Fc -- "! -name '*.partial.*'" "$script")" == 3 ]]
arm_line="$(grep -nF 'run_dir="$resolved_manifest_dir/run.$$.${BASHPID}.${RANDOM}.${RANDOM}"' "$script" | cut -d: -f1)"
trap_line="$(grep -nF 'trap cleanup EXIT' "$script" | cut -d: -f1)"
mkdir_line="$(grep -nF 'mkdir -m 0700 -- "$run_dir"' "$script" | cut -d: -f1)"
keep_line="$(grep -nF ': > "$keep_file"' "$script" | cut -d: -f1)"
[[ "$arm_line" -lt "$trap_line" && "$trap_line" -lt "$mkdir_line" && "$mkdir_line" -lt "$keep_line" ]]

# Mutant 1: an unsafe default path must fail closed before it can touch a
# backup. This detects path-validation removal or weakening.
unsafe_mutant="$mutant_root/prune-unsafe-path.sh"
sed 's#MANIFEST_DIR="${CARBONET_BACKUP_PRUNE_MANIFEST_DIR:-/opt/resonance-backups/postgresql/.predeploy-prune-manifests}"#MANIFEST_DIR="${CARBONET_BACKUP_PRUNE_MANIFEST_DIR:-/tmp/predeploy-prune-manifests}"#' \
  "$script" > "$unsafe_mutant"
chmod 0700 "$unsafe_mutant"
grep -Fq '/tmp/predeploy-prune-manifests' "$unsafe_mutant"
if run_isolated "$unsafe_mutant" >/dev/null 2>&1; then
  echo "[backup-retention-test] unsafe /tmp manifest mutant was accepted" >&2
  exit 1
fi

# Symlink and weak-mode directories are rejected rather than repaired in
# place, keeping the operation fail-closed under concurrent tampering.
mkdir -m 0700 -- "$fixture_root/unsafe-manifest-target"
ln -s -- "$fixture_root/unsafe-manifest-target" "$manifest_dir"
if run_isolated "$script" >/dev/null 2>&1; then
  echo "[backup-retention-test] manifest symlink was accepted" >&2
  exit 1
fi
rm -- "$manifest_dir"
mkdir -m 0755 -- "$manifest_dir"
if run_isolated "$script" >/dev/null 2>&1; then
  echo "[backup-retention-test] weak manifest mode was accepted" >&2
  exit 1
fi
chmod 0700 "$manifest_dir"

# On the production-capable path, verify that another owner is rejected.
if [[ "$namespace_mode" == sudo ]]; then
  sudo -n chown 0:0 "$manifest_dir"
  if run_isolated "$script" >/dev/null 2>&1; then
    echo "[backup-retention-test] foreign-owned manifest directory was accepted" >&2
    exit 1
  fi
  sudo -n chown "$uid:$gid" "$manifest_dir"
fi

# Mutant 2: falling back to bare mktemp must fail with TMPDIR=/proc. The real
# implementation must still succeed under the same poisoned TMPDIR.
tmpdir_mutant="$mutant_root/prune-tmpdir-fallback.sh"
sed 's#: > "$keep_file"#keep_file="$(mktemp)"#' \
  "$script" > "$tmpdir_mutant"
chmod 0700 "$tmpdir_mutant"
grep -Fq 'keep_file="$(mktemp)"' "$tmpdir_mutant"
if run_isolated "$tmpdir_mutant" >/dev/null 2>&1; then
  echo "[backup-retention-test] TMPDIR fallback mutant unexpectedly succeeded" >&2
  exit 1
fi
[[ -z "$(find "$manifest_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]

# A stale schema staging directory with an unexpected link must fail closed
# and remain untouched. This makes the recursive cleanup namespace- and
# content-sensitive rather than a broad age-based rm -rf.
unsafe_schema_dir="$backup_dir/.schema-backup.BAD123"
mkdir -m 0700 -- "$unsafe_schema_dir"
ln -s /etc/passwd "$unsafe_schema_dir/schema.dump"
touch -d '3 days ago' "$unsafe_schema_dir"
if run_isolated "$script" >/dev/null 2>&1; then
  echo "[backup-retention-test] unsafe stale schema directory was deleted" >&2
  exit 1
fi
test -L "$unsafe_schema_dir/schema.dump"
rm -- "$unsafe_schema_dir/schema.dump"
rmdir -- "$unsafe_schema_dir"

# Mutant 3: abort immediately after the run directory is created. Because all
# cleanup paths were armed first, even this partial-start window leaves no
# manifest residue.
partial_mutant="$mutant_root/prune-partial-start.sh"
sed 's#mkdir -m 0700 -- "$run_dir"#mkdir -m 0700 -- "$run_dir"\nexit 99#' \
  "$script" > "$partial_mutant"
chmod 0700 "$partial_mutant"
grep -Fq 'exit 99' "$partial_mutant"
if run_isolated "$partial_mutant" >/dev/null 2>&1; then
  echo "[backup-retention-test] partial-start mutant unexpectedly succeeded" >&2
  exit 1
fi
[[ -z "$(find "$manifest_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]

# Actual retention run: keep every fresh artifact plus the newest atomically
# published full/role pair for the newest retained day. A fresh producer
# partial remains recoverable inside the recent window, while both producer-
# style and final-looking stale partials are excluded and pruned.
day_compact="$(date -d '3 days ago' +%Y%m%d)"
day_iso="$(date -d '3 days ago' +%Y-%m-%d)"
partial_day_compact="$(date -d '2 days ago' +%Y%m%d)"
partial_day_iso="$(date -d '2 days ago' +%Y-%m-%d)"
latest_stamp="${day_compact}-120000"
older_stamp="${day_compact}-110000"
partial_stamp="${day_compact}-130000"
newer_day_partial_stamp="${partial_day_compact}-130000"
printf 'fresh\n' > "$backup_dir/fresh-artifact.txt"
printf 'fresh-partial\n' > "$backup_dir/carbonet-fresh.sql.gz.partial.888"
printf 'latest-full\n' > "$backup_dir/carbonet-$latest_stamp-full.sql.gz"
printf 'latest-roles\n' > "$backup_dir/postgres-roles-$latest_stamp-cluster.sql.gz"
printf 'older-full\n' > "$backup_dir/carbonet-$older_stamp-full.sql.gz"
printf 'older-roles\n' > "$backup_dir/postgres-roles-$older_stamp-cluster.sql.gz"
printf 'producer-partial\n' > "$backup_dir/carbonet-$partial_stamp-full.sql.gz.partial.777"
printf 'final-looking-partial\n' > "$backup_dir/carbonet-$partial_stamp-full.partial.999.sql.gz"
printf 'newer-day-partial\n' > "$backup_dir/carbonet-$newer_day_partial_stamp-full.partial.901.sql.gz"
printf 'final-looking-role-partial\n' > "$backup_dir/postgres-roles-$latest_stamp-cluster.partial.555.sql.gz"
printf 'stale\n' > "$backup_dir/stale-artifact.txt"
stale_schema_dir="$backup_dir/.schema-backup.OLD123"
fresh_schema_dir="$backup_dir/.schema-backup.NEW123"
mkdir -m 0700 -- "$stale_schema_dir" "$fresh_schema_dir"
printf 'schema\n' > "$stale_schema_dir/schema.dump"
printf 'history\n' > "$stale_schema_dir/flyway-history.dump"
printf 'manifest\n' > "$stale_schema_dir/migrations.manifest"
printf 'patch\n' > "$stale_schema_dir/migrations.patch"
printf '{}\n' > "$stale_schema_dir/restore-evidence.json"
printf 'active-schema\n' > "$fresh_schema_dir/schema.dump"
touch -d "$day_iso 12:00:00" \
  "$backup_dir/carbonet-$latest_stamp-full.sql.gz" \
  "$backup_dir/postgres-roles-$latest_stamp-cluster.sql.gz"
touch -d "$day_iso 11:00:00" \
  "$backup_dir/carbonet-$older_stamp-full.sql.gz" \
  "$backup_dir/postgres-roles-$older_stamp-cluster.sql.gz"
touch -d "$day_iso 13:00:00" \
  "$backup_dir/carbonet-$partial_stamp-full.sql.gz.partial.777" \
  "$backup_dir/carbonet-$partial_stamp-full.partial.999.sql.gz" \
  "$backup_dir/postgres-roles-$latest_stamp-cluster.partial.555.sql.gz"
touch -d "$partial_day_iso 13:00:00" \
  "$backup_dir/carbonet-$newer_day_partial_stamp-full.partial.901.sql.gz"
touch -d "$day_iso 10:00:00" "$backup_dir/stale-artifact.txt"
touch -d '3 days ago' "$stale_schema_dir"

output="$(run_isolated "$script")"
grep -Eq '^\[backup-retention\] keep=4 delete=7 stale_schema_dirs=1 reclaim_bytes=[0-9]+ dry_run=false$' <<< "$output"
test -f "$backup_dir/fresh-artifact.txt"
test -f "$backup_dir/carbonet-fresh.sql.gz.partial.888"
test -f "$backup_dir/carbonet-$latest_stamp-full.sql.gz"
test -f "$backup_dir/postgres-roles-$latest_stamp-cluster.sql.gz"
test ! -e "$backup_dir/carbonet-$older_stamp-full.sql.gz"
test ! -e "$backup_dir/postgres-roles-$older_stamp-cluster.sql.gz"
test ! -e "$backup_dir/carbonet-$partial_stamp-full.sql.gz.partial.777"
test ! -e "$backup_dir/carbonet-$partial_stamp-full.partial.999.sql.gz"
test ! -e "$backup_dir/carbonet-$newer_day_partial_stamp-full.partial.901.sql.gz"
test ! -e "$backup_dir/postgres-roles-$latest_stamp-cluster.partial.555.sql.gz"
test ! -e "$backup_dir/stale-artifact.txt"
test ! -e "$stale_schema_dir"
test -f "$fresh_schema_dir/schema.dump"
[[ "$(stat -c %u "$manifest_dir")" == "$uid" ]]
[[ "$(stat -c %a "$manifest_dir")" == 700 ]]
[[ "$(stat -c %d "$manifest_dir")" == "$(stat -c %d /opt)" ]]
[[ -z "$(find "$manifest_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]

echo "[backup-retention-test] PASS namespace=$namespace_mode keep=4 delete=7 staleSchemaDeleted=1 freshSchemaKept=1 unsafeSchemaRejected=1 partialFresh=1 partialOldDeleted=4 tmpdirMutant=1 unsafePathMutant=1 partialStartMutant=1 symlink=1 mode=1 owner=$([[ "$namespace_mode" == sudo ]] && echo 1 || echo static)"

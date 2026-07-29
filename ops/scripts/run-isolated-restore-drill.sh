#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${RESONANCE_RECOVERY_BACKUP_ROOT:-/opt/resonance-backups/postgresql/on-demand}"
DRILL_ROOT="${RESONANCE_RECOVERY_DRILL_ROOT:-/opt/resonance-backups/postgresql/restore-drill}"
IMAGE="${RESONANCE_RECOVERY_ARCHIVE_VERIFY_IMAGE:-localhost:5000/spilo-16-uid1000:3.2-p3}"
TIMEOUT="${RESONANCE_RECOVERY_DRILL_TIMEOUT:-75m}"

resolved_backup_root="$(readlink -f "$BACKUP_ROOT" 2>/dev/null || true)"
[[ "$resolved_backup_root" == /opt/resonance-backups/postgresql/on-demand ]] || {
  echo "[restore-drill] unsafe backup root" >&2
  exit 2
}
mkdir -p "$DRILL_ROOT/evidence"
resolved_drill_root="$(readlink -f "$DRILL_ROOT")"
[[ "$resolved_drill_root" == /opt/resonance-backups/postgresql/restore-drill ]] || {
  echo "[restore-drill] unsafe drill root" >&2
  exit 2
}
for command in docker jq sha256sum flock timeout; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "[restore-drill] missing command: $command" >&2
    exit 2
  }
done

exec 9>"$resolved_drill_root/.restore-drill.lock"
flock -n 9 || {
  echo "[restore-drill] another restore drill is running" >&2
  exit 4
}

latest="$(
  find "$resolved_backup_root" -maxdepth 1 -type f -name 'carbonet-*.dump' \
    -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-
)"
[[ -n "$latest" && -f "$latest" && -f "$latest.json" ]] || {
  echo "[restore-drill] verified backup is unavailable" >&2
  exit 5
}
expected="$(jq -r 'select(.verified == true) | .sha256' "$latest.json")"
actual="$(sha256sum "$latest" | awk '{print $1}')"
[[ "$expected" =~ ^[0-9a-f]{64}$ && "$expected" == "$actual" ]] || {
  echo "[restore-drill] backup checksum mismatch" >&2
  exit 6
}

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$(cat /proc/sys/kernel/random/uuid)"
run_dir="$resolved_drill_root/run-$run_id"
container_name="resonance-restore-drill-${run_id:0:15}"
mkdir -m 0777 "$run_dir"
cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  case "$run_dir" in
    "$resolved_drill_root"/run-*)
      docker run --rm --network none \
        -v "$run_dir:/drill:rw" \
        --entrypoint bash "$IMAGE" -lc 'rm -rf -- /drill/*' \
        >/dev/null 2>&1 || true
      rmdir -- "$run_dir" >/dev/null 2>&1 || true
      ;;
  esac
}
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull "$IMAGE" >/dev/null
started_at="$(date -u +%FT%TZ)"
started_epoch="$(date +%s)"
timeout "$TIMEOUT" docker run --rm --network none \
  --name "$container_name" \
  --user 101:103 \
  --cpus 4 \
  --memory 8g \
  --pids-limit 512 \
  -e HOME=/tmp \
  -v "$run_dir:/drill:rw" \
  -v "$latest:/backup.dump:ro" \
  --entrypoint bash \
  "$IMAGE" -lc '
    set -euo pipefail
    mkdir -p /drill/data /drill/socket
    /usr/lib/postgresql/16/bin/initdb -D /drill/data \
      --auth=trust --no-locale --encoding=UTF8 >/drill/initdb.log
    stop_database() {
      /usr/lib/postgresql/16/bin/pg_ctl -D /drill/data -m immediate stop \
        >/dev/null 2>&1 || true
    }
    trap stop_database EXIT
    /usr/lib/postgresql/16/bin/pg_ctl -D /drill/data \
      -o "-c listen_addresses= -c unix_socket_directories=/drill/socket -p 55432 -c max_connections=24 -c shared_buffers=256MB -c fsync=off -c synchronous_commit=off -c full_page_writes=off" \
      -w start >/drill/postgres-start.log
    /usr/lib/postgresql/16/bin/psql -h /drill/socket -p 55432 -d postgres \
      -v ON_ERROR_STOP=1 -c "create database restore_drill" >/dev/null
    /usr/lib/postgresql/16/bin/pg_restore -h /drill/socket -p 55432 -d restore_drill \
      --exit-on-error --no-owner --no-privileges --jobs=4 \
      /backup.dump > /drill/restore.log
    schema_count="$(/usr/lib/postgresql/16/bin/psql -h /drill/socket -p 55432 -d restore_drill -Atqc \
      "select count(*) from pg_namespace where nspname not like '"'"'pg_%'"'"' and nspname <> '"'"'information_schema'"'"'")"
    table_count="$(/usr/lib/postgresql/16/bin/psql -h /drill/socket -p 55432 -d restore_drill -Atqc \
      "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='"'"'r'"'"' and n.nspname not like '"'"'pg_%'"'"' and n.nspname <> '"'"'information_schema'"'"'")"
    trace_count="$(/usr/lib/postgresql/16/bin/psql -h /drill/socket -p 55432 -d restore_drill -Atqc \
      "select case when to_regclass('"'"'public.trace_event'"'"') is null then -1 else (select count(*) from public.trace_event) end")"
    asset_count="$(/usr/lib/postgresql/16/bin/psql -h /drill/socket -p 55432 -d restore_drill -Atqc \
      "select case when to_regclass('"'"'public.framework_unified_asset'"'"') is null then -1 else (select count(*) from public.framework_unified_asset) end")"
    [[ "$schema_count" -gt 0 && "$table_count" -gt 0 && "$trace_count" -gt 0 && "$asset_count" -gt 0 ]]
    printf "%s\t%s\t%s\t%s\n" \
      "$schema_count" "$table_count" "$trace_count" "$asset_count" \
      > /drill/result.tsv
    /usr/lib/postgresql/16/bin/pg_ctl -D /drill/data -m fast -w stop >/dev/null
    trap - EXIT
  '

IFS=$'\t' read -r schema_count table_count trace_count asset_count <"$run_dir/result.tsv"
finished_at="$(date -u +%FT%TZ)"
duration_seconds="$(( $(date +%s) - started_epoch ))"
evidence="$resolved_drill_root/evidence/restore-drill-$run_id.json"
jq -n \
  --arg runId "$run_id" \
  --arg backupFile "$(basename "$latest")" \
  --arg backupSha256 "$actual" \
  --arg image "$IMAGE" \
  --arg startedAt "$started_at" \
  --arg finishedAt "$finished_at" \
  --argjson durationSeconds "$duration_seconds" \
  --argjson schemaCount "$schema_count" \
  --argjson tableCount "$table_count" \
  --argjson traceEventCount "$trace_count" \
  --argjson unifiedAssetCount "$asset_count" \
  '{
    status:"VERIFIED",
    isolation:"docker-network-none",
    runId:$runId,
    backupFile:$backupFile,
    backupSha256:$backupSha256,
    image:$image,
    startedAt:$startedAt,
    finishedAt:$finishedAt,
    durationSeconds:$durationSeconds,
    checks:{
      schemaCount:$schemaCount,
      tableCount:$tableCount,
      traceEventCount:$traceEventCount,
      unifiedAssetCount:$unifiedAssetCount
    }
  }' >"$evidence"

find "$resolved_drill_root/evidence" -maxdepth 1 -type f \
  -name 'restore-drill-*.json' -printf '%T@ %p\n' \
  | sort -nr | awk 'NR > 30 { sub(/^[^ ]+ /, ""); print }' \
  | while IFS= read -r old_evidence; do
      [[ "$old_evidence" == "$resolved_drill_root"/evidence/restore-drill-*.json ]] || exit 3
      rm -f -- "$old_evidence"
    done

cat "$evidence"

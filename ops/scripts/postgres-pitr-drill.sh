#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/Resonance
BASE_DIR="$ROOT/var/postgres-basebackups"
WAL_DIR="$ROOT/var/postgres-patroni-wal-archive"
DRILL_ROOT="$ROOT/var/restore-drills"
REPORT_DIR="$DRILL_ROOT/reports"
IMAGE=127.0.0.1:5000/spilo-16-uid1000:3.2-p3
NS=carbonet-prod
id="pitr-$(date +%Y%m%d_%H%M%S)"
work="$DRILL_ROOT/$id"
data="$work/data"
container="carbonet-$id"
mkdir -p "$REPORT_DIR" "$work"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  if [ "${KEEP_DRILL_DATA:-0}" != 1 ]; then rm -rf "$work"; fi
}
trap cleanup EXIT

latest=$(find "$BASE_DIR" -maxdepth 1 -type f -name 'carbonet_base_*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
test -n "$latest"
(cd "$BASE_DIR" && sha256sum -c "$(basename "$latest").sha256")

# Produce and archive a closed WAL segment so the recovery target is deterministic.
target_lsn=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT pg_current_wal_lsn()")
kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT pg_switch_wal()" >/dev/null
for _ in $(seq 1 60); do
  failed=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT failed_count FROM pg_stat_archiver")
  archived=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT COALESCE(last_archived_wal,'') FROM pg_stat_archiver")
  [ -n "$archived" ] && break
  sleep 2
done

mkdir -p "$data"
tar -xzf "$latest" -C "$data" --strip-components=1
rm -f "$data/postmaster.pid" "$data/standby.signal"
cat > "$data/pg_hba.drill.conf" <<'EOF'
local all all trust
EOF
touch "$data/pg_ident.drill.conf"
cat >> "$data/postgresql.auto.conf" <<EOF
restore_command = 'cp /wal-archive/%f %p'
recovery_target_lsn = '$target_lsn'
recovery_target_action = 'promote'
archive_mode = 'off'
listen_addresses = ''
port = 5432
hba_file = '/drill-data/pg_hba.drill.conf'
ident_file = '/drill-data/pg_ident.drill.conf'
EOF
touch "$data/recovery.signal"
chmod 700 "$data"

docker run -d --name "$container" --network none --user 1000:1000 \
  -v "$data:/drill-data" -v "$WAL_DIR:/wal-archive:ro" \
  "$IMAGE" /usr/lib/postgresql/16/bin/postgres -D /drill-data > /dev/null

ready=0
for _ in $(seq 1 120); do
  if docker exec "$container" psql -h /tmp -U postgres -d carbonet -Atqc "SELECT 1" >/dev/null 2>&1; then ready=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != true ]; then break; fi
  sleep 2
done

log="$REPORT_DIR/$id.log"
docker logs "$container" > "$log" 2>&1 || true
if [ "$ready" != 1 ]; then
  echo "PITR drill failed; see $log" >&2
  exit 1
fi

query="SELECT json_build_object('database',current_database(),'recovery',pg_is_in_recovery(),'lsn',pg_current_wal_lsn()::text,'menus',(SELECT count(*) FROM comtnmenuinfo),'flyway_history_tables',(SELECT count(*) FROM information_schema.tables WHERE table_name LIKE '%flyway_schema_history'),'liquibase_history_tables',(SELECT count(*) FROM information_schema.tables WHERE table_name LIKE '%databasechangelog' AND table_name NOT LIKE '%lock'));"
result=$(docker exec "$container" psql -h /tmp -U postgres -d carbonet -Atqc "$query")
cat > "$REPORT_DIR/$id.json" <<EOF
{"id":"$id","status":"success","base":"$(basename "$latest")","target_lsn":"$target_lsn","last_archived_wal":"$archived","archiver_failed_count":$failed,"result":$result,"verified_at":"$(date -Iseconds)"}
EOF
ln -sfn "$id.json" "$REPORT_DIR/latest.json"
echo "$REPORT_DIR/$id.json"
cat "$REPORT_DIR/$id.json"

#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/opt/Resonance
OUT="$ROOT/var/release-snapshots"
NS=carbonet-prod
mkdir -p "$OUT"
ts=$(date +%Y%m%d_%H%M%S)

export SNAPSHOT_ID="release-$ts"
export CREATED_AT=$(date -Iseconds)
export GIT_HEAD=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
export GIT_DIRTY=$(test -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" && echo true || echo false)
export APP_IMAGE=$(kubectl -n "$NS" get deployment carbonet-runtime -o jsonpath='{.spec.template.spec.containers[0].image}')
export APP_IMAGE_ID=$(kubectl -n "$NS" get pod -l app=carbonet-runtime -o jsonpath='{.items[0].status.containerStatuses[0].imageID}' 2>/dev/null || true)
export DB_TIMELINE=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT timeline_id FROM pg_control_checkpoint()" 2>/dev/null || echo unknown)
export DB_LSN=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT pg_current_wal_lsn()" 2>/dev/null || echo unknown)
export MENU_COUNT=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT count(*) FROM comtnmenuinfo" 2>/dev/null || echo unknown)
export MIGRATION_TABLES=$(kubectl -n "$NS" exec postgres-patroni-0 -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -Atqc "SELECT COALESCE(string_agg(table_schema||'.'||table_name,','),'') FROM information_schema.tables WHERE lower(table_name) LIKE '%flyway_schema_history' OR lower(table_name) LIKE '%databasechangelog'" 2>/dev/null || true)
export BASE_BACKUP=$(find "$ROOT/var/postgres-basebackups" -maxdepth 1 -type f -name 'carbonet_base_*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
export DAILY_BACKUP=$(find "$ROOT/var/postgres-backups/daily" -maxdepth 1 -type f -name 'carbonet_*.dump' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
export PITR_REPORT=$(readlink -f "$ROOT/var/restore-drills/reports/latest.json" 2>/dev/null || true)
test -n "$BASE_BACKUP" -a -n "$DAILY_BACKUP" -a -n "$PITR_REPORT"
export BASE_SHA=$(sha256sum "$BASE_BACKUP" | awk '{print $1}')
export DAILY_SHA=$(sha256sum "$DAILY_BACKUP" | awk '{print $1}')

ln -sfn "$(basename "$BASE_BACKUP")" "$ROOT/var/postgres-basebackups/latest.tar.gz"
ln -sfn "$(basename "$BASE_BACKUP").sha256" "$ROOT/var/postgres-basebackups/latest.tar.gz.sha256"
ln -sfn "$(basename "$DAILY_BACKUP")" "$ROOT/var/postgres-backups/daily/latest.dump"
ln -sfn "$(basename "$DAILY_BACKUP").sha256" "$ROOT/var/postgres-backups/daily/latest.dump.sha256"

python3 - "$OUT/$SNAPSHOT_ID.json" <<'PY'
import json, os, pathlib, sys
def name(key):
    value = os.environ.get(key, "")
    return pathlib.Path(value).name if value else ""
data = {
  "snapshot_id": os.environ["SNAPSHOT_ID"],
  "created_at": os.environ["CREATED_AT"],
  "source": {"git_head": os.environ["GIT_HEAD"], "git_dirty": os.environ["GIT_DIRTY"] == "true"},
  "runtime": {"image": os.environ["APP_IMAGE"], "image_id": os.environ.get("APP_IMAGE_ID", "")},
  "database": {"timeline": os.environ["DB_TIMELINE"], "lsn": os.environ["DB_LSN"], "menu_count": os.environ["MENU_COUNT"], "migration_tables": os.environ.get("MIGRATION_TABLES", "")},
  "recovery": {
    "base_backup": name("BASE_BACKUP"), "base_sha256": os.environ["BASE_SHA"],
    "daily_backup": name("DAILY_BACKUP"), "daily_sha256": os.environ["DAILY_SHA"],
    "latest_pitr_report": name("PITR_REPORT")
  }
}
path = pathlib.Path(sys.argv[1])
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
(cd "$OUT" && sha256sum "$SNAPSHOT_ID.json" > "$SNAPSHOT_ID.json.sha256")
ln -sfn "$SNAPSHOT_ID.json" "$OUT/latest.json"
find "$OUT" -maxdepth 1 -type f -name 'release-*.json*' -mtime +90 -delete
echo "$OUT/$SNAPSHOT_ID.json"

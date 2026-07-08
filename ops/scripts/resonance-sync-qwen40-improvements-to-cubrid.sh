#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# 이 스크립트는 resonance-sync-qwen40-improvements-to-postgresql.sh 로 교체 예정
set -euo pipefail

echo "[DEPRECATED] 이 스크립트는 CUBRID 제거로 더 이상 사용되지 않습니다."
echo "PostgreSQL 사용: resonance-sync-qwen40-improvements-to-postgresql.sh 또는"
echo "  kubectl exec postgres-patroni-0 -n carbonet-prod -- psql -U postgres -d carbonet -f /tmp/..."
exit 1

# --- 원본 은/Reference Only (아래는 실제 실행 불가) ---
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD="${POSTGRES_POD:-postgres-patroni-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-postgres}"
SOURCE_FILE="${SOURCE_FILE:-$ROOT_DIR/var/ai-runtime/qwen40-improvement-suggestions.jsonl}"
INCIDENT_SUMMARY_JSON="${INCIDENT_SUMMARY_JSON:-$ROOT_DIR/var/ai-runtime/incident-patterns-summary.json}"
STATE_FILE="${STATE_FILE:-$ROOT_DIR/var/run/qwen40-improvement-db-sync.offset}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/db-sync}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/qwen40-improvement-db-sync-events.jsonl}"
mkdir -p "$OUT_DIR" "$(dirname "$STATE_FILE")" "$(dirname "$EVENT_LOG")"

log_event() {
  local status="$1" code="$2" message="$3"
  python3 - "$EVENT_LOG" "$status" "$code" "$message" <<'PY'
import datetime,json,pathlib,sys
path=pathlib.Path(sys.argv[1])
event={"ts":datetime.datetime.now(datetime.timezone.utc).isoformat(),"script":"resonance-sync-qwen40-improvements-to-postgresql","status":sys.argv[2],"code":sys.argv[3],"message":sys.argv[4]}
with path.open("a",encoding="utf-8") as f: f.write(json.dumps(event,ensure_ascii=False)+"\n")
PY
}

SOURCE_AVAILABLE=true
if [[ ! -s "$SOURCE_FILE" ]]; then
  SOURCE_AVAILABLE=false
  log_event SKIP SOURCE_EMPTY "$SOURCE_FILE is empty or missing"
fi

kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$POD" --timeout=30s >/dev/null

SCHEMA_SQL="$OUT_DIR/qwen40-improvement-schema.sql"
cat > "$SCHEMA_SQL" <<'SQL'
CREATE TABLE IF NOT EXISTS AI_IMPROVEMENT_LOG (
  LOG_ID VARCHAR(40) NOT NULL,
  TS VARCHAR(80),
  STATUS VARCHAR(30),
  CODE VARCHAR(120),
  MESSAGE VARCHAR(1200),
  ANSWER VARCHAR(16000),
  RAW_JSON VARCHAR(16000),
  SOURCE_FILE VARCHAR(400),
  CREATED_AT VARCHAR(80),
  PRIMARY KEY (LOG_ID)
);
CREATE TABLE IF NOT EXISTS AI_INCIDENT_PATTERN_LOG (
  PATTERN_CODE VARCHAR(120) NOT NULL,
  SEVERITY VARCHAR(30),
  PATTERN_COUNT INTEGER,
  FIRST_SEEN VARCHAR(80),
  LAST_SEEN VARCHAR(80),
  REPAIR VARCHAR(1200),
  LATEST_SAMPLE VARCHAR(16000),
  SOURCE_FILE VARCHAR(400),
  UPDATED_AT VARCHAR(80),
  RAW_JSON VARCHAR(16000),
  PRIMARY KEY (PATTERN_CODE)
);
SQL
kubectl -n "$NAMESPACE" cp "$SCHEMA_SQL" "$POD:/tmp/qwen40-improvement-schema.sql" >/dev/null
kubectl -n "$NAMESPACE" exec "$POD" -- bash -lc "psql -U '$DB_USER' -d '$DB_NAME' -f /tmp/qwen40-improvement-schema.sql >/tmp/qwen40-improvement-schema.out 2>&1 || true"

sync_incident_patterns() {
  if [[ ! -s "$INCIDENT_SUMMARY_JSON" ]]; then
    log_event SKIP INCIDENT_SUMMARY_EMPTY "$INCIDENT_SUMMARY_JSON is empty or missing"
    return 0
  fi
  local incident_sql row_count
  incident_sql="$OUT_DIR/incident-pattern-upsert-$(date +%Y%m%d-%H%M%S).sql"
  python3 - "$INCIDENT_SUMMARY_JSON" "$incident_sql" <<'PY'
import datetime, json, pathlib, sys
source=pathlib.Path(sys.argv[1])
out=pathlib.Path(sys.argv[2])

def clamp(value, limit):
    if value is None:
        return ""
    return str(value).replace("\r","").replace("\n","\\n")[:limit]

def sql(value, limit):
    return "'" + clamp(value, limit).replace("'", "''") + "'"

payload=json.loads(source.read_text(encoding="utf-8", errors="replace"))
items=payload.get("items") or []
updated=datetime.datetime.now(datetime.timezone.utc).isoformat()
with out.open("w", encoding="utf-8") as f:
    for item in items:
        raw=json.dumps(item, ensure_ascii=False)
        code=item.get("code") or "UNKNOWN"
        f.write(f"DELETE FROM AI_INCIDENT_PATTERN_LOG WHERE PATTERN_CODE = {sql(code,120)};\n")
        f.write("INSERT INTO AI_INCIDENT_PATTERN_LOG (PATTERN_CODE, SEVERITY, PATTERN_COUNT, FIRST_SEEN, LAST_SEEN, REPAIR, LATEST_SAMPLE, SOURCE_FILE, UPDATED_AT, RAW_JSON) VALUES (")
        f.write(", ".join([
            sql(code,120),
            sql(item.get("severity",""),30),
            str(int(item.get("count") or 0)),
            sql(item.get("firstSeen",""),80),
            sql(item.get("lastSeen",""),80),
            sql(item.get("repair",""),1200),
            sql(item.get("latestSample",""),16000),
            sql(str(source),400),
            sql(updated,80),
            sql(raw,16000),
        ]))
        f.write(");\n")
    f.write("COMMIT;\n")
print(len(items))
PY
  row_count="$(grep -c '^INSERT INTO AI_INCIDENT_PATTERN_LOG' "$incident_sql" || true)"
  if [[ "$row_count" != "0" ]]; then
    kubectl -n "$NAMESPACE" cp "$incident_sql" "$POD:/tmp/incident-pattern-upsert.sql" >/dev/null
    kubectl -n "$NAMESPACE" exec "$POD" -- bash -lc "psql -U '$DB_USER' -d '$DB_NAME' -f /tmp/incident-pattern-upsert.sql >/tmp/incident-pattern-upsert.out 2>&1"
  fi
  log_event OK INCIDENT_PATTERNS_SYNCED "synced rows=$row_count table=AI_INCIDENT_PATTERN_LOG db=$DB_NAME"
}

if [[ "$SOURCE_AVAILABLE" != "true" ]]; then
  sync_incident_patterns
  exit 0
fi

TOTAL_LINES="$(wc -l < "$SOURCE_FILE" | tr -d ' ')"
LAST_SYNCED="0"
[[ -f "$STATE_FILE" ]] && LAST_SYNCED="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"
[[ "$LAST_SYNCED" =~ ^[0-9]+$ ]] || LAST_SYNCED=0
if (( TOTAL_LINES <= LAST_SYNCED )); then
  log_event OK NO_NEW_ROWS "source lines=$TOTAL_LINES already synced=$LAST_SYNCED"
  sync_incident_patterns
  exit 0
fi

SQL_FILE="$OUT_DIR/qwen40-improvement-insert-$(date +%Y%m%d-%H%M%S).sql"
python3 - "$SOURCE_FILE" "$LAST_SYNCED" "$SQL_FILE" <<'PY'
import datetime, hashlib, json, pathlib, sys
source=pathlib.Path(sys.argv[1])
last=int(sys.argv[2])
out=pathlib.Path(sys.argv[3])

def clamp(value, limit):
    if value is None:
        return ""
    text=str(value).replace("\r", "").replace("\n", "\\n")
    return text[:limit]

def sql(value, limit):
    return "'" + clamp(value, limit).replace("'", "''") + "'"

lines=source.read_text(encoding='utf-8', errors='replace').splitlines()
rows=[]
for index, line in enumerate(lines[last:], start=last+1):
    if not line.strip():
        continue
    try:
        event=json.loads(line)
    except Exception:
        event={"status":"WARN","code":"RAW_LINE","message":"unparsed jsonl line","answer":"","raw":line}
    raw=json.dumps(event, ensure_ascii=False)
    key=hashlib.sha1((str(event.get('ts',''))+'|'+str(event.get('code',''))+'|'+raw).encode('utf-8')).hexdigest()[:40]
    rows.append({
        'LOG_ID': key,
        'TS': event.get('ts',''),
        'STATUS': event.get('status',''),
        'CODE': event.get('code',''),
        'MESSAGE': event.get('message',''),
        'ANSWER': event.get('answer',''),
        'RAW_JSON': raw,
        'SOURCE_FILE': str(source),
        'CREATED_AT': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
with out.open('w', encoding='utf-8') as f:
    for row in rows:
        f.write(f"DELETE FROM AI_IMPROVEMENT_LOG WHERE LOG_ID = {sql(row['LOG_ID'],40)};\n")
        f.write("INSERT INTO AI_IMPROVEMENT_LOG (LOG_ID, TS, STATUS, CODE, MESSAGE, ANSWER, RAW_JSON, SOURCE_FILE, CREATED_AT) VALUES (")
        f.write(", ".join([
            sql(row['LOG_ID'],40), sql(row['TS'],80), sql(row['STATUS'],30), sql(row['CODE'],120),
            sql(row['MESSAGE'],1200), sql(row['ANSWER'],16000), sql(row['RAW_JSON'],16000),
            sql(row['SOURCE_FILE'],400), sql(row['CREATED_AT'],80)
        ]))
        f.write(");\n")
    f.write("COMMIT;\n")
print(len(rows))
PY
ROW_COUNT="$(grep -c '^INSERT INTO AI_IMPROVEMENT_LOG' "$SQL_FILE" || true)"
if [[ "$ROW_COUNT" == "0" ]]; then
  echo "$TOTAL_LINES" > "$STATE_FILE"
  log_event OK NO_INSERTABLE_ROWS "advanced offset to $TOTAL_LINES"
  exit 0
fi
kubectl -n "$NAMESPACE" cp "$SQL_FILE" "$POD:/tmp/qwen40-improvement-insert.sql" >/dev/null
kubectl -n "$NAMESPACE" exec "$POD" -- bash -lc "psql -U '$DB_USER' -d '$DB_NAME' -f /tmp/qwen40-improvement-insert.sql >/tmp/qwen40-improvement-insert.out 2>&1"
echo "$TOTAL_LINES" > "$STATE_FILE"
log_event OK SYNCED "synced rows=$ROW_COUNT offset=$TOTAL_LINES table=AI_IMPROVEMENT_LOG db=$DB_NAME"
sync_incident_patterns
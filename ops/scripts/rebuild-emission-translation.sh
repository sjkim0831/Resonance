# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] rebuild-emission-translation.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
# rebuild-emission-translation.sh - Rebuild emission_material_translation table from CSV
# Usage: bash ops/scripts/rebuild-emission-translation.sh [csv_file]

set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="${DB_NAME:-carbonet}"
CSV_FILE="${1:-/home/sjkim/Downloads/_emission_material_translation__202606172021.csv}"

echo "[INFO] Rebuilding emission_material_translation table..."
echo "[INFO] CSV: ${CSV_FILE}"

exec_in_pod() {
    kubectl exec -n ${NAMESPACE} ${POD_NAME} -- bash -c "$*" 2>&1
}

# Drop existing table
echo "[STEP] Dropping existing table..."
exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c 'DROP TABLE emission_material_translation;' ${DB_NAME}@localhost" 2>&1 | grep -E "OK|error" || true

# Create new table with 12 columns
echo "[STEP] Creating table with 12 columns..."
exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c \"
CREATE TABLE emission_material_translation (
    raw_name VARCHAR(500) PRIMARY KEY,
    english_name VARCHAR(1000) NOT NULL,
    source_type VARCHAR(40),
    frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME,
    last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME,
    korean_name VARCHAR(1000),
    english_exact_name VARCHAR(1000),
    ecoinvent_master_id INTEGER,
    mapping_status VARCHAR(50),
    mapping_note VARCHAR(2000),
    shadow_translation_json VARCHAR(4000),
    shadow_translation_status VARCHAR(50)
);\" ${DB_NAME}@localhost" 2>&1 | grep -E "OK|error" || true

# Copy CSV to pod
echo "[STEP] Copying CSV to pod..."
kubectl cp "${CSV_FILE}" "${NAMESPACE}/${POD_NAME}:/tmp/emission_material_translation.csv"

# Create import script
echo "[STEP] Creating import script..."
exec_in_pod "cat > /tmp/import.py << 'PYEOF'
import csv
import subprocess
from datetime import datetime

CSV_FILE = '/tmp/emission_material_translation.csv'
DB = 'carbonet@localhost'
SQL_FILE = '/tmp/insert.sql'
BATCH = 200

def dv(val):
    if val is None or val.strip() == '':
        return 'DEFAULT'
    val = val.strip().replace(\"'\", \"''\")
    return \"'\" + val + \"'\"

def di(val):
    if val is None or val.strip() == '':
        return 'DEFAULT'
    try:
        return str(int(float(val.strip())))
    except:
        return 'DEFAULT'

def dt(val):
    if not val or val.strip() == '':
        return 'DEFAULT'
    val = val.strip()
    for fmt in ['%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S']:
        try:
            d = datetime.strptime(val, fmt)
            return \"'\" + d.strftime('%m/%d/%Y %H:%M:%S') + \"'\"
        except:
            pass
    return 'DEFAULT'

count = 0
err = 0

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    total = len(rows)
    print('Total rows: %d' % total)

buf = []
for r in rows:
    rn = dv(r.get('raw_name', ''))
    en = dv(r.get('english_name', ''))
    st = dv(r.get('source_type', ''))
    fr = dt(r.get('frst_regist_pnttm', ''))
    lu = dt(r.get('last_updt_pnttm', ''))
    kn = dv(r.get('korean_name', ''))
    ee = dv(r.get('english_exact_name', ''))
    ei = di(r.get('ecoinvent_master_id', ''))
    ms = dv(r.get('mapping_status', ''))
    mn = dv(r.get('mapping_note', ''))
    sj = dv(r.get('shadow_translation_json', ''))
    ss = dv(r.get('shadow_translation_status', ''))
    if rn == 'DEFAULT':
        continue
    buf.append('INSERT INTO emission_material_translation VALUES (%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s,%%s);' %% (rn, en, st, fr, lu, kn, ee, ei, ms, mn, sj, ss))
    if len(buf) >= BATCH:
        with open(SQL_FILE, 'w') as f:
            f.write('\n'.join(buf))
        rc = subprocess.call('csql -C -u dba -p \"\" %s < %s' %% (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if rc == 0:
            count += len(buf)
            print('Progress: %d/%d' %% (count, total))
        else:
            err += len(buf)
        buf = []

if buf:
    with open(SQL_FILE, 'w') as f:
        f.write('\n'.join(buf))
    rc = subprocess.call('csql -C -u dba -p \"\" %s < %s' %% (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if rc == 0:
        count += len(buf)
    else:
        err += len(buf)

print('Done: %d rows imported, %d errors' %% (count, err))
PYEOF"

# Run import
echo "[STEP] Importing data..."
exec_in_pod "source /home/cubrid/.cubrid.sh && python3 /tmp/import.py"

# Verify
echo "[STEP] Verifying..."
exec_in_pod "source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c 'SELECT COUNT(*) FROM emission_material_translation;' ${DB_NAME}@localhost" 2>&1 | grep -A2 "count"

echo "[OK] Complete!"

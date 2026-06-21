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
    val = val.strip().replace("'", "''")
    return "'" + val + "'"

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
            return "'" + d.strftime('%m/%d/%Y %H:%M:%S') + "'"
        except:
            pass
    return 'DEFAULT'

count = 0
err = 0
total = 0

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    total = len(rows)
    print('Total rows: %d' % total)

buf = []
for i, r in enumerate(rows):
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

    sql = "INSERT INTO emission_material_translation VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);" % (rn, en, st, fr, lu, kn, ee, ei, ms, mn, sj, ss)
    buf.append(sql)

    if len(buf) >= BATCH:
        with open(SQL_FILE, 'w') as f:
            f.write('\n'.join(buf))
        rc = subprocess.call('csql -C -u dba -p "" %s < %s' % (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if rc == 0:
            count += len(buf)
            print('Done: %d/%d' % (count, total))
        else:
            err += len(buf)
        buf = []

if buf:
    with open(SQL_FILE, 'w') as f:
        f.write('\n'.join(buf))
    rc = subprocess.call('csql -C -u dba -p "" %s < %s' % (DB, SQL_FILE), shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if rc == 0:
        count += len(buf)
    else:
        err += len(buf)

print('Import done: %d rows, %d errors' % (count, err))

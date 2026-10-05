import json,hashlib,sys
from pathlib import Path
from psycopg2.extras import Json
from service import connect,rows
root=Path('/opt/Resonance/projects/P006/frontend');base=Path(__file__).parent
catalog=json.loads((root/'catalog-expansion700/independent-catalog.json').read_text())['assets'];entries=json.loads((root/'entry-catalog/entries.json').read_text());mapping=json.loads((root/'equipment-asset-mapping/mapping.json').read_text());em={x['id']:x for x in entries}
assert len(catalog)==724 and len(em)==666 and len(mapping['equipment'])==16
with connect() as c:
 rows(c,'select pg_advisory_xact_lock(60620260910)');rows(c,(base/'schema.sql').read_text())
 for r in mapping['equipment']:
  rows(c,'insert into equipment_type(code,name,english_name,role,legacy_mapping) values(%s,%s,%s,%s,%s) on conflict(code) do nothing',(r['code'],r['equipmentName'],r['english'],r['role'],Json(r)))
 for r in catalog:
  e=em.get(r['id'],{});payload={'catalog':r,'entry':e};sha=hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
  old=rows(c,'select seed_hash from asset where id=%s',(r['id'],))
  if old:
   assert old[0]['seed_hash']==sha,'SEED_DRIFT_REQUIRES_REVIEW '+r['id'];continue
  rows(c,'insert into asset(id,name,english_name,category,purpose,entry_usd,source_usd,base_usd,variant,image,model_xyz_m,metadata,seed_hash) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(r['id'],r['name'],e.get('englishName',r.get('englishName')),e.get('category',r.get('domain')),r['purpose'],e.get('entryPath'),e.get('sourceUsd'),e.get('basePath'),Json(e.get('variantInfo',{})),'/projects/P006/assets/visual-catalog/images/'+r['id']+'.png' if e else None,Json(e.get('dimensions')),Json(payload),sha))
 print(json.dumps({'asset':rows(c,'select count(*) n,count(entry_usd) connected from asset')[0],'types':rows(c,'select count(*) n from equipment_type')[0],'customers':rows(c,'select count(*) n from customer')[0],'instances':rows(c,'select count(*) n from equipment_instance')[0]},default=str))

import json,sys,hashlib,time
from pathlib import Path
from pxr import Usd,UsdGeom
t=time.time();d=json.loads(Path(sys.argv[1]).read_text());ids=sorted({x['id'] for r in d['rows'] if not r['currentUsd'] and r['method'] in ['MODIFY','COMPOSE'] for x in r['donors']});rows=[]
for aid in ids:
 r=next(x for x in d['rows'] if x['id']==aid);p=Path(r['currentUsd']);s=Usd.Stage.Open(str(p));g=[]
 for prim in s.Traverse():
  if prim.IsA(UsdGeom.Gprim):g.append({'path':str(prim.GetPath()),'type':prim.GetTypeName()})
 rows.append({'id':aid,'path':str(p),'hash':hashlib.sha256(p.read_bytes()).hexdigest(),'composed':not s.GetCompositionErrors(),'geometry':g,'unit':UsdGeom.GetStageMetersPerUnit(s),'upAxis':str(UsdGeom.GetStageUpAxis(s))})
Path(sys.argv[2]).write_text(json.dumps({'rows':rows,'seconds':time.time()-t},indent=2));print(json.dumps({r['id']:r['geometry'][:12] for r in rows if r['id'] in ['E073','E096','E197','E225','E244','E240','E245','E188','E097','E232','E239','E033','E032']}))

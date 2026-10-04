import sys,json,hashlib,zipfile,tempfile,time
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade
r=Path(sys.argv[1]);t=time.time();b=json.loads((r/'build-evidence.json').read_text());checks=[]
for name,h in b['hashes'].items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==h
checks.append('all USD hashes match build evidence')
s=Usd.Stage.Open(str(r/'catalog-configurations.usda'));bindings=0
for p in s.Traverse():
 if p.IsA(UsdGeom.Gprim):
  m,_=UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial();assert m and m.GetPrim().IsValid(),str(p.GetPath());bindings+=1
checks.append('all '+str(bindings)+' geometric prims have resolvable materials')
z=r/'p006-reference-assemblies.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as f:
 for name in b['hashes']:f.write(r/name,name)
 f.write(r/'build-evidence.json','build-evidence.json')
with tempfile.TemporaryDirectory(prefix='p006-usd-package-') as d:
 with zipfile.ZipFile(z) as f:f.extractall(d)
 s=Usd.Stage.Open(str(Path(d)/'layout-all.usda'));assert s and not s.GetCompositionErrors()
 for a in b['assets']:
  p=s.GetPrimAtPath('/Scene/Placements/'+a['id']+'/Model');assert p and p.GetAttribute('catalog:id').Get()==a['id']
  assert abs(UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox().GetMin()[1])<1e-5
 checks.append('portable ZIP reopens all '+str(len(b['assets']))+' unique IDs with floor origin preserved')
result={'checks':checks,'assets':len(b['assets']),'materials':bindings,'seconds':time.time()-t,'zipBytes':z.stat().st_size,'usdBytes':sum((r/n).stat().st_size for n in b['hashes']),'packageHash':hashlib.sha256(z.read_bytes()).hexdigest(),'readyPromotions':0,'real':0}
(r/'package-evidence.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

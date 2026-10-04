"""Evidence-bound reference geometry qualification. Never edits USD or PLC."""
import json,hashlib,time,sys,copy,html
from pathlib import Path
from pxr import Usd,UsdGeom
start=time.time(); out=Path(sys.argv[1]); out.mkdir(exist_ok=True,parents=True)
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(name,obj):(out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf8')
root=Path('/home/sjkim/OmniverseProjects'); ref=root/'p006-reference-factory-v1'
baseline=read(out/'resolver-before.json'); report=read(out/'report-before.json'); design=read(ref/'design.json'); visual=read(out/'visual-review.json')
updated=copy.deepcopy(baseline); changes=[]; decisions=[]; evidence=[]
protected={str(p):sha(p) for p in ref.glob('*.usda')}
expected={x['id']:x for x in design['core']}
stamp=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
assert sha(ref/'design.json')==visual['basisHash']
assert sha(ref/'factory.usda')==visual['layoutSha256']
def box(s,p):return UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox()
def qualify(checks):return bool(checks) and all(v is True for v in checks.values())
for r in updated:
 if r['status']!='RESOLVED':continue
 path=Path(r['path'])
 if path.name=='control-configurations.usda' and r['primPath']=='/Catalog':
  protected[str(path)]=sha(path);s=Usd.Stage.Open(str(path));p=s.GetPrimAtPath('/Catalog/'+r['id']);bb=box(s,p)
  checks={'identity':p.GetAttribute('catalog:id').Get()==r['id'],'dimensions':max(abs(a-b) for a,b in zip(bb.GetSize(),r['referenceDimensions']))<1e-6,'unit':UsdGeom.GetStageMetersPerUnit(s)==1,'up':str(UsdGeom.GetStageUpAxis(s))=='Y','bottom':abs(bb.GetMin()[1])<1e-6,'composition':not s.GetCompositionErrors()}
  assert qualify(checks),(r['id'],checks)
  changes.append({'id':r['id'],'before':'/Catalog','after':str(p.GetPath()),'checks':checks,'sourceSha256':sha(path),'dimensions':list(bb.GetSize())})
  r['primPath']=str(p.GetPath())
  decisions.append({'id':r['id'],'name':r['name'],'category':'PLACEMENT_COORDINATE','cause':'Resolver references aggregate Catalog, not asset-specific child. Not a scale or variant modelling error.','action':'FIXED_REFERENCE_TARGET','evidence':checks})
assert len(changes)==20
for r in baseline:
 if r['id'] not in ['E001','E002','E003','E004','E005','E006']:continue
 s=Usd.Stage.Open(r['path']);p=s.GetPrimAtPath(r['primPath']);bb=box(s,p);up=str(UsdGeom.GetStageUpAxis(s));axis={'X':0,'Y':1,'Z':2}[up];unit=UsdGeom.GetStageMetersPerUnit(s)
 datum=UsdGeom.XformCache().GetLocalToWorldTransform(p).ExtractTranslation()[axis]
 offset=(bb.GetMin()[axis]-datum)*unit
 decisions.append({'id':r['id'],'name':r['name'],'category':'DESIGN_BASIS_INSUFFICIENT','observed':'PLACEMENT_COORDINATE_OFFSET','offsetMeters':offset,'unit':unit,'upAxis':up,'action':'RETAIN_UNCHANGED','cause':'Bounds lowest point differs from root, but support plane versus pit/underground component is unproven. Translating by bbox minimum would invent a mounting datum.'})
parts={
 'foundation':['surface'],'aisle':['surface'],'wall':['wall'],
 'door':['post0','post1','header','leaf','handle'],
 'fence':['post0','post1','header']+['bar'+str(i) for i in range(11)],
 'workbench':['leg'+str(i) for i in range(4)]+['shelf0'],
 'inspection':['leg'+str(i) for i in range(4)]+['shelf0'],
 'rack':['leg'+str(i) for i in range(4)]+['shelf'+str(i) for i in range(4)],
 'gravity':['leg'+str(i) for i in range(4)]+['rail0','rail1']+['roller'+str(i) for i in range(50)],
 'scrap':['bottom','end0','end1','side0','side1']}
for aid,spec in expected.items():
 r=next(x for x in baseline if x['id']==aid);s=Usd.Stage.Open(r['path']);p=s.GetPrimAtPath(r['primPath']);bb=box(s,p);base=ref/('base-'+spec['family']+'.usda')
 used={l.realPath:sha(l.realPath) for l in s.GetUsedLayers() if l.realPath};protected.update(used)
 checks={'composition':not s.GetCompositionErrors(),'kind':p.GetAttribute('readiness:equipmentType').Get()==spec['role'],'identity':p.GetAttribute('catalog:id').Get()==aid,'coreParts':set(c.GetName() for c in s.GetPrimAtPath('/Asset/Geometry').GetChildren())==set(parts[spec['variant']]),'scale':max(abs(a-b) for a,b in zip(bb.GetSize(),spec['dimensions']))<.0002,'unit':UsdGeom.GetStageMetersPerUnit(s)==1,'upAxis':str(UsdGeom.GetStageUpAxis(s))=='Y','floor':abs(bb.GetMin()[1])<1e-6,'orientation':p.GetAttribute('reference:forwardAxis').Get()=='+X','designVersion':p.GetAttribute('readiness:dimensionBasis').Get()==design['version'],'variant':p.GetVariantSets().GetVariantSet('configuration').GetVariantSelection()==spec['variant'],'baseDependency':str(base) in used,'visualSourceUnchanged':sha(r['path'])==visual['assetHashes'][aid],'visualReviewed':aid in visual['checkedIds'],'hierarchy':all(s.GetPrimAtPath('/Asset/'+n).IsValid() for n in ['Geometry','Ports','Sensors','Controls','Motion','Components'])}
 assert qualify(checks),(aid,checks)
 evidence.append({'id':aid,'role':spec['role'],'family':spec['family'],'variant':spec['variant'],'checks':checks,'dimensions':list(bb.GetSize()),'source':str(ref/'design.json'),'sourceSha256':sha(ref/'design.json'),'subjectSha256':sha(r['path']),'dependencies':used,'timestamp':stamp,'reviewer':'Codex internal design/structure and RTX image review','scope':'PROJECT_REFERENCE_DESIGN_NOT_AS_BUILT','coreParts':parts[spec['variant']],'inheritance':'Geometry base and named configuration only. Function, physics and ports NOT inherited.','state':'GEOMETRY_VERIFIED','PHYSICAL_VERIFIED':False,'FUNCTION_VERIFIED':False,'PORT_VERIFIED':False,'ASSET_READY':False,'REAL_VERIFIED':False,'nextBlocker':'No load/material/contact or mechanism execution proof; illustrative/manual anchors lack independent compatibility validation.'})
assert len(evidence)==10
# Mutation tests: each geometry predicate independently required; no function/port inheritance.
checks=evidence[0]['checks']; tests=[]
for key in checks:
 bad=dict(checks);bad[key]=False;assert not qualify(bad);tests.append({'test':'reject_missing_'+key,'pass':True})
assert all(not e[k] for e in evidence for k in ['PHYSICAL_VERIFIED','FUNCTION_VERIFIED','PORT_VERIFIED','ASSET_READY','REAL_VERIFIED'])
tests.append({'test':'no_cross_stage_inheritance','pass':True})
tracka_before=json.dumps(report['trackA'],sort_keys=True)
for row in report['trackB']:
 e=next((x for x in evidence if x['id']==row['id']),None)
 fix=next((x for x in changes if x['id']==row['id']),None)
 if fix:row['primPath']=fix['after'];row['referenceCorrection']=fix
 if e:
  row['qualificationV2']=e;row['quality']={'state':'GEOMETRY_VERIFIED','passedStages':['USD_CONNECTED','GEOMETRY_VERIFIED'],'nextStage':'PHYSICAL_VERIFIED','missingEvidence':['independent_physical_function_port_proof'],'REAL_VERIFIED':False};row['legacyPreserved']=True
assert json.dumps(report['trackA'],sort_keys=True)==tracka_before
assert all(sha(p)==h for p,h in protected.items())
assert sum(r['status']=='RESOLVED' for r in updated)==666
assert [r for r in baseline if r['status']!='RESOLVED']==[r for r in updated if r['status']!='RESOLVED']
save('resolver.json',updated);save('report.json',report);save('geometry-evidence.json',evidence);save('decisions26.json',decisions);save('reference-corrections.json',changes);save('tests.json',tests)
save('preservation.json',{'USDUnchanged':protected,'trackAUnchanged':True,'baseline':[724,666,58],'deviceWrites':0,'externalRequestsSent':0})
save('metrics.json',{'total':724,'connected':666,'blocked':58,'GEOMETRY_VERIFIED':10,'geometryPercentOf666':round(1000/666,2),'PHYSICAL_VERIFIED':0,'FUNCTION_VERIFIED':0,'PORT_VERIFIED':0,'ASSET_READY':0,'REAL_VERIFIED':0,'referenceCorrections':20,'floorDeferred':6,'basesVerified':5,'configurationsVerified':10,'seconds':round(time.time()-start,3)})
print((out/'metrics.json').read_text())

"""Add thin standalone entry layers; preserve all source layers and published registries."""
import json,time,hashlib,shutil,sys,os,collections,zipfile
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade,Sdf,Gf,Kind
start=time.time(); project=Path('/home/sjkim/OmniverseProjects'); root=project/'assets/catalog';job=project/'p006-entry666-layer-v1';job.mkdir(exist_ok=True)
web=Path('/opt/Resonance/projects/P006/frontend'); resolverFile=web/'coverage666/resolver.json';visualFile=web/'visual-catalog/catalog.json';renderFile=web/'visual-catalog/render-evidence.json'
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(n,v):(job/n).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
fixed={str(p):sha(p) for p in [resolverFile,visualFile,renderFile,web/'quality-v2/report.json']}
res=[r for r in read(resolverFile) if r['status']=='RESOLVED']; visual={r['id']:r for r in read(visualFile)['assets']};renders={r['id']:r for r in read(renderFile)['assets']}
assert len(res)==666 and len({r['id'] for r in res})==666
assert not root.exists(),'Target already exists: do not overwrite any entry layer'
root.mkdir(parents=True);thumb=root/'.thumbs/256x256';thumb.mkdir(parents=True)
stages={};sourceHashes={};rows=[];fail=[]
def attr(p,n,v):p.CreateAttribute(n,Sdf.ValueTypeNames.String,custom=True).Set(str(v))
def variantTree(p):return {str(x.GetPath().MakeRelativePath(p.GetPath())):{n:x.GetVariantSets().GetVariantSet(n).GetVariantSelection() for n in x.GetVariantSets().GetNames()} for x in Usd.PrimRange(p) if x.GetVariantSets().GetNames()}
def bounds(s,p):return UsdGeom.BBoxCache(Usd.TimeCode.Default(),['default','render']).ComputeWorldBound(p).ComputeAlignedBox()
def sameBox(a,b):return max(abs(float(x)-float(y)) for v,w in [(a.GetMin(),b.GetMin()),(a.GetMax(),b.GetMax())] for x,y in zip(v,w))<1e-5
for i,r in enumerate(res):
 aid=r['id'];src=Path(r['path']);v=visual[aid];ren=renders[aid]
 try:
  if str(src) not in stages:stages[str(src)]=Usd.Stage.Open(str(src))
  s=stages[str(src)];p=s.GetPrimAtPath(r['primPath']);assert p and r['primPath']!='/Catalog'
  for layer in s.GetUsedLayers():
   if layer.realPath:sourceHashes[layer.realPath]=sha(layer.realPath)
  assert v['usdPath']==str(src) and v['primPath']==str(p.GetPath()) and v['sourceSha256']==sha(src)
  assert ren['path']==str(src) and ren['primPath']==str(p.GetPath())
  for dep,h in ren['dependencies'].items():assert sha(dep)==h,('render provenance drift',aid,dep)
  im=web/'visual-catalog'/v['image'];assert sha(im)==v['imageSha256']==ren['imageSha256']
  path=root/(aid+'.usda');e=Usd.Stage.CreateNew(str(path));UsdGeom.SetStageMetersPerUnit(e,UsdGeom.GetStageMetersPerUnit(s));UsdGeom.SetStageUpAxis(e,UsdGeom.GetStageUpAxis(s))
  top=UsdGeom.Xform.Define(e,'/Asset').GetPrim();e.SetDefaultPrim(top);Usd.ModelAPI(top).SetKind(Kind.Tokens.component)
  model=UsdGeom.Xform.Define(e,'/Asset/Model').GetPrim();model.GetReferences().AddReference(str(src),p.GetPath())
  parentMatrix=UsdGeom.XformCache().GetLocalToWorldTransform(p.GetParent())
  if parentMatrix!=Gf.Matrix4d(1):UsdGeom.Xformable(top).AddTransformOp().Set(parentMatrix)
  # References automatically retain child/root selections. Record and explicitly preserve root selections.
  for n in p.GetVariantSets().GetNames():model.GetVariantSets().GetVariantSet(n).SetVariantSelection(p.GetVariantSets().GetVariantSet(n).GetVariantSelection())
  variants=variantTree(p);repairs=[]
  # Keep material dependencies that live outside the referenced product inside the entry defaultPrim.
  # Only reference resources; never copy meshes, material bodies or transforms from the source.
  for node in Usd.PrimRange(p):
   for rel in node.GetRelationships():
    targets=rel.GetTargets()
    if not any(not t.GetPrimPath().HasPrefix(p.GetPath()) for t in targets):continue
    mapped=[]
    for t in targets:
     if t.GetPrimPath().HasPrefix(p.GetPath()):mapped.append(t.ReplacePrefix(p.GetPath(),model.GetPath()));continue
     target=s.GetPrimAtPath(t.GetPrimPath());assert target,('source broken target',aid,str(t))
     assert target.IsA(UsdShade.Material) or target.IsA(UsdShade.Shader),('non-material external relationship needs review',aid,str(t))
     resourcePath=Sdf.Path('/Asset/Resources/R'+hashlib.sha256(str(t.GetPrimPath()).encode()).hexdigest()[:16]);rp=e.DefinePrim(resourcePath);rp.GetReferences().AddReference(str(src),t.GetPrimPath());mapped.append(t.ReplacePrefix(t.GetPrimPath(),resourcePath))
    dst=e.OverridePrim(node.GetPath().ReplacePrefix(p.GetPath(),model.GetPath()));dst.CreateRelationship(rel.GetName(),custom=rel.IsCustom()).SetTargets(mapped);repairs.append({'relationship':str(rel.GetPath()),'targets':[str(t) for t in mapped]})
  for k,val in {'assetId':aid,'nameKo':v['name'],'nameEn':v['englishName'],'englishNameSource':v['englishNameSource'],'category':v['category'],'categoryCode':v['domain'],'sourceUsd':str(src),'sourcePrim':str(p.GetPath()),'variantInfo':json.dumps(variants,ensure_ascii=False),'entryScope':'REFERENCE_ONLY_ORIGINAL_GEOMETRY_UNMODIFIED','imageMethod':'EXISTING_EXACT_PRIM_RENDER_COMPOSITION_EQUIVALENCE_VERIFIED','imageSha256':v['imageSha256']}.items():attr(top,'catalog:'+k,val)
  top.SetAssetInfoByKey('name',aid+' | '+v['englishName']);top.SetAssetInfoByKey('identifier',Sdf.AssetPath(str(path)));top.SetAssetInfoByKey('previews',{'thumbnails':{'default':Sdf.AssetPath('./.thumbs/256x256/'+aid+'.usda.png')}})
  e.GetRootLayer().Save();e=None;e=Usd.Stage.Open(str(path));q=e.GetPrimAtPath('/Asset/Model');top=e.GetDefaultPrim()
  checks={'fileExists':path.is_file(),'sourcePrimValid':p.IsValid(),'composition':not e.GetCompositionErrors(),'singleEntry':len(e.GetPseudoRoot().GetChildren())==1 and str(top.GetPath())=='/Asset','assetId':top.GetAttribute('catalog:assetId').Get()==aid,'variantEquality':variantTree(q)==variants,'unit':UsdGeom.GetStageMetersPerUnit(e)==UsdGeom.GetStageMetersPerUnit(s),'upAxis':UsdGeom.GetStageUpAxis(e)==UsdGeom.GetStageUpAxis(s),'boundsEqual':sameBox(bounds(s,p),bounds(e,q))}
  sourceGeom=[x for x in Usd.PrimRange(p) if x.IsA(UsdGeom.Boundable)];entryGeom=[x for x in Usd.PrimRange(q) if x.IsA(UsdGeom.Boundable)]
  checks['geometryCount']=len(sourceGeom)>0 and len(sourceGeom)==len(entryGeom)
  checks['geometryNotCopied']=True
  def inspectSpec(ps):
   if str(ps.typeName) in ['Mesh','Cube','Cylinder','Sphere','Cone','Capsule','BasisCurves','Points']:checks['geometryNotCopied']=False
   for child in ps.nameChildren.values():inspectSpec(child)
  for ps in e.GetRootLayer().rootPrims:inspectSpec(ps)
  unresolved=[]
  for node in Usd.PrimRange(top):
   for rel in node.GetRelationships():
    for t in rel.GetTargets():
     if not e.GetObjectAtPath(t):unresolved.append(str(t))
  checks['noBrokenRelationships']=not unresolved
  # Compare every boundable world transform, not just the aggregate bounding box.
  xc=UsdGeom.XformCache();checks['transformsEqual']=True
  for x in sourceGeom:
   dest=e.GetPrimAtPath(x.GetPath().ReplacePrefix(p.GetPath(),q.GetPath()))
   matA=xc.GetLocalToWorldTransform(x);matB=xc.GetLocalToWorldTransform(dest)
   if max(abs(float(aa)-float(bb)) for rowA,rowB in zip(matA,matB) for aa,bb in zip(rowA,rowB))>=1e-8:checks['transformsEqual']=False
  # Independent placement test references the entry DEFAULT prim, not its internal Model path.
  test=Usd.Stage.CreateInMemory();UsdGeom.SetStageMetersPerUnit(test,UsdGeom.GetStageMetersPerUnit(e));UsdGeom.SetStageUpAxis(test,UsdGeom.GetStageUpAxis(e));placed=test.DefinePrim('/Placement');placed.GetReferences().AddReference(str(path));checks['referenceDefaultPrim']=not test.GetCompositionErrors() and bool(test.GetPrimAtPath('/Placement/Model')) and sameBox(bounds(e,top),bounds(test,placed))
  assert all(checks.values()),(aid,checks,unresolved)
  shutil.copy2(im,thumb/(aid+'.usda.png'))
  rows.append({**v,'entryPath':str(path),'entryFile':aid+'.usda','defaultPrim':'/Asset','sourceUsd':str(src),'sourcePrim':str(p.GetPath()),'variantInfo':variants,'entrySha256':sha(path),'entryBytes':path.stat().st_size,'referenceRepairs':repairs,'checks':checks,'thumbnail':'./.thumbs/256x256/'+aid+'.usda.png','image':'../visual-catalog/'+v['image'],'entryImageValidation':'EXACT_SOURCE_PRIM_AND_DEPENDENCIES_PLUS_BOUNDS_TRANSFORMS_VARIANTS_EQUIVALENCE','newRtxRender':False})
 except Exception as ex:fail.append({'id':aid,'error':str(ex)})
 if (i+1)%100==0:print('ENTRY',i+1,'passed',len(rows),'failed',len(fail),flush=True)
write('failures.json',fail);write('entries.json',rows)
assert len(rows)==666 and not fail,('entry validation failed',fail[:3])
assert len(list(root.glob('*.usda')))==666
assert all(sha(p)==h for p,h in sourceHashes.items()) and all(sha(p)==h for p,h in fixed.items())
size=sum(r['entryBytes'] for r in rows);thumbsize=sum(p.stat().st_size for p in thumb.iterdir())
metrics={'total':666,'entries':len(rows),'openVerified':666,'placementReferenceVerified':666,'thumbnails':666,'geometryCopied':0,'originalWrites':0,'resolverWrites':0,'baseVariantWrites':0,'materialReferenceRepairs':sum(bool(r['referenceRepairs']) for r in rows),'uniqueIds':len({r['id'] for r in rows}),'entryBytes':size,'thumbnailBytes':thumbsize,'seconds':round(time.time()-start,3),'qualityPromotions':0,'REALPromotions':0}
write('metrics.json',metrics);write('preservation.json',{'registries':fixed,'sourceDependencies':sourceHashes});write('manifest.json',{'version':'P006-ENTRY666-1','root':str(root),'metrics':metrics,'entries':rows})
with zipfile.ZipFile(job/'entry666-wrappers.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.glob('*.usda')):z.write(p,p.name)
 z.writestr('README.txt','666 thin USD wrappers. Absolute references require access to original USD paths on server 172.16.1.232. No geometry included. Keep thumbnails from server catalog folder. See manifest.json.')
print(json.dumps(metrics,indent=2))

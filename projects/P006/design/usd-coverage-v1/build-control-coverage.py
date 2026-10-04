"""Build one derived USD base and one multi-asset configuration library. No PLC/Kit writes."""
import json,hashlib,time,sys,shutil,math
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade,UsdPhysics,UsdLux,Sdf,Gf
start=time.time();r=Path(sys.argv[1]);r.mkdir(parents=True,exist_ok=True)
d=json.loads((r/'control-coverage-spec.json').read_text());audit=json.loads((r/'analysis.json').read_text());catalog={x['id']:x for x in audit['rows']}
donor=catalog['E234']['currentUsd'];old=Usd.Stage.Open(donor);source=old.GetPrimAtPath(d['sourcePrim']);assert source and source.IsA(UsdGeom.Cube)
source_sha=hashlib.sha256(Path(donor).read_bytes()).hexdigest()
assert source_sha==catalog['E234']['donors'][0]['sha256'],'donor changed since audit'
def attr(p,k,v):p.CreateAttribute(k,Sdf.ValueTypeNames.String,custom=True).Set(str(v))
def stage(file,prim):
 s=Usd.Stage.CreateNew(str(r/file));UsdGeom.SetStageMetersPerUnit(s,1);UsdGeom.SetStageUpAxis(s,'Y');p=UsdGeom.Xform.Define(s,prim).GetPrim();s.SetDefaultPrim(p);return s,p
def material(s,name,color):
 m=UsdShade.Material.Define(s,'/Looks/'+name);sh=UsdShade.Shader.Define(s,'/Looks/'+name+'/Shader');sh.CreateIdAttr('UsdPreviewSurface');sh.CreateInput('diffuseColor',Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color));sh.CreateInput('roughness',Sdf.ValueTypeNames.Float).Set(.48);sh.CreateInput('opacity',Sdf.ValueTypeNames.Float).Set(1);m.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(),'surface');return m
def box(s,p,pos,size,color):
 g=UsdGeom.Cube.Define(s,p);g.CreateSizeAttr(1);g.AddTranslateOp().Set(Gf.Vec3d(*pos));g.AddScaleOp().Set(Gf.Vec3d(*size));g.CreateDisplayColorAttr([Gf.Vec3f(*color)]);UsdPhysics.CollisionAPI.Apply(g.GetPrim());return g
# Extract only the proven enclosure geometry, not a complete Ethernet switch mislabeled as a PLC.
b,p=stage('control-base.usda','/Base');UsdGeom.Xform.Define(b,'/Base/Geometry');Sdf.CopySpec(old.GetRootLayer(),source.GetPath(),b.GetRootLayer(),Sdf.Path('/Base/Geometry/Body'))
body=UsdGeom.Cube(b.GetPrimAtPath('/Base/Geometry/Body'));body.ClearXformOpOrder();body.AddTranslateOp().Set(Gf.Vec3d(0,.5,0));body.AddScaleOp().Set(Gf.Vec3d(1,1,.9));body.GetPrim().RemoveProperty('material:binding');body.CreateDisplayColorAttr([Gf.Vec3f(.22,.29,.34)]);UsdPhysics.CollisionAPI.Apply(body.GetPrim())
# Put materials inside the reference root so bindings remain valid after composition.
mat=UsdShade.Material.Define(b,'/Base/Looks/Body');sh=UsdShade.Shader.Define(b,'/Base/Looks/Body/Shader');sh.CreateIdAttr('UsdPreviewSurface');sh.CreateInput('diffuseColor',Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(.22,.29,.34));sh.CreateInput('roughness',Sdf.ValueTypeNames.Float).Set(.48);mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(),'surface');UsdShade.MaterialBindingAPI.Apply(body.GetPrim()).Bind(mat)
attr(p,'provenance:sourceAsset','E234');attr(p,'provenance:sourcePrim',d['sourcePrim']);attr(p,'provenance:sourceSha256',source_sha);attr(p,'scope',d['scope']);vs=p.GetVariantSets().AddVariantSet('form')
box(b,'/Base/Geometry/RearMount',(0,.5,-.475),(.6,.18,.05),(.55,.6,.65))
for form in ['din','rack','panel','drive']:
 vs.AddVariant(form);vs.SetVariantSelection(form)
 with vs.GetVariantEditContext():
  if form=='rack':
   for i,x in enumerate([-.475,.475]):box(b,f'/Base/Geometry/Ear{i}',(x,.5,.45),(.05,.7,.1),(.6,.64,.67))
  elif form=='panel':box(b,'/Base/Geometry/Bezel',(0,.5,.455),(.96,.96,.09),(.04,.06,.08))
  elif form=='drive':
   for i in range(8):box(b,f'/Base/Geometry/Fin{i}',(-.43+i*.12,.52,-.475),(.045,.8,.05),(.5,.55,.6))
  else:box(b,'/Base/Geometry/MountClip',(0,.5,-.475),(.6,.18,.05),(.55,.6,.65))
b.GetRootLayer().Save()
lib,root=stage('control-configurations.usda','/Catalog');ev=[]
for spec in d['assets']:
 aid=spec['id'];p=UsdGeom.Xform.Define(lib,'/Catalog/'+aid).GetPrim();p.GetReferences().AddReference('control-base.usda','/Base');p.GetVariantSets().GetVariantSet('form').SetVariantSelection(spec['form']);UsdGeom.Xformable(p).AddScaleOp().Set(Gf.Vec3d(*spec['size']))
 for k,v in {'catalog:id':aid,'catalog:name':catalog[aid]['name'],'scope':d['scope'],'dimensions:basis':d['version'],'control:state':'UNBOUND','control:protocol':'UNBOUND','control:address':'UNBOUND','orientation:forward':'+Z','mount:type':'PANEL_OR_DIN_REFERENCE','workpiece:ports':'NOT_APPLICABLE_CONTROL_MODULE','readiness:state':'USD_CREATED'}.items():attr(p,k,v)
 for name in ['Ports','Sensors','Controls','Motion','Components']:UsdGeom.Xform.Define(lib,str(p.GetPath())+'/'+name)
 if spec['display']:box(lib,str(p.GetPath())+'/Geometry/Display',(0,.64,.48),(.7,.42,.04),(.02,.25,.34))
 for i in range(spec['ports']):
  x=-.4+.8*(i%4)/max(1,min(4,spec['ports'])-1);y=.15+(i//4)*.15
  box(lib,str(p.GetPath())+f'/Geometry/Connector{i}',(x,y,.475),(.12,.085,.05),(.035,.045,.055))
  port=UsdGeom.Xform.Define(lib,str(p.GetPath())+f'/Ports/signal{i}');port.AddTranslateOp().Set(Gf.Vec3d(x,y,.5));port.CreatePurposeAttr('guide');attr(port.GetPrim(),'protocol','UNBOUND');attr(port.GetPrim(),'role','ILLUSTRATIVE_SIGNAL_ANCHOR_NOT_PINMAP')
 port=UsdGeom.Xform.Define(lib,str(p.GetPath())+'/Ports/mount');port.AddTranslateOp().Set(Gf.Vec3d(0,.5,-.5));port.CreatePurposeAttr('guide')
lib.GetRootLayer().Save();lib=Usd.Stage.Open(str(r/'control-configurations.usda'));assert not lib.GetCompositionErrors()
for spec in d['assets']:
 p=lib.GetPrimAtPath('/Catalog/'+spec['id']);bb=UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox();size=list(bb.GetSize());bottom=bb.GetMin()[1]
 checks={'composition':True,'id':p.GetAttribute('catalog:id').Get()==spec['id'],'units':UsdGeom.GetStageMetersPerUnit(lib)==1,'bottom':abs(bottom)<1e-6,'referenceEnvelope':all(abs(size[i]-spec['size'][i])<1e-6 for i in range(3)),'mountAnchor':bool(lib.GetPrimAtPath(str(p.GetPath())+'/Ports/mount')),'signalAnchors':len(lib.GetPrimAtPath(str(p.GetPath())+'/Ports').GetChildren())==spec['ports']+1,'realUnbound':p.GetAttribute('control:state').Get()=='UNBOUND'}
 assert all(checks.values()),(spec['id'],checks,size,spec['size'])
 ev.append({'id':spec['id'],'usdPath':str(r/'control-configurations.usda'),'primPath':str(p.GetPath()),'size':size,'form':spec['form'],'checks':checks,'scope':d['scope'],'functionVerified':False,'assetReady':False})
# Verify every catalog target can be referenced in an independent, saved layout.
s,p=stage('coverage-layout.usda','/Coverage');bounds=[]
for i,e in enumerate(ev):
 q=UsdGeom.Xform.Define(s,'/Coverage/Assets/'+e['id']);q.GetPrim().GetReferences().AddReference('control-configurations.usda',e['primPath']);tr=q.AddTranslateOp();tr.Set(Gf.Vec3d((i%5)*.7,0,(i//5)*.6));ops=q.GetOrderedXformOps();q.SetXformOpOrder([tr]+[op for op in ops if op.GetOpName()!=tr.GetOpName()]);q.GetPrim().SetInstanceable(True)
 # A guide mounting plane is not represented as the physical factory floor.
box(s,'/Coverage/DisplayBoard',(1.4,-.035,.9),(3.5,.05,2.7),(.72,.76,.79))
light=UsdLux.DomeLight.Define(s,'/Coverage/Light');light.CreateIntensityAttr(700)
cam=UsdGeom.Camera.Define(s,'/Coverage/Camera');m=Gf.Matrix4d();m.SetLookAt(Gf.Vec3d(5.2,5.8,7),Gf.Vec3d(1.4,0,.9),Gf.Vec3d(0,1,0));cam.AddTransformOp().Set(m.GetInverse());cam.CreateFocalLengthAttr(35)
s.GetRootLayer().Save();s=Usd.Stage.Open(str(r/'coverage-layout.usda'));assert not s.GetCompositionErrors()
for e in ev:
 p=s.GetPrimAtPath('/Coverage/Assets/'+e['id']);assert p and p.IsInstance();assert p.GetAttribute('catalog:id').Get()==e['id'];bb=UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox();bounds.append((e['id'],list(bb.GetMin()),list(bb.GetMax())))
collisions=[]
for i,(a,lo,hi) in enumerate(bounds):
 for b,l,h in bounds[i+1:]:
  if all(min(hi[k],h[k])-max(lo[k],l[k])>1e-7 for k in [0,2]):collisions.append([a,b])
assert not collisions,collisions
for e in ev:e['layoutPlacementVerified']=True
hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.glob('*.usda')}
result={'seconds':time.time()-start,'baseFiles':1,'baseMode':'DERIVED_FROM_E234_CASE','newGeometryBaseCount':0,'configurationLibraries':1,'assets':ev,'collisionPairs':collisions,'fileHashes':hashes,'scope':d['scope'],'realConnections':0,'liveStageChanged':False,'readyPromotions':0}
(r/'build-evidence.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['assets','fileHashes']}))

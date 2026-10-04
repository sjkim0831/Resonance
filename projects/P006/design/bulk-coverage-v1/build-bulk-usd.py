"""Reusable reference assemblies. Never a functional/REAL qualification pipeline."""
import sys,json,time,math,hashlib
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade,UsdPhysics,UsdLux,Gf,Sdf
r=Path(sys.argv[1]);t=time.time();plan=json.loads((r/'plan.json').read_text());donors=json.loads((r/'donors.json').read_text())['rows'];donor={d['id']:d for d in donors};selected=[a for a in plan['rows'] if a['configuration']];assert len(plan['rows'])==528
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def attr(p,k,v):p.CreateAttribute(k,Sdf.ValueTypeNames.String,custom=True).Set(str(v))
def new(file,root):
 s=Usd.Stage.CreateNew(str(r/file));UsdGeom.SetStageMetersPerUnit(s,1);UsdGeom.SetStageUpAxis(s,'Y');p=UsdGeom.Xform.Define(s,root).GetPrim();s.SetDefaultPrim(p);return s,p
def bbox(s,p):return UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox()
def paint(s,p,color,root='/Components'):
 name='C'+''.join('%02x'%round(x*255) for x in color);m=UsdShade.Material.Define(s,root+'/Looks/'+name);sh=UsdShade.Shader.Define(s,root+'/Looks/'+name+'/Shader');sh.CreateIdAttr('UsdPreviewSurface');sh.CreateInput('diffuseColor',Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color));sh.CreateInput('roughness',Sdf.ValueTypeNames.Float).Set(.5);sh.CreateInput('opacity',Sdf.ValueTypeNames.Float).Set(1);m.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(),'surface');UsdShade.MaterialBindingAPI.Apply(p).Bind(m)
component_specs={'Box':('E094','Cube'),'Plate':('E023','Cube'),'Pipe':('E239','Cylinder'),'Pump':('E073',None),'Tank':('E225',None),'Motor':('E240',None),'Gearbox':('E245',None),'Cylinder':('E244',None),'Frame':('E032',None),'Conveyor':('E034',None),'Probe':('E239',None),'Coil':('E188',None),'Cart':('E047',None)}
cs,cp=new('components.usda','/Components');provenance=[]
for name,(aid,kind) in component_specs.items():
 d=donor[aid];assert d['composed'] and sha(d['path'])==d['hash'];s=Usd.Stage.Open(d['path']);assert UsdGeom.GetStageMetersPerUnit(s)==1 and str(UsdGeom.GetStageUpAxis(s))=='Y';flat=s.Flatten();nodes=[p for p in s.Traverse() if p.IsA(UsdGeom.Gprim) and UsdGeom.Imageable(p).ComputePurpose()!='guide'];
 if kind:nodes=[p for p in nodes if p.GetTypeName()==kind][:1]
 assert nodes,(name,aid);bb=Gf.Range3d()
 for p in nodes:bb.UnionWith(bbox(s,p))
 lo=bb.GetMin();size=bb.GetSize();assert min(size)>0;center=bb.GetMidpoint();shift=Gf.Matrix4d().SetTranslate(Gf.Vec3d(-center[0],-lo[1],-center[2]));scale=Gf.Matrix4d().SetScale(Gf.Vec3d(*[1/v for v in size]));root=UsdGeom.Xform.Define(cs,'/Components/'+name);xf=UsdGeom.XformCache()
 UsdGeom.Xform.Define(cs,str(root.GetPath())+'/Geometry')
 for i,p in enumerate(nodes):
  dest=str(root.GetPath())+'/Geometry/g'+str(i);Sdf.CopySpec(flat,p.GetPath(),cs.GetRootLayer(),Sdf.Path(dest));q=cs.GetPrimAtPath(dest);UsdGeom.Xformable(q).ClearXformOpOrder();UsdGeom.Xformable(q).MakeMatrixXform().Set(xf.GetLocalToWorldTransform(p)*shift*scale);q.RemoveProperty('material:binding');UsdPhysics.CollisionAPI.Apply(q);colors=UsdGeom.Gprim(p).GetDisplayColorAttr().Get();color=tuple(colors[0]) if colors else (.22,.38,.46);paint(cs,q,color,root=str(root.GetPath()))
 if name=='Pipe':
  q=UsdGeom.Cylinder(cs.GetPrimAtPath(str(root.GetPath())+'/Geometry/g0'));q.CreateAxisAttr('Y');q.CreateHeightAttr(1);q.CreateRadiusAttr(.5);q.GetPrim().RemoveProperty('extent');q.ClearXformOpOrder();q.AddTranslateOp().Set(Gf.Vec3d(0,.5,0))
 attr(root.GetPrim(),'source:id',aid);attr(root.GetPrim(),'source:hash',d['hash']);attr(root.GetPrim(),'scope','NORMALIZED_REFERENCE_COMPONENT');provenance.append({'component':name,'source':aid,'path':d['path'],'hash':d['hash'],'sourcePrims':[str(p.GetPath()) for p in nodes],'normalization':'bbox center XZ, bottom Y, 1m envelope; Pipe axis explicitly Y; not manufacturer dimensions'})
cs.GetRootLayer().Save()
# Geometric component references, not a complete unrelated machine relabeled as another product.
def structure(s,c):
 n=[0];base='/Base/Shape';UsdGeom.Xform.Define(s,base)
 def part(component,pos,size,rot=(0,0,0)):
  n[0]+=1;q=UsdGeom.Xform.Define(s,base+'/p'+str(n[0]));q.AddTranslateOp().Set(Gf.Vec3d(*pos));q.AddRotateXYZOp().Set(Gf.Vec3f(*rot));q.AddScaleOp().Set(Gf.Vec3d(*size));p=UsdGeom.Xform.Define(s,str(q.GetPath())+'/Part');p.GetPrim().GetReferences().AddReference('components.usda','/Components/'+component);p.AddTranslateOp().Set(Gf.Vec3d(0,-.5,0));return q
 def box(pos,size):return part('Box',pos,size)
 def plate(pos,size):return part('Plate',pos,size)
 def pipe(pos,size,rot=(0,0,0)):return part('Pipe',pos,size,rot)
 def shell(top=True):
  plate((0,.03,0),(1,.06,1));plate((-.47,.5,0),(.06,1,1));plate((.47,.5,0),(.06,1,1));plate((0,.5,-.47),(1,1,.06))
  if top:plate((0,.97,0),(1,.06,1))
 def legs():
  for x in [-.43,.43]:
   for z in [-.4,.4]:box((x,.18,z),(.07,.36,.07))
 mode=c['mode'];f=c['base'];features=c['features'];count=c['count']
 if f=='cabinet':
  shell();
  for i in range(count):
   x=-.48+(i+.5)*.96/count;plate((x,.5,.48),(.9/count,.88,.05));box((x+.2/count,.5,.515),(.025,.2,.04))
  if mode=='storage':
   for y in [.25,.5,.75]:plate((0,y,0),(.88,.025,.8))
  if 'ventilation' in features:
   for y in [.15,.21,.27]:plate((-.22,y,.52),(.3,.025,.025))
  if mode=='power':box((.2,.8,.515),(.24,.12,.035))
  if 'purge' in features:pipe((.5,.4,0),(.04,.16,.04),(0,0,90))
 elif f=='vessel':
  if mode=='open-bath':legs()
  else:
   for x in [-.27,.27]:
    for z in [-.27,.27]:box((x,.18,z),(.07,.36,.07))
  if mode=='open-bath':
   plate((0,.35,0),(1,.08,1));plate((-.47,.65,0),(.06,.6,1));plate((.47,.65,0),(.06,.6,1));plate((0,.65,-.47),(1,.6,.06));plate((0,.65,.47),(1,.6,.06))
  else:pipe((0,.65,0),(.9,.7,.9));pipe((0,.99,0),(.15,.03,.15))
  pipe((.52,.38,0),(.08,.25,.08),(0,0,90))
  if 'agitator' in features:part('Motor',(0,1.12,0),(.18,.2,.18));pipe((0,.7,0),(.035,.7,.035))
 elif f=='fluid':
  plate((0,.05,0),(1,.1,1));part('Pump',(.25,.18,.25),(.35,.25,.35))
  if mode=='manifold':
   pipe((0,.6,0),(.07,.9,.07),(0,0,90))
   for i in range(count):x=-.35+i*.7/(count-1);pipe((x,.45,0),(.045,.35,.045));box((x,.67,0),(.12,.08,.12))
  elif mode=='membrane':
   for y in [.4,.62,.84]:pipe((-.08,y,-.05),(.16,.9,.16),(0,0,90))
   pipe((-.52,.6,-.05),(.045,.6,.045))
  elif mode=='heat-loop':
   for i in range(9):plate((-.22+i*.035,.55,-.12),(.018,.7,.6))
   part('Tank',(.3,.65,-.28),(.3,.9,.32))
  else:
   for i in range(count):
    x=-.35+i*.7/(count-1)
    if mode in ['twin-column','multi-tank']:pipe((x,.62,-.15),(.65/count,.95,.5))
    else:part('Tank',(x,.62,-.15),(.65/count,.95,.5))
  pipe((0,.18,.42),(.045,.85,.045),(0,0,90));pipe((-.46,.37,.2),(.045,.45,.045));box((.4,.66,.25),(.16,.28,.12))
 elif f=='chamber':
  if mode=='tunnel':
   plate((0,.03,0),(1,.06,1));plate((0,.97,0),(1,.06,1));plate((0,.5,-.47),(1,1,.06));plate((0,.5,.47),(1,1,.06));part('Conveyor',(0,.15,0),(1.35,.18,.65))
  else:shell();plate((0,.52,.49),(.9,.86,.05));box((.29,.5,.535),(.025,.25,.035))
  if 'two-zone' in features:plate((0,.52,0),(.03,.84,.9))
  box((.32,.79,.525),(.18,.14,.03));box((0,1.04,-.23),(.45,.12,.3))
 elif f=='sensor':
  if mode in ['probe','inline','shaft']:part('Probe',(0,.5,0),(.38,1,.38));
  else:box((0,.5,0),(.8,.8,.5))
  if mode in ['inline','shaft']:pipe((0,.35,0),(.4,1.2,.4),(90,0,0))
  if mode=='optical':
   for i in range(count):pipe((-.18*(count-1)+i*.36,.58,.36),(.24,.26,.24),(90,0,0))
  if mode=='rfid':plate((0,.5,.28),(.72,.72,.06))
  if mode=='sampling':
   pipe((-.23,.82,0),(.1,.5,.1));pipe((.23,.82,0),(.1,.5,.1))
  if mode=='pad':plate((0,.15,0),(1,.1,1))
  plate((0,.05,0),(.65,.1,.65));box((.4,.35,0),(.16,.15,.2))
 elif f=='panel':
  if mode=='mat':plate((0,.03,0),(1,.06,1));pipe((.5,.06,.2),(.025,.25,.025),(0,0,90))
  elif mode=='bumper':
   for x in [-.4,.4]:pipe((x,.5,0),(.12,1,.12))
   pipe((0,.9,0),(.12,.8,.12),(0,0,90))
  else:shell(False);plate((0,.5,.03),(.87,.88,.06));pipe((0,.98,0),(.08,1,.08),(0,0,90))
 elif f=='access':
  if mode=='ladder':
   for x in [-.45,.45]:box((x,.5,0),(.08,1,.1))
   for i in range(9):pipe((0,.05+i*.11,0),(.06,.9,.06),(0,0,90))
  elif mode=='table':part('Frame',(0,.5,0),(1,1,1));
  elif mode=='dock':
   plate((-.44,.5,0),(.12,1,.7));plate((.44,.5,0),(.12,1,.7));plate((0,.94,0),(1,.12,.7))
  else:
   box((0,.5,0),(1,1,.8))
   for i in range(12):plate((-.44+i*.08,.3,.44),(.025,.55,.08))
 elif f=='workstation':
  part('Frame',(0,.3,0),(1,.6,1));plate((0,.65,0),(.65,.08,.6))
  if mode=='portal':
   part('Conveyor',(0,.25,0),(1.2,.3,.7))
   for x in [-.46,.46]:box((x,.62,-.28),(.05,.9,.05))
   box((0,1.03,-.28),(1,.05,.05));box((0,.98,-.28),(.025,.12,.025));part('Probe',(0,.88,-.28),(.08,.18,.08))
  elif mode=='kitting':
   for x in [-.3,0,.3]:box((x,.81,-.3),(.24,.3,.2))
   box((0,1,-.36),(.85,.08,.08))
  elif mode=='test-bench':
   part('Pump',(-.2,.77,0),(.25,.22,.3));pipe((0,.73,.3),(.04,.7,.04),(0,0,90));box((.3,.85,-.2),(.22,.35,.2))
  else:box((.27,.86,-.3),(.34,.45,.16));box((-.2,.79,0),(.22,.23,.25));box((-.4,.85,-.3),(.035,.55,.035));box((-.32,1.11,-.26),(.2,.035,.12));part('Probe',(-.25,1.05,-.23),(.08,.2,.08))
 elif f=='linear':
  if mode=='cylinder':part('Cylinder',(0,.5,0),(1,1,1))
  elif mode=='rail':
   plate((0,.15,0),(1,.3,.7));box((0,.47,0),(.3,.35,.9));part('Motor',(-.5,.4,0),(.18,.5,.5))
  elif mode=='jack':part('Gearbox',(0,.22,0),(.8,.4,.8));pipe((0,.68,0),(.18,.7,.18));plate((0,1,0),(.6,.07,.6))
  else:plate((0,.05,0),(1,.1,1));part('Cylinder',(.25,.43,0),(.3,.65,.4));plate((0,.8,0),(.7,.1,.4))
 elif f=='mobile-top':
  plate((0,.08,0),(1,.16,1))
  if mode=='roller':part('Conveyor',(0,.6,0),(.9,.7,.9))
  elif mode=='lift':
   plate((0,.93,0),(1,.1,1));part('Cylinder',(0,.5,0),(.2,.65,.25));part('Plate',(0,.5,-.3),(.9,.07,.08),(0,0,40));part('Plate',(0,.5,.3),(.9,.07,.08),(0,0,-40))
  else:box((0,.6,0),(.25,.9,.25));pipe((0,.85,.22),(.16,.5,.16),(90,0,0))
 elif f=='rotary':
  part('Motor',(-.25,.5,0),(.4,.75,.8));part('Gearbox',(.12,.5,0),(.45,1,1))
  if mode=='winch':pipe((.46,.5,0),(.6,.45,.6),(0,0,90))
  elif mode=='vibrator':box((.42,.65,0),(.17,.4,.4))
  else:pipe((.43,.5,0),(.25,.2,.25),(0,0,90))
 elif f=='chute':
  part('Plate',(0,.5,0),(1.2,.05,.9),(0,0,-20));part('Plate',(0,.6,-.46),(1.2,.25,.04),(0,0,-20));part('Plate',(0,.6,.46),(1.2,.25,.04),(0,0,-20))
  for x in [-.4,.4]:
   for z in [-.32,.32]:
    h=.5-math.tan(math.radians(20))*x;box((x,h/2,z),(.07,h,.07))
 elif f=='magazine':
  plate((0,.04,0),(1,.08,1));plate((-.47,.5,0),(.06,1,1));plate((.47,.5,0),(.06,1,1))
  for i in range(10):plate((0,.1+i*.085,0),(.92,.015,.9))
 elif f=='wash':
  if mode=='portable':box((0,.42,0),(.6,.7,.65));part('Pump',(0,.89,0),(.45,.2,.4));pipe((.4,.65,.2),(.045,.7,.045))
  elif mode=='scrubber':part('Tank',(0,.55,0),(.6,1,.6));pipe((.3,.35,0),(.15,.5,.15),(0,0,90));part('Pump',(-.4,.2,0),(.25,.2,.3))
  elif mode=='wash-bath':shell(False);part('Pump',(.55,.2,0),(.3,.25,.3));
  else:
   shell(mode!='booth');plate((0,.16,0),(.9,.08,.9));
   for i in range(3):pipe((-.3+i*.3,.85,-.25),(.025,.3,.025))
   if mode=='wash-line':plate((0,.3,0),(1.25,.06,.6))
  pipe((0,.1,-.53),(.08,.3,.08),(90,0,0))
 elif f=='service':
  if mode=='cart-pump':part('Cart',(0,.35,0),(1,.7,1));part('Tank',(-.22,.8,0),(.35,.7,.45));part('Pump',(.27,.61,0),(.4,.25,.4))
  elif mode=='vacuum':part('Cart',(0,.18,0),(.8,.35,.8));part('Tank',(0,.62,0),(.6,.8,.6));pipe((.35,.8,0),(.1,.55,.1),(0,0,45))
  elif mode=='dispenser':box((0,.5,0),(.8,1,.8));pipe((.15,.95,.45),(.055,.2,.055),(90,0,0))
  elif mode=='heat-tool':pipe((0,.65,0),(.4,.9,.4),(0,0,90));box((-.2,.25,0),(.2,.7,.2))
  elif mode=='tensioner':pipe((0,.5,0),(.8,1,.8));pipe((.4,.3,0),(.15,.3,.15),(0,0,90))
  else:
   pipe((0,.5,0),(.13,1,.13));
   for x in [-.4,.4]:plate((x,.4,0),(.08,.75,.2));plate((x*.5,.76,0),(.45,.08,.2))
 elif f=='roll':
  part('Frame',(0,.25,0),(1,.5,1))
  if mode=='winder':
   for x in [-.3,.3]:part('Coil',(x,.77,0),(.35,.6,.8))
  else:
   for i in range(count):x=-.4+i*.8/(count-1);pipe((x,.68,0),(.22,.85,.22),(90,0,0))
   if mode=='coating':box((0,.95,0),(.15,.2,.8))
  part('Motor',(.48,.63,-.35),(.25,.25,.25))
 else:raise RuntimeError('No geometry recipe '+f)
 q=s.GetPrimAtPath(base);bb=bbox(s,q);lo=bb.GetMin();size=bb.GetSize();center=bb.GetMidpoint();assert min(size)>0;xf=UsdGeom.Xformable(q);xf.AddTranslateOp().Set(Gf.Vec3d(-center[0]/size[0],-lo[1]/size[1],-center[2]/size[2]));xf.AddScaleOp().Set(Gf.Vec3d(*[1/v for v in size]));return n[0]
variants={};base_stats=[]
for cl in plan['clusters']:
 f=cl['base'];s,p=new('base-'+f+'.usda','/Base');vs=p.GetVariantSets().AddVariantSet('structure');keys={};stats=[]
 for a in selected:
  c=a['configuration']
  if c['base']!=f:continue
  key=json.dumps([c['mode'],c['features'],c['count']],sort_keys=True)
  if key not in keys:
   name='v%02d'%len(keys);keys[key]=name;vs.AddVariant(name);vs.SetVariantSelection(name)
   with vs.GetVariantEditContext():stats.append(structure(s,c))
  variants[a['id']]=keys[key]
 attr(p,'scope','REFERENCE_LAYOUT_COMPOSITION_NOT_FUNCTIONAL');s.GetRootLayer().Save();base_stats.append({'base':f,'assets':cl['assets'],'variants':len(keys),'componentRefsPerVariant':stats})
lib,p=new('catalog-configurations.usda','/Catalog');records=[]
for a in selected:
 c=a['configuration'];p=UsdGeom.Xform.Define(lib,'/Catalog/'+a['id']).GetPrim();p.GetReferences().AddReference('base-'+c['base']+'.usda');p.GetVariantSets().GetVariantSet('structure').SetVariantSelection(variants[a['id']]);UsdGeom.Xformable(p).AddScaleOp().Set(Gf.Vec3d(*c['size']))
 for k,v in {'catalog:id':a['id'],'catalog:name':a['name'],'scope':c['scope'],'dimension:basis':c['dimensionBasis'],'ready:state':'USD_CREATED','control:state':'UNBOUND','control:protocol':'UNBOUND','control:address':'UNBOUND','mount:policy':c['mountPolicy'],'function:verified':'false','function:missing':a['remaining'],'orientation:forward':'+X','orientation:up':'+Y'}.items():attr(p,k,v)
 for node in ['Ports','Motion','Sensors','Controls','Components']:UsdGeom.Xform.Define(lib,str(p.GetPath())+'/'+node)
 roles=['mount','signal'];applicable=c['base'] not in ['sensor','panel','access','cabinet','linear','rotary','mobile-top']
 if applicable:roles+=['material_in','material_out']
 for name in roles:
  q=UsdGeom.Xform.Define(lib,str(p.GetPath())+'/Ports/'+name);q.AddTranslateOp().Set(Gf.Vec3d(-.5 if name=='material_in' else .5 if name=='material_out' else 0,.5 if name=='signal' else 0,0));q.CreatePurposeAttr('guide');attr(q.GetPrim(),'verification','UNBOUND_REFERENCE_ANCHOR_NOT_PINMAP')
 records.append({'id':a['id'],'name':a['name'],'base':c['base'],'variant':variants[a['id']],'size':c['size'],'ports':roles,'mountPolicy':c['mountPolicy'],'scope':c['scope'],'usdPath':str(r/'catalog-configurations.usda'),'primPath':str(p.GetPath()),'assetReady':False,'real':'UNBOUND','missing':a['remaining']})
lib.GetRootLayer().Save();lib=Usd.Stage.Open(str(r/'catalog-configurations.usda'));assert not lib.GetCompositionErrors()
for e in records:
 p=lib.GetPrimAtPath(e['primPath']);bb=bbox(lib,p);e['checks']={'exists':bool(p),'id':p.GetAttribute('catalog:id').Get()==e['id'],'meters':UsdGeom.GetStageMetersPerUnit(lib)==1,'upY':str(UsdGeom.GetStageUpAxis(lib))=='Y','bottomOrigin':abs(bb.GetMin()[1])<1e-5,'referenceEnvelope':all(abs(bb.GetSize()[i]-e['size'][i])<1e-5 for i in range(3)),'ports':all(lib.GetPrimAtPath(e['primPath']+'/Ports/'+x) for x in e['ports']),'notReady':p.GetAttribute('ready:state').Get()=='USD_CREATED','realUnbound':p.GetAttribute('control:state').Get()=='UNBOUND'};assert all(e['checks'].values()),e
# Each family is independently reopenable; staging into the user's live Kit is never performed.
def layout(file,items):
 s,p=new(file,'/Scene');cols=math.ceil(math.sqrt(len(items)));gap=max(max(e['size'][0],e['size'][2]) for e in items)+1;bounds=[]
 for i,e in enumerate(items):
  q=UsdGeom.Xform.Define(s,'/Scene/Placements/'+e['id']);q.AddTranslateOp().Set(Gf.Vec3d((i%cols)*gap,0,(i//cols)*gap));m=UsdGeom.Xform.Define(s,str(q.GetPath())+'/Model');m.GetPrim().GetReferences().AddReference('catalog-configurations.usda',e['primPath']);m.GetPrim().SetInstanceable(True)
 s.GetRootLayer().Save();s=Usd.Stage.Open(str(r/file));assert not s.GetCompositionErrors()
 for e in items:
  p=s.GetPrimAtPath('/Scene/Placements/'+e['id']+'/Model');assert p.GetAttribute('catalog:id').Get()==e['id'];bb=bbox(s,p);assert abs(bb.GetMin()[1])<1e-5;bounds.append((list(bb.GetMin()),list(bb.GetMax())));e['placementVerified']=True
 overlaps=0
 for i,(lo,hi) in enumerate(bounds):
  for l,h in bounds[i+1:]:
   overlaps+=int(all(min(hi[k],h[k])-max(lo[k],l[k])>1e-5 for k in [0,2]))
 assert not overlaps;bb=bbox(s,s.GetDefaultPrim());center=bb.GetMidpoint();span=max(bb.GetSize());cam=UsdGeom.Camera.Define(s,'/Scene/Camera');m=Gf.Matrix4d();m.SetLookAt(center+Gf.Vec3d(span*1.4,span*1.65,span*1.8),center,Gf.Vec3d(0,1,0));cam.AddTransformOp().Set(m.GetInverse());cam.CreateFocalLengthAttr(35);UsdLux.DomeLight.Define(s,'/Scene/Light').CreateIntensityAttr(650);s.GetRootLayer().Save();return {'file':file,'assets':len(items),'overlaps':overlaps,'gap':gap}
layouts=[layout('layout-all.usda',records)]
for cl in plan['clusters']:layouts.append(layout('layout-'+cl['base']+'.usda',[e for e in records if e['base']==cl['base']]))
hashes={p.name:sha(p) for p in r.glob('*.usda')};result={'version':plan['version'],'seconds':time.time()-t,'baselineHash':plan['baseline']['sha256'],'count':len(records),'assets':records,'bases':base_stats,'componentProvenance':provenance,'layouts':layouts,'hashes':hashes,'readyPromotions':0,'realConnections':0,'blockedRetained':58,'scope':'REFERENCE_LAYOUT_COMPOSITION_NOT_FUNCTIONAL'};(r/'build-evidence.json').write_text(json.dumps(result,indent=2));print(json.dumps({'assets':len(records),'bases':len(base_stats),'variants':sum(x['variants'] for x in base_stats),'seconds':result['seconds']}))

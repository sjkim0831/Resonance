"""Isolated RTX rendering of every exact resolved asset, not substitute images."""
import asyncio,json,time,hashlib,math
from pathlib import Path
import omni.usd,omni.kit.app,carb
from omni.kit.viewport.utility import get_active_viewport,capture_viewport_to_file
from pxr import Usd,UsdGeom,UsdLux,Gf
root=Path('/home/sjkim/OmniverseProjects/p006-visual666-v1');imgs=root/'images';imgs.mkdir(exist_ok=True)
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
async def run():
 app=omni.kit.app.get_app();ctx=omni.usd.get_context();start=time.time();resume=json.loads((root/'resume.json').read_text()) if (root/'resume.json').exists() else {'assets':[],'priorSeconds':0};results=resume['assets'];failures=[]
 rows=[r for r in json.loads((root/'resolver.json').read_text()) if r['status']=='RESOLVED'];assert len(rows)==666
 settings=carb.settings.get_settings();settings.set('/persistent/app/viewport/displayOptions',0)
 try:
  for _ in range(80):await app.next_update_async()
  completedIds={r['id'] for r in results};rows=[r for r in rows if r['id'] not in completedIds]
  for i,r in enumerate(rows):
   try:
    await ctx.new_stage_async();s=ctx.get_stage();UsdGeom.SetStageMetersPerUnit(s,1);UsdGeom.SetStageUpAxis(s,'Y')
    p=UsdGeom.Xform.Define(s,'/Scene/Asset').GetPrim();p.GetReferences().AddReference(r['path'],r['primPath'])
    assert not s.GetCompositionErrors() and r['primPath']!='/Catalog'
    bb=UsdGeom.BBoxCache(0,['default','render']).ComputeWorldBound(p).ComputeAlignedBox();mid=bb.GetMidpoint();size=bb.GetSize();span=max(size)
    assert span>0 and all(math.isfinite(x) for x in list(mid)+list(size))
    cam=UsdGeom.Camera.Define(s,'/Scene/Camera');m=Gf.Matrix4d().SetLookAt(mid+Gf.Vec3d(span*1.8,span*1.5,span*2.2),mid,Gf.Vec3d(0,1,0));cam.AddTransformOp().Set(m.GetInverse());cam.CreateFocalLengthAttr(30);cam.CreateClippingRangeAttr(Gf.Vec2f(max(span*.00001,.000001),span*100+10))
    light=UsdLux.DomeLight.Define(s,'/Scene/Light');light.CreateIntensityAttr(650)
    v=get_active_viewport();v.set_texture_resolution((640,480));v.set_active_camera('/Scene/Camera')
    for _ in range(32 if i<6 else 22):await app.next_update_async()
    target=imgs/(r['id']+'.png');await capture_viewport_to_file(v,str(target)).wait_for_result()
    for _ in range(3):await app.next_update_async()
    layers={l.realPath:digest(l.realPath) for l in s.GetUsedLayers() if l.realPath}
    results.append({'id':r['id'],'image':'images/'+target.name,'path':r['path'],'primPath':r['primPath'],'sourceSha256':digest(r['path']),'dependencies':layers,'selection':{n:p.GetVariantSets().GetVariantSet(n).GetVariantSelection() for n in p.GetVariantSets().GetNames()},'boundsMeters':list(size),'renderer':'Omniverse Kit RTX','method':'EXACT_ASSET_PRIM_RENDER','width':640,'height':480,'timestamp':time.time()})
   except Exception as e:failures.append({'id':r['id'],'error':repr(e)})
   if (i+1)%20==0 or i==len(rows)-1:
    status={'completed':len(completedIds)+i+1,'rendered':len(results),'failed':len(failures),'seconds':round(time.time()-start+resume['priorSeconds'],2)};(root/'progress.json').write_text(json.dumps(status));print('PROGRESS',json.dumps(status),flush=True)
    (root/'render-evidence.json').write_text(json.dumps({'assets':results,'failures':failures,'seconds':time.time()-start,'isolated':True,'liveStageChanged':False}))
  for _ in range(40):await app.next_update_async()
  for r in results:
   p=root/r['image'];r['imageSha256']=digest(p);r['bytes']=p.stat().st_size
  (root/'render-evidence.json').write_text(json.dumps({'assets':results,'failures':failures,'seconds':time.time()-start+resume['priorSeconds'],'retainedFramedImages':len(completedIds),'isolated':True,'liveStageChanged':False},indent=2))
  await ctx.close_stage_async();app.post_quit(0 if len(results)==666 else 2)
 except Exception as e:print('FATAL',repr(e),flush=True);app.post_quit(3)
asyncio.ensure_future(run())

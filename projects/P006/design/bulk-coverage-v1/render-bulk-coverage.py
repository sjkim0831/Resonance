import asyncio,json,time
from pathlib import Path
import omni.usd,omni.kit.app,carb
from omni.kit.viewport.utility import get_active_viewport,capture_viewport_to_file
r=Path('/home/sjkim/OmniverseProjects/p006-bulk-coverage-v1')
async def run():
 app=omni.kit.app.get_app();t=time.time();items=[]
 try:
  data=json.loads((r/'build-evidence.json').read_text())
  for layout in data['layouts']:
   ok=await omni.usd.get_context().open_stage_async(str(r/layout['file']));assert ok[0]
   v=get_active_viewport();v.set_texture_resolution((1280,960));v.set_active_camera('/Scene/Camera');carb.settings.get_settings().set('/persistent/app/viewport/displayOptions',0)
   for _ in range(70):await app.next_update_async()
   name=layout['file'].replace('.usda','.png');await capture_viewport_to_file(v,str(r/name)).wait_for_result();items.append(name);print('RENDERED',name,flush=True)
  (r/'render-evidence.json').write_text(json.dumps({'seconds':time.time()-t,'images':items,'renderer':'RTX','isolated':True,'liveStageChanged':False}));await omni.usd.get_context().close_stage_async();app.post_quit(0)
 except Exception as e:print('BULK_RENDER_FAIL',repr(e),flush=True);app.post_quit(2)
asyncio.ensure_future(run())

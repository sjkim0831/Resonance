import json, os, sys
from bpy import ops, data
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
src,out=args[0],args[1]
for obj in list(data.objects): data.objects.remove(obj, do_unlink=True)
ops.wm.usd_import(filepath=src)
meshes=sum(1 for o in data.objects if o.type=='MESH'); materials=sum(len(o.data.materials) for o in data.objects if o.type=='MESH')
if meshes==0: raise RuntimeError('NO_MESH')
os.makedirs(os.path.dirname(out),exist_ok=True)
ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=False,export_apply=True)
print(json.dumps({'meshes':meshes,'materials':materials,'objects':len(data.objects)}))
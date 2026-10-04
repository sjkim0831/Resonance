import json,subprocess,os
ROOT='/opt/Resonance/projects/P006/3d-toolchain'; BL=ROOT+'/bin/blender-4.5.0-linux-x64/blender'
arr=json.load(open('/opt/Resonance/projects/P006/frontend/entry-catalog/entries.json'))
for aid in ['E001','E002','E004','E005','E194']:
 x=next(z for z in arr if z['id']==aid); out=f'{ROOT}/derived/{aid}.glb'; cmd=[BL,'-b','--factory-startup','--python','/tmp/usd_to_glb.py','--',x['entryPath'],out]; p=subprocess.run(cmd,text=True,capture_output=True); print(aid,'rc',p.returncode); print((p.stdout+p.stderr)[-1800:])
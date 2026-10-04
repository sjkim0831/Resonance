import json,sys
from pathlib import Path
m=Path(sys.argv[1] if len(sys.argv)>1 else "/opt/Resonance/projects/P006/frontend/3d-derived/manifest.json")
d=json.loads(m.read_text()); out=[]; ok=True
for a in d.get("assets",[]):
 p=Path("/opt/Resonance/projects/P006/frontend/3d-derived")/Path(a["glbPath"]).name
 magic=p.read_bytes()[:4] if p.exists() else b""
 good=p.exists() and p.stat().st_size>20 and magic==b"glTF"
 ok &= good; out.append({"assetId":a["assetId"],"path":str(p),"bytes":p.stat().st_size if p.exists() else 0,"glbMagic":magic.decode("latin1"),"valid":good})
print(json.dumps({"manifest":str(m),"count":len(out),"valid":ok,"assets":out},indent=2))
sys.exit(0 if ok else 1)

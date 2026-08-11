#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

compiler=Path(sys.argv[1] if len(sys.argv)>1 else "ops/scripts/compile-cross-screen-contracts.py")
base={"databaseColumns":[],"registeredEndpoints":[],"contracts":[]}
def contract(cid,status):
    return {"contractId":cid,"processCode":"P","stepCode":f"S{cid}","audience":"ADMIN",
      "routePath":f"/r/{cid}","stepOrder":cid,"contractStatus":status,"fields":[],
      "apis":[{"method":"POST","path":f"/missing/{cid}"}]}
base["contracts"]=[contract(1,"REVIEW_REQUIRED"),contract(2,"DESIGN_COMPLETE"),contract(3,"VERIFIED")]
with tempfile.NamedTemporaryFile("w",encoding="utf-8",suffix=".json",delete=False) as handle:
    json.dump(base,handle); name=handle.name
try:
    result=json.loads(subprocess.check_output([sys.executable,str(compiler),name],text=True))
finally:
    Path(name).unlink(missing_ok=True)
assert result["blockingCount"]==2,result
assert result["warningCount"]==1,result
by_resource={item["resourceKey"]:item["severity"] for item in result["issues"]}
assert by_resource["P:S1:ADMIN:/r/1"]=="WARNING",by_resource
assert by_resource["P:S2:ADMIN:/r/2"]=="BLOCKING",by_resource
assert by_resource["P:S3:ADMIN:/r/3"]=="BLOCKING",by_resource
review_hash=result["contractHash"]
base["contracts"][0]["contractStatus"]="DESIGN_COMPLETE"
with tempfile.NamedTemporaryFile("w",encoding="utf-8",suffix=".json",delete=False) as handle:
    json.dump(base,handle); second_name=handle.name
try:
    second=json.loads(subprocess.check_output([sys.executable,str(compiler),second_name],text=True))
finally:
    Path(second_name).unlink(missing_ok=True)
assert second["contractHash"]!=review_hash,(review_hash,second["contractHash"])
print(json.dumps({"status":"PASS","reviewWarnings":1,"executableBlockers":2},separators=(",",":")))

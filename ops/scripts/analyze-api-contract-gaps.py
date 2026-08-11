#!/usr/bin/env python3
import difflib,json,re,sys
from collections import Counter
from pathlib import Path

data=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

def norm(path):
    return re.sub(r"\{[^/{}]+\}","{}",str(path or "").split("?")[0]).rstrip("/") or "/"

def parse(value):
    if isinstance(value,dict) and isinstance(value.get("contract"),(dict,str)):
        return parse(value["contract"])
    if isinstance(value,str):
        parts=value.strip().split(maxsplit=1)
        return (parts[0].upper(),norm(parts[1])) if len(parts)==2 else None
    if isinstance(value,dict):
        path=norm(value.get("path") or value.get("routePath") or "")
        return (str(value.get("method") or "GET").upper(),path) if path!="/" else None
    return None

registered={(str(x["method"]).upper(),norm(x["path"])):x for x in data["registeredEndpoints"]}
by_method={}
for method,path in registered:by_method.setdefault(method,[]).append(path)
gaps={}
for contract in data["contracts"]:
    resource=f'{contract["processCode"]}:{contract["stepCode"]}:{contract["audience"]}:{contract["routePath"]}'
    for raw in contract.get("apis",[]) if isinstance(contract.get("apis"),list) else []:
        api=parse(raw)
        if not api or api in registered:continue
        gaps.setdefault(api,[]).append(resource)

result=[]
for (method,path),resources in sorted(gaps.items()):
    scored=[]
    path_tokens=set(x for x in path.lower().split("/") if x and x!="{}")
    for candidate in by_method.get(method,[]):
        candidate_tokens=set(x for x in candidate.lower().split("/") if x and x!="{}")
        sequence=difflib.SequenceMatcher(None,path,candidate).ratio()
        token=len(path_tokens&candidate_tokens)/max(1,len(path_tokens|candidate_tokens))
        score=round(sequence*.7+token*.3,4)
        scored.append((score,candidate))
    scored.sort(reverse=True)
    candidates=[{"score":score,"path":candidate} for score,candidate in scored[:3]]
    high=bool(candidates and candidates[0]["score"]>=.92 and (len(candidates)==1 or candidates[0]["score"]-candidates[1]["score"]>=.08))
    result.append({"method":method,"path":path,"usageCount":len(resources),"resources":resources,
                   "highConfidenceCorrection":high,"candidates":candidates})

print(json.dumps({"schemaVersion":"1.0.0","uniqueGapCount":len(result),
  "usageGapCount":sum(x["usageCount"] for x in result),
  "highConfidenceCorrectionCount":sum(x["highConfidenceCorrection"] for x in result),
  "methodCounts":dict(Counter(x["method"] for x in result)),"gaps":result},ensure_ascii=False,separators=(",",":")))

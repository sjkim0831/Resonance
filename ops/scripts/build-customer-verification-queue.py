#!/usr/bin/env python3
"""Prioritize use cases for browser/API/DB verification from available evidence."""
import argparse,json
from collections import Counter,defaultdict
from pathlib import Path

def main()->int:
    p=argparse.ArgumentParser();p.add_argument("--bindings",default="projects/carbonet-backend-metadata/customer-trace/customer-sdui-bindings.json")
    p.add_argument("--source",default="projects/carbonet-backend-metadata/customer-trace/customer-source-evidence.json")
    p.add_argument("--runtime-evidence",default="projects/carbonet-backend-metadata/customer-trace/customer-e2e-readonly-evidence.json")
    p.add_argument("--output",default="projects/carbonet-backend-metadata/customer-trace/customer-verification-queue.json");a=p.parse_args()
    bindings=json.loads(Path(a.bindings).read_text());source=json.loads(Path(a.source).read_text());by_uc=defaultdict(list)
    runtime_path=Path(a.runtime_evidence);runtime_by_uc={}
    if runtime_path.is_file():
        runtime_by_uc={row["useCaseId"]:row for row in json.loads(runtime_path.read_text()).get("items",[])}
    for row in source["records"]:by_uc[row["useCaseId"]].append(row)
    queue=[]
    for row in bindings["bindings"]:
        uc=row["useCaseId"];records=by_uc.get(uc,[]);page_source=any(x["assetKind"]=="PAGE" and x["sourceStatus"] in ("SOURCE_CONFIRMED","SDUI_REGISTERED") for x in records)
        api_source=any(x["assetKind"]=="API" and x["sourceStatus"]=="SOURCE_CONFIRMED" for x in records)
        reachable=any(str(x.get("httpEvidence",{}).get("classification")) in ("REACHABLE","REDIRECTED","AUTH_GUARDED") for x in row.get("pageCandidates",[]))
        if page_source and api_source and reachable:stage="READY_FOR_E2E";priority=1
        elif page_source and reachable:stage="READY_FOR_PAGE_VERIFICATION";priority=2
        elif api_source:stage="READY_FOR_API_VERIFICATION";priority=3
        elif row.get("pageCandidates") or row.get("apiCandidates"):stage="CANDIDATE_REVIEW";priority=4
        else:stage="MAPPING_REQUIRED";priority=5
        runtime=runtime_by_uc.get(uc,{})
        queue.append({"queueId":"VERIFY-"+uc,"priority":priority,"stage":stage,"useCaseId":uc,"traceId":row["traceId"],"title":row["title"],"domain":row["domain"],
            "pageSourceConfirmed":page_source,"apiSourceConfirmed":api_source,"httpReachable":reachable,"srRequestIds":row.get("srRequestIds",[]),
            "runtimeEvidenceStatus":runtime.get("result","NOT_COLLECTED"),"runtimeEvidenceRef":"customer-e2e-readonly-evidence.json" if runtime else None,
            "requiredChecks":["AUTHENTICATED_BROWSER","API_RUNTIME","DATABASE_EFFECT","AUTHORITY","AUDIT_LOG"],"automaticVerification":False})
    queue.sort(key=lambda x:(x["priority"],x["domain"],x["useCaseId"]));summary=Counter(x["stage"] for x in queue)
    payload={"schemaVersion":1,"queueCount":len(queue),"summary":dict(sorted(summary.items())),"policy":{"humanApprovalRequired":True,"automaticVerification":False},"queue":queue}
    Path(a.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload["summary"],ensure_ascii=False,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())

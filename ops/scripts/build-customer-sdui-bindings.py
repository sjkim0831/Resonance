#!/usr/bin/env python3
"""Build review-only Customer Trace bindings consumable by the SDUI Builder."""
import argparse,json
from collections import defaultdict
from pathlib import Path

def main()->int:
    p=argparse.ArgumentParser();p.add_argument("--baseline",default="projects/carbonet-backend-metadata/customer-trace/customer-trace-baseline.json")
    p.add_argument("--consensus",default="projects/carbonet-backend-metadata/customer-trace/customer-mapping-consensus.json")
    p.add_argument("--source-evidence",default="projects/carbonet-backend-metadata/customer-trace/customer-source-evidence.json")
    p.add_argument("--http-evidence",default="projects/carbonet-backend-metadata/customer-trace/customer-http-evidence.json")
    p.add_argument("--sr-import",default="projects/carbonet-backend-metadata/customer-trace/customer-sr-workbench-import.json")
    p.add_argument("--output",default="projects/carbonet-backend-metadata/customer-trace/customer-sdui-bindings.json");a=p.parse_args()
    baseline=json.loads(Path(a.baseline).read_text());consensus=json.loads(Path(a.consensus).read_text());source=json.loads(Path(a.source_evidence).read_text())
    http=json.loads(Path(a.http_evidence).read_text());sr=json.loads(Path(a.sr_import).read_text())
    base_by={x["requirement"]["requirementId"]:x for x in baseline["traces"]};con_by={x["useCaseId"]:x for x in consensus["mappings"]}
    source_by=defaultdict(list)
    for x in source["records"]:source_by[x["useCaseId"]].append(x)
    http_by={x["path"]:x for x in http["probes"]};sr_by=defaultdict(list)
    for req in sr["requests"]:
        try:ctx=json.loads(req["technicalContext"])
        except Exception:ctx={}
        for uc in ctx.get("useCaseIds",[]):sr_by[uc].append(req["requestId"])
    bindings=[]
    for uc,base in base_by.items():
        con=con_by.get(uc,{"pages":[],"apis":[],"tables":[]});records=source_by.get(uc,[])
        pages=[]
        for item in con.get("pages",[]):
            ev=item.get("evidence",[]);path=next((str(x.get("path")) for x in ev if x.get("path")),"")
            pages.append({"assetId":item["assetId"],"agreementCount":item["agreementCount"],"confidence":item["maxConfidence"],"routePath":path,
                "httpEvidence":http_by.get(path,{"classification":"PENDING"})})
        bindings.append({"bindingId":"CUSTOMER-SDUI-"+uc,"traceId":base["traceId"],"useCaseId":uc,"title":base["requirement"]["title"],
            "domain":base["requirement"]["domain"],"bindingStatus":"DRAFT_REVIEW","pageCandidates":pages,
            "apiCandidates":[{"assetId":x["assetId"],"agreementCount":x["agreementCount"],"confidence":x["maxConfidence"]} for x in con.get("apis",[])],
            "tableCandidates":[{"assetId":x["assetId"],"agreementCount":x["agreementCount"],"confidence":x["maxConfidence"]} for x in con.get("tables",[])],
            "sourceEvidenceIds":[x["assetId"] for x in records],"srRequestIds":sr_by.get(uc,[]),
            "builderPolicy":{"allowPreview":True,"allowDraftEdit":True,"allowPublish":False,"humanApprovalRequired":True}})
    payload={"schemaVersion":1,"bindingCount":len(bindings),"policy":{"sourceOfTruth":"Customer Trace","automaticPublish":False,"automaticDeploy":False},"bindings":bindings}
    Path(a.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"bindingCount":len(bindings),"withSr":sum(bool(x["srRequestIds"]) for x in bindings),"withPageCandidate":sum(bool(x["pageCandidates"]) for x in bindings)},indent=2));return 0
if __name__=="__main__":raise SystemExit(main())

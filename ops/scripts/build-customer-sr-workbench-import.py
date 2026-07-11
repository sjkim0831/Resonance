#!/usr/bin/env python3
"""Create review-only SR Workbench import requests from customer GAP backlog."""
import argparse, json
from pathlib import Path

def top_page(mapping: dict) -> tuple[str,str,str]:
    pages=mapping.get("pages",[])
    if not pages:return "customer-trace","/admin/system/sr-workbench","고객 요구 추적"
    item=pages[0]; evidence=item.get("evidence",[]); path=""; label=""
    for row in evidence:
        path=path or str(row.get("path") or ""); label=label or str(row.get("label") or "")
    return item["assetId"],path or "/admin/system/sr-workbench",label or item["assetId"]

def main()->int:
    parser=argparse.ArgumentParser(); parser.add_argument("--backlog",default="projects/carbonet-backend-metadata/customer-trace/customer-gap-sr-backlog.json")
    parser.add_argument("--consensus",default="projects/carbonet-backend-metadata/customer-trace/customer-mapping-consensus.json")
    parser.add_argument("--output",default="projects/carbonet-backend-metadata/customer-trace/customer-sr-workbench-import.json")
    args=parser.parse_args(); backlog=json.loads(Path(args.backlog).read_text()); consensus=json.loads(Path(args.consensus).read_text())
    by_uc={row["useCaseId"]:row for row in consensus["mappings"]}; requests=[]
    for number,sr in enumerate(backlog.get("prioritizedSr",[]),1):
        uc_ids=sr.get("useCaseIds",[]); page_id,route,label=top_page(by_uc.get(uc_ids[0],{})) if uc_ids else ("customer-trace","/admin/system/sr-workbench","고객 요구 추적")
        missing=sr.get("missingAssets",{}); context={"customerTraceIds":["CTR-"+x.replace("_","-") for x in uc_ids],"useCaseIds":uc_ids,
            "missingAssets":missing,"acceptanceCriteria":sr.get("acceptanceCriteria",[]),"risk":sr.get("risk"),"sourceDecision":"REVIEW_REQUIRED"}
        requests.append({"requestId":f"CUSTOMER-GAP-SR-{number:03d}","pageId":page_id,"pageLabel":label,"routePath":route,
            "menuCode":"A007","menuLookupUrl":"/admin/system/menu","surfaceId":"customer-trace-gap","surfaceLabel":"고객 요구 GAP",
            "targetId":uc_ids[0] if uc_ids else "CUSTOMER-TRACE","targetLabel":sr.get("title",f"Customer GAP {number}"),
            "summary":sr.get("title",f"Customer GAP {number}"),"instruction":"; ".join(sr.get("acceptanceCriteria",[])),
            "technicalContext":json.dumps(context,ensure_ascii=False,separators=(",",":")),"traceId":context["customerTraceIds"][0] if context["customerTraceIds"] else "",
            "approvalStatus":"REVIEW_REQUIRED","executeAutomatically":False})
    payload={"schemaVersion":1,"policy":{"humanApprovalRequired":True,"automaticExecution":False,"automaticDeployment":False},"requestCount":len(requests),"requests":requests}
    Path(args.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"requestCount":len(requests),"automaticExecution":False},indent=2));return 0

if __name__=="__main__":raise SystemExit(main())

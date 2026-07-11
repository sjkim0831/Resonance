#!/usr/bin/env python3
"""Record critical runtime findings and whether a compiled source fix is pending deploy."""
import argparse,json,subprocess
from datetime import datetime,timezone
from pathlib import Path

def status(url:str)->int:
    r=subprocess.run(["curl","-sS","-o","/dev/null","--max-time","8","-w","%{http_code}",url],text=True,capture_output=True)
    return int(r.stdout) if r.stdout.isdigit() else 0

def main()->int:
    p=argparse.ArgumentParser();p.add_argument("--base-url",default="http://127.0.0.1");p.add_argument("--root",default=".")
    p.add_argument("--output",default="projects/carbonet-backend-metadata/customer-trace/customer-runtime-findings.json");a=p.parse_args();root=Path(a.root)
    checks=[("PROJECT_INFO","/api/runtime/project-info"),("CUSTOMER_TRACE_SUMMARY","/api/platform/customer-trace/summary"),("HEALTH","/actuator/health")]
    findings=[]
    compatibility=(root/"modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/common/governance/model/ProjectManifestVO.java").read_text(errors="ignore")
    trace_controller=root/"apps/carbonet-api/src/main/java/egovframework/com/web/CustomerTraceApiController.java"
    for check_id,path in checks:
        code=status(a.base_url+path);state="HEALTHY" if 200<=code<300 else "RUNTIME_GAP"
        remediation="NONE"
        if check_id=="PROJECT_INFO" and code>=400 and "private String projectId;" in compatibility:remediation="FIX_COMPILED_DEPLOYMENT_PENDING"
        if check_id=="CUSTOMER_TRACE_SUMMARY" and code==404 and trace_controller.is_file():remediation="FEATURE_COMPILED_DEPLOYMENT_PENDING"
        findings.append({"findingId":"RUNTIME-"+check_id,"path":path,"httpStatus":code,"state":state,"remediation":remediation,"automaticDeploy":False})
    payload={"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),"findingCount":len(findings),"findings":findings}
    Path(a.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,indent=2));return 0
if __name__=="__main__":raise SystemExit(main())

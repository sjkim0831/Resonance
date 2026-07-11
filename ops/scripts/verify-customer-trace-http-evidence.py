#!/usr/bin/env python3
"""Verify page reachability only; never infer functional completion from HTTP status."""
import argparse, json, subprocess
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

def probe(base: str, path: str, timeout: int) -> dict:
    url = urljoin(base.rstrip("/") + "/", path.lstrip("/"))
    result = subprocess.run(["curl", "-sS", "-o", "/dev/null", "--max-time", str(timeout), "-w", "%{http_code}\t%{url_effective}", url], text=True, capture_output=True)
    parts = result.stdout.strip().split("\t", 1); status = int(parts[0]) if parts and parts[0].isdigit() else 0
    if 200 <= status < 300: classification = "REACHABLE"
    elif 300 <= status < 400: classification = "REDIRECTED"
    elif status in (401, 403): classification = "AUTH_GUARDED"
    elif status == 404: classification = "NOT_FOUND"
    else: classification = "ERROR"
    return {"path":path,"url":url,"httpStatus":status,"effectiveUrl":parts[1] if len(parts)>1 else "",
        "classification":classification,"functionalVerification":"PENDING","error":result.stderr.strip()[:300]}

def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--source-evidence",default="projects/carbonet-backend-metadata/customer-trace/customer-source-evidence.json")
    parser.add_argument("--base-url",default="http://127.0.0.1"); parser.add_argument("--workers",type=int,default=6); parser.add_argument("--timeout",type=int,default=8)
    parser.add_argument("--output",default="projects/carbonet-backend-metadata/customer-trace/customer-http-evidence.json")
    args=parser.parse_args(); evidence=json.loads(Path(args.source_evidence).read_text())
    paths=sorted({row.get("routePath","") for row in evidence["records"] if row["assetKind"]=="PAGE" and row.get("routePath","").startswith("/")})
    with ThreadPoolExecutor(max_workers=args.workers) as pool: probes=list(pool.map(lambda path:probe(args.base_url,path,args.timeout),paths))
    summary=Counter(item["classification"] for item in probes)
    payload={"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),"baseUrl":args.base_url,"policy":"reachability is not functional verification",
        "pathCount":len(paths),"summary":dict(sorted(summary.items())),"probes":probes}
    Path(args.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload["summary"],indent=2)); return 0

if __name__=="__main__": raise SystemExit(main())

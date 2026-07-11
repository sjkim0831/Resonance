#!/usr/bin/env python3
"""Join canonical customer use cases to runtime evidence without claiming implementation."""
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

SHARED_K8S = [
    "OPS-K8S-DEPLOYMENT-CARBONET-PROD-CARBONET-RUNTIME",
    "OPS-K8S-DEPLOYMENT-CARBONET-PROD-CARBONET-WEB",
    "OPS-K8S-DEPLOYMENT-CARBONET-PROD-POSTGRES-HAPROXY",
    "OPS-K8S-DEPLOYMENT-CARBONET-PROD-POSTGRES-PGBOUNCER",
]
SHARED_DB = [f"OPS-PATRONI-MEMBER-CARBONET-PROD-POSTGRES-PATRONI-{number}" for number in range(3)]

def values(value: str) -> list[str]:
    return [item.strip() for item in value.replace("|", ",").split(",") if item.strip() and item.strip() != "-"]

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", default="projects/carbonet-backend-metadata/customer-trace/reference-registry-summary.json")
    parser.add_argument("--operations", default="projects/carbonet-backend-metadata/customer-trace/operation-registry-summary.json")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/customer-trace-baseline.json")
    args = parser.parse_args()
    references, operations = json.loads(Path(args.reference).read_text()), json.loads(Path(args.operations).read_text())
    available = {asset["assetId"] for asset in operations["assets"]}
    operational_links = [item for item in SHARED_K8S if item in available]
    database_links = [item for item in SHARED_DB if item in available]
    traces = []
    for uc in references["canonicalUseCases"]:
        uc_id = uc["useCaseId"]
        traces.append({"traceId": "CTR-" + uc_id.replace("_", "-"),
            "requirement": {"requirementId": uc_id, "useCaseIds": [uc_id], "title": uc.get("title") or uc_id,
                "domain": uc.get("domain") or "UNCLASSIFIED", "authorityTier": "A",
                "evidenceIds": ["REF-MASTER-UCS"]},
            "links": {"ubuntuAssets": [], "kubernetesAssets": operational_links,
                "frameworkModules": ["MODULE-APPS-CARBONET-API", "PROJECT-CARBONET-FRONTEND"],
                "userPages": values(uc.get("userScreenId", "")), "adminPages": values(uc.get("adminScreenId", "")),
                "apis": values(uc.get("endpoint", "")), "databaseAssets": database_links,
                "sduiAssets": [], "srTickets": [], "aiExecutions": [], "testEvidence": []},
            "status": "NOT_STARTED", "customerDecision": {"decision": "PENDING"}})
    generated = datetime.now(timezone.utc).isoformat()
    payload = {"schemaVersion": 1, "generatedAt": generated, "traceCount": len(traces),
        "operationEvidenceHash": operations["evidenceHash"], "statusSummary": {"NOT_STARTED": len(traces)}, "traces": traces}
    payload["baselineHash"] = hashlib.sha256(json.dumps(traces, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"traceCount": len(traces), "baselineHash": payload["baselineHash"]}, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

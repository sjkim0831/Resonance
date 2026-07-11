#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"


def read(name):
    return json.loads((TRACE / name).read_text(encoding="utf-8"))


def main():
    baseline = read("customer-trace-baseline.json")
    operations = read("operation-registry-summary.json")
    sources = read("resonance-source-registry.json")
    evidence = read("customer-source-evidence.json")
    http = read("customer-http-evidence.json")
    scorecard = read("customer-governance-scorecard.json")
    sr = read("customer-sr-workbench-import.json")
    bindings = read("customer-sdui-bindings.json")
    queue = read("customer-verification-queue.json")
    approval = read("customer-approval-ledger.json")
    contracts = read("customer-contract-verification.json")
    runtime = read("customer-runtime-findings.json")

    catalog = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "READY_FOR_HUMAN_REVIEW" if contracts.get("valid") else "CONTRACT_ERROR",
        "customerTrace": {
            "canonicalUseCases": baseline.get("traceCount", 0),
            "customerMaturity": scorecard.get("customerMaturity", {}),
            "deliveryReadiness": scorecard.get("deliveryReadiness", {}),
        },
        "connectedAssets": {
            "operations": operations.get("summary", {}),
            "resonance": sources.get("summary", {}),
            "sourceEvidence": evidence.get("evidenceCount", 0),
            "httpEvidence": http.get("summary", {}),
        },
        "consumerContracts": {
            "srWorkbench": {
                "artifact": "customer-sr-workbench-import.json",
                "requestCount": sr.get("requestCount", 0),
                "automaticExecution": False,
            },
            "sduiBuilder": {
                "artifact": "customer-sdui-bindings.json",
                "bindingCount": bindings.get("bindingCount", 0),
                "automaticPublish": False,
            },
            "verificationQueue": {
                "artifact": "customer-verification-queue.json",
                "itemCount": queue.get("itemCount", len(queue.get("items", []))),
            },
            "approvalLedger": {
                "artifact": "customer-approval-ledger.json",
                "entryCount": approval.get("entryCount", 0),
                "stateSummary": approval.get("stateSummary", {}),
                "automaticApproval": False,
            },
        },
        "contractVerification": contracts,
        "runtime": {
            "artifact": "customer-runtime-findings.json",
            "findings": runtime.get("findings", []),
            "deploymentChanged": False,
        },
        "readOnlyApi": {
            "basePath": "/api/platform/customer-trace",
            "endpoints": ["summary", "traces", "trace", "scorecard", "sr-backlog", "approval-ledger", "catalog"],
            "runtimeStatus": "DEPLOYMENT_PENDING",
        },
        "policy": {
            "automaticImplementationApproval": False,
            "automaticVerification": False,
            "automaticExecution": False,
            "automaticDeployment": False,
            "operatingDatabaseChanged": False,
            "kubernetesChanged": False,
        },
    }
    (TRACE / "customer-trace-catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": catalog["status"], "useCases": catalog["customerTrace"]["canonicalUseCases"], "sr": sr.get("requestCount", 0), "bindings": bindings.get("bindingCount", 0)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"


def load(name):
    return json.loads((TRACE / name).read_text(encoding="utf-8"))


def main():
    bindings_doc = load("customer-sdui-bindings.json")
    ledger_doc = load("customer-approval-ledger.json")
    sr_doc = load("customer-sr-workbench-import.json")
    source_doc = load("resonance-source-registry.json")
    queue_doc = load("customer-verification-queue.json")
    bindings = bindings_doc.get("bindings", [])
    ledger = ledger_doc.get("entries", [])
    requests = sr_doc.get("requests", [])
    queue = queue_doc.get("items", queue_doc.get("queue", []))

    binding_ids = {row.get("useCaseId") for row in bindings}
    ledger_ids = {row.get("useCaseId") for row in ledger}
    request_by_id = {row.get("requestId"): row for row in requests}
    route_ids = {row.get("assetId") for row in source_doc.get("routes", [])}
    sdui_screen_ids = {f"SDUI-{row.get('screenId')}" for row in source_doc.get("sduiScreens", []) if row.get("screenId")}
    page_asset_ids = route_ids | sdui_screen_ids
    api_ids = {row.get("assetId") for row in source_doc.get("apis", [])}
    sr_use_cases = {}
    errors = []

    for request in requests:
        if request.get("executeAutomatically") is not False:
            errors.append(f"{request.get('requestId')}: automatic SR execution is enabled")
        try:
            context = json.loads(request.get("technicalContext") or "{}")
        except json.JSONDecodeError:
            errors.append(f"{request.get('requestId')}: invalid technicalContext JSON")
            context = {}
        for use_case_id in context.get("useCaseIds", []):
            sr_use_cases.setdefault(use_case_id, set()).add(request.get("requestId"))

    dangling_pages = []
    dangling_apis = []
    for binding in bindings:
        use_case_id = binding.get("useCaseId")
        for request_id in binding.get("srRequestIds", []):
            if request_id not in request_by_id:
                errors.append(f"{use_case_id}: unknown SR {request_id}")
            elif request_id not in sr_use_cases.get(use_case_id, set()):
                errors.append(f"{use_case_id}: SR {request_id} does not include the UC")
        for candidate in binding.get("pageCandidates", []):
            if candidate.get("assetId") not in page_asset_ids:
                dangling_pages.append({"useCaseId": use_case_id, "assetId": candidate.get("assetId")})
        for candidate in binding.get("apiCandidates", []):
            asset_id = candidate.get("assetId")
            if asset_id and asset_id not in api_ids:
                dangling_apis.append({"useCaseId": use_case_id, "assetId": asset_id})

    if binding_ids != ledger_ids:
        errors.append("approval ledger UC set differs from SDUI bindings")
    queue_ids = {row.get("useCaseId") for row in queue if row.get("useCaseId")}
    unknown_queue_ids = sorted(queue_ids - binding_ids)
    if unknown_queue_ids:
        errors.append(f"verification queue contains unknown UCs: {unknown_queue_ids[:5]}")
    if sr_doc.get("policy", {}).get("automaticExecution") is not False:
        errors.append("SR automatic execution policy must remain disabled")

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "valid": not errors,
        "counts": {
            "bindings": len(bindings),
            "approvalEntries": len(ledger),
            "srRequests": len(requests),
            "verificationItems": len(queue),
            "sourceRoutes": len(route_ids),
            "sourceSduiScreens": len(sdui_screen_ids),
            "sourceApis": len(api_ids),
            "danglingPageCandidates": len(dangling_pages),
            "danglingApiCandidates": len(dangling_apis),
        },
        "errors": errors,
        "reviewFindings": {
            "danglingPageCandidates": dangling_pages,
            "danglingApiCandidates": dangling_apis,
        },
        "policy": {"automaticApproval": False, "automaticExecution": False, "automaticDeployment": False},
    }
    output = TRACE / "customer-contract-verification.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"valid": report["valid"], **report["counts"]}, ensure_ascii=False))
    if errors:
        raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()

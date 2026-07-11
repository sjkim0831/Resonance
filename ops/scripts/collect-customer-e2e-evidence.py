#!/usr/bin/env python3
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"
BASE_URL = "http://127.0.0.1"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def load(name):
    return json.loads((TRACE / name).read_text(encoding="utf-8"))


def probe(path):
    url = BASE_URL + (path if path.startswith("/") else "/" + path)
    request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json,text/html", "User-Agent": "Carbonet-Customer-Trace-E2E/1.0"})
    try:
        with OPENER.open(request, timeout=10) as response:
            return {"path": path, "httpStatus": response.status, "classification": classify(response.status), "location": response.headers.get("Location", "")}
    except urllib.error.HTTPError as error:
        return {"path": path, "httpStatus": error.code, "classification": classify(error.code), "location": error.headers.get("Location", "")}
    except Exception as error:
        return {"path": path, "httpStatus": 0, "classification": "CONNECTION_ERROR", "error": str(error)}


def classify(status):
    if 200 <= status < 300: return "REACHABLE"
    if 300 <= status < 400: return "AUTH_OR_ROUTE_REDIRECT"
    if status in (401, 403): return "AUTH_REQUIRED"
    if status == 404: return "NOT_FOUND"
    if status >= 500: return "SERVER_ERROR"
    return "OTHER"


def main():
    queue = [row for row in load("customer-verification-queue.json").get("queue", []) if row.get("stage") == "READY_FOR_E2E"]
    bindings = {row["useCaseId"]: row for row in load("customer-sdui-bindings.json").get("bindings", [])}
    source = load("resonance-source-registry.json")
    api_by_id = {row.get("assetId"): row for row in source.get("apis", [])}
    evidence = []
    for item in queue:
        binding = bindings.get(item["useCaseId"], {})
        pages = [probe(candidate["routePath"]) for candidate in binding.get("pageCandidates", [])[:3] if candidate.get("routePath")]
        apis = []
        for candidate in binding.get("apiCandidates", []):
            api = api_by_id.get(candidate.get("assetId"), {})
            method, path = api.get("method"), api.get("path")
            if not path: continue
            if method == "GET": apis.append({"method": method, **probe(path)})
            else: apis.append({"method": method, "path": path, "classification": "NOT_EXECUTED_MUTATION_SAFE"})
        runtime_failures = [row for row in pages + apis if row.get("classification") in {"NOT_FOUND", "SERVER_ERROR", "CONNECTION_ERROR"}]
        evidence.append({
            "queueId": item["queueId"], "useCaseId": item["useCaseId"], "title": item["title"], "domain": item["domain"],
            "result": "RUNTIME_GAP" if runtime_failures else "PARTIAL_RUNTIME_EVIDENCE",
            "pageChecks": pages, "apiChecks": apis,
            "requiredChecks": {
                "AUTHENTICATED_BROWSER": "PENDING_AUTH_SESSION",
                "API_RUNTIME": "READ_ONLY_CHECKED",
                "DATABASE_EFFECT": "NOT_EXECUTED_READ_ONLY",
                "AUTHORITY": "PENDING_ROLE_MATRIX",
                "AUDIT_LOG": "NOT_EXECUTED_READ_ONLY",
            },
            "automaticVerification": False,
        })
    payload = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "mode": "READ_ONLY",
        "itemCount": len(evidence), "summary": {
            "partialRuntimeEvidence": sum(row["result"] == "PARTIAL_RUNTIME_EVIDENCE" for row in evidence),
            "runtimeGap": sum(row["result"] == "RUNTIME_GAP" for row in evidence),
        },
        "policy": {"automaticVerification": False, "mutatingRequestsExecuted": False, "databaseChanged": False},
        "items": evidence,
    }
    (TRACE / "customer-e2e-readonly-evidence.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()

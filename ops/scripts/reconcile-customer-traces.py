#!/usr/bin/env python3
"""Reconcile customer trace contracts against explicit Resonance source assets."""
import argparse, json, re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

def normalize_contract(value: str) -> str:
    parts = value.strip().split(None, 1)
    if len(parts) != 2: return value.strip().upper()
    method, path = parts
    path = re.sub(r"\{[^/]+\}", "{param}", path)
    return method.upper() + " /" + path.strip("/")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", default="projects/carbonet-backend-metadata/customer-trace/customer-trace-baseline.json")
    parser.add_argument("--sources", default="projects/carbonet-backend-metadata/customer-trace/resonance-source-registry.json")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/customer-trace-reconciliation.json")
    args = parser.parse_args(); baseline = json.loads(Path(args.baseline).read_text()); sources = json.loads(Path(args.sources).read_text())
    apis = {normalize_contract(item["contract"]): item["assetId"] for item in sources["apis"]}
    screen_ids, routes = {}, {}
    for item in sources["sduiScreens"]:
        for key in ("screenId", "pageId", "menuCode"):
            if item.get(key): screen_ids[str(item[key]).upper()] = "SDUI-" + str(item.get("screenId") or item.get("pageId"))
    for item in sources["routes"]: routes[item["routeId"].upper()] = item["assetId"]
    reconciled = []
    for trace in baseline["traces"]:
        links = trace["links"]; expected_api = [normalize_contract(x) for x in links.get("apis", [])]
        expected_screens = links.get("userPages", []) + links.get("adminPages", [])
        matched_api = [apis[x] for x in expected_api if x in apis]
        matched_screen = [screen_ids.get(x.upper()) or routes.get(x.upper()) for x in expected_screens]
        matched_screen = [x for x in matched_screen if x]
        api_complete = bool(expected_api) and len(matched_api) == len(expected_api)
        ui_complete = bool(expected_screens) and len(matched_screen) == len(expected_screens)
        if api_complete and ui_complete: status = "IMPLEMENTED"
        elif matched_api or matched_screen: status = "PARTIAL"
        elif expected_screens and not expected_api: status = "UI_ONLY" if matched_screen else "NOT_STARTED"
        else: status = "NOT_STARTED"
        reconciled.append({"traceId": trace["traceId"], "requirementId": trace["requirement"]["requirementId"],
            "title": trace["requirement"]["title"], "domain": trace["requirement"]["domain"], "status": status,
            "expected": {"apis": expected_api, "screens": expected_screens},
            "matched": {"apis": matched_api, "screens": matched_screen},
            "missing": {"apis": [x for x in expected_api if x not in apis],
                "screens": [x for x in expected_screens if x.upper() not in screen_ids and x.upper() not in routes]},
            "verification": {"browser": "PENDING", "apiRuntime": "PENDING", "database": "PENDING", "authority": "PENDING"}})
    counts = Counter(item["status"] for item in reconciled)
    payload = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "traceCount": len(reconciled),
        "statusSummary": dict(sorted(counts.items())), "reconciliations": reconciled}
    output = Path(args.output); output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["statusSummary"], ensure_ascii=False, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

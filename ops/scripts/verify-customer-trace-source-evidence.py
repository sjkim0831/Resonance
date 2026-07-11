#!/usr/bin/env python3
"""Verify consensus candidates against tracked source without claiming runtime success."""
import argparse, hashlib, json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def resolve_module(root: Path, route: dict) -> Path | None:
    source = Path(route["sourcePath"]); module = route.get("modulePath", "")
    if not module: return None
    base = (root / source).parent / module
    for candidate in (base.with_suffix(".tsx"), base.with_suffix(".ts"), base / "index.tsx", base / "index.ts"):
        if candidate.is_file(): return candidate.resolve()
    return None

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", default=".")
    parser.add_argument("--consensus", default="projects/carbonet-backend-metadata/customer-trace/customer-mapping-consensus.json")
    parser.add_argument("--sources", default="projects/carbonet-backend-metadata/customer-trace/resonance-source-registry.json")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/customer-source-evidence.json")
    args = parser.parse_args(); root = Path(args.root).resolve()
    consensus = json.loads((root / args.consensus).read_text()); sources = json.loads((root / args.sources).read_text())
    routes = {item["assetId"]: item for item in sources["routes"]}; apis = {item["assetId"]: item for item in sources["apis"]}
    sdui = {"SDUI-" + str(item.get("screenId") or item.get("pageId")): item for item in sources["sduiScreens"]}
    records = []
    for mapping in consensus["mappings"]:
        uc = mapping["useCaseId"]
        for candidate in mapping.get("pages", []):
            if candidate["agreementCount"] < 2: continue
            asset = candidate["assetId"]; evidence = {"useCaseId":uc,"assetId":asset,"assetKind":"PAGE","agreementCount":candidate["agreementCount"],"runtimeStatus":"PENDING"}
            if asset in routes:
                route = routes[asset]; family = root / route["sourcePath"]; module = resolve_module(root, route)
                evidence.update({"sourceStatus":"SOURCE_CONFIRMED" if family.is_file() and module else "SOURCE_INCOMPLETE",
                    "routePath":route["koPath"],"routeFamilySource":str(family.relative_to(root)),
                    "pageModuleSource":str(module.relative_to(root)) if module else "",
                    "sourceHash":file_hash(module) if module else ""})
            elif asset in sdui:
                screen = sdui[asset]; evidence.update({"sourceStatus":"SDUI_REGISTERED","routePath":screen.get("menuUrl") or "",
                    "screenId":screen.get("screenId"),"pageId":screen.get("pageId"),"publishedStatus":screen.get("status")})
            else: evidence["sourceStatus"] = "SOURCE_MISSING"
            records.append(evidence)
        for candidate in mapping.get("apis", []):
            if candidate["agreementCount"] < 2: continue
            asset = candidate["assetId"]; api = apis.get(asset); evidence = {"useCaseId":uc,"assetId":asset,"assetKind":"API","agreementCount":candidate["agreementCount"],"runtimeStatus":"PENDING"}
            if api:
                source = root / api["sourcePath"]
                evidence.update({"sourceStatus":"SOURCE_CONFIRMED" if source.is_file() else "SOURCE_MISSING","contract":api["contract"],
                    "sourcePath":api["sourcePath"],"sourceHash":file_hash(source) if source.is_file() else ""})
            else: evidence["sourceStatus"] = "SOURCE_MISSING"
            records.append(evidence)
    summary = Counter(item["sourceStatus"] for item in records)
    payload = {"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),"policy":"source evidence is not runtime verification",
        "evidenceCount":len(records),"summary":dict(sorted(summary.items())),"records":records}
    (root / args.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload["summary"],indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

#!/usr/bin/env python3
"""Merge deterministic and model candidates without granting implementation status."""
import argparse, json
from collections import defaultdict
from pathlib import Path

FORBIDDEN = {"APPROVED", "IMPLEMENTED", "VERIFIED", "CUSTOMER_APPROVED"}

def read_json_output(path: Path) -> dict:
    text = path.read_text(errors="ignore")
    decoder = json.JSONDecoder(); candidates = []
    for index, char in enumerate(text):
        if char != "{": continue
        try:
            value, _ = decoder.raw_decode(text[index:])
            if isinstance(value, dict): candidates.append(value)
        except json.JSONDecodeError: pass
    if not candidates: raise ValueError(f"No JSON object found in {path}")
    return max(candidates, key=lambda value: len(json.dumps(value, ensure_ascii=False)))

def candidate_id(item: dict) -> str:
    return str(item.get("assetId") or item.get("screenId") or item.get("routeId") or "")

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--deterministic", required=True)
    parser.add_argument("--model", action="append", default=[]); parser.add_argument("--output", required=True)
    parser.add_argument("--reviewed-overrides", default="projects/carbonet-backend-metadata/customer-trace/customer-mapping-reviewed-overrides.json")
    args = parser.parse_args(); deterministic = json.loads(Path(args.deterministic).read_text())
    model_payloads = [read_json_output(Path(path)) for path in args.model]
    index = defaultdict(lambda: {"pages": defaultdict(list), "apis": defaultdict(list), "tables": defaultdict(list)})
    for row in deterministic.get("mappings", []):
        uc = row["useCaseId"]
        index[uc]
        for item in row.get("pageCandidates", []): index[uc]["pages"][candidate_id(item)].append({"source": "deterministic", **item})
        for item in row.get("apiCandidates", []): index[uc]["apis"][candidate_id(item)].append({"source": "deterministic", **item})
    for number, payload in enumerate(model_payloads, 1):
        for row in payload.get("mappings", []):
            if str(row.get("decision", "REVIEW_REQUIRED")).upper() in FORBIDDEN: raise ValueError("Model attempted a forbidden decision")
            uc = row.get("useCaseId", "")
            for key, target in (("pageCandidates", "pages"), ("candidates", "pages"), ("apiCandidates", "apis"), ("tableCandidates", "tables")):
                for item in row.get(key, []):
                    asset = candidate_id(item)
                    if asset: index[uc][target][asset].append({"source": f"model-{number}", **item})
    override_path = Path(args.reviewed_overrides)
    if override_path.is_file():
        reviewed = json.loads(override_path.read_text())
        for override in reviewed.get("overrides", []):
            uc = override.get("useCaseId", "")
            if override.get("replacePageCandidates"): index[uc]["pages"].clear()
            if override.get("replaceApiCandidates"): index[uc]["apis"].clear()
            if override.get("replaceTableCandidates"): index[uc]["tables"].clear()
            for key, target in (("pageCandidates", "pages"), ("apiCandidates", "apis"), ("tableCandidates", "tables")):
                for item in override.get(key, []):
                    asset = candidate_id(item)
                    if asset: index[uc][target][asset].append({"source": "reviewed-technical", **item})
    mappings = []
    for uc in sorted(index):
        result = {"useCaseId": uc, "decision": "REVIEW_REQUIRED", "automaticApproval": False}
        for key in ("pages", "apis", "tables"):
            values = []
            for asset, evidence in index[uc][key].items():
                sources = sorted({item["source"] for item in evidence})
                values.append({"assetId": asset, "agreementCount": len(sources), "sources": sources,
                    "maxConfidence": max(float(item.get("confidence", 0)) for item in evidence), "evidence": evidence})
            result[key] = sorted(values, key=lambda item: (-item["agreementCount"], -item["maxConfidence"], item["assetId"]))[:5]
        mappings.append(result)
    payload = {"schemaVersion": 1, "policy": "human-review-required", "modelOutputCount": len(model_payloads),
        "useCaseCount": len(mappings), "mappings": mappings}
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"modelOutputCount": len(model_payloads), "useCaseCount": len(mappings)}, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

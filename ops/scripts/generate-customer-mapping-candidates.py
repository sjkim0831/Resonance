#!/usr/bin/env python3
"""Generate conservative deterministic mapping candidates for model comparison."""
import argparse, json, re
from difflib import SequenceMatcher
from pathlib import Path

STOP = {"관리", "조회", "목록", "등록", "수정", "처리", "화면", "정보", "사용자", "관리자"}

def tokens(value: str) -> set[str]:
    parts = re.findall(r"[가-힣]{2,}|[a-z0-9]+", value.lower().replace("_", " ").replace("-", " "))
    return {part for part in parts if part not in STOP}

def similarity(left: str, right: str) -> float:
    left, right = left.lower().strip(), right.lower().strip()
    if not left or not right: return 0.0
    a, b = tokens(left), tokens(right); overlap = len(a & b) / max(1, len(a | b))
    sequence = SequenceMatcher(None, left, right).ratio()
    contains = 1.0 if left in right or right in left else 0.0
    return min(0.89, 0.50 * overlap + 0.35 * sequence + 0.15 * contains)

def page_candidates(trace: dict, sources: dict) -> list[dict]:
    title = trace["requirement"]["title"]
    expected = " ".join(trace["links"].get("userPages", []) + trace["links"].get("adminPages", []))
    candidates = {}
    for route in sources["routes"]:
        score = max(similarity(title, route.get("label", "")), similarity(expected, route["routeId"]))
        if score >= 0.40: candidates[route["assetId"]] = {"assetId": route["assetId"], "path": route["koPath"], "label": route.get("label", ""), "confidence": round(score, 3), "reasons": ["title/route deterministic similarity"]}
    for screen in sources["sduiScreens"]:
        key = "SDUI-" + str(screen.get("screenId") or screen.get("pageId")); score = max(similarity(title, str(screen.get("menuNm") or "")), similarity(expected, str(screen.get("pageId") or "")))
        if score >= 0.40 and (key not in candidates or score > candidates[key]["confidence"]):
            candidates[key] = {"assetId": key, "path": screen.get("menuUrl") or "", "label": screen.get("menuNm") or "", "confidence": round(score, 3), "reasons": ["title/SDUI deterministic similarity"]}
    return sorted(candidates.values(), key=lambda x: (-x["confidence"], x["assetId"]))[:5]

def api_candidates(trace: dict, sources: dict) -> list[dict]:
    expected = trace["links"].get("apis", []); results = []
    for api in sources["apis"]:
        actual_method = api["method"]
        best = 0.0
        for contract in expected:
            parts = contract.split(None, 1); method = parts[0].upper() if parts else ""; path = parts[1] if len(parts) > 1 else ""
            method_score = 1.0 if method == actual_method else (0.5 if actual_method == "ANY" else 0.0)
            path_score = similarity(path, api["path"])
            best = max(best, path_score * (0.70 + 0.30 * method_score))
        if best >= 0.45: results.append({"assetId": api["assetId"], "contract": api["contract"], "confidence": round(min(best, 0.89), 3), "reasons": ["HTTP method/path deterministic similarity"]})
    return sorted(results, key=lambda x: (-x["confidence"], x["assetId"]))[:5]

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--baseline", default="projects/carbonet-backend-metadata/customer-trace/customer-trace-baseline.json")
    parser.add_argument("--sources", default="projects/carbonet-backend-metadata/customer-trace/resonance-source-registry.json")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/deterministic-mapping-candidates.json")
    args = parser.parse_args(); baseline = json.loads(Path(args.baseline).read_text()); sources = json.loads(Path(args.sources).read_text())
    mappings = []
    for trace in baseline["traces"]:
        pages, apis = page_candidates(trace, sources), api_candidates(trace, sources)
        mappings.append({"useCaseId": trace["requirement"]["requirementId"], "pageCandidates": pages, "apiCandidates": apis,
            "decision": "REVIEW_REQUIRED", "automaticApproval": False})
    payload = {"schemaVersion": 1, "engine": "deterministic-baseline-v1", "useCaseCount": len(mappings), "mappings": mappings}
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"useCaseCount": len(mappings), "withPageCandidates": sum(bool(x["pageCandidates"]) for x in mappings), "withApiCandidates": sum(bool(x["apiCandidates"]) for x in mappings)}, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

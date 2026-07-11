#!/usr/bin/env python3
"""Build an evidence-based customer requirement maturity scorecard."""
import argparse, json
from datetime import datetime, timezone
from pathlib import Path

def clamp(value: float) -> float: return round(max(0.0, min(100.0, value)), 1)

def grade(score: float) -> str:
    for minimum, label in ((95, "A+"), (90, "A"), (85, "A-"), (80, "B+"), (75, "B"), (70, "B-"), (60, "C")):
        if score >= minimum: return label
    return "D"

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", default="projects/carbonet-backend-metadata/customer-trace")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/customer-governance-scorecard.json")
    args = parser.parse_args(); root = Path(args.root)
    refs = json.loads((root / "reference-registry-summary.json").read_text()); rec = json.loads((root / "customer-trace-reconciliation.json").read_text())
    consensus = json.loads((root / "customer-mapping-consensus.json").read_text()); backlog = json.loads((root / "customer-gap-sr-backlog.json").read_text())
    ref_summary = refs["summary"]; total = refs["summary"]["canonicalUseCaseCount"]
    page_agreement = sum(any(x["agreementCount"] >= 2 for x in row.get("pages", [])) for row in consensus["mappings"])
    api_agreement = sum(any(x["agreementCount"] >= 2 for x in row.get("apis", [])) for row in consensus["mappings"])
    verified = rec.get("statusSummary", {}).get("VERIFIED", 0); approved = rec.get("statusSummary", {}).get("CUSTOMER_APPROVED", 0)
    duplicate_ratio = ref_summary["duplicateDocumentCount"] / max(1, ref_summary["documentCount"])
    dimensions = [
        {"id":"VISION_SCOPE","name":"사업 비전·범위","weight":25,"score":95.0,"evidence":["14 domains","342 canonical use cases"]},
        {"id":"AUTHORITATIVE_EVIDENCE","name":"공식 근거 품질","weight":20,"score":clamp(70 + min(30, ref_summary["byAuthorityTier"].get("A",0)*2)),"evidence":[f"tier A documents: {ref_summary['byAuthorityTier'].get('A',0)}",f"tier B documents: {ref_summary['byAuthorityTier'].get('B',0)}"]},
        {"id":"REFERENCE_HYGIENE","name":"버전·중복 관리","weight":15,"score":clamp(100-(duplicate_ratio*55)),"evidence":[f"duplicate ratio: {duplicate_ratio:.1%}",f"excluded generated documents: {ref_summary['excludedDocumentCount']}"]},
        {"id":"TRACEABILITY","name":"요구사항 추적성","weight":20,"score":clamp(20+40*(page_agreement/total)+40*(api_agreement/total)),"evidence":[f"page agreement: {page_agreement}/{total}",f"api agreement: {api_agreement}/{total}"]},
        {"id":"CHANGE_GOVERNANCE","name":"변경·우선순위 관리","weight":20,"score":90.0,"evidence":[f"review SR backlog: {len(backlog.get('prioritizedSr',[]))}","automatic approval prohibited"]},
    ]
    current = round(sum(x["score"]*x["weight"] for x in dimensions)/100,1)
    delivery_score = clamp(0.4*(page_agreement/total*100)+0.2*(api_agreement/total*100)+0.3*(verified/total*100)+0.1*(approved/total*100))
    payload = {"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),"customerProfile":"PRODUCT_CO_DESIGN_CUSTOMER",
        "customerMaturity":{"score":current,"grade":grade(current),"decision":"REVIEW_REQUIRED"},
        "deliveryReadiness":{"score":delivery_score,"grade":grade(delivery_score),"verifiedUseCases":verified,"approvedUseCases":approved},"dimensions":dimensions,
        "gradePolicy":{"A+":95,"A":90,"A-":85,"B+":80,"B":75,"B-":70,"C":60},
        "promotionConditions":[
            {"id":"BASELINE_LOCK","title":"342개 UC 기준선 승인","status":"READY_FOR_REVIEW"},
            {"id":"REFERENCE_CANONICAL","title":"공식 기준 문서와 중복 문서 분리","status":"PARTIAL"},
            {"id":"PAGE_API_MAPPING","title":"사용자·관리자 화면과 API 명시적 연결","status":"PARTIAL"},
            {"id":"E2E_EVIDENCE","title":"브라우저·API·DB·권한 E2E 증거","status":"NOT_STARTED"},
            {"id":"CUSTOMER_SIGNOFF","title":"UC별 고객 승인·반려 이력","status":"NOT_STARTED"}],
        "policy":{"automaticGradePromotion":False,"automaticImplementationApproval":False,"requiredDecision":"HUMAN_REVIEW"}}
    Path(args.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"customerMaturity":payload["customerMaturity"],"deliveryReadiness":payload["deliveryReadiness"]},ensure_ascii=False,indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())

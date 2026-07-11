#!/usr/bin/env python3
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"


def load(name):
    path = TRACE / name
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def main():
    queue = load("customer-verification-queue.json")
    readonly = load("customer-e2e-readonly-evidence.json")
    auth = load("customer-auth-ledger-e2e-evidence.json")
    scorecard = load("customer-governance-scorecard.json")
    approvals = load("customer-approval-ledger.json")
    stage_counts = Counter(row.get("stage") for row in queue.get("queue", []))
    runtime_gaps = [row for row in readonly.get("items", []) if row.get("result") == "RUNTIME_GAP"]
    workstreams = [
        {"priority": 1, "id": "RUNTIME_GAP_REPAIR", "itemCount": len(runtime_gaps), "exitCriteria": "No confirmed 404/5xx candidate API remains without an SR decision", "automation": "AI_IMPLEMENT_HUMAN_REVIEW"},
        {"priority": 2, "id": "AUTHENTICATED_BROWSER_E2E", "itemCount": stage_counts.get("READY_FOR_E2E", 0), "exitCriteria": "Role-specific browser, API, DB effect, authority, and audit evidence attached", "automation": "EPHEMERAL_FIXTURE_AND_PLAYWRIGHT"},
        {"priority": 3, "id": "PAGE_VERIFICATION", "itemCount": stage_counts.get("READY_FOR_PAGE_VERIFICATION", 0), "exitCriteria": "Desktop/mobile render, interaction, accessibility, and visual evidence attached", "automation": "PLAYWRIGHT_VISUAL_A11Y"},
        {"priority": 4, "id": "API_VERIFICATION", "itemCount": stage_counts.get("READY_FOR_API_VERIFICATION", 0), "exitCriteria": "Contract, authorization, persistence, idempotency, and failure behavior verified", "automation": "CONTRACT_TEST_SAFE_DATA"},
        {"priority": 5, "id": "CANDIDATE_REVIEW", "itemCount": stage_counts.get("CANDIDATE_REVIEW", 0), "exitCriteria": "Human accepts or rejects page/API/DB candidates with evidence", "automation": "AI_RECOMMEND_HUMAN_DECIDE"},
        {"priority": 6, "id": "MAPPING_REQUIRED", "itemCount": stage_counts.get("MAPPING_REQUIRED", 0), "exitCriteria": "At least one evidence-backed asset mapping or explicit new-build SR exists", "automation": "AI_DISCOVER_HUMAN_DECIDE"},
        {"priority": 7, "id": "CUSTOMER_SIGNOFF", "itemCount": approvals.get("stateSummary", {}).get("PENDING", 0), "exitCriteria": "Customer reviewer approves or rejects every canonical UC; VERIFIED always includes evidence", "automation": "HUMAN_ONLY_DECISION"}
    ]
    plan = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "mission": "Complete the customer project by converting every canonical UC into an evidence-backed, customer-approved delivery outcome.",
        "currentState": {
            "canonicalUseCases": queue.get("queueCount", 0),
            "customerMaturity": scorecard.get("customerMaturity", {}),
            "deliveryReadiness": scorecard.get("deliveryReadiness", {}),
            "queueSummary": dict(stage_counts),
            "readOnlyE2E": readonly.get("summary", {}),
            "authLedgerE2E": auth.get("result", "NOT_RUN"),
            "approvalSummary": approvals.get("stateSummary", {})
        },
        "requiredCapabilities": [
            "Ephemeral role-based test accounts with automatic cleanup",
            "Authenticated Playwright desktop/mobile runner",
            "Safe seeded test datasets and transaction rollback",
            "OpenAPI and runtime contract comparison",
            "Database before/after effect and audit-log correlation",
            "Visual regression, accessibility, localization, and responsive checks",
            "SR implementation sandbox with file allow-list and diff review",
            "Zero-downtime Flyway/Liquibase migration and rollback evidence",
            "Customer review inbox with approve/reject/comment/evidence workflow",
            "Release scorecard that blocks promotion on missing evidence"
        ],
        "workstreams": workstreams,
        "promotionGate": {
            "automaticImplemented": False,
            "automaticVerified": False,
            "requiredForVerified": ["AUTHENTICATED_BROWSER", "API_RUNTIME", "DATABASE_EFFECT", "AUTHORITY", "AUDIT_LOG", "HUMAN_REVIEWER", "EVIDENCE_REFS"],
            "requiredForRelease": ["PATRONI_HEALTHY", "BACKUP_VERIFIED", "MIGRATIONS_VALID", "ROLLING_DEPLOYMENT_READY", "NO_CRITICAL_RUNTIME_GAPS"]
        }
    }
    (TRACE / "customer-ai-completion-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"workstreams": len(workstreams), "runtimeGaps": len(runtime_gaps), "pendingApprovals": plan["currentState"]["approvalSummary"].get("PENDING", 0)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

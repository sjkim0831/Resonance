#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"
BINDINGS = TRACE / "customer-sdui-bindings.json"
OUTPUT = TRACE / "customer-approval-ledger.json"

ALLOWED_STATES = {"PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "VERIFIED"}


def load(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else default


def main():
    bindings = load(BINDINGS, {}).get("bindings", [])
    previous = {row["useCaseId"]: row for row in load(OUTPUT, {}).get("entries", [])}
    entries = []
    for binding in bindings:
        use_case_id = binding["useCaseId"]
        row = previous.get(use_case_id, {})
        state = row.get("state", "PENDING")
        if state not in ALLOWED_STATES:
            raise SystemExit(f"Invalid approval state: {use_case_id}={state}")
        entries.append({
            "useCaseId": use_case_id,
            "traceId": binding["traceId"],
            "title": binding["title"],
            "domain": binding["domain"],
            "state": state,
            "reviewer": row.get("reviewer"),
            "reviewedAt": row.get("reviewedAt"),
            "evidenceRefs": row.get("evidenceRefs", []),
            "comment": row.get("comment", ""),
            "automaticApproval": False,
        })
    state_summary = {s: sum(e["state"] == s for e in entries) for s in sorted(ALLOWED_STATES)}
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "entryCount": len(entries),
        "stateSummary": state_summary,
        "policy": {
            "automaticApproval": False,
            "approvalRequiresReviewer": True,
            "verificationRequiresEvidence": True,
            "allowedStates": sorted(ALLOWED_STATES),
        },
        "entries": entries,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"entryCount": len(entries), "states": state_summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()

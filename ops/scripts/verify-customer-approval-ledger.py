#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRACE = ROOT / "projects/carbonet-backend-metadata/customer-trace"
ledger = json.loads((TRACE / "customer-approval-ledger.json").read_text(encoding="utf-8"))
bindings = json.loads((TRACE / "customer-sdui-bindings.json").read_text(encoding="utf-8"))

errors = []
entries = ledger.get("entries", [])
if ledger.get("entryCount") != len(entries) or len(entries) != bindings.get("bindingCount"):
    errors.append("approval and binding counts differ")
if ledger.get("policy", {}).get("automaticApproval") is not False:
    errors.append("automatic approval must remain disabled")
for row in entries:
    if row.get("automaticApproval") is not False:
        errors.append(f"{row.get('useCaseId')}: automatic approval is enabled")
    if row.get("state") in {"APPROVED", "VERIFIED"} and not row.get("reviewer"):
        errors.append(f"{row.get('useCaseId')}: reviewer is required")
    if row.get("state") == "VERIFIED" and not row.get("evidenceRefs"):
        errors.append(f"{row.get('useCaseId')}: evidence is required")
if errors:
    raise SystemExit("\n".join(errors))
print(json.dumps({"valid": True, "entryCount": len(entries)}, ensure_ascii=False))

# Carbonet text-first executable webapp specification

This directory is the design baseline used before Java backend and frontend
implementation. It is generated, deterministic and machine validated.

## Generation

```powershell
python ops/scripts/generate-executable-webapp-spec.py
python ops/scripts/generate-executable-webapp-spec.py --check
```

Generated outputs live in `generated/`:

- `legal-sources.json`: applicable official-law and standard-source catalogue
- `actors.json`: identity, assignment, delegation, conflict and privacy context
- `processes.json`: end-to-end processes, states, commands and completion rules
- `screens.json`: pages, actions, states and lookup-popup contracts
- `apis.json`: immediately implementable API/transaction contracts
- `data-contracts.json`: data ownership, classification and change propagation
- `test-scenarios.jsonl`: executable Given/When/Then scenario inventory
- `flow-graph.json`: horizontal swimlane graph input
- `manifest.json`: counts and quality-gate result

Large machine files are intentionally regenerated locally and ignored by Git;
the generator, the human-readable complete design, horizontal flowcharts and
manifest are versioned. This prevents a 10+ MB scenario file from obscuring
source review while keeping generation reproducible.

## Completion rule

`machineValidation=PASSED` proves structural completeness only: unique IDs, no
orphan step, every step linked to screen/API/data contracts, and all mandatory
scenario families. Legal interpretation and customer-specific policy remain
`domainApproval=PENDING` until a responsible domain owner approves them.

No Java or frontend generation may start for a process unless both gates pass.

## Reference ingestion contract

Every source document must later be catalogued with its absolute source path,
content hash, extraction time, requirement IDs, confidence and approval state.
Conflicts are never silently overwritten; they become `DECISION_REQUIRED` items.

Sensitive user data is represented only by field classification and synthetic
test rules. Real names, phone numbers, credentials, identity numbers, account
numbers and certificates must never be copied into generated scenarios.

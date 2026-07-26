# System design generator

The generator projects one live PostgreSQL/source snapshot into two synchronized outputs:

1. Twenty DOCX files (19 design document types, including the screen detailed design, plus the coverage index).
2. Agent-ready development packets for every professional screen contract.

Documents are evidence for people. Development agents must consume the JSON packet generated from the same snapshot, not reverse-engineer DOCX prose.

## Commands

```bash
cd /opt/Resonance
bash ops/scripts/generate-system-design-deliverables.sh generate
bash ops/scripts/generate-system-design-deliverables.sh check
```

`generate` reuses the current last-known-good output when the semantic snapshot and generator sources are unchanged. `force` rebuilds everything. `dev-only` refreshes development packets and reuses the last document pack.

The default budget is 175 seconds. A failed or over-budget run never replaces `var/ai-runtime/system-design-generator/latest`.

## Development workflow

1. Select an item from `latest/development/work-queue.json`.
2. Open the matching `latest/development/packets/*.json` contract.
3. Read `design.layout` before implementation. DOM order and CSS Grid/Flex constraints are authoritative; reference coordinates are visual-regression evidence.
4. Preserve actor, process, task, route, API, data, authority, accessibility and test traceability.
5. Use `/admin/system/build-studio` and no-build metadata/asset paths first.
6. Run changed-route smoke, then the full-screen quality gate.
7. If core runtime, schema or security changes are required, revise and approve the design contract before implementation.

Kilo M2.7 entry points:

```bash
bash ops/scripts/start-kilo-design-driven-agent.sh prepare [contract_id]
bash ops/scripts/start-kilo-design-driven-agent.sh plan [contract_id]
bash ops/scripts/start-kilo-design-driven-agent.sh interactive [contract_id]
```

## Self-recovery

Every successful run is immutable. `latest` moves atomically only after ZIP, document-count and development-manifest validation. The previous successful run remains available by run ID and development packet replacement retains a `.last-known-good` directory inside the run while compiling.

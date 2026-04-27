# Deterministic 3B Agent Playbook

Purpose: make Ollama-scale models useful by removing guessing. The model should not search the whole repository. Code and maps decide where to look; the model ranks, edits, and explains.

Canonical root: /opt/Resonance.

Default flow:

1. Classify the request into one zone: operations-platform, common-framework, project-carbonet, or builder-system.
2. Load data/ai-runtime/deterministic-route-map.json.
3. Select at most 12 read files and at most 6 implementation files.
4. If a URL or menu is given, resolve route/menu metadata before reading source.
5. If no deterministic route is found, return NEEDS_ROUTE_MAP with the missing signal.
6. Implement only after listing exact files.
7. Verify with Maven, frontend build, k8s smoke, or a script gate.
8. Write back only verified route hints.

3B model rule:

- Good for bounded edits, DTO/schema changes, page cloning from nearby examples, simple mapper/service/controller additions, docs, manifests, and script parameterization.
- Not enough for open-ended architecture. For those, use a larger planner once, then return to deterministic small-model implementation.

Hard stop conditions:

- More than 40 candidate files.
- More than 6 files to edit.
- Unknown project/common boundary.
- Any DB migration without rollback/check SQL.
- Any deploy/restart/rollback without backup gate.

Expected output before implementation:

- zone
- selected_files
- reason_per_file
- verification_gate
- rollback_note

# Executable design governance

The screen generator is allowed to promote output only when the deterministic
quality gate succeeds. A generated file count is not completion evidence.

The canonical design contract must define:

- process, step, actor, route, states and permissions;
- input and output SchemaSet references;
- fields, validation, option sources and responsive sections;
- query and command APIs;
- executable test expectations.

`quality_gate.py` emits three machine-readable artifacts:

- `design-manifest.json`: versioned hashes and changed contracts;
- `impact-graph.json`: process to screen to field/API dependencies;
- `promotion-report.json`: blockers, warnings and promotion decision.

The gate is fail-closed. Missing design data, duplicate route ownership,
invalid generated React hooks and duplicate Java signatures prevent promotion.
Handwritten behavior must live outside generated directories and be connected
through stable extension interfaces; regeneration never owns extension files.

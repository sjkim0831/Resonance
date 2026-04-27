# Skill Boundaries

This document defines the current Carbonet skill taxonomy, overlap rules, and the preferred selection order.

For `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`, the single live entry pair is:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`

Use this as supporting maintenance-contract guidance only:

- `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`

Current active continuation target:

- row `3`
- `builder observability metadata/resource family`
- blocker-resolution state across rows `3` and `5`
- row `4` remains a stronger non-blocker support row
- compressed blocker control docs:
  - `docs/architecture/builder-resource-blocker-source-sentence-matrix.md`
  - `docs/architecture/builder-resource-blocker-source-trigger-matrix.md`
- remaining docs-only valid work is limited to watched-source change detection plus exact missing-sentence confirmation
- canonical partial phrase:
  - `PARTIAL_DONE: builder resource ownership closure still counts rows 3 and 5 as blockers, rows 1 and 2 now carry bounded DELETE_NOW notes, row 4 now carries a stronger non-blocker note, and unresolved fallback blocker count is <n>.`

## Skill Groups

### Coordination

- `carbonet-ai-session-orchestrator`
  - Role: classify ownership, split work safely, and define session boundaries.
  - Use first when the request can touch shared files, cross-cutting contracts, or multi-step implementation.
  - Do not use as the primary implementation guide for feature logic or page behavior.
- `carbonet-common-project-boundary-switcher`
  - Role: keep work reversible between common-platform ownership and project-specific ownership.
  - Use before implementation when the request is about common vs project splitting, jar extraction, adapter lines, common DB vs project DB ownership, menu scope separation, page-by-page systemization, installable page rebinding, or "make this easy to move later".
  - Do not use as the primary guide for detailed page behavior or ordinary feature CRUD.

### Source interpretation

- `carbonet-screen-design-workspace`
  - Role: interpret `/home/imaneya/workspace/화면설계` and decide which design artifact is canonical.
  - Use before implementation when the request is design-led or when duplicated HTML/design outputs conflict.
  - Hand off to `carbonet-feature-builder` after scope, route, actor, and workflow are resolved.

### Feature implementation

- `carbonet-screen-builder`
  - Role: design and implement builder-managed, installable, authority-scope-complete page units and the governed builder console.
  - Use when the request is really about systemizing pages for builder/runtime/install flows, even if drag-and-drop UI is not the only concern.
  - Pair with `carbonet-common-project-boundary-switcher` when common-vs-project rebinding is central.
- `carbonet-feature-builder`
  - Role: implement Carbonet menus, pages, services, mappers, templates, metadata, and related admin flows.
  - Use after the design source is known and the session boundary is understood.
  - Do not use as the primary guide for central Codex runner behavior, cache-delivery policy, or system-wide observability architecture.

### Specialized admin execution

- `carbonet-codex-execution-console`
  - Role: extend `/admin/system/codex-request`, SR Workbench execution lifecycle, runner scripts, and Codex handoff behavior.
  - Use when the request is specifically about the Codex runner, `prepare -> plan -> build`, stack/queue behavior, or console page-data ownership.
  - If the task also changes ordinary admin menus or screen CRUD, pair with `carbonet-feature-builder` but keep execution-console ownership primary.
- `carbonet-codex-token-optimizer`
  - Role: optimize token usage by selecting the most efficient execution mode (`explain`, `plan`, `prompt`, `apply`) in the Codex launcher.
  - Use whenever a prompt is prepared for `codex` or `freeagent` to ensure appropriate context levels.
  - Priority: use alongside any implementation skill to verify cost-effectiveness.

### Cross-cutting architecture

- `carbonet-audit-trace-architecture`
  - Role: define audit, trace, UI manifest, registry, and rollout governance across backend and frontend.
  - Use when the request is about tracking, metadata design, queryability, system-wide governance, or repository-level algorithm/data-structure upgrades tied to observability and governance paths.
  - If the task later becomes page implementation, hand off execution details to `carbonet-feature-builder`.

### Delivery consistency

- `carbonet-react-refresh-consistency`
  - Role: preserve correct refresh behavior for React assets, shell HTML, manifest resolution, and deployment packaging.
  - Use only when the problem is static-asset delivery, refresh visibility, or cache boundaries.
  - Do not use as the primary skill for page behavior or business workflows.
- `carbonet-fast-bootstrap-ops`
  - Role: preserve the shortest safe compile -> package -> restart -> runtime-verification path so the newest output is what the local server actually runs.
  - Use when the issue is stale runtime jar, stale bootstrap output, uncertain local deploy sequence, or restart verification rather than server topology or business behavior.
  - Pair with `carbonet-react-refresh-consistency` when hard-refresh behavior and packaging freshness must both be correct.

### Infrastructure operations

- `carbonet-runtime-topology-ops`
  - Role: define runtime topology, server-role splits, idle-node pooling, Jenkins plus Nomad coordination, central operations-system build ownership, tmux rollout layout, DB/file placement rules, main-server runtime-truth rules, and installable module attachment or detachment boundaries for runtime nodes.
  - Use when the request is about how Carbonet services should be deployed, shared, scaled, centrally built, version-bound, separated across small-memory nodes, or attached as plug-in style operational capabilities.
  - Do not use as the primary guide for application feature code, screen behavior, or Codex execution-console internals.

## Common Overlaps

### `carbonet-screen-design-workspace` vs `carbonet-feature-builder`

- Use `carbonet-screen-design-workspace` to decide what the screen should be.
- Use `carbonet-feature-builder` to implement it in Carbonet.
- Rule: design interpretation first, repository implementation second.

### `carbonet-common-project-boundary-switcher` vs implementation skills

- Use `carbonet-common-project-boundary-switcher` to decide what should become common, what should stay project-owned, and where ports, adapters, wrappers, or def-plus-bind splits are needed first.
- Use `carbonet-feature-builder` or `carbonet-screen-builder` after that to implement the chosen shape.
- Rule: reversible ownership first, concrete implementation second.
- For builder structure-governance closure questions, read `docs/architecture/builder-structure-wave-20260409-closure.md` first and do not reopen the family-close decision during later implementation slices.

### `carbonet-screen-builder` vs `carbonet-feature-builder`

- Use `carbonet-screen-builder` when the requested outcome is a builder-managed page unit, installable page family, governed manifest, or page-systemization rule.
- Use `carbonet-feature-builder` when the requested outcome is a normal Carbonet business page or admin feature implementation that is not primarily about builder-managed reuse.
- Rule: systemized page unit first means `carbonet-screen-builder`; ordinary feature implementation first means `carbonet-feature-builder`.

### Builder work vs folder cleanup

- Do not assume builder work and folder cleanup must always be split into separate waves.
- If the cleanup stays inside the same builder ownership family, prefer implementing the builder slice and cleaning its folder placement in the same turn.
- If the cleanup crosses many shared paths or owner families, use a dedicated refactor wave instead.
- If the request is specifically about “what is closed in this wave”, “which path is source of truth”, or “whether the old path is a shim or delete candidate”, treat that as a structure-governance wave first, not as ordinary builder implementation.
- If the request has already accepted structure-governance closure and now asks which builder resource owner is canonical or whether a root resource still blocks closeout, treat it as the resource-ownership family instead of reopening the structure-governance family.
- For active builder resource-ownership continuation, treat these as the single live entry pair before picking the next row-specific review card:
  - `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
  - `docs/architecture/builder-resource-ownership-queue-map.md`
- If routing guidance changes blocker count, active row, next review target, or partial-closeout wording, update both docs in the same turn.

### `carbonet-feature-builder` vs `carbonet-codex-execution-console`

- Use `carbonet-codex-execution-console` when the core problem is Codex runner behavior, queue/stack flow, console page-data, or runner scripts.
- Use `carbonet-feature-builder` when the core problem is a normal menu/page/service/template feature.
- Rule: if `/admin/system/codex-request` or SR execution semantics are central, execution-console owns the task.

### `carbonet-feature-builder` vs `carbonet-audit-trace-architecture`

- Use `carbonet-audit-trace-architecture` to define what must be logged, traced, registered, or governed.
- Use `carbonet-feature-builder` to wire those requirements into a concrete page or service.
- Rule: architecture decisions first, feature wiring second.

### `carbonet-react-refresh-consistency` vs page-focused skills

- Use `carbonet-react-refresh-consistency` only when the issue is refresh mismatch, stale bundles, manifest/cache policy, or runtime jar packaging.
- Use the feature-oriented skill when the request is about the page behavior itself.

### `carbonet-fast-bootstrap-ops` vs `carbonet-react-refresh-consistency`

- Use `carbonet-fast-bootstrap-ops` when the main concern is command order, packaging freshness, restart safety, or proving the newest output is actually running.
- Use `carbonet-react-refresh-consistency` when the main concern is shell cache policy, manifest resolution, or browser freshness behavior.
- Rule: bootstrap ops owns build/package/restart/runtime-proof; react-refresh owns cache strategy.

## Selection Order

1. Start with `carbonet-ai-session-orchestrator` when ownership or conflict risk is unclear.
2. Use `carbonet-common-project-boundary-switcher` when common/project reversibility, extraction, or adapter boundaries are central.
3. Use `carbonet-screen-design-workspace` if the task is design-driven.
4. Choose exactly one primary implementation skill:
  - `carbonet-screen-builder`
  - `carbonet-feature-builder`
  - `carbonet-codex-execution-console`
  - `carbonet-audit-trace-architecture`
  - `carbonet-react-refresh-consistency`
  - `carbonet-fast-bootstrap-ops`
5. Add a secondary skill only when the task truly spans both domains.

Default session rule:

- if the current active sessions already cover the required ownership families safely, continue with them instead of opening additional implementation lanes
- for builder-oriented platformization, common/project boundary moves, large folder moves, or ownership-closure work, use four sessions as the default work partition regardless of account count

## Anti-Duplication Rules

- Do not repeat the same “read these references first” lists across unrelated skills unless the references are truly mandatory for that skill.
- Keep broad implementation rules in `carbonet-feature-builder`.
- Keep system-wide governance rules in `carbonet-audit-trace-architecture`.
- Keep Codex runner lifecycle rules in `carbonet-codex-execution-console`.
- Keep refresh/cache rules in `carbonet-react-refresh-consistency`.
- Keep design-source selection rules in `carbonet-screen-design-workspace`.
- Keep installable module, server-role, and topology plug-in rules in `carbonet-runtime-topology-ops`.

## Current Practical Mapping

- New admin screen from design workspace:
  - `carbonet-ai-session-orchestrator` -> `carbonet-screen-design-workspace` -> `carbonet-feature-builder`
- Builder-ready or installable page-systemization work:
  - `carbonet-ai-session-orchestrator` -> `carbonet-common-project-boundary-switcher` -> `carbonet-screen-builder`
- Codex queue or SR execution change:
  - `carbonet-ai-session-orchestrator` -> `carbonet-codex-execution-console`
- Audit/trace registry rollout:
  - `carbonet-ai-session-orchestrator` -> `carbonet-audit-trace-architecture`
- React page works in source but stays stale after deploy:
  - `carbonet-ai-session-orchestrator` -> `carbonet-react-refresh-consistency`
- Infrastructure topology or runtime resource planning:
  - `carbonet-ai-session-orchestrator` -> `carbonet-runtime-topology-ops`

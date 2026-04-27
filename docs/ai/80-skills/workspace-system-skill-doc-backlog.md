# Workspace System Skill And Doc Backlog

Grounded on the current Carbonet workspace-system code paths as of 2026-03-28.

Use this backlog when deciding which new `skills` or `docs` should be added so Codex can move faster on the operations workspace without re-discovering the same flow every turn.

## Why This Exists

The repository already has strong architecture coverage, but the workspace system still spreads execution knowledge across:

- `codex-request`
- `sr-workbench`
- `screen-builder`
- `screen-runtime`
- `current-runtime-compare`
- `repair-workbench`
- `help-management` and screen-command metadata
- `observability`

That means Codex can usually find the pieces, but still spends time reassembling:

- which screen owns which workflow step
- which controller/service pair owns which action
- which storage is file-backed versus DB-backed
- which actions are still bridge behavior versus governed control-plane behavior

## Current Code Anchors

Primary backend anchors:

- `src/main/java/egovframework/com/platform/codex/web/CodexProvisionAdminApiController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminSrWorkbenchController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminScreenBuilderController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminHelpManagementController.java`
- `src/main/java/egovframework/com/feature/admin/web/AdminObservabilityController.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/SrTicketWorkbenchServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/SrTicketCodexRunnerServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/ScreenBuilderDraftServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/ScreenCommandCenterServiceImpl.java`

Primary frontend anchors:

- `frontend/src/features/codex-provision/CodexProvisionMigrationPage.tsx`
- `frontend/src/features/sr-workbench/SrWorkbenchMigrationPage.tsx`
- `frontend/src/features/screen-builder/ScreenBuilderMigrationPage.tsx`
- `frontend/src/features/screen-builder/ScreenRuntimeMigrationPage.tsx`
- `frontend/src/features/screen-builder/CurrentRuntimeCompareMigrationPage.tsx`
- `frontend/src/features/screen-builder/RepairWorkbenchMigrationPage.tsx`
- `frontend/src/features/help-management/HelpManagementMigrationPage.tsx`
- `frontend/src/features/help-management/ScreenCommandCenterPanel.tsx`
- `frontend/src/features/observability/ObservabilityMigrationPage.tsx`

## Highest-Value New Skills

### 1. `carbonet-workspace-flow-governor`

Use for:

- end-to-end workspace work spanning `codex-request`, `sr-workbench`, `help-management`, and `screen-command` linkage
- right-click capture to SR ticket to `prepare -> plan -> build` flow changes
- queue, stack, ticket, artifact-preview, and reissue ownership questions

Why it should exist:

- `carbonet-codex-execution-console` covers runner behavior well, but not the full operator workspace bridge from screen context capture to queue and ticket lifecycle
- repeated work now spans UI capture, page-data composition, controller ownership, and file-backed storage conventions

Recommended references:

- `docs/architecture/codex-execution-console-handoff.md`
- `src/main/java/egovframework/com/feature/admin/service/impl/ScreenCommandCenterServiceImpl.java`
- `src/main/java/egovframework/com/feature/admin/service/impl/SrTicketWorkbenchServiceImpl.java`
- `frontend/src/features/sr-workbench/SrWorkbenchMigrationPage.tsx`
- `frontend/src/features/codex-provision/CodexProvisionMigrationPage.tsx`

### 2. `carbonet-builder-workspace-ops`

Use for:

- `screen-builder`, `screen-runtime`, `current-runtime-compare`, and `repair-workbench`
- draft/version/restore/publish flow changes
- component-registry, scan, remap, auto-replace, and governance panel work

Why it should exist:

- `carbonet-screen-builder` is conceptually correct, but the current codebase already has enough concrete implementation surface that a focused operational skill would save prompt cost
- the workspace includes multiple related pages and action groups, not just a builder editor

Recommended references:

- `docs/architecture/admin-screen-builder-architecture.md`
- `docs/architecture/framework-builder-standard.md`
- `docs/architecture/builder-overlay-schema-and-governance-contract.md`
- `docs/architecture/generation-trace-and-release-governance-contract.md`
- `src/main/java/egovframework/com/feature/admin/web/AdminScreenBuilderController.java`
- `frontend/src/features/screen-builder/*`

### 3. `carbonet-control-plane-storage-migration`

Use for:

- moving file-backed workspace data into DB-backed governed storage
- JSONL/history/artifact-path persistence changes
- table design for queue, stack, draft revision, execution history, and publish lineage

Why it should exist:

- multiple current workspace features still rely on file-backed bridge storage
- migration tasks will otherwise keep rediscovering which data is authoritative, transitional, or merely cached

Recommended references:

- `docs/architecture/platform-control-plane-data-model.md`
- `docs/architecture/install-unit-lifecycle-and-resource-governance.md`
- `docs/architecture/generation-trace-and-release-governance-contract.md`
- `docs/sql/platform_control_plane_schema.sql`
- `docs/sql/system_observability_schema.sql`

### 4. `carbonet-workspace-observability-linkage`

Use for:

- linking workspace actions to audit, trace, and unified log views
- correlation-key propagation across SR execution, builder publish, compare, repair, and operator actions

Why it should exist:

- observability architecture exists, but workspace change tasks still need a narrower skill for concrete action logging and page-event linkage

Recommended references:

- `docs/architecture/system-observability-audit-trace-design.md`
- `docs/ai/60-operations/audit-log-fields.md`
- `src/main/java/egovframework/com/feature/admin/web/AdminObservabilityController.java`
- `src/main/java/egovframework/com/common/audit/AuditTrailService.java`

## Highest-Value New Docs

### 1. Workspace state machine map

Suggested file:

- `docs/architecture/workspace-state-machine-map.md`

Should cover:

- SR ticket states
- stack item lifecycle
- builder draft/version/publish lifecycle
- compare and repair session states
- rollback and reissue transitions

Why it is missing:

- the lifecycle is partly in code and partly in handoff docs, but not in one compact canonical map

### 2. Workspace screen-to-API-to-storage ownership map

Suggested file:

- `docs/ai/10-architecture/workspace-ownership-map.md`

Should cover:

- page route
- frontend page component
- page-data endpoint
- action endpoints
- controller owner
- service owner
- persistence family
- audit or trace expectation

Why it is missing:

- current maps are broader, but workspace tasks need a dense ownership table

### 3. File-backed bridge inventory and DB migration plan

Suggested file:

- `docs/architecture/workspace-bridge-storage-migration.md`

Should cover:

- current JSONL or file-backed stores
- runtime artifact folders
- which paths are source of truth versus transient cache
- proposed table replacements
- migration order and rollback plan

Why it is missing:

- current handoff docs acknowledge file-backed storage, but not as one migration inventory

### 4. Workspace prompt and payload contract catalog

Suggested file:

- `docs/architecture/workspace-prompt-and-payload-contracts.md`

Should cover:

- right-click capture payload
- SR ticket payload
- plan/build prompt payload
- builder draft payload
- compare and repair request payload
- artifact preview response shape

Why it is missing:

- several flows are implemented, but payload contracts are still scattered between code and architecture docs

### 5. Workspace operator playbook

Suggested file:

- `docs/operations/workspace-operator-playbook.md`

Should cover:

- when to use `codex-request` versus `sr-workbench`
- when to use direct-execute versus planned execution
- how builder publish should hand off into compare or repair
- minimum verification before queue deletion, reissue, restore, or rollback

Why it is missing:

- current docs describe capabilities but not a concise operator decision routine

## Registration Priority

### First wave

Add first because they reduce repeated prompt overhead immediately:

- `carbonet-workspace-flow-governor`
- `carbonet-builder-workspace-ops`
- `docs/architecture/workspace-state-machine-map.md`
- `docs/ai/10-architecture/workspace-ownership-map.md`

### Second wave

Add next because they reduce implementation ambiguity and migration risk:

- `carbonet-control-plane-storage-migration`
- `docs/architecture/workspace-bridge-storage-migration.md`
- `docs/architecture/workspace-prompt-and-payload-contracts.md`

### Third wave

Add when audit and release flow become more governed:

- `carbonet-workspace-observability-linkage`
- `docs/operations/workspace-operator-playbook.md`

## Practical Rule

When a new workspace request arrives, classify it first:

- capture and ticket flow
- runner and execution flow
- builder and publish flow
- compare and repair flow
- storage migration
- audit and trace linkage

If the request touches more than one of those families, treat it as a workspace-system task instead of only a page task.

## What Not To Add Yet

Do not create separate skills for each page such as:

- `codex-request-only`
- `sr-workbench-only`
- `repair-workbench-only`

That would fragment reusable knowledge too early.
The stronger split is by workflow family and storage/governance family.

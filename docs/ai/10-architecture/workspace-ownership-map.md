# Workspace Ownership Map

Grounded on the current Carbonet workspace-system code paths as of 2026-03-28.

Use this map to answer, quickly and deterministically:

- which route owns a workspace action
- which frontend page drives it
- which controller and service implement it
- whether the backing store is file-based, JSON document based, DB based, or mixed
- where audit or trace linkage is already expected

## Workspace Surfaces

| Route / surface | Frontend owner | Page-data / read API | Action API family | Backend owner | Primary storage | Audit / trace expectation |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/system/codex-request` | `frontend/src/features/codex-provision/CodexProvisionMigrationPage.tsx` | `CodexProvisionPageController.codexProvisionPageData`, `CodexProvisionAdminApiController.tickets`, `ticketDetail`, `ticketArtifact` | `/login`, `/execute`, `/history`, `/history/{logId}/inspect`, `/history/{logId}/remediate`, `/tickets/{ticketId}/prepare|plan|execute|direct-execute|queue-direct-execute|skip-plan-execute|rollback|reissue|delete` | `CodexProvisionPageController`, `CodexProvisionAdminApiController`, `SrTicketWorkbenchServiceImpl`, `CodexExecutionAdminService` | mixed: SR JSONL, runner artifacts in filesystem, execution history file, runtime env/config | ticket and runner actions should correlate to audit and runner artifact paths; queue console is the central operator review surface |
| `/admin/system/sr-workbench` | `frontend/src/features/sr-workbench/SrWorkbenchMigrationPage.tsx` | `AdminSrWorkbenchController.getPage` | `/api/admin/sr-workbench/tickets`, `/quick-execute`, `/stack-items`, `/tickets/{ticketId}/approve|prepare-execution|plan|execute|direct-execute|skip-plan-execute` | `AdminSrWorkbenchController`, `SrTicketWorkbenchServiceImpl` | file-backed JSONL for tickets and stack, runner filesystem artifacts, tmux lane metadata in memory plus ticket rows | right-click capture and workbench actions should preserve `traceId`, `requestId`, lane, and artifact evidence |
| right-click capture / screen command bridge | app shell and `ScreenCommandCenterPanel`, consumed by SR Workbench | `/api/admin/help-management/screen-command/page` | `/api/admin/sr-workbench/stack-items`, `/api/admin/sr-workbench/tickets`, `/quick-execute` | `ScreenCommandCenterServiceImpl`, `AdminHelpManagementController`, `SrTicketWorkbenchServiceImpl` | screen-command metadata plus stack JSONL bridge storage | strongest place to keep source page/surface/event/target lineage intact |
| `/admin/system/help-management` | `frontend/src/features/help-management/HelpManagementMigrationPage.tsx` | `/api/admin/help-management/page`, `/api/admin/help-management/screen-command/page` | `/api/admin/help-management/save` | `AdminHelpManagementController`, `HelpContentService`, `ScreenCommandCenterService` | DB-backed help content plus generated screen-command metadata | explicit `AuditTrailService.record(...)` already present for help save |
| `/admin/system/screen-builder` | `frontend/src/features/screen-builder/ScreenBuilderMigrationPage.tsx` | `/api/admin/screen-builder/page`, `/status-summary`, `/versions`, `/component-registry`, `/component-registry/usage`, `/component-registry/scan` | `/draft`, `/status-summary/rebuild`, `/component-registry`, `/component-registry/update`, `/component-registry/delete`, `/component-registry/remap`, `/component-registry/auto-replace`, `/component-registry/auto-replace-preview`, `/component-registry/add-node`, `/component-registry/add-node-tree`, `/restore`, `/publish` | `AdminScreenBuilderController`, `ScreenBuilderDraftServiceImpl` | JSON draft documents, history snapshots, status-summary projections, DB-backed component usage via observability mapper, control-plane linkage | explicit audit exists for draft save and registry mutations; publish and restore should remain lineage-bearing operations |
| `/admin/system/screen-runtime` | `frontend/src/features/screen-builder/ScreenRuntimeMigrationPage.tsx` | `/api/admin/screen-builder/preview` with `versionStatus=PUBLISHED` or latest fallback | none in controller beyond preview read | `AdminScreenBuilderController`, `ScreenBuilderDraftServiceImpl` | published snapshot history plus derived artifact evidence | runtime view should stay traceable to `releaseUnitId`, version snapshot, and registry diagnostics |
| `/admin/system/current-runtime-compare` | `frontend/src/features/screen-builder/CurrentRuntimeCompareMigrationPage.tsx` | currently frontend-led and linked through builder and observability data sources | compare/apply actions are still workspace-facing and not consolidated under one dedicated backend controller in the current code sample | mixed frontend logic plus observability/governance APIs | mixed: builder docs, observability data, runtime evidence | compare results should remain linked to current/generated/baseline lineage |
| `/admin/system/repair-workbench` | `frontend/src/features/screen-builder/RepairWorkbenchMigrationPage.tsx` | primarily frontend-led with observability reads such as `fetchAuditEvents` | repair open/apply flows are workspace-driven but not yet consolidated into one dedicated backend session model | mixed frontend logic plus observability/governance APIs | mixed: audit events, deployment evidence, builder linkage, compare state | repair needs explicit owner-lane, closure checklist, and deploy evidence correlation |
| `/admin/system/observability` and related log/security routes | `frontend/src/features/observability/ObservabilityMigrationPage.tsx` | page-data endpoints under `PlatformObservabilityPageDataController` and search APIs under `/api/admin/observability/*` | backup, restore, export, policy save, and query actions inside `PlatformObservabilityActionController` | `PlatformObservabilityPageController`, `PlatformObservabilityPageDataController`, `PlatformObservabilityActionController`, `ObservabilityQueryService` | DB-backed audit and trace records plus operational config tables/files by feature | this is the verification and evidence plane for all workspace families |

## Ownership Notes

### `codex-request` vs `sr-workbench`

- `codex-request` is the queue and execution-console view
- `sr-workbench` is the ticket authoring, approval, stack, and operator workbench view
- both ultimately depend on `SrTicketWorkbenchServiceImpl`
- if a change affects ticket state, queue state, runner artifact fields, or reissue semantics, update both surfaces deliberately

### `screen-builder` family

- `screen-builder` and `screen-runtime` already have a clear backend owner in `AdminScreenBuilderController`
- `current-runtime-compare` and `repair-workbench` are currently more UI-led and governance-linked
- if those two become first-class managed workflows, give them dedicated backend session objects instead of hiding state in query params and derived frontend state

### `help-management` as control metadata

- `help-management` is not just content editing
- it also exposes `screen-command` page metadata that feeds capture and workbench linkage
- changes here can ripple into the SR capture flow even when no SR code changes

### `observability` as verification plane

- audit and trace are not just passive logs
- workspace tasks should treat observability as the evidence source for:
  - builder save/publish actions
  - repair closure
  - execution review
  - deployment verification

## Storage Families

### File-backed bridge storage

Current known bridge stores:

- SR tickets JSONL
- SR Workbench stack JSONL
- runner history JSONL
- runner workspace artifact folders under `security.codex.runner.workspace-root`

Implication:

- these are migration candidates for governed DB-backed control-plane storage

### JSON document workspace storage

Current known JSON document stores:

- screen-builder working draft JSON
- screen-builder history snapshots
- status-summary projection JSON

Implication:

- this family already has stronger document semantics than SR JSONL, but publish lineage and revision ownership still need a unified control-plane story

### DB-backed storage

Current known DB-backed families in this workspace:

- observability queries and audit/trace records
- help content
- UI component usage and component map linkage through observability mapper
- authority contract and menu metadata dependencies used by builder validation

## Fast Classification Rules

When a request arrives, route it by the owner family first:

- ticket, queue, artifact preview, reissue, rollback:
  - `codex-request` plus `sr-workbench`
- capture context, page/surface/event/target metadata:
  - `help-management` plus `screen-command`
- draft, version, publish, registry, runtime preview:
  - `screen-builder`
- compare drift, repair closure, deploy evidence:
  - `current-runtime-compare`, `repair-workbench`, `observability`
- audit evidence, trace search, verification exports:
  - `observability`

## Immediate Follow-Up Docs

Pair this map with:

- `docs/architecture/workspace-state-machine-map.md`
- `docs/architecture/workspace-bridge-storage-migration.md`
- `docs/architecture/workspace-prompt-and-payload-contracts.md`

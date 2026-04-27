# Builder Master Summary

- Scope: carbonet-ops screen builder rollout and carbonet-general artifact handoff
- Date: 2026-03-28

## Session Status

- builder-01-coordinator: Active, boundary docs and memo inventory loaded
- builder-02-ops-ui: Active, initial memo seeded from current builder page and hooks/panels inventory
- builder-03-env-link: Active, environment-management linkage points loaded
- builder-04-runtime-preview: Active, runtime preview page and renderer loaded
- builder-05-repair-workbench: Active, compare and repair entrypoints loaded
- builder-06-builder-api: Active, initial memo seeded from endpoint scan and contract controller review
- builder-07-contract-compat: Active, initial memo seeded from framework contract and compatibility metadata scan
- builder-08-registry-governance: Active, initial memo seeded from governance panels and registry backend scan
- builder-09-artifact-target: Active, initial memo seeded from artifact handoff docs and ops scripts
- builder-10-verification-docs: Active, initial memo seeded from build and restart verification results

## Shared Facts

- This repository already contains substantial screen-builder implementation across authoring UI, runtime preview, repair workbench, component registry governance, and framework builder contracts.
- The canonical ownership model is already documented: `carbonet-ops` owns builder settings, publish control, and regeneration rules; `carbonet-general` is a runtime target that consumes published artifacts.
- The correct rollout is not greenfield builder design. It is operationalization of the existing builder surfaces with explicit publish, artifact, and runtime-target boundaries.
- The environment-management console now surfaces builder handoff metadata directly from runtime payloads, including `releaseUnitId`, runtime target system, `runtimePackageId`, and `deployTraceId`, so operators can see the publish boundary before entering runtime compare or repair flows.
- The environment-management console now also surfaces publish freshness and current-runtime parity summary for the selected menu, turning it into the first operational warning surface for stale publish snapshots or runtime drift before opening compare/repair tools.
- The menu queue in environment-management now reuses those summaries through row badges, dedicated filters for stale publish / parity drift / parity gap, and direct compare links on published rows.
- Queue summary derivation no longer fans out from the browser. `GET /api/admin/screen-builder/status-summary` now returns menu-level builder status, handoff metadata, freshness, and parity summaries in one backend batch response.
- That backend batch response now persists per-menu projection files on demand under `data/screen-builder/status-summary`, with menu-level invalidation on draft/publish mutations and global invalidation on registry mutations.
- A warm-up/rebuild path now exists at `POST /api/admin/screen-builder/status-summary/rebuild`, so operators or future automation can precompute projections for selected menus or the full page-menu set.
- Publish is now the default projection warm-up trigger. Successful publish regenerates both locale projections for the affected menu immediately, while the rebuild route remains available for manual or bulk refresh.
- The rebuild path is now exposed in `/admin/system/environment-management` as operator buttons for selected-menu rebuild and full-summary rebuild, so projection maintenance is available from the same console that surfaces freshness, parity, and handoff metadata.
- Frontend production build completed with `npm run build` in `/opt/Resonance/projects/carbonet-frontend/source`.
- Backend package completed with `mvn -q -Dmaven.test.skip=true package` in `/opt/Resonance`; the older unrelated runtime-control test-compile drift note is now stale because tests were realigned to `platform/runtimecontrol`.
- Runtime restart completed through `ops/scripts/restart-18000.sh`; port `18000` is listening and `/admin/system/screen-builder`, `/admin/system/environment-management`, `/admin/system/current-runtime-compare`, `/admin/api/admin/screen-builder/status-summary`, and `/admin/api/admin/screen-builder/status-summary/rebuild` all redirect to login, confirming the app is up.

## Cross-Session Blockers

- None confirmed yet at the builder feature boundary.
- Merge conflict risk is high if multiple sessions edit `frontend/src/features/screen-builder/ScreenBuilderMigrationPage.tsx` or shared framework builder contract files simultaneously.
- Generated runtime artifacts under `src/main/resources/static/react-app/**` must not become the primary source of truth for builder behavior.

## Ownership Decisions

- `builder-01-coordinator` owns publish boundary, merge order, and shared-file arbitration.
- `builder-02-ops-ui` owns authoring UI analysis for `frontend/src/features/screen-builder/**` except runtime preview and repair workbench pages.
- `builder-03-env-link` owns `environment-management` to builder launch and state handoff.
- `builder-04-runtime-preview` owns published runtime review surface only.
- `builder-05-repair-workbench` owns compare and repair handoff after publish.
- `builder-06-builder-api` owns backend endpoint and persistence gap analysis for builder APIs.
- `builder-07-contract-compat` owns framework builder contract, profile, and compatibility metadata analysis.
- `builder-08-registry-governance` owns component registry safety, usage lookup, remap, and deletion rules.
- `builder-09-artifact-target` owns `carbonet-general` artifact-consumption model and release-unit handoff.
- `builder-10-verification-docs` owns build, restart, and route-verification checklist maintenance.

## Merge Order

1. Contract and ownership decisions: coordinator plus contract/compat plus builder API.
2. UI and linkage changes: ops-ui plus env-link plus registry-governance.
3. Runtime and handoff changes: runtime-preview plus repair-workbench plus artifact-target.
4. Verification and docs finalization.

## Release Boundary

- `carbonet-ops`: builder authoring UI, publish control, overlay and compatibility rules, release-unit decisions, regeneration authority.
- `carbonet-general`: regenerated runtime outputs only; no manual edits as the normal workflow.

## Verification Gate

- `npm run build` must pass in `frontend/`.
- `mvn -q -DskipTests package` must pass in repo root.
- `ops/scripts/restart-18000.sh` must leave port `18000` listening.
- Authenticated route verification for `/admin/system/screen-builder`, `/admin/system/environment-management`, and related runtime surfaces remains to be completed in-browser after login.

## Final Next Action

- Verify the new environment-management rebuild actions in an authenticated browser session and decide whether full-summary rebuild should keep a single-click action or gain stronger confirmation/guardrails.

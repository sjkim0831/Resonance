# builder-03-env-link

- Role: environment-management linkage
- Allowed Paths: frontend/src/features/environment-management, frontend/src/lib/api/environmentManagement.ts, selected admin page model/bootstrap files
- Forbidden Paths: screen-builder editor internals, runtime preview, repair workbench

## Findings

- `frontend/src/features/environment-management/EnvironmentManagementHubPage.tsx` already acts as the operator launch surface into the builder. It carries multiple direct links to `/admin/system/screen-builder` with `menuCode`, `pageId`, `menuTitle`, and `menuUrl` query parameters.
- The environment-management surface already tracks builder-related state such as published vs draft condition, issue-only filtering, queue focus, and screen-builder issue detail maps.
- The environment-management surface now also exposes publish handoff metadata directly from builder payloads: `releaseUnitId`, runtime target system, `runtimePackageId`, and `deployTraceId`. That makes the pre-builder console the first place an operator can confirm the `carbonet-ops -> carbonet-general` release boundary before opening the builder or runtime preview.
- The same surface now computes publish freshness and current-runtime parity summary for the selected menu. Operators can see whether the current publish is fresh, aging, or stale, and whether runtime compare reports parity match, drift, or gaps before opening the deeper compare or repair tools.
- The menu queue itself now reuses those summaries. Page rows show freshness/parity badges, list-level filters can isolate stale publish, parity drift, and parity gap menus, and published rows now deep-link straight into `current-runtime-compare`.
- The queue summary path is now backend-backed rather than client fan-out. `useEnvironmentGovernance` loads one `status-summary` payload for the page-menu set, then derives selected-menu detail and queue-level badges/filters from that shared response.
- The selected-menu action bar now exposes `status-summary/rebuild` controls directly inside environment-management. Operators can rebuild the selected menu projection or the full summary set without leaving the launch surface, so summary maintenance is no longer hidden behind API-only workflow.
- The canonical Phase 1 architecture says the operator flow begins from `/admin/system/environment-management`, marks a page as builder-managed, then opens the builder editor. The current repository structure is consistent with that direction even if the exact `builderManagedYn` persistence path still needs confirmation.
- Selected admin bootstrap/model files already expose screen-builder related payloads in nearby surfaces, so the environment-management screen is the natural owner for menu-level builder adoption, diagnostics, and launch controls.

## Handoff Points

- Menu inventory and menu selection originate in environment-management.
- Builder launch handoff currently occurs by navigation to `/admin/system/screen-builder` with menu/page identity carried as query parameters.
- Governance diagnostics visible in environment-management already appear to classify pages into published, draft, ready, blocked, and issue-focused queues, which makes it the correct pre-builder triage surface.
- Environment-management is also the correct place to expose whether a menu is eligible for builder management, what the current publish status is, whether registry issues block publish/runtime usage, and what release-unit/package/deploy evidence will be handed off downstream.
- Environment-management now also serves as the early-warning surface for runtime drift: it links directly to `current-runtime-compare` once a publish exists and summarizes parity risk inline.

## Candidate Files

- `frontend/src/features/environment-management/EnvironmentManagementHubPage.tsx`
- `frontend/src/features/environment-management/useEnvironmentGovernance.ts`
- `frontend/src/features/environment-management/environmentManagementShared.ts`
- `src/main/java/egovframework/com/feature/admin/web/AdminSystemPageModelAssembler.java`
- `src/main/java/egovframework/com/feature/admin/service/AdminShellBootstrapPageService.java`

## Next Action

- Verify the new rebuild buttons in an authenticated browser session and decide whether whole-tree rebuild needs stronger operator guardrails than the current direct action button.

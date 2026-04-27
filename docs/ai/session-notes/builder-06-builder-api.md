# builder-06-builder-api

- Role: builder API and persistence
- Allowed Paths: framework builder Java and mapper files, frontend screenBuilder api contract, builder schema sql
- Forbidden Paths: frontend page composition except API contract touchpoints

## Findings

- Frontend builder API client already expects a substantial builder surface under `/api/admin/screen-builder/**`, including page load, preview, draft save, restore, publish, component registry, remap, auto-replace preview, and registry scan.
- The actual `/api/admin/screen-builder/**` persistence surface is implemented in `src/main/java/egovframework/com/feature/admin/web/AdminScreenBuilderController.java` and `src/main/java/egovframework/com/feature/admin/service/impl/ScreenBuilderDraftServiceImpl.java`.
- Framework-side backend code under `src/main/java/egovframework/com/framework/builder/**` remains the contract and compatibility layer, while feature-level builder persistence lives under `egovframework.com.feature.admin`.
- The immediate backend gap was not endpoint absence but missing `releaseUnitId` and artifact handoff evidence in page/preview payloads. That gap is now partially addressed in the builder payload.
- Environment-management queue summaries are no longer forced to fan out over per-menu page + parity compare calls from the browser. A batch endpoint now exists at `GET /api/admin/screen-builder/status-summary` and the server assembles freshness, issue, release-unit, and parity summary per menu code.
- The batch summary is now backed by a persisted projection path under `data/screen-builder/status-summary/*.ko.json|*.en.json`. Draft/publish/restore/node mutations invalidate per-menu projections; component registry mutations invalidate all summary projections.
- Operators or future admin tools can now warm the projection explicitly through `POST /api/admin/screen-builder/status-summary/rebuild`. With `menuCode` params it rebuilds selected menus; without params it rebuilds all 8-digit page menus discovered from the menu tree.
- Publish now acts as the default warm-up trigger. After a successful publish, the service immediately regenerates both `ko/en` projections for that menu so the first environment-management read does not pay the summary compute cost.

## Endpoint Map

- `GET /api/admin/screen-builder/page`: expected by frontend page bootstrap.
- `GET /api/admin/screen-builder/status-summary`: expected by environment-management queue and selected-menu summary.
- `POST /api/admin/screen-builder/status-summary/rebuild`: expected for projection warm-up and forced rebuild.
- `GET /api/admin/screen-builder/preview`: expected by runtime and repair surfaces.
- `POST /api/admin/screen-builder/draft`: expected for draft save.
- `POST /api/admin/screen-builder/restore`: expected for version restore.
- `POST /api/admin/screen-builder/publish`: expected for publish flow.
- `POST /api/admin/screen-builder/component-registry`: expected for component registration.
- `POST /api/admin/screen-builder/component-registry/update`: expected for registry update.
- `GET /api/admin/screen-builder/component-registry/usage`: expected for usage lookup.
- `POST /api/admin/screen-builder/component-registry/delete`: expected for delete-if-unused flow.
- `POST /api/admin/screen-builder/component-registry/remap`: expected for replacement/remap flow.
- `POST /api/admin/screen-builder/component-registry/auto-replace`: expected for deprecated replacement execution.
- `POST /api/admin/screen-builder/component-registry/auto-replace-preview`: expected for dry-run replacement preview.
- `GET /api/admin/framework/builder-contract`: implemented by `FrameworkBuilderContractController`.

## Backend Gaps

- Need to verify where file-backed persistence should eventually converge with the documented Phase 1 schema contract in `docs/sql/admin_screen_builder_phase1_schema.sql`.
- Need to verify whether publish/runtime snapshot persistence should continue file-backed or move to DB-backed release-unit ownership.
- Need to verify whether component registry governance uses `UI_COMPONENT_REGISTRY` and `UI_PAGE_COMPONENT_MAP` end-to-end or still mixes file-derived inventory with DB-driven state.

## Next Action

- Decide whether `status-summary` should stay a repeated-query-parameter GET or move to a POST body when queue sizes grow enough to make query-length or cache-key size a problem.

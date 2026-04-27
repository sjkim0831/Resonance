# Latest Handoff

Updated on `2026-04-17`.

## Current Position

- boundary rules are already established
- the repository is in the implementation phase, not the idea phase
- the highest-value unfinished area is still control-plane composition under `feature/admin`
- builder structure-governance closure for the current wave is frozen in `docs/architecture/builder-structure-wave-20260409-closure.md`
- builder resource-ownership closure for the current wave is now frozen in `docs/architecture/builder-resource-ownership-wave-20260415-closure.md`
- app assembly, package, runtime, and asset freshness closure for the current owner wave is now frozen around `apps/carbonet-app`

## Current Closed Family

- `BUILDER_STRUCTURE_GOVERNANCE`
- `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`
- `APP_ASSEMBLY_BUILD_RUNTIME_CLOSURE`
- `BUILDER_COMPATIBILITY_SHIM_REMOVAL` (9/10 removed)
- `CONTROL_PLANE_RDB_PERSISTENCE_CLOSURE` (Version/Repair data moved to COMMON_DB)
- `PROJECT_CONTEXT_DYNAMICIZATION_CLOSURE` (Removed hardcoded "carbonet" project IDs)
- `FRONTEND_ROUTE_SCOPE_SPLIT_CLOSURE` (Added routeScope: PLATFORM | RUNTIME)

This means the following are now frozen for the current wave:

- which builder family is counted as closed today
- which builder paths are source of truth
- when a legacy builder path may stay as a shim
- how `large-move-completion-contract.md` should be interpreted for this wave
- builder-owned resources are consumed from dedicated modules
- executable-app success is attributable cleanly to dedicated-module assembly
- which app assembly path is canonical
- which packaged jar path is canonical
- which closure and runtime-proof scripts are the standard operator path

Operator-ready closeout note:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-structure-wave-closeout.md`
- `docs/architecture/builder-resource-ownership-wave-20260415-closure.md`
- `ops/scripts/app-closure-help.sh`
- `ops/scripts/verify-app-closure-all.sh`
- `ops/scripts/codex-verify-18000-freshness.sh`

Builder install/deploy closeout is also now explicit for the current local owner line:

- install scope: `COMMON_DEF_PROJECT_BIND`
- binding inputs: `pageId`, `menuCode`, canonical route path or route prefix, actor/data/action authority scope, project menu placement, authority override or narrowing, theme/presentation override where relevant, and project executor handoff where write-heavy logic exists
- productized governed target: builder-managed `admin/system` page family, identified by explicit `pageId`, `menuCode`, canonical route path, and packaged React manifest/bootstrap shell outputs rather than source-copy installation
- packaging owner path: `apps/carbonet-app/pom.xml`
- app assembly owner path: `apps/carbonet-app/pom.xml`
- module/resource source of truth: moved runtime/help/observability/version-control resource families are consumed from dedicated modules while `apps/carbonet-app/pom.xml` excludes the old root duplicates
- runtime target URL: `https://127.0.0.1:18000`
- authority-scope application rule for this closeout:
  - menu, route entry, query, action, approval, and audit are expected to follow the same owner-lane policy
  - frontend visibility and backend execution are no longer justified by controller-local tribal helpers
  - owner services/page services/command services are now the explicit application surface
- validator evidence path:
  - `ops/scripts/verify-app-closure-all.sh`
  - `ops/scripts/verify-large-move-app-closure.sh`
  - `ops/scripts/codex-verify-18000-freshness.sh`
- deploy evidence path:
  - `ops/scripts/build-restart-18000.sh`
  - `ops/scripts/codex-apply-and-deploy.sh`
  - `ops/scripts/deploy-193-to-221.sh`
  - `ops/scripts/jenkins-deploy-carbonet.sh`
  - `ops/scripts/deploy-blue-green-221.sh`
- rollback evidence path:
  - `ops/scripts/codex-rollback-18000.sh`
  - `var/backups/codex-deploy`
  - `var/backups/manual-deploy`
  - `var/logs/codex-rollback-18000.log`
- current local runtime proof:
  - `bash ops/scripts/verify-app-closure-all.sh`
  - `bash ops/scripts/build-restart-18000.sh`
  - `bash ops/scripts/codex-verify-18000-freshness.sh`

Closeout sentences now fixed for this family:

- `CLOSED: page systemization is complete for the builder-managed admin/system family; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.`
- `CLOSED: authority scope is consistently applied for the builder-managed admin/system family; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.`
- `CLOSED: builder install and deploy closeout is complete for the builder-managed admin/system family; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.`

## Governed Page Family Closure

The current governed page-family closure for the builder-managed admin or platform route layer is now explicit in the React route-family registry.

Closed families in this lane:

- `platform-foundation`
- `environment-management`
- `screen-builder`
- `project-version-management`

Source-of-truth files for this closure:

- `frontend/src/platform/routes/platformFoundationFamily.ts`
- `frontend/src/features/environment-management/environmentManagementFamily.ts`
- `frontend/src/features/screen-builder/screenBuilderFamily.ts`
- `frontend/src/features/project-version-management/projectVersionManagementFamily.ts`
- `frontend/src/app/routes/families/allRouteFamilies.ts`
- `frontend/src/app/routes/routeCatalog.ts`
- `frontend/src/platform/screen-registry/pageGovernance.ts`

For these families, the following are now explicit in code rather than tribal knowledge:

- stable `pageId`
- `menuCode`
- canonical route path
- page family
- ownership lane
- install scope set to `COMMON_DEF_PROJECT_BIND`
- authority scope across menu, entry, query, action, approval, audit, and trace
- bootstrap payload target
- binding inputs
- validator checks
- rollback evidence
- runtime verification target

Checklist judgment for this closure:

- `docs/architecture/page-systemization-checklist.md`: passed for the four governed families above
- `docs/architecture/authority-scope-application-checklist.md`: passed for the four governed families above
- `docs/architecture/builder-install-deploy-closeout-checklist.md`: passed for the four governed families above
- `docs/architecture/project-binding-patterns.md`: common definition, project binding, and project executor lines are separately traceable for the four governed families above

Runtime proof for this closure on local `:18000`:

- frontend build: `cd frontend && npm run build`
- package and restart: `bash ops/scripts/build-restart-18000.sh`
- freshness proof: `VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh`
- runtime jar proof:
  - target jar: `apps/carbonet-app/target/carbonet.jar`
  - runtime jar: `var/run/carbonet-18000.jar`
  - verified hash: `f25e203c850b2e0ff1890125572d6dfdfa34e2d1a164e62e6d464b75556816aa`
- runtime process proof:
  - pid: `60108`
  - port: `18000`
  - startup marker: `Tomcat started on port(s): 18000`

Exact route verification target results for the closed families:

- `https://127.0.0.1:18000/admin/system/platform-studio` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/environment-management` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/screen-builder` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/version` -> `302` to `/admin/login/loginView`

These `302` responses are expected runtime verification evidence for an unauthenticated operator session because the route entry guard is active and consistent with the declared authority scope.

## Screen-Builder Pilot Operator Flow

The current pilot family for deploy, compare, repair, and rollback utilization is fixed to:

- `screen-builder`

This pilot uses one family only and does not reopen structural scope.

Pilot pages in the family:

- `/admin/system/screen-runtime`
- `/admin/system/current-runtime-compare`
- `/admin/system/repair-workbench`

Pilot source-of-truth files:

- `frontend/src/features/screen-builder/screenBuilderFamily.ts`
- `frontend/src/features/screen-builder/operatorFlow.ts`
- `frontend/src/features/screen-builder/ScreenRuntimeMigrationPage.tsx`
- `frontend/src/features/screen-builder/CurrentRuntimeCompareMigrationPage.tsx`
- `frontend/src/features/screen-builder/RepairWorkbenchMigrationPage.tsx`

The pilot family now makes these operator surfaces explicit in the UI:

- build, package, restart command
- freshness verification command
- runtime route verification command
- current-runtime-compare route verification command
- repair-workbench route verification command
- release-unit, runtime-package, deploy-trace, and rollback-anchor evidence

Install and deploy closeout for the pilot family is now explicit as follows:

- install scope: `COMMON_DEF_PROJECT_BIND`
- runtime verification target: `/admin/system/screen-runtime`
- compare target: `/admin/system/current-runtime-compare`
- repair target: `/admin/system/repair-workbench`
- deploy sequence: `build-restart-18000 -> screen-runtime route verify -> current-runtime-compare -> repair-workbench`
- freshness verification sequence:
  - `build-restart-18000`
  - `codex-verify-18000-freshness`
  - route verify for `screen-runtime`
  - route verify for `current-runtime-compare`
  - route verify for `repair-workbench`
- rollback evidence: runtime compare, repair workbench, rollback anchor, and deploy trace evidence

Common definition, project binding, and project executor remain separately traceable for this family:

- common definition:
  - `features/screen-builder`
  - route family definition
  - screen-builder page manifests
  - runtime compare baseline
  - repair validator contract
- project binding:
  - screen runtime or menu or route binding
  - project-scoped builder authority narrowing
  - builder studio theme token binding
- project executor:
  - screen publish execution
  - repair execution
  - project runtime execution

Current local runtime proof for the pilot family:

- frontend build:
  - `cd frontend && npm run build`
- package and restart:
  - `bash ops/scripts/build-restart-18000.sh`
- freshness proof:
  - `VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh`
- runtime jar proof:
  - target jar: `apps/carbonet-app/target/carbonet.jar`
  - runtime jar: `var/run/carbonet-18000.jar`
  - verified hash: `a34d9bc3cd0becd4d9cc9b6167aa10b8157d88ac4e3bba6c97a6bcd0a712cd0a`
- runtime process proof:
  - pid: `67594`
  - port: `18000`
  - startup marker: `Tomcat started on port(s): 18000`

Exact pilot route verification results:

- `https://127.0.0.1:18000/admin/system/screen-builder` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/screen-runtime` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/current-runtime-compare` -> `302` to `/admin/login/loginView`
- `https://127.0.0.1:18000/admin/system/repair-workbench` -> `302` to `/admin/login/loginView`

These `302` responses are expected runtime verification evidence for the unauthenticated operator state and confirm that the same family-level authority scope governs menu entry and page entry for the pilot routes.

Screen-builder authority-scope application is now materially implemented on the backend, not only declared in frontend metadata:

- canonical admin route entry now exists for:
  - `/admin/system/screen-builder`
  - `/admin/system/screen-runtime`
  - `/admin/system/current-runtime-compare`
  - `/admin/system/repair-workbench`
- `ScreenBuilderApiController` now enforces the same family authority chain for:
  - page bootstrap and preview queries
  - status-summary query and rebuild
  - draft save, restore, and publish
  - component-registry read/write/delete/remap/auto-replace flows
  - node add / add-tree mutation flows
- deny paths now emit explicit screen-builder audit evidence with actor, role, menu, action scope, required feature code, and deny reason
- live owner files for this implementation are:
  - `modules/screenbuilder-carbonet-adapter/src/main/java/egovframework/com/feature/admin/screenbuilder/web/ScreenBuilderApiController.java`
  - `modules/screenbuilder-carbonet-adapter/src/main/java/egovframework/com/feature/admin/web/AdminScreenBuilderController.java`
  - `modules/screenbuilder-carbonet-adapter/src/main/java/egovframework/com/feature/admin/screenbuilder/support/CarbonetScreenBuilderAuthoritySource.java`
  - `modules/screenbuilder-carbonet-adapter/src/main/java/egovframework/com/feature/admin/screenbuilder/support/model/ScreenBuilderAuthorityDecision.java`
  - `src/main/java/egovframework/com/feature/admin/service/impl/CarbonetScreenBuilderAuthoritySourceBridge.java`
  - `src/main/java/egovframework/com/common/util/ReactPageUrlMapper.java`
  - `frontend/src/features/screen-builder/screenBuilderFamily.ts`

Pilot family closeout judgment for this wave:

- `CLOSED: page systemization is complete for screen-builder; pageId, menuCode, canonical route, manifest, route ownership, and runtime verification target are explicit.`
- `CLOSED: authority scope is consistently applied for screen-builder; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.`
- `CLOSED: builder install and deploy closeout is complete for screen-builder; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.`

## Session D Runtime Governance Freeze

Session D owns deploy/version governance and runtime freshness verification for the current wave.

Until Session B or Session C lands a new runtime-affecting change, keep these as the fixed proof surfaces:

- closed-family source of truth:
  - `APP_ASSEMBLY_BUILD_RUNTIME_CLOSURE`
  - `BUILDER_STRUCTURE_GOVERNANCE`
- canonical local release/deploy proof line:
  - `bash ops/scripts/build-restart-18000.sh`
  - `VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh`
- canonical packaged app path:
  - `apps/carbonet-app/target/carbonet.jar`
- canonical runtime jar path:
  - `var/run/carbonet-18000.jar`
- canonical deploy evidence path:
  - `ops/scripts/build-restart-18000.sh`
  - `ops/scripts/codex-apply-and-deploy.sh`
  - `ops/scripts/deploy-193-to-221.sh`
  - `ops/scripts/jenkins-deploy-carbonet.sh`
  - `ops/scripts/deploy-blue-green-221.sh`
- canonical rollback evidence path:
  - `ops/scripts/codex-rollback-18000.sh`
  - `var/backups/codex-deploy`
  - `var/backups/manual-deploy`
  - `var/logs/codex-rollback-18000.log`

Session D readiness rules before accepting Session B or Session C outputs:

- do not rename `releaseUnitId`, `runtimePackageId`, `deployTraceId`, or rollback-anchor evidence semantics
- do not switch packaged runtime truth away from `apps/carbonet-app/target/carbonet.jar`
- do not claim local freshness from `restart-18000.sh` alone
- do not mark a deploy/version closeout complete without both `build-restart-18000` and `codex-verify-18000-freshness`

When Session B or Session C delivers a runtime-affecting change, Session D closeout must finish with this sequence:

1. `bash ops/scripts/build-restart-18000.sh`
2. `VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh`
3. route-level or feature-level verification only after the freshness proof above passes

## Immediate Next Slice

- start with `Priority 1A` from the separation status doc:
  - move control-plane menu/bootstrap and observability entry composition out of `feature/admin`
  - keep compatibility shims only where runtime routes still need them

## Builder Resource Ownership Current State

- `BUILDER_RESOURCE_OWNERSHIP_CLOSURE` is now CLOSED
- all 5 rows resolved as `DELETE_NOW` or carry non-blocking notes
- success phrase: `SUCCESS: builder resource ownership closure is now complete across all five rows, with row 5 resolved as DELETE_NOW following explicit root exclusion and fully moved MyBatis/resource ownership.`

## Next Family Kickoff

- start with `BUILDER_COMPATIBILITY_SHIM_REMOVAL`
- the plan for this family should now be established in `docs/architecture/builder-compatibility-shim-removal-plan.md`

Do not reopen row-grammar cleanup, bounded replacement-note drafting, or phrase-only propagation on the current docs set.

Most recent direct-coupling and compatibility-shim reductions already completed:

- `feature/admin` observability entry points now use `PlatformObservabilityAdminPagePort`
- `AdminSessionSimulationService` is now further narrowed to `PlatformObservabilityCompanyScopePort`
- `AdminMainController` access-history company-option helpers are now also narrowed to `PlatformObservabilityCompanyScopePort`
- `AdminMemberController` security-history page data is now narrowed to `PlatformObservabilityHistoryPagePayloadPort`
- `AdminShellBootstrapPageService` external-monitoring and certificate-audit bootstrap payloads are now narrowed to `ExternalMonitoringPayloadPort` and `CertificateAuditLogPageDataPort`
- certificate-audit page-data no longer routes back through a reverse bridge into `AdminShellBootstrapPageService`
- `PlatformObservabilityBatchManagementPayloadService` now implements `BatchManagementPagePayloadPort`
- `ScreenCommandCenterServiceImpl` observability metadata is now narrowed for batch-management, external monitoring, and external logs
- `AdminMemberExportController` is now detached from `AdminMainController` for member/admin/company Excel exports
- `AdminEmissionResultController` is now detached from `AdminMainController` for emission-result list/detail routing and page-data payloads
- `AdminAuthorityController` is now detached from `AdminMainController` for auth-group/auth-change/dept-role route forwarding and page-data payload APIs
- `AdminAuthorityApiCommandService` now also detaches `AdminAuthorityController` from `AdminMainController` for auth-group/auth-change/dept-role write APIs
- `AdminAuthorityFormCommandService` now also detaches `AdminAuthorityController` from `AdminMainController` for auth-group/auth-change/dept-role form-post submits
- `AdminAuthorityCommandSupportService` now owns authority command request-context, audit recording, author-profile mapping, and auth-group/auth-change/dept-role redirect building, so live `AdminMainController` references are cleared from `AdminAuthorityApiCommandService` and `AdminAuthorityFormCommandService`
- `AdminSystemBuilderController` is now detached from `AdminMainController` for system-builder access checks, diagnostics, menu-placeholder payload, and fallback shell handling
- `AdminApprovalController` is now detached from `AdminMainController` for member/company/certificate approval route forwarding and page-data payload APIs
- `AdminApprovalPagePayloadService` now also drops its direct `AdminMainController` provider dependency in favor of `AdminRequestContextSupport` plus `AdminApprovalPageModelAssembler`
- `AdminAuthorityPagePayloadService` now also drops its direct `AdminMainController` provider dependency in favor of `AdminAuthorityPagePayloadSupport` for request-context and authority-page helper logic
- `AdminMemberPagePayloadService` now also narrows its `AdminMainController` usage by switching request-context, normalized-string, and shared authority-profile helper calls to `AdminRequestContextSupport` and `AdminAuthorityPagePayloadSupport`
- `AdminMemberPagePayloadService` now also routes member/admin/company list payloads plus member-detail, password-reset history, company-detail, and company-account read-side assembly directly to `AdminListPageModelAssembler` and `AdminMemberPageModelAssembler`, so those read-side payload paths no longer use `AdminMainController`; the remaining live controller dependency there is narrowed to heavier member-register/admin-account orchestration
- `AdminMemberPagePayloadService` now also routes member-stats bootstrap data to `AdminShellBootstrapPageService`, and member-register bootstrap data plus grantable member-author-group loading to `AdminMemberRegisterSupportService`; `AdminMemberRegisterCommandService` now reuses the same support owner, so those live member-stats/register read-support helpers are cleared from `AdminMainController`
- `AdminAdminAccountAccessService` now owns admin-account create/access preset rules plus institution lookup and admin-visibility checks; `AdminMemberPagePayloadService` now uses `AdminMemberPageModelAssembler` plus that access service for admin-account create/permission read-side, and `AdminAdminAccountCreateCommandService` now reuses the same access owner for create-submit access/institution checks
- `AdminMemberPagePayloadService` now also uses `AdminMemberPageModelAssembler` directly for member-edit read-side defaults and model assembly, so live `AdminMainController` references are cleared from that payload service
- `AdminAdminPermissionSupportService` now owns admin-permission author-group section loading, current-role validation, baseline feature lookup, role assignment, and grantable-feature scope resolution; `AdminAdminPermissionService` no longer uses `AdminMainController` for those permission-save helpers
- `AdminMemberEditSupportService` now owns member-edit permission author-group section loading, current-role lookup, grantable-feature scope resolution, baseline feature loading/filtering, and failure-model permission repopulation; `AdminMemberEditCommandService` no longer uses `AdminMainController` for those permission-lane helpers
- `AdminMemberEditNavigationSupport` and `AdminMemberEditAuditSupport` now own member-edit form view/redirect resolution and audit recording, while `AdminRequestContextSupport` plus assembler-local defaults now cover request-context and default-model setup; live `AdminMainController` references are cleared from `AdminMemberEditCommandService`
- `AdminAdminAccountCreateSupportService` now owns admin-account-create preset-role resolution, feature normalization/baseline loading, grantable-feature scope resolution, and create-audit recording; `AdminAdminAccountCreateCommandService` now uses request-context, access, and create support owners directly, so live `AdminMainController` references are cleared from that command service
- `AdminMemberPageModelAssembler` now also narrows its password-reset-history slice by switching request-context and company-scope lookup to `AdminRequestContextSupport` plus `PlatformObservabilityCompanyScopePort`, with local reset-history row formatting
- `AdminMemberPageModelAssembler` now also narrows its company-detail/account slice by switching status/membership labels, admin-prefix/url building, and institution/file lookup to assembler-local helpers
- `AdminMemberPageModelAssembler` now also narrows its member-edit/detail and admin-account slices by switching defaults, labels, access-scope/document formatting, reset-history row formatting, and preset/feature normalization to assembler-local helpers
- `AdminMemberPageModelAssembler` now also narrows its member-edit/detail and admin-account slices by switching member access checks plus permission author-group section assembly/flattening to assembler-local helpers
- `AdminMemberPageModelAssembler` no longer keeps live `AdminMainController` indirection at all; the remaining member/company/admin-account read-side assembly now runs through assembler-local helpers plus support owners directly
- `AdminListQuerySupportService` now owns member/admin/company/login-history list query helpers such as member-management scope checks, selected-company resolution, access-history company-option lookup, admin-list visibility filtering, and admin-list action access; live `AdminMainController` references are cleared from `AdminListPageModelAssembler`
- `AdminPermissionEditorService` now owns the shared permission-editor payload assembly used by member edit/detail, admin-account edit, and member-edit failure recovery; `AdminMainController.populatePermissionEditorModel` is now only a compatibility delegate
- `AdminPermissionOverrideService` now owns the shared user-feature override persistence used by member edit/register and admin-account create/update flows; `AdminMainController.savePermissionOverrides` is now only a compatibility helper
- `AdminMemberEvidenceSupport` now owns member-to-institution merge, institution lookup for member detail/edit, and member evidence-file loading; member-page and approval assemblers no longer use `AdminMainController` for those helpers
- `AdminMemberAccessSupport` now owns member/company access checks plus member/company file lookup and file-path/media-type validation; member-file serving, member-edit/password-reset access gates, member-edit payload read-side, member-detail read-side, and member-approval access checks no longer use `AdminMainController` for those helpers
- `AdminMemberController` is now detached from `AdminMainController` for member-stats and member-register route forwarding and page-data payload APIs
- `AdminMemberController` is now also detached from `AdminMainController` for member-detail and admin-account page forwarding / create-page payload APIs
- `AdminMemberController` is now also detached from `AdminMainController` for member-edit and password-reset route forwarding and page-data payload APIs
- `AdminMemberController` is now also detached from `AdminMainController` for admin-account permission page-data payload API
- `AdminMemberController` is now also detached from `AdminMainController` for member/admin/company list route forwarding and page-data APIs plus company-detail/company-account route forwarding and page-data APIs
- `AdminMemberSupportService` now owns admin-account ID duplication checks and company-search support APIs
- `AdminAdminPermissionCommandService` now owns admin-account permission submit orchestration for both API and form-post flows
- `AdminCompanyAccountCommandService` now owns company-account submit orchestration for both API and form-post flows
- `AdminCompanyAccountSupportService` now also owns company-account normalization, institution/file lookup, institution-id generation, upload validation, and evidence-file persistence/path joining, so live `AdminMainController` references are cleared from `AdminCompanyAccountService`
- `AdminAdminAccountCreateCommandService` now owns admin-account create submit orchestration for the API flow
- `AdminAdminPermissionCommandSupportService` now owns admin-permission request-language routing, redirect/view-name resolution, and audit recording, while `AdminMemberPageModelAssembler` now exposes admin-account default-model setup for reuse; live `AdminMainController` references are cleared from `AdminAdminPermissionCommandService`
- `AdminMemberPasswordResetCommandService` now owns member password-reset action orchestration
- `AdminMemberPasswordResetSupportService` now owns member-password-reset request-context, client-ip normalization, and audit recording, so live `AdminMainController` references are cleared from `AdminMemberPasswordResetCommandService`
- `AdminMemberSupportService` now also owns member ID duplication checks, and `AdminMemberRegisterCommandService` now owns member-register submit orchestration
- `AdminMemberRegisterCommandSupportService` now owns member-register request-context, normalization/validation helpers, institution lookup reuse, grantable-feature scope resolution, and member-register audit recording, so live `AdminMainController` references are cleared from `AdminMemberRegisterCommandService`
- `AdminMemberEditCommandService` now owns member-edit submit orchestration for both API and form-post flows
- `AdminMemberFileAccessService` now owns member/company file download and preview orchestration
- `AdminApprovalCommandService` now owns member/company/certificate approval submit orchestration for form-post and API flows
- `AdminPayloadSelectionSupport` and `AdminApprovalStatusChangeService` now own selected-id extraction and member/company approval status-change persistence, so `AdminApprovalActionService` no longer uses `AdminMainController` for those approval helpers; `AdminCertificateApprovalService` also now uses the same payload-selection support
- `AdminApprovalNavigationSupport` and `AdminApprovalAuditSupport` now own approval redirect/view-name resolution, redirect-query appending, approval audit recording, and approval audit JSON escaping, so `AdminApprovalCommandService` no longer uses `AdminMainController` for those broad approval helpers; its remaining controller use is narrowed to failure-path list repopulation
- `AdminApprovalCommandService` now also uses `AdminApprovalPagePayloadService` for approval failure-path list/model restoration, so live `AdminMainController` references are cleared from that command service
- `AdminApprovalPageModelAssembler` now also uses request-context, authority, and approval-navigation supports plus assembler-local label/option/path helpers, so live `AdminMainController` references are cleared from approval list assembly
- `AdminSystemPageModelAssembler` now uses assembler-local string normalization and direct shell-bootstrap injection for blocklist filtering and backup-config page data, so live `AdminMainController` references are cleared from that system-page assembler
- `AdminMainController` now routes its remaining institution-info lookup calls through `AdminCompanyAccountSupportService`, and the controller-local institution/file lookup helpers are removed
- `AdminMainController` no longer keeps duplicate approval status-change helper bodies; approval status persistence is now owned only by `AdminApprovalStatusChangeService`
- `AdminMainController` no longer keeps duplicate approval list/member-load/redirect-query compatibility helpers; those live lanes are now owned by `AdminApprovalPageModelAssembler`, `AdminMemberAccessSupport`, and `AdminApprovalNavigationSupport`
- `AdminMainController` has also dropped dead member-list, duplicate-check, and generic redirect-error response wrappers after those lanes moved or disappeared from live call sites
- `AdminMainController` has also dropped dead hot-path member-edit and menu-permission-diagnostics shim entries, so `AdminHotPathPagePayloadService` and `AdminSystemBuilderController` remain the live owners for those lanes
- `AdminMainController` has also dropped dead generic status/error extraction wrappers (`statusFailureResponse`, `statusSuccessResponse`, `extractResponseErrorMessage`) after those response-shaping lanes disappeared from live call sites
- `AdminMainController` has also dropped dead admin-member/company/login-history/emission-result forwarding wrappers, and no longer keeps the corresponding list/emission assembler provider indirection
- `AdminMainController` has also dropped dead approval result/navigation/status-option duplicates plus the dead password-reset forwarding/simple-row wrapper, leaving those lanes owned by `AdminApprovalNavigationSupport`, `AdminApprovalPageModelAssembler`, and `AdminMemberPageModelAssembler`
- `AdminMainController` has also dropped dead password-reset history/company-scope helper bodies (`buildPasswordResetHistoryListRows`, `resolveHistoryTargetInsttId`, `resolveCompanyNameByInsttId`, `loadAccessHistoryCompanyOptions`, `buildScopedAccessHistoryCompanyOptions`, `formatDateTime`, `resolveUserSeLabel`) together with the now-unused company-scope cache and enterprise/general member repository indirection
- `AdminMainController` has also dropped dead authority feature/profile/history duplicate wrappers plus the now-unused local JSON/audit-summary helpers, leaving those lanes owned by `AdminAuthorityPagePayloadSupport`
- `AdminMainController` has also dropped dead recommended-role and department-role-summary duplicate helpers, leaving those recommendation/summary lanes owned by `AdminAuthorityPagePayloadSupport`
- `AdminMainController` has also dropped dead reset-keyword and authority role-category/company-option duplicate wrappers, leaving those lanes owned by `AdminMemberPagePayloadService` and `AdminAuthorityPagePayloadSupport`
- `AdminMainController` has also dropped dead generic utility duplicates (`buildTemporaryPassword`, `safeJson`, `resolveRequestIp`) after command/support owners took over those utility lanes
- `AdminMainController` now also uses `AdminRequestContextSupport` and `AdminAuthorityPagePayloadSupport` directly for current-user extraction and member-management scope checks, so the controller-local thin wrappers for authority lookup, selected-institution selection, and filtered authority-group pass-throughs are removed
- `AdminMainController` has now also dropped dead admin-account/member-access/auth-group-scope compatibility helpers and its local `AuthGroupScopeContext` shim, leaving those lanes owned by `AdminAdminAccountAccessService`, `AdminMemberAccessSupport`, `AdminListQuerySupportService`, and `AdminAuthorityPagePayloadSupport`
- `AdminMainController` has now also dropped dead authority-scope normalization and fragment-search duplicates plus the unused `FrameworkAuthorityPolicyService` field, leaving those lanes owned by `AdminAuthorityPagePayloadSupport`, `AdminAuthorityCommandService`, and other dedicated owners
- `AdminMainController` has now also dropped dead payload-selection, feature-merge/filter, CSRF priming, member-evidence/file, and generic parse/phone/file-path duplicate helpers, leaving those lanes owned by `AdminPayloadSelectionSupport`, `AdminAuthorityPagePayloadSupport`, `AdminPermissionOverrideService`, `AdminMemberEvidenceSupport`, `AdminMemberAccessSupport`, and other dedicated support owners
- `AdminMainController` has now also dropped dead system summary payload builders, member-type/common-code option builders, phone/email formatting helpers, and duplicate feature-label/password helpers, leaving those lanes owned by `AdminSummaryServiceImpl`, `AdminSecurityBootstrapReadService`, `AdminMemberPagePayloadService`, `AdminMemberPageModelAssembler`, `AdminPermissionEditorService`, `AdminMemberRegisterCommandSupportService`, and `AdminCompanyAccountSupportService`
- `AdminMainController` has now also dropped dead provider wrappers plus local route/label/status/scope helper duplicates for authority, member, approval, and system lanes, so the remaining controller body is narrowed further toward direct admin entry routing and a very small shared utility surface
- `AdminMainController` has now also dropped dead compatibility route shims (`auth_group`, `auth_change`, `dept_role_mapping`, menu placeholder/fallback passthrough) and dead local file/webmaster helpers, leaving those lanes owned by dedicated controller/service owners such as `AdminSystemBuilderController`, `AdminCompanyAccountSupportService`, and authority payload/command supports
- `AdminMainController` now also drops its dead legacy constants, logger, URL-encode helper, and the huge stale import surface, so the file is now effectively a minimal admin entry/route-forward controller
- `AdminExternalConnectionController` now owns `/admin/external/connection_edit`, `AdminEmissionSiteController` now owns `/admin/emission/survey-admin` and `/admin/emission/survey-admin-data`, and `AdminHomeController` now owns the admin-home entry; `AdminMainController.java` itself has been removed
- `AdminSystemCodeController` now directly owns the `/admin/system/menu` alias route family, so the old pass-through `AdminContentMenuController.java` has been removed
- `AdminSystemCodeController` now also directly owns the `/admin/content/menu` API alias family with FAQ-branch filtering built in, so `AdminContentMenuManagementController` is reduced to page forwarding only and no longer injects another controller
- content-support page wrappers (`AdminContentMenuManagementController`, `AdminTagManagementController`, `AdminBannerController`, `AdminFaqManagementController`) now forward via `AdminReactRouteSupport` instead of direct `ReactAppViewSupport` rendering
- `AdminBoardController`, `AdminPostManagementController`, `AdminQnaCategoryController`, `AdminFileManagementController`, `AdminPopupController`, and `AdminSiteMapController` now also forward via `AdminReactRouteSupport`, clearing direct `ReactAppViewSupport` rendering from the current content-support wrapper set
- `AdminMenuManagementPageService` now owns the `menu-management` read-side payload for `/system/menu/page-data` and `/content/menu/page-data`, so `AdminSystemCodeController` no longer assembles those menu payloads inline
- `AdminMenuManagementCommandService` now owns `menu-management` order-save and create-page command orchestration for `/system/menu/*` and `/content/menu/*`, so `AdminSystemCodeController` no longer executes those write flows inline
- `AdminMenuManagementPageService` now also owns the `full-stack-management` read-side payload for `/full-stack-management/page-data`, including summary-row assembly, so `AdminSystemCodeController` no longer builds the full-stack summary inline
- `AdminMenuManagementCommandService` now also owns `/full-stack-management/menu-visibility`, including default VIEW feature metadata sync and menu-management audit recording for that write path
- `AdminPageManagementPageService` now owns the `page-management` read-side payload for `/page-management/page-data`, including permission-impact enrichment, public-catalog merge, domain-option loading, and result-message shaping, so `AdminSystemCodeController` no longer assembles that page-management view model inline
- `AdminPageManagementCommandService` now owns the `page-management` write lane for page create/update/delete and environment-managed page update/impact/delete, including redirect-error shaping and default VIEW feature synchronization/deletion for those flows
- `AdminFeatureManagementPageService` now owns the `feature-management` read-side payload for `/function-management/page-data` and `/feature-management/page-data`, including assignment-count enrichment and page-option loading
- `AdminFeatureManagementCommandService` now owns the `feature-management` write lane for feature create/update/delete and environment-feature impact/delete flows, so `AdminSystemCodeController` no longer executes feature validation, redirect shaping, or linked-permission deletion inline for that family
- `AdminCodeManagementPageService` now owns the `code-management` read-side payload for `/code/page-data`, including class/common/detail code lists, linked-reference counts, selected detail-code resolution, and query message/error shaping
- `AdminCodeManagementCommandService` now owns the `code-management` write lane for class/common/detail code create/update/delete and detail-code bulk `useAt` update flows, so `AdminSystemCodeController` no longer executes code validation, redirect shaping, or bulk update logic inline for that family
- `AdminAccessHistoryPageService` now owns the `access-history` read-side payload for `/access_history/page-data`, including scope/authority resolution, company-option loading, request-log paging, company-name enrichment, and keyword filtering, so `AdminSystemCodeController` no longer carries access-history-specific query helpers or repositories for that family
- `AdminIpWhitelistCommandService` now owns the `ip-whitelist` write lane for request creation and review decision flows, including request/rule row shaping, firewall execution feedback, audit recording, and bilingual execution messaging, so `AdminSystemCodeController` no longer carries ip-whitelist-specific command helpers or firewall plumbing for that family
- `MENU_MANAGEMENT_SUPPORT` dead duplicates are now cleared from `AdminSystemCodeController`; menu tree loading/sorting, managed-page validation, default VIEW feature sync, audit helpers, actor/request metadata helpers, and related page/menu utility wrappers remain only in the dedicated menu/page command-page services that now own those lanes
- `SYSTEM_MISC_RESIDUALS` in `AdminSystemCodeController` are now trimmed down as well; unused legacy constants, dead redirect/query helpers, dead duplicate payload wrappers, and stale owner fields/imports are removed, leaving the controller centered on live route delegation plus a very small shared utility surface
- `ScreenCommandCenterServiceImpl` authority/member/approval/company-detail metadata now points at the narrowed controller and payload/command owners instead of legacy `AdminMainController.*` entries for those live paths
- `AdminMainController` itself has now dropped its unused compatibility wrappers for approval/member/admin-account/company-account permission and redirect/audit helper lanes, so the remaining controller body is narrowed further toward only still-live local helpers and entry orchestration
- `AdminMainController` has now also dropped its duplicate permission-section, admin-preset, and default-model helper wrappers after those lanes were fully internalized by assembler/support owners, so the remaining controller helper inventory is narrower again
- admin-facing help API aliases now terminate directly in `platform-help` `HelpManagementApiController`
- `feature/admin` help ownership is now reduced to the page-forwarding shim for `/admin/system/help-management`
- `feature/admin` self-healing and safe-plan workbench entry points now use `SrTicketWorkbenchPort`
- `feature/admin` authority payload support now uses `PlatformObservabilityAuditQueryPort`
- direct `platform.* service/web` imports under `feature/admin` are now `0`

Current narrow remainder:

- remaining `feature/admin` dependence is now at contract-interface and composition ownership level, not direct platform service/web type imports
- remaining `feature/admin` observability references are now narrowed contract ports; broad observability page-facade references are cleared from live `feature/admin` code and metadata
- remaining `AdminMainController` aggregation is now concentrated on the narrower still-live local helpers and residual entry orchestration rather than route-forward, read-side page-data, approval payload assembly, authority payload assembly, member-detail payload assembly, password-reset history payload assembly, company-detail/account payload assembly, member-stats bootstrap payload assembly, member-register bootstrap/helper assembly, admin-account create/permission read-side access rules, company-account save lane, approval submit/action, member/company file-serving paths, approval selected-id/status-change helpers, approval redirect/audit helpers, legacy compatibility wrappers for permission override/editor and audit/redirect lanes, duplicate permission-section/admin-preset/default-model wrappers, live permission-editor payload assembly, live permission-override persistence, member evidence/institution merge helpers, member/company access-and-file helpers, or system-page blocklist/filter assembly; live `AdminAuthorityApiCommandService`, `AdminAuthorityFormCommandService`, `AdminListPageModelAssembler`, `AdminMemberPagePayloadService`, `AdminMemberPageModelAssembler`, `AdminMemberPasswordResetCommandService`, `AdminApprovalCommandService`, `AdminApprovalPageModelAssembler`, `AdminMemberRegisterCommandService`, `AdminMemberEditCommandService`, `AdminAdminAccountCreateCommandService`, `AdminAdminPermissionCommandService`, `AdminCompanyAccountService`, and `AdminSystemPageModelAssembler` references are cleared

Do not reopen the app-closure owner slice unless one of these changes again:

- canonical app jar path
- operator closure verifier sequence
- React route-registry runtime proof on `:18000`

Builder-family next kickoff:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-kickoff.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`
- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-partial-closeout-example.md` for the first provisional handoff shape on rows `1` and `2`

Supporting guidance when continuation state changes:

- `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`

Family-scope rule:

- close only one builder family at a time
- current active continuation family is `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`
- do not use this handoff block to close any second builder family in the same continuation turn

Builder resource-ownership routing status:

- single live entry pair routing is now stabilized
- maintenance-contract routing is now stabilized
- next useful work is row-state progress, not more routing propagation
- document alignment and canonical phrase propagation for the current family are now effectively closed
- do not spend another docs-only turn on routing cleanup unless live continuation state changes

For active continuation, treat these as the single live entry pair:

- `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-ownership-current-closeout.md`
- `docs/architecture/builder-resource-ownership-queue-map.md`

Use this as supporting maintenance-contract guidance only:

- `docs/architecture/builder-resource-entry-pair-maintenance-contract.md`

If handoff refresh changes blocker count, active row, next review target, or partial-closeout wording, update both entry-pair docs in the same turn.

Current builder resource-ownership provisional state:

- row `2` (`framework contract metadata resource`) now carries `DELETE_NOW`
- row `3` (`builder observability metadata/resource family`) now carries a stronger non-blocker note
- row `5` (`executable app resource assembly fallback`) is currently tracked as `BLOCKS_CLOSEOUT`
- row `1` (`framework-builder compatibility mapper XML`) now carries `DELETE_NOW`
- current provisional blocker count from reviewed start-now rows is `1`
- row `4` now carries a stronger non-blocker note
- active blocker-resolution target is now row `5`
- the family is in blocker-resolution state
- docs-only owner coordination is closed for the current family state
- current docs-only blocker-resolution sweep is complete for rows `1`, `2`, `3`, and `5`
- row `5` remains the only blocker row on the current docs set
- remaining docs-only valid work is limited to watched-source change detection plus exact missing-sentence confirmation
- row `3` is now fixed as a stronger non-blocker on the current document set
- row `2` is now resolved from `docs/architecture/builder-resource-review-framework-contract-metadata.md`
- current resolved read for row `2` is:
  - dedicated contract-metadata module ownership is named
  - `framework-builder-standard.md` now names the dedicated module resource as canonical shared source
  - runtime lookup and packaging now no longer depend on any root `framework/**` metadata copy
- row `1` is now resolved from `docs/architecture/builder-resource-review-framework-builder-compatibility-xml.md`
- current row-`1` delete-proof read is:
  - `FrameworkBuilderCompatibilityMapper` Java/XML ownership is finalized so the adapter jar no longer depends on shared root resource placement assumptions
  - builder-owned resource paths live under module resources
  - `apps/carbonet-app` explicitly excludes builder-owned root resources so the executable jar must consume them from dedicated builder modules
- row `1` therefore now supports `DELETE_NOW`
- row `5` should continue from `docs/architecture/builder-resource-review-executable-app-fallback.md`
- row `5` now holds a blocker-grade mixed executable-assembly dependency note
- the next useful docs-only check is watched-source change detection plus exact missing-sentence confirmation, starting again from row `5`, not more entry-routing cleanup
- current docs-only search result for row `5` still does not support `EXPLICIT_RESOURCE_SHIM`, because no one named temporary executable-app fallback reason with one explicit removal trigger is documented
- current blocker-side reading for row `5` is now strong enough to count as `BLOCKS_CLOSEOUT`
- current docs-only reading for row `5` also does not support delete-proof, because broader runtime still compiles from the legacy root source/resource layout
- do not draft another bounded replacement note on the current docs set unless a watched source doc changes and adds one exact missing sentence bundle
- review queue after row `3` is row `4` (`builder-owned root resource line excluded by app packaging`)
- row `4` partial handoff may start from `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-app-packaging-partial-closeout-example.md`
- review queue after row `4` is row `5` (`executable app resource assembly fallback`)
- row `5` partial handoff may start from `docs/ai/60-operations/session-orchestration/active/resonance-platformization-20260409/builder-resource-executable-app-partial-closeout-example.md`
- canonical partial phrase:
  - `PARTIAL_DONE: builder resource ownership closure now carries bounded DELETE_NOW notes on rows 1 and 2, stronger non-blocker notes on rows 3 and 4, and row 5 remains the only BLOCKS_CLOSEOUT fallback blocker on the current docs set.`

## Do First

1. open `docs/architecture/carbonet-resonance-separation-status.md`
2. open `docs/architecture/carbonet-resonance-boundary-classification.md`
3. confirm the selected family is still in `Priority 1A`
4. freeze owner paths before touching Java or route files
5. if the selected family is `BUILDER_RESOURCE_OWNERSHIP_CLOSURE`, resume from the single live entry pair before opening any row-specific review card

## Do Not Skip

- keep DTO ownership platform-owned when the API is control-plane owned
- keep release-unit/runtime-package/deploy-trace naming under platform governance
- keep route split work behind one frontend owner

## Verification Expectation

- document path ownership before implementation
- if runtime behavior changes on `:18000`, use the repository freshness sequence before claiming completion
- for app-closure proof, use:
  1. `bash ops/scripts/verify-app-closure-all.sh`
  2. `bash ops/scripts/codex-verify-18000-freshness.sh`

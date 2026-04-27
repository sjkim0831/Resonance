import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "../../app/routes/families/manifestBackedPageContracts";

const screenBuilderLoader = () => import("./ScreenBuilderMigrationPage");
const screenRuntimeLoader = () => import("./ScreenRuntimeMigrationPage");
const runtimeCompareLoader = () => import("./CurrentRuntimeCompareMigrationPage");
const repairWorkbenchLoader = () => import("./RepairWorkbenchMigrationPage");

const SCREEN_BUILDER_ROUTE_DEFINITIONS = [
  {
    id: "screen-builder",
    label: "화면 빌더",
    group: "platform",
    koPath: "/admin/system/screen-builder",
    enPath: "/en/admin/system/screen-builder"
  },
  {
    id: "screen-runtime",
    label: "발행 화면 런타임",
    group: "platform",
    koPath: "/admin/system/screen-runtime",
    enPath: "/en/admin/system/screen-runtime"
  },
  {
    id: "current-runtime-compare",
    label: "현재 런타임 비교",
    group: "platform",
    koPath: "/admin/system/current-runtime-compare",
    enPath: "/en/admin/system/current-runtime-compare"
  },
  {
    id: "repair-workbench",
    label: "복구 워크벤치",
    group: "platform",
    koPath: "/admin/system/repair-workbench",
    enPath: "/en/admin/system/repair-workbench"
  }
] as const satisfies RouteDefinitionsOf;

const SCREEN_BUILDER_PAGE_UNITS = [
  {
    id: "screen-builder",
    exportName: "ScreenBuilderMigrationPage",
    loader: screenBuilderLoader
  },
  {
    id: "screen-runtime",
    exportName: "ScreenRuntimeMigrationPage",
    loader: screenRuntimeLoader
  },
  {
    id: "current-runtime-compare",
    exportName: "CurrentRuntimeCompareMigrationPage",
    loader: runtimeCompareLoader
  },
  {
    id: "repair-workbench",
    exportName: "RepairWorkbenchMigrationPage",
    loader: repairWorkbenchLoader
  }
] as const satisfies PageUnitsOf<typeof SCREEN_BUILDER_ROUTE_DEFINITIONS>;

export const SCREEN_BUILDER_FAMILY = createRouteFamily(SCREEN_BUILDER_ROUTE_DEFINITIONS, SCREEN_BUILDER_PAGE_UNITS, {
  familyId: "screen-builder",
  pageFamily: "install-bind",
  ownershipLane: "BUILDER",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "screenBuilderFamily",
    templateProfile: "builder-runtime-compare-repair-suite",
    frameProfile: "admin-builder-workbench-layout",
    helpBinding: "screen-builder.help",
    accessibilityBinding: "builder-workbench-accessibility",
    securityBinding: "platform-admin-route-guard"
  },
  authorityScope: {
    actorFamily: "PLATFORM_ADMIN",
    dataScope: "PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "execute", "approve"],
    menuPolicy: "builder workbench menu visibility follows project-scoped platform-admin policy",
    entryPolicy: "platform-builder-admin-only",
    queryPolicy: "builder/runtime/compare queries stay project scoped and actor gated",
    actionPolicy: "publish, repair, and runtime actions require the same builder authority scope",
    approvalPolicy: "repair and publish approvals stay inside governed platform-admin flow",
    auditPolicy: "deny, publish, repair, and runtime actions emit audit evidence",
    tracePolicy: "builder, runtime, compare, and repair traces stay correlated by menuCode and pageId",
    denyState: "builder-governed-blocked-state"
  },
  commonDefinition: {
    owner: "features/screen-builder",
    artifacts: ["route family definition", "screen builder page manifests", "runtime compare baseline", "repair validator contract"]
  },
  projectBinding: {
    owner: "screen runtime/menu/route binding",
    menuBinding: "admin/system/screen-builder family binding",
    routeBinding: "admin/system/screen-builder family route binding",
    authorityBinding: "project-scoped builder authority narrowing",
    themeBinding: "builder studio theme token binding"
  },
  projectExecutor: {
    owner: "screen publish/repair/project runtime executor",
    responsibilities: ["screen publish execution", "repair execution", "project runtime execution"]
  },
  installDeploy: {
    packagingOwnerPath: "apps/carbonet-app/pom.xml",
    assemblyOwnerPath: "apps/carbonet-app/pom.xml :: frontend/src/features/screen-builder/screenBuilderFamily.ts :: frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/system/screen-runtime",
    bindingInputs: ["projectId", "menuCode", "pageId", "menuUrl", "canonicalRoute", "publishedVersionId", "requiredViewFeatureCode"],
    validatorChecks: ["manifest linked", "authority scope aligned", "runtime target known", "compare/repair target known", "rollback evidence present", "backend authority chain aligned"],
    runtimeVerificationTarget: "/admin/system/screen-runtime",
    compareTarget: "/admin/system/current-runtime-compare",
    deploySequence: "build-restart-18000 -> screen-runtime route verify -> current-runtime-compare -> repair-workbench",
    freshnessVerificationSequence: "build-restart-18000 -> codex freshness verify -> screen-runtime route verify -> current-runtime-compare route verify -> repair-workbench route verify",
    validator: "ops/scripts/verify-app-closure-all.sh + ops/scripts/codex-verify-18000-freshness.sh + screen-builder family route verification",
    rollbackEvidence: "ops/scripts/codex-rollback-18000.sh + runtime compare + repair workbench + deploy trace evidence",
    auditTrace: "screen builder deny/publish/repair/runtime trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(SCREEN_BUILDER_ROUTE_DEFINITIONS, {
    familyId: "screen-builder",
    manifestRoot: "screenBuilderFamily.manifest",
    menuCodePrefix: "SCREEN_BUILDER",
    validator: "screen-builder route family aggregate + runtime binding validator",
    rollbackEvidence: "runtime compare and repair workbench evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for screen-builder; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for screen-builder; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for screen-builder; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for screen-builder; common definition, project binding, and project executor lines are separately traceable."
});

import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "../../app/routes/families/manifestBackedPageContracts";

const environmentManagementLoader = () => import("./EnvironmentManagementHubPage");

const ENVIRONMENT_MANAGEMENT_ROUTE_DEFINITIONS = [
  {
    id: "environment-management",
    label: "메뉴 통합 관리",
    group: "platform",
    koPath: "/admin/system/environment-management",
    enPath: "/en/admin/system/environment-management"
  },
  {
    id: "asset-inventory",
    label: "자산 인벤토리",
    group: "platform",
    koPath: "/admin/system/asset-inventory",
    enPath: "/en/admin/system/asset-inventory"
  },
  {
    id: "asset-detail",
    label: "자산 상세",
    group: "platform",
    koPath: "/admin/system/asset-detail",
    enPath: "/en/admin/system/asset-detail"
  },
  {
    id: "asset-impact",
    label: "자산 영향도",
    group: "platform",
    koPath: "/admin/system/asset-impact",
    enPath: "/en/admin/system/asset-impact"
  },
  {
    id: "asset-lifecycle",
    label: "자산 생명주기",
    group: "platform",
    koPath: "/admin/system/asset-lifecycle",
    enPath: "/en/admin/system/asset-lifecycle"
  },
  {
    id: "asset-gap",
    label: "자산 미흡 큐",
    group: "platform",
    koPath: "/admin/system/asset-gap",
    enPath: "/en/admin/system/asset-gap"
  },
  {
    id: "verification-center",
    label: "검증 센터",
    group: "platform",
    koPath: "/admin/system/verification-center",
    enPath: "/en/admin/system/verification-center"
  },
  {
    id: "verification-assets",
    label: "검증 자산 관리",
    group: "platform",
    koPath: "/admin/system/verification-assets",
    enPath: "/en/admin/system/verification-assets"
  }
] as const satisfies RouteDefinitionsOf;

const ENVIRONMENT_MANAGEMENT_PAGE_UNITS = [
  {
    id: "environment-management",
    exportName: "EnvironmentManagementHubPage",
    loader: environmentManagementLoader
  },
  {
    id: "asset-inventory",
    exportName: "AssetInventoryMigrationPage",
    loader: () => import("../asset-inventory/AssetInventoryMigrationPage")
  },
  {
    id: "asset-detail",
    exportName: "AssetDetailMigrationPage",
    loader: () => import("../asset-inventory/AssetDetailMigrationPage")
  },
  {
    id: "asset-impact",
    exportName: "AssetImpactMigrationPage",
    loader: () => import("../asset-inventory/AssetImpactMigrationPage")
  },
  {
    id: "asset-lifecycle",
    exportName: "AssetLifecycleMigrationPage",
    loader: () => import("../asset-inventory/AssetLifecycleMigrationPage")
  },
  {
    id: "asset-gap",
    exportName: "AssetGapMigrationPage",
    loader: () => import("../asset-inventory/AssetGapMigrationPage")
  },
  {
    id: "verification-center",
    exportName: "VerificationCenterMigrationPage",
    loader: () => import("./VerificationCenterMigrationPage")
  },
  {
    id: "verification-assets",
    exportName: "VerificationAssetManagementMigrationPage",
    loader: () => import("./VerificationAssetManagementMigrationPage")
  }
] as const satisfies PageUnitsOf<typeof ENVIRONMENT_MANAGEMENT_ROUTE_DEFINITIONS>;

export const ENVIRONMENT_MANAGEMENT_FAMILY = createRouteFamily(ENVIRONMENT_MANAGEMENT_ROUTE_DEFINITIONS, ENVIRONMENT_MANAGEMENT_PAGE_UNITS, {
  familyId: "environment-management",
  pageFamily: "install-bind",
  ownershipLane: "BUILDER",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "environmentManagementFamily",
    templateProfile: "builder-environment-hub",
    frameProfile: "admin-governed-hub-layout",
    helpBinding: "environment-management.help",
    accessibilityBinding: "admin-builder-accessibility",
    securityBinding: "platform-admin-route-guard"
  },
  authorityScope: {
    actorFamily: "PLATFORM_ADMIN",
    dataScope: "PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "execute"],
    menuPolicy: "platform builder menu visibility follows project-scoped admin policy",
    entryPolicy: "platform-builder-admin-only",
    queryPolicy: "environment governance queries stay project scoped and actor gated",
    actionPolicy: "environment install/bind actions require the same builder authority scope",
    approvalPolicy: "publish/install approval stays inside platform-admin governed builder flow",
    auditPolicy: "deny and execute paths emit environment-management audit evidence",
    tracePolicy: "page/menu/project-binding traces stay correlated by menuCode and pageId",
    denyState: "builder-governed-blocked-state"
  },
  commonDefinition: {
    owner: "features/environment-management",
    artifacts: ["route family definition", "page manifest", "validator contract", "runtime compare baseline"]
  },
  projectBinding: {
    owner: "menu/route/feature binding orchestration",
    menuBinding: "admin/system/environment-management binding",
    routeBinding: "admin/system/environment-management route binding",
    authorityBinding: "project-scoped builder authority narrowing",
    themeBinding: "admin builder theme token binding"
  },
  projectExecutor: {
    owner: "environment installation and binding executor",
    responsibilities: ["environment installation", "binding execution", "project-specific activation"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/features/environment-management",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/system/environment-management",
    bindingInputs: ["projectId", "menuCode", "pageId", "menuUrl", "builder authority scope"],
    validatorChecks: ["manifest linked", "binding inputs present", "authority scope aligned", "runtime compare target reachable"],
    runtimeVerificationTarget: "/admin/system/environment-management",
    compareTarget: "/admin/system/current-runtime-compare",
    deploySequence: "frontend build -> package -> restart-18000 -> route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> route HEAD/GET verify",
    validator: "environment-management route family aggregate + binding validator",
    rollbackEvidence: "environment-management compare and repair workbench evidence",
    auditTrace: "environment-management action and project-binding trace"
  },
  pageContracts: buildManifestBackedRoutePageContracts(ENVIRONMENT_MANAGEMENT_ROUTE_DEFINITIONS, {
    familyId: "environment-management",
    manifestRoot: "environmentManagementFamily.manifest",
    menuCodePrefix: "ENVIRONMENT_MANAGEMENT",
    validator: "environment-management route family aggregate + binding validator",
    rollbackEvidence: "environment-management compare and repair workbench evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for environment-management; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for environment-management; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for environment-management; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for environment-management; common definition, project binding, and project executor lines are separately traceable."
});

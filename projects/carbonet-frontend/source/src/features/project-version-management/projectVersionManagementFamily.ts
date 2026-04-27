import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "../../app/routes/families/manifestBackedPageContracts";

const projectVersionManagementLoader = () => import("./ProjectVersionManagementMigrationPage");

const PROJECT_VERSION_MANAGEMENT_ROUTE_DEFINITIONS = [
  {
    id: "version-management",
    label: "버전 관리",
    group: "admin",
    koPath: "/admin/system/version",
    enPath: "/en/admin/system/version"
  }
] as const satisfies RouteDefinitionsOf;

const PROJECT_VERSION_MANAGEMENT_PAGE_UNITS = [
  {
    id: "version-management",
    exportName: "ProjectVersionManagementMigrationPage",
    loader: projectVersionManagementLoader
  }
] as const satisfies PageUnitsOf<typeof PROJECT_VERSION_MANAGEMENT_ROUTE_DEFINITIONS>;

export const PROJECT_VERSION_MANAGEMENT_FAMILY = createRouteFamily(PROJECT_VERSION_MANAGEMENT_ROUTE_DEFINITIONS, PROJECT_VERSION_MANAGEMENT_PAGE_UNITS, {
  familyId: "project-version-management",
  pageFamily: "install-bind",
  ownershipLane: "BUILDER",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "projectVersionManagementFamily",
    templateProfile: "version-management-admin-page",
    frameProfile: "admin-governed-detail-layout",
    helpBinding: "project-version-management.help",
    accessibilityBinding: "admin-form-accessibility",
    securityBinding: "platform-admin-route-guard"
  },
  authorityScope: {
    actorFamily: "PLATFORM_ADMIN",
    dataScope: "PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "execute"],
    menuPolicy: "platform version menu visibility follows project-scoped admin policy",
    entryPolicy: "platform-builder-admin-only",
    queryPolicy: "version queries stay project scoped and actor gated",
    actionPolicy: "publish/install actions require the same version governance scope",
    approvalPolicy: "version promotion approval stays inside platform-admin flow",
    auditPolicy: "deny and execute paths emit version-management audit evidence",
    tracePolicy: "version install/deploy traces stay correlated by pageId and project binding",
    denyState: "builder-governed-blocked-state"
  },
  commonDefinition: {
    owner: "features/project-version-management",
    artifacts: ["route family definition", "version management page manifest", "validator contract", "runtime version baseline"]
  },
  projectBinding: {
    owner: "project-version bindings and runtime version selection",
    menuBinding: "admin/system/version binding",
    routeBinding: "admin/system/version route binding",
    authorityBinding: "project-scoped version governance override",
    themeBinding: "admin builder theme token binding"
  },
  projectExecutor: {
    owner: "project version publish/install executor",
    responsibilities: ["publish execution", "install execution", "project runtime version selection"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/features/project-version-management",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/system/version",
    bindingInputs: ["projectId", "menuCode", "releaseUnitId", "publishedVersionId"],
    validatorChecks: ["version manifest linked", "binding inputs present", "authority scope aligned", "installed-version target reachable"],
    runtimeVerificationTarget: "/admin/system/version",
    compareTarget: "/admin/system/version",
    deploySequence: "frontend build -> package -> restart-18000 -> route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> version route verify",
    validator: "version-management route family aggregate + project binding validator",
    rollbackEvidence: "version-management route compare and installed-version evidence",
    auditTrace: "project version install/deploy trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(PROJECT_VERSION_MANAGEMENT_ROUTE_DEFINITIONS, {
    familyId: "project-version-management",
    manifestRoot: "projectVersionManagementFamily.manifest",
    menuCodePrefix: "PROJECT_VERSION",
    validator: "version-management route family aggregate + project binding validator",
    rollbackEvidence: "version-management route compare and installed-version evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for project-version-management; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for project-version-management; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for project-version-management; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for project-version-management; common definition, project binding, and project executor lines are separately traceable."
});

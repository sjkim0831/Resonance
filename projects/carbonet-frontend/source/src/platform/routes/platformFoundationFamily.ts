import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "../../app/routes/families/manifestBackedPageContracts";

const platformStudioLoader = () => import("../../features/platform-studio/PlatformStudioMigrationPage");
const observabilityLoader = () => import("../../features/observability/ObservabilityMigrationPage");
const helpManagementLoader = () => import("../../features/help-management/HelpManagementMigrationPage");
const codexRequestLoader = () => import("../../features/codex-provision/CodexProvisionMigrationPage");
const srWorkbenchLoader = () => import("../../features/sr-workbench/SrWorkbenchMigrationPage");

const PLATFORM_FOUNDATION_ROUTE_DEFINITIONS = [
  { id: "platform-studio", label: "플랫폼 스튜디오", group: "platform", koPath: "/admin/system/platform-studio", enPath: "/en/admin/system/platform-studio" },
  { id: "screen-elements-management", label: "화면 요소 관리", group: "platform", koPath: "/admin/system/screen-elements-management", enPath: "/en/admin/system/screen-elements-management" },
  { id: "event-management-console", label: "이벤트 관리", group: "platform", koPath: "/admin/system/event-management-console", enPath: "/en/admin/system/event-management-console" },
  { id: "function-management-console", label: "함수 콘솔", group: "platform", koPath: "/admin/system/function-management-console", enPath: "/en/admin/system/function-management-console" },
  { id: "api-management-console", label: "API 관리", group: "platform", koPath: "/admin/system/api-management-console", enPath: "/en/admin/system/api-management-console" },
  { id: "controller-management-console", label: "컨트롤러 관리", group: "platform", koPath: "/admin/system/controller-management-console", enPath: "/en/admin/system/controller-management-console" },
  { id: "db-table-management", label: "DB 테이블 관리", group: "platform", koPath: "/admin/system/db-table-management", enPath: "/en/admin/system/db-table-management" },
  { id: "column-management-console", label: "컬럼 관리", group: "platform", koPath: "/admin/system/column-management-console", enPath: "/en/admin/system/column-management-console" },
  { id: "automation-studio", label: "자동화 스튜디오", group: "platform", koPath: "/admin/system/automation-studio", enPath: "/en/admin/system/automation-studio" },
  { id: "codex-request", label: "Codex Execution Console", group: "platform", koPath: "/admin/system/codex-request", enPath: "/en/admin/system/codex-request" },
  { id: "unified-log", label: "통합 로그", group: "platform", koPath: "/admin/system/unified_log", enPath: "/en/admin/system/unified_log" },
  { id: "observability", label: "추적 조회", group: "platform", koPath: "/admin/system/observability", enPath: "/en/admin/system/observability" },
  { id: "help-management", label: "도움말 운영", group: "platform", koPath: "/admin/system/help-management", enPath: "/en/admin/system/help-management" },
  { id: "sr-workbench", label: "SR 워크벤치", group: "platform", koPath: "/admin/system/sr-workbench", enPath: "/en/admin/system/sr-workbench" }
] as const satisfies RouteDefinitionsOf;

const PLATFORM_FOUNDATION_PAGE_UNITS = [
  { id: "platform-studio", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "screen-elements-management", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "event-management-console", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "function-management-console", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "api-management-console", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "controller-management-console", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "db-table-management", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "column-management-console", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "automation-studio", exportName: "PlatformStudioMigrationPage", loader: platformStudioLoader },
  { id: "codex-request", exportName: "CodexProvisionMigrationPage", loader: codexRequestLoader },
  { id: "unified-log", exportName: "ObservabilityMigrationPage", loader: observabilityLoader },
  { id: "observability", exportName: "ObservabilityMigrationPage", loader: observabilityLoader },
  { id: "help-management", exportName: "HelpManagementMigrationPage", loader: helpManagementLoader },
  { id: "sr-workbench", exportName: "SrWorkbenchMigrationPage", loader: srWorkbenchLoader }
] as const satisfies PageUnitsOf<typeof PLATFORM_FOUNDATION_ROUTE_DEFINITIONS>;

export const PLATFORM_FOUNDATION_FAMILY = createRouteFamily(PLATFORM_FOUNDATION_ROUTE_DEFINITIONS, PLATFORM_FOUNDATION_PAGE_UNITS, {
  familyId: "platform-foundation",
  pageFamily: "registry",
  ownershipLane: "SYSTEM",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "platformFoundationFamily",
    templateProfile: "platform-governance-console-suite",
    frameProfile: "admin-platform-console-layout",
    helpBinding: "platform-foundation.help",
    accessibilityBinding: "platform-admin-accessibility",
    securityBinding: "platform-admin-route-guard"
  },
  authorityScope: {
    actorFamily: "PLATFORM_ADMIN",
    dataScope: "GLOBAL",
    actionScopes: ["view", "create", "update", "delete", "execute", "approve"],
    menuPolicy: "platform governance menus follow platform-admin visibility policy",
    entryPolicy: "platform-admin-only",
    queryPolicy: "platform governance queries stay inside platform-admin scope",
    actionPolicy: "console mutations and executions require the same platform-admin guard",
    approvalPolicy: "approval and execution escalation stay inside platform-admin flow",
    auditPolicy: "platform governance deny and execute paths emit audit evidence",
    tracePolicy: "platform studio, observability, help, codex, and SR traces stay linked by pageId",
    denyState: "platform-governed-blocked-state"
  },
  commonDefinition: {
    owner: "platform/routes/platformFoundationFamily",
    artifacts: ["route family definition", "platform governance console manifests", "aggregate validator", "platform trace baseline"]
  },
  projectBinding: {
    owner: "platform menu and route placement binding",
    menuBinding: "platform foundation admin menu binding",
    routeBinding: "platform foundation route binding",
    authorityBinding: "platform-admin authority baseline",
    themeBinding: "platform governance theme binding"
  },
  projectExecutor: {
    owner: "platform console executor integration",
    responsibilities: ["platform console execution", "platform integration execution", "governance action execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/platform/routes",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/system/platform-studio",
    bindingInputs: ["menuCode", "route ownership", "authority baseline", "project integration selection"],
    validatorChecks: ["manifest linked", "authority scope aligned", "runtime target known", "observability target known"],
    runtimeVerificationTarget: "/admin/system/platform-studio",
    compareTarget: "/admin/system/observability",
    deploySequence: "frontend build -> package -> restart-18000 -> platform route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> platform route verify",
    validator: "platform foundation route family aggregate validator",
    rollbackEvidence: "platform route compare and execution console evidence",
    auditTrace: "platform governance and observability trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(PLATFORM_FOUNDATION_ROUTE_DEFINITIONS, {
    familyId: "platform-foundation",
    manifestRoot: "platformFoundationFamily.manifest",
    menuCodePrefix: "PLATFORM_FOUNDATION",
    validator: "platform foundation route family aggregate validator",
    rollbackEvidence: "platform route compare and execution console evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for platform-foundation; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for platform-foundation; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for platform-foundation; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for platform-foundation; common definition, project binding, and project executor lines are separately traceable."
});

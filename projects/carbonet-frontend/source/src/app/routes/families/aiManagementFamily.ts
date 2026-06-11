import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const AI_MANAGEMENT_ROUTE_DEFINITIONS = [
  { id: "ai-dashboard", label: "AI 대시보드", group: "admin", koPath: "/admin/ai/dashboard", enPath: "/en/admin/ai/dashboard" },
  { id: "ai-models", label: "모델 관리", group: "admin", koPath: "/admin/ai/models", enPath: "/en/admin/ai/models" },
  { id: "ai-training", label: "학습 관리", group: "admin", koPath: "/admin/ai/training", enPath: "/en/admin/ai/training" },
  { id: "ai-rag", label: "RAG 관리", group: "admin", koPath: "/admin/ai/rag", enPath: "/en/admin/ai/rag" },
  { id: "ai-agents", label: "에이전트 관리", group: "admin", koPath: "/admin/ai/agents", enPath: "/en/admin/ai/agents" },
  { id: "ai-logs", label: "로그 관리", group: "admin", koPath: "/admin/ai/logs", enPath: "/en/admin/ai/logs" },
  { id: "ai-quality", label: "품질 관리", group: "admin", koPath: "/admin/ai/quality", enPath: "/en/admin/ai/quality" },
  { id: "ai-observability", label: "AI 관측", group: "admin", koPath: "/admin/ai/observability", enPath: "/en/admin/ai/observability" },
] as const satisfies RouteDefinitionsOf;

const AI_MANAGEMENT_PAGE_UNITS = [
  { id: "ai-dashboard", exportName: "AiDashboardPage", loader: () => import("../../../features/ai-management/AiDashboardPage") },
  { id: "ai-models", exportName: "AiModelsPage", loader: () => import("../../../features/ai-management/AiModelsPage") },
  { id: "ai-training", exportName: "AiTrainingPage", loader: () => import("../../../features/ai-management/AiTrainingPage") },
  { id: "ai-rag", exportName: "AiRagPage", loader: () => import("../../../features/ai-management/AiRagPage") },
  { id: "ai-agents", exportName: "AiAgentsPage", loader: () => import("../../../features/ai-management/AiAgentsPage") },
  { id: "ai-logs", exportName: "AiLogsPage", loader: () => import("../../../features/ai-management/AiLogsPage") },
  { id: "ai-quality", exportName: "AiQualityPage", loader: () => import("../../../features/ai-management/AiQualityPage") },
  { id: "ai-observability", exportName: "AiObservabilityPage", loader: () => import("../../../features/ai-management/AiObservabilityPage") },
] as const satisfies PageUnitsOf<typeof AI_MANAGEMENT_ROUTE_DEFINITIONS>;

export const AI_MANAGEMENT_FAMILY = createRouteFamily(AI_MANAGEMENT_ROUTE_DEFINITIONS, AI_MANAGEMENT_PAGE_UNITS, {
  familyId: "ai-management",
  pageFamily: "registry",
  ownershipLane: "SYSTEM",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: { manifestOwner: "aiManagementFamily", templateProfile: "ai-management-governance-suite", frameProfile: "admin-governed-management-layout", helpBinding: "ai-management.help", accessibilityBinding: "ai-governance-accessibility", securityBinding: "ai-management-route-guard" },
  authorityScope: { actorFamily: "ADMIN", dataScope: "GLOBAL", actionScopes: ["view","create","update","delete","execute","approve","export"], menuPolicy: "AI management menus follow admin governance visibility policy", entryPolicy: "admin-governance-only", queryPolicy: "AI management queries stay inside admin governance scope", actionPolicy: "AI management mutations require the same admin governance guard", approvalPolicy: "approval and execution escalation stay inside admin governance flow", auditPolicy: "AI management deny and execute paths emit governance audit evidence", tracePolicy: "AI management traces stay correlated by pageId", denyState: "admin-governance-denied-state" },
  commonDefinition: { owner: "app/routes/families/aiManagementFamily", artifacts: ["route family definition"] },
  projectBinding: { owner: "AI management menu binding", menuBinding: "AI management menu binding", routeBinding: "AI management route binding", authorityBinding: "admin governance authority narrowing", themeBinding: "admin governance presentation binding" },
  projectExecutor: { owner: "AI management project executor", responsibilities: ["AI management execution"] },
  installDeploy: { packagingOwnerPath: "frontend/src/app/routes/families", assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts", bootstrapPayloadTarget: "/admin/ai/dashboard", bindingInputs: ["AI management menu binding"], validatorChecks: ["AI management manifest linked"], runtimeVerificationTarget: "/admin/ai/dashboard", compareTarget: "/admin/ai/models", deploySequence: "frontend build -> package -> restart -> AI management route verify", freshnessVerificationSequence: "npm run build -> package -> restart -> AI management route verify", validator: "AI management route family aggregate validator", rollbackEvidence: "AI management governance evidence", auditTrace: "AI management governance trace" },
  pageContracts: buildManifestBackedRoutePageContracts(AI_MANAGEMENT_ROUTE_DEFINITIONS, { familyId: "ai-management", manifestRoot: "aiManagementFamily.manifest", menuCodePrefix: "AI_MANAGEMENT", validator: "AI management route family aggregate validator", rollbackEvidence: "AI management governance evidence" }),
  pageSystemizationCloseout: "CLOSED",
  authorityScopeApplicationCloseout: "CLOSED",
  builderInstallDeployCloseout: "CLOSED",
  projectBindingPatternsCloseout: "CLOSED"
});

import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const EMISSION_MONITORING_ROUTE_DEFINITIONS = [
  { id: "emission-result-list", label: "배출 결과 목록", group: "admin", koPath: "/admin/emission/result_list", enPath: "/en/admin/emission/result_list" },
  { id: "emission-result-detail", label: "결과 상세", group: "admin", koPath: "/admin/emission/result_detail", enPath: "/en/admin/emission/result_detail" },
  { id: "emission-validate", label: "검증 관리", group: "admin", koPath: "/admin/emission/validate", enPath: "/en/admin/emission/validate" },
  { id: "emission-management", label: "배출 변수 관리", group: "admin", koPath: "/admin/emission/management", enPath: "/en/admin/emission/management" },
  { id: "emission-lci-classification", label: "LCI 분류 관리", group: "admin", koPath: "/admin/emission/lci-classification", enPath: "/en/admin/emission/lci-classification" },
  { id: "emission-definition-studio", label: "배출 정의 관리", group: "admin", koPath: "/admin/emission/definition-studio", enPath: "/en/admin/emission/definition-studio" },
  { id: "emission-gwp-values", label: "GWP 값 관리", group: "admin", koPath: "/admin/emission/gwp-values", enPath: "/en/admin/emission/gwp-values" },
  { id: "emission-ecoinvent-admin", label: "ecoinvent 배출계수 관리", group: "admin", koPath: "/admin/emission/ecoinvent", enPath: "/en/admin/emission/ecoinvent" },
  { id: "emission-survey-admin", label: "배출 설문 관리", group: "admin", koPath: "/admin/emission/survey-admin", enPath: "/en/admin/emission/survey-admin" },
  { id: "emission-survey-report", label: "배출 설문 리포트", group: "admin", koPath: "/admin/emission/survey-report", enPath: "/en/admin/emission/survey-report" },
  { id: "emission-survey-admin-data", label: "배출 설문 데이터셋", group: "admin", koPath: "/admin/emission/survey-admin-data", enPath: "/en/admin/emission/survey-admin-data" },
  { id: "emission-data-history", label: "데이터 변경 이력", group: "admin", koPath: "/admin/emission/data_history", enPath: "/en/admin/emission/data_history" },
  { id: "emission-site-management", label: "배출지 관리", group: "admin", koPath: "/admin/emission/site-management", enPath: "/en/admin/emission/site-management" },
  { id: "certificate-rec-check", label: "REC 중복 확인", group: "admin", koPath: "/admin/certificate/rec_check", enPath: "/en/admin/certificate/rec_check" },
  { id: "certificate-audit-log", label: "인증서 감사 로그", group: "admin", koPath: "/admin/certificate/audit-log", enPath: "/en/admin/certificate/audit-log" },
  { id: "certificate-objection-list", label: "이의신청 처리", group: "admin", koPath: "/admin/certificate/objection_list", enPath: "/en/admin/certificate/objection_list" },
  { id: "emission-project-list", label: "배출량 관리", group: "home", koPath: "/emission/project_list", enPath: "/en/emission/project_list" },
  { id: "emission-reduction", label: "감축 시나리오", group: "home", koPath: "/emission/reduction", enPath: "/en/emission/reduction" },
  { id: "emission-lci", label: "LCI DB 조회", group: "home", koPath: "/emission/lci", enPath: "/en/emission/lci" },
  { id: "emission-data-input", label: "데이터 입력", group: "home", koPath: "/emission/data_input", enPath: "/en/emission/data_input" },
  { id: "emission-report-submit", label: "배출량 보고서 작성", group: "home", koPath: "/emission/report_submit", enPath: "/en/emission/report_submit" },
  { id: "emission-lca", label: "LCA 분석", group: "home", koPath: "/emission/lca", enPath: "/en/emission/lca" },
  { id: "emission-simulate", label: "시뮬레이션", group: "home", koPath: "/emission/simulate", enPath: "/en/emission/simulate" },
  { id: "monitoring-dashboard", label: "통합 대시보드", group: "home", koPath: "/monitoring/dashboard", enPath: "/en/monitoring/dashboard" },
  { id: "monitoring-realtime", label: "실시간 모니터링", group: "home", koPath: "/monitoring/realtime", enPath: "/en/monitoring/realtime" },
  { id: "monitoring-alerts", label: "경보 현황", group: "home", koPath: "/monitoring/alerts", enPath: "/en/monitoring/alerts" },
  { id: "monitoring-statistics", label: "ESG 보고서", group: "home", koPath: "/monitoring/statistics", enPath: "/en/monitoring/statistics" },
  { id: "monitoring-share", label: "이해관계자 공유", group: "home", koPath: "/monitoring/share", enPath: "/en/monitoring/share" },
  { id: "monitoring-reduction-trend", label: "성과 추이 분석", group: "home", koPath: "/monitoring/reduction_trend", enPath: "/en/monitoring/reduction_trend" },
  { id: "monitoring-track", label: "추적 리포트", group: "home", koPath: "/monitoring/track", enPath: "/en/monitoring/track" },
  { id: "monitoring-export", label: "분석 리포트 내보내기", group: "home", koPath: "/monitoring/export", enPath: "/en/monitoring/export" },
  { id: "co2-production-list", label: "생산 정보", group: "home", koPath: "/co2/production_list", enPath: "/en/co2/production_list" },
  { id: "co2-demand-list", label: "수요 정보", group: "home", koPath: "/co2/demand_list", enPath: "/en/co2/demand_list" },
  { id: "co2-integrity", label: "무결성 추적", group: "home", koPath: "/co2/integrity", enPath: "/en/co2/integrity" },
  { id: "co2-credit", label: "탄소 크레딧", group: "home", koPath: "/co2/credit", enPath: "/en/co2/credit" },
  { id: "co2-analysis", label: "품질 지표", group: "home", koPath: "/co2/analysis", enPath: "/en/co2/analysis" },
  { id: "co2-search", label: "MRV 정보", group: "home", koPath: "/co2/search", enPath: "/en/co2/search" },
  { id: "emission-home-validate", label: "산정 검증", group: "home", koPath: "/emission/validate", enPath: "/en/emission/validate" }
] as const satisfies RouteDefinitionsOf;

const EMISSION_MONITORING_PAGE_UNITS = [
  { id: "emission-result-list", exportName: "EmissionResultListMigrationPage", loader: () => import("../../../features/emission-result-list/EmissionResultListMigrationPage") },
  { id: "emission-result-detail", exportName: "EmissionResultDetailMigrationPage", loader: () => import("../../../features/emission-result-detail/EmissionResultDetailMigrationPage") },
  { id: "emission-validate", exportName: "EmissionValidateMigrationPage", loader: () => import("../../../features/emission-validate/EmissionValidateMigrationPage") },
  { id: "emission-management", exportName: "EmissionManagementMigrationPage", loader: () => import("../../../features/emission-management/EmissionManagementMigrationPage") },
  { id: "emission-lci-classification", exportName: "EmissionLciClassificationMigrationPage", loader: () => import("../../../features/emission-lci-classification/EmissionLciClassificationMigrationPage") },
  { id: "emission-definition-studio", exportName: "EmissionDefinitionStudioMigrationPage", loader: () => import("../../../features/emission-definition-studio") },
  { id: "emission-gwp-values", exportName: "EmissionGwpValuesMigrationPage", loader: () => import("../../../features/emission-gwp-values/EmissionGwpValuesMigrationPage") },
  { id: "emission-ecoinvent-admin", exportName: "EmissionEcoinventAdminMigrationPage", loader: () => import("../../../features/emission-ecoinvent-admin/EmissionEcoinventAdminMigrationPage") },
  { id: "emission-survey-admin", exportName: "EmissionSurveyAdminMigrationPage", loader: () => import("../../../features/emission-survey-admin/EmissionSurveyAdminMigrationPage") },
  { id: "emission-survey-report", exportName: "EmissionSurveyReportMigrationPage", loader: () => import("../../../features/emission-survey-report/EmissionSurveyReportMigrationPage") },
  { id: "emission-survey-admin-data", exportName: "EmissionSurveyAdminDataMigrationPage", loader: () => import("../../../features/emission-survey-admin-data/EmissionSurveyAdminDataMigrationPage") },
  { id: "emission-data-history", exportName: "EmissionDataHistoryMigrationPage", loader: () => import("../../../features/emission-data-history/EmissionDataHistoryMigrationPage") },
  { id: "emission-site-management", exportName: "EmissionSiteManagementMigrationPage", loader: () => import("../../../features/emission-site-management/EmissionSiteManagementMigrationPage") },
  { id: "certificate-rec-check", exportName: "CertificateRecCheckMigrationPage", loader: () => import("../../../features/certificate-rec-check/CertificateRecCheckMigrationPage") },
  { id: "certificate-audit-log", exportName: "CertificateAuditLogMigrationPage", loader: () => import("../../../features/certificate-audit-log/CertificateAuditLogMigrationPage") },
  { id: "certificate-objection-list", exportName: "CertificateObjectionListMigrationPage", loader: () => import("../../../features/certificate-objection-list/CertificateObjectionListMigrationPage") },
  { id: "emission-project-list", exportName: "EmissionProjectListMigrationPage", loader: () => import("../../../features/emission-project-list/EmissionProjectListMigrationPage") },
  { id: "emission-reduction", exportName: "EmissionReductionMigrationPage", loader: () => import("../../../features/emission-reduction/EmissionReductionMigrationPage") },
  { id: "emission-lci", exportName: "EmissionLciMigrationPage", loader: () => import("../../../features/emission-lci/EmissionLciMigrationPage") },
  { id: "emission-data-input", exportName: "EmissionDataInputMigrationPage", loader: () => import("../../../features/emission-data-input/EmissionDataInputMigrationPage") },
  { id: "emission-report-submit", exportName: "EmissionReportSubmitMigrationPage", loader: () => import("../../../features/emission-report-submit/EmissionReportSubmitMigrationPage") },
  { id: "emission-lca", exportName: "EmissionLcaMigrationPage", loader: () => import("../../../features/emission-lca/EmissionLcaMigrationPage") },
  { id: "emission-simulate", exportName: "EmissionSimulateMigrationPage", loader: () => import("../../../features/emission-simulate/EmissionSimulateMigrationPage") },
  { id: "monitoring-dashboard", exportName: "MonitoringDashboardMigrationPage", loader: () => import("../../../features/monitoring-dashboard/MonitoringDashboardMigrationPage") },
  { id: "monitoring-realtime", exportName: "MonitoringRealtimeMigrationPage", loader: () => import("../../../features/monitoring-dashboard/MonitoringRealtimeMigrationPage") },
  { id: "monitoring-alerts", exportName: "MonitoringAlertsMigrationPage", loader: () => import("../../../features/monitoring-dashboard/MonitoringAlertsMigrationPage") },
  { id: "monitoring-statistics", exportName: "MonitoringStatisticsMigrationPage", loader: () => import("../../../features/monitoring-statistics/MonitoringStatisticsMigrationPage") },
  { id: "monitoring-share", exportName: "MonitoringShareMigrationPage", loader: () => import("../../../features/monitoring-share/MonitoringShareMigrationPage") },
  { id: "monitoring-reduction-trend", exportName: "MonitoringReductionTrendMigrationPage", loader: () => import("../../../features/monitoring-reduction-trend/MonitoringReductionTrendMigrationPage") },
  { id: "monitoring-track", exportName: "MonitoringTrackMigrationPage", loader: () => import("../../../features/monitoring-track/MonitoringTrackMigrationPage") },
  { id: "monitoring-export", exportName: "MonitoringExportMigrationPage", loader: () => import("../../../features/monitoring-export/MonitoringExportMigrationPage") },
  { id: "co2-production-list", exportName: "Co2ProductionListMigrationPage", loader: () => import("../../../features/co2-production-list/Co2ProductionListMigrationPage") },
  { id: "co2-demand-list", exportName: "Co2DemandListMigrationPage", loader: () => import("../../../features/co2-demand-list/Co2DemandListMigrationPage") },
  { id: "co2-integrity", exportName: "Co2IntegrityMigrationPage", loader: () => import("../../../features/co2-integrity/Co2IntegrityMigrationPage") },
  { id: "co2-credit", exportName: "Co2CreditMigrationPage", loader: () => import("../../../features/co2-credit/Co2CreditMigrationPage") },
  { id: "co2-analysis", exportName: "Co2AnalysisMigrationPage", loader: () => import("../../../features/co2-analysis/Co2AnalysisMigrationPage") },
  { id: "co2-search", exportName: "Co2SearchMigrationPage", loader: () => import("../../../features/co2-search/Co2SearchMigrationPage") },
  { id: "emission-home-validate", exportName: "EmissionHomeValidateMigrationPage", loader: () => import("../../../features/emission-home-validate/EmissionHomeValidateMigrationPage") }
] as const satisfies PageUnitsOf<typeof EMISSION_MONITORING_ROUTE_DEFINITIONS>;

export const EMISSION_MONITORING_FAMILY = createRouteFamily(EMISSION_MONITORING_ROUTE_DEFINITIONS, EMISSION_MONITORING_PAGE_UNITS, {
  familyId: "emission-monitoring",
  pageFamily: "registry",
  ownershipLane: "PROJECT",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "emissionMonitoringFamily",
    templateProfile: "emission-monitoring-and-certificate-suite",
    frameProfile: "emission-home-and-admin-layout",
    helpBinding: "emission-monitoring.help",
    accessibilityBinding: "emission-monitoring-accessibility",
    securityBinding: "emission-monitoring-route-guard"
  },
  authorityScope: {
    actorFamily: "MEMBER_AND_ADMIN",
    dataScope: "PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "approve", "execute", "export"],
    menuPolicy: "emission and monitoring menus follow project-scoped member/admin visibility policy",
    entryPolicy: "emission-admin-or-home-route",
    queryPolicy: "emission, monitoring, and certificate queries stay project scoped and actor gated",
    actionPolicy: "save, calculate, approval, and monitoring actions require the same governed scope",
    approvalPolicy: "emission and certificate approvals stay inside the same project-scoped authority flow",
    auditPolicy: "emission deny, save, calculate, and approval paths emit audit evidence",
    tracePolicy: "emission and monitoring traces stay correlated by pageId, menuCode, and project scope",
    denyState: "emission-monitoring-denied-state"
  },
  commonDefinition: {
    owner: "app/routes/families/emissionMonitoringFamily",
    artifacts: ["route family definition", "emission monitoring page manifests", "emission validator", "emission trace baseline"]
  },
  projectBinding: {
    owner: "emission menu, route, and project scope binding",
    menuBinding: "emission and monitoring menu binding",
    routeBinding: "emission/monitoring/co2 route binding",
    authorityBinding: "emission project-scoped authority narrowing",
    themeBinding: "emission monitoring presentation binding"
  },
  projectExecutor: {
    owner: "emission save/calculate/approval project executor",
    responsibilities: ["emission save execution", "calculate execution", "approval execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/emission/management",
    bindingInputs: ["projectId", "emission menu binding", "authority narrowing", "calculation/runtime target binding"],
    validatorChecks: ["emission manifest linked", "authority scope aligned", "calculation path known", "monitoring target known", "rollback evidence linked"],
    runtimeVerificationTarget: "/admin/emission/management",
    compareTarget: "/monitoring/dashboard",
    deploySequence: "frontend build -> package -> restart-18000 -> emission route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> emission route verify",
    validator: "emission-monitoring route family aggregate validator",
    rollbackEvidence: "emission compare/calculate/audit evidence",
    auditTrace: "emission save/calculate and monitoring trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(EMISSION_MONITORING_ROUTE_DEFINITIONS, {
    familyId: "emission-monitoring",
    manifestRoot: "emissionMonitoringFamily.manifest",
    menuCodePrefix: "EMISSION_MONITORING",
    validator: "emission-monitoring route family aggregate validator",
    rollbackEvidence: "emission compare/calculate/audit evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for emission-monitoring; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for emission-monitoring; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for emission-monitoring; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for emission-monitoring; common definition, project binding, and project executor lines are separately traceable."
});

package egovframework.com.platform.codex.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.common.governance.service.UpgradeGovernanceService;
import egovframework.com.platform.governance.dto.FullStackGovernanceAutoCollectRequest;
import egovframework.com.platform.governance.dto.FullStackGovernanceSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionInputSessionSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionManagementElementSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionDefinitionDraftSaveRequest;
import egovframework.com.feature.admin.service.EmissionClassificationCatalogService;
import egovframework.com.platform.governance.dto.WbsManagementSaveRequest;
import egovframework.com.platform.governance.service.AdminSummaryCommandService;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;
import egovframework.com.feature.admin.service.AdminEmissionManagementElementRegistryService;
import egovframework.com.feature.admin.service.AdminEmissionManagementService;
import egovframework.com.platform.governance.service.FullStackGovernanceRegistryCommandService;
import egovframework.com.platform.governance.service.WbsManagementService;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.operations.OperationsActionGate;
import egovframework.com.platform.executiongate.operations.OperationsActionGateRequest;
import egovframework.com.platform.executiongate.operations.OperationsActionGateResponse;
import egovframework.com.platform.codex.model.CodexAdminActorContext;
import egovframework.com.platform.codex.model.CodexExecutionHistoryResponse;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.read.FullStackGovernanceRegistryReadPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FullStackOperationsActionGateService implements OperationsActionGate {

    private static final Logger log = LoggerFactory.getLogger(FullStackOperationsActionGateService.class);
    private static final String FULL_STACK_MENU_CODE = "A1900101";
    private static final String WBS_MENU_CODE = "A1900104";
    private static final String EMISSION_MENU_CODE = "A0300000";
    private static final String EMISSION_DEFINITION_STUDIO_MENU_CODE = "A0020108";

    private final FullStackGovernanceRegistryReadPort fullStackGovernanceRegistryReadPort;
    private final FullStackGovernanceRegistryCommandService fullStackGovernanceRegistryCommandService;
    private final WbsManagementService wbsManagementService;
    private final AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService;
    private final AdminEmissionManagementService adminEmissionManagementService;
    private final AdminEmissionManagementElementRegistryService adminEmissionManagementElementRegistryService;
    private final EmissionClassificationCatalogService emissionClassificationCatalogService;
    private final AdminSummaryCommandService adminSummaryCommandService;
    private final UpgradeGovernanceService upgradeGovernanceService;
    private final CodexAdminOperationsGateAdapter codexAdminOperationsGateAdapter;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper objectMapper;

    public FullStackOperationsActionGateService(FullStackGovernanceRegistryReadPort fullStackGovernanceRegistryReadPort,
                                                FullStackGovernanceRegistryCommandService fullStackGovernanceRegistryCommandService,
                                                WbsManagementService wbsManagementService,
                                                AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService,
                                                AdminEmissionManagementService adminEmissionManagementService,
                                                AdminEmissionManagementElementRegistryService adminEmissionManagementElementRegistryService,
                                                EmissionClassificationCatalogService emissionClassificationCatalogService,
                                                AdminSummaryCommandService adminSummaryCommandService,
                                                UpgradeGovernanceService upgradeGovernanceService,
                                                CodexAdminOperationsGateAdapter codexAdminOperationsGateAdapter,
                                                AuditTrailService auditTrailService,
                                                ObjectMapper objectMapper) {
        this.fullStackGovernanceRegistryReadPort = fullStackGovernanceRegistryReadPort;
        this.fullStackGovernanceRegistryCommandService = fullStackGovernanceRegistryCommandService;
        this.wbsManagementService = wbsManagementService;
        this.adminEmissionDefinitionStudioService = adminEmissionDefinitionStudioService;
        this.adminEmissionManagementService = adminEmissionManagementService;
        this.adminEmissionManagementElementRegistryService = adminEmissionManagementElementRegistryService;
        this.emissionClassificationCatalogService = emissionClassificationCatalogService;
        this.adminSummaryCommandService = adminSummaryCommandService;
        this.upgradeGovernanceService = upgradeGovernanceService;
        this.codexAdminOperationsGateAdapter = codexAdminOperationsGateAdapter;
        this.auditTrailService = auditTrailService;
        this.objectMapper = objectMapper;
    }

    @Override
    public OperationsActionGateResponse execute(OperationsActionGateRequest request) {
        try {
            Object payload = switch (safe(request.actionKey())) {
                case "full-stack.registry.get" -> getRegistry(request);
                case "full-stack.registry.save" -> saveRegistry(request);
                case "full-stack.registry.auto-collect" -> autoCollectRegistry(request);
                case "wbs.entry.save" -> saveWbsEntry(request);
                case "emission-definition-studio.draft.save" -> saveEmissionDefinitionDraft(request);
                case "emission-definition-studio.draft.publish" -> publishEmissionDefinitionDraft(request);
                case "emission.categories.get" -> getEmissionCategories(request);
                case "emission.tiers.get" -> getEmissionTiers(request);
                case "emission.variables.get" -> getEmissionVariables(request);
                case "emission.input-session.save" -> saveEmissionInputSession(request);
                case "emission.input-session.get" -> getEmissionInputSession(request);
                case "emission.input-session.calculate" -> calculateEmissionInputSession(request);
                case "emission.lime-factor.get" -> getLimeDefaultFactor();
                case "emission.element-definitions.get" -> getEmissionElementDefinitions(request);
                case "emission.element-definitions.save" -> saveEmissionElementDefinition(request);
                case "emission.definition-scope.materialize" -> materializeEmissionDefinitionScope(request);
                case "emission.scope-status.get" -> getEmissionScopeStatus(request);
                case "emission.definition-scope.precheck" -> precheckEmissionDefinitionScope(request);
                case "system-builder.menu-permission.auto-cleanup" -> runMenuPermissionAutoCleanup(request);
                case "system-builder.security-policy.state" -> updateSecurityInsightState(request);
                case "system-builder.security-monitoring.state" -> updateSecurityMonitoringState(request);
                case "system-builder.security-monitoring.block-candidates.register" -> registerSecurityMonitoringBlockCandidate(request);
                case "system-builder.security-monitoring.block-candidates.update" -> updateSecurityMonitoringBlockCandidate(request);
                case "system-builder.security-monitoring.notify" -> dispatchSecurityMonitoringNotification(request);
                case "system-builder.security-history.action" -> executeSecurityHistoryAction(request);
                case "system-builder.security-policy.clear-suppressions" -> clearSecurityInsightSuppressions(request);
                case "system-builder.security-policy.auto-fix" -> runSecurityInsightAutoFix(request);
                case "system-builder.security-policy.auto-fix-bulk" -> runSecurityInsightBulkAutoFix(request);
                case "system-builder.security-policy.notification-config" -> saveSecurityInsightNotificationConfig(request);
                case "system-builder.security-policy.rollback" -> runSecurityInsightRollback(request);
                case "system-builder.security-policy.dispatch" -> dispatchSecurityInsightNotifications(request);
                case "governance.upgrades.evaluate" -> evaluateGovernanceUpgradeCandidates(request);
                case "codex-admin.execute" -> executeCodexProvision(request);
                case "codex-admin.history.list" -> listCodexHistory(request);
                case "codex-admin.history.inspect" -> inspectCodexHistory(request);
                case "codex-admin.history.remediate" -> remediateCodexHistory(request);
                case "codex-admin.tickets.list" -> listCodexTickets(request);
                case "codex-admin.tickets.detail" -> getCodexTicketDetail(request);
                case "codex-admin.tickets.artifact" -> getCodexTicketArtifact(request);
                case "codex-admin.tickets.prepare" -> prepareCodexTicket(request);
                case "codex-admin.tickets.plan" -> planCodexTicket(request);
                case "codex-admin.tickets.execute" -> executeCodexTicket(request);
                case "codex-admin.tickets.direct-execute" -> directExecuteCodexTicket(request);
                case "codex-admin.tickets.queue-direct-execute" -> queueDirectExecuteCodexTicket(request);
                case "codex-admin.tickets.skip-plan-execute" -> skipPlanExecuteCodexTicket(request);
                case "codex-admin.tickets.rollback" -> rollbackCodexTicket(request);
                case "codex-admin.tickets.reissue" -> reissueCodexTicket(request);
                case "codex-admin.tickets.delete" -> deleteCodexTicket(request);
                case "sr-workbench.page.get" -> getSrWorkbenchPage(request);
                case "sr-workbench.tickets.create" -> createSrWorkbenchTicket(request);
                case "sr-workbench.tickets.quick-execute" -> quickExecuteSrWorkbenchTicket(request);
                case "sr-workbench.stack-items.add" -> addSrWorkbenchStackItem(request);
                case "sr-workbench.stack-items.remove" -> removeSrWorkbenchStackItem(request);
                case "sr-workbench.stack-items.clear" -> clearSrWorkbenchStack(request);
                case "sr-workbench.tickets.approval.update" -> updateSrWorkbenchApproval(request);
                case "sr-workbench.tickets.prepare" -> prepareSrWorkbenchExecution(request);
                case "sr-workbench.tickets.plan" -> planSrWorkbenchTicket(request);
                case "sr-workbench.tickets.execute" -> executeSrWorkbenchTicket(request);
                case "sr-workbench.tickets.direct-execute" -> directExecuteSrWorkbenchTicket(request);
                case "sr-workbench.tickets.skip-plan-execute" -> skipPlanExecuteSrWorkbenchTicket(request);
                default -> throw new IllegalArgumentException("Unsupported operations action: " + request.actionKey());
            };
            return new OperationsActionGateResponse(
                    request.context() == null ? ExecutionGateVersion.CURRENT : request.context().executionGateVersion(),
                    request.actionKey(),
                    "SUCCESS",
                    payload instanceof Map<?, ?> map ? castPayload(map) : Map.of("result", payload)
            );
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Operations action execution failed.", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castPayload(Map<?, ?> payload) {
        return (Map<String, Object>) payload;
    }

    private Map<String, Object> getRegistry(OperationsActionGateRequest request) {
        return fullStackGovernanceRegistryReadPort.getEntry(stringParam(request, "menuCode"));
    }

    private Map<String, Object> saveRegistry(OperationsActionGateRequest request) {
        FullStackGovernanceSaveRequest saveRequest = convert(nestedParam(request, "request"), FullStackGovernanceSaveRequest.class);
        Map<String, Object> beforeState = fullStackGovernanceRegistryReadPort.getEntry(saveRequest == null ? "" : saveRequest.getMenuCode());
        Map<String, Object> saved = fullStackGovernanceRegistryCommandService.saveEntry(saveRequest);
        auditTrailService.record(
                stringParam(request, "actorId"),
                stringParam(request, "actorRole"),
                FULL_STACK_MENU_CODE,
                "full-stack-management",
                "FULL_STACK_GOVERNANCE_SAVE",
                "FULL_STACK_GOVERNANCE_REGISTRY",
                safe(saveRequest == null ? null : saveRequest.getMenuCode()),
                "SUCCESS",
                "Full-stack governance registry saved",
                safeJson(beforeState),
                safeJson(saved),
                stringParam(request, "requestIp"),
                stringParam(request, "userAgent")
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "풀스택 관리 메타데이터를 저장했습니다.");
        response.put("entry", saved);
        return response;
    }

    private Map<String, Object> autoCollectRegistry(OperationsActionGateRequest request) throws Exception {
        FullStackGovernanceAutoCollectRequest autoCollectRequest = convert(nestedParam(request, "request"), FullStackGovernanceAutoCollectRequest.class);
        Map<String, Object> beforeState = fullStackGovernanceRegistryReadPort.getEntry(autoCollectRequest == null ? "" : autoCollectRequest.getMenuCode());
        Map<String, Object> collected = fullStackGovernanceRegistryCommandService.autoCollectEntry(autoCollectRequest);
        auditTrailService.record(
                stringParam(request, "actorId"),
                stringParam(request, "actorRole"),
                FULL_STACK_MENU_CODE,
                "platform-studio",
                "FULL_STACK_GOVERNANCE_AUTO_COLLECT",
                "FULL_STACK_GOVERNANCE_REGISTRY",
                safe(autoCollectRequest == null ? null : autoCollectRequest.getMenuCode()),
                "SUCCESS",
                "Full-stack governance registry auto-collected",
                safeJson(beforeState),
                safeJson(collected),
                stringParam(request, "requestIp"),
                stringParam(request, "userAgent")
        );
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "화면 메타데이터를 자동 수집해 거버넌스 레지스트리에 반영했습니다.");
        response.put("entry", collected);
        return response;
    }

    private Map<String, Object> saveWbsEntry(OperationsActionGateRequest request) {
        WbsManagementSaveRequest saveRequest = convert(nestedParam(request, "request"), WbsManagementSaveRequest.class);
        Map<String, Object> saved = wbsManagementService.saveEntry(saveRequest);
        auditTrailService.record(
                stringParam(request, "actorId"),
                stringParam(request, "actorRole"),
                WBS_MENU_CODE,
                "wbs-management",
                "WBS_ENTRY_SAVE",
                "WBS_MANAGEMENT_ENTRY",
                safe(saveRequest == null ? null : saveRequest.getMenuCode()),
                "SUCCESS",
                "WBS management entry saved",
                "",
                safeJson(saved),
                stringParam(request, "requestIp"),
                stringParam(request, "userAgent")
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "WBS 항목을 저장했습니다.");
        response.put("entry", saved);
        return response;
    }

    private Map<String, Object> evaluateGovernanceUpgradeCandidates(OperationsActionGateRequest request) throws Exception {
        String projectId = stringParam(request, "projectId");
        List<Map<String, Object>> candidates = upgradeGovernanceService.evaluateUpgradeCandidates(projectId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("projectId", projectId);
        response.put("candidates", candidates);
        response.put("count", candidates.size());
        return response;
    }

    private Map<String, Object> saveEmissionDefinitionDraft(OperationsActionGateRequest request) {
        EmissionDefinitionDraftSaveRequest saveRequest = convert(nestedParam(request, "request"), EmissionDefinitionDraftSaveRequest.class);
        return adminEmissionDefinitionStudioService.saveDraft(
                saveRequest,
                stringParam(request, "actorId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> publishEmissionDefinitionDraft(OperationsActionGateRequest request) {
        return adminEmissionDefinitionStudioService.publishDraft(
                stringParam(request, "draftId"),
                stringParam(request, "actorId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> getEmissionCategories(OperationsActionGateRequest request) {
        Map<String, Object> response = adminEmissionManagementService.getCategoryList(stringParam(request, "searchKeyword"));
        emissionClassificationCatalogService.enrichCategoryItems(response.get("items"));
        return response;
    }

    private Map<String, Object> getEmissionTiers(OperationsActionGateRequest request) {
        return adminEmissionManagementService.getTierList(longParam(request, "categoryId"));
    }

    private Map<String, Object> getEmissionVariables(OperationsActionGateRequest request) {
        return adminEmissionManagementService.getVariableDefinitions(longParam(request, "categoryId"), intParam(request, "tier"));
    }

    private Map<String, Object> saveEmissionInputSession(OperationsActionGateRequest request) {
        EmissionInputSessionSaveRequest saveRequest = convert(nestedParam(request, "request"), EmissionInputSessionSaveRequest.class);
        return adminEmissionManagementService.saveInputSession(saveRequest, stringParam(request, "actorId"));
    }

    private Map<String, Object> getEmissionInputSession(OperationsActionGateRequest request) {
        return adminEmissionManagementService.getInputSession(longParam(request, "sessionId"));
    }

    private Map<String, Object> calculateEmissionInputSession(OperationsActionGateRequest request) {
        return adminEmissionManagementService.calculateInputSession(longParam(request, "sessionId"));
    }

    private Map<String, Object> getLimeDefaultFactor() {
        return adminEmissionManagementService.getLimeDefaultFactor();
    }

    private Map<String, Object> getEmissionElementDefinitions(OperationsActionGateRequest request) {
        return adminEmissionManagementElementRegistryService.buildRegistryPayload(boolParam(request, "isEn"));
    }

    private Map<String, Object> saveEmissionElementDefinition(OperationsActionGateRequest request) {
        EmissionManagementElementSaveRequest saveRequest = convert(nestedParam(request, "request"), EmissionManagementElementSaveRequest.class);
        return adminEmissionManagementElementRegistryService.saveElementDefinition(
                saveRequest,
                stringParam(request, "actorId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> materializeEmissionDefinitionScope(OperationsActionGateRequest request) {
        return adminEmissionManagementService.materializePublishedDefinitionScope(
                stringParam(request, "draftId"),
                stringParam(request, "actorId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> getEmissionScopeStatus(OperationsActionGateRequest request) {
        return adminEmissionManagementService.getScopeStatus(
                stringParam(request, "categoryCode"),
                intParam(request, "tier"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> precheckEmissionDefinitionScope(OperationsActionGateRequest request) {
        return adminEmissionManagementService.precheckPublishedDefinitionScope(
                stringParam(request, "draftId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> runMenuPermissionAutoCleanup(OperationsActionGateRequest request) {
        return adminSummaryCommandService.runMenuPermissionAutoCleanup(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                stringListParam(request, "menuUrls"));
    }

    private Map<String, Object> updateSecurityInsightState(OperationsActionGateRequest request) {
        return adminSummaryCommandService.updateSecurityInsightState(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> updateSecurityMonitoringState(OperationsActionGateRequest request) {
        return adminSummaryCommandService.updateSecurityMonitoringState(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> registerSecurityMonitoringBlockCandidate(OperationsActionGateRequest request) {
        return adminSummaryCommandService.registerSecurityMonitoringBlockCandidate(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> updateSecurityMonitoringBlockCandidate(OperationsActionGateRequest request) {
        return adminSummaryCommandService.updateSecurityMonitoringBlockCandidate(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> dispatchSecurityMonitoringNotification(OperationsActionGateRequest request) {
        return adminSummaryCommandService.dispatchSecurityMonitoringNotification(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> executeSecurityHistoryAction(OperationsActionGateRequest request) {
        return adminSummaryCommandService.executeSecurityHistoryAction(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> clearSecurityInsightSuppressions(OperationsActionGateRequest request) {
        return adminSummaryCommandService.clearSecurityInsightSuppressions(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"));
    }

    private Map<String, Object> runSecurityInsightAutoFix(OperationsActionGateRequest request) {
        return adminSummaryCommandService.runSecurityInsightAutoFix(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> runSecurityInsightBulkAutoFix(OperationsActionGateRequest request) {
        return adminSummaryCommandService.runSecurityInsightBulkAutoFix(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                mapListParam(request, "findings"));
    }

    private Map<String, Object> saveSecurityInsightNotificationConfig(OperationsActionGateRequest request) {
        return adminSummaryCommandService.saveSecurityInsightNotificationConfig(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> runSecurityInsightRollback(OperationsActionGateRequest request) {
        return adminSummaryCommandService.runSecurityInsightRollback(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private Map<String, Object> dispatchSecurityInsightNotifications(OperationsActionGateRequest request) {
        return adminSummaryCommandService.dispatchSecurityInsightNotifications(
                stringParam(request, "actorId"),
                boolParam(request, "isEn"),
                nestedParam(request, "payload"));
    }

    private CodexProvisionResponse executeCodexProvision(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.executeProvision(nestedParam(request, "payload"), toCodexActorContext(request));
    }

    private CodexExecutionHistoryResponse listCodexHistory(OperationsActionGateRequest request) throws Exception {
        int limit = intParam(request, "limit") == null ? 30 : intParam(request, "limit");
        return codexAdminOperationsGateAdapter.getRecentHistory(limit);
    }

    private CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspectCodexHistory(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.inspectHistory(stringParam(request, "logId"));
    }

    private CodexProvisionResponse remediateCodexHistory(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.remediateHistory(stringParam(request, "logId"), toCodexActorContext(request));
    }

    private Map<String, Object> listCodexTickets(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.getTicketsPage(stringParam(request, "pageId"));
    }

    private Map<String, Object> getCodexTicketDetail(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.getTicketDetail(stringParam(request, "ticketId"));
    }

    private Map<String, Object> getCodexTicketArtifact(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.getTicketArtifact(stringParam(request, "ticketId"), stringParam(request, "artifactType"));
    }

    private Map<String, Object> prepareCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.prepareTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> planCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.planTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> executeCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.executeTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    private Map<String, Object> directExecuteCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.directExecuteTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    private Map<String, Object> queueDirectExecuteCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.queueDirectExecuteTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> skipPlanExecuteCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.skipPlanExecuteTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    private Map<String, Object> rollbackCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.rollbackTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> reissueCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.reissueTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> deleteCodexTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.deleteTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> getSrWorkbenchPage(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.getTicketsPage(stringParam(request, "pageId"));
    }

    private Map<String, Object> createSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.createTicket(nestedParam(request, "request"), stringParam(request, "actorId"));
    }

    private Map<String, Object> quickExecuteSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.quickExecuteTicket(nestedParam(request, "request"), stringParam(request, "actorId"));
    }

    private Map<String, Object> addSrWorkbenchStackItem(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.addStackItem(nestedParam(request, "request"), stringParam(request, "actorId"));
    }

    private Map<String, Object> removeSrWorkbenchStackItem(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.removeStackItem(stringParam(request, "stackItemId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> clearSrWorkbenchStack(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.clearStack(stringParam(request, "actorId"));
    }

    private Map<String, Object> updateSrWorkbenchApproval(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.updateApproval(
                stringParam(request, "ticketId"),
                nestedParam(request, "request"),
                stringParam(request, "actorId"));
    }

    private Map<String, Object> prepareSrWorkbenchExecution(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.prepareTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> planSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.planTicket(stringParam(request, "ticketId"), stringParam(request, "actorId"));
    }

    private Map<String, Object> executeSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.executeTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    private Map<String, Object> directExecuteSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.directExecuteTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    private Map<String, Object> skipPlanExecuteSrWorkbenchTicket(OperationsActionGateRequest request) throws Exception {
        return codexAdminOperationsGateAdapter.skipPlanExecuteTicket(
                stringParam(request, "ticketId"),
                stringParam(request, "actorId"),
                stringParam(request, "approvalToken"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> nestedParam(OperationsActionGateRequest request, String key) {
        Object value = request.parameters().get(key);
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        if (value == null) {
            return Map.of();
        }
        return objectMapper.convertValue(value, Map.class);
    }

    private String stringParam(OperationsActionGateRequest request, String key) {
        Object value = request.parameters().get(key);
        return value == null ? "" : safe(String.valueOf(value));
    }

    private Long longParam(OperationsActionGateRequest request, String key) {
        String value = stringParam(request, key);
        return value.isEmpty() ? null : Long.valueOf(value);
    }

    private Integer intParam(OperationsActionGateRequest request, String key) {
        String value = stringParam(request, key);
        return value.isEmpty() ? null : Integer.valueOf(value);
    }

    private boolean boolParam(OperationsActionGateRequest request, String key) {
        Object value = request.parameters().get(key);
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(stringParam(request, key));
    }

    private List<String> stringListParam(OperationsActionGateRequest request, String key) {
        Object value = request.parameters().get(key);
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<String> result = new java.util.ArrayList<>();
        for (Object item : list) {
            if (item != null) {
                result.add(safe(String.valueOf(item)));
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapListParam(OperationsActionGateRequest request, String key) {
        Object value = request.parameters().get(key);
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                result.add((Map<String, Object>) map);
            }
        }
        return result;
    }

    private CodexAdminActorContext toCodexActorContext(OperationsActionGateRequest request) {
        CodexAdminActorContext context = new CodexAdminActorContext();
        context.setActorUserId(stringParam(request, "actorId"));
        context.setActorAuthorCode(stringParam(request, "actorAuthorCode"));
        context.setActorInsttId(stringParam(request, "actorInsttId"));
        context.setMaster(boolParam(request, "actorMaster"));
        return context;
    }

    private <T> T convert(Map<String, Object> source, Class<T> type) {
        return objectMapper.convertValue(source == null ? Map.of() : source, type);
    }

    private String safeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.debug("Failed to serialize audit payload.", e);
            return "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}

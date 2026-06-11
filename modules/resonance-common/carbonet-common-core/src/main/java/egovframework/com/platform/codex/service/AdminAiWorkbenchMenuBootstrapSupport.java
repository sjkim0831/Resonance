package egovframework.com.platform.codex.service;

import egovframework.com.platform.codex.mapper.AuthGroupManageMapper;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminAiWorkbenchMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A190";
    private static final String DOMAIN_NAME = "AI 운영";
    private static final String DOMAIN_NAME_EN = "AI Operations";
    private static final String GROUP_CODE = "A19001";
    private static final String GROUP_NAME = "AI 작업센터";
    private static final String GROUP_NAME_EN = "AI Workbench";
    private static final String HELP_MENU_CODE = "A1900101";
    private static final String SR_MENU_CODE = "A1900102";
    private static final String CODEX_MENU_CODE = "A1900103";
    private static final String WBS_MENU_CODE = "A1900104";
    private static final String NEW_PAGE_MENU_CODE = "A1900106";
    private static final String HERMES_WORKFLOW_MENU_CODE = "A1900107";
    private static final String SYSTEM_AUDIT_LOG_MENU_CODE = "A0060303";
    private static final String AI_MANAGEMENT_GROUP_CODE = "A19020";
    private static final String AI_MANAGEMENT_GROUP_NAME = "AI 관리";
    private static final String AI_MANAGEMENT_GROUP_NAME_EN = "AI Management";
    private static final String AI_DASHBOARD_MENU_CODE = "A1902001";
    private static final String AI_MODELS_MENU_CODE = "A1902002";
    private static final String AI_TRAINING_MENU_CODE = "A1902003";
    private static final String AI_RAG_MENU_CODE = "A1902004";
    private static final String AI_AGENTS_MENU_CODE = "A1902005";
    private static final String AI_LOGS_MENU_CODE = "A1902006";
    private static final String AI_QUALITY_MENU_CODE = "A1902007";
    private static final String AI_OBSERVABILITY_MENU_CODE = "A1902008";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";
    private static final List<String> STANDARD_ADMIN_ROLES = Arrays.asList(
            "ROLE_SYSTEM_MASTER",
            "ROLE_SYSTEM_ADMIN",
            "ROLE_ADMIN",
            "ROLE_OPERATION_ADMIN"
    );

    private final PlatformMenuProvisionSupport platformMenuProvisionSupport;
    private final AuthGroupManageMapper authGroupManageMapper;
    private final AdminCodeManageService adminCodeManageService;
    private final MenuFeatureManageService menuFeatureManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureAdminAiWorkbenchMenus() {
        provision("help-management", buildHelpManagementRequest());
        provision("sr-workbench", buildSrWorkbenchRequest());
        provision("codex-request", buildCodexRequest());
        provision("wbs-management", buildWbsManagementRequest());
        provision("new-page", buildNewPageRequest());
        provision("hermes-workflow", buildHermesWorkflowRequest());
        provision("ai-dashboard", buildAiDashboardRequest());
        provision("ai-models", buildAiModelsRequest());
        provision("ai-training", buildAiTrainingRequest());
        provision("ai-rag", buildAiRagRequest());
        provision("ai-agents", buildAiAgentsRequest());
        provision("ai-logs", buildAiLogsRequest());
        provision("ai-quality", buildAiQualityRequest());
        provision("ai-observability", buildAiObservabilityRequest());
        cleanupLegacyMenus();
    }

    private void provision(String registrationId, CodexProvisionRequest request) {
        String menuCode = request.getPage() == null ? "" : normalize(request.getPage().getCode());
        String menuNameKo = request.getPage() == null ? "" : safe(request.getPage().getCodeNm());
        String menuNameEn = request.getPage() == null ? "" : safe(request.getPage().getCodeDc());
        String menuUrl = request.getPage() == null ? "" : safe(request.getPage().getMenuUrl());
        String menuIcon = request.getPage() == null ? "" : safe(request.getPage().getMenuIcon());
        platformMenuProvisionSupport.provisionAdminMenu(
                "Admin AI workbench menu " + registrationId,
                request,
                menuCode,
                menuNameKo,
                menuNameEn,
                menuUrl,
                menuIcon,
                ACTOR_ID,
                ignored -> reconcileStandardRoleAssignments(registrationId));
    }

    private CodexProvisionRequest buildHelpManagementRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-HELP-MANAGEMENT",
                ACTOR_ID,
                "/admin/system/help-management",
                pageRequest(HELP_MENU_CODE, "화면 도움말 운영", "Help Management", "/admin/system/help-management", "help_center"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(HELP_MENU_CODE, HELP_MENU_CODE + "_VIEW", "화면 도움말 조회", "View Help Management", "Help management page access"),
                        featureRequest(HELP_MENU_CODE, HELP_MENU_CODE + "_EDIT", "화면 도움말 저장", "Edit Help Management", "Help management save permission")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", HELP_MENU_CODE + "_VIEW", HELP_MENU_CODE + "_EDIT"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", HELP_MENU_CODE + "_VIEW", HELP_MENU_CODE + "_EDIT"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", HELP_MENU_CODE + "_VIEW", HELP_MENU_CODE + "_EDIT")
                }
        );
    }

    private CodexProvisionRequest buildSrWorkbenchRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-SR-WORKBENCH",
                ACTOR_ID,
                "/admin/system/sr-workbench",
                pageRequest(SR_MENU_CODE, "SR 워크벤치", "SR Workbench", "/admin/system/sr-workbench", "integration_instructions"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(SR_MENU_CODE, SR_MENU_CODE + "_VIEW", "SR 워크벤치 조회", "View SR Workbench", "SR workbench page access"),
                        featureRequest(SR_MENU_CODE, SR_MENU_CODE + "_CREATE", "SR 티켓 발행", "Create SR Ticket", "SR ticket creation"),
                        featureRequest(SR_MENU_CODE, SR_MENU_CODE + "_APPROVE", "SR 승인 처리", "Approve SR Ticket", "SR approval"),
                        featureRequest(SR_MENU_CODE, SR_MENU_CODE + "_PREPARE", "SR 실행 준비", "Prepare SR Execution", "SR execution preparation"),
                        featureRequest(SR_MENU_CODE, SR_MENU_CODE + "_EXECUTE", "SR Codex 실행", "Execute SR Codex", "SR Codex execution")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                                SR_MENU_CODE + "_VIEW", SR_MENU_CODE + "_CREATE", SR_MENU_CODE + "_APPROVE", SR_MENU_CODE + "_PREPARE", SR_MENU_CODE + "_EXECUTE"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                                SR_MENU_CODE + "_VIEW", SR_MENU_CODE + "_CREATE", SR_MENU_CODE + "_APPROVE", SR_MENU_CODE + "_PREPARE", SR_MENU_CODE + "_EXECUTE"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                                SR_MENU_CODE + "_VIEW", SR_MENU_CODE + "_CREATE")
                }
        );
    }

    private CodexProvisionRequest buildCodexRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-CODEX-REQUEST",
                ACTOR_ID,
                "/admin/system/codex-request",
                pageRequest(CODEX_MENU_CODE, "Codex 요청", "Codex Request", "/admin/system/codex-request", "smart_toy"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(CODEX_MENU_CODE, CODEX_MENU_CODE + "_VIEW", "Codex 요청 조회", "View Codex Request", "Codex request page access"),
                        featureRequest(CODEX_MENU_CODE, CODEX_MENU_CODE + "_EXECUTE", "Codex 요청 실행", "Execute Codex Request", "Codex request execution permission")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", CODEX_MENU_CODE + "_VIEW", CODEX_MENU_CODE + "_EXECUTE"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", CODEX_MENU_CODE + "_VIEW", CODEX_MENU_CODE + "_EXECUTE"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", CODEX_MENU_CODE + "_VIEW", CODEX_MENU_CODE + "_EXECUTE")
                }
        );
    }

    private CodexProvisionRequest buildWbsManagementRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-WBS-MANAGEMENT-AI",
                ACTOR_ID,
                "/admin/system/wbs-management",
                pageRequest(WBS_MENU_CODE, "WBS 관리", "WBS Management", "/admin/system/wbs-management", "calendar_month"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(WBS_MENU_CODE, WBS_MENU_CODE + "_VIEW", "WBS 관리 조회", "View WBS Management", "WBS management page access"),
                        featureRequest(WBS_MENU_CODE, WBS_MENU_CODE + "_EDIT", "WBS 관리 편집", "Edit WBS Management", "WBS schedule save permission")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", WBS_MENU_CODE + "_VIEW", WBS_MENU_CODE + "_EDIT"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", WBS_MENU_CODE + "_VIEW", WBS_MENU_CODE + "_EDIT"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", WBS_MENU_CODE + "_VIEW", WBS_MENU_CODE + "_EDIT")
                }
        );
    }

    private CodexProvisionRequest buildNewPageRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-NEW-PAGE",
                ACTOR_ID,
                "/admin/system/new-page",
                pageRequest(NEW_PAGE_MENU_CODE, "새 페이지", "New Page", "/admin/system/new-page", "note_stack"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(NEW_PAGE_MENU_CODE, NEW_PAGE_MENU_CODE + "_VIEW", "새 페이지 조회", "View New Page", "New page scaffold access")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", NEW_PAGE_MENU_CODE + "_VIEW"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", NEW_PAGE_MENU_CODE + "_VIEW"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", NEW_PAGE_MENU_CODE + "_VIEW")
                }
        );
    }

    private CodexProvisionRequest buildHermesWorkflowRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-HERMES-WORKFLOW",
                ACTOR_ID,
                "/admin/system/hermes-workflow",
                pageRequest(HERMES_WORKFLOW_MENU_CODE, "Hermes 작업 기억", "Hermes Workflow Memory", "/admin/system/hermes-workflow", "psychology"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(HERMES_WORKFLOW_MENU_CODE, HERMES_WORKFLOW_MENU_CODE + "_VIEW", "Hermes 작업 기억 조회", "View Hermes Workflow Memory", "Hermes workflow memory page access")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", HERMES_WORKFLOW_MENU_CODE + "_VIEW"),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", HERMES_WORKFLOW_MENU_CODE + "_VIEW"),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", HERMES_WORKFLOW_MENU_CODE + "_VIEW")
                }
        );
    }

    private CodexProvisionRequest buildAiDashboardRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-DASHBOARD",
                "/admin/ai/dashboard",
                aiPageRequest(AI_DASHBOARD_MENU_CODE, "AI 대시보드", "AI Dashboard", "/admin/ai/dashboard", "dashboard"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_DASHBOARD_MENU_CODE, AI_DASHBOARD_MENU_CODE + "_VIEW", "AI 대시보드 조회", "View AI Dashboard", "AI dashboard page access")
                }
        );
    }

    private CodexProvisionRequest buildAiModelsRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-MODELS",
                "/admin/ai/models",
                aiPageRequest(AI_MODELS_MENU_CODE, "모델 관리", "Model Management", "/admin/ai/models", "智能模型"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_MODELS_MENU_CODE, AI_MODELS_MENU_CODE + "_VIEW", "모델 관리 조회", "View Model Management", "Model management page access"),
                        featureRequest(AI_MODELS_MENU_CODE, AI_MODELS_MENU_CODE + "_CREATE", "모델 등록", "Create Model", "Model registration"),
                        featureRequest(AI_MODELS_MENU_CODE, AI_MODELS_MENU_CODE + "_EDIT", "모델 편집", "Edit Model", "Model editing")
                }
        );
    }

    private CodexProvisionRequest buildAiTrainingRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-TRAINING",
                "/admin/ai/training",
                aiPageRequest(AI_TRAINING_MENU_CODE, "학습 관리", "AI Training", "/admin/ai/training", "school"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_TRAINING_MENU_CODE, AI_TRAINING_MENU_CODE + "_VIEW", "학습 관리 조회", "View AI Training", "Training page access"),
                        featureRequest(AI_TRAINING_MENU_CODE, AI_TRAINING_MENU_CODE + "_CREATE", "학습 작업 생성", "Create Training Job", "Training job creation"),
                        featureRequest(AI_TRAINING_MENU_CODE, AI_TRAINING_MENU_CODE + "_EXECUTE", "학습 실행", "Execute Training", "Training execution")
                }
        );
    }

    private CodexProvisionRequest buildAiRagRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-RAG",
                "/admin/ai/rag",
                aiPageRequest(AI_RAG_MENU_CODE, "RAG 관리", "RAG Management", "/admin/ai/rag", " armazenamento"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_RAG_MENU_CODE, AI_RAG_MENU_CODE + "_VIEW", "RAG 관리 조회", "View RAG Management", "RAG management page access"),
                        featureRequest(AI_RAG_MENU_CODE, AI_RAG_MENU_CODE + "_CREATE", "문서 업로드", "Upload Document", "Document upload"),
                        featureRequest(AI_RAG_MENU_CODE, AI_RAG_MENU_CODE + "_EDIT", "RAG 편집", "Edit RAG", "RAG editing")
                }
        );
    }

    private CodexProvisionRequest buildAiAgentsRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-AGENTS",
                "/admin/ai/agents",
                aiPageRequest(AI_AGENTS_MENU_CODE, "에이전트 관리", "Agent Management", "/admin/ai/agents", "psychology"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_AGENTS_MENU_CODE, AI_AGENTS_MENU_CODE + "_VIEW", "에이전트 관리 조회", "View Agent Management", "Agent management page access"),
                        featureRequest(AI_AGENTS_MENU_CODE, AI_AGENTS_MENU_CODE + "_CREATE", "에이전트 등록", "Create Agent", "Agent creation"),
                        featureRequest(AI_AGENTS_MENU_CODE, AI_AGENTS_MENU_CODE + "_EDIT", "에이전트 편집", "Edit Agent", "Agent editing")
                }
        );
    }

    private CodexProvisionRequest buildAiLogsRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-LOGS",
                "/admin/ai/logs",
                aiPageRequest(AI_LOGS_MENU_CODE, "로그 관리", "Log Management", "/admin/ai/logs", "receipt_long"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_LOGS_MENU_CODE, AI_LOGS_MENU_CODE + "_VIEW", "로그 관리 조회", "View Log Management", "Log management page access"),
                        featureRequest(AI_LOGS_MENU_CODE, AI_LOGS_MENU_CODE + "_EXPORT", "로그 내보내기", "Export Logs", "Log export")
                }
        );
    }

    private CodexProvisionRequest buildAiQualityRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-QUALITY",
                "/admin/ai/quality",
                aiPageRequest(AI_QUALITY_MENU_CODE, "품질 관리", "Quality Management", "/admin/ai/quality", "verified"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_QUALITY_MENU_CODE, AI_QUALITY_MENU_CODE + "_VIEW", "품질 관리 조회", "View Quality Management", "Quality management page access"),
                        featureRequest(AI_QUALITY_MENU_CODE, AI_QUALITY_MENU_CODE + "_EVALUATE", "응답 평가", "Evaluate Response", "Response evaluation")
                }
        );
    }

    private CodexProvisionRequest buildAiObservabilityRequest() {
        return aiManagementMenuRequest(
                "BOOTSTRAP-AI-OBSERVABILITY",
                "/admin/ai/observability",
                aiPageRequest(AI_OBSERVABILITY_MENU_CODE, "AI 관측", "AI Observability", "/admin/ai/observability", "visibility"),
                new CodexProvisionRequest.FeatureRequest[]{
                        featureRequest(AI_OBSERVABILITY_MENU_CODE, AI_OBSERVABILITY_MENU_CODE + "_VIEW", "AI 관측 조회", "View AI Observability", "Observability page access"),
                        featureRequest(AI_OBSERVABILITY_MENU_CODE, AI_OBSERVABILITY_MENU_CODE + "_TRACE", "추적 분석", "Trace Analysis", "Trace analysis")
                }
        );
    }

    private CodexProvisionRequest aiManagementMenuRequest(String registrationId, String menuUrl,
            CodexProvisionRequest.PageRequest pageRequest, CodexProvisionRequest.FeatureRequest[] features) {
        String[] featureCodes = new String[features.length];
        for (int i = 0; i < features.length; i++) {
            featureCodes[i] = features[i].getFeatureCode();
        }
        return PlatformMenuProvisionSupport.adminMenuRequest(
                registrationId,
                ACTOR_ID,
                menuUrl,
                pageRequest,
                features,
                new CodexProvisionRequest.AuthorRequest[]{
                        authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", featureCodes),
                        authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", featureCodes),
                        authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", featureCodes)
                }
        );
    }

    private CodexProvisionRequest.PageRequest aiPageRequest(String menuCode, String nameKo, String nameEn,
            String menuUrl, String menuIcon) {
        return PlatformMenuProvisionSupport.pageRequest(
                DOMAIN_CODE,
                DOMAIN_NAME,
                DOMAIN_NAME_EN,
                AI_MANAGEMENT_GROUP_CODE,
                AI_MANAGEMENT_GROUP_NAME,
                AI_MANAGEMENT_GROUP_NAME_EN,
                menuCode,
                nameKo,
                nameEn,
                menuUrl,
                menuIcon
        );
    }

    private void reconcileStandardRoleAssignments(String registrationId) {
        Map<String, Set<String>> desiredByRole = buildDesiredFeatureCodesByRole();
        Set<String> targetFeatureCodes = new LinkedHashSet<>();
        for (Set<String> featureCodes : desiredByRole.values()) {
            targetFeatureCodes.addAll(featureCodes);
        }

        int inserted = 0;
        int deleted = 0;
        for (String authorCode : STANDARD_ADMIN_ROLES) {
            Set<String> desired = desiredByRole.getOrDefault(normalize(authorCode), Collections.emptySet());
            for (String featureCode : targetFeatureCodes) {
                boolean exists = authGroupManageMapper.countAuthorFeaturePermission(authorCode, featureCode) > 0;
                boolean shouldExist = desired.contains(featureCode);
                if (shouldExist && !exists) {
                    Map<String, String> params = new LinkedHashMap<>();
                    params.put("authorCode", authorCode);
                    params.put("featureCode", featureCode);
                    authGroupManageMapper.insertAuthorFeatureRelation(params);
                    inserted++;
                } else if (!shouldExist && exists) {
                    authGroupManageMapper.deleteAuthorFeatureRelation(authorCode, featureCode);
                    deleted++;
                }
            }
        }

        log.info("Admin AI workbench role assignments reconciled. registrationId={}, inserted={}, deleted={}, targetFeatures={}",
                registrationId, inserted, deleted, targetFeatureCodes.size());
    }

    private Map<String, Set<String>> buildDesiredFeatureCodesByRole() {
        Map<String, Set<String>> desired = new LinkedHashMap<>();
        desired.put("ROLE_SYSTEM_MASTER", linkedSet(
                HELP_MENU_CODE + "_VIEW",
                HELP_MENU_CODE + "_EDIT",
                SR_MENU_CODE + "_VIEW",
                SR_MENU_CODE + "_CREATE",
                SR_MENU_CODE + "_APPROVE",
                SR_MENU_CODE + "_PREPARE",
                SR_MENU_CODE + "_EXECUTE",
                CODEX_MENU_CODE + "_VIEW",
                CODEX_MENU_CODE + "_EXECUTE",
                WBS_MENU_CODE + "_VIEW",
                WBS_MENU_CODE + "_EDIT",
                NEW_PAGE_MENU_CODE + "_VIEW",
                HERMES_WORKFLOW_MENU_CODE + "_VIEW",
                SYSTEM_AUDIT_LOG_MENU_CODE + "_VIEW",
                AI_DASHBOARD_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_CREATE",
                AI_MODELS_MENU_CODE + "_EDIT",
                AI_TRAINING_MENU_CODE + "_VIEW",
                AI_TRAINING_MENU_CODE + "_CREATE",
                AI_TRAINING_MENU_CODE + "_EXECUTE",
                AI_RAG_MENU_CODE + "_VIEW",
                AI_RAG_MENU_CODE + "_CREATE",
                AI_RAG_MENU_CODE + "_EDIT",
                AI_AGENTS_MENU_CODE + "_VIEW",
                AI_AGENTS_MENU_CODE + "_CREATE",
                AI_AGENTS_MENU_CODE + "_EDIT",
                AI_LOGS_MENU_CODE + "_VIEW",
                AI_LOGS_MENU_CODE + "_EXPORT",
                AI_QUALITY_MENU_CODE + "_VIEW",
                AI_QUALITY_MENU_CODE + "_EVALUATE",
                AI_OBSERVABILITY_MENU_CODE + "_VIEW",
                AI_OBSERVABILITY_MENU_CODE + "_TRACE"
        ));
        desired.put("ROLE_SYSTEM_ADMIN", linkedSet(
                HELP_MENU_CODE + "_VIEW",
                HELP_MENU_CODE + "_EDIT",
                SR_MENU_CODE + "_VIEW",
                SR_MENU_CODE + "_CREATE",
                SR_MENU_CODE + "_APPROVE",
                SR_MENU_CODE + "_PREPARE",
                SR_MENU_CODE + "_EXECUTE",
                CODEX_MENU_CODE + "_VIEW",
                CODEX_MENU_CODE + "_EXECUTE",
                WBS_MENU_CODE + "_VIEW",
                WBS_MENU_CODE + "_EDIT",
                NEW_PAGE_MENU_CODE + "_VIEW",
                HERMES_WORKFLOW_MENU_CODE + "_VIEW",
                SYSTEM_AUDIT_LOG_MENU_CODE + "_VIEW",
                AI_DASHBOARD_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_CREATE",
                AI_MODELS_MENU_CODE + "_EDIT",
                AI_TRAINING_MENU_CODE + "_VIEW",
                AI_TRAINING_MENU_CODE + "_CREATE",
                AI_TRAINING_MENU_CODE + "_EXECUTE",
                AI_RAG_MENU_CODE + "_VIEW",
                AI_RAG_MENU_CODE + "_CREATE",
                AI_RAG_MENU_CODE + "_EDIT",
                AI_AGENTS_MENU_CODE + "_VIEW",
                AI_AGENTS_MENU_CODE + "_CREATE",
                AI_AGENTS_MENU_CODE + "_EDIT",
                AI_LOGS_MENU_CODE + "_VIEW",
                AI_LOGS_MENU_CODE + "_EXPORT",
                AI_QUALITY_MENU_CODE + "_VIEW",
                AI_QUALITY_MENU_CODE + "_EVALUATE",
                AI_OBSERVABILITY_MENU_CODE + "_VIEW",
                AI_OBSERVABILITY_MENU_CODE + "_TRACE"
        ));
        desired.put("ROLE_ADMIN", linkedSet(
                HELP_MENU_CODE + "_VIEW",
                HELP_MENU_CODE + "_EDIT",
                SR_MENU_CODE + "_VIEW",
                SR_MENU_CODE + "_CREATE",
                CODEX_MENU_CODE + "_VIEW",
                CODEX_MENU_CODE + "_EXECUTE",
                WBS_MENU_CODE + "_VIEW",
                WBS_MENU_CODE + "_EDIT",
                NEW_PAGE_MENU_CODE + "_VIEW",
                HERMES_WORKFLOW_MENU_CODE + "_VIEW",
                SYSTEM_AUDIT_LOG_MENU_CODE + "_VIEW",
                AI_DASHBOARD_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_VIEW",
                AI_MODELS_MENU_CODE + "_CREATE",
                AI_TRAINING_MENU_CODE + "_VIEW",
                AI_RAG_MENU_CODE + "_VIEW",
                AI_RAG_MENU_CODE + "_CREATE",
                AI_AGENTS_MENU_CODE + "_VIEW",
                AI_AGENTS_MENU_CODE + "_CREATE",
                AI_LOGS_MENU_CODE + "_VIEW",
                AI_QUALITY_MENU_CODE + "_VIEW",
                AI_OBSERVABILITY_MENU_CODE + "_VIEW"
        ));
        desired.put("ROLE_OPERATION_ADMIN", Collections.emptySet());
        return desired;
    }

    private void cleanupLegacyMenus() {
        cleanupLegacyMenu("A006", "A0060119", "A0060119_VIEW", "A0060119_EDIT");
        cleanupLegacyMenu("A101", "A1010201", "A1010201_VIEW");
    }

    private void cleanupLegacyMenu(String codeId, String menuCode, String... featureCodes) {
        try {
            for (String featureCode : featureCodes) {
                authGroupManageMapper.deleteAuthorFeatureRelationsByFeatureCode(featureCode);
                menuFeatureManageService.deleteMenuFeature(featureCode);
            }
            adminCodeManageService.deletePageManagement(codeId, menuCode);
            log.info("Legacy AI/system menu cleaned up. codeId={}, menuCode={}, featureCount={}", codeId, menuCode, featureCodes == null ? 0 : featureCodes.length);
        } catch (Exception e) {
            log.warn("Failed to clean up legacy AI/system menu. codeId={}, menuCode={}", codeId, menuCode, e);
        }
    }

    private Set<String> linkedSet(String... values) {
        Set<String> items = new LinkedHashSet<>();
        if (values == null) {
            return items;
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                items.add(normalized);
            }
        }
        return items;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private CodexProvisionRequest.PageRequest pageRequest(String menuCode, String nameKo, String nameEn,
                                                          String menuUrl, String menuIcon) {
        return PlatformMenuProvisionSupport.pageRequest(
                DOMAIN_CODE,
                DOMAIN_NAME,
                DOMAIN_NAME_EN,
                GROUP_CODE,
                GROUP_NAME,
                GROUP_NAME_EN,
                menuCode,
                nameKo,
                nameEn,
                menuUrl,
                menuIcon
        );
    }

    private CodexProvisionRequest.FeatureRequest featureRequest(String menuCode, String featureCode, String nameKo,
                                                                String nameEn, String description) {
        return PlatformMenuProvisionSupport.featureRequest(menuCode, featureCode, nameKo, nameEn, description);
    }

    private CodexProvisionRequest.AuthorRequest authorRequest(String authorCode, String authorNm, String authorDc,
                                                              String... featureCodes) {
        return PlatformMenuProvisionSupport.authorRequest(authorCode, authorNm, authorDc, featureCodes);
    }
}

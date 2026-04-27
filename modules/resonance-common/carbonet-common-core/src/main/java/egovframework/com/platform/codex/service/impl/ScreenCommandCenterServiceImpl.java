package egovframework.com.platform.codex.service.impl;

import egovframework.com.common.trace.UiManifestRegistryPort;
import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.platform.codex.service.ScreenCommandCenterService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service("screenCommandCenterService")
public class ScreenCommandCenterServiceImpl implements ScreenCommandCenterService {

    private final AuthGroupManageService authGroupManageService;
    private final MenuInfoService menuInfoService;
    private final UiManifestRegistryPort uiManifestRegistryPort;

    public ScreenCommandCenterServiceImpl(AuthGroupManageService authGroupManageService,
                                          MenuInfoService menuInfoService,
                                          UiManifestRegistryPort uiManifestRegistryPort) {
        this.authGroupManageService = authGroupManageService;
        this.menuInfoService = menuInfoService;
        this.uiManifestRegistryPort = uiManifestRegistryPort;
    }

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        String normalizedPageId = canonicalPageId(normalize(pageId));
        if (normalizedPageId.isEmpty()) {
            normalizedPageId = "member-list";
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("selectedPageId", normalizedPageId);
        response.put("pages", buildPageOptions());

        Map<String, Object> page = buildPage(normalizedPageId);
        decoratePageMetadata(normalizedPageId, page);
        String routePath = stringValue(page.get("routePath"));
        String menuLookupUrl = resolveMenuLookupUrl(normalizedPageId, routePath);
        String menuCode = firstNonBlank(
                safeSelectMenuCode(menuLookupUrl),
                safeSelectMenuCode(routePath),
                stringValue(page.get("menuCode"))
        );

        page.put("menuLookupUrl", menuLookupUrl);
        page.put("menuCode", menuCode);
        page.put("menuPermission", buildMenuPermission(menuCode, menuLookupUrl, routePath));
        page.put("manifestRegistry", uiManifestRegistryPort.syncPageRegistry(page));
        page.put("summaryMetrics", buildSummaryMetrics(page));
        response.put("page", page);
        return response;
    }

    private Map<String, Object> buildSummaryMetrics(Map<String, Object> page) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        Map<String, Object> menuPermission = mapValue(page.get("menuPermission"));
        Map<String, Object> manifestRegistry = mapValue(page.get("manifestRegistry"));
        metrics.put("surfaceCount", listSize(page.get("surfaces")));
        metrics.put("eventCount", listSize(page.get("events")));
        metrics.put("apiCount", listSize(page.get("apis")));
        metrics.put("schemaCount", listSize(page.get("schemas")));
        metrics.put("changeTargetCount", listSize(page.get("changeTargets")));
        metrics.put("featureCount", listSize(menuPermission.get("featureRows")));
        metrics.put("relationTableCount", listSize(menuPermission.get("relationTables")));
        metrics.put("componentCount", intValue(manifestRegistry.get("componentCount")));
        return metrics;
    }

    private List<Map<String, Object>> buildPageOptions() {
        List<Map<String, Object>> pages = new ArrayList<>();
        Set<String> knownPageIds = new LinkedHashSet<>();
        addStaticPageOption(pages, knownPageIds, "home", "홈", "/home", "HMENU_HOME", "home");
        addStaticPageOption(pages, knownPageIds, "admin-home", "관리자 홈", "/admin/", "AMENU_ADMIN_HOME", "admin");
        addStaticPageOption(pages, knownPageIds, "admin-login", "관리자 로그인", "/admin/login/loginView", "AMENU_ADMIN_LOGIN", "admin");
        addStaticPageOption(pages, knownPageIds, "signin-login", "로그인", "/signin/loginView", "HMENU_SIGNIN_LOGIN", "home");
        addStaticPageOption(pages, knownPageIds, "signin-auth-choice", "인증 수단 선택", "/signin/authChoice", "HMENU_SIGNIN_AUTH_CHOICE", "home");
        addStaticPageOption(pages, knownPageIds, "signin-find-id", "아이디 찾기", "/signin/findId", "HMENU_SIGNIN_FIND_ID", "home");
        addStaticPageOption(pages, knownPageIds, "signin-find-id-result", "아이디 찾기 결과", "/signin/findId/result", "HMENU_SIGNIN_FIND_ID_RESULT", "home");
        addStaticPageOption(pages, knownPageIds, "signin-find-password", "비밀번호 찾기", "/signin/findPassword", "HMENU_SIGNIN_FIND_PASSWORD", "home");
        addStaticPageOption(pages, knownPageIds, "signin-find-password-result", "비밀번호 찾기 완료", "/signin/findPassword/result", "HMENU_SIGNIN_FINDPW_RESULT", "home");
        addStaticPageOption(pages, knownPageIds, "signin-forbidden", "접근 거부", "/signin/loginForbidden", "HMENU_SIGNIN_FORBIDDEN", "home");
        addStaticPageOption(pages, knownPageIds, "mypage", "마이페이지", "/mypage", "HMENU_MYPAGE", "home");
        addStaticPageOption(pages, knownPageIds, "infra", "인프라", "/admin/system/infra", "ADMIN_SYSTEM_INFRA", "admin");
        addStaticPageOption(pages, knownPageIds, "performance", "성능", "/admin/system/performance", "ADMIN_SYSTEM_PERFORMANCE", "admin");
        addStaticPageOption(pages, knownPageIds, "notification", "알림센터", "/admin/system/notification", "ADMIN_SYSTEM_NOTIFICATION", "admin");
        addStaticPageOption(pages, knownPageIds, "monitoring-center", "운영센터", "/admin/monitoring/center", "ADMIN_MONITORING_CENTER", "admin");
        addStaticPageOption(pages, knownPageIds, "platform-studio", "플랫폼 스튜디오", "/admin/system/platform-studio", "A0060109", "admin");
        addStaticPageOption(pages, knownPageIds, "screen-elements-management", "화면 요소 관리", "/admin/system/screen-elements-management", "A0060110", "admin");
        addStaticPageOption(pages, knownPageIds, "screen-flow-management", "화면 흐름 관리", "/admin/system/screen-flow-management", "A1900109", "admin");
        addStaticPageOption(pages, knownPageIds, "screen-menu-assignment-management", "화면-메뉴 귀속 관리", "/admin/system/screen-menu-assignment-management", "A1900110", "admin");
        addStaticPageOption(pages, knownPageIds, "event-management-console", "이벤트 관리", "/admin/system/event-management-console", "A0060111", "admin");
        addStaticPageOption(pages, knownPageIds, "function-management-console", "함수 콘솔", "/admin/system/function-management-console", "A0060112", "admin");
        addStaticPageOption(pages, knownPageIds, "api-management-console", "API 관리", "/admin/system/api-management-console", "A0060113", "admin");
        addStaticPageOption(pages, knownPageIds, "controller-management-console", "컨트롤러 관리", "/admin/system/controller-management-console", "A0060114", "admin");
        addStaticPageOption(pages, knownPageIds, "db-table-management", "DB 테이블 관리", "/admin/system/db-table-management", "A0060115", "admin");
        addStaticPageOption(pages, knownPageIds, "column-management-console", "컬럼 관리", "/admin/system/column-management-console", "A0060116", "admin");
        addStaticPageOption(pages, knownPageIds, "automation-studio", "자동화 스튜디오", "/admin/system/automation-studio", "A0060117", "admin");
        addStaticPageOption(pages, knownPageIds, "backup-config", "백업 설정", "/admin/system/backup_config", "A0060401", "admin");
        addStaticPageOption(pages, knownPageIds, "backup-execution", "백업 실행", "/admin/system/backup", "A0060402", "admin");
        addStaticPageOption(pages, knownPageIds, "restore-execution", "복구 실행", "/admin/system/backup", "A0060403", "admin");
        addStaticPageOption(pages, knownPageIds, "package-governance", "패키지 거버넌스", "/admin/system/package-governance", "A00605", "admin");

        addStaticPageOption(pages, knownPageIds, "version-management", "버전 관리", "/admin/system/version", "A0060404", "admin");
        addStaticPageOption(pages, knownPageIds, "db-promotion-policy", "DB 반영 정책 카탈로그", "/admin/system/db-promotion-policy", "A0060405", "admin");
        addStaticPageOption(pages, knownPageIds, "db-sync-deploy", "DB 동기화 배포", "/admin/system/db-sync-deploy", "A0060406", "admin");
        addStaticPageOption(pages, knownPageIds, "external-connection-add", "외부연계 등록", "/admin/external/connection_add", "A0050102", "admin");
        addStaticPageOption(pages, knownPageIds, "external-keys", "외부 인증키 관리", "/admin/external/keys", "A0050103", "admin");
        addStaticPageOption(pages, knownPageIds, "external-schema", "외부 스키마", "/admin/external/schema", "A0050202", "admin");
        addStaticPageOption(pages, knownPageIds, "external-usage", "API 사용량", "/admin/external/usage", "A0050108", "admin");
        addStaticPageOption(pages, knownPageIds, "external-logs", "외부 연계 로그", "/admin/external/logs", "A0050303", "admin");
        addStaticPageOption(pages, knownPageIds, "external-webhooks", "웹훅 설정", "/admin/external/webhooks", "A0050203", "admin");
        addStaticPageOption(pages, knownPageIds, "external-sync", "동기화 실행", "/admin/external/sync", "A0050104", "admin");
        addStaticPageOption(pages, knownPageIds, "external-monitoring", "연계 모니터링", "/admin/external/monitoring", "A0050106", "admin");
        addStaticPageOption(pages, knownPageIds, "external-maintenance", "점검 관리", "/admin/external/maintenance", "A0050107", "admin");
        addStaticPageOption(pages, knownPageIds, "asset-inventory", "자산 인벤토리", "/admin/system/asset-inventory", "A0060123", "admin");
        addStaticPageOption(pages, knownPageIds, "verification-center", "운영 검증 센터", "/admin/system/verification-center", "A0060128", "admin");
        addStaticPageOption(pages, knownPageIds, "verification-assets", "검증 자산 관리", "/admin/system/verification-assets", "A0060129", "admin");
        addStaticPageOption(pages, knownPageIds, "asset-detail", "자산 상세", "/admin/system/asset-detail", "A0060124", "admin");
        addStaticPageOption(pages, knownPageIds, "asset-impact", "자산 영향도", "/admin/system/asset-impact", "A0060125", "admin");
        addStaticPageOption(pages, knownPageIds, "asset-lifecycle", "자산 생명주기", "/admin/system/asset-lifecycle", "A0060126", "admin");
        addStaticPageOption(pages, knownPageIds, "asset-gap", "자산 미흡 큐", "/admin/system/asset-gap", "A0060127", "admin");
        addStaticPageOption(pages, knownPageIds, "wbs-management", "WBS 관리", "/admin/system/wbs-management", "A1900104", "admin");
        addStaticPageOption(pages, knownPageIds, "new-page", "새 페이지", "/admin/system/new-page", "A1900106", "admin");
        addManagedMenuPageOptions(pages, knownPageIds, "AMENU1");
        addManagedMenuPageOptions(pages, knownPageIds, "HMENU1");
        for (Map<String, Object> registryPage : uiManifestRegistryPort.selectActivePageOptions()) {
            String pageId = canonicalPageId(stringValue(registryPage.get("pageId")));
            if (!pageId.isEmpty() && !knownPageIds.contains(pageId)) {
                registryPage.put("pageId", pageId);
                pages.add(registryPage);
                knownPageIds.add(pageId);
            }
        }
        return pages;
    }

    private Map<String, Object> buildPage(String pageId) {
        switch (pageId) {
            case "home":
                return buildHomePage();
            case "admin-home":
                return buildAdminHomePage();
            case "admin-login":
                return buildAdminLoginPage();
            case "auth-group":
                return buildAuthGroupPage();
            case "auth-change":
                return buildAuthChangePage();
            case "dept-role":
                return buildDeptRolePage();
            case "admin-list":
                return buildAdminListPage();
            case "company-approve":
                return buildCompanyApprovePage();
            case "certificate-pending":
                return buildCertificatePendingPage();
            case "signin-login":
                return buildSigninLoginPage();
            case "signin-auth-choice":
                return buildSigninAuthChoicePage();
            case "signin-find-id":
                return buildSigninFindIdPage();
            case "signin-find-id-result":
                return buildSigninFindIdResultPage();
            case "signin-find-password":
                return buildSigninFindPasswordPage();
            case "signin-find-password-result":
                return buildSigninFindPasswordResultPage();
            case "signin-forbidden":
                return buildSigninForbiddenPage();
            case "member-approve":
                return buildMemberApprovePage();
            case "company-list":
                return buildCompanyListPage();
            case "member-detail":
                return buildMemberDetailPage();
            case "member-edit":
                return buildMemberEditPage();
            case "company-detail":
                return buildCompanyDetailPage();
            case "company-account":
                return buildCompanyAccountPage();
            case "join-company-register":
                return buildJoinCompanyRegisterPage();
            case "join-company-register-complete":
                return buildJoinCompanyRegisterCompletePage();
            case "join-company-status":
                return buildJoinCompanyStatusPage();
            case "join-company-status-guide":
                return buildJoinCompanyStatusGuidePage();
            case "join-company-status-detail":
                return buildJoinCompanyStatusDetailPage();
            case "join-company-reapply":
                return buildJoinCompanyReapplyPage();
            case "join-terms":
                return buildJoinTermsPage();
            case "join-auth":
                return buildJoinAuthPage();
            case "join-info":
                return buildJoinInfoPage();
            case "join-complete":
                return buildJoinCompletePage();
            case "mypage":
                return buildMypagePage();
            case "join-wizard":
                return buildJoinWizardPage();
            case "observability":
                return buildObservabilityPage();
            case "monitoring-center":
                return buildMonitoringCenterPage();
            case "sensor-list":
                return buildSensorListPage();
            case "screen-flow-management":
                return buildScreenFlowManagementPage();
            case "screen-menu-assignment-management":
                return buildScreenMenuAssignmentManagementPage();
            case "external-connection-add":
                return buildExternalConnectionAddPage();
            case "external-keys":
                return buildExternalKeysPage();
            case "external-schema":
                return buildExternalSchemaPage();
            case "external-usage":
                return buildExternalUsagePage();
            case "external-logs":
                return buildExternalLogsPage();
            case "external-webhooks":
                return buildExternalWebhooksPage();
            case "external-sync":
                return buildExternalSyncPage();
            case "external-monitoring":
                return buildExternalMonitoringPage();
            case "external-maintenance":
                return buildExternalMaintenancePage();
            case "batch-management":
                return buildBatchManagementPage();
            case "error-log":
                return buildErrorLogPage();
            case "help-management":
                return buildHelpManagementPage();
            case "codex-request":
                return buildCodexRequestPage();
            case "full-stack-management":
                return buildFullStackManagementPage();
            case "infra":
                return buildInfraManagementPage();
            case "performance":
                return buildPerformancePage();
            case "notification":
                return buildNotificationPage();
            case "platform-studio":
                return buildPlatformStudioPage("platform-studio", "플랫폼 스튜디오", "/admin/system/platform-studio", "A0060109", "overview");
            case "screen-elements-management":
                return buildPlatformStudioPage("screen-elements-management", "화면 요소 관리", "/admin/system/screen-elements-management", "A0060110", "surfaces");
            case "event-management-console":
                return buildPlatformStudioPage("event-management-console", "이벤트 관리", "/admin/system/event-management-console", "A0060111", "events");
            case "function-management-console":
                return buildPlatformStudioPage("function-management-console", "함수 콘솔", "/admin/system/function-management-console", "A0060112", "functions");
            case "api-management-console":
                return buildPlatformStudioPage("api-management-console", "API 관리", "/admin/system/api-management-console", "A0060113", "apis");
            case "controller-management-console":
                return buildPlatformStudioPage("controller-management-console", "컨트롤러 관리", "/admin/system/controller-management-console", "A0060114", "controllers");
            case "db-table-management":
                return buildPlatformStudioPage("db-table-management", "DB 테이블 관리", "/admin/system/db-table-management", "A0060115", "db");
            case "column-management-console":
                return buildPlatformStudioPage("column-management-console", "컬럼 관리", "/admin/system/column-management-console", "A0060116", "columns");
            case "automation-studio":
                return buildPlatformStudioPage("automation-studio", "자동화 스튜디오", "/admin/system/automation-studio", "A0060117", "automation");
            case "backup-config":
                return buildBackupConfigPage();
            case "backup-execution":
                return buildBackupSubPage("backup-execution", "백업 실행", "/admin/system/backup", "A0060402", "execution");
            case "restore-execution":
                return buildBackupSubPage("restore-execution", "복구 실행", "/admin/system/restore", "A0060403", "restore");
            case "package-governance":
                return buildBackupSubPage("package-governance", "패키지 거버넌스", "/admin/system/package-governance", "A00605", "governance");
            case "version-management":
                return buildBackupSubPage("version-management", "버전 관리", "/admin/system/version", "A0060404", "version");
            case "db-promotion-policy":
                return buildDbPromotionPolicyPage();
            case "db-sync-deploy":
                return buildDbSyncDeployPage();
            case "environment-management":
                return buildEnvironmentManagementPage();
            case "asset-inventory":
                return buildAssetInventoryPage();
            case "verification-center":
                return buildVerificationCenterPage();
            case "verification-assets":
                return buildVerificationAssetsPage();
            case "asset-detail":
                return buildAssetDetailPage();
            case "asset-impact":
                return buildAssetImpactPage();
            case "asset-lifecycle":
                return buildAssetLifecyclePage();
            case "asset-gap":
                return buildAssetGapPage();
            case "wbs-management":
                return buildWbsManagementPage();
            case "new-page":
                return buildNewPage();
            case "sr-workbench":
                return buildSrWorkbenchPage();
            case "security-history":
                return buildSecurityHistoryPage();
            case "member-list":
                return buildMemberListPage();
            case "emission-lci":
                return buildEmissionLciPage();
            default:
                return buildRegistryDraftPage(pageId);
        }
    }

    private Map<String, Object> buildRegistryDraftPage(String pageId) {
        String normalizedPageId = canonicalPageId(pageId);
        Map<String, Object> manifestRegistry = uiManifestRegistryPort.getPageRegistry(normalizedPageId);
        MenuInfoDTO menuInfo = findManagedMenuByPageId(normalizedPageId);
        String routePath = firstNonBlank(stringValue(manifestRegistry.get("routePath")), menuInfo == null ? "" : stringValue(menuInfo.getMenuUrl()));
        String menuCode = firstNonBlank(stringValue(manifestRegistry.get("menuCode")), menuInfo == null ? "" : stringValue(menuInfo.getCode()));
        String domainCode = firstNonBlank(stringValue(manifestRegistry.get("domainCode")), inferDomainCode(routePath, menuCode));
        String pageName = firstNonBlank(stringValue(manifestRegistry.get("pageName")), menuInfo == null ? "" : stringValue(menuInfo.getCodeNm()), normalizedPageId);
        if (stringValue(manifestRegistry.get("pageId")).isEmpty()) {
            manifestRegistry = uiManifestRegistryPort.ensureManagedPageDraft(normalizedPageId, pageName, routePath, menuCode, domainCode);
        }
        Map<String, Object> page = pageOption(normalizedPageId, pageName, routePath, menuCode, domainCode);
        List<Map<String, Object>> events = buildDraftEvents(pageName, routePath, menuCode, domainCode);
        List<Map<String, Object>> apis = buildDraftApis(pageName, routePath, menuCode, domainCode);
        List<Map<String, Object>> schemas = buildDraftSchemas(pageName, routePath, menuCode, domainCode);
        page.put("summary", "메뉴 생성 시 자동 등록된 draft manifest 기반 화면입니다.");
        page.put("source", "UI_PAGE_MANIFEST draft registry");
        page.put("surfaces", buildRegistrySurfaces(manifestRegistry, routePath, domainCode));
        page.put("events", events);
        page.put("apis", apis);
        page.put("schemas", schemas);
        page.put("commonCodeGroups", buildDraftCodeGroups(routePath, menuCode, domainCode));
        page.put("changeTargets", defaultChangeTargets());
        page.put("manifestRegistry", manifestRegistry);
        return page;
    }

    private List<Map<String, Object>> buildRegistrySurfaces(Map<String, Object> manifestRegistry,
                                                            String routePath,
                                                            String domainCode) {
        List<Map<String, Object>> surfaces = new ArrayList<>();
        for (Map<String, Object> component : safeMapList(manifestRegistry.get("components"))) {
            String instanceKey = firstNonBlank(stringValue(component.get("instanceKey")), stringValue(component.get("componentId")));
            String layoutZone = firstNonBlank(stringValue(component.get("layoutZone")), "content");
            surfaces.add(surface(
                    instanceKey,
                    firstNonBlank(stringValue(component.get("componentName")), instanceKey),
                    firstNonBlank(stringValue(component.get("designReference")), "[data-help-id=\"" + instanceKey + "\"]"),
                    stringValue(component.get("componentId")),
                    layoutZone,
                    buildDraftSurfaceEventIds(layoutZone, routePath, domainCode),
                    firstNonBlank(stringValue(component.get("conditionalRuleSummary")), "자동 생성된 draft manifest component")
            ));
        }
        if (surfaces.isEmpty()) {
            surfaces.add(surface("draft-page-content", "Draft Page Content", "[data-help-id=\"draft-page-content\"]",
                    "ManagedPageContent", "content", buildDraftSurfaceEventIds("content", routePath, domainCode),
                    "자동 생성된 기본 draft content"));
        }
        return surfaces;
    }

    private void addStaticPageOption(List<Map<String, Object>> pages,
                                     Set<String> knownPageIds,
                                     String pageId,
                                     String label,
                                     String routePath,
                                     String menuCode,
                                     String domainCode) {
        String normalizedPageId = canonicalPageId(pageId);
        if (normalizedPageId.isEmpty() || knownPageIds.contains(normalizedPageId)) {
            return;
        }
        pages.add(pageOption(normalizedPageId, label, routePath, menuCode, domainCode));
        knownPageIds.add(normalizedPageId);
    }

    private void addManagedMenuPageOptions(List<Map<String, Object>> pages,
                                           Set<String> knownPageIds,
                                           String codeId) {
        try {
            for (MenuInfoDTO menu : menuInfoService.selectMenuTreeList(codeId)) {
                if (menu == null) {
                    continue;
                }
                String menuCode = normalize(stringValue(menu.getCode())).toUpperCase(Locale.ROOT);
                String menuUrl = normalize(stringValue(menu.getMenuUrl()));
                if (menuCode.length() != 8 || menuUrl.isEmpty() || "#".equals(menuUrl)) {
                    continue;
                }
                String pageId = canonicalPageId(resolvePageIdForMenu(menuUrl, menuCode));
                if (pageId.isEmpty() || knownPageIds.contains(pageId)) {
                    continue;
                }
                pages.add(pageOption(
                        pageId,
                        firstNonBlank(stringValue(menu.getCodeNm()), pageId),
                        menuUrl,
                        menuCode,
                        inferDomainCode(menuUrl, menuCode)
                ));
                knownPageIds.add(pageId);
            }
        } catch (Exception ignored) {
            // Keep the screen-command catalog available even if menu metadata lookup fails.
        }
    }

    private MenuInfoDTO findManagedMenuByPageId(String pageId) {
        String normalizedPageId = canonicalPageId(pageId);
        for (String codeId : List.of("AMENU1", "HMENU1")) {
            try {
                for (MenuInfoDTO menu : menuInfoService.selectMenuTreeList(codeId)) {
                    if (menu == null) {
                        continue;
                    }
                    String menuCode = normalize(stringValue(menu.getCode())).toUpperCase(Locale.ROOT);
                    String menuUrl = normalize(stringValue(menu.getMenuUrl()));
                    if (menuCode.length() != 8 || menuUrl.isEmpty() || "#".equals(menuUrl)) {
                        continue;
                    }
                    if (normalizedPageId.equals(canonicalPageId(resolvePageIdForMenu(menuUrl, menuCode)))) {
                        return menu;
                    }
                }
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private String resolvePageIdForMenu(String menuUrl, String menuCode) {
        String routeId = ReactPageUrlMapper.resolveRouteIdForPath(menuUrl);
        if (!routeId.isEmpty()) {
            return canonicalPageId(routeId);
        }
        if (!normalize(menuCode).isEmpty()) {
            return canonicalPageId(menuCode);
        }
        return canonicalPageId(menuUrl);
    }

    private String canonicalPageId(String value) {
        return normalize(value)
                .toLowerCase(Locale.ROOT)
                .replace('_', '-')
                .replaceAll("[^a-z0-9\\-]", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
    }

    private String inferDomainCode(String routePath, String menuCode) {
        String normalizedRoutePath = normalize(routePath);
        String normalizedMenuCode = normalize(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedRoutePath.startsWith("/admin/") || normalizedMenuCode.startsWith("A")) {
            return "admin";
        }
        if (normalizedRoutePath.startsWith("/join/")) {
            return "join";
        }
        return "home";
    }

    private List<String> buildDraftSurfaceEventIds(String layoutZone, String routePath, String domainCode) {
        List<String> eventIds = new ArrayList<>();
        eventIds.add("draft-page-view");
        if ("actions".equalsIgnoreCase(layoutZone)) {
            eventIds.add("draft-page-search");
            eventIds.add("draft-page-open-dialog");
            eventIds.add("draft-page-save");
        } else if ("content".equalsIgnoreCase(layoutZone)) {
            eventIds.add("draft-page-row-select");
            if ("admin".equalsIgnoreCase(domainCode) || routePath.startsWith("/admin/")) {
                eventIds.add("draft-page-save");
            }
        } else if ("header".equalsIgnoreCase(layoutZone)) {
            eventIds.add("draft-page-search");
        }
        return eventIds;
    }

    private List<Map<String, Object>> buildDraftEvents(String pageName,
                                                       String routePath,
                                                       String menuCode,
                                                       String domainCode) {
        List<Map<String, Object>> events = new ArrayList<>();
        events.add(event("draft-page-view", pageName + " 화면 진입", "load", "loadDraftPage", routePath,
                Collections.singletonList("draft.page.view"),
                "자동 생성된 draft page의 기본 이동 이벤트입니다."));
        events.add(event("draft-page-search", pageName + " 조회 조건 변경", "change", "handleDraftFilterChange",
                "[data-help-id=\"managed-page-actions\"] form",
                Collections.singletonList("draft.page.search"),
                "목록/상세 화면 후보를 조회하기 위한 기본 검색 이벤트입니다."));
        events.add(event("draft-page-row-select", pageName + " 항목 선택", "click", "handleDraftRowSelect",
                "[data-help-id=\"managed-page-content\"] [data-row-id]",
                Collections.singletonList("draft.page.detail"),
                "선택한 항목 상세나 연결 메타데이터를 조회하기 위한 기본 선택 이벤트입니다."));
        events.add(event("draft-page-open-dialog", pageName + " 등록/수정 대화상자 열기", "click", "openDraftDialog",
                "[data-help-id=\"managed-page-actions\"] .secondary-button",
                Collections.emptyList(),
                "등록/수정 대화상자를 열거나 패널을 펼치는 기본 액션입니다."));
        events.add(event("draft-page-save", pageName + " 저장", "submit", "submitDraftSave",
                "[data-help-id=\"managed-page-content\"] form",
                Collections.singletonList("draft.page.save"),
                "화면 요소, 기능, 권한, 공통코드 후보를 저장하는 기본 submit 이벤트입니다."));

        enrichEvent(events, "draft-page-view",
                Arrays.asList(
                        field("routePath", "string", true, "route", "대상 화면 경로"),
                        field("menuCode", "string", false, "registry", "연결된 메뉴 코드"),
                        field("insttId", "string", false, "session/query", "비마스터 계정의 회사 범위")
                ),
                Arrays.asList(
                        field("pageId", "string", true, "json", "선택된 draft page id"),
                        field("manifestReady", "boolean", true, "json", "manifest registry 존재 여부"),
                        field("requiredViewFeatureCode", "string", false, "json", "기본 VIEW 기능 코드")
                ),
                buildDraftGuardConditions(domainCode),
                Arrays.asList("화면 요약 카드 갱신", "권한/기능/스키마 후보 메타데이터 로드")
        );
        enrichEvent(events, "draft-page-search",
                Arrays.asList(
                        field("searchKeyword", "string", false, "form", "검색 키워드"),
                        field("status", "string", false, "form", "상태/분류 필터"),
                        field("insttId", "string", false, "session/form", "회사 범위 필터")
                ),
                Arrays.asList(
                        field("resultCount", "number", true, "state", "조회된 결과 건수"),
                        field("selectedRowId", "string", false, "state", "자동 선택된 첫 항목 ID")
                ),
                buildDraftGuardConditions(domainCode),
                Arrays.asList("목록 재조회", "정렬/페이징 상태 유지")
        );
        enrichEvent(events, "draft-page-row-select",
                Arrays.asList(
                        field("rowId", "string", true, "dom", "선택된 행 식별자"),
                        field("pageId", "string", true, "state", "현재 관리 대상 화면")
                ),
                Arrays.asList(
                        field("detailLoaded", "boolean", true, "state", "상세 로드 완료 여부")
                ),
                Collections.emptyList(),
                Arrays.asList("상세 패널 갱신", "관련 기능/권한 영향도 다시 계산")
        );
        enrichEvent(events, "draft-page-open-dialog",
                Arrays.asList(
                        field("mode", "string", true, "state", "create/edit"),
                        field("selectedRowId", "string", false, "state", "수정 대상 행 식별자")
                ),
                Arrays.asList(
                        field("dialogOpen", "boolean", true, "state", "대화상자 오픈 여부")
                ),
                Collections.emptyList(),
                Arrays.asList("등록/수정 폼 초기화", "기본값 채우기")
        );
        enrichEvent(events, "draft-page-save",
                Arrays.asList(
                        field("pageId", "string", true, "state", "관리 대상 draft page id"),
                        field("menuCode", "string", true, "form", "메뉴 코드"),
                        field("featureCodes", "string[]", false, "form", "저장 대상 기능 코드"),
                        field("insttId", "string", false, "session/form", "회사 범위")
                ),
                Arrays.asList(
                        field("saved", "boolean", true, "json", "저장 성공 여부"),
                        field("auditEventId", "string", false, "json", "저장 감사로그 ID"),
                        field("updatedFeatureCount", "number", false, "json", "반영된 기능 수")
                ),
                buildDraftGuardConditions(domainCode),
                Arrays.asList("저장 성공 메시지 표시", "목록 및 권한 카탈로그 새로고침", "감사로그 적재")
        );
        return events;
    }

    private List<Map<String, Object>> buildDraftApis(String pageName,
                                                     String routePath,
                                                     String menuCode,
                                                     String domainCode) {
        String normalizedRoutePath = normalizeRoutePath(routePath);
        String apiBasePath = buildDraftApiBasePath(normalizedRoutePath, domainCode);
        List<Map<String, Object>> apis = new ArrayList<>();
        apis.add(routeApi("draft.page.view", "Draft page route", routePath, menuCode));
        apis.add(api("draft.page.search", pageName + " 화면 메타 조회", "GET", apiBasePath + "/page",
                "DraftManagedController.page", "DraftManagedService.selectPageMetadata", "DraftManagedMapper.selectPageMetadata",
                buildDraftRelatedTables(domainCode, true),
                Arrays.asList("draft-menu-schema", "draft-ui-manifest-schema", "draft-audit-schema"),
                "자동 생성 후보 endpoint입니다. 실제 controller/service/mapper 경로는 화면 구현 시 확정해야 합니다."));
        apis.add(api("draft.page.detail", pageName + " 상세 후보 조회", "GET", apiBasePath + "/detail",
                "DraftManagedController.detail", "DraftManagedService.selectDetail", "DraftManagedMapper.selectDetail",
                buildDraftRelatedTables(domainCode, false),
                Arrays.asList("draft-menu-schema", "draft-ui-manifest-schema"),
                "선택 행 상세와 연결된 기능/권한/테이블 후보를 조회하는 기본 draft candidate API입니다."));
        apis.add(api("draft.page.save", pageName + " 저장", "POST", apiBasePath + "/save",
                "DraftManagedController.save", "DraftManagedService.saveManagedDraft", "DraftManagedMapper.upsertManagedDraft",
                buildDraftRelatedTables(domainCode, false),
                Arrays.asList("draft-menu-schema", "draft-ui-manifest-schema", "draft-audit-schema"),
                "메뉴/기능/권한/manifest 초안을 함께 저장하는 기본 draft candidate API입니다."));

        enrichApi(apis, "draft.page.search",
                Arrays.asList(
                        field("pageId", "string", true, "query", "draft page 식별자"),
                        field("menuCode", "string", false, "query", "메뉴 코드"),
                        field("insttId", "string", false, "query", "비마스터 회사 범위"),
                        field("searchKeyword", "string", false, "query", "검색 키워드")
                ),
                Arrays.asList(
                        field("page", "object", true, "json", "화면 메타데이터 본문"),
                        field("menuPermission", "object", true, "json", "메뉴/기능 권한 요약"),
                        field("schemas", "array", true, "json", "관련 스키마 후보 목록")
                ),
                Arrays.asList(
                        mask("insttId", "allow", "회사 범위 식별자는 권한 검증 문맥으로 사용"),
                        mask("searchKeyword", "allow", "운영 검색어는 감사상 유지 가능")
                )
        );
        enrichApi(apis, "draft.page.detail",
                Arrays.asList(
                        field("pageId", "string", true, "query", "draft page 식별자"),
                        field("rowId", "string", true, "query", "선택 행 ID"),
                        field("insttId", "string", false, "query", "회사 범위")
                ),
                Arrays.asList(
                        field("detail", "object", true, "json", "선택 행 상세"),
                        field("featureImpact", "array", false, "json", "연결 기능/권한 영향도")
                ),
                Arrays.asList(
                        mask("insttId", "allow", "회사 범위 필터"),
                        mask("rowId", "allow", "선택 행 식별자")
                )
        );
        enrichApi(apis, "draft.page.save",
                Arrays.asList(
                        field("pageId", "string", true, "body", "draft page 식별자"),
                        field("menuCode", "string", true, "body", "저장 대상 메뉴 코드"),
                        field("featureCodes", "string[]", false, "body", "선택 기능 코드"),
                        field("insttId", "string", false, "body", "회사 범위"),
                        field("auditComment", "string", false, "body", "변경 사유")
                ),
                Arrays.asList(
                        field("saved", "boolean", true, "json", "저장 성공 여부"),
                        field("auditEventId", "string", false, "json", "감사로그 ID"),
                        field("updatedAt", "string", false, "json", "최종 반영 시각")
                ),
                Arrays.asList(
                        mask("insttId", "allow", "회사 범위 강제 검증에 사용"),
                        mask("auditComment", "allow", "운영 변경 사유는 감사로그에 남김")
                )
        );
        return apis;
    }

    private List<String> buildDraftRelatedTables(String domainCode, boolean includeAudit) {
        Set<String> tables = new LinkedHashSet<>();
        tables.add("COMTCCMMNDETAILCODE");
        tables.add("COMTNMENUINFO");
        tables.add("COMTNMENUFUNCTIONINFO");
        tables.add("UI_PAGE_MANIFEST");
        tables.add("UI_COMPONENT_REGISTRY");
        tables.add("UI_PAGE_COMPONENT_MAP");
        if ("admin".equalsIgnoreCase(domainCode)) {
            tables.add("COMTNAUTHORFUNCTIONRELATE");
            tables.add("COMTNUSERFEATUREOVERRIDE");
        }
        if (includeAudit) {
            tables.add("AUDIT_EVENT");
            tables.add("TRACE_EVENT");
        }
        return new ArrayList<>(tables);
    }

    private List<Map<String, Object>> buildDraftSchemas(String pageName,
                                                        String routePath,
                                                        String menuCode,
                                                        String domainCode) {
        List<Map<String, Object>> schemas = new ArrayList<>();
        schemas.add(schema("draft-menu-schema", "메뉴/페이지 메타데이터", "COMTCCMMNDETAILCODE / COMTNMENUINFO / COMTNMENUFUNCTIONINFO",
                Arrays.asList("CODE", "CODE_NM", "CODE_DC", "MENU_URL", "MENU_ICON", "FEATURE_CODE", "USE_AT"),
                Arrays.asList("SELECT", "INSERT", "UPDATE"),
                "메뉴 관리에서 자동 등록한 공통코드, 페이지, 기본 VIEW 기능 메타데이터입니다."));
        schemas.add(schema("draft-ui-manifest-schema", "화면 manifest registry", "UI_PAGE_MANIFEST / UI_COMPONENT_REGISTRY / UI_PAGE_COMPONENT_MAP",
                Arrays.asList("PAGE_ID", "PAGE_NAME", "ROUTE_PATH", "COMPONENT_ID", "INSTANCE_KEY", "LAYOUT_ZONE", "DESIGN_REFERENCE"),
                Arrays.asList("UPSERT"),
                "메뉴 생성 직후 자동 생성된 draft manifest registry입니다."));
        schemas.add(schema("draft-audit-schema", pageName + " 감사/추적 스키마", "AUDIT_EVENT / TRACE_EVENT",
                Arrays.asList("AUDIT_ID", "ACTOR_ID", "INSTT_ID", "TARGET_ID", "ACTION_TYPE", "TRACE_ID", "RESULT_STATUS"),
                Arrays.asList("INSERT"),
                "권한/메뉴/기능 저장 시 반드시 남겨야 하는 감사/추적 메타데이터 후보입니다."));

        if ("admin".equalsIgnoreCase(domainCode) || routePath.startsWith("/admin/")) {
            schemas.add(schema("draft-admin-auth-schema", "관리자 권한 연결 스키마",
                    "COMTNAUTHORINFO / COMTNAUTHORFUNCTIONRELATE / COMTNUSERFEATUREOVERRIDE",
                    Arrays.asList("AUTHOR_CODE", "FEATURE_CODE", "EMPLYR_ID", "INSTT_ID", "GRANT_SCOPE"),
                    Arrays.asList("SELECT", "UPSERT"),
                    "비마스터 계정은 instt_id 범위 내 기능만 조회/할당해야 하는 권한 체인 메타데이터입니다."));
        } else {
            schemas.add(schema("draft-public-route-schema", "공개 화면 라우팅 스키마",
                    "COMTCCMMNDETAILCODE / COMTNMENUINFO / HTTP_SESSION",
                    Arrays.asList("CODE", "MENU_URL", "SESSION_KEY", "USE_AT"),
                    Arrays.asList("SELECT"),
                    "홈/가입/로그인 계열 화면이 메뉴 노출과 세션 분기를 함께 해석할 때 확인하는 후보 스키마입니다."));
        }
        return schemas;
    }

    private List<Map<String, Object>> buildDraftCodeGroups(String routePath, String menuCode, String domainCode) {
        List<Map<String, Object>> groups = new ArrayList<>();
        groups.add(codeGroup("MANAGED_MENU_CODE", "메뉴 코드", Collections.singletonList(menuCode), "자동 생성된 관리 대상 메뉴 코드입니다."));
        groups.add(codeGroup("MANAGED_ROUTE_SEGMENT", "화면 경로 분류", buildDraftRouteSegments(routePath),
                "메뉴 생성 직후 route path에서 추출한 화면 분류 후보입니다."));
        groups.add(codeGroup("MANAGED_DOMAIN_SCOPE", "도메인 범위", Collections.singletonList(domainCode),
                "admin/home/join 중 화면이 속한 기본 범위입니다."));
        if ("admin".equalsIgnoreCase(domainCode) || routePath.startsWith("/admin/")) {
            groups.add(codeGroup("INSTT_SCOPE_POLICY", "회사 범위 정책", Arrays.asList("MASTER_BYPASS", "NON_MASTER_REQUIRES_INSTT_ID"),
                    "비마스터 계정은 API 파라미터와 서버 쿼리 양쪽에서 instt_id 범위를 강제해야 합니다."));
        }
        return groups;
    }

    private List<String> buildDraftRouteSegments(String routePath) {
        String normalizedRoutePath = normalizeRoutePath(routePath);
        if (normalizedRoutePath.isEmpty()) {
            return Collections.singletonList("root");
        }
        List<String> values = new ArrayList<>();
        for (String token : normalizedRoutePath.replaceFirst("^/", "").split("/")) {
            if (!token.isEmpty()) {
                values.add(token);
            }
        }
        return values.isEmpty() ? Collections.singletonList("root") : values;
    }

    private List<String> buildDraftGuardConditions(String domainCode) {
        List<String> guards = new ArrayList<>();
        guards.add("메뉴 코드와 routePath가 registry와 일치해야 함");
        if ("admin".equalsIgnoreCase(domainCode)) {
            guards.add("ROLE_SYSTEM_MASTER 외 계정은 instt_id 파라미터 또는 세션 범위가 필요함");
            guards.add("grantable 범위를 벗어난 기능/권한은 저장 대상에서 제외");
        }
        return guards;
    }

    private String buildDraftApiBasePath(String routePath, String domainCode) {
        String normalizedRoutePath = normalizeRoutePath(routePath);
        if (normalizedRoutePath.isEmpty()) {
            return "admin".equalsIgnoreCase(domainCode) ? "/api/admin/managed-page" : "/api/managed-page";
        }
        return "/api" + normalizedRoutePath;
    }

    private String normalizeRoutePath(String routePath) {
        String normalized = stringValue(routePath).trim();
        if (normalized.startsWith("/en/")) {
            normalized = normalized.substring(3);
        }
        return normalized;
    }

    private Map<String, Object> buildAuthGroupPage() {
        Map<String, Object> page = pageOption("auth-group", "권한 그룹", "/admin/auth/group", "AMENU_AUTH_GROUP", "admin");
        page.put("summary", "권한 분류, 그룹 생성, 기능 매핑을 운영하는 관리자 권한 설계 화면입니다.");
        page.put("source", "frontend/src/features/auth-groups/AuthGroupMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("auth-group-filters", "권한 그룹 필터", "[data-help-id=\"auth-group-filters\"]", "AuthGroupFilters", "actions",
                        Arrays.asList("auth-group-page-load"), "권한 분류, 회사, 권한 그룹을 바꿔 조회 범위를 좁힙니다."),
                surface("auth-group-create", "권한 그룹 생성", "[data-help-id=\"auth-group-create\"]", "AuthGroupCreateForm", "content",
                        Arrays.asList("auth-group-create-submit"), "신규 권한 그룹 코드와 설명을 생성합니다."),
                surface("auth-group-profile", "권한 그룹 프로필", "[data-help-id=\"auth-group-profile\"]", "AuthGroupRoleProfile", "content",
                        Arrays.asList("auth-group-profile-save"), "회원 수정 화면에 노출할 업무 역할명과 우선 제공 업무를 권한 그룹 메타데이터로 저장합니다."),
                surface("auth-group-features", "기능 매핑", "[data-help-id=\"auth-group-features\"]", "AuthGroupFeatureMatrix", "content",
                        Arrays.asList("auth-group-feature-save"), "선택한 권한 그룹에 기능 코드를 저장합니다.")
        ));
        page.put("events", Arrays.asList(
                event("auth-group-page-load", "권한 그룹 조회", "change", "fetchAuthGroupPage", "[data-help-id=\"auth-group-filters\"] select",
                        Arrays.asList("admin.auth-groups.page"), "권한 분류와 회사 범위에 따라 권한 그룹/기능 목록을 다시 조회합니다."),
                event("auth-group-create-submit", "권한 그룹 생성", "submit", "handleCreate", "[data-help-id=\"auth-group-create\"] form",
                        Arrays.asList("admin.auth-groups.create"), "신규 권한 그룹을 생성합니다."),
                event("auth-group-profile-save", "권한 그룹 프로필 저장", "click", "handleSaveRoleProfile", "[data-help-id=\"auth-group-profile\"] .primary-button",
                        Arrays.asList("admin.auth-groups.profile-save"), "권한 그룹에 연결된 업무 역할과 우선 제공 업무 메타데이터를 저장합니다."),
                event("auth-group-feature-save", "기능 매핑 저장", "click", "handleSaveFeatures", "[data-help-id=\"auth-group-features\"] .primary-button",
                        Arrays.asList("admin.auth-groups.features.save"), "선택 기능과 권한 그룹 매핑을 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("author-group-schema", "권한 그룹 스키마", "COMTNAUTHORINFO",
                        Arrays.asList("AUTHOR_CODE", "AUTHOR_NM", "AUTHOR_DC"), Arrays.asList("SELECT", "INSERT"),
                        "권한 그룹 정의를 저장합니다."),
                schema("author-role-profile-schema", "권한 그룹 프로필 스키마", "data/author-role-profiles/profiles.json",
                        Arrays.asList("authorCode", "displayTitle", "priorityWorks", "description", "memberEditVisibleYn", "updatedAt"),
                        Arrays.asList("SELECT", "UPSERT"),
                        "권한 그룹에 연결된 업무 역할 프로필 메타데이터를 저장합니다."),
                schema("menu-feature-schema", "메뉴/기능 권한 스키마", "COMTNMENUINFO / COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("MENU_CODE", "FEATURE_CODE", "AUTHOR_CODE"), Arrays.asList("SELECT", "INSERT", "DELETE"),
                        "권한 그룹별 기능 코드 매핑을 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("ROLE_CATEGORY", "권한 분류", Arrays.asList("GENERAL", "DEPARTMENT", "USER"), "권한 그룹 범위를 나누는 기준입니다."),
                codeGroup("AMENU_AUTH", "권한 운영 메뉴", Arrays.asList("AMENU_AUTH_GROUP", "AMENU_AUTH_CHANGE", "AMENU_DEPT_ROLE"), "권한 운영 화면 메뉴 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildHomePage() {
        Map<String, Object> page = pageOption("home", "홈", "/home", "HMENU_HOME", "home");
        page.put("summary", "메인 배너, 통합 검색, 핵심 서비스, 운영 요약을 제공하는 사용자 메인 홈 화면입니다.");
        page.put("source", "frontend/src/features/home-entry/HomeEntryPages.tsx, HomeEntrySections.tsx");
        page.put("surfaces", Arrays.asList(
                surface("home-hero", "메인 배너", "[data-help-id=\"home-hero\"]", "HomeHeroSection", "header",
                        Collections.emptyList(), "서비스 핵심 메시지와 대표 진입 링크를 제공합니다."),
                surface("home-search", "통합 검색", "[data-help-id=\"home-search\"]", "HomeSearchSection", "actions",
                        Collections.emptyList(), "주요 메뉴와 검색 키워드 탐색을 제공합니다."),
                surface("home-services", "핵심 서비스", "[data-help-id=\"home-services\"]", "HomeServiceGrid", "content",
                        Collections.emptyList(), "회원가입, 인증, 조회 등 주요 서비스를 카드형으로 제공합니다."),
                surface("home-summary", "운영 현황 요약", "[data-help-id=\"home-summary\"]", "HomeSummarySection", "content",
                        Collections.emptyList(), "최근 운영 지표와 요약 통계를 노출합니다.")
        ));
        page.put("events", Collections.emptyList());
        page.put("apis", Collections.emptyList());
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildEmissionLciPage() {
        Map<String, Object> page = pageOption("emission-lci", "LCI DB 조회", "/emission/lci", "H0010202", "home");
        page.put("summary", "물질명, 공정, 지역, 영향 범주 기준으로 LCI 데이터셋을 조회하고 분석 대상 사업장 및 데이터 품질 지표를 함께 확인하는 공개 화면입니다.");
        page.put("source", "frontend/src/features/emission-lci/EmissionLciMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("emission-lci-hero", "LCI 조건 검색", "[data-help-id=\"emission-lci-hero\"]", "EmissionLciHero", "header",
                        Collections.singletonList("emission-lci-search"), "물질명, 공정, 지역, 영향 범주 조건으로 LCI 데이터셋을 탐색합니다."),
                surface("emission-lci-results", "조회 결과 테이블", "[data-help-id=\"emission-lci-results\"]", "EmissionLciResults", "content",
                        Arrays.asList("emission-lci-select-dataset", "emission-lci-change-page"), "데이터셋 코드, 기능단위, 배출계수, 출처, 신뢰도를 비교합니다."),
                surface("emission-lci-sites", "분석 대상 사업장", "[data-help-id=\"emission-lci-sites\"]", "EmissionLciSites", "content",
                        Collections.emptyList(), "연결된 사업장별 적용 범위와 후속 조치 상태를 카드로 보여줍니다."),
                surface("emission-lci-quality", "품질 및 성과", "[data-help-id=\"emission-lci-quality\"]", "EmissionLciQuality", "content",
                        Collections.emptyList(), "데이터 소스 비중, 무결성, 처리량, 분석 건수를 요약합니다.")
        ));
        page.put("events", Arrays.asList(
                event("emission-lci-search", "LCI 데이터셋 조회", "submit", "handleSearch", "[data-help-id=\"emission-lci-hero\"] form",
                        Arrays.asList("home.emission.lci.list", "home.emission.lci.summary"), "검색 조건에 맞는 LCI 데이터셋과 요약 지표를 갱신합니다."),
                event("emission-lci-select-dataset", "LCI 데이터셋 선택", "click", "handleSelectDataset", "[data-help-id=\"emission-lci-results\"] [data-row-id]",
                        Collections.emptyList(), "선택한 데이터셋을 기준으로 상세 비교와 사업장 연결 현황을 확인합니다."),
                event("emission-lci-change-page", "LCI 결과 페이지 이동", "click", "handleChangePage", "[data-help-id=\"emission-lci-results\"] nav button",
                        Arrays.asList("home.emission.lci.list"), "조회 결과 페이징을 변경합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("home-emission-lci-dataset", "LCI 데이터셋 스키마", "LCI_DATASET / LCI_SOURCE / LCI_IMPACT_FACTOR",
                        Arrays.asList("DATASET_CODE", "MATERIAL_NAME", "PROCESS_NAME", "REGION_CODE", "IMPACT_CATEGORY", "FUNCTIONAL_UNIT", "GWP_VALUE", "SOURCE_NAME", "QUALITY_GRADE"),
                        Arrays.asList("SELECT"), "LCI 데이터셋 검색 결과와 배출계수 출처 메타데이터를 구성하는 후보 스키마입니다."),
                schema("home-emission-lci-quality", "LCI 품질/사업장 연결 스키마", "LCI_ANALYSIS_TARGET / LCI_QUALITY_METRIC",
                        Arrays.asList("SITE_ID", "SITE_NAME", "MATCH_RATE", "FOLLOW_UP_STATUS", "INTEGRITY_SCORE", "MONTHLY_ANALYSIS_COUNT"),
                        Arrays.asList("SELECT"), "사업장별 LCI 적용 현황과 품질 지표를 요약하는 후보 스키마입니다."))
        );
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("HMENU1", "홈 메뉴 코드", Arrays.asList("H00102", "H0010202"), "LCA 분석 섹션과 LCI DB 조회 메뉴 코드입니다."),
                codeGroup("LCI_IMPACT_CATEGORY", "영향 범주", Arrays.asList("GWP", "AP", "EP", "ODP"), "LCI 데이터셋 검색과 비교에 사용하는 대표 영향 범주입니다."),
                codeGroup("LCI_REGION_SCOPE", "지역 범위", Arrays.asList("KR", "ASIA", "GLOBAL"), "LCI 데이터셋 적용 지역 범위를 구분하는 예시 코드군입니다."))
        );
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAdminHomePage() {
        Map<String, Object> page = pageOption("admin-home", "관리자 홈", "/admin/", "AMENU_ADMIN_HOME", "admin");
        page.put("summary", "운영 대시보드 카드, 승인 대기, 심사 진행 현황을 제공하는 관리자 메인 화면입니다.");
        page.put("source", "frontend/src/features/admin-entry/AdminEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("admin-home-cards", "운영 요약 카드", "[data-help-id=\"admin-home-cards\"]", "AdminHomeCards", "content",
                        Collections.emptyList(), "회원, 배출량, 심사 현황 요약을 보여줍니다."),
                surface("admin-home-approvals", "승인 대기", "[data-help-id=\"admin-home-approvals\"]", "AdminHomeApprovals", "content",
                        Collections.emptyList(), "최근 가입 승인 대기 건을 노출합니다."),
                surface("admin-home-progress", "심사 진행 현황", "[data-help-id=\"admin-home-progress\"]", "AdminHomeProgress", "content",
                        Collections.emptyList(), "단계별 심사 진행 상태를 시각화합니다.")
        ));
        page.put("events", Collections.emptyList());
        page.put("apis", Collections.emptyList());
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAdminLoginPage() {
        Map<String, Object> page = pageOption("admin-login", "관리자 로그인", "/admin/login/loginView", "AMENU_ADMIN_LOGIN", "admin");
        page.put("summary", "관리자 ID/비밀번호와 2차 인증 수단을 제공하는 관리자 로그인 화면입니다.");
        page.put("source", "frontend/src/features/admin-entry/AdminEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("admin-login-warning", "경고 배너", "[data-help-id=\"admin-login-warning\"]", "AdminLoginWarning", "header",
                        Collections.emptyList(), "관리 전용 시스템 경고와 보안 안내를 제공합니다."),
                surface("admin-login-form", "관리자 로그인 폼", "[data-help-id=\"admin-login-form\"]", "AdminLoginForm", "content",
                        Collections.singletonList("admin-login-submit"), "관리자 인증 입력 영역입니다."),
                surface("admin-login-mfa", "2차 인증 선택", "[data-help-id=\"admin-login-mfa\"]", "AdminLoginMfa", "content",
                        Collections.emptyList(), "공동인증서, OTP, 모바일 신분증 등 인증 수단을 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("admin-login-submit", "관리자 로그인", "submit", "handleSubmit", "[data-help-id=\"admin-login-form\"] form",
                        Arrays.asList("admin.login.action"), "관리자 로그인 요청을 전송합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninForbiddenPage() {
        Map<String, Object> page = pageOption("signin-forbidden", "접근 거부", "/signin/loginForbidden", "HMENU_SIGNIN_FORBIDDEN", "home");
        page.put("summary", "권한이 없는 사용자에게 접근 거부 사유를 안내하는 공개 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-forbidden-card", "접근 거부 카드", "[data-help-id=\"signin-forbidden-card\"]", "SigninForbiddenCard", "content",
                        Collections.emptyList(), "현재 페이지 접근 불가 상태와 안내 문구를 제공합니다.")
        ));
        page.put("events", Collections.emptyList());
        page.put("apis", Collections.emptyList());
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMemberApprovePage() {
        Map<String, Object> page = pageOption("member-approve", "회원 승인", "/admin/member/approve", "A0010103", "admin");
        page.put("summary", "회원 승인 검색, 일괄 처리, 행 단위 승인과 반려를 관리하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/member-approve/MemberApproveMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("member-approve-search", "승인 대상 검색", "[data-help-id=\"member-approve-search\"]", "MemberApprovalFilter", "actions",
                        Arrays.asList("member-approve-search-submit"), "회원구분, 상태, 검색어로 승인 대상을 조회합니다."),
                surface("member-approve-batch-actions", "일괄 승인/반려", "[data-help-id=\"member-approve-batch-actions\"]", "MemberApprovalBatchActions", "actions",
                        Arrays.asList("member-approve-batch-approve", "member-approve-batch-reject"), "선택한 회원을 일괄 승인 또는 반려합니다."),
                surface("member-approve-table", "회원 승인 목록", "[data-help-id=\"member-approve-table\"]", "MemberApprovalTable", "content",
                        Arrays.asList("member-approve-row-review", "member-approve-row-approve", "member-approve-row-reject"), "회원 기본정보와 증빙 서류를 검토하고 개별 처리합니다.")
        ));
        page.put("events", Arrays.asList(
                event("member-approve-search-submit", "회원 승인 목록 조회", "click", "applyFilters", "[data-help-id=\"member-approve-search\"] button",
                        Arrays.asList("admin.member.approve.page"), "검색 조건으로 회원 승인 목록을 다시 조회합니다."),
                event("member-approve-batch-approve", "선택 회원 승인", "click", "handleAction", "[data-help-id=\"member-approve-batch-actions\"] button",
                        Arrays.asList("admin.member.approve.action"), "선택한 회원을 일괄 승인합니다."),
                event("member-approve-batch-reject", "선택 회원 반려", "click", "handleAction", "[data-help-id=\"member-approve-batch-actions\"] button",
                        Arrays.asList("admin.member.approve.action"), "선택한 회원을 일괄 반려합니다."),
                event("member-approve-row-review", "회원 상세 검토", "click", "setReviewMemberId", "[data-help-id=\"member-approve-table\"] button",
                        Collections.emptyList(), "선택한 회원의 상세 검토 패널을 엽니다."),
                event("member-approve-row-approve", "회원 개별 승인", "click", "handleAction", "[data-help-id=\"member-approve-table\"] button",
                        Arrays.asList("admin.member.approve.action"), "개별 회원 승인 상태를 저장합니다."),
                event("member-approve-row-reject", "회원 개별 반려", "click", "handleAction", "[data-help-id=\"member-approve-table\"] button",
                        Arrays.asList("admin.member.approve.action"), "개별 회원 반려 상태를 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("member-approve-schema", "회원 승인 모델", "COMTNENTRPRSMBER",
                        Arrays.asList("ENTRPRS_MBER_ID", "APPLCNT_NM", "CMPNY_NM", "MBER_TY_CODE", "SBSCRB_STTUS"),
                        Arrays.asList("SELECT", "UPDATE"), "회원 가입 승인 상태와 기본 정보를 관리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("MEMBER_STATUS", "회원 상태", Arrays.asList("A", "P", "R", "X"), "승인 상태 필터와 배지에 사용됩니다."),
                codeGroup("MEMBER_TYPE", "회원 유형", Arrays.asList("EMITTER", "PERFORMER", "CENTER", "GOV"), "회원구분 필터와 라벨에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninAuthChoicePage() {
        Map<String, Object> page = pageOption("signin-auth-choice", "인증 수단 선택", "/signin/authChoice", "HMENU_SIGNIN_AUTH_CHOICE", "home");
        page.put("summary", "로그인 전 본인인증 수단을 선택하는 사용자 공용 진입 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-auth-choice-options", "인증 수단 선택 카드", "[data-help-id=\"signin-auth-choice-options\"]", "SigninAuthChoiceOptions", "content",
                        Arrays.asList("signin-auth-choice-submit"), "간편인증, 공동인증서, 금융인증서를 선택합니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-auth-choice-submit", "인증 수단 선택", "click", "handleAuthChoice", "[data-help-id=\"signin-auth-choice-options\"] button",
                        Arrays.asList("signin.auth-choice.complete"), "선택한 인증 수단 결과를 저장하고 홈으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("signin-auth-choice-schema", "인증 선택 세션 스키마", "HTTP_SESSION",
                        Arrays.asList("storedUserId", "authTy", "authDn", "authCi", "authDi"), Arrays.asList("SESSION_WRITE"),
                        "로그인 전 인증 선택 결과를 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AUTH_METHOD", "인증 수단", Arrays.asList("SIMPLE", "JOINT", "FINANCIAL"), "로그인 전 인증 수단 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninLoginPage() {
        Map<String, Object> page = pageOption("signin-login", "로그인", "/signin/loginView", "HMENU_SIGNIN_LOGIN", "home");
        page.put("summary", "로그인, 아이디 저장, 자동 로그인, 간편인증 진입을 제공하는 사용자 공용 로그인 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-login-notice", "로그인 공지", "[data-help-id=\"signin-login-notice\"]", "SigninLoginNotice", "header",
                        Collections.emptyList(), "시스템 점검 및 보안 안내 공지를 노출합니다."),
                surface("signin-login-tabs", "회원 구분 탭", "[data-help-id=\"signin-login-tabs\"]", "SigninLoginTabs", "actions",
                        Arrays.asList("signin-login-tab-change"), "국내/해외 회원 유형에 따라 아이디 찾기, 비밀번호 찾기 링크를 바꿉니다."),
                surface("signin-login-form", "로그인 입력 폼", "[data-help-id=\"signin-login-form\"]", "SigninLoginForm", "content",
                        Arrays.asList("signin-login-submit", "signin-login-link-navigate"), "아이디, 비밀번호, 저장 옵션으로 로그인을 수행합니다."),
                surface("signin-login-simple-auth", "간편인증 로그인 진입", "[data-help-id=\"signin-login-simple-auth\"]", "SigninSimpleAuthActions", "content",
                        Arrays.asList("signin-login-simple-auth-select"), "간편인증, 공동인증서, 금융인증서 로그인을 선택합니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-login-tab-change", "로그인 탭 전환", "click", "setTab", "[data-help-id=\"signin-login-tabs\"] button",
                        Collections.emptyList(), "국내/해외 회원 구분을 전환합니다."),
                event("signin-login-submit", "로그인 제출", "submit", "handleSubmit / submitLogin", "[data-help-id=\"signin-login-form\"] form",
                        Arrays.asList("signin.login.submit"), "로그인 세션을 생성하고 인증 상태에 따라 다음 화면으로 이동합니다."),
                event("signin-login-link-navigate", "로그인 보조 링크 이동", "click", "navigate", "[data-help-id=\"signin-login-form\"] a",
                        Arrays.asList("route.signin.find-id", "route.signin.find-password", "route.join.step1"), "아이디 찾기, 비밀번호 찾기, 회원가입으로 이동합니다."),
                event("signin-login-simple-auth-select", "간편인증 로그인 선택", "click", "noop", "[data-help-id=\"signin-login-simple-auth\"] button",
                        Collections.emptyList(), "간편인증 로그인 방식 선택 UI를 제공합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("signin-login-schema", "로그인 사용자 스키마", "COMVNUSERMASTER / HTTP_SESSION",
                        Arrays.asList("USER_ID", "PASSWORD", "USER_SE", "CERTIFIED"), Arrays.asList("SELECT", "SESSION_WRITE"),
                        "로그인 검증과 세션 생성에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("LOGIN_MEMBER_SCOPE", "로그인 회원 범위", Arrays.asList("domestic", "overseas"), "국내/해외 회원 탭 구분입니다."),
                codeGroup("LOGIN_AUTH_METHOD", "간편인증 로그인 수단", Arrays.asList("SIMPLE", "JOINT", "FINANCIAL"), "로그인 대체 인증 수단 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninFindIdPage() {
        Map<String, Object> page = pageOption("signin-find-id", "아이디 찾기", "/signin/findId", "HMENU_SIGNIN_FIND_ID", "home");
        page.put("summary", "이름, 이메일, 인증 방식으로 사용자 아이디를 찾는 공용 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-find-id-form", "아이디 찾기 입력 폼", "[data-help-id=\"signin-find-id-form\"]", "SigninFindIdForm", "content",
                        Arrays.asList("signin-find-id-send-code", "signin-find-id-submit"), "이름, 이메일, 인증번호를 입력합니다."),
                surface("signin-find-id-methods", "국내 인증 수단 목록", "[data-help-id=\"signin-find-id-methods\"]", "SigninFindIdMethods", "content",
                        Collections.emptyList(), "국내 사용자의 본인인증 수단 목록을 보여줍니다."),
                surface("signin-find-id-result-card", "아이디 찾기 결과 카드", "[data-help-id=\"signin-find-id-result-card\"]", "SigninFindIdResultCard", "content",
                        Arrays.asList("signin-find-id-result-load"), "마스킹된 아이디 결과를 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-find-id-send-code", "이메일 인증번호 발송", "click", "handleSendCode", "[data-help-id=\"signin-find-id-form\"] button",
                        Collections.emptyList(), "해외 사용자 이메일 인증번호를 발송합니다."),
                event("signin-find-id-submit", "아이디 찾기 제출", "click", "handleSubmit", "[data-help-id=\"signin-find-id-form\"] button",
                        Arrays.asList("route.signin.find-id-result"), "입력값을 검증하고 결과 화면으로 이동합니다."),
                event("signin-find-id-result-load", "아이디 찾기 결과 조회", "load", "useAsyncValue", "[data-help-id=\"signin-find-id-result-card\"]",
                        Arrays.asList("signin.find-id.result"), "마스킹된 아이디 결과를 조회합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("signin-find-id-result-schema", "아이디 찾기 결과 스키마", "COMVNUSERMASTER",
                        Arrays.asList("USER_ID", "USER_NM", "EMAIL_ADRES"), Arrays.asList("SELECT"),
                        "아이디 찾기 결과 조회에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("PUBLIC_TAB", "공용 탭 구분", Arrays.asList("domestic", "overseas"), "국내/해외 사용자 구분입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninFindPasswordPage() {
        Map<String, Object> page = pageOption("signin-find-password", "비밀번호 찾기", "/signin/findPassword", "HMENU_SIGNIN_FIND_PASSWORD", "home");
        page.put("summary", "아이디와 이메일 또는 인증 수단으로 본인을 확인한 뒤 새 비밀번호를 설정하는 공용 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-find-password-verify", "본인 확인 단계", "[data-help-id=\"signin-find-password-verify\"]", "SigninFindPasswordVerify", "content",
                        Arrays.asList("signin-find-password-verify", "signin-find-password-send-code"), "아이디와 인증 수단 또는 이메일로 본인을 확인합니다."),
                surface("signin-find-password-reset", "새 비밀번호 입력", "[data-help-id=\"signin-find-password-reset\"]", "SigninFindPasswordReset", "content",
                        Arrays.asList("signin-find-password-reset-submit"), "새 비밀번호와 확인 비밀번호를 입력합니다."),
                surface("signin-find-password-actions", "비밀번호 재설정 액션", "[data-help-id=\"signin-find-password-actions\"]", "SigninFindPasswordActions", "actions",
                        Arrays.asList("signin-find-password-reset-submit"), "재설정 완료를 제출합니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-find-password-send-code", "비밀번호 찾기 인증번호 발송", "click", "handleSendCode", "[data-help-id=\"signin-find-password-verify\"] button",
                        Collections.emptyList(), "이메일 인증번호를 발송합니다."),
                event("signin-find-password-verify", "본인 확인", "click", "verifyIdentity / verifyEmailAndProceed", "[data-help-id=\"signin-find-password-verify\"] button",
                        Collections.emptyList(), "본인 확인 상태를 완료로 전환합니다."),
                event("signin-find-password-reset-submit", "비밀번호 재설정 완료", "click", "handleReset", "[data-help-id=\"signin-find-password-actions\"] button",
                        Arrays.asList("signin.find-password.reset"), "새 비밀번호를 저장하고 결과 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("signin-password-reset-schema", "비밀번호 재설정 스키마", "COMVNUSERMASTER",
                        Arrays.asList("USER_ID", "PASSWORD", "PASSWORD_CNSR"), Arrays.asList("SELECT", "UPDATE"),
                        "비밀번호 재설정 저장에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("PASSWORD_VERIFY_METHOD", "비밀번호 찾기 인증 수단", Arrays.asList("JOINT", "OTP", "EMAIL"), "비밀번호 찾기 본인 확인 수단입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninFindIdResultPage() {
        Map<String, Object> page = pageOption("signin-find-id-result", "아이디 찾기 결과", "/signin/findId/result", "HMENU_SIGNIN_FIND_ID_RESULT", "home");
        page.put("summary", "마스킹된 아이디 조회 결과와 비밀번호 재설정 이동을 제공하는 결과 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-find-id-result-card", "아이디 찾기 결과 카드", "[data-help-id=\"signin-find-id-result-card\"]", "SigninFindIdResultCard", "content",
                        Arrays.asList("signin-find-id-result-load"), "조회된 마스킹 아이디를 보여줍니다."),
                surface("signin-find-id-result-actions", "아이디 찾기 결과 액션", "[data-help-id=\"signin-find-id-result-actions\"]", "SigninFindIdResultActions", "actions",
                        Arrays.asList("signin-find-id-result-reset"), "비밀번호 재설정 또는 로그인 이동을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-find-id-result-load", "아이디 결과 조회", "load", "useAsyncValue", "[data-help-id=\"signin-find-id-result-card\"]",
                        Arrays.asList("signin.find-id.result"), "이름과 이메일 기준 마스킹 아이디를 조회합니다."),
                event("signin-find-id-result-reset", "비밀번호 재설정 이동", "click", "navigate", "[data-help-id=\"signin-find-id-result-actions\"] a",
                        Arrays.asList("route.signin.find-password"), "비밀번호 재설정 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("signin-find-id-result-schema", "아이디 찾기 결과 스키마", "COMVNUSERMASTER",
                        Arrays.asList("USER_ID", "USER_NM", "EMAIL_ADRES"), Arrays.asList("SELECT"),
                        "마스킹된 아이디 조회 결과를 구성합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("PUBLIC_TAB", "공용 탭 구분", Arrays.asList("domestic", "overseas"), "국내/해외 결과 분기입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSigninFindPasswordResultPage() {
        Map<String, Object> page = pageOption("signin-find-password-result", "비밀번호 찾기 완료", "/signin/findPassword/result", "HMENU_SIGNIN_FINDPW_RESULT", "home");
        page.put("summary", "비밀번호 재설정 완료 메시지와 로그인 복귀를 제공하는 결과 화면입니다.");
        page.put("source", "frontend/src/features/public-entry/PublicEntryPages.tsx");
        page.put("surfaces", Arrays.asList(
                surface("signin-find-password-result-card", "비밀번호 재설정 완료 카드", "[data-help-id=\"signin-find-password-result-card\"]", "SigninFindPasswordResultCard", "content",
                        Collections.emptyList(), "비밀번호 재설정 성공 메시지를 보여줍니다."),
                surface("signin-find-password-result-action", "로그인 복귀 액션", "[data-help-id=\"signin-find-password-result-action\"]", "SigninFindPasswordResultAction", "actions",
                        Arrays.asList("signin-find-password-result-login"), "로그인 화면으로 복귀합니다.")
        ));
        page.put("events", Arrays.asList(
                event("signin-find-password-result-login", "로그인 복귀", "click", "navigate", "[data-help-id=\"signin-find-password-result-action\"]",
                        Arrays.asList("route.signin.login"), "로그인 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyRegisterPage() {
        Map<String, Object> page = pageOption("join-company-register", "회원사 등록", "/join/companyRegister", "HMENU_JOIN_COMPANY_REGISTER", "join");
        page.put("summary", "소속 기관 검색 실패 시 신규 회원사를 등록하고 증빙 파일을 제출하는 공개 가입 화면입니다.");
        page.put("source", "frontend/src/features/join-company-register/JoinCompanyRegisterMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-register-contact", "담당자 정보 입력", "#main-content .grid", "JoinCompanyContactForm", "content",
                        Arrays.asList("join-company-register-submit"), "담당자 성명, 이메일, 연락처를 입력합니다."),
                surface("join-company-register-business", "사업자 정보 입력", "#main-content form", "JoinCompanyBusinessForm", "content",
                        Arrays.asList("join-company-register-duplicate-check", "join-company-register-address-search"), "기관명, 대표자명, 사업자번호, 주소를 입력합니다."),
                surface("join-company-register-files", "증빙 업로드", "#main-content form .join-upload-row", "JoinCompanyFileUpload", "content",
                        Arrays.asList("join-company-register-file-add", "join-company-register-file-remove"), "증빙 파일을 추가하거나 제거합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-register-duplicate-check", "기관명 중복 확인", "click", "handleDuplicateCheck", "#main-content form button",
                        Arrays.asList("join.company-register.duplicate-check"), "기관명 중복 여부를 확인합니다."),
                event("join-company-register-address-search", "주소 검색", "click", "openAddressSearch", "#main-content form button",
                        Collections.emptyList(), "주소 검색 위젯을 열어 주소를 채웁니다."),
                event("join-company-register-file-add", "파일 행 추가", "click", "addFileRow", "#main-content form .join-upload-add-btn",
                        Collections.emptyList(), "증빙 파일 행을 추가합니다."),
                event("join-company-register-file-remove", "파일 행 제거", "click", "removeFileRow", "#main-content form .join-upload-remove-btn",
                        Collections.emptyList(), "증빙 파일 행을 제거합니다."),
                event("join-company-register-submit", "회원사 등록 신청", "submit", "handleSubmit", "#main-content form",
                        Arrays.asList("join.company-register.page", "join.company-register.submit", "route.join.company-register-complete"), "입력값과 첨부 파일을 검증한 뒤 회원사 등록을 제출합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-company-register-schema", "회원사 등록 스키마", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_NM", "BIZRNO", "REPRSNT_NM", "ZIP", "ADRES", "DETAIL_ADRES", "CHARGER_NM", "CHARGER_EMAIL", "CHARGER_TEL"), Arrays.asList("SELECT", "INSERT"),
                        "회원사 등록 신청 본문을 저장합니다."),
                schema("join-company-file-schema", "회원사 등록 첨부 스키마", "COMTNINSTTFILE",
                        Arrays.asList("ATCH_FILE_ID", "FILE_SN", "ORIGNL_FILE_NM", "FILE_STRE_COURS"), Arrays.asList("INSERT"),
                        "회원사 등록 증빙 파일을 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_COMPANY_MEMBERSHIP", "회원사 유형", Arrays.asList("EMITTER", "INSTITUTION", "SUPPLIER"), "회원사 등록 유형 분기입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyRegisterCompletePage() {
        Map<String, Object> page = pageOption("join-company-register-complete", "회원사 등록 완료", "/join/companyRegisterComplete", "HMENU_JOIN_COMP_REG_DONE", "join");
        page.put("summary", "회원사 등록 신청 완료 안내와 신청 내역 요약을 보여주는 결과 화면입니다.");
        page.put("source", "frontend/src/features/join-company-register/JoinCompanyRegisterCompleteMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-register-complete-summary", "등록 완료 요약", "#main-content .text-center", "JoinCompanyRegisterCompleteSummary", "content",
                        Collections.emptyList(), "등록 완료 메시지와 요약 정보를 보여줍니다."),
                surface("join-company-register-complete-actions", "등록 완료 액션", "#main-content .flex.flex-col.items-center", "JoinCompanyRegisterCompleteActions", "actions",
                        Arrays.asList("join-company-register-complete-home", "join-company-register-complete-status"), "홈 이동과 현황 조회 안내로 이동합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-register-complete-home", "완료 후 홈 이동", "click", "handleHome", "#main-content button",
                        Arrays.asList("join.session.reset", "route.home"), "가입 세션을 초기화하고 홈으로 이동합니다."),
                event("join-company-register-complete-status", "현황 안내 이동", "click", "handleStatus", "#main-content button",
                        Arrays.asList("route.join.company-status-guide"), "가입 현황 안내 페이지로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-company-register-complete-schema", "회원사 등록 완료 요약 모델", "SESSION_STORAGE / QUERY_STRING",
                        Arrays.asList("insttNm", "bizrno", "regDate"), Arrays.asList("READ"),
                        "등록 완료 요약 표시값을 구성합니다.")
        ));
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyStatusPage() {
        Map<String, Object> page = pageOption("join-company-status", "회원사 가입 현황 조회", "/join/companyJoinStatusSearch", "HMENU_JOIN_COMPANY_STATUS", "join");
        page.put("summary", "사업자등록번호 또는 신청번호 기준으로 회원사 가입 현황을 조회하는 검색 화면입니다.");
        page.put("source", "frontend/src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-status-search", "가입 현황 조회 폼", "#main-content", "JoinCompanyStatusSearchForm", "content",
                        Arrays.asList("join-company-status-mode-change", "join-company-status-search"), "조회 방식과 입력값을 선택합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-status-mode-change", "조회 방식 전환", "click", "setMode", "#main-content button",
                        Collections.emptyList(), "사업자번호 조회와 신청번호 조회 모드를 전환합니다."),
                event("join-company-status-search", "가입 현황 상세 이동", "click", "handleSearch", "#main-content button",
                        Arrays.asList("route.join.company-status-detail"), "입력값 검증 후 상세 현황 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("COMPANY_STATUS_SEARCH_MODE", "회원사 현황 조회 방식", Arrays.asList("biz", "app"), "사업자번호/신청번호 조회 분기입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyStatusGuidePage() {
        Map<String, Object> page = pageOption("join-company-status-guide", "회원사 가입 현황 안내", "/join/companyJoinStatusGuide", "HMENU_JOIN_COMP_STAT_GUIDE", "join");
        page.put("summary", "회원사 가입 현황 조회 절차와 본인확인 안내를 보여주는 가이드 화면입니다.");
        page.put("source", "frontend/src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-status-guide", "가입 현황 조회 안내", "#main-content", "JoinCompanyStatusGuide", "content",
                        Arrays.asList("join-company-status-guide-start"), "조회 전 본인확인 및 조회 조건 안내를 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-status-guide-start", "현황 조회 시작", "click", "goSearchPage", "#main-content button",
                        Arrays.asList("route.join.company-status"), "가입 현황 검색 페이지로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Collections.emptyList());
        page.put("commonCodeGroups", Collections.emptyList());
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyStatusDetailPage() {
        Map<String, Object> page = pageOption("join-company-status-detail", "회원사 가입 현황 상세", "/join/companyJoinStatusDetail", "HMENU_JOIN_COMP_STAT_DETAIL", "join");
        page.put("summary", "회원사 가입 신청 상세 상태, 첨부 파일, 반려 사유와 재신청 진입을 제공하는 상세 조회 화면입니다.");
        page.put("source", "frontend/src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-status-detail-summary", "가입 현황 요약 카드", "#main-content .bg-white.border.border-gray-200.rounded-xl.shadow-sm.overflow-hidden", "JoinCompanyStatusDetailSummary", "content",
                        Arrays.asList("join-company-status-detail-load"), "기관명, 사업자번호, 대표자명, 신청일, 신청번호를 보여줍니다."),
                surface("join-company-status-detail-timeline", "상태 타임라인", "#main-content .bg-white.border.border-gray-200.rounded-xl.shadow-sm.p-10", "JoinCompanyStatusTimeline", "content",
                        Collections.emptyList(), "신청 완료, 검토, 승인/반려 상태를 시각화합니다."),
                surface("join-company-status-detail-files", "첨부 파일 목록", "#main-content ul.divide-y.divide-gray-100", "JoinCompanyStatusFiles", "content",
                        Arrays.asList("join-company-status-file-download"), "첨부 파일 목록과 다운로드 액션을 제공합니다."),
                surface("join-company-status-detail-actions", "상세 하단 액션", "#main-content .flex.items-center.justify-center.gap-4", "JoinCompanyStatusActions", "actions",
                        Arrays.asList("join-company-status-back", "join-company-status-reapply", "join-company-status-home"), "뒤로가기, 재신청, 홈 이동 액션을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-status-detail-load", "가입 현황 상세 조회", "load", "fetchJoinCompanyStatusDetail", "#main-content",
                        Arrays.asList("join.company-status.detail"), "조회 조건 기준 상세 상태와 첨부 목록을 불러옵니다."),
                event("join-company-status-file-download", "첨부 파일 다운로드", "click", "navigate", "#main-content ul button",
                        Arrays.asList("route.join.company-status.file-download"), "기관 첨부 파일 다운로드 경로로 이동합니다."),
                event("join-company-status-back", "상세 뒤로가기", "click", "window.history.back", "#main-content button",
                        Collections.emptyList(), "이전 화면으로 돌아갑니다."),
                event("join-company-status-reapply", "반려 재신청 이동", "click", "navigate", "#main-content button",
                        Arrays.asList("route.join.company-reapply"), "반려된 신청을 재신청 화면으로 넘깁니다."),
                event("join-company-status-home", "상세 홈 이동", "click", "goHome", "#main-content button",
                        Arrays.asList("route.home"), "홈 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-company-status-schema", "회원사 가입 상태 스키마", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "INSTT_NM", "BIZRNO", "REPRSNT_NM", "INSTT_STTUS", "RJCT_RSN", "LAST_UPDT_PNTTM"), Arrays.asList("SELECT"),
                        "회원사 가입 상세 상태와 반려 사유를 조회합니다."),
                schema("join-company-file-schema", "회원사 첨부 스키마", "COMTNINSTTFILE",
                        Arrays.asList("FILE_ID", "ORIGNL_FILE_NM", "STRE_FILE_NM"), Arrays.asList("SELECT"),
                        "상세 상태 화면의 첨부 파일 목록을 구성합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_STATUS", "회원사 가입 상태", Arrays.asList("A", "P", "R", "X"), "검토중, 승인, 반려, 차단 상태 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompanyReapplyPage() {
        Map<String, Object> page = pageOption("join-company-reapply", "회원사 재신청", "/join/companyReapply", "HMENU_JOIN_COMPANY_REAPPLY", "join");
        page.put("summary", "반려된 회원사 신청 정보를 불러와 수정 후 재신청하는 화면입니다.");
        page.put("source", "frontend/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-company-reapply-lookup", "재신청 대상 조회", "#lookup-bizNo", "JoinCompanyReapplyLookup", "actions",
                        Arrays.asList("join-company-reapply-load"), "사업자등록번호와 대표자명으로 기존 신청을 조회합니다."),
                surface("join-company-reapply-form", "재신청 수정 폼", "#main-content .space-y-12", "JoinCompanyReapplyForm", "content",
                        Arrays.asList("join-company-reapply-address-search", "join-company-reapply-submit"), "기존 신청 정보를 수정합니다."),
                surface("join-company-reapply-files", "재신청 첨부 업로드", "#main-content .join-upload-row", "JoinCompanyReapplyFiles", "content",
                        Arrays.asList("join-company-reapply-file-add", "join-company-reapply-file-remove"), "증빙 파일을 다시 업로드합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-company-reapply-load", "재신청 대상 조회", "click", "handleLookup", "#main-content button",
                        Arrays.asList("join.company-reapply.page"), "기존 반려 신청을 불러옵니다."),
                event("join-company-reapply-address-search", "주소 검색", "click", "openAddressSearch", "#main-content button",
                        Collections.emptyList(), "주소 검색 위젯을 실행합니다."),
                event("join-company-reapply-file-add", "파일 행 추가", "click", "addFileRow", "#main-content .join-upload-add-btn",
                        Collections.emptyList(), "재신청 첨부 행을 추가합니다."),
                event("join-company-reapply-file-remove", "파일 행 제거", "click", "removeFileRow", "#main-content .join-upload-remove-btn",
                        Collections.emptyList(), "재신청 첨부 행을 제거합니다."),
                event("join-company-reapply-submit", "재신청 제출", "click", "handleSubmit", "#main-content button",
                        Arrays.asList("join.company-reapply.submit"), "수정된 정보와 첨부 파일로 재신청을 제출합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-company-register-schema", "회원사 등록 스키마", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "INSTT_NM", "BIZRNO", "REPRSNT_NM", "ZIP", "ADRES", "DETAIL_ADRES", "CHARGER_NM", "CHARGER_EMAIL", "CHARGER_TEL"), Arrays.asList("SELECT", "UPDATE"),
                        "반려된 회원사 정보를 수정 저장합니다."),
                schema("join-company-file-schema", "회원사 첨부 스키마", "COMTNINSTTFILE",
                        Arrays.asList("ATCH_FILE_ID", "FILE_SN", "ORIGNL_FILE_NM", "FILE_STRE_COURS"), Arrays.asList("SELECT", "INSERT", "DELETE"),
                        "재신청 첨부 파일을 다시 관리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_STATUS", "회원사 가입 상태", Arrays.asList("A", "P", "R", "X"), "가입 현황 및 재신청 상태 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinTermsPage() {
        Map<String, Object> page = pageOption("join-terms", "약관 동의", "/join/step2", "HMENU_JOIN_STEP2", "join");
        page.put("summary", "필수 약관과 마케팅 동의를 저장하고 다음 단계로 이동하는 가입 2단계 화면입니다.");
        page.put("source", "frontend/src/features/join-wizard/JoinTermsMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-step2-all-agree", "전체 동의 박스", "[data-help-id=\"join-step2-all-agree\"]", "JoinTermsAllAgree", "content",
                        Arrays.asList("join-terms-toggle-all"), "필수 약관 전체 동의를 제어합니다."),
                surface("join-step2-required-terms", "필수 약관 목록", "[data-help-id=\"join-step2-required-terms\"]", "JoinRequiredTerms", "content",
                        Arrays.asList("join-terms-submit"), "필수 약관 동의 항목을 보여줍니다."),
                surface("join-step2-marketing", "마케팅 동의", "[data-help-id=\"join-step2-marketing\"]", "JoinMarketingConsent", "content",
                        Arrays.asList("join-terms-marketing-save"), "선택 마케팅 수신 여부를 저장합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-terms-toggle-all", "전체 약관 동의", "change", "setAgreeTerms / setAgreePrivacy", "[data-help-id=\"join-step2-all-agree\"] input",
                        Collections.emptyList(), "전체 약관 체크 상태를 변경합니다."),
                event("join-terms-marketing-save", "마케팅 동의 저장", "change", "handleMarketingChange", "[data-help-id=\"join-step2-marketing\"] input",
                        Arrays.asList("join.step2.save"), "마케팅 동의 상태를 저장합니다."),
                event("join-terms-submit", "약관 동의 다음 단계", "submit", "handleNext", "[data-help-id=\"join-step2-required-terms\"] form",
                        Arrays.asList("join.step2.save", "route.join.step3"), "필수 약관 동의를 검증하고 다음 단계로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-session-schema", "가입 세션 모델", "HTTP_SESSION",
                        Arrays.asList("marketingYn", "step", "joinVO"), Arrays.asList("SESSION_WRITE"),
                        "가입 2단계 상태를 세션에 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_STEP", "가입 단계", Arrays.asList("STEP2", "STEP3"), "가입 단계 진행 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinAuthPage() {
        Map<String, Object> page = pageOption("join-auth", "본인 확인", "/join/step3", "HMENU_JOIN_STEP3", "join");
        page.put("summary", "본인인증 수단을 선택하고 가입 4단계로 진입하는 사용자 가입 3단계 화면입니다.");
        page.put("source", "frontend/src/features/join-wizard/JoinAuthMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-step3-methods", "본인확인 수단 선택", "[data-help-id=\"join-step3-methods\"]", "JoinAuthMethodGrid", "content",
                        Arrays.asList("join-auth-select-method"), "원패스, 공동인증서, 금융인증서, 간편인증, 이메일 인증 수단을 선택합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-auth-select-method", "본인확인 수단 선택", "click", "handleAuth", "[data-help-id=\"join-step3-methods\"] button",
                        Arrays.asList("join.step3.save", "route.join.step4"), "선택한 본인확인 수단을 저장하고 다음 단계로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-session-schema", "가입 세션 모델", "HTTP_SESSION",
                        Arrays.asList("verifiedIdentity", "authMethod", "step"), Arrays.asList("SESSION_WRITE"),
                        "가입 본인확인 상태를 세션에 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_AUTH_METHOD", "가입 본인확인 수단", Arrays.asList("ONEPASS", "JOINT", "FINANCIAL", "SIMPLE", "EMAIL"), "가입 3단계 인증 수단 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinCompletePage() {
        Map<String, Object> page = pageOption("join-complete", "가입 완료", "/join/step5", "HMENU_JOIN_STEP5", "join");
        page.put("summary", "가입 완료 결과와 신청자 정보를 보여주고 홈으로 이동시키는 최종 단계 화면입니다.");
        page.put("source", "frontend/src/features/join-wizard/JoinCompleteMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-step5-summary", "가입 완료 요약", "[data-help-id=\"join-step5-summary\"]", "JoinCompleteSummary", "content",
                        Collections.emptyList(), "신청 완료 메시지와 신청자 정보를 보여줍니다."),
                surface("join-step5-actions", "가입 완료 액션", "[data-help-id=\"join-step5-actions\"]", "JoinCompleteActions", "actions",
                        Arrays.asList("join-complete-home"), "홈으로 이동 액션을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-complete-home", "가입 완료 후 홈 이동", "click", "handleHome", "[data-help-id=\"join-step5-actions\"] button",
                        Arrays.asList("join.session.reset", "route.home"), "가입 세션을 정리하고 홈으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-session-schema", "가입 완료 세션 모델", "HTTP_SESSION",
                        Arrays.asList("mberId", "mberNm", "insttNm"), Arrays.asList("SESSION_READ", "SESSION_DELETE"),
                        "가입 완료 표시용 사용자 정보를 읽고 세션을 정리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_RESULT", "가입 결과", Arrays.asList("SUBMITTED", "APPROVED"), "가입 완료 상태 구분입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildJoinInfoPage() {
        Map<String, Object> page = pageOption("join-info", "정보 입력", "/join/step4", "HMENU_JOIN_STEP4", "join");
        page.put("summary", "사용자 정보, 기관 정보, 증빙 파일을 입력하고 가입 신청을 완료하는 가입 4단계 화면입니다.");
        page.put("source", "frontend/src/features/join-wizard/JoinInfoMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-step4-user", "사용자 정보 입력", "[data-help-id=\"join-step4-user\"]", "JoinUserInfoForm", "content",
                        Arrays.asList("join-info-id-check", "join-info-email-check", "join-info-address-search"), "아이디, 비밀번호, 연락처, 이메일, 주소를 입력합니다."),
                surface("join-step4-org", "기관 정보 입력", "[data-help-id=\"join-step4-org\"]", "JoinOrganizationForm", "content",
                        Arrays.asList("join-info-company-search-open"), "기관명, 사업자번호, 대표자, 부서 정보를 입력합니다."),
                surface("join-step4-files", "증빙 파일 업로드", "[data-help-id=\"join-step4-files\"]", "JoinFileUploadSection", "content",
                        Arrays.asList("join-info-file-add", "join-info-file-remove"), "증빙 첨부를 추가하거나 삭제합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-info-id-check", "아이디 중복 확인", "click", "handleCheckId", "[data-help-id=\"join-step4-user\"] button",
                        Arrays.asList("join.step4.check-id"), "입력한 가입 아이디의 중복 여부를 확인합니다."),
                event("join-info-email-check", "이메일 중복 확인", "click", "handleCheckEmail", "[data-help-id=\"join-step4-user\"] button",
                        Arrays.asList("join.step4.check-email"), "입력한 이메일 주소의 중복 여부를 확인합니다."),
                event("join-info-address-search", "주소 검색", "click", "openAddressSearch", "[data-help-id=\"join-step4-user\"] button",
                        Collections.emptyList(), "외부 주소 검색 위젯을 열어 우편번호와 주소를 채웁니다."),
                event("join-info-company-search-open", "기관 검색 모달 열기", "click", "handleOpenCompanySearch", "[data-help-id=\"join-step4-org\"] button",
                        Arrays.asList("join.step4.company-search"), "기관 검색 모달을 열고 기관 후보를 조회합니다."),
                event("join-info-file-add", "증빙 파일 행 추가", "click", "addFileRow", "[data-help-id=\"join-step4-files\"] .join-upload-add-btn",
                        Collections.emptyList(), "추가 업로드 행을 생성합니다."),
                event("join-info-file-remove", "증빙 파일 행 제거", "click", "removeFileRow", "[data-help-id=\"join-step4-files\"] .join-upload-remove-btn",
                        Collections.emptyList(), "선택한 업로드 행을 제거합니다."),
                event("join-info-submit", "가입 신청 제출", "submit", "handleSubmit", ".join-step4-screen form",
                        Arrays.asList("join.step4.submit", "route.join.step5"), "입력값과 첨부 파일을 검증한 뒤 가입 신청을 완료합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-member-check-schema", "가입 중복 확인 스키마", "COMVNUSERMASTER",
                        Arrays.asList("USER_ID", "EMAIL_ADRES"), Arrays.asList("SELECT"),
                        "가입 아이디와 이메일 중복 확인에 사용됩니다."),
                schema("join-company-search-schema", "가입 기관 검색 스키마", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "INSTT_NM", "BIZRNO", "CXFC"), Arrays.asList("SELECT"),
                        "기관 검색 모달 결과를 구성합니다."),
                schema("join-step4-schema", "가입 신청 스키마", "COMVNUSERMASTER / COMTNINSTTINFO",
                        Arrays.asList("MBER_ID", "MBER_NM", "PASSWORD", "INSTT_ID", "DEPT_NM", "EMAIL_ADRES", "MOBLPHON_NO"), Arrays.asList("INSERT", "UPDATE"),
                        "가입 신청 사용자와 기관 연계 정보를 저장합니다."),
                schema("join-file-schema", "가입 첨부 스키마", "COMTNFILE",
                        Arrays.asList("ATCH_FILE_ID", "FILE_SN", "ORIGNL_FILE_NM", "FILE_STRE_COURS"), Arrays.asList("INSERT"),
                        "가입 증빙 파일 업로드 메타데이터를 저장합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_UPLOAD_TYPE", "가입 첨부 분류", Arrays.asList("BUSINESS_CERT", "EMPLOYMENT_CERT"), "가입 첨부 분류 코드입니다."),
                codeGroup("JOIN_STEP", "가입 단계", Arrays.asList("STEP4", "STEP5"), "가입 정보 입력과 완료 단계 구분입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMypagePage() {
        Map<String, Object> page = pageOption("mypage", "마이페이지", "/mypage", "HMENU_MYPAGE", "home");
        page.put("summary", "기본 정보, 기관 정보, 인증 연동 상태를 조회/수정하는 사용자 마이페이지 화면입니다.");
        page.put("source", "frontend/src/features/mypage/MypageMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("mypage-basic-info", "기본 정보 폼", "[data-help-id=\"mypage-basic-info\"]", "MypageBasicInfoForm", "content",
                        Arrays.asList("mypage-email-verify", "mypage-save"), "이름, 이메일, 연락처를 수정합니다."),
                surface("mypage-org-info", "기관 정보", "[data-help-id=\"mypage-org-info\"]", "MypageOrgInfoForm", "content",
                        Arrays.asList("mypage-save"), "기관명, 사업자번호, 직책을 보여줍니다."),
                surface("mypage-actions", "마이페이지 저장 액션", "[data-help-id=\"mypage-actions\"]", "MypageActions", "actions",
                        Arrays.asList("mypage-cancel", "mypage-save"), "취소와 저장 액션을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("mypage-email-verify", "이메일 변경 인증", "click", "handleEmailVerify", "[data-help-id=\"mypage-basic-info\"] button",
                        Arrays.asList("mypage.email.verify"), "이메일 변경 인증을 요청합니다."),
                event("mypage-cancel", "마이페이지 수정 취소", "click", "handleCancel", "[data-help-id=\"mypage-actions\"] .secondary",
                        Collections.emptyList(), "입력값을 초기 상태로 되돌립니다."),
                event("mypage-save", "마이페이지 저장", "submit", "handleSubmit", "[data-help-id=\"mypage-actions\"] .primary",
                        Arrays.asList("mypage.save"), "수정된 사용자 정보를 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("mypage-schema", "마이페이지 사용자 스키마", "COMVNUSERMASTER",
                        Arrays.asList("USER_ID", "USER_NM", "EMAIL_ADRES", "AREA_NO", "MIDDLE_TELNO", "END_TELNO", "OFCPS_NM"),
                        Arrays.asList("SELECT", "UPDATE"), "마이페이지 기본/기관 정보 저장에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("MYPAGE_AUTH_STATUS", "마이페이지 인증 연동 상태", Arrays.asList("CONNECTED", "DISCONNECTED"), "인증 연동 배지 상태입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAuthChangePage() {
        Map<String, Object> page = pageOption("auth-change", "권한 변경", "/admin/member/auth-change", "AMENU_AUTH_CHANGE", "admin");
        page.put("summary", "관리자별 권한 그룹을 행 단위로 변경하는 운영 화면입니다.");
        page.put("source", "frontend/src/features/auth-change/AuthChangeMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("auth-change-summary", "권한 변경 요약", "[data-help-id=\"auth-change-summary\"]", "AuthChangeSummary", "actions",
                        Collections.emptyList(), "현재 로그인 사용자와 변경 대상 수를 보여줍니다."),
                surface("auth-change-table", "권한 변경 테이블", "[data-help-id=\"auth-change-table\"]", "AuthChangeTable", "content",
                        Arrays.asList("auth-change-page-load", "auth-change-save"), "행별 권한 그룹 선택과 저장을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("auth-change-page-load", "권한 변경 화면 조회", "load", "fetchAuthChangePage", "[data-help-id=\"auth-change-table\"]",
                        Arrays.asList("admin.auth-change.page"), "관리자 권한 변경 대상 목록과 권한 그룹 목록을 조회합니다."),
                event("auth-change-save", "권한 변경 저장", "click", "handleSave", "[data-help-id=\"auth-change-table\"] .primary-button",
                        Arrays.asList("admin.auth-change.save"), "선택한 관리자 권한 그룹을 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("admin-auth-change-schema", "관리자 권한 변경 스키마", "COMTNEMPLYRSCRTYESTBS",
                        Arrays.asList("EMPLYR_ID", "AUTHOR_CODE"), Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "관리자 계정별 권한 그룹 매핑을 저장합니다."),
                schema("author-group-schema", "권한 그룹 스키마", "COMTNAUTHORINFO",
                        Arrays.asList("AUTHOR_CODE", "AUTHOR_NM"), Arrays.asList("SELECT"), "권한 그룹 선택 목록입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EMP_STATUS", "관리자 상태", Arrays.asList("P", "D", "X"), "관리자 상태 표시값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildDeptRolePage() {
        Map<String, Object> page = pageOption("dept-role", "부서 권한 맵핑", "/admin/member/dept-role-mapping", "AMENU_DEPT_ROLE", "admin");
        page.put("summary", "회사별 부서 기본 권한과 회원 권한을 함께 관리하는 운영 화면입니다.");
        page.put("source", "frontend/src/features/dept-role-mapping/DeptRoleMappingMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("dept-role-company", "회사 선택", "[data-help-id=\"dept-role-company\"]", "DeptRoleCompanySelector", "actions",
                        Arrays.asList("dept-role-page-load"), "대상 회사 범위를 선택합니다."),
                surface("dept-role-departments", "부서 권한 목록", "[data-help-id=\"dept-role-departments\"]", "DeptRoleDepartmentTable", "content",
                        Arrays.asList("dept-role-dept-save"), "부서별 기본 권한 그룹을 저장합니다."),
                surface("dept-role-members", "회원 권한 목록", "[data-help-id=\"dept-role-members\"]", "DeptRoleMemberTable", "content",
                        Arrays.asList("dept-role-member-save"), "회사 소속 회원의 권한 그룹을 저장합니다."),
                surface("dept-role-role-profile", "권한 그룹 프로필 미리보기", "[data-help-id=\"dept-role-role-profile\"]", "DeptRoleRoleProfilePreview", "content",
                        Collections.emptyList(), "선택된 권한 그룹이 회원 수정 화면에서 어떤 업무 역할과 우선 제공 업무로 보일지 미리 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("dept-role-page-load", "부서 권한 화면 조회", "change", "fetchDeptRolePage", "[data-help-id=\"dept-role-company\"] select",
                        Arrays.asList("admin.dept-role.page"), "선택 회사 기준 부서/회원 권한 목록을 조회합니다."),
                event("dept-role-dept-save", "부서 권한 저장", "click", "handleDeptSave", "[data-help-id=\"dept-role-departments\"] .primary-button",
                        Arrays.asList("admin.dept-role.save"), "부서 기본 권한 그룹을 저장합니다."),
                event("dept-role-member-save", "회원 권한 저장", "click", "handleMemberSave", "[data-help-id=\"dept-role-members\"] .primary-button",
                        Arrays.asList("admin.dept-role.member-save"), "회사 소속 회원 권한 그룹을 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("dept-role-schema", "부서 권한 스키마", "COMTNDEPTAUTHORRELATE",
                        Arrays.asList("INSTT_ID", "DEPT_NM", "AUTHOR_CODE"), Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "회사별 부서 기본 권한 그룹을 저장합니다."),
                schema("member-author-schema", "회원 권한 스키마", "COMTNENTRPRSMBERAUTHORRELATE",
                        Arrays.asList("ENTRPRS_MBER_ID", "AUTHOR_CODE", "INSTT_ID"), Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "회사 회원 권한 그룹을 저장합니다."),
                schema("author-role-profile-schema", "권한 그룹 프로필 스키마", "data/author-role-profiles/profiles.json",
                        Arrays.asList("authorCode", "displayTitle", "priorityWorks", "description", "memberEditVisibleYn", "updatedAt"),
                        Arrays.asList("SELECT"),
                        "권한 그룹 프로필 미리보기 데이터에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("COMPANY_SCOPE", "회사 관리 범위", Arrays.asList("ALL", "OWN"), "전체 회사 또는 자기 회사 관리 범위입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAdminListPage() {
        Map<String, Object> page = pageOption("admin-list", "관리자 목록", "/admin/member/admin_list", "AMENU_ADMIN_LIST", "admin");
        page.put("summary", "관리자 계정 검색, 상세/수정 이동, 엑셀 다운로드를 제공하는 운영 목록 화면입니다.");
        page.put("source", "frontend/src/features/admin-list/AdminListMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("admin-list-search", "관리자 검색", "[data-help-id=\"admin-list-search\"]", "AdminListSearchForm", "actions",
                        Arrays.asList("admin-list-search-submit"), "상태와 검색어로 관리자 계정을 조회합니다."),
                surface("admin-list-table", "관리자 목록 테이블", "[data-help-id=\"admin-list-table\"]", "AdminListTable", "content",
                        Arrays.asList("admin-list-page-load", "admin-list-move-permission"), "목록 페이징과 수정/상세 이동을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("admin-list-search-submit", "관리자 목록 조회", "submit", "load", "[data-help-id=\"admin-list-search\"] form",
                        Arrays.asList("admin.member.admin-list.page"), "검색 조건으로 관리자 목록을 조회합니다."),
                event("admin-list-page-load", "관리자 목록 페이지 이동", "click", "load", "[data-help-id=\"admin-list-table\"] nav button",
                        Arrays.asList("admin.member.admin-list.page"), "페이지 번호와 검색 조건으로 목록을 다시 조회합니다."),
                event("admin-list-move-permission", "관리자 권한 상세 이동", "click", "navigate", "[data-help-id=\"admin-list-table\"] a",
                        Arrays.asList("route.admin.member.admin-permission"), "관리자 권한 상세/수정 화면으로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("admin-list-schema", "관리자 목록 스키마", "COMTNEMPLYRINFO",
                        Arrays.asList("EMPLYR_ID", "USER_NM", "ORGNZT_ID", "EMAIL_ADRES", "EMPLYR_STTUS_CODE"),
                        Arrays.asList("SELECT"), "관리자 계정 목록 조회에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("ADMIN_STATUS", "관리자 상태", Arrays.asList("P", "A", "R", "D", "X"), "관리자 목록 상태 배지에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMemberListPage() {
        Map<String, Object> page = pageOption("member-list", "회원 목록", "/admin/member/list", "AMENU_MEMBER_LIST", "admin");
        page.put("summary", "회원 목록 검색, 상태 필터, 상세 이동, 승인 연계가 집중되는 관리자 목록 화면입니다.");
        page.put("source", "frontend/src/features/member-list/MemberListMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("member-search-form", "검색 폼", "[data-help-id=\"member-search-form\"]", "MemberSearchForm", "actions",
                        Arrays.asList("member-search-submit", "member-search-reset"), "검색어, 회원유형, 상태 필터를 조합합니다."),
                surface("member-table", "회원 목록 테이블", "[data-help-id=\"member-table\"]", "MemberTable", "content",
                        Arrays.asList("member-row-detail", "member-row-approve"), "행 단위 상세 진입과 승인 화면 연결을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("member-search-submit", "목록 조회", "submit", "handleSearch", "[data-help-id=\"member-list-search\"]",
                        Arrays.asList("admin.member.list.page"), "검색 조건으로 회원 목록을 다시 조회합니다."),
                event("member-search-reset", "검색 초기화", "click", "handleResetFilters", "[data-help-id=\"member-list-search\"] button[type=\"reset\"]",
                        Collections.emptyList(), "입력값을 초기화한 뒤 기본 조건으로 복귀합니다."),
                event("member-row-detail", "상세 보기", "click", "handleMoveDetail", "[data-help-id=\"member-table\"] [data-action=\"detail\"]",
                        Arrays.asList("route.admin.member.detail"), "선택한 회원 상세 화면으로 이동합니다."),
                event("member-row-approve", "승인 화면 이동", "click", "handleMoveApprove", "[data-help-id=\"member-table\"] [data-action=\"approve\"]",
                        Arrays.asList("route.admin.member.approve"), "회원 승인/반려 흐름으로 이어집니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("member-list-query", "회원 목록 조회 모델", "COMTNENTRPRSMBER",
                        Arrays.asList("ENTRPRS_MBER_ID", "APPLCNT_NM", "SBSCRB_STTUS", "MBER_TY_CODE", "CMPNY_NM"),
                        Arrays.asList("SELECT"), "회원 상태/유형/기업명 조회에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("AMENU_MEMBER_LIST", "AMENU_MEMBER_DETAIL", "A0010103"),
                        "메뉴/페이지 기능 권한 연결에 사용됩니다."),
                codeGroup("MEMBER_STATUS", "회원 상태", Arrays.asList("신청", "승인", "반려", "재신청"),
                        "목록 필터와 상태 배지에 반영됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildCompanyListPage() {
        Map<String, Object> page = pageOption("company-list", "회원사 목록", "/admin/member/company_list", "AMENU_COMPANY_LIST", "admin");
        page.put("summary", "회원사 목록 검색, 상태 필터, 상세 이동이 집중되는 관리자 회원사 목록 화면입니다.");
        page.put("source", "frontend/src/features/company-list/CompanyListMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("company-list-search-form", "회원사 검색 폼", "[data-help-id=\"company-list-search\"]", "CompanyListSearchForm", "actions",
                        Collections.singletonList("company-list-search-submit"), "검색어와 상태 필터로 회원사 목록을 조회합니다."),
                surface("company-list-table", "회원사 목록 테이블", "[data-help-id=\"company-list-table\"]", "CompanyListTable", "content",
                        Arrays.asList("company-list-row-detail", "company-list-export"), "행 단위 상세 이동과 엑셀 내보내기를 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("company-list-search-submit", "회원사 목록 조회", "submit", "handleSearch", "[data-help-id=\"company-list-search\"] form",
                        Arrays.asList("admin.member.company-list.page"), "검색 조건으로 회원사 목록을 다시 조회합니다."),
                event("company-list-row-detail", "회원사 상세 이동", "click", "handleMoveDetail", "[data-help-id=\"company-list-table\"] [data-action=\"detail\"]",
                        Arrays.asList("route.admin.member.company-detail"), "선택한 회원사 상세 화면으로 이동합니다."),
                event("company-list-export", "회원사 엑셀 다운로드", "click", "handleExportExcel", "[data-help-id=\"company-list-search\"] a[href*=\"company_list/excel\"]",
                        Arrays.asList("route.admin.member.company-list-excel"), "현재 조건으로 회원사 목록 엑셀을 내려받습니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("company-list-query", "회원사 목록 조회 모델", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "CMPNY_NM", "BIZRNO", "RPRSNTV_NM", "SBSCRB_STTUS"),
                        Arrays.asList("SELECT"), "회원사 상태/기관명/대표자 조회에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("AMENU_COMPANY_LIST", "AMENU_COMPANY_DETAIL"),
                        "회원사 목록/상세 메뉴 권한 연결에 사용됩니다."),
                codeGroup("COMPANY_STATUS", "회원사 상태", Arrays.asList("P", "A", "R", "D", "X"),
                        "회원사 목록 상태 필터와 상태 배지에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMemberDetailPage() {
        Map<String, Object> page = pageOption("member-detail", "회원 상세", "/admin/member/detail", "AMENU_MEMBER_DETAIL", "admin");
        page.put("summary", "회원 기본정보, 상태, 비밀번호 초기화 이력, 수정 화면 연결을 관리하는 상세 화면입니다.");
        page.put("source", "frontend/src/features/member-detail/MemberDetailMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("member-detail-lookup", "회원 조회", "[data-help-id=\"member-detail-lookup\"]", "MemberLookup", "actions",
                        Arrays.asList("member-detail-load"), "회원 ID를 기준으로 상세를 조회합니다."),
                surface("member-detail-summary", "회원 요약 카드", "[data-help-id=\"member-detail-summary\"]", "MemberProfileCard", "content",
                        Arrays.asList("member-detail-edit"), "상태, 유형, 연락처와 수정 진입점을 제공합니다."),
                surface("member-detail-history", "비밀번호 초기화 이력", "[data-help-id=\"member-detail-history\"]", "PasswordResetHistory", "content",
                        Arrays.asList("member-detail-reset-history"), "최근 비밀번호 초기화 이력을 노출합니다.")
        ));
        page.put("events", Arrays.asList(
                event("member-detail-load", "상세 조회", "submit", "handleLookupMember", "[data-help-id=\"member-detail-lookup\"] form",
                        Arrays.asList("admin.member.detail.page"), "회원 상세 payload를 다시 불러옵니다."),
                event("member-detail-edit", "회원 수정 이동", "click", "handleMoveEdit", "[data-help-id=\"member-detail-summary\"] [data-action=\"edit\"]",
                        Arrays.asList("route.admin.member.edit"), "수정 화면으로 이동합니다."),
                event("member-detail-reset-history", "초기화 이력 조회", "load", "loadPasswordResetHistory", "[data-help-id=\"member-detail-history\"]",
                        Arrays.asList("admin.member.detail.page"), "상세 payload 내 초기화 이력을 함께 조회합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("member-detail-schema", "회원 상세 모델", "COMTNENTRPRSMBER",
                        Arrays.asList("ENTRPRS_MBER_ID", "APPLCNT_NM", "EMAIL_ADRES", "MBER_TY_CODE", "SBSCRB_STTUS"),
                        Arrays.asList("SELECT", "UPDATE"), "상세/수정/권한 변경 흐름이 함께 참조합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("MEMBER_TYPE", "회원 유형", Arrays.asList("개인", "기업", "기관"), "회원 유형 라벨과 액션 노출에 사용됩니다."),
                codeGroup("MEMBER_STATUS", "회원 상태", Arrays.asList("신청", "승인", "반려", "휴면"), "상태 배지/버튼 활성화 조건에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildCompanyApprovePage() {
        Map<String, Object> page = pageOption("company-approve", "회원사 승인", "/admin/member/company-approve", "A0010202", "admin");
        page.put("summary", "회원사 승인 검색, 일괄 처리, 행 단위 승인과 반려를 관리하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/company-approve/CompanyApproveMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("company-approve-search", "승인 대상 검색", "[data-help-id=\"company-approve-search\"]", "CompanyApprovalFilter", "actions",
                        Arrays.asList("company-approve-search-submit"), "상태와 검색어 기준으로 승인 대상을 조회합니다."),
                surface("company-approve-batch-actions", "일괄 승인/반려", "[data-help-id=\"company-approve-batch-actions\"]", "CompanyApprovalBatchActions", "actions",
                        Arrays.asList("company-approve-batch-approve", "company-approve-batch-reject"), "선택한 기관을 일괄 승인 또는 반려합니다."),
                surface("company-approve-table", "회원사 승인 목록", "[data-help-id=\"company-approve-table\"]", "CompanyApprovalTable", "content",
                        Arrays.asList("company-approve-row-review", "company-approve-row-approve", "company-approve-row-reject"), "기관 기본정보와 첨부 서류를 검토하고 개별 처리합니다.")
        ));
        page.put("events", Arrays.asList(
                event("company-approve-search-submit", "회원사 승인 목록 조회", "click", "applyFilters", "[data-help-id=\"company-approve-search\"] button",
                        Arrays.asList("admin.member.company-approve.page"), "검색 조건으로 회원사 승인 목록을 다시 조회합니다."),
                event("company-approve-batch-approve", "선택 회원사 승인", "click", "handleAction", "[data-help-id=\"company-approve-batch-actions\"] button",
                        Arrays.asList("admin.member.company-approve.action"), "선택한 회원사를 일괄 승인합니다."),
                event("company-approve-batch-reject", "선택 회원사 반려", "click", "handleAction", "[data-help-id=\"company-approve-batch-actions\"] button",
                        Arrays.asList("admin.member.company-approve.action"), "선택한 회원사를 일괄 반려합니다."),
                event("company-approve-row-review", "회원사 상세 검토", "click", "setReviewInsttId", "[data-help-id=\"company-approve-table\"] button",
                        Collections.emptyList(), "선택한 회원사 행의 상세 검토 패널을 엽니다."),
                event("company-approve-row-approve", "회원사 개별 승인", "click", "handleAction", "[data-help-id=\"company-approve-table\"] button",
                        Arrays.asList("admin.member.company-approve.action"), "개별 회원사 승인 상태를 저장합니다."),
                event("company-approve-row-reject", "회원사 개별 반려", "click", "handleAction", "[data-help-id=\"company-approve-table\"] button",
                        Arrays.asList("admin.member.company-approve.action"), "개별 회원사 반려 상태를 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("company-approve-schema", "회원사 승인 모델", "COMTNINSTTINFO / COMTNINSTTFILE",
                        Arrays.asList("INSTT_ID", "INSTT_NM", "BIZRNO", "REPRSNT_NM", "INSTT_STTUS"),
                        Arrays.asList("SELECT", "UPDATE"), "회원사 가입 승인 상태와 제출 서류를 함께 관리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("INSTT_STATUS", "회원사 상태", Arrays.asList("A", "P", "R", "X"), "회원사 승인 상태 필터와 배지에 사용됩니다."),
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0010202", "AMENU_COMPANY_ACCOUNT"), "회원사 승인과 수정 화면 연결에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildCompanyDetailPage() {
        Map<String, Object> page = pageOption("company-detail", "기관 상세", "/admin/member/company_detail", "AMENU_COMPANY_DETAIL", "admin");
        page.put("summary", "기관 정보, 상태, 첨부파일, 담당자 정보를 함께 보는 상세 화면입니다.");
        page.put("source", "frontend/src/features/company-detail/CompanyDetailMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("company-detail-lookup", "기관 조회", "[data-help-id=\"company-detail-lookup\"]", "CompanyLookup", "actions",
                        Arrays.asList("company-detail-load"), "기관 ID 또는 사업자번호 기준으로 조회합니다."),
                surface("company-detail-summary", "기관 요약", "[data-help-id=\"company-detail-summary\"]", "CompanySummaryCard", "content",
                        Arrays.asList("company-detail-edit"), "기관 상태, 대표자, 담당자, 주소를 보여줍니다."),
                surface("company-detail-files", "첨부 파일 목록", "[data-help-id=\"company-detail-files\"]", "CompanyFilesTable", "content",
                        Arrays.asList("company-file-download"), "기관 증빙 첨부 목록을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("company-detail-load", "기관 상세 조회", "submit", "handleLookupCompany", "[data-help-id=\"company-detail-lookup\"] form",
                        Arrays.asList("admin.member.company-detail.page"), "기관 정보와 첨부 목록을 조회합니다."),
                event("company-detail-edit", "기관 수정 이동", "click", "handleMoveCompanyEdit", "[data-help-id=\"company-detail-summary\"] [data-action=\"edit\"]",
                        Arrays.asList("route.admin.member.company-account"), "기관 계정/정보 수정 화면으로 이동합니다."),
                event("company-file-download", "첨부 다운로드", "click", "handleDownloadAttachment", "[data-help-id=\"company-detail-files\"] [data-action=\"download\"]",
                        Arrays.asList("route.file.download"), "등록 첨부 파일을 다운로드합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("company-detail-schema", "기관 상세 모델", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "INSTT_NM", "BIZRNO", "SBSCRB_STTUS", "CHARGER_EMAIL"),
                        Arrays.asList("SELECT", "UPDATE"), "기관 요약, 상태 조회, 관리자 수정에 사용됩니다."),
                schema("company-file-schema", "기관 첨부 모델", "COMTNINSTTFILE",
                        Arrays.asList("ATCH_FILE_ID", "FILE_SN", "ORIGNL_FILE_NM", "FILE_STRE_COURS"),
                        Arrays.asList("SELECT", "INSERT", "DELETE"), "기관 증빙 첨부 관리를 담당합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("JOIN_STATUS", "기관 가입 상태", Arrays.asList("신청", "검토중", "승인", "반려"), "기관 상태 배지와 버튼 노출 기준입니다."),
                codeGroup("FILE_CATEGORY", "첨부 분류", Arrays.asList("사업자등록증", "기관증빙", "기타"), "기관 첨부 라벨 및 검증 규칙입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildCertificatePendingPage() {
        Map<String, Object> page = pageOption("certificate-pending", "인증서 발급 대기 목록", "/admin/certificate/pending_list", "A0020302", "admin");
        page.put("summary", "인증서 발급 신청 건의 수수료 상태, 검토 담당자, SLA, 이의신청 위험을 함께 보는 관리자 대기 큐입니다.");
        page.put("source", "frontend/src/features/certificate-pending/CertificatePendingMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("certificate-pending-summary", "발급 대기 요약", "[data-help-id=\"certificate-pending-summary\"]", "CertificatePendingSummary", "actions",
                        Collections.emptyList(), "검토 대기, 수수료 대기, 이의신청, 마감 임박 건수를 카드로 요약합니다."),
                surface("certificate-pending-search", "발급 대기 검색", "[data-help-id=\"certificate-pending-search\"]", "CertificatePendingFilter", "actions",
                        Arrays.asList("certificate-pending-search-submit"), "인증 유형, 처리 상태, 검색어 기준으로 발급 대기 큐를 조회합니다."),
                surface("certificate-pending-table", "발급 대기 목록", "[data-help-id=\"certificate-pending-table\"]", "CertificatePendingTable", "content",
                        Arrays.asList("certificate-pending-open-review", "certificate-pending-page-change"), "신청번호, 회원사, 수수료 상태, 검토 담당자, SLA를 한 행에서 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("certificate-pending-search-submit", "발급 대기 목록 조회", "click", "setFilters", "[data-help-id=\"certificate-pending-search\"] button",
                        Arrays.asList("admin.certificate.pending.page"), "검색 조건 기준으로 인증서 발급 대기 큐를 다시 조회합니다."),
                event("certificate-pending-open-review", "발급 검토 화면 이동", "click", "navigate", "[data-help-id=\"certificate-pending-table\"] a",
                        Arrays.asList("route.admin.certificate.review"), "선택한 신청 건의 발급 검토 또는 이의신청 화면으로 이동합니다."),
                event("certificate-pending-page-change", "발급 대기 페이지 이동", "click", "setFilters", "[data-help-id=\"certificate-pending-table\"] nav button",
                        Arrays.asList("admin.certificate.pending.page"), "페이지 번호를 바꾸어 같은 조건의 대기 목록을 이어서 조회합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("certificate-pending-schema", "인증서 발급 대기 모델", "sample queue payload",
                        Arrays.asList("applicationId", "companyName", "certificateType", "processStatus", "submittedAt", "reviewerName", "slaDueAt"),
                        Arrays.asList("SELECT"), "인증서 발급 신청 건의 대기 큐와 요약 메트릭에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("CERTIFICATE_TYPE", "인증 유형", Arrays.asList("CCUS", "REPORT", "REC"), "발급 대기 검색 필터와 유형 라벨에 사용됩니다."),
                codeGroup("CERTIFICATE_PROCESS_STATUS", "인증 처리 상태", Arrays.asList("PENDING", "FEE_WAIT", "IN_REVIEW", "OBJECTION"), "발급 대기 상태 배지와 필터에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMemberEditPage() {
        Map<String, Object> page = pageOption("member-edit", "회원 수정", "/admin/member/edit", "AMENU_MEMBER_EDIT", "admin");
        page.put("summary", "회원 기본 정보, 권한 롤/기능, 주소, 증빙 문서를 함께 수정하는 관리자 편집 화면입니다.");
        page.put("source", "frontend/src/features/member-edit/MemberEditMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("member-edit-summary", "회원 수정 요약", "[data-help-id=\"member-edit-summary\"]", "MemberEditSummaryCard", "content",
                        Arrays.asList("member-edit-page-load"), "회원 식별자, 상태, 업무 역할 요약을 보여줍니다."),
                surface("member-edit-role-profile", "권한 그룹 프로필 요약", "[data-help-id=\"member-edit-role-profile\"]", "MemberEditRoleProfileSummary", "content",
                        Arrays.asList("member-edit-page-load"), "기준 권한 그룹에 연결된 업무 역할과 우선 제공 업무 메타데이터를 보여줍니다."),
                surface("member-edit-form", "회원 기본 정보 폼", "[data-help-id=\"member-edit-form\"]", "MemberEditForm", "content",
                        Arrays.asList("member-edit-save"), "이름, 이메일, 연락처, 상태를 수정합니다."),
                surface("member-edit-permissions", "회원 권한 편집", "[data-help-id=\"member-edit-permissions\"]", "MemberEditPermissionMatrix", "content",
                        Arrays.asList("member-edit-feature-toggle", "member-edit-save"), "기준 롤과 개별 기능 추가/제외를 조정합니다."),
                surface("member-edit-address", "회원 주소 편집", "[data-help-id=\"member-edit-address\"]", "MemberEditAddressForm", "content",
                        Arrays.asList("member-edit-save"), "우편번호와 제출 주소를 수정합니다."),
                surface("member-edit-evidence", "회원 증빙 문서", "[data-help-id=\"member-edit-evidence\"]", "MemberEditEvidenceList", "content",
                        Collections.emptyList(), "회원 제출 증빙 문서 목록과 다운로드 링크를 제공합니다."),
                surface("member-edit-actions", "회원 수정 액션", "[data-help-id=\"member-edit-actions\"]", "MemberEditActions", "actions",
                        Arrays.asList("member-edit-open-detail", "member-edit-save"), "상세 화면 이동과 저장을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("member-edit-page-load", "회원 수정 화면 조회", "load", "fetchMemberEditPage", "[data-help-id=\"member-edit-page\"]",
                        Arrays.asList("admin.member.edit.page"), "회원 ID 기준 수정 payload를 조회합니다."),
                event("member-edit-feature-toggle", "회원 기능 권한 토글", "change", "toggleFeature", "[data-help-id=\"member-edit-permissions\"] input[type=\"checkbox\"]",
                        Collections.emptyList(), "회원별 추가/제외 기능을 토글합니다."),
                event("member-edit-open-detail", "회원 상세 이동", "click", "navigate", "[data-help-id=\"member-edit-actions\"] [data-action=\"detail\"]",
                        Arrays.asList("route.admin.member.detail"), "현재 회원의 상세 화면으로 이동합니다."),
                event("member-edit-save", "회원 수정 저장", "click", "handleSave", "[data-help-id=\"member-edit-actions\"] [data-action=\"save\"]",
                        Arrays.asList("admin.member.edit.save"), "회원 기본정보, 권한, 주소 정보를 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("member-edit-schema", "회원 수정 스키마", "COMTNENTRPRSMBER",
                        Arrays.asList("ENTRPRS_MBER_ID", "APPLCNT_NM", "APPLCNT_EMAIL_ADRES", "MBER_TY_CODE", "SBSCRB_STTUS", "DEPT_NM", "ZIP", "ADRES", "DETAIL_ADRES", "MARKETING_YN"),
                        Arrays.asList("SELECT", "UPDATE"), "회원 기본 정보와 상태, 주소를 수정합니다."),
                schema("member-permission-schema", "회원 개별 권한 스키마", "COMTNUSERFEATUREOVERRIDE / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("ENTRPRS_MBER_ID", "AUTHOR_CODE", "FEATURE_CODE", "OVERRIDE_TYPE"),
                        Arrays.asList("SELECT", "INSERT", "DELETE"), "기준 롤과 회원별 기능 추가/제외 권한을 관리합니다."),
                schema("author-role-profile-schema", "권한 그룹 프로필 스키마", "data/author-role-profiles/profiles.json",
                        Arrays.asList("authorCode", "displayTitle", "priorityWorks", "description", "memberEditVisibleYn", "updatedAt"),
                        Arrays.asList("SELECT"),
                        "기준 권한 그룹의 업무 역할과 우선 제공 업무 표시에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("MEMBER_STATUS", "회원 상태", Arrays.asList("신청", "승인", "반려", "휴면"), "회원 상태 드롭다운과 배지에 사용됩니다."),
                codeGroup("MEMBER_TYPE", "회원 유형", Arrays.asList("E", "P", "C", "G"), "회원 유형 선택과 업무 역할 계산에 사용됩니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("member-profile", "회원 기본 정보", Arrays.asList("applcntNm", "applcntEmailAdres", "phoneNumber", "deptNm", "entrprsSeCode", "entrprsMberSttus", "marketingYn"), "회원 프로필과 상태를 수정합니다."),
                changeTarget("member-permissions", "회원 권한", Arrays.asList("authorCode", "featureCodes"), "기준 권한 롤과 기능 override를 조정합니다."),
                changeTarget("member-address", "회원 주소", Arrays.asList("zip", "adres", "detailAdres"), "연락 및 제출 주소를 수정합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildCompanyAccountPage() {
        Map<String, Object> page = pageOption("company-account", "회원사 수정", "/admin/member/company_account", "AMENU_COMPANY_ACCOUNT", "admin");
        page.put("summary", "기관 ID 조회 후 회원사 기본정보, 담당자 정보, 첨부파일을 편집하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/company-account/CompanyAccountMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("company-account-lookup", "회원사 조회", "[data-help-id=\"company-account-lookup\"]", "CompanyAccountLookup", "actions",
                        Arrays.asList("company-account-load"), "기관 ID를 기준으로 회원사 편집 payload를 조회합니다."),
                surface("company-account-membership", "회원 유형 선택", "[data-help-id=\"company-account-membership\"]", "CompanyAccountMembershipCards", "content",
                        Arrays.asList("company-account-save"), "회원사 유형 카드를 선택합니다."),
                surface("company-account-business", "사업자 정보 편집", "[data-help-id=\"company-account-business\"]", "CompanyAccountBusinessForm", "content",
                        Arrays.asList("company-account-save"), "기관명, 대표자명, 사업자등록번호, 주소를 편집합니다."),
                surface("company-account-contact", "담당자 정보 편집", "[data-help-id=\"company-account-contact\"]", "CompanyAccountContactForm", "content",
                        Arrays.asList("company-account-save"), "담당자 이름, 이메일, 연락처를 편집합니다."),
                surface("company-account-files", "증빙 파일 업로드", "[data-help-id=\"company-account-files\"]", "CompanyAccountFileUpload", "content",
                        Arrays.asList("company-account-file-select", "company-account-save"), "신규 증빙 파일을 선택합니다."),
                surface("company-account-file-table", "첨부 파일 목록", "[data-help-id=\"company-account-file-table\"]", "CompanyAccountFileTable", "content",
                        Collections.emptyList(), "저장된 기관 첨부 파일을 확인합니다."),
                surface("company-account-actions", "회원사 저장 액션", "[data-help-id=\"company-account-actions\"]", "CompanyAccountActions", "actions",
                        Arrays.asList("company-account-save"), "목록 복귀 또는 회원사 저장을 실행합니다.")
        ));
        page.put("events", Arrays.asList(
                event("company-account-load", "회원사 수정 화면 조회", "click", "handleLoad", "[data-help-id=\"company-account-lookup\"] [data-action=\"load\"]",
                        Arrays.asList("admin.member.company-account.page"), "기관 ID 기준 회원사 편집 payload를 조회합니다."),
                event("company-account-file-select", "회원사 첨부 선택", "change", "handleFileChange", "[data-help-id=\"company-account-files\"] input[type=\"file\"]",
                        Collections.emptyList(), "업로드 예정 파일 목록을 갱신합니다."),
                event("company-account-save", "회원사 저장", "click", "handleSave", "[data-help-id=\"company-account-actions\"] [data-action=\"save\"]",
                        Arrays.asList("admin.member.company-account.save"), "회원사 기본정보와 첨부 파일을 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("company-account-schema", "회원사 수정 스키마", "COMTNINSTTINFO",
                        Arrays.asList("INSTT_ID", "ENTRPRS_SE_CODE", "INSTT_NM", "REPRSNT_NM", "BIZRNO", "ZIP", "ADRES", "DETAIL_ADRES", "CHARGER_NM", "CHARGER_EMAIL", "CHARGER_TEL"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "회원사 기본정보와 담당자 정보를 저장합니다."),
                schema("company-file-schema", "회원사 첨부 스키마", "COMTNINSTTFILE",
                        Arrays.asList("ATCH_FILE_ID", "FILE_SN", "ORIGNL_FILE_NM", "FILE_EXTSN", "FILE_MG"),
                        Arrays.asList("SELECT", "INSERT"), "회원사 증빙 첨부와 목록 조회를 담당합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("MEMBERSHIP_TYPE", "회원사 유형", Arrays.asList("E", "P", "C", "G"), "회원사 유형 카드와 저장 payload에 사용됩니다."),
                codeGroup("FILE_CATEGORY", "회원사 증빙 분류", Arrays.asList("사업자등록증", "법인 검증 서류"), "회원사 증빙 업로드 정책 분류입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("company-profile", "회원사 기본 정보", Arrays.asList("membershipType", "agencyName", "representativeName", "bizRegistrationNumber", "zipCode", "companyAddress", "companyAddressDetail"), "회원사 기본정보와 주소를 수정합니다."),
                changeTarget("company-contact", "회원사 담당자", Arrays.asList("chargerName", "chargerEmail", "chargerTel"), "회원사 담당자 정보를 수정합니다."),
                changeTarget("company-files", "회원사 증빙 파일", Arrays.asList("fileUploads"), "신규 증빙 파일을 업로드합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildJoinWizardPage() {
        Map<String, Object> page = pageOption("join-wizard", "가입 단계", "/join/step1", "HMENU_JOIN_STEP1", "join");
        page.put("summary", "가입 유형 선택부터 단계별 입력, 세션 유지, 재신청 흐름까지 이어지는 사용자 가입 시작 화면입니다.");
        page.put("source", "frontend/src/features/join-wizard/JoinTermsMigrationPage.tsx, JoinInfoMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("join-hero", "가입 안내 영역", "[data-help-id=\"join-step-header\"]", "JoinHero", "header",
                        Collections.emptyList(), "가입 목적과 단계 안내를 제공합니다."),
                surface("membership-type-card-group", "회원유형 선택", "[data-help-id=\"join-membership-type\"]", "MembershipTypeCardGroup", "content",
                        Arrays.asList("join-membership-select"), "개인/기업/기관 유형을 세션에 반영합니다."),
                surface("join-wizard-actions", "다음 단계 액션", "[data-help-id=\"join-step-actions\"]", "JoinWizardActions", "actions",
                        Arrays.asList("join-next-step"), "현재 선택값 기준으로 다음 단계로 이동합니다.")
        ));
        page.put("events", Arrays.asList(
                event("join-membership-select", "회원유형 선택", "click", "handleSelectMembershipType", "[data-help-id=\"join-membership-type\"] button",
                        Arrays.asList("join.session.page"), "선택한 회원유형을 세션 및 화면 상태에 반영합니다."),
                event("join-next-step", "다음 단계 이동", "click", "handleMoveNextStep", "[data-help-id=\"join-step-actions\"] [data-action=\"next\"]",
                        Arrays.asList("route.join.step2"), "세션 필수값이 준비된 경우 다음 단계로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("join-session-schema", "가입 세션 모델", "HTTP_SESSION",
                        Arrays.asList("membershipType", "verifiedIdentity", "step", "joinVO"),
                        Arrays.asList("SESSION_READ", "SESSION_WRITE"), "가입 단계 이동과 재신청 복구에 사용됩니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("HMENU1", "홈 메뉴 코드", Arrays.asList("HMENU_JOIN_STEP1", "HMENU_JOIN_STEP2"), "가입 단계 URL과 메뉴 노출에 사용됩니다."),
                codeGroup("MEMBERSHIP_TYPE", "가입 회원 유형", Arrays.asList("INDIVIDUAL", "COMPANY", "INSTITUTION"), "가입 흐름 분기에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildObservabilityPage() {
        Map<String, Object> page = pageOption("observability", "감사 로그", "/admin/system/observability", "A0060303", "admin");
        page.put("summary", "감사 로그와 trace 이벤트를 같은 페이지에서 조회하는 운영 화면입니다.");
        page.put("source", "frontend/src/features/observability/ObservabilityMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("observability-search-panel", "검색 패널", "[data-help-id=\"observability-filters\"]", "ObservabilitySearchPanel", "actions",
                        Arrays.asList("observability-search-audit", "observability-search-trace"), "traceId, actorId, actionCode, apiId 조건을 조합합니다."),
                surface("audit-event-table", "감사 로그 테이블", "[data-help-id=\"observability-audit-table\"]", "AuditEventTable", "content",
                        Arrays.asList("observability-move-trace"), "감사 이벤트에서 trace로 drill-down 합니다."),
                surface("trace-event-table", "추적 이벤트 테이블", "[data-help-id=\"observability-trace-table\"]", "TraceEventTable", "content",
                        Collections.emptyList(), "API/결과코드 기준으로 trace를 조회합니다.")
        ));
        page.put("events", Arrays.asList(
                event("observability-search-audit", "감사 로그 조회", "click", "loadAudit", "[data-help-id=\"observability-filters\"] button",
                        Arrays.asList("platform.observability.audit-events.search"), "감사 테이블을 갱신합니다."),
                event("observability-search-trace", "추적 이벤트 조회", "click", "loadTrace", "[data-help-id=\"observability-filters\"] button",
                        Arrays.asList("platform.observability.trace-events.search"), "추적 테이블을 갱신합니다."),
                event("observability-move-trace", "감사 -> trace 이동", "click", "moveToTrace", "[data-help-id=\"observability-audit-table\"] .text-button",
                        Arrays.asList("platform.observability.trace-events.search"), "선택한 traceId로 탭 전환 후 상세 조회합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("audit-event-schema", "감사 이벤트 스키마", "AUDIT_EVENT",
                        Arrays.asList("AUDIT_ID", "TRACE_ID", "ACTOR_ID", "ACTION_CODE", "PAGE_ID", "RESULT_STATUS"),
                        Arrays.asList("SELECT", "INSERT"), "운영 감사 로그 기록/조회 테이블입니다."),
                schema("trace-event-schema", "추적 이벤트 스키마", "TRACE_EVENT",
                        Arrays.asList("EVENT_ID", "TRACE_ID", "API_ID", "EVENT_TYPE", "RESULT_CODE", "DURATION_MS"),
                        Arrays.asList("SELECT", "INSERT"), "프론트/백엔드 추적 이벤트 조회 테이블입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("TRACE_EVENT_TYPE", "추적 이벤트 유형", Arrays.asList("PAGE_LOAD", "API_CALL", "DB_QUERY"), "trace 분류 기준입니다."),
                codeGroup("RESULT_STATUS", "결과 코드", Arrays.asList("SUCCESS", "ERROR"), "감사/추적 결과 배지에 사용됩니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSensorListPage() {
        Map<String, Object> page = pageOption("sensor-list", "센서 목록", "/admin/monitoring/sensor_list", "A0070201", "admin");
        page.put("summary", "보안 모니터링 이벤트를 센서 단위로 재구성해 상태, 심각도, 차단 승격 여부를 빠르게 분류하고 아직 차단된 live inventory, refresh, export, bulk 조치 계약을 구분하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/sensor-list/SensorListMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("sensor-list-summary", "센서 요약 카드", "[data-help-id=\"sensor-list-summary\"]", "SensorListSummaryCards", "header",
                        Collections.emptyList(), "등록 센서, 경보, 검토, 안정, 활성 차단 건수를 요약합니다."),
                surface("sensor-list-operating-rule", "센서 목록 운영 기준", "[data-help-id=\"sensor-list-operating-rule\"]", "SensorListOperatingRule", "content",
                        Collections.emptyList(), "상태, 심각도, 담당자 메모, 차단 승격 상태를 한 목록에서 본 뒤 이벤트 상세 화면으로 이동하는 운영 기준입니다."),
                surface("sensor-list-closeout-gate", "센서 목록 완료 게이트", "[data-help-id=\"sensor-list-closeout-gate\"]", "SensorListCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 모니터링 기반 조회/상세 이동과 아직 필요한 live inventory, 상태 refresh, export, bulk enable/disable 계약을 구분합니다."),
                surface("sensor-list-action-contract", "센서 인벤토리 조치 계약", "[data-help-id=\"sensor-list-action-contract\"] button[disabled]", "SensorListActionContract", "actions",
                        Collections.emptyList(), "상태 새로고침, export, 선택 활성/비활성은 백엔드 인벤토리·권한·감사 연결 전까지 비활성화합니다."),
                surface("sensor-list-filters", "센서 검색 필터", "[data-help-id=\"sensor-list-filters\"]", "SensorListFilters", "actions",
                        Arrays.asList("sensor-list-filter"), "키워드, 상태, 유형, 심각도 조건을 조합합니다."),
                surface("sensor-list-table", "센서 목록 테이블", "[data-help-id=\"sensor-list-table\"]", "SensorListTable", "content",
                        Arrays.asList("sensor-list-open-detail"), "센서 상태와 대상 URL, 감지 시각을 목록으로 보여줍니다."),
                surface("sensor-list-focus", "센서 상세 패널", "[data-help-id=\"sensor-list-focus\"]", "SensorListFocusPanel", "content",
                        Arrays.asList("sensor-list-open-detail"), "선택 센서의 메모, 담당자, 차단 상태를 요약합니다."),
                surface("sensor-list-activity", "최근 활동", "[data-help-id=\"sensor-list-activity\"]", "SensorListActivityFeed", "content",
                        Collections.emptyList(), "센서 관련 최근 운영 활동을 시간순으로 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("sensor-list-filter", "센서 목록 필터링", "change", "applyFilter", "[data-help-id=\"sensor-list-filters\"] input, [data-help-id=\"sensor-list-filters\"] select",
                        Arrays.asList("admin.sensor-list.page"), "조건 변경 시 센서 목록을 다시 계산합니다."),
                event("sensor-list-open-detail", "센서 상세 열기", "click", "openSecurityMonitoringDetail", "[data-help-id=\"sensor-list-focus\"] a",
                        Arrays.asList("route.admin.system.security-monitoring"), "선택한 fingerprint 기준으로 보안 모니터링 상세 화면 또는 센서 설정 화면으로 이동합니다."),
                event("sensor-list-action-contract-blocked", "센서 인벤토리 조치 차단 상태 표시", "render", "SensorListActionContract", "[data-help-id=\"sensor-list-action-contract\"]",
                        Collections.emptyList(), "live inventory, refresh, export, bulk enable/disable API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("sensor-list-row-schema", "센서 목록 행 스키마", "REQUEST_EXECUTION_LOG + SNAPSHOT_CARD",
                        Arrays.asList("fingerprint", "title", "severity", "stateStatus", "stateOwner", "sourceFingerprint", "status"),
                        Arrays.asList("SELECT"),
                        "보안 모니터링 원본 이벤트와 차단 후보 상태를 센서 행으로 재구성합니다."),
                schema("sensor-activity-schema", "센서 활동 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("happenedAt", "action", "actorUserId", "target", "detail"),
                        Arrays.asList("SELECT", "INSERT"),
                        "센서 관련 운영 활동 로그를 시간순으로 조회합니다."),
                schema("sensor-inventory-schema", "센서 live inventory 스키마", "PENDING_SENSOR_INVENTORY",
                        Arrays.asList("sensorId", "sensorName", "sensorType", "installLocation", "ownerId", "enabled", "healthStatus", "lastRefreshedAt", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 등록/수정/목록이 공유해야 하는 센서 인벤토리 모델입니다."),
                schema("sensor-bulk-action-schema", "센서 bulk 조치 스키마", "PENDING_SENSOR_BULK_ACTION",
                        Arrays.asList("actionId", "sensorIds", "actionType", "reason", "previewSummary", "resultStatus", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "상태 새로고침, export, bulk 활성/비활성 결과와 감사 증적을 저장할 조치 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("SENSOR_STATUS", "센서 상태", Arrays.asList("BLOCKED", "ALERT", "REVIEW", "STABLE"), "센서 상태 배지와 필터 기준입니다."),
                codeGroup("SENSOR_TYPE", "센서 유형", Arrays.asList("AUTH", "ADMIN", "API", "OPS", "WEB"), "센서 분류 라벨과 검색 필터에 사용됩니다."),
                codeGroup("SENSOR_INVENTORY_ACTION", "센서 인벤토리 조치 유형", Arrays.asList("REFRESH_STATUS", "EXPORT", "BULK_ENABLE", "BULK_DISABLE"), "센서 인벤토리 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildInfraManagementPage() {
        Map<String, Object> page = pageOption("infra", "인프라", "/admin/system/infra", "ADMIN_SYSTEM_INFRA", "admin");
        page.put("summary", "웹, 배치, 관측 인프라의 정적 점검 화면과 실제 런타임 조치에 필요한 미완성 계약을 구분하는 관리자 콘솔입니다.");
        page.put("source", "frontend/src/features/system-infra/InfraManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("infra-closeout-gate", "인프라 완료 게이트", "[data-help-id=\"infra-closeout-gate\"]", "InfraCloseoutGate", "content",
                        Collections.emptyList(), "토폴로지 레지스트리, 라이브 헬스, 임계치, 인시던트 핸드오프, 운영 콘솔 이동 가능 여부를 구분합니다."),
                surface("infra-action-contract", "인프라 런타임 조치 계약", "[data-help-id=\"infra-action-contract\"] button[disabled]", "InfraActionContract", "actions",
                        Collections.emptyList(), "헬스 새로고침, 인시던트 생성, 노드 drain, 조치 핸드오프는 백엔드 포트와 감사 연결 전까지 비활성화합니다."),
                surface("infra-summary", "인프라 요약 카드", "[data-help-id=\"infra-summary\"]", "InfraSummaryCards", "header",
                        Collections.emptyList(), "노드 수, 점검 필요 수, 평균 CPU와 메모리 사용률을 요약합니다."),
                surface("infra-filters", "인프라 노드 필터", "[data-help-id=\"infra-filters\"]", "InfraFilters", "actions",
                        Arrays.asList("infra-filter-change"), "역할과 존 기준으로 인프라 노드 샘플을 필터링합니다."),
                surface("infra-node-grid", "인프라 노드 카드", "[data-help-id=\"infra-node-grid\"]", "InfraNodeGrid", "content",
                        Collections.emptyList(), "노드 역할, 존, 헬스, CPU, 메모리, 디스크 상태를 카드로 보여줍니다."),
                surface("infra-incidents", "인프라 인시던트 메모", "[data-help-id=\"infra-incidents\"]", "InfraIncidentNotes", "content",
                        Collections.emptyList(), "현재 인프라 조치 메모와 심각도를 표시합니다."),
                surface("infra-connected-consoles", "연결 운영 콘솔", "[data-help-id=\"infra-connected-consoles\"]", "InfraConnectedConsoles", "content",
                        Collections.emptyList(), "운영센터, 통합 관측, 스케줄러 등 후속 분석 화면으로 이동합니다.")
        ));
        page.put("events", Arrays.asList(
                event("infra-filter-change", "인프라 필터 변경", "change", "setRoleFilter / setZoneFilter", "[data-help-id=\"infra-filters\"] select",
                        Collections.singletonList("admin.infra.page"), "역할과 존 필터 변경 시 로컬 노드 목록과 요약을 다시 계산합니다."),
                event("infra-action-contract-blocked", "인프라 조치 차단 상태 표시", "render", "InfraActionContract", "[data-help-id=\"infra-action-contract\"]",
                        Collections.emptyList(), "라이브 토폴로지, 권한, 승인, 감사가 연결되기 전까지 런타임 변경 액션을 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("infra-node-row-schema", "인프라 노드 행 스키마", "PENDING_TOPOLOGY_NODE",
                        Arrays.asList("nodeId", "name", "role", "zone", "health", "cpu", "memory", "disk", "sourceTimestamp", "note"),
                        Arrays.asList("SELECT"),
                        "정적 샘플을 대체할 토폴로지 노드 조회 행입니다."),
                schema("infra-incident-row-schema", "인프라 인시던트 행 스키마", "PENDING_INCIDENT",
                        Arrays.asList("incidentId", "nodeId", "severity", "status", "owner", "openedAt", "actionSummary"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "인시던트와 조치 핸드오프를 연결할 행입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("INFRA_NODE_ROLE", "인프라 노드 역할", Arrays.asList("WEB", "BATCH", "OBSERVABILITY"), "노드 역할 필터와 배지 기준입니다."),
                codeGroup("INFRA_HEALTH_STATUS", "인프라 헬스 상태", Arrays.asList("HEALTHY", "WARNING", "DEGRADED", "UNKNOWN"), "라이브 헬스 배지와 조치 판단 기준입니다."),
                codeGroup("INFRA_REMEDIATION_ACTION", "인프라 조치 유형", Arrays.asList("REFRESH_HEALTH", "OPEN_INCIDENT", "DRAIN_NODE", "HANDOFF"), "런타임 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildPerformancePage() {
        Map<String, Object> page = pageOption("performance", "성능", "/admin/system/performance", "ADMIN_SYSTEM_PERFORMANCE", "admin");
        page.put("summary", "JVM 용량과 최근 요청 실행 로그를 기반으로 성능 상태를 점검하고, 아직 필요한 임계치/알림/export/보존/인시던트 계약을 구분하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/performance/PerformanceMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("performance-status", "성능 현재 상태", "[data-help-id=\"performance-status\"]", "PerformanceStatus", "header",
                        Collections.emptyList(), "overallStatus, refreshedAt, slowThresholdMs, requestWindowSize를 표시합니다."),
                surface("performance-closeout-gate", "성능 완료 게이트", "[data-help-id=\"performance-closeout-gate\"]", "PerformanceCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 진단과 아직 필요한 임계치, 알림, export, 보존기간, 추세 비교, 인시던트 연계를 구분합니다."),
                surface("performance-action-contract", "성능 거버넌스 조치 계약", "[data-help-id=\"performance-action-contract\"] button[disabled]", "PerformanceActionContract", "actions",
                        Collections.emptyList(), "임계치 저장, 알림 규칙 연결, 리포트 export, 인시던트 생성은 백엔드 계약과 감사 전까지 비활성화합니다."),
                surface("performance-runtime", "JVM 용량 카드", "[data-help-id=\"performance-runtime\"]", "PerformanceRuntimeSummary", "content",
                        Collections.emptyList(), "힙 사용률, 가용 메모리, 프로세서, 관측 요청 수를 보여줍니다."),
                surface("performance-request-summary", "요청 지연 요약", "[data-help-id=\"performance-request-summary\"]", "PerformanceRequestSummary", "content",
                        Collections.emptyList(), "평균, p95, 지연 요청 비율, 오류 비율을 보여줍니다."),
                surface("performance-hotspot-routes", "성능 hotspot 경로", "[data-help-id=\"performance-hotspot-routes\"]", "PerformanceHotspotRoutes", "content",
                        Collections.emptyList(), "평균 또는 최대 지연이 높은 경로를 표로 보여줍니다."),
                surface("performance-response-distribution", "응답 분포", "[data-help-id=\"performance-response-distribution\"]", "PerformanceResponseDistribution", "content",
                        Collections.emptyList(), "상태 코드와 최대 지연 분포를 보여줍니다."),
                surface("performance-slow-requests", "최근 지연/오류 요청", "[data-help-id=\"performance-slow-requests\"]", "PerformanceSlowRequests", "content",
                        Collections.emptyList(), "traceId, actor, 상태 코드, 지연 시간을 포함한 최근 문제 요청을 보여줍니다."),
                surface("performance-quick-links", "성능 분석 바로가기", "[data-help-id=\"performance-quick-links\"]", "PerformanceQuickLinks", "content",
                        Collections.emptyList(), "통합 로그, 추적 조회, 에러 로그, 운영센터로 이동합니다."),
                surface("performance-guidance", "성능 운영 가이드", "[data-help-id=\"performance-guidance\"]", "PerformanceGuidance", "content",
                        Collections.emptyList(), "최근 샘플 기반 해석, p95 급증, 힙 상승 시 후속 조치를 안내합니다.")
        ));
        page.put("events", Arrays.asList(
                event("performance-route-drilldown", "성능 경로 추적 이동", "click", "openTargetRoute", "[data-help-id=\"performance-hotspot-routes\"] a, [data-help-id=\"performance-slow-requests\"] a",
                        Collections.emptyList(), "hotspot 또는 최근 지연/오류 요청에서 연결된 추적/로그 화면으로 이동합니다."),
                event("performance-action-contract-blocked", "성능 조치 차단 상태 표시", "render", "PerformanceActionContract", "[data-help-id=\"performance-action-contract\"]",
                        Collections.emptyList(), "임계치 정책, 알림 규칙, export, 인시던트 lifecycle, 감사 저장소가 연결되기 전까지 운영 변경 액션을 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("performance-request-log-schema", "요청 실행 로그 스키마", "REQUEST_EXECUTION_LOG",
                        Arrays.asList("traceId", "requestUri", "httpMethod", "responseStatus", "durationMs", "actorUserId", "executedAt", "errorMessage"),
                        Arrays.asList("SELECT"),
                        "최근 요청 샘플, hotspot, 지연/오류 요청을 계산하는 원천입니다."),
                schema("performance-runtime-snapshot-schema", "런타임 스냅샷 스키마", "JVM_RUNTIME",
                        Arrays.asList("maxMemory", "totalMemory", "freeMemory", "usedMemory", "availableProcessors", "sampledAt"),
                        Arrays.asList("READ_RUNTIME"),
                        "현재 JVM 용량 정보를 읽는 런타임 스냅샷입니다."),
                schema("performance-policy-schema", "성능 정책 스키마", "PENDING_PERFORMANCE_POLICY",
                        Arrays.asList("thresholdId", "slowThresholdMs", "p95ThresholdMs", "heapThresholdPercent", "errorRatePercent", "retentionDays", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 임계치, export 보존기간, 알림 연결을 저장할 정책 스키마입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("PERFORMANCE_STATUS", "성능 상태", Arrays.asList("HEALTHY", "WARNING", "CRITICAL", "UNKNOWN"), "성능 상태 배지와 알림 판단 기준입니다."),
                codeGroup("PERFORMANCE_ACTION", "성능 조치 유형", Arrays.asList("SAVE_THRESHOLDS", "LINK_ALERT_RULE", "EXPORT_REPORT", "OPEN_INCIDENT", "COMPARE_TREND"), "성능 운영 액션 권한과 감사 이벤트 구분값입니다."),
                codeGroup("PERFORMANCE_RETENTION", "성능 보존기간", Arrays.asList("7D", "30D", "90D", "CUSTOM"), "요청 로그와 성능 리포트 보존기간 정책 후보입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildNotificationPage() {
        Map<String, Object> page = pageOption("notification", "알림센터", "/admin/system/notification", "ADMIN_SYSTEM_NOTIFICATION", "admin");
        page.put("summary", "보안 정책 알림 라우팅, 즉시 발송, 전달/운영 이력을 관리하고 범용 알림 rule, 수신자 scope, 테스트 발송, 재시도 계약의 미완성 상태를 구분하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/notification-center/NotificationCenterMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("notification-snapshot", "알림 운영 현황", "[data-help-id=\"notification-snapshot\"]", "NotificationSnapshot", "header",
                        Collections.emptyList(), "보안 정책, 보안 모니터링, 통합 로그로 이어지는 운영 바로가기를 제공합니다."),
                surface("notification-summary", "알림 요약 카드", "[data-help-id=\"notification-summary\"]", "NotificationSummary", "content",
                        Collections.emptyList(), "활성 채널, 발송 실패, 라우팅 점검, Critical 탐지 수를 요약합니다."),
                surface("notification-closeout-gate", "알림센터 완료 게이트", "[data-help-id=\"notification-closeout-gate\"]", "NotificationCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 보안 라우팅/이력과 아직 필요한 rule CRUD, 수신자 scope, 테스트 발송, 재시도 계약을 구분합니다."),
                surface("notification-action-contract", "범용 알림 조치 계약", "[data-help-id=\"notification-action-contract\"] button[disabled]", "NotificationActionContract", "actions",
                        Collections.emptyList(), "알림 규칙 생성, 수신자 scope 미리보기, 테스트 발송, 실패 재시도는 백엔드 계약과 감사 전까지 비활성화합니다."),
                surface("notification-routing", "알림 라우팅 설정", "[data-help-id=\"notification-routing\"]", "NotificationRouting", "content",
                        Arrays.asList("notification-routing-save", "notification-dispatch"), "Slack, Mail, Webhook, severity, digest 설정을 저장하고 보안 알림을 발송합니다."),
                surface("notification-history", "알림 전달/활동 이력", "[data-help-id=\"notification-history\"]", "NotificationHistory", "content",
                        Arrays.asList("notification-delivery-filter", "notification-activity-filter"), "발송 이력과 운영자 조치 이력을 필터와 페이지네이션으로 조회합니다."),
                surface("notification-guidance", "알림 운영 가이드", "[data-help-id=\"notification-guidance\"]", "NotificationGuidance", "content",
                        Collections.emptyList(), "Critical/High 알림 처리와 로그 확인 기준을 안내합니다.")
        ));
        page.put("events", Arrays.asList(
                event("notification-routing-save", "알림 라우팅 저장", "click", "saveNotificationRouting", "[data-help-id=\"notification-routing\"] .primary-button",
                        Collections.singletonList("admin.notification.routing-save"), "보안 정책 알림 채널과 digest 설정을 저장합니다."),
                event("notification-dispatch", "보안 알림 발송", "click", "dispatchNotificationRouting", "[data-help-id=\"notification-routing\"] .secondary-button",
                        Collections.singletonList("admin.notification.dispatch"), "Critical/High 또는 Critical-only 보안 알림 발송을 실행하고 이력을 기록합니다."),
                event("notification-delivery-filter", "발송 이력 필터", "click", "applyDeliveryFilters / resetDeliveryFilters / changeDeliveryPage", "[data-help-id=\"notification-history\"]",
                        Collections.singletonList("admin.notification.page"), "채널, 상태, 검색어, 페이지 조건으로 발송 이력을 조회합니다."),
                event("notification-activity-filter", "운영자 조치 필터", "click", "applyActivityFilters / resetActivityFilters / changeActivityPage", "[data-help-id=\"notification-history\"]",
                        Collections.singletonList("admin.notification.page"), "조치 유형, 검색어, 페이지 조건으로 운영자 조치 이력을 조회합니다."),
                event("notification-action-contract-blocked", "범용 알림 조치 차단 상태 표시", "render", "NotificationActionContract", "[data-help-id=\"notification-action-contract\"]",
                        Collections.emptyList(), "범용 rule CRUD, 수신자 scope, 테스트 발송, 실패 재시도 API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("notification-config-schema", "알림 라우팅 설정 스키마", "SECURITY_INSIGHT_NOTIFICATION_SNAPSHOT",
                        Arrays.asList("slackEnabled", "mailEnabled", "webhookEnabled", "notifyCritical", "notifyHigh", "newOnlyMode", "digestEnabled", "digestHour", "digestMinute", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "UPDATE"),
                        "현재 보안 정책 알림 라우팅 설정입니다."),
                schema("notification-delivery-history-schema", "알림 전달 이력 스키마", "ADMIN_NOTIFICATION_DELIVERY_HISTORY",
                        Arrays.asList("deliveryId", "channel", "deliveryStatus", "title", "message", "target", "occurredAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "발송/전달 결과 이력입니다."),
                schema("notification-activity-history-schema", "알림 운영자 조치 이력 스키마", "ADMIN_NOTIFICATION_ACTIVITY_HISTORY",
                        Arrays.asList("actionCode", "actorId", "summary", "target", "recordedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "라우팅 저장, 발송, 향후 재시도/테스트 발송 조치 이력입니다."),
                schema("notification-rule-schema", "범용 알림 규칙 스키마", "PENDING_NOTIFICATION_RULE",
                        Arrays.asList("ruleId", "ruleName", "eventType", "recipientScope", "channelPolicy", "enabled", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 범용 알림 rule CRUD를 위한 스키마입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("NOTIFICATION_CHANNEL", "알림 채널", Arrays.asList("SLACK", "MAIL", "WEBHOOK"), "알림 채널 설정과 이력 필터 기준입니다."),
                codeGroup("NOTIFICATION_DELIVERY_STATUS", "알림 전달 상태", Arrays.asList("DELIVERED", "RECORDED", "FAILED", "BLOCKED", "DISABLED"), "전달 이력 상태와 재시도 판단 기준입니다."),
                codeGroup("NOTIFICATION_ACTION", "알림 조치 유형", Arrays.asList("SAVE_ROUTING", "DISPATCH", "TEST_DISPATCH", "RETRY_FAILED", "RULE_UPDATE"), "운영자 조치 이력과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSecurityHistoryPage() {
        Map<String, Object> page = pageOption("security-history", "보안 이력", "/admin/system/security", "A0060205", "admin");
        page.put("summary", "공유 차단 이력 컴포넌트를 시스템 범위로 사용해 차단 이력 조회, 상세 컨텍스트, 운영 조치 기록, IP 차단 승격을 제공하고 실제 계정 해제/예외 적용과 감사 export 후속 계약을 구분하는 보안 검토 콘솔입니다.");
        page.put("source", "frontend/src/features/security-history/SecurityHistoryMigrationPage.tsx / frontend/src/features/security-history/LoginHistorySharedPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("member-security-guidance", "시스템 차단 검토 안내", "[data-help-id=\"member-security-guidance\"]", "SecurityHistoryGuidance", "header",
                        Collections.emptyList(), "시스템 보안 이력이 회원 차단 이력과 같은 표준 컴포넌트를 쓰지만 시스템 메뉴와 시스템 payload 범위로 동작함을 안내합니다."),
                surface("security-history-closeout-gate", "보안 이력 완료 게이트", "[data-help-id=\"security-history-closeout-gate\"]", "SecurityHistoryCloseoutGate", "content",
                        Collections.emptyList(), "공유 콘솔, 차단 이력 조회, 상세 컨텍스트, 운영 조치 기록과 아직 필요한 실제 해제/예외 적용, 케이스 관리, 감사 export를 구분합니다."),
                surface("security-history-action-contract", "보안 이력 실행 조치 계약", "[data-help-id=\"security-history-action-contract\"] button[disabled]", "SecurityHistoryActionContract", "actions",
                        Collections.singletonList("security-history-action-contract-blocked"), "실제 계정 잠금 해제, 정책 예외 적용, 인시던트 케이스 생성, 감사 증적 export는 권한/승인/감사 API 전까지 비활성화합니다."),
                surface("login-history-search", "차단 이력 검색", "[data-help-id=\"login-history-search\"]", "SecurityHistorySearch", "actions",
                        Arrays.asList("security-history-filter-change"), "회원사, 사용자 구분, 조치 상태, 키워드로 loginResult=FAIL 이력을 조회합니다."),
                surface("login-history-table", "차단 이력 목록", "[data-help-id=\"login-history-table\"]", "SecurityHistoryTable", "content",
                        Arrays.asList("security-history-row-select"), "차단 시각, 사용자, IP, 조치 상태, 차단 사유를 표로 검토합니다."),
                surface("security-history-detail", "보안 이력 상세/운영 액션", "aside.gov-card", "SecurityHistoryDetailPanel", "content",
                        Arrays.asList("security-history-save-action", "security-history-copy-summary", "security-history-open-linked-page"), "동일 IP/사용자/회원사 건수와 보안 운영 링크, 메모 저장, 해제/예외 요청 기록, IP 차단 승격을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("security-history-route-delegate", "시스템 보안 이력 공유 콘솔 위임", "render", "SecurityHistoryMigrationPage -> SystemSecurityHistoryMigrationPage -> LoginHistorySharedPage", "[data-help-id=\"member-security-guidance\"]",
                        Collections.emptyList(), "시스템 routeScope과 fixedLoginResult=FAIL 조건으로 공유 이력 콘솔을 사용합니다."),
                event("security-history-filter-change", "보안 이력 필터 변경", "submit/change", "setFilters / fetchSecurityHistoryPage", "[data-help-id=\"login-history-search\"]",
                        Collections.singletonList("admin.security-history.page"), "회원사, 사용자 구분, 조치 상태, 검색어로 시스템 보안 차단 이력을 조회합니다."),
                event("security-history-row-select", "보안 이력 행 선택", "click", "setSelectedRowKey", "[data-help-id=\"login-history-table\"] tr",
                        Collections.emptyList(), "선택 행의 사용자, 회원사, IP, 메시지, 관련 건수, 운영 링크를 상세 패널에 표시합니다."),
                event("security-history-save-action", "보안 이력 운영 조치 기록", "click", "handleSecurityAction", "aside.gov-card button",
                        Collections.singletonList("admin.security-history.action-save"), "메모 저장, 차단 해제 요청, 예외 요청, IP 차단 승격을 보안 조치 이력으로 기록합니다."),
                event("security-history-copy-summary", "보안 이력 요약 복사", "click", "navigator.clipboard.writeText", "aside.gov-card button",
                        Collections.emptyList(), "선택 이력의 사용자, IP, 회원사, 사유 요약을 클립보드로 복사합니다."),
                event("security-history-open-linked-page", "보안 운영 연계 화면 이동", "click", "MemberLinkButton", "aside.gov-card a",
                        Collections.emptyList(), "보안 모니터링, 보안 정책, 차단목록, 회원사 상세 화면으로 이동합니다."),
                event("security-history-action-contract-blocked", "보안 이력 실행 조치 차단 상태 표시", "render", "SecurityHistoryActionContract", "[data-help-id=\"security-history-action-contract\"]",
                        Collections.emptyList(), "실제 계정/세션/정책 변경, 케이스 생성, 감사 export API가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("security-history-log-schema", "보안 차단 이력 조회 스키마", "COMTNLOGINLOG / observability history payload",
                        Arrays.asList("histId", "userId", "userNm", "userSe", "insttId", "companyName", "loginIp", "loginPnttm", "loginResult", "loginMessage"),
                        Arrays.asList("SELECT"), "시스템 보안 이력 표와 상세 패널의 원천입니다."),
                schema("security-history-action-schema", "보안 이력 운영 조치 스키마", "SECURITY_HISTORY_ACTIONS_SNAPSHOT",
                        Arrays.asList("historyKey", "action", "userId", "targetIp", "insttId", "note", "executedAt", "executedBy", "blockId"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "메모 저장, 해제/예외 요청 기록, IP 차단 승격 이력을 저장합니다."),
                schema("security-history-enforcement-schema", "보안 이력 실행 조치 스키마", "PENDING_SECURITY_HISTORY_ENFORCEMENT",
                        Arrays.asList("historyKey", "actionType", "approvalId", "beforeState", "afterState", "rollbackRef", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "향후 실제 해제/예외 적용과 rollback을 위한 후속 모델입니다."),
                schema("security-monitoring-block-candidate-schema", "차단 후보 스키마", "SECURITY_MONITORING_BLOCKLIST",
                        Arrays.asList("blockId", "target", "blockType", "reason", "severity", "fingerprint", "status", "createdBy", "createdAt"),
                        Arrays.asList("SELECT", "INSERT"), "IP 차단 승격 시 차단목록 review 후보로 연결되는 스냅샷입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("SECURITY_HISTORY_ACTION", "보안 이력 조치 유형", Arrays.asList("SAVE_NOTE", "UNBLOCK_USER", "REGISTER_EXCEPTION", "ESCALATE_BLOCK_IP"), "현재 저장 가능한 운영 조치 유형입니다."),
                codeGroup("SECURITY_HISTORY_PENDING_ACTION", "보안 이력 후속 실행 유형", Arrays.asList("ENFORCE_UNBLOCK", "APPLY_EXCEPTION", "CREATE_CASE", "AUDIT_EXPORT"), "후속 실제 실행/감사 조치 유형입니다."),
                codeGroup("LOGIN_RESULT", "로그인 결과", Arrays.asList("FAIL"), "이 화면은 시스템 보안 차단 검토를 위해 실패/차단 이력만 고정 조회합니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("security-history-note", "운영 메모", Arrays.asList("historyKey", "note", "executedBy", "executedAt"), "선택 이력에 운영 메모를 저장합니다."),
                changeTarget("security-history-action-request", "해제/예외 요청 기록", Arrays.asList("historyKey", "userId", "insttId", "targetIp", "action", "note"), "실제 변경 전 운영자 요청 의사결정을 기록합니다."),
                changeTarget("security-history-block-escalation", "IP 차단 승격", Arrays.asList("historyKey", "targetIp", "reason", "severity", "blockId"), "선택 IP를 차단목록 review 후보로 승격합니다."),
                changeTarget("security-history-enforcement", "후속 실행 조치", Arrays.asList("approvalId", "beforeState", "afterState", "rollbackRef"), "향후 실제 계정 해제/예외 적용과 rollback 기준을 보관합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildMonitoringCenterPage() {
        Map<String, Object> page = pageOption("monitoring-center", "운영센터", "/admin/monitoring/center", "ADMIN_MONITORING_CENTER", "admin");
        page.put("summary", "운영 상태, 우선 대응 큐, 도메인 위젯, 최근 조치 이력을 확인하고 아직 차단된 실측 지표 출처, 인지 처리, escalation, 담당자 배정, closeout 이력 계약을 구분하는 운영 상황판입니다.");
        page.put("source", "frontend/src/features/operations-center/OperationsCenterMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("operations-center-status", "운영센터 현재 상태", "[data-help-id=\"operations-center-status\"]", "OperationsCenterStatus", "header",
                        Collections.emptyList(), "전체 운영 상태와 갱신 시각, 센서 등록/설정/목록 이동을 제공합니다."),
                surface("operations-center-closeout-gate", "운영센터 완료 게이트", "[data-help-id=\"operations-center-closeout-gate\"]", "OperationsCenterCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 상황판 조회와 아직 필요한 실측 metric 출처, 인지 처리, escalation, 담당자 배정, closeout 이력을 구분합니다."),
                surface("operations-center-action-contract", "Incident 조치 계약", "[data-help-id=\"operations-center-action-contract\"] button[disabled]", "OperationsCenterActionContract", "actions",
                        Collections.emptyList(), "인지 처리, 담당자 배정, escalation, closeout은 백엔드 lifecycle·권한·감사 연결 전까지 비활성화합니다."),
                surface("operations-center-core-summary", "핵심 운영 요약", "[data-help-id=\"operations-center-core-summary\"]", "OperationsCenterCoreSummary", "content",
                        Collections.emptyList(), "회원, 배출, 보안/시스템 신호를 우선 확인합니다."),
                surface("operations-center-support-summary", "지원 도메인 요약", "[data-help-id=\"operations-center-support-summary\"]", "OperationsCenterSupportSummary", "content",
                        Collections.emptyList(), "외부연계, 콘텐츠, 운영도구 신호를 확인합니다."),
                surface("operations-center-navigation", "운영센터 상세 이동", "[data-help-id=\"operations-center-navigation\"]", "OperationsCenterNavigation", "content",
                        Collections.emptyList(), "도메인별 상세 화면 진입 링크를 제공합니다."),
                surface("operations-center-priority-queue", "우선 대응 큐", "[data-help-id=\"operations-center-priority-queue\"]", "OperationsCenterPriorityQueue", "content",
                        Collections.singletonList("operations-center-priority-filter"), "우선 대응 항목을 도메인별로 필터링하고 심각도/발생 시각 기준으로 정렬합니다."),
                surface("operations-center-playbooks", "운영 체크포인트", "[data-help-id=\"operations-center-playbooks\"]", "OperationsCenterPlaybooks", "content",
                        Collections.emptyList(), "상세 조치 전 확인해야 할 운영 기준을 보여줍니다."),
                surface("operations-center-widgets", "운영 위젯", "[data-help-id=\"operations-center-core-widgets\"], [data-help-id=\"operations-center-extended-widgets\"]", "OperationsCenterWidgets", "content",
                        Collections.emptyList(), "도메인별 metric row와 quick link를 제공합니다."),
                surface("operations-center-recent-actions", "최근 조치 이력", "[data-help-id=\"operations-center-recent-actions\"]", "OperationsCenterRecentActions", "content",
                        Collections.emptyList(), "최근 운영자 조치와 관련 이력 이동을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("operations-center-priority-filter", "우선 대응 큐 도메인 필터", "click", "setSelectedQueueDomain", "[data-help-id=\"operations-center-priority-queue\"] button",
                        Collections.singletonList("admin.monitoring-center.page"), "선택한 도메인 기준으로 우선 대응 큐를 필터링합니다."),
                event("operations-center-action-contract-blocked", "Incident lifecycle 조치 차단 상태 표시", "render", "OperationsCenterActionContract", "[data-help-id=\"operations-center-action-contract\"]",
                        Collections.emptyList(), "실측 metric 출처, acknowledge, assignment, escalation, closeout API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("operations-center-summary-schema", "운영센터 요약 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("overallStatus", "refreshedAt", "domainType", "title", "value", "targetRoute"),
                        Arrays.asList("SELECT"),
                        "운영 상태와 도메인별 요약 카드의 현재 조회 모델입니다."),
                schema("operations-center-priority-schema", "운영센터 우선 대응 큐 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("itemId", "domainType", "sourceType", "severity", "title", "description", "occurredAt", "targetRoute"),
                        Arrays.asList("SELECT"),
                        "우선 대응 큐를 표시하기 위한 현재 조회 모델입니다."),
                schema("operations-center-incident-lifecycle-schema", "운영센터 Incident lifecycle 스키마", "PENDING_OPERATIONS_INCIDENT",
                        Arrays.asList("incidentId", "sourceType", "sourceRef", "metricSourceRef", "status", "severity", "assigneeId", "acknowledgedAt", "escalatedAt", "closedAt", "evidenceRef"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 acknowledge, assignment, escalation, closeout을 저장할 incident lifecycle 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("OPERATIONS_DOMAIN_TYPE", "운영센터 도메인 유형", Arrays.asList("MEMBER", "EMISSION", "INTEGRATION", "CONTENT", "SECURITY_SYSTEM", "OPERATIONS_TOOLS"), "운영센터 요약과 큐 필터 기준입니다."),
                codeGroup("OPERATIONS_INCIDENT_STATUS", "운영센터 Incident 상태", Arrays.asList("OPEN", "ACKNOWLEDGED", "ASSIGNED", "ESCALATED", "CLOSED", "REOPENED"), "incident lifecycle 상태 전이 기준입니다."),
                codeGroup("OPERATIONS_INCIDENT_ACTION", "운영센터 Incident 조치 유형", Arrays.asList("ACKNOWLEDGE", "ASSIGN", "ESCALATE", "CLOSEOUT", "REOPEN"), "운영센터 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildBatchManagementPage() {
        Map<String, Object> page = pageOption("batch-management", "배치 관리", "/admin/system/batch", "A0060304", "admin");
        page.put("summary", "배치 잡, 큐 적체, 워커 노드, 최근 실행 이력을 한 화면에서 운영 점검하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/batch-management/BatchManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("batch-management-closeout-gate", "배치 완료 게이트", "[data-help-id=\"batch-management-closeout-gate\"]", "BatchCloseoutGate", "content",
                        Collections.emptyList(), "잡 스케줄, 큐 적체, 워커 상태, 변경 감사 준비 상태를 구분해 보여줍니다."),
                surface("batch-management-action-contract", "배치 실행 계약", "[data-help-id=\"batch-management-action-contract\"] button[disabled]", "BatchActionContract", "actions",
                        Collections.emptyList(), "일시중지, 재개, 재시도, 큐 drain 액션은 백엔드 계약 연결 전까지 비활성 상태로 노출합니다."),
                surface("batch-management-filters", "배치 조회 조건", "[data-help-id=\"batch-management-filters\"]", "BatchManagementFilters", "actions",
                        Arrays.asList("batch-management-filter", "batch-management-reset"), "키워드, 잡 상태, 노드 상태로 배치 범위를 좁힙니다."),
                surface("batch-management-summary", "배치 요약 카드", "[data-help-id=\"batch-management-summary\"]", "BatchManagementSummaryCards", "header",
                        Collections.emptyList(), "조회 잡 수, 큐 적체, 정상 노드, 실패/재검토 실행을 요약합니다."),
                surface("batch-management-jobs", "배치 잡 목록", "[data-help-id=\"batch-management-jobs\"]", "BatchManagementJobTable", "content",
                        Collections.emptyList(), "배치 잡과 큐 소유, 실행 상태를 목록으로 제공합니다."),
                surface("batch-management-queues", "큐 적체 현황", "[data-help-id=\"batch-management-queues\"]", "BatchManagementQueueTable", "content",
                        Collections.emptyList(), "큐별 backlog, 소비 노드, 최근 메시지 시각을 보여줍니다."),
                surface("batch-management-nodes", "워커 노드", "[data-help-id=\"batch-management-nodes\"]", "BatchManagementNodeTable", "content",
                        Collections.emptyList(), "배치 노드 상태와 큐 affinity를 한눈에 확인합니다."),
                surface("batch-management-executions", "최근 배치 실행", "[data-help-id=\"batch-management-executions\"]", "BatchManagementExecutionTable", "content",
                        Collections.emptyList(), "최근 배치 실행 결과와 메시지를 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("batch-management-filter", "배치 조건 변경", "change", "applyBatchFilter", "[data-help-id=\"batch-management-filters\"] input, [data-help-id=\"batch-management-filters\"] select",
                        Arrays.asList("admin.batch-management.page"), "조건 변경 시 배치 목록과 큐, 노드를 다시 계산합니다."),
                event("batch-management-reset", "배치 조건 초기화", "click", "resetBatchFilter", "[data-help-id=\"batch-management-filters\"] button",
                        Arrays.asList("admin.batch-management.page"), "조회 조건을 초기 상태로 되돌립니다."),
                event("batch-management-action-contract-blocked", "배치 실행 계약 차단 상태 표시", "render", "BatchCloseoutPanel", "[data-help-id=\"batch-management-action-contract\"]",
                        Collections.emptyList(), "백엔드 실행 API, 권한 기능 코드, 감사 이벤트가 연결되기 전까지 배치 변경 액션을 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("batch-job-row-schema", "배치 잡 행 스키마", "SCHEDULER_JOB + SNAPSHOT_CARD",
                        Arrays.asList("jobId", "jobName", "queueName", "executionType", "jobStatus", "lastRunAt", "nextRunAt", "owner"),
                        Arrays.asList("SELECT"),
                        "배치 잡의 실행 주기와 큐 소속, 담당자를 보여주는 행입니다."),
                schema("batch-queue-row-schema", "배치 큐 행 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("queueId", "queueName", "backlogCount", "consumerNode", "lastMessageAt", "status"),
                        Arrays.asList("SELECT"),
                        "큐 적체량과 소비 상태를 보여줍니다."),
                schema("batch-node-row-schema", "배치 노드 행 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("nodeId", "role", "affinity", "status", "heartbeatAt"),
                        Arrays.asList("SELECT"),
                        "배치 워커 노드 상태와 affinity를 조회합니다."),
                schema("batch-execution-row-schema", "배치 실행 행 스키마", "SCHEDULER_EXECUTION + SNAPSHOT_CARD",
                        Arrays.asList("executedAt", "jobId", "result", "duration", "message"),
                        Arrays.asList("SELECT"),
                        "최근 배치 실행 결과와 메시지를 시간순으로 보여줍니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("BATCH_JOB_STATUS", "배치 잡 상태", Arrays.asList("ACTIVE", "PAUSED", "REVIEW"), "배치 잡 상태 필터에 사용됩니다."),
                codeGroup("BATCH_NODE_STATUS", "배치 노드 상태", Arrays.asList("HEALTHY", "STANDBY", "DEGRADED"), "워커 노드 상태 필터와 배지 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalConnectionAddPage() {
        Map<String, Object> page = pageOption("external-connection-add", "외부연계 등록", "/admin/external/connection_add", "A0050102", "admin");
        page.put("summary", "외부연계 대상을 신규 등록하고 인증, 네트워크, 운영 담당 체계를 함께 정의하는 관리자 등록 화면입니다.");
        page.put("source", "frontend/src/features/external-connection-add/ExternalConnectionAddMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-connection-add-actions", "외부연계 등록 액션바", "[data-help-id=\"external-connection-add-actions\"]", "ExternalConnectionAddActionBar", "actions",
                        Arrays.asList("external-connection-add-validate"), "등록 초안 검증, 초기화, 운영 연결 화면 이동을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-connection-add-validate", "외부연계 등록 초안 검증", "submit", "handleSubmit", "form",
                        Collections.emptyList(), "필수 입력값과 운영 필드를 검증합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-connection-draft-schema", "외부연계 등록 초안 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("connectionId", "connectionName", "partnerName", "endpointUrl", "authType", "ipPolicy", "syncCycle", "ownerName"),
                        Arrays.asList("INSERT"),
                        "외부연계 등록 화면에서 입력하는 초안 필드 묶음입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_CONNECTION_TYPE", "외부연계 유형", Arrays.asList("REST_API", "SOAP", "SFTP", "WEBHOOK", "MQ"), "외부연계 등록 유형 선택값입니다."),
                codeGroup("EXTERNAL_AUTH_TYPE", "외부연계 인증 유형", Arrays.asList("OAUTH2_CLIENT", "API_KEY", "MUTUAL_TLS", "BASIC_AUTH"), "외부연계 인증 방식 선택값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalKeysPage() {
        Map<String, Object> page = pageOption("external-keys", "외부 인증키 관리", "/admin/external/keys", "A0050103", "admin");
        page.put("summary", "외부연계 인증키의 교체 주기, 담당자, 만료 예정 상태를 비밀값 노출 없이 점검하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-keys/ExternalKeysMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-keys-closeout-gate", "외부 인증키 완료 게이트", ".gov-card [data-help-id=\"external-keys-action-contract\"]", "ExternalKeyCloseoutGate", "content",
                        Collections.emptyList(), "마스킹, 파트너 범위, 만료 정책, 변경 감사 준비 상태를 구분해 보여줍니다."),
                surface("external-keys-action-contract", "외부 인증키 실행 계약", ".gov-card button[disabled]", "ExternalKeyActionContract", "actions",
                        Collections.emptyList(), "발급, 회전, 폐기, 감사 내보내기 액션은 백엔드 계약 연결 전까지 비활성 상태로 노출합니다."),
                surface("external-keys-filters", "외부 인증키 조회 조건", ".gov-card .gov-input, .gov-card .gov-select", "ExternalKeyFilters", "actions",
                        Collections.emptyList(), "연계명, 인증 방식, 교체 상태 기준으로 관리 대상을 좁힙니다."),
                surface("external-keys-inventory", "외부 인증키 인벤토리", ".gov-card table", "ExternalKeyInventoryTable", "content",
                        Collections.emptyList(), "연계별 인증키 상태, 교체 예정일, 담당자를 함께 보여줍니다."),
                surface("external-keys-rotation-queue", "외부 인증키 교체 큐", ".gov-card .w-full.border-collapse", "ExternalKeyRotationQueue", "content",
                        Collections.emptyList(), "교체 시급도와 정책 기준으로 후속 조치 대상을 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-keys-filter-change", "외부 인증키 조회 조건 변경", "change", "setKeyword/setAuthMethod/setRotationStatus", "form",
                        Collections.emptyList(), "조회 조건에 따라 인증키 인벤토리를 필터링합니다."),
                event("external-keys-action-contract-blocked", "외부 인증키 실행 계약 차단 상태 표시", "render", "ExternalKeyCloseoutPanel", "section",
                        Collections.emptyList(), "백엔드 실행 API와 감사 이벤트가 연결되기 전까지 인증키 변경 액션을 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-key-governance-schema", "외부 인증키 거버넌스 스키마", "TABLE",
                        Arrays.asList("connectionId", "credentialLabel", "authMethod", "rotationPolicy", "lastRotatedAt", "expiresAt", "rotationStatus", "ownerName"),
                        Arrays.asList("SELECT"),
                        "외부 인증키 상태와 교체 우선순위를 보여주는 런타임 필드 묶음입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_AUTH_TYPE", "외부연계 인증 유형", Arrays.asList("OAUTH2", "API_KEY", "MUTUAL_TLS", "BASIC", "OBSERVED"), "외부 인증키 관리 화면의 인증 방식 필터와 상태 구분값입니다."),
                codeGroup("EXTERNAL_KEY_ROTATION_STATUS", "외부 인증키 교체 상태", Arrays.asList("HEALTHY", "ROTATE_SOON", "ROTATE_NOW", "EXPIRED"), "외부 인증키 관리 화면의 교체 상태 배지 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalSyncPage() {
        Map<String, Object> page = pageOption("external-sync", "동기화 실행", "/admin/external/sync", "A0050104", "admin");
        page.put("summary", "외부연계 동기화 대상의 실행 방식, 큐 적체, 최근 실행 결과를 함께 점검하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-sync/ExternalSyncMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-sync-filters", "동기화 조회 조건", ".gov-card .gov-input, .gov-card .gov-select", "ExternalSyncFilters", "actions",
                        Collections.emptyList(), "연계명, 동기화 방식, 상태 기준으로 대상을 좁힙니다."),
                surface("external-sync-registry", "동기화 대상 현황", ".gov-card table", "ExternalSyncRegistryTable", "content",
                        Collections.emptyList(), "대상별 실행 방식, 스케줄, 적체, 상태를 함께 보여줍니다."),
                surface("external-sync-queue", "동기화 큐 적체", ".gov-card .w-full.border-collapse", "ExternalSyncQueueTable", "content",
                        Collections.emptyList(), "큐 적체와 소비 노드 상태를 운영 관점에서 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-sync-filter-change", "동기화 조회 조건 변경", "change", "setKeyword/setSyncMode/setStatus", "form",
                        Collections.emptyList(), "조회 조건에 따라 동기화 대상 목록을 필터링합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-sync-runtime-schema", "외부연계 동기화 런타임 스키마", "TABLE",
                        Arrays.asList("jobId", "connectionId", "syncMode", "triggerType", "schedule", "lastSyncAt", "nextSyncAt", "backlogCount", "status"),
                        Arrays.asList("SELECT"),
                        "외부연계 동기화 실행 상태와 큐 적체를 조회하는 런타임 필드 묶음입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_SYNC_MODE", "외부연계 동기화 방식", Arrays.asList("SCHEDULED", "HYBRID", "WEBHOOK"), "동기화 실행 화면의 방식 필터와 상태 구분값입니다."),
                codeGroup("EXTERNAL_SYNC_STATUS", "외부연계 동기화 상태", Arrays.asList("ACTIVE", "DEGRADED", "REVIEW", "DISABLED"), "동기화 실행 화면의 상태 배지와 필터 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalSchemaPage() {
        Map<String, Object> page = pageOption("external-schema", "외부 스키마", "/admin/external/schema", "A0050202", "admin");
        page.put("summary", "외부 계약 스키마 목록, 계약 스냅샷, 검토 대기열을 확인하고 아직 차단된 버전 발행, 호환성 검사, 롤백, 엔드포인트 바인딩, 변경감사 계약을 구분하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-schema/ExternalSchemaMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-schema-summary", "외부 스키마 요약 카드", "[data-help-id=\"external-schema-summary\"]", "ExternalSchemaSummaryCards", "content",
                        Collections.emptyList(), "검토 대기 수, 검증 실패 수, 민감 필드 현황을 요약합니다."),
                surface("external-schema-closeout-gate", "외부 스키마 완료 게이트", "[data-help-id=\"external-schema-closeout-gate\"]", "ExternalSchemaCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 레지스트리 조회, 계약 스냅샷, 검토 대기열과 아직 필요한 발행, 호환성 검사, 롤백, 바인딩, 변경감사 계약을 구분합니다."),
                surface("external-schema-action-contract", "외부 스키마 조치 계약", "[data-help-id=\"external-schema-action-contract\"] button[disabled]", "ExternalSchemaActionContract", "actions",
                        Collections.emptyList(), "버전 발행, 호환성 검사, 롤백, 엔드포인트 바인딩, 변경감사 저장은 백엔드 실행·권한·감사 연결 전까지 비활성화합니다."),
                surface("external-schema-filters", "외부 스키마 조회 조건", "[data-help-id=\"external-schema-filters\"]", "ExternalSchemaFilters", "actions",
                        Collections.emptyList(), "스키마, 연계, 도메인, 검증 상태 기준으로 대상을 좁힙니다."),
                surface("external-schema-registry", "외부 계약 스키마", "[data-help-id=\"external-schema-registry\"]", "ExternalSchemaRegistryTable", "content",
                        Collections.emptyList(), "스키마 버전, 필드 수, 담당자, 민감도, 검증 상태를 함께 보여줍니다."),
                surface("external-schema-review", "선택 계약 검토", "[data-help-id=\"external-schema-review\"]", "ExternalSchemaReviewPanel", "content",
                        Collections.emptyList(), "선택 스키마의 계약 요약, 대표 필드, JSON 스냅샷, 검토 체크리스트를 보여줍니다."),
                surface("external-schema-review-queue", "스키마 검토 대기열", "[data-help-id=\"external-schema-review-queue\"]", "ExternalSchemaReviewQueue", "content",
                        Collections.emptyList(), "호환성, 마스킹, 거버넌스 담당 확인이 필요한 스키마 대기열을 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-schema-filter-change", "외부 스키마 조회 조건 변경", "change", "setKeyword/setDomain/setStatus", "[data-help-id=\"external-schema-filters\"]",
                        Collections.singletonList("admin.external-schema.page"), "조회 조건에 따라 외부 계약 스키마 목록을 필터링합니다."),
                event("external-schema-select", "외부 스키마 선택", "click", "setSelectedSchemaId", "[data-help-id=\"external-schema-registry\"] button",
                        Collections.singletonList("admin.external-schema.page"), "선택된 스키마의 계약 스냅샷과 검토 체크리스트를 갱신합니다."),
                event("external-schema-contract-copy", "계약 스냅샷 복사", "click", "handleCopyContract", "[data-help-id=\"external-schema-review\"] button",
                        Collections.emptyList(), "선택 스키마의 JSON 계약 스냅샷을 클립보드로 복사합니다."),
                event("external-schema-action-contract-blocked", "외부 스키마 조치 차단 상태 표시", "render", "ExternalSchemaActionContract", "[data-help-id=\"external-schema-action-contract\"]",
                        Collections.emptyList(), "발행, 호환성 검사, 롤백, 엔드포인트 바인딩, 변경감사 API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-schema-runtime-schema", "외부연계 스키마 런타임 스키마", "SNAPSHOT_CARD",
                        Arrays.asList("schemaId", "connectionId", "connectionName", "domain", "direction", "schemaVersion", "tableName", "columns", "validationStatus", "piiLevel", "ownerName"),
                        Arrays.asList("SELECT"),
                        "외부 계약 스키마 목록, 선택 계약 스냅샷, 검토 대기열에 사용되는 조회 필드 묶음입니다."),
                schema("external-schema-version-schema", "외부연계 스키마 버전 스키마", "PENDING_EXTERNAL_SCHEMA_VERSION",
                        Arrays.asList("schemaId", "currentVersion", "publishedVersion", "rollbackVersion", "publishStatus", "approvalStatus", "publishedBy", "publishedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 버전 발행과 롤백 상태 전이를 저장할 정책 모델입니다."),
                schema("external-schema-compatibility-schema", "외부연계 스키마 호환성 검사 스키마", "PENDING_EXTERNAL_SCHEMA_COMPATIBILITY",
                        Arrays.asList("checkId", "schemaId", "samplePayloadRef", "parserVersion", "resultStatus", "blockingReason", "evidenceRef", "checkedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "호환성 검사 결과와 차단 증적을 저장할 실행 결과 모델입니다."),
                schema("external-schema-change-audit-schema", "외부연계 스키마 변경감사 스키마", "PENDING_EXTERNAL_SCHEMA_CHANGE_AUDIT",
                        Arrays.asList("auditId", "schemaId", "actionType", "beforeVersion", "afterVersion", "diffRef", "approvalId", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "발행, 롤백, 바인딩 변경의 전후 상태와 승인 증적을 저장할 감사 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_SCHEMA_DOMAIN", "외부연계 스키마 도메인", Arrays.asList("COMMON", "MEMBER", "EMISSION", "SECURITY", "OPERATIONS"), "외부 스키마 화면의 도메인 필터 기준입니다."),
                codeGroup("EXTERNAL_SCHEMA_STATUS", "외부연계 스키마 검증 상태", Arrays.asList("ACTIVE", "WATCH", "REVIEW", "DISABLED"), "외부 스키마 화면의 검증 상태 배지와 필터 기준입니다."),
                codeGroup("EXTERNAL_SCHEMA_ACTION", "외부연계 스키마 조치 유형", Arrays.asList("PUBLISH_VERSION", "COMPATIBILITY_CHECK", "ROLLBACK", "ENDPOINT_BIND", "AUDIT_RECORD"), "스키마 변경 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("external-schema-version", "스키마 버전", Arrays.asList("schemaId", "currentVersion", "publishedVersion", "rollbackVersion", "publishStatus"), "버전 발행과 롤백 상태를 관리합니다."),
                changeTarget("external-schema-binding", "엔드포인트 바인딩", Arrays.asList("schemaId", "endpointId", "boundVersion", "compatibilityStatus"), "외부 endpoint별 적용 스키마 버전을 관리합니다."),
                changeTarget("external-schema-audit", "변경감사", Arrays.asList("schemaId", "actionType", "beforeVersion", "afterVersion", "diffRef", "approvalId"), "스키마 변경 전후와 승인 증적을 보관합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildExternalWebhooksPage() {
        Map<String, Object> page = pageOption("external-webhooks", "웹훅 설정", "/admin/external/webhooks", "A0050203", "admin");
        page.put("summary", "외부연계 웹훅 대상의 엔드포인트 상태, 서명 검증, 재시도 정책을 점검하고 아직 차단된 CRUD, secret 회전, 테스트 발송, replay, 실패 정책 저장 계약을 구분하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-webhooks/ExternalWebhooksMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-webhooks-summary", "웹훅 요약 카드", "[data-help-id=\"external-webhooks-summary\"]", "ExternalWebhookSummaryCards", "content",
                        Collections.emptyList(), "활성 대상 수, 실패 건수, 서명 이상 등 웹훅 상태를 요약합니다."),
                surface("external-webhooks-closeout-gate", "웹훅 완료 게이트", "[data-help-id=\"external-webhooks-closeout-gate\"]", "ExternalWebhookCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 조회/정책 확인과 아직 필요한 CRUD, secret 회전, 테스트 발송, replay, 실패 정책 저장 계약을 구분합니다."),
                surface("external-webhooks-action-contract", "웹훅 변경 조치 계약", "[data-help-id=\"external-webhooks-action-contract\"] button[disabled]", "ExternalWebhookActionContract", "actions",
                        Collections.emptyList(), "endpoint 추가, secret 회전, 테스트 발송, 실패 replay는 백엔드 실행·권한·감사 연결 전까지 비활성화합니다."),
                surface("external-webhooks-filters", "웹훅 조회 조건", "[data-help-id=\"external-webhooks-filters\"]", "ExternalWebhookFilters", "actions",
                        Collections.emptyList(), "엔드포인트, 상태, 전달 방식 기준으로 웹훅 대상을 좁힙니다."),
                surface("external-webhooks-registry", "웹훅 엔드포인트 현황", "[data-help-id=\"external-webhooks-targets\"]", "ExternalWebhookRegistryTable", "content",
                        Collections.emptyList(), "엔드포인트, 서명 상태, 성공률, 실패 건수를 함께 보여줍니다."),
                surface("external-webhooks-policy", "전달 정책", "[data-help-id=\"external-webhooks-deliveries\"]", "ExternalWebhookPolicyTable", "content",
                        Collections.emptyList(), "이벤트 유형별 재시도 정책, 타임아웃, 실패 후 처리 기준을 운영 관점에서 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-webhooks-filter-change", "웹훅 조회 조건 변경", "change", "setKeyword/setStatus/setSyncMode", "form",
                        Collections.singletonList("admin.external-webhooks.page"), "조회 조건에 따라 웹훅 엔드포인트 목록을 필터링합니다."),
                event("external-webhooks-action-contract-blocked", "웹훅 변경 조치 차단 상태 표시", "render", "ExternalWebhookActionContract", "[data-help-id=\"external-webhooks-action-contract\"]",
                        Collections.emptyList(), "endpoint CRUD, secret 회전, 테스트 발송, replay, 실패 정책 저장 API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-webhook-runtime-schema", "외부연계 웹훅 런타임 스키마", "TABLE",
                        Arrays.asList("webhookId", "connectionId", "endpointUrl", "syncMode", "signatureStatus", "successRate", "failedCount", "lastEventAt", "status"),
                        Arrays.asList("SELECT"),
                        "외부연계 웹훅 엔드포인트 상태와 전달 정책을 조회하는 런타임 필드 묶음입니다."),
                schema("external-webhook-policy-schema", "외부연계 웹훅 정책 스키마", "PENDING_EXTERNAL_WEBHOOK_POLICY",
                        Arrays.asList("webhookId", "endpointUrl", "signingSecretRef", "secretVersion", "graceUntil", "timeoutSeconds", "retryPolicy", "deadLetterPolicy", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 endpoint CRUD, secret 회전, 실패 정책 저장을 위한 정책 모델입니다."),
                schema("external-webhook-delivery-action-schema", "외부연계 웹훅 발송 조치 스키마", "PENDING_EXTERNAL_WEBHOOK_DELIVERY_ACTION",
                        Arrays.asList("deliveryId", "webhookId", "actionType", "idempotencyKey", "requestPayloadRef", "responseStatus", "resultMessage", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "테스트 발송과 실패 replay 결과를 저장할 조치 이력 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_SYNC_MODE", "외부연계 동기화 방식", Arrays.asList("WEBHOOK", "HYBRID"), "웹훅 설정 화면의 전달 방식 필터 값입니다."),
                codeGroup("EXTERNAL_WEBHOOK_STATUS", "외부연계 웹훅 상태", Arrays.asList("ACTIVE", "DEGRADED", "REVIEW", "DISABLED"), "웹훅 설정 화면의 상태 배지 기준입니다."),
                codeGroup("EXTERNAL_WEBHOOK_ACTION", "외부연계 웹훅 조치 유형", Arrays.asList("ENDPOINT_SAVE", "SECRET_ROTATE", "TEST_DELIVERY", "REPLAY_FAILED", "FAILURE_POLICY_SAVE"), "웹훅 변경 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalMaintenancePage() {
        Map<String, Object> page = pageOption("external-maintenance", "점검 관리", "/admin/external/maintenance", "A0050107", "admin");
        page.put("summary", "외부연계 점검 윈도우, 영향 범위, 대체 절차, 복구 확인 항목을 확인하고 아직 차단된 점검 CRUD, 승인/해제, 공지, replay, incident 계약을 구분하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-maintenance/ExternalMaintenanceMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-maintenance-summary", "점검 요약 카드", "[data-help-id=\"external-maintenance-summary\"]", "ExternalMaintenanceSummaryCards", "content",
                        Collections.emptyList(), "진행 중 점검, 복구 대기, 영향 대상 수를 요약합니다."),
                surface("external-maintenance-closeout-gate", "점검 관리 완료 게이트", "[data-help-id=\"external-maintenance-closeout-gate\"]", "ExternalMaintenanceCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 점검 현황/영향/런북 조회와 아직 필요한 CRUD, 승인/해제, 공지, replay, incident 계약을 구분합니다."),
                surface("external-maintenance-action-contract", "점검 전이 조치 계약", "[data-help-id=\"external-maintenance-action-contract\"] button[disabled]", "ExternalMaintenanceActionContract", "actions",
                        Collections.emptyList(), "점검 등록, 승인 요청, 공지 계획, backlog replay, incident 생성은 workflow·권한·감사 연결 전까지 비활성화합니다."),
                surface("external-maintenance-filters", "점검 조회 조건", "[data-help-id=\"external-maintenance-filters\"]", "ExternalMaintenanceFilters", "actions",
                        Collections.emptyList(), "연계명, 동기화 방식, 점검 상태 기준으로 목록을 좁힙니다."),
                surface("external-maintenance-table", "점검 대상 현황", "[data-help-id=\"external-maintenance-inventory\"]", "ExternalMaintenanceTable", "content",
                        Collections.emptyList(), "점검 예정 시각, 영향 범위, 대체 경로, 상태를 함께 보여줍니다."),
                surface("external-maintenance-impact", "점검 영향 검토", "[data-help-id=\"external-maintenance-impact\"]", "ExternalMaintenanceImpactTable", "content",
                        Collections.emptyList(), "연계별 영향 범위와 운영 조치를 비교합니다."),
                surface("external-maintenance-runbook", "점검 운영 런북", "[data-help-id=\"external-maintenance-runbook\"]", "ExternalMaintenanceRunbook", "content",
                        Collections.emptyList(), "사전, 점검 중, 복구 후 절차를 운영 관점에서 제공합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-maintenance-filter-change", "점검 조회 조건 변경", "change", "setKeyword/setSyncMode/setStatus", "form",
                        Collections.singletonList("admin.external-maintenance.page"), "조회 조건에 따라 점검 대상 목록을 필터링합니다."),
                event("external-maintenance-action-contract-blocked", "점검 변경 조치 차단 상태 표시", "render", "ExternalMaintenanceActionContract", "[data-help-id=\"external-maintenance-action-contract\"]",
                        Collections.emptyList(), "점검 CRUD, 승인/해제, 영향 scope, 공지, replay, incident API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-maintenance-runtime-schema", "외부연계 점검 런타임 스키마", "TABLE",
                        Arrays.asList("maintenanceId", "connectionId", "connectionName", "syncMode", "maintenanceWindow", "plannedAt", "impactScope", "fallbackRoute", "backlogCount", "maintenanceStatus"),
                        Arrays.asList("SELECT"),
                        "외부연계 점검 상태와 영향 범위를 함께 점검하는 운영 필드 묶음입니다."),
                schema("external-maintenance-window-schema", "외부연계 점검 윈도우 스키마", "PENDING_EXTERNAL_MAINTENANCE_WINDOW",
                        Arrays.asList("maintenanceId", "connectionId", "plannedStartAt", "plannedEndAt", "status", "approvalStatus", "fallbackRoute", "noticePlanId", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"),
                        "향후 점검 CRUD, 승인/해제, 공지 계획을 저장할 정책 모델입니다."),
                schema("external-maintenance-action-schema", "외부연계 점검 조치 이력 스키마", "PENDING_EXTERNAL_MAINTENANCE_ACTION",
                        Arrays.asList("actionId", "maintenanceId", "actionType", "idempotencyKey", "resultStatus", "evidenceRef", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "승인, 해제, backlog replay, incident handoff 결과를 저장할 조치 이력 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_MAINTENANCE_STATUS", "외부연계 점검 상태", Arrays.asList("READY", "DUE_SOON", "BLOCKED"), "점검 관리 화면의 상태 배지와 필터 기준입니다."),
                codeGroup("EXTERNAL_MAINTENANCE_SYNC_MODE", "외부연계 점검 동기화 방식", Arrays.asList("SCHEDULED", "HYBRID", "WEBHOOK"), "점검 관리 화면의 동기화 방식 필터 기준입니다."),
                codeGroup("EXTERNAL_MAINTENANCE_ACTION", "외부연계 점검 조치 유형", Arrays.asList("WINDOW_SAVE", "APPROVAL_REQUEST", "RELEASE", "SCOPE_PREVIEW", "NOTICE_PLAN", "BACKLOG_REPLAY", "INCIDENT_OPEN"), "점검 변경 조치 권한과 감사 이벤트 구분값입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalUsagePage() {
        Map<String, Object> page = pageOption("external-usage", "API 사용량", "/admin/external/usage", "A0050108", "admin");
        page.put("summary", "외부연계 API 호출량, 인증 방식별 소비 현황, 최근 호출 추이를 함께 점검하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-usage/ExternalUsageMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-usage-filters", "API 사용량 조회 조건", ".gov-card .gov-input, .gov-card .gov-select", "ExternalUsageFilters", "actions",
                        Collections.emptyList(), "연계, 인증 방식, 상태 기준으로 사용량 범위를 좁힙니다."),
                surface("external-usage-table", "외부연계 API 사용 현황", ".gov-card table", "ExternalUsageTable", "content",
                        Collections.emptyList(), "연계별 호출 수, 성공률, 평균 지연, 최근 호출 시각을 함께 보여줍니다."),
                surface("external-usage-trend", "최근 사용 추이", ".gov-card .w-full.border-collapse", "ExternalUsageTrendTable", "content",
                        Collections.emptyList(), "일자별 호출 수와 오류 수를 운영 관점에서 비교합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-usage-filter-change", "API 사용량 조회 조건 변경", "change", "setKeyword/setAuthMethod/setStatus", "form",
                        Collections.emptyList(), "조회 조건에 따라 API 사용량 목록을 필터링합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-usage-runtime-schema", "외부연계 API 사용량 런타임 스키마", "TABLE",
                        Arrays.asList("connectionId", "connectionName", "partnerName", "authMethod", "requestCount", "successRate", "avgDurationMs", "lastSeenAt", "status"),
                        Arrays.asList("SELECT"),
                        "외부연계 API 호출량과 오류·지연 상태를 함께 점검하는 운영 필드 묶음입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_USAGE_AUTH_METHOD", "외부연계 인증 방식", Arrays.asList("OAUTH2", "API_KEY", "MUTUAL_TLS", "OBSERVED"), "API 사용량 화면의 인증 방식 필터 기준입니다."),
                codeGroup("EXTERNAL_USAGE_STATUS", "외부연계 사용 상태", Arrays.asList("HEALTHY", "WARNING", "DEGRADED"), "API 사용량 화면의 상태 배지와 필터 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalMonitoringPage() {
        Map<String, Object> page = pageOption("external-monitoring", "연계 모니터링", "/admin/external/monitoring", "A0050106", "admin");
        page.put("summary", "외부연계 상태, 동기화 적체, 웹훅 전달 위험, 최근 경보를 통합 관점으로 점검하는 관리자 운영 화면입니다.");
        page.put("source", "frontend/src/features/external-monitoring/ExternalMonitoringMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-monitoring-filters", "모니터링 조회 조건", ".gov-card .gov-input, .gov-card .gov-select", "ExternalMonitoringFilters", "actions",
                        Collections.emptyList(), "연계, 건강 상태, 경보 등급 기준으로 운영 범위를 좁힙니다."),
                surface("external-monitoring-overview", "연계 모니터링 현황", ".gov-card table", "ExternalMonitoringOverviewTable", "content",
                        Collections.emptyList(), "연계별 호출량, 성공률, 적체, 활성 경보를 한 테이블에서 보여줍니다."),
                surface("external-monitoring-alerts", "활성 경보", ".gov-card .w-full.border-collapse", "ExternalMonitoringAlertTable", "content",
                        Collections.emptyList(), "동기화 적체, 호출 오류, 웹훅 상태 저하를 하나의 조치 큐로 통합합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-monitoring-filter-change", "모니터링 조회 조건 변경", "change", "setKeyword/setHealthStatus/setAlertLevel", "form",
                        Collections.emptyList(), "조회 조건에 따라 연계 모니터링 현황을 필터링합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-monitoring-runtime-schema", "외부연계 모니터링 런타임 스키마", "TABLE",
                        Arrays.asList("connectionId", "requestCount", "successRate", "backlogCount", "alertCount", "topAlertLevel", "status", "lastObservedAt"),
                        Arrays.asList("SELECT"),
                        "외부연계 운영 상태와 경보 우선순위를 함께 보여주는 통합 모니터링 필드 묶음입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_MONITORING_STATUS", "외부연계 모니터링 상태", Arrays.asList("ACTIVE", "REVIEW", "DEGRADED"), "연계 모니터링 화면의 건강 상태 필터와 배지 기준입니다."),
                codeGroup("EXTERNAL_MONITORING_ALERT_LEVEL", "외부연계 경보 등급", Arrays.asList("CRITICAL", "HIGH", "MEDIUM", "NONE"), "연계 모니터링 화면의 경보 필터와 우선순위 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildErrorLogPage() {
        Map<String, Object> page = pageOption("error-log", "에러 로그", "/admin/system/error-log", "A0060302", "admin");
        page.put("summary", "백엔드 오류, 페이지 격리 오류, 프런트 오류 리포트를 영구 추적으로 조회하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/error-log/ErrorLogMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("error-log-search", "에러 로그 검색", "[data-help-id=\"error-log-search\"]", "ErrorLogSearch", "actions",
                        Arrays.asList("error-log-search-submit"), "회사, 소스 유형, 오류 유형과 검색어를 조합합니다."),
                surface("error-log-table", "에러 로그 테이블", "[data-help-id=\"error-log-table\"]", "ErrorLogTable", "content",
                        Collections.emptyList(), "영구 저장된 에러 로그를 시간 역순으로 조회합니다.")
        ));
        page.put("events", Arrays.asList(
                event("error-log-search-submit", "에러 로그 조회", "submit", "fetchErrorLogPage", "[data-help-id=\"error-log-search\"] form",
                        Arrays.asList("admin.error-log.page"), "에러 로그 테이블을 갱신합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("error-event-schema", "에러 이벤트 스키마", "ERROR_EVENT",
                        Arrays.asList("ERROR_ID", "TRACE_ID", "PAGE_ID", "API_ID", "SOURCE_TYPE", "ERROR_TYPE", "ACTOR_ID", "ACTOR_INSTT_ID", "REQUEST_URI", "MESSAGE", "RESULT_STATUS", "CREATED_AT"),
                        Arrays.asList("SELECT", "INSERT"), "영구 에러 로그 조회 테이블입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildExternalLogsPage() {
        Map<String, Object> page = pageOption("external-logs", "외부 연계 로그", "/admin/external/logs", "A0050303", "admin");
        page.put("summary", "외부연계 access, error, trace 이벤트를 하나의 운영 큐로 합쳐 최근 이슈와 감시 대상을 함께 확인하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/external-logs/ExternalLogsMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("external-logs-filters", "외부연계 로그 조회 조건", ".gov-card .gov-input, .gov-card .gov-select", "ExternalLogFilters", "actions",
                        Arrays.asList("external-logs-filter-change"), "검색어, 로그 유형, 위험도 기준으로 최근 외부연계 로그를 좁힙니다."),
                surface("external-logs-table", "외부연계 최근 로그", ".gov-card table", "ExternalLogTable", "content",
                        Collections.emptyList(), "접근, 오류, 추적 로그를 시간 역순으로 조회합니다."),
                surface("external-logs-watchlist", "외부연계 감시 대상", ".gov-card .w-full.border-collapse", "ExternalLogWatchList", "content",
                        Collections.emptyList(), "상태 저하 연계와 최근 이슈를 함께 점검합니다.")
        ));
        page.put("events", Arrays.asList(
                event("external-logs-filter-change", "외부연계 로그 조회 조건 변경", "change", "setKeyword/setLogType/setSeverity", "form",
                        Arrays.asList("admin.external.logs.page"), "로그 필터를 갱신합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("external-log-runtime-schema", "외부연계 로그 런타임 스키마", "TABLE",
                        Arrays.asList("occurredAt", "logType", "severity", "traceId", "apiId", "connectionName", "requestUri", "status", "detail"),
                        Arrays.asList("SELECT"),
                        "외부연계 운영 로그 화면의 통합 이벤트 행 스키마입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("EXTERNAL_LOG_TYPE", "외부연계 로그 유형", Arrays.asList("ACCESS", "ERROR", "TRACE"), "외부연계 로그 화면의 로그 유형 필터 기준입니다."),
                codeGroup("EXTERNAL_LOG_SEVERITY", "외부연계 로그 위험도", Arrays.asList("DANGER", "WARNING", "NEUTRAL"), "외부연계 로그 화면의 위험도 배지와 필터 기준입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildScreenFlowManagementPage() {
        Map<String, Object> page = pageOption("screen-flow-management", "화면 흐름 관리", "/admin/system/screen-flow-management", "A1900109", "admin");
        page.put("summary", "등록된 화면의 route, surface, event, API, schema, 권한 변경 체인을 읽기 전용으로 점검하고 아직 차단된 flow CRUD, transition 편집, 버전 발행, 영향도 preview, 감사 계약을 구분하는 시스템 메타 화면입니다.");
        page.put("source", "frontend/src/features/screen-management/ScreenFlowManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("screen-flow-summary", "화면 흐름 요약 카드", "[data-help-id=\"screen-flow-summary\"]", "ScreenFlowSummaryCards", "content",
                        Collections.emptyList(), "등록 화면 수와 선택 화면의 surface, event, API, schema 수를 요약합니다."),
                surface("screen-flow-closeout-gate", "화면 흐름 완료 게이트", "[data-help-id=\"screen-flow-closeout-gate\"]", "ScreenFlowCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 화면 카탈로그/체인 점검과 아직 필요한 flow CRUD, transition 편집, 버전 발행, 영향도 preview, 감사 계약을 구분합니다."),
                surface("screen-flow-action-contract", "화면 흐름 변경 조치 계약", "[data-help-id=\"screen-flow-action-contract\"] button[disabled]", "ScreenFlowActionContract", "actions",
                        Collections.emptyList(), "flow 생성, transition 편집, 검증, 발행, 영향도 저장은 검증·승인·감사 연결 전까지 비활성화합니다."),
                surface("screen-flow-catalog", "화면 카탈로그", "[data-help-id=\"screen-flow-catalog\"]", "ScreenFlowCatalog", "content",
                        Collections.emptyList(), "pageId, routePath, menuCode 기준으로 점검 대상 화면을 선택합니다."),
                surface("screen-flow-surface-chain", "Surface/Event 흐름", "[data-help-id=\"screen-flow-surface-chain\"]", "ScreenFlowSurfaceChain", "content",
                        Collections.emptyList(), "렌더링 surface에서 프론트 이벤트와 API 연결 수까지 추적합니다."),
                surface("screen-flow-event-chain", "Event/API 체인", "[data-help-id=\"screen-flow-event-chain\"]", "ScreenFlowEventApiChain", "content",
                        Collections.emptyList(), "프론트 함수, 입력/출력 필드, 연결 API endpoint를 행 단위로 보여줍니다."),
                surface("screen-flow-schema-permission", "Schema/권한 변경 대상", "[data-help-id=\"screen-flow-schema-permission\"]", "ScreenFlowSchemaPermission", "content",
                        Collections.emptyList(), "schema, required view feature, relation table, change target을 함께 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("screen-flow-page-load", "화면 흐름 카탈로그 조회", "load", "fetchScreenCommandPage", "[data-help-id=\"screen-flow-summary\"]",
                        Collections.singletonList("platform.help-management.screen-command.page"), "screen command 카탈로그와 선택 화면 메타데이터를 조회합니다."),
                event("screen-flow-filter-change", "화면 흐름 카탈로그 검색", "change", "setPageFilter", "[data-help-id=\"screen-flow-catalog\"] input",
                        Collections.singletonList("platform.help-management.screen-command.page"), "pageId, routePath, menuCode 기준으로 화면 목록을 필터링합니다."),
                event("screen-flow-select-page", "화면 흐름 대상 선택", "click", "setSelectedPageId", "[data-help-id=\"screen-flow-catalog\"] button",
                        Collections.singletonList("platform.help-management.screen-command.page"), "선택한 화면의 surface, event, API, schema, 권한 체인을 다시 조회합니다."),
                event("screen-flow-action-contract-blocked", "화면 흐름 변경 조치 차단 상태 표시", "render", "ScreenFlowActionContract", "[data-help-id=\"screen-flow-action-contract\"]",
                        Collections.emptyList(), "flow CRUD, transition 편집, 버전 발행, 영향도 저장 API와 감사가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("screen-command-page-schema", "화면 command 페이지 메타 스키마", "UI_PAGE_MANIFEST / SCREEN_COMMAND_SNAPSHOT",
                        Arrays.asList("pageId", "menuCode", "routePath", "surfaceId", "eventId", "apiId", "schemaId", "requiredViewFeatureCode"),
                        Arrays.asList("SELECT"),
                        "현재 화면 흐름 관리에서 조회하는 page/surface/event/API/schema/권한 메타데이터입니다."),
                schema("screen-flow-definition-schema", "화면 흐름 정의 스키마", "PENDING_SCREEN_FLOW_DEFINITION",
                        Arrays.asList("flowId", "pageId", "menuCode", "routePath", "flowStatus", "draftVersionId", "publishedVersionId", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE", "DELETE"),
                        "향후 flow CRUD와 버전 상태를 저장할 정의 모델입니다."),
                schema("screen-flow-transition-schema", "화면 흐름 Transition 스키마", "PENDING_SCREEN_FLOW_TRANSITION",
                        Arrays.asList("transitionId", "flowId", "fromSurfaceId", "eventId", "toSurfaceId", "toRoutePath", "sortOrder", "guardRuleId"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE", "DELETE"),
                        "ordered transition 편집과 순환/중복 검증에 필요한 전이 모델입니다."),
                schema("screen-flow-impact-schema", "화면 흐름 영향도 스키마", "PENDING_SCREEN_FLOW_IMPACT",
                        Arrays.asList("impactId", "flowId", "menuCode", "routePath", "featureCode", "authorCode", "impactType", "blockingReason", "createdAt"),
                        Arrays.asList("SELECT", "INSERT"),
                        "저장 전 메뉴, route, 기능, 권한 영향도를 preview하고 차단 결과를 보관할 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("SCREEN_FLOW_STATUS", "화면 흐름 상태", Arrays.asList("DRAFT", "VALIDATED", "PUBLISHED", "ROLLBACK_READY", "BLOCKED"), "화면 흐름 정의와 버전 발행 상태 구분값입니다."),
                codeGroup("SCREEN_FLOW_ACTION", "화면 흐름 조치 유형", Arrays.asList("FLOW_SAVE", "TRANSITION_SAVE", "VALIDATE", "PUBLISH", "IMPACT_PREVIEW"), "흐름 변경 조치 권한과 감사 이벤트 구분값입니다."),
                codeGroup("SCREEN_FLOW_IMPACT_TYPE", "화면 흐름 영향 유형", Arrays.asList("MENU", "ROUTE", "FEATURE", "ROLE", "HELP", "MANIFEST"), "영향도 preview 결과의 영향 범위 구분값입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("screen-flow-definition", "화면 흐름 정의", Arrays.asList("flowId", "pageId", "menuCode", "routePath", "flowStatus"), "flow 생성/수정/삭제와 상태 전이를 관리합니다."),
                changeTarget("screen-flow-transition", "화면 흐름 전이", Arrays.asList("transitionId", "fromSurfaceId", "eventId", "toSurfaceId", "toRoutePath", "sortOrder"), "화면 요소와 이벤트 기반 transition 순서를 편집합니다."),
                changeTarget("screen-flow-impact", "화면 흐름 영향도", Arrays.asList("menuCode", "routePath", "featureCode", "authorCode", "impactType", "blockingReason"), "저장 전 영향도와 차단 사유를 감사 증적으로 남깁니다.")
        ));
        return page;
    }

    private Map<String, Object> buildScreenMenuAssignmentManagementPage() {
        Map<String, Object> page = pageOption("screen-menu-assignment-management", "화면-메뉴 귀속 관리", "/admin/system/screen-menu-assignment-management", "A1900110", "admin");
        page.put("summary", "관리자/홈 메뉴 인벤토리와 screen command 페이지의 귀속 상태를 점검하고, 단일 메뉴 매핑 저장과 아직 차단된 중복/충돌 검증, 권한 영향도 preview, rollback, 감사 증적 계약을 구분하는 시스템 메타 화면입니다.");
        page.put("source", "frontend/src/features/screen-management/ScreenMenuAssignmentManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("screen-menu-assignment-summary", "화면-메뉴 귀속 요약", "[data-help-id=\"screen-menu-assignment-summary\"]", "ScreenMenuAssignmentSummaryCards", "content",
                        Collections.emptyList(), "페이지 메뉴 수, 귀속 완료 수, 미귀속 수, 고아 화면 수를 요약합니다."),
                surface("screen-menu-assignment-closeout-gate", "화면-메뉴 귀속 완료 게이트", "[data-help-id=\"screen-menu-assignment-closeout-gate\"]", "ScreenMenuAssignmentCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 메뉴 수집, 귀속 목록, 단일 매핑 저장과 아직 필요한 충돌 검증, 권한 영향도, rollback, 감사 증적을 구분합니다."),
                surface("screen-menu-assignment-action-contract", "화면-메뉴 귀속 조치 계약", "[data-help-id=\"screen-menu-assignment-action-contract\"] button[disabled]", "ScreenMenuAssignmentActionContract", "actions",
                        Collections.emptyList(), "충돌 검사, 권한 영향도 preview, bulk 매핑, rollback, 감사 증적 export는 거버넌스 API 연결 전까지 비활성화합니다."),
                surface("screen-menu-assignment-catalog", "화면-메뉴 귀속 목록", "[data-help-id=\"screen-menu-assignment-catalog\"]", "ScreenMenuAssignmentCatalog", "content",
                        Collections.emptyList(), "메뉴 코드, 경로, pageId 기준으로 귀속 대상을 검색하고 선택합니다."),
                surface("screen-menu-assignment-detail", "화면-메뉴 귀속 상세", "[data-help-id=\"screen-menu-assignment-detail\"]", "ScreenMenuAssignmentDetail", "content",
                        Arrays.asList("screen-menu-assignment-save"), "선택 메뉴의 연결 화면, manifest registry, required VIEW 기능, 권한 연계 테이블을 보여주고 단일 매핑 저장을 제공합니다."),
                surface("screen-menu-assignment-orphans", "고아 화면 목록", "[data-help-id=\"screen-menu-assignment-orphans\"]", "ScreenMenuAssignmentOrphanPages", "content",
                        Collections.emptyList(), "screen registry에는 있지만 대응 페이지 메뉴가 없는 화면을 보여줍니다.")
        ));
        page.put("events", Arrays.asList(
                event("screen-menu-assignment-load", "화면-메뉴 귀속 데이터 조회", "load", "fetchMenuManagementPage/fetchScreenCommandPage", "[data-help-id=\"screen-menu-assignment-summary\"]",
                        Arrays.asList("admin.menu-management.page", "platform.help-management.screen-command.page"), "메뉴 인벤토리와 screen command 페이지 목록을 조회합니다."),
                event("screen-menu-assignment-filter-change", "화면-메뉴 귀속 검색", "change", "setFilter", "[data-help-id=\"screen-menu-assignment-catalog\"] input",
                        Collections.emptyList(), "메뉴 코드, 경로, pageId 기준으로 귀속 목록을 필터링합니다."),
                event("screen-menu-assignment-select", "화면-메뉴 귀속 대상 선택", "click", "setSelectedMenuCode", "[data-help-id=\"screen-menu-assignment-catalog\"] button",
                        Collections.singletonList("platform.help-management.screen-command.page"), "선택 메뉴의 연결 화면 상세와 권한 귀속을 다시 조회합니다."),
                event("screen-menu-assignment-save", "화면-메뉴 단일 매핑 저장", "click", "handleSaveMapping", "[data-help-id=\"screen-menu-assignment-detail\"] button",
                        Collections.singletonList("admin.help-management.screen-command.map-menu"), "선택 메뉴와 screen command page의 단일 매핑을 저장합니다."),
                event("screen-menu-assignment-action-contract-blocked", "화면-메뉴 거버넌스 조치 차단 상태 표시", "render", "ScreenMenuAssignmentActionContract", "[data-help-id=\"screen-menu-assignment-action-contract\"]",
                        Collections.emptyList(), "충돌 검증, 권한 영향도 preview, bulk 매핑, rollback, 감사 export API가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("menu-tree-schema", "메뉴 트리 스키마", "COMTCCMMNDETAILCODE / COMTNMENUINFO",
                        Arrays.asList("CODE_ID", "CODE", "CODE_NM", "CODE_DC", "MENU_URL", "MENU_ICON", "USE_AT", "EXPSR_AT"),
                        Arrays.asList("SELECT"), "화면-메뉴 귀속 목록의 메뉴 인벤토리 원본입니다."),
                schema("screen-command-page-schema", "화면 command 페이지 메타 스키마", "UI_PAGE_MANIFEST / SCREEN_COMMAND_SNAPSHOT",
                        Arrays.asList("pageId", "menuCode", "routePath", "domainCode", "layoutVersion", "requiredViewFeatureCode"),
                        Arrays.asList("SELECT"), "매핑 대상 screen command page와 권한 메타데이터입니다."),
                schema("screen-menu-assignment-schema", "화면-메뉴 귀속 스키마", "UI_PAGE_MANIFEST / COMTNMENUINFO",
                        Arrays.asList("assignmentId", "pageId", "menuCode", "menuName", "menuUrl", "domainCode", "updatedBy", "updatedAt"),
                        Arrays.asList("SELECT", "UPDATE"), "현재 단일 매핑 저장에 필요한 귀속 필드 묶음입니다."),
                schema("screen-menu-assignment-impact-schema", "화면-메뉴 귀속 영향도 스키마", "PENDING_SCREEN_MENU_ASSIGNMENT_IMPACT",
                        Arrays.asList("impactId", "assignmentId", "menuCode", "pageId", "featureCode", "authorCode", "impactType", "blockingReason", "createdAt"),
                        Arrays.asList("SELECT", "INSERT"), "향후 충돌 검증과 권한 영향도 preview 결과를 저장할 모델입니다."),
                schema("screen-menu-assignment-audit-schema", "화면-메뉴 귀속 감사 스키마", "PENDING_SCREEN_MENU_ASSIGNMENT_AUDIT",
                        Arrays.asList("auditId", "assignmentId", "actionType", "beforePageId", "afterPageId", "beforeMenuCode", "afterMenuCode", "rollbackRef", "executedBy", "executedAt"),
                        Arrays.asList("SELECT", "INSERT"), "매핑 변경 전후와 rollback 기준을 저장할 감사 모델입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("SCREEN_MENU_ASSIGNMENT_STATUS", "화면-메뉴 귀속 상태", Arrays.asList("ASSIGNED", "UNASSIGNED", "ORPHANED", "CONFLICT"), "귀속 목록 상태 배지와 필터 기준입니다."),
                codeGroup("SCREEN_MENU_ASSIGNMENT_ACTION", "화면-메뉴 귀속 조치 유형", Arrays.asList("MAP_SINGLE", "CONFLICT_CHECK", "AUTHORITY_IMPACT", "BULK_MAP", "ROLLBACK", "AUDIT_EXPORT"), "귀속 변경 조치 권한과 감사 이벤트 구분값입니다."),
                codeGroup("SCREEN_MENU_ASSIGNMENT_IMPACT_TYPE", "화면-메뉴 귀속 영향 유형", Arrays.asList("ROUTE", "MENU", "PAGE", "FEATURE", "ROLE", "USER_OVERRIDE"), "영향도 preview 결과 범위 구분값입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("screen-menu-assignment-single", "단일 메뉴 매핑", Arrays.asList("pageId", "menuCode", "menuName", "menuUrl", "domainCode"), "선택 메뉴와 screen command page의 단일 매핑을 저장합니다."),
                changeTarget("screen-menu-assignment-impact", "권한 영향도", Arrays.asList("featureCode", "authorCode", "impactType", "blockingReason"), "저장 전 권한 영향도와 차단 사유를 계산합니다."),
                changeTarget("screen-menu-assignment-audit", "귀속 변경 감사", Arrays.asList("beforePageId", "afterPageId", "beforeMenuCode", "afterMenuCode", "rollbackRef"), "변경 전후와 rollback 기준을 보관합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildFullStackManagementPage() {
        Map<String, Object> page = pageOption("full-stack-management", "풀스택 관리", "/admin/system/full-stack-management", "AMENU_SYSTEM_FULL_STACK_MANAGEMENT", "admin");
        page.put("summary", "메뉴를 기준으로 화면 요소, 이벤트, 함수, 파라미터, 결과값, API, 스키마, 테이블, 컬럼, 권한, 공통코드를 함께 추적하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/menu-management/FullStackManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("full-stack-menu-scope", "관리 범위 선택", "[data-help-id=\"full-stack-management-scope\"]", "FullStackMenuScope", "actions",
                        Arrays.asList("full-stack-page-load"), "관리자/홈 메뉴 트리 범위와 등록 상태를 선택합니다."),
                surface("full-stack-menu-tree", "메뉴 트리와 메뉴 생성", "[data-help-id=\"full-stack-management-tree\"]", "FullStackMenuTree", "content",
                        Arrays.asList("full-stack-menu-create", "full-stack-menu-order-save"), "메뉴 생성, 정렬 변경, 대상 메뉴 선택을 수행합니다."),
                surface("full-stack-governance", "풀스택 거버넌스 패널", "[data-help-id=\"menu-management-governance-panel\"]", "FullStackGovernancePanel", "content",
                        Arrays.asList("full-stack-command-load", "full-stack-registry-save"), "선택한 메뉴 기준 화면/이벤트/API/스키마/권한 연결을 탐색합니다.")
        ));
        page.put("events", Arrays.asList(
                event("full-stack-page-load", "풀스택 관리 화면 로드", "change", "fetchFullStackManagementPage", "[data-help-id=\"full-stack-management-scope\"] select",
                        Arrays.asList("admin.full-stack-management.page"), "관리 대상 메뉴 범위와 트리를 다시 조회합니다."),
                event("full-stack-menu-create", "페이지 메뉴 생성", "click", "createPageMenu", "[data-help-id=\"full-stack-management-tree\"] .primary-button",
                        Arrays.asList("admin.menu-management.create-page"), "새 메뉴, 기본 VIEW 기능, 초기 정렬 정보를 함께 생성합니다."),
                event("full-stack-menu-order-save", "메뉴 순서 저장", "click", "saveOrder", "[data-help-id=\"full-stack-management-tree\"] .gov-btn-primary",
                        Arrays.asList("admin.menu-management.order-save"), "선택한 범위의 메뉴 순서를 저장합니다."),
                event("full-stack-command-load", "메뉴 연결 메타데이터 로드", "click", "loadCommandPage", "[data-help-id=\"menu-management-governance-select\"]",
                        Arrays.asList("platform.help-management.screen-command.page"), "선택한 페이지 메뉴 기준 화면 요소, 함수, API, 스키마 메타데이터를 조회합니다."),
                event("full-stack-registry-save", "풀스택 레지스트리 저장", "click", "saveRegistry", "[data-help-id=\"menu-management-governance-panel\"] .gov-btn-primary",
                        Arrays.asList("admin.full-stack-management.registry-save"), "메뉴별 프론트/백엔드/API/DB 컬럼 메타데이터를 저장합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("menu-tree-schema", "메뉴 트리 스키마", "COMTCCMMNDETAILCODE / COMTNMENUINFO",
                        Arrays.asList("CODE_ID", "CODE", "CODE_NM", "CODE_DC", "MENU_URL", "MENU_ICON", "USE_AT"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "메뉴 계층과 페이지 URL 메타데이터를 보관합니다."),
                schema("menu-order-schema", "메뉴 순서 스키마", "COMTNMENUORDER",
                        Arrays.asList("MENU_CODE", "SORT_ORDR", "FRST_REGIST_PNTTM", "LAST_UPDT_PNTTM"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "메뉴 표시 순서를 관리합니다."),
                schema("menu-feature-schema", "메뉴 기능 권한 스키마", "COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE / COMTNUSERFEATUREOVERRIDE",
                        Arrays.asList("MENU_CODE", "FEATURE_CODE", "AUTHOR_CODE", "SCRTY_DTRMN_TRGET_ID", "USE_AT"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE", "DELETE"), "페이지 VIEW 기능과 역할/사용자 권한 연결을 관리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("AMENU_SYSTEM_FULL_STACK_MANAGEMENT", "A1900101", "A0060303"), "시스템 운영 메뉴 코드군입니다."),
                codeGroup("CHANGE_LAYER", "수정 레이어", Arrays.asList("UI", "EVENT", "FUNCTION", "API", "SERVICE", "MAPPER", "SCHEMA", "DB_COLUMN", "MENU_AUTH"), "풀스택 관리 시 선택하는 변경 레이어입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildEnvironmentManagementPage() {
        Map<String, Object> page = pageOption("environment-management", "메뉴 통합 관리", "/admin/system/environment-management", "A0060118", "admin");
        page.put("summary", "메뉴 검색, 메뉴 등록, 기본 권한 생성, 기능 추가를 한 화면에서 처리하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/environment-management/EnvironmentManagementHubPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("environment-management-summary", "환경 관리 요약", "[data-help-id=\"environment-management-summary\"]", "EnvironmentManagementSummary", "actions",
                        Collections.singletonList("environment-tool-open"), "선택한 환경 관리 도구의 메뉴코드, feature, 경로를 요약합니다."),
                surface("environment-management-engines", "거버넌스 엔진 안내", "[data-help-id=\"environment-management-engines\"]", "EnvironmentManagementEngines", "content",
                        Collections.singletonList("environment-tool-open"), "ALL 허용, 회원 타입, 회사 스코프, 감사 진단 엔진을 운영 기준으로 정리합니다."),
                surface("environment-management-cards", "환경 관리 카드", "[data-help-id=\"environment-management-cards\"]", "EnvironmentManagementCards", "content",
                        Collections.singletonList("environment-tool-open"), "공통코드, 페이지, 기능, 메뉴 관리 화면으로 이동합니다.")
        ));
        page.put("events", Collections.singletonList(
                event("environment-tool-open", "환경 관리 화면 이동", "click", "navigate", "[data-help-id=\"environment-management-cards\"] button",
                        Collections.emptyList(), "선택한 관리 도구 화면으로 이동합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060118", "AMENU_SYSTEM_CODE", "AMENU_SYSTEM_PAGE_MANAGEMENT", "AMENU_SYSTEM_FUNCTION_MANAGEMENT", "AMENU_SYSTEM_MENU_MANAGEMENT"),
                        "메뉴 통합 관리 화면과 하위 관리 기능의 메뉴 코드 연결입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAssetInventoryPage() {
        Map<String, Object> page = pageOption("asset-inventory", "자산 인벤토리", "/admin/system/asset-inventory", "A0060123", "admin");
        page.put("summary", "기존 운영 화면을 서비스, 런타임, 보안, 연계, 파일, 복구 자산으로 재분류해 보여주는 시스템 자산 인벤토리 화면입니다.");
        page.put("source", "frontend/src/features/asset-inventory/AssetInventoryMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("asset-inventory-summary", "자산 인벤토리 요약", "[data-help-id=\"asset-inventory-summary\"]", "AssetInventorySummary", "actions",
                        Collections.emptyList(), "현재 커버 자산 수, 목표 자산 수, 부분 완료 레인을 요약합니다."),
                surface("asset-inventory-overview", "자산관리 기준선", "[data-help-id=\"asset-inventory-overview\"]", "AssetInventoryOverview", "content",
                        Collections.emptyList(), "현재 운영 화면이 자산관리 기준으로 얼마나 정리되어 있는지 보여줍니다."),
                surface("asset-inventory-lanes", "자산 레인 분류", "[data-help-id=\"asset-inventory-lanes\"]", "AssetInventoryLanes", "content",
                        Collections.emptyList(), "서비스, 런타임, 보안, 연계, 파일, 계획 대상 레인을 분류해 보여줍니다."),
                surface("asset-inventory-priority", "다음 구현 우선순위", "[data-help-id=\"asset-inventory-priority\"]", "AssetInventoryPriority", "content",
                        Collections.emptyList(), "다음 구현할 우선순위 레인을 정리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060123", "A0060118", "A0060401", "A0060303", "A0050101"),
                        "자산 인벤토리와 연결되는 시스템/연계 운영 메뉴 코드군입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildVerificationCenterPage() {
        Map<String, Object> page = pageOption("verification-center", "운영 검증 센터", "/admin/system/verification-center", "A0060128", "admin");
        page.put("summary", "baseline 백업, 자동 smoke sweep, 테스트 계정/데이터 보관, 만료 규칙, 검증 증거를 한 곳에서 관리하는 운영 검증 센터입니다.");
        page.put("source", "frontend/src/features/environment-management/VerificationCenterMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("verification-center-summary", "운영 검증 센터 요약", "[data-help-id=\"verification-center-summary\"]", "VerificationCenterSummary", "actions",
                        Collections.emptyList(), "기준선 수, 관리 페이지 수, 정기 sweep 수, stale 및 대기 건수를 요약합니다."),
                surface("verification-center-overview", "운영 검증 센터 개요", "[data-help-id=\"verification-center-overview\"]", "VerificationCenterOverview", "content",
                        Collections.emptyList(), "이 화면이 필요한 이유와 baseline 백업 및 운영 스캐너 목적을 설명합니다."),
                surface("verification-center-catalog", "기준선 팩 카탈로그", "[data-help-id=\"verification-center-catalog\"]", "VerificationCenterCatalog", "content",
                        Collections.emptyList(), "페이지 기준선, 테스트 계정/데이터 팩, 자동 점검 실행, 검증 로그 묶음을 보여줍니다."),
                surface("verification-center-runs", "검증 실행 주기", "[data-help-id=\"verification-center-runs\"]", "VerificationCenterRuns", "content",
                        Collections.emptyList(), "변경 전후, 주기 점검, 만료 관리 기준을 정리합니다."),
                surface("verification-center-run-history", "최근 실행과 조치 큐", "[data-help-id=\"verification-center-run-history\"]", "VerificationCenterRunHistory", "content",
                        Collections.emptyList(), "최근 검증 실행 이력과 즉시 처리해야 할 조치 큐를 함께 보여줍니다."),
                surface("verification-center-managed-vault", "테스트 자산 보관함과 스캐너 보드", "[data-help-id=\"verification-center-managed-vault\"]", "VerificationCenterManagedVault", "content",
                        Collections.emptyList(), "재사용 테스트 자산 보관함과 일간·주간 운영 스캐너 보드를 함께 보여줍니다."),
                surface("verification-center-baseline-registry", "baseline 레지스트리와 보관 자산", "[data-help-id=\"verification-center-baseline-registry\"]", "VerificationCenterBaselineRegistry", "content",
                        Collections.emptyList(), "페이지 baseline 레지스트리와 계정·데이터셋 보관 현황을 함께 보여줍니다."),
                surface("verification-center-safety-policy", "고위험 테스트 안전 정책", "[data-help-id=\"verification-center-safety-policy\"]", "VerificationCenterSafetyPolicy", "content",
                        Collections.emptyList(), "결제, 환불, 가상계좌, 외부인증, 인증서 흐름에서 실데이터를 차단하는 정책을 보여줍니다."),
                surface("verification-center-risk-scope", "고위험 범위와 테스트 프로필", "[data-help-id=\"verification-center-risk-scope\"]", "VerificationCenterRiskScope", "content",
                        Collections.emptyList(), "고위험 페이지 분류와 필수 테스트 프로필을 함께 보여줍니다."),
                surface("verification-center-inventory-scope", "운영 인벤토리 범위", "[data-help-id=\"verification-center-inventory-scope\"]", "VerificationCenterInventoryScope", "content",
                        Collections.emptyList(), "페이지, API, 함수, 테스트, 고위험 범위를 요약합니다."),
                surface("verification-center-full-lists", "전체 인벤토리 목록", "[data-help-id=\"verification-center-full-lists\"]", "VerificationCenterFullLists", "content",
                        Collections.emptyList(), "페이지, API, 함수, 고위험 페이지/API, 테스트 프로필, 저장 테스트 목록을 제공합니다."),
                surface("verification-center-log-policy", "다음 구축 단계", "[data-help-id=\"verification-center-log-policy\"]", "VerificationCenterLogPolicy", "content",
                        Collections.emptyList(), "기준선 레지스트리, 시나리오 실행기, 테스트 계정 보관함, 정기 점검 대시보드를 다음 단계로 제안합니다.")
        ));
        page.put("events", Arrays.asList(
                event("verification-center-refresh", "운영 검증 센터 새로고침", "click", "navigate", "[data-help-id=\"verification-center-overview\"] a",
                        Collections.emptyList(), "현재 검증 범위와 연결 콘솔로 이동하거나 화면을 다시 확인합니다."),
                event("verification-center-open-linked-console", "연결 콘솔 열기", "click", "navigate", "[data-help-id=\"verification-center-catalog\"] a",
                        Collections.emptyList(), "환경 관리, 런타임 비교, 리페어 워크벤치, 추적 조회 등 연결된 운영 콘솔로 이동합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060128", "A0060118", "A0060123", "A0060303"),
                        "운영 검증 센터와 연결되는 시스템 운영 메뉴 코드군입니다."),
                codeGroup("VERIFICATION_RUN_TYPE", "검증 실행 유형", Arrays.asList("PRE_CHANGE_BASELINE", "POST_CHANGE_REGRESSION", "POST_DEPLOY_SMOKE", "SCHEDULED_SWEEP", "MANUAL_INVESTIGATION"),
                        "운영 검증 센터에서 구분해야 하는 기본 검증 실행 유형입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildVerificationAssetsPage() {
        Map<String, Object> page = pageOption("verification-assets", "검증 자산 관리", "/admin/system/verification-assets", "A0060129", "admin");
        page.put("summary", "baseline 레지스트리, 재사용 테스트 계정, 마스킹 데이터셋, 조치 큐를 직접 저장하고 정리하는 운영 검증 자산 관리 화면입니다.");
        page.put("source", "frontend/src/features/environment-management/VerificationAssetManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("verification-assets-baseline-form", "baseline 등록 폼", ".gov-card", "VerificationAssetBaselineForm", "content",
                        Collections.emptyList(), "pageId, routePath, snapshotPath, scenario id를 저장합니다."),
                surface("verification-assets-account-form", "테스트 계정 등록 폼", ".gov-card", "VerificationAssetAccountForm", "content",
                        Collections.emptyList(), "테스트 계정 profile, 만료일, 허용 경로를 저장합니다."),
                surface("verification-assets-dataset-form", "데이터셋 등록 폼", ".gov-card", "VerificationAssetDatasetForm", "content",
                        Collections.emptyList(), "마스킹 데이터셋 유형, 갱신일, 보존 정책을 저장합니다."),
                surface("verification-assets-action-queue", "조치 큐", ".gov-card", "VerificationAssetActionQueue", "content",
                        Collections.emptyList(), "조치 큐를 확인하고 완료 항목을 해제합니다.")
        ));
        page.put("events", Arrays.asList(
                event("verification-assets-save-baseline", "baseline 저장", "click", "handleBaselineSave", ".gov-card button",
                        Collections.emptyList(), "baseline 레지스트리 행을 저장하거나 갱신합니다."),
                event("verification-assets-save-account", "테스트 계정 저장", "click", "handleAccountSave", ".gov-card button",
                        Collections.emptyList(), "재사용 테스트 계정을 저장하거나 갱신합니다."),
                event("verification-assets-save-dataset", "데이터셋 저장", "click", "handleDatasetSave", ".gov-card button",
                        Collections.emptyList(), "마스킹 데이터셋을 저장하거나 갱신합니다."),
                event("verification-assets-resolve-action", "조치 큐 해제", "click", "handleResolveAction", ".gov-card button",
                        Collections.emptyList(), "완료된 조치 큐 항목을 상태 파일에서 제거합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("VERIFICATION_ASSET_STATUS", "검증 자산 상태", Arrays.asList("READY", "STALE", "EXPIRING_SOON", "DISABLED"), "baseline, 계정, 데이터셋 상태값입니다."),
                codeGroup("VERIFICATION_ASSET_ACTION", "검증 자산 조치", Arrays.asList("UPSERT_BASELINE", "UPSERT_ACCOUNT", "UPSERT_DATASET", "RESOLVE_ACTION"), "검증 자산 관리에서 수행하는 조치 유형입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("verification-baseline", "baseline 레지스트리", Arrays.asList("pageId", "routePath", "baselineId", "snapshotPath", "owner"), "복구 기준이 되는 baseline 레지스트리 항목을 저장합니다."),
                changeTarget("verification-account", "테스트 계정", Arrays.asList("profileId", "role", "status", "expiresAt", "allowedRoutes"), "재사용 테스트 계정과 허용 경로를 저장합니다."),
                changeTarget("verification-dataset", "테스트 데이터셋", Arrays.asList("datasetId", "type", "status", "lastRefreshedAt", "maskingPolicy"), "마스킹 테스트 데이터셋을 저장합니다."),
                changeTarget("verification-action-queue", "조치 큐", Arrays.asList("actionId", "severity", "category", "owner", "targetId"), "완료된 조치를 큐에서 해제합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildAssetDetailPage() {
        Map<String, Object> page = pageOption("asset-detail", "자산 상세", "/admin/system/asset-detail", "A0060124", "admin");
        page.put("summary", "자산 유형별로 식별, 소유권, 의존관계, 런타임, 보안, 복구 기준을 정리하는 시스템 자산 상세 화면입니다.");
        page.put("source", "frontend/src/features/asset-inventory/AssetDetailMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("asset-detail-summary", "자산 상세 요약", "[data-help-id=\"asset-detail-summary\"]", "AssetDetailSummary", "actions",
                        Collections.emptyList(), "자산 유형, 현재 상태, 리스크 수, 연결 콘솔 수를 요약합니다."),
                surface("asset-detail-overview", "자산 상세 기준", "[data-help-id=\"asset-detail-overview\"]", "AssetDetailOverview", "content",
                        Collections.emptyList(), "해당 자산 유형의 운영 기준과 현재 상태를 설명합니다."),
                surface("asset-detail-tabs", "자산 상세 탭", "[data-help-id=\"asset-detail-tabs\"]", "AssetDetailTabs", "content",
                        Collections.emptyList(), "식별, 소유권, 의존관계, 런타임, 보안, 복구 기준 탭을 전환합니다."),
                surface("asset-detail-support", "자산 상세 보강 항목", "[data-help-id=\"asset-detail-support\"]", "AssetDetailSupport", "content",
                        Collections.emptyList(), "연결 콘솔과 미흡사항을 함께 보여줍니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060124", "A0060123", "A0060118", "A0050101", "A0060201"),
                        "자산 상세와 연계되는 자산관리 메뉴 코드군입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAssetImpactPage() {
        Map<String, Object> page = pageOption("asset-impact", "자산 영향도", "/admin/system/asset-impact", "A0060125", "admin");
        page.put("summary", "페이지, 기능, 런타임, 연계 변경이 미치는 영향을 하나의 진입점에서 검토하는 시스템 자산 영향도 화면입니다.");
        page.put("source", "frontend/src/features/asset-inventory/AssetImpactMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("asset-impact-summary", "자산 영향도 요약", "[data-help-id=\"asset-impact-summary\"]", "AssetImpactSummary", "actions",
                        Collections.emptyList(), "영향 모드, 연결 콘솔 수, 점검 항목 수를 요약합니다."),
                surface("asset-impact-modes", "자산 영향도 모드", "[data-help-id=\"asset-impact-modes\"]", "AssetImpactModes", "content",
                        Collections.emptyList(), "페이지, 기능, 런타임, 연계 영향 모드를 전환합니다."),
                surface("asset-impact-overview", "자산 영향도 기준", "[data-help-id=\"asset-impact-overview\"]", "AssetImpactOverview", "content",
                        Collections.emptyList(), "현재 선택한 영향도 모드의 기준과 목적을 설명합니다."),
                surface("asset-impact-details", "자산 영향도 상세", "[data-help-id=\"asset-impact-details\"]", "AssetImpactDetails", "content",
                        Collections.emptyList(), "현재 영향도 모드의 기준선과 체크리스트를 보여줍니다."),
                surface("asset-impact-links", "자산 영향도 소스 맵", "[data-help-id=\"asset-impact-links\"]", "AssetImpactLinks", "content",
                        Collections.emptyList(), "현재 영향도 증적의 원본 화면과 연결 콘솔을 보여줍니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060125", "A0060124", "A0060123", "A0060118", "A0050107"),
                        "자산 영향도와 연결되는 자산관리 메뉴 코드군입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAssetLifecyclePage() {
        Map<String, Object> page = pageOption("asset-lifecycle", "자산 생명주기", "/admin/system/asset-lifecycle", "A0060126", "admin");
        page.put("summary", "자산 생성, 반영, 축소, 폐기, 롤백 경로를 하나의 거버넌스 진입점에서 관리하는 시스템 자산 생명주기 화면입니다.");
        page.put("source", "frontend/src/features/asset-inventory/AssetLifecycleMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("asset-lifecycle-summary", "자산 생명주기 요약", "[data-help-id=\"asset-lifecycle-summary\"]", "AssetLifecycleSummary", "actions",
                        Collections.emptyList(), "생명주기 단계 수, 연결 콘솔 수, 점검 항목 수를 요약합니다."),
                surface("asset-lifecycle-stages", "자산 생명주기 단계", "[data-help-id=\"asset-lifecycle-stages\"]", "AssetLifecycleStages", "content",
                        Collections.emptyList(), "생성, 반영, 축소, 폐기 단계를 전환합니다."),
                surface("asset-lifecycle-overview", "자산 생명주기 기준", "[data-help-id=\"asset-lifecycle-overview\"]", "AssetLifecycleOverview", "content",
                        Collections.emptyList(), "현재 선택한 생명주기 단계의 목적과 기준을 설명합니다."),
                surface("asset-lifecycle-checklist", "자산 생명주기 체크리스트", "[data-help-id=\"asset-lifecycle-checklist\"]", "AssetLifecycleChecklist", "content",
                        Collections.emptyList(), "단계별 최소 점검 항목과 기준선을 보여줍니다."),
                surface("asset-lifecycle-links", "자산 생명주기 연결 콘솔", "[data-help-id=\"asset-lifecycle-links\"]", "AssetLifecycleLinks", "content",
                        Collections.emptyList(), "생명주기 증적의 원본 콘솔과 운영 메모를 보여줍니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060126", "A0060125", "A0060124", "A0060123", "A0060401"),
                        "자산 생명주기와 연결되는 자산관리 메뉴 코드군입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildAssetGapPage() {
        Map<String, Object> page = pageOption("asset-gap", "자산 미흡 큐", "/admin/system/asset-gap", "A0060127", "admin");
        page.put("summary", "소유자 누락, 바인딩 누락, 정책 누락, 고아 자산을 하나의 운영 백로그로 모아주는 시스템 자산 미흡 큐 화면입니다.");
        page.put("source", "frontend/src/features/asset-inventory/AssetGapMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("asset-gap-summary", "자산 미흡 큐 요약", "[data-help-id=\"asset-gap-summary\"]", "AssetGapSummary", "actions",
                        Collections.emptyList(), "미흡 큐 유형 수와 원본 콘솔 수를 요약합니다."),
                surface("asset-gap-overview", "자산 미흡 큐 기준", "[data-help-id=\"asset-gap-overview\"]", "AssetGapOverview", "content",
                        Collections.emptyList(), "미흡 큐의 목적과 실조회 연결 필요 상태를 설명합니다."),
                surface("asset-gap-queues", "자산 미흡 큐 목록", "[data-help-id=\"asset-gap-queues\"]", "AssetGapQueues", "content",
                        Collections.emptyList(), "소유자, 바인딩, 정책, 고아 자산 미흡 큐를 보여줍니다."),
                surface("asset-gap-support", "자산 미흡 신호 맵", "[data-help-id=\"asset-gap-support\"]", "AssetGapSupport", "content",
                        Collections.emptyList(), "기존 거버넌스 화면에서 가져와야 하는 신호 소스를 정리합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060127", "A0060126", "A0060118", "A0060401", "A0060201"),
                        "자산 미흡 큐와 연결되는 자산관리 메뉴 코드군입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildBackupConfigPage() {
        Map<String, Object> page = pageOption("backup-config", "백업 설정", "/admin/system/backup_config", "A0060401", "admin");
        page.put("summary", "애플리케이션 JAR, 데이터베이스 덤프, 원격 아카이브까지 백업 정책과 최근 실행 상태를 점검하는 화면입니다.");
        page.put("source", "frontend/src/features/backup-config/BackupConfigMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("backup-config-summary", "백업 설정 요약", "[data-help-id=\"backup-config-summary\"]", "BackupConfigSummary", "actions",
                        Collections.emptyList(), "백업 프로파일, 보관 주기, 검증 상태, 원격 동기화 현황을 요약합니다."),
                surface("backup-config-profiles", "백업 프로파일", "[data-help-id=\"backup-config-profiles\"]", "BackupConfigProfiles", "content",
                        Collections.emptyList(), "일간/주간/아카이브 백업 스케줄과 상태를 확인합니다."),
                surface("backup-config-storage", "백업 저장 대상", "[data-help-id=\"backup-config-storage\"]", "BackupConfigStorage", "content",
                        Collections.emptyList(), "로컬 런타임, DB 덤프, 원격 아카이브 위치를 관리합니다."),
                surface("backup-config-executions", "백업 실행 이력", "[data-help-id=\"backup-config-executions\"]", "BackupConfigExecutions", "content",
                        Collections.emptyList(), "최근 실행 결과와 검토 필요 항목을 확인합니다."),
                surface("backup-config-playbooks", "복구 플레이북", "[data-help-id=\"backup-config-playbooks\"]", "BackupConfigPlaybooks", "content",
                        Collections.emptyList(), "애플리케이션 롤백, DB 복구, 원격지 복구 절차를 안내합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060122"), "백업 설정 화면에 연결되는 관리자 메뉴 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildPackageGovernancePage() {
        Map<String, Object> page = pageOption("package-governance", "패키지 거버넌스", "/admin/system/package-governance", "A00605", "admin");
        page.put("summary", "플랫폼의 씬 패키징된 프로젝트 런타임 목록을 조회하고 코어, 게이트, 어댑터 버전에 따른 업그레이드 호환성을 판별하여 배포를 관리하는 제어 화면입니다.");
        page.put("source", "frontend/src/platform/operations/governance/PackageGovernanceScreen.tsx");
        page.put("surfaces", Arrays.asList(
                surface("package-governance-fleet", "프로젝트 Fleet 현황", "[data-help-id=\"package-governance-fleet\"]", "PackageGovernanceFleet", "content",
                        Collections.emptyList(), "현재 가동 중인 런타임들의 버전 및 상태 목록입니다."),
                surface("package-governance-upgrade", "업그레이드 후보군 분석", "[data-help-id=\"package-governance-upgrade\"]", "PackageGovernanceUpgrade", "content",
                        Collections.emptyList(), "선택한 프로젝트의 호환성 매트릭스 결과를 표시합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Collections.emptyList());
        return page;
    }
    private Map<String, Object> buildBackupSubPage(String pageId, String label, String routePath, String menuCode, String mode) {

        Map<String, Object> page = pageOption(pageId, label, routePath, menuCode, "admin");
        page.put("summary", "백업 설정 화면과 같은 데이터 계약을 사용하면서 현재 선택한 백업 운영 모드에 맞는 관점으로 표시하는 화면입니다.");
        page.put("source", "frontend/src/features/backup-config/BackupConfigMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("backup-config-summary", "백업 설정 요약", "[data-help-id=\"backup-config-summary\"]", "BackupConfigSummary", "actions",
                        Collections.emptyList(), "현재 선택한 " + label + " 메뉴 기준의 요약 카드입니다."),
                surface("backup-config-profiles", "백업 프로파일", "[data-help-id=\"backup-config-profiles\"]", "BackupConfigProfiles", "content",
                        Collections.emptyList(), "백업/복구/버전 관리에 공통으로 사용되는 프로파일을 확인합니다."),
                surface("backup-config-storage", "백업 저장 대상", "[data-help-id=\"backup-config-storage\"]", "BackupConfigStorage", "content",
                        Collections.emptyList(), "저장 대상과 운영 위치를 확인합니다."),
                surface("backup-config-executions", "백업 실행 이력", "[data-help-id=\"backup-config-executions\"]", "BackupConfigExecutions", "content",
                        Collections.emptyList(), "최근 실행과 검토 항목을 확인합니다."),
                surface("backup-config-playbooks", "복구 플레이북", "[data-help-id=\"backup-config-playbooks\"]", "BackupConfigPlaybooks", "content",
                        Collections.emptyList(), "운영 절차와 복구 순서를 확인합니다."))
        );
        page.put("mode", mode);
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList(menuCode), label + " 화면에 연결되는 관리자 메뉴 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildDbPromotionPolicyPage() {
        Map<String, Object> page = pageOption("db-promotion-policy", "DB 반영 정책 카탈로그", "/admin/system/db-promotion-policy", "A0060405", "admin");
        page.put("summary", "운영 DB 반영 기준 아래에서 테이블별 정책, DML 예외, 최근 저장 추적 이력을 함께 관리하는 화면입니다.");
        page.put("source", "frontend/src/features/db-promotion-policy/DbPromotionPolicyMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("db-promotion-policy-table-list", "테이블 정책 카탈로그", "[data-help-id=\"db-promotion-policy-table-list\"]", "DbPromotionPolicyTableList", "content",
                        Collections.emptyList(), "정책 등록 테이블과 최근 변경 포착 테이블을 한 목록에서 확인합니다."),
                surface("db-promotion-policy-editor", "정책 편집기", ".gov-card .gov-input", "DbPromotionPolicyEditor", "content",
                        Collections.singletonList("db-promotion-policy-save"), "반영 정책, change type, 마스킹 프로파일, SQL render mode, 정책 사유를 저장합니다."),
                surface("db-promotion-policy-comment", "운영 코멘트 자동 생성", "[data-help-id=\"db-promotion-policy-comment\"]", "DbPromotionPolicyCommentGenerator", "content",
                        Collections.emptyList(), "티켓, PR, 큐 우회 메모에 붙일 운영 코멘트를 자동 생성합니다."),
                surface("db-promotion-policy-recent-changes", "최근 저장 추적 변경", "[data-help-id=\"db-promotion-policy-recent-changes\"]", "DbPromotionPolicyRecentChanges", "content",
                        Collections.emptyList(), "선택한 테이블 기준 BUSINESS_CHANGE_LOG 최근 이력을 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("db-promotion-policy-select-table", "정책 테이블 선택", "click", "setSelectedTable", "[data-help-id=\"db-promotion-policy-table-list\"] tr",
                        Collections.singletonList("admin.db-promotion-policy.page"), "선택한 테이블 기준으로 정책 편집기와 최근 변경 목록을 갱신합니다."),
                event("db-promotion-policy-save", "DB 반영 정책 저장", "click", "saveDbPromotionPolicy", ".gov-btn-primary",
                        Collections.singletonList("admin.db-promotion-policy.save"), "테이블 단위 반영 정책과 사유를 저장합니다."))
        );
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060405"), "DB 반영 정책 카탈로그 화면에 연결되는 관리자 메뉴 코드입니다."),
                codeGroup("COMTNMENUFUNCTIONINFO", "기능 코드", Arrays.asList("A0060405_VIEW", "A0060405_UPDATE"), "페이지 조회와 정책 저장 기능 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildDbSyncDeployPage() {
        Map<String, Object> page = pageOption("db-sync-deploy", "DB 동기화 배포", "/admin/system/db-sync-deploy", "A0060406", "admin");
        page.put("summary", "고위험 DB 동기화와 원격 fresh deploy를 중앙 운영 가드레일 아래에서 사전 점검하는 화면입니다.");
        page.put("source", "frontend/src/features/db-sync-deploy/DbSyncDeployMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("db-sync-deploy-scope", "실행 범위 요약", "[data-help-id=\"db-sync-deploy-scope\"]", "DbSyncDeployScopeSummary", "actions",
                        Collections.emptyList(), "대상 프로젝트, 환경, 릴리스, 원격 호스트, freshness 검증 경로를 요약합니다."),
                surface("db-sync-deploy-policy", "정책 가드레일", "[data-help-id=\"db-sync-deploy-policy\"]", "DbSyncDeployPolicyGuardrail", "content",
                        Collections.singletonList("db-sync-deploy-analyze"), "반영 정책 누락, destructive diff, DB patch history 기록 강제 조건을 보여줍니다."),
                surface("db-sync-deploy-script-chain", "스크립트 체인", "[data-help-id=\"db-sync-deploy-script-chain\"]", "DbSyncDeployScriptChain", "content",
                        Collections.emptyList(), "windows-db-sync-push-and-fresh-deploy-221.sh 의 단계와 필요한 증적을 단계별로 설명합니다."),
                surface("db-sync-deploy-evidence", "DB 동기화 실행 증적", "[data-help-id=\"db-sync-deploy-evidence\"]", "DbSyncDeployEvidencePanel", "content",
                        Collections.emptyList(), "서버 올리기 테스트와 정책 검증 결과를 실행 증적으로 보여줍니다."),
                surface("db-sync-deploy-policy-validation", "DB 동기화 정책 검증", "[data-help-id=\"db-sync-deploy-policy-validation\"]", "DbSyncDeployPolicyValidation", "content",
                        Collections.singletonList("db-sync-deploy-validate-policy"), "가드레일, 기본 SQL 세트, 실행 소스, 증적 원장 조건을 별도 검증합니다."),
                surface("db-sync-deploy-history", "DB 동기화 실행 이력", "[data-help-id=\"db-sync-deploy-history\"]", "DbSyncDeployHistory", "content",
                        Collections.emptyList(), "로컬 증적 원장에서 최근 중앙 실행 이력을 보여줍니다."),
                surface("db-sync-deploy-breakglass", "긴급 우회 규칙", "[data-help-id=\"db-sync-deploy-breakglass\"]", "DbSyncDeployBreakglass", "content",
                        Collections.singletonList("db-sync-deploy-breakglass"), "page/queue 실행과 breakglass 실행의 필수 입력 차이를 설명합니다."))
        );
        page.put("events", Arrays.asList(
                event("db-sync-deploy-analyze", "DB 동기화 사전 점검", "click", "analyzeDbSyncDeploy", "[data-help-id=\"db-sync-deploy-policy\"] .gov-btn-primary",
                        Collections.emptyList(), "정책 행, diff 위험도, backup/freshness/rollback 증적 요구사항을 먼저 점검합니다."),
                event("db-sync-deploy-validate-policy", "DB 동기화 정책 검증", "click", "validateDbSyncDeployPolicy", "[data-help-id=\"db-sync-deploy-policy\"] .gov-btn-secondary",
                        Collections.emptyList(), "가드레일, 기본 SQL 세트, 실행 소스, 증적 원장 조건을 실행 전 별도 검증합니다."),
                event("db-sync-deploy-server-up-test", "DB 동기화 서버 올리기 테스트", "click", "executeDbSyncDeploy", "[data-help-id=\"db-sync-deploy-policy\"] .gov-btn-secondary",
                        Collections.emptyList(), "build/restart/freshness/route proof 기준의 제한된 서버 올리기 테스트를 실행합니다."),
                event("db-sync-deploy-breakglass", "긴급 우회 규칙 확인", "click", "reviewBreakglassPolicy", "[data-help-id=\"db-sync-deploy-breakglass\"] .gov-btn-secondary",
                        Collections.emptyList(), "breakglass 실행 허용 조건과 감사 필수 항목을 확인합니다."))
        );
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A0060406"), "DB 동기화 배포 화면에 연결되는 관리자 메뉴 코드입니다."),
                codeGroup("COMTNMENUFUNCTIONINFO", "기능 코드", Arrays.asList("A0060406_VIEW", "A0060406_ANALYZE", "A0060406_VALIDATE", "A0060406_EXECUTE", "A0060406_BREAKGLASS"),
                        "페이지 조회, 사전 점검, 실행, 긴급 우회 실행 권한 코드입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildPlatformStudioPage(String pageId, String label, String routePath, String menuCode, String focus) {
        Map<String, Object> page = pageOption(pageId, label, routePath, menuCode, "admin");
        page.put("summary", "기존 풀스택 관리와 SR 워크벤치를 통합해 메뉴 생성, 자원 편집, 작업 지시까지 한 콘솔에서 수행하는 화면입니다.");
        page.put("source", "frontend/src/features/platform-studio/PlatformStudioMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("platform-studio-tabs", "포커스 탭", ".gov-card .gov-btn", "PlatformStudioTabs", "actions",
                        Collections.singletonList("platform-studio-focus-change"), "선택한 관리 포커스에 따라 같은 registry를 다른 시각으로 편집합니다."),
                surface("platform-studio-menus", "관리 대상 메뉴 목록", ".gov-card aside", "PlatformStudioMenuList", "content",
                        Collections.singletonList("platform-studio-menu-select"), "메뉴별 coverage와 연결 상태를 보며 관리 대상을 선택합니다."),
                surface("platform-studio-registry", "자원 레지스트리 편집", ".gov-card .gov-textarea", "PlatformStudioRegistry", "content",
                        Arrays.asList("platform-studio-registry-save", "platform-studio-visibility-toggle"), "메뉴, 이벤트, 함수, API, DB 자원을 한 페이지에서 저장합니다."),
                surface("platform-studio-automation", "자동화 작업 지시", ".gov-card .gov-input", "PlatformStudioAutomation", "content",
                        Collections.singletonList("platform-studio-ticket-create"), "선택 자원 기준으로 SR 티켓과 AI 작업 지시문을 생성합니다.")
        ));
        page.put("events", Arrays.asList(
                event("platform-studio-focus-change", "포커스 탭 변경", "click", "setFocus", ".gov-card .gov-btn",
                        Collections.singletonList("admin.full-stack-management.page"), "탭별 초점만 바꾸고 동일한 registry source를 유지합니다."),
                event("platform-studio-menu-select", "메뉴 선택", "click", "setSelectedMenuCode", ".gov-card aside button",
                        Arrays.asList("admin.full-stack-management.page", "platform.help-management.screen-command.page"), "선택 메뉴의 screen command와 registry를 함께 불러옵니다."),
                event("platform-studio-registry-save", "레지스트리 저장", "click", "saveRegistry", ".gov-card .gov-btn-primary",
                        Arrays.asList("admin.full-stack-management.registry-save"), "한 페이지에서 편집한 자원 레지스트리를 저장합니다."),
                event("platform-studio-visibility-toggle", "메뉴 숨김/보이기", "click", "toggleVisibility", ".gov-card .gov-btn-outline",
                        Arrays.asList("admin.full-stack-management.visibility"), "선택한 페이지 메뉴를 hide/show 처리합니다."),
                event("platform-studio-ticket-create", "AI 작업 티켓 생성", "click", "createAutomationTicket", ".gov-card .gov-btn-primary",
                        Arrays.asList("platform.workbench.ticket.create"), "현재 선택된 자원 기준으로 SR 티켓과 실행 지시를 생성합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("platform-studio-registry-schema", "플랫폼 스튜디오 레지스트리", "FULL_STACK_GOVERNANCE_REGISTRY",
                        Arrays.asList("MENU_CODE", "PAGE_ID", "EVENT_IDS", "FUNCTION_IDS", "API_IDS", "TABLE_NAMES", "COLUMN_NAMES"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "메뉴 중심 자원 연결 registry입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList(menuCode, "AMENU_SYSTEM_FULL_STACK_MANAGEMENT", "AMENU_SYSTEM_SR_WORKBENCH"),
                        "플랫폼 스튜디오 계열 운영 메뉴를 묶습니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        page.put("focus", focus);
        return page;
    }

    private Map<String, Object> buildHelpManagementPage() {
        Map<String, Object> page = pageOption("help-management", "도움말 운영", "/admin/system/help-management", "A1900101", "admin");
        page.put("summary", "화면별 도움말과 수정 디렉션 메타데이터를 함께 운영하는 관리자 시스템 화면입니다.");
        page.put("source", "frontend/src/features/help-management/HelpManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("help-page-selector", "대상 페이지 선택", "[data-help-id=\"help-management-select\"]", "HelpPageSelector", "actions",
                        Arrays.asList("help-page-load", "help-command-page-load"), "도움말 대상 화면과 수정 디렉션 대상 화면을 선택합니다."),
                surface("help-metadata-form", "도움말 메타데이터", "[data-help-id=\"help-management-page-form\"]", "HelpMetadataForm", "content",
                        Arrays.asList("help-save"), "도움말 제목, 버전, 요약을 관리합니다."),
                surface("help-items-editor", "도움말 단계 편집", "[data-help-id=\"help-management-items\"]", "HelpItemsEditor", "content",
                        Arrays.asList("help-item-add", "help-item-remove"), "overlay 단계별 안내를 편집합니다."),
                surface("screen-command-center", "수정 디렉션 탭", "[data-help-id=\"help-management-command-center\"]", "ScreenCommandCenterPanel", "content",
                        Arrays.asList("help-command-page-load", "help-command-direction-generate"), "요소, 이벤트, API, 컨트롤러, 스키마 연결을 탐색합니다.")
        ));
        page.put("events", Arrays.asList(
                event("help-page-load", "도움말 불러오기", "click", "handleLoad", "[data-help-id=\"help-management-select\"] button",
                        Arrays.asList("platform.help-management.page"), "선택한 페이지 도움말을 불러옵니다."),
                event("help-save", "도움말 저장", "click", "handleSave", "[data-help-id=\"help-management-select\"] .primary-button",
                        Arrays.asList("platform.help-management.save"), "도움말 메타데이터와 단계를 저장합니다."),
                event("help-item-add", "도움말 단계 추가", "click", "addItem", "[data-help-id=\"help-management-items\"] .secondary-button",
                        Collections.emptyList(), "신규 도움말 단계를 편집 리스트에 추가합니다."),
                event("help-item-remove", "도움말 단계 삭제", "click", "removeItem", "[data-help-id=\"help-management-items\"] .secondary-button",
                        Collections.emptyList(), "기존 단계의 순서를 재정렬합니다."),
                event("help-command-page-load", "수정 디렉션 대상 로드", "change", "loadCommandPage", "[data-help-id=\"help-management-command-center\"] select",
                        Arrays.asList("platform.help-management.screen-command.page"), "선택한 화면의 연결 메타데이터를 조회합니다."),
                event("help-command-direction-generate", "수정 디렉션 생성", "click", "buildDirectionPreview", "[data-help-id=\"help-management-command-center\"] [data-action=\"generate\"]",
                        Collections.emptyList(), "선택한 레이어/이벤트/API 기준으로 작업 지시 초안을 만듭니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("ui-help-page-schema", "도움말 운영 스키마", "UI_HELP_PAGE / UI_HELP_ITEM",
                        Arrays.asList("PAGE_ID", "TITLE", "SUMMARY", "ITEM_ID", "ANCHOR_SELECTOR", "DISPLAY_ORDER"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE", "DELETE"), "화면 도움말 overlay 데이터 저장소입니다."),
                schema("menu-feature-schema", "메뉴/기능 권한 스키마", "COMTNMENUINFO / COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("MENU_CODE", "MENU_URL", "FEATURE_CODE", "AUTHOR_CODE"),
                        Arrays.asList("SELECT"), "페이지 기능 권한과 메뉴 연결을 해석합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A1900101", "A1900102", "A1900103", "A1900104"), "관리자 AI 운영 메뉴 분류입니다."),
                codeGroup("CHANGE_LAYER", "수정 레이어", Arrays.asList("UI", "CSS", "EVENT", "API", "CONTROLLER", "SERVICE", "MAPPER", "SCHEMA", "MENU_AUTH"),
                        "수정 지시 생성 시 선택하는 레이어 그룹입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildCodexRequestPage() {
        Map<String, Object> page = pageOption("codex-request", "Codex 실행 콘솔", "/admin/system/codex-request", "A1900103", "admin");
        page.put("summary", "SR 티켓 기반 중앙 실행 큐에서 runtime config, plan/build 결과, 레거시 provision 프록시를 함께 운영하는 AI 실행 콘솔입니다.");
        page.put("source", "frontend/src/features/codex-provision/CodexProvisionMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("codex-request-runtime", "런타임 설정", "[data-help-id=\"codex-request-runtime\"]", "CodexRuntimeConfigPanel", "actions",
                        Arrays.asList("codex-ticket-refresh"), "현재 Codex/runner 설정과 command 구성을 확인합니다."),
                surface("codex-history-table", "SR 실행 큐", "[data-help-id=\"codex-history-table\"]", "CodexQueueTable", "content",
                        Arrays.asList("codex-ticket-select", "codex-ticket-prepare", "codex-ticket-plan", "codex-ticket-build", "codex-ticket-delete"), "SR 티켓을 준비, 계획 수립, 빌드 실행, 삭제합니다."),
                surface("codex-request-ticket-detail", "선택 티켓 상세", "[data-help-id=\"codex-request-ticket-detail\"]", "CodexTicketDetailPanel", "content",
                        Arrays.asList("codex-ticket-detail-load"), "선택한 티켓의 상태, 지시문, artifact path를 확인합니다."),
                surface("codex-request-plan-result", "Plan 결과", "[data-help-id=\"codex-request-plan-result\"]", "CodexPlanArtifactPanel", "content",
                        Arrays.asList("codex-ticket-artifact-plan"), "선택 티켓의 plan result 또는 plan stdout 아티팩트를 미리봅니다."),
                surface("codex-request-build-result", "Build 결과", "[data-help-id=\"codex-request-build-result\"]", "CodexBuildArtifactPanel", "content",
                        Arrays.asList("codex-ticket-artifact-build"), "선택 티켓의 build stdout, diff, changed files를 미리봅니다."),
                surface("codex-request-setup", "레거시 Provision 프록시", "#payload", "CodexRequestSetup", "actions",
                        Arrays.asList("codex-login-check", "codex-run-provision", "codex-format-payload"), "기존 payload 기반 등록 프록시를 필요 시 함께 사용합니다."),
                surface("codex-response-panel", "Codex 응답 결과", ".gov-card", "CodexResponsePanel", "content",
                        Collections.emptyList(), "HTTP 상태와 created/existing/skipped 결과를 확인합니다."),
                surface("codex-request-history-review", "Codex 실행 이력", "table", "CodexHistoryTable", "content",
                        Arrays.asList("codex-history-refresh", "codex-history-inspect", "codex-history-remediate"), "최근 실행 이력과 조치 결과를 다시 확인합니다.")
        ));
        page.put("events", Arrays.asList(
                event("codex-ticket-refresh", "티켓 큐 새로고침", "load", "fetchCodexProvisionPage", "[data-help-id=\"codex-request-runtime\"]",
                        Arrays.asList("platform.codex-request.tickets"), "SR 실행 큐와 runtime config를 다시 불러옵니다."),
                event("codex-ticket-select", "SR 티켓 선택", "click", "setSelectedTicketId", "[data-help-id=\"codex-history-table\"] tr",
                        Arrays.asList("platform.codex-request.ticket-detail", "platform.codex-request.ticket-artifact"), "선택한 티켓의 상세와 아티팩트를 조회합니다."),
                event("codex-ticket-detail-load", "선택 티켓 상세 조회", "load", "fetchCodexSrTicketDetail", "[data-help-id=\"codex-request-ticket-detail\"]",
                        Arrays.asList("platform.codex-request.ticket-detail"), "선택 티켓의 요약, instruction, runner comment를 조회합니다."),
                event("codex-ticket-artifact-plan", "Plan 아티팩트 조회", "load", "fetchCodexSrTicketArtifact", "[data-help-id=\"codex-request-plan-result\"]",
                        Arrays.asList("platform.codex-request.ticket-artifact"), "plan result 또는 plan stdout 파일을 미리 조회합니다."),
                event("codex-ticket-artifact-build", "Build 아티팩트 조회", "load", "fetchCodexSrTicketArtifact", "[data-help-id=\"codex-request-build-result\"]",
                        Arrays.asList("platform.codex-request.ticket-artifact"), "build stdout, diff, changed files를 미리 조회합니다."),
                event("codex-ticket-prepare", "SR 티켓 준비", "click", "prepareCodexSrTicket", "[data-help-id=\"codex-history-table\"] .gov-btn-outline",
                        Arrays.asList("platform.codex-request.ticket-prepare"), "선택 티켓을 READY_FOR_CODEX 상태로 전환합니다."),
                event("codex-ticket-plan", "SR 티켓 계획 수립", "click", "planCodexSrTicket", "[data-help-id=\"codex-history-table\"] .gov-btn-outline",
                        Arrays.asList("platform.codex-request.ticket-plan"), "선택 티켓에 대해 read-only Codex plan 을 실행합니다."),
                event("codex-ticket-build", "SR 티켓 빌드 실행", "click", "executeCodexSrTicket", "[data-help-id=\"codex-history-table\"] .gov-btn-primary",
                        Arrays.asList("platform.codex-request.ticket-build"), "PLAN_COMPLETED 티켓에 대해 build 실행을 시작합니다."),
                event("codex-ticket-delete", "SR 티켓 삭제", "click", "deleteCodexSrTicket", "[data-help-id=\"codex-history-table\"] .gov-btn-outline",
                        Arrays.asList("platform.codex-request.ticket-delete"), "중앙 실행 큐에서 SR 티켓을 제거합니다."),
                event("codex-login-check", "Codex 인증 확인", "click", "runCodexLoginCheck", ".gov-btn",
                        Arrays.asList("platform.codex-request.login"), "내부 프록시와 API 키 구성을 확인합니다."),
                event("codex-run-provision", "Codex 등록 실행", "click", "executeCodexProvision", ".gov-btn",
                        Arrays.asList("platform.codex-request.execute"), "입력한 payload로 메뉴/기능/권한 등록을 실행합니다."),
                event("codex-format-payload", "Payload 정렬", "click", "JSON.parse", ".gov-btn",
                        Collections.emptyList(), "JSON payload를 보기 좋은 형태로 정렬합니다."),
                event("codex-history-refresh", "이력 새로고침", "click", "historyState.reload", ".gov-btn",
                        Arrays.asList("platform.codex-request.history"), "최근 실행 이력을 다시 불러옵니다."),
                event("codex-history-inspect", "실행 이력 재점검", "click", "inspectCodexHistory", "table .gov-btn-outline",
                        Arrays.asList("platform.codex-request.inspect"), "선택한 요청의 회사/페이지/메뉴/기능 매핑 상태를 재점검합니다."),
                event("codex-history-remediate", "실행 이력 조치", "click", "remediateCodexHistory", "table .gov-btn-primary",
                        Arrays.asList("platform.codex-request.remediate"), "선택한 요청을 기준으로 다시 조치 실행합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("codex-request-schema", "Codex 요청/이력 모델", "CODEX_EXECUTION_LOG / requestJson",
                        Arrays.asList("requestId", "targetApiPath", "companyId", "actorUserId", "executionStatus", "httpStatus", "issueSummary"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "Codex 요청 원문과 실행 이력 저장 모델입니다."),
                schema("sr-ticket-runner-schema", "SR 티켓 실행 모델", "security.codex.sr-ticket-file / security.codex.runner.history-file",
                        Arrays.asList("ticketId", "executionStatus", "planRunId", "planResultPath", "executionRunId", "executionLogPath", "executionDiffPath"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE", "DELETE"), "SR 티켓 상태와 runner artifact 경로를 기록하는 임시 JSONL 기반 실행 모델입니다."),
                schema("menu-feature-schema", "메뉴/기능 권한 스키마", "COMTNMENUINFO / COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("MENU_CODE", "MENU_URL", "FEATURE_CODE", "AUTHOR_CODE"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "Codex 요청 대상 메뉴와 기능/권한 상태를 해석합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A1900101", "A1900102", "A1900103", "A1900104"), "관리자 AI 운영 메뉴 분류입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildSrWorkbenchPage() {
        Map<String, Object> page = pageOption("sr-workbench", "SR 워크벤치", "/admin/system/sr-workbench", "A1900102", "admin");
        page.put("summary", "화면 메타데이터 기준 SR 티켓을 발행하고 승인 및 Codex 실행 준비 상태를 관리하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/sr-workbench/SrWorkbenchMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("sr-ticket-draft", "SR 초안 작성", "[data-help-id=\"sr-ticket-draft\"]", "SrTicketDraftForm", "actions",
                        Arrays.asList("sr-page-load", "sr-direction-generate", "sr-ticket-create"), "화면, 요소, 이벤트, 수정 레이어와 지시문을 선택합니다."),
                surface("sr-direction-preview", "해결 지시 미리보기", "[data-help-id=\"sr-direction-preview\"]", "SrDirectionPreview", "content",
                        Collections.emptyList(), "Direction과 Codex prompt를 검토합니다."),
                surface("sr-ticket-table", "SR 티켓 테이블", "[data-help-id=\"sr-ticket-table\"]", "SrTicketTable", "content",
                        Arrays.asList("sr-ticket-approve", "sr-ticket-reject", "sr-ticket-prepare-execution"), "승인, 반려, 실행 준비 상태를 제어합니다.")
        ));
        page.put("events", Arrays.asList(
                event("sr-page-load", "워크벤치 화면 로드", "click", "load", "[data-help-id=\"sr-ticket-draft\"] .primary-button",
                        Arrays.asList("platform.workbench.page", "platform.help-management.screen-command.page"), "선택한 화면 기준 워크벤치와 연결 메타데이터를 불러옵니다."),
                event("sr-direction-generate", "해결 지시 생성", "click", "handleGenerate", "[data-help-id=\"sr-ticket-draft\"] .secondary-button",
                        Collections.emptyList(), "선택한 메타데이터를 바탕으로 SR 해결 direction을 생성합니다."),
                event("sr-ticket-create", "SR 티켓 발행", "click", "handleCreateTicket", "[data-help-id=\"sr-ticket-draft\"] .primary-button",
                        Arrays.asList("platform.workbench.ticket.create"), "현재 direction을 기준으로 티켓을 저장합니다."),
                event("sr-ticket-approve", "SR 승인", "click", "handleApprove", "[data-help-id=\"sr-ticket-table\"] .secondary-button",
                        Arrays.asList("platform.workbench.ticket.approve"), "티켓을 승인 상태로 바꿉니다."),
                event("sr-ticket-reject", "SR 반려", "click", "handleApprove", "[data-help-id=\"sr-ticket-table\"] .secondary-button",
                        Arrays.asList("platform.workbench.ticket.approve"), "티켓을 반려 상태로 바꿉니다."),
                event("sr-ticket-prepare-execution", "실행 준비", "click", "handlePrepareExecution", "[data-help-id=\"sr-ticket-table\"] .primary-button",
                        Arrays.asList("platform.workbench.ticket.prepare-execution"), "승인된 티켓을 Codex 실행 준비 상태로 전환합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("sr-ticket-schema", "SR 티켓 저장 모델", "SR_TICKET_JSONL",
                        Arrays.asList("ticketId", "status", "pageId", "surfaceId", "eventId", "targetId", "generatedDirection", "commandPrompt"),
                        Arrays.asList("INSERT", "UPDATE"), "파일 기반 SR 티켓 저장소입니다."),
                schema("menu-feature-schema", "메뉴/기능 권한 스키마", "COMTNMENUINFO / COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("MENU_CODE", "MENU_URL", "FEATURE_CODE", "AUTHOR_CODE"),
                        Arrays.asList("SELECT"), "워크벤치 자체의 메뉴/권한 연결을 해석합니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("SR_TICKET_STATUS", "SR 티켓 상태", Arrays.asList("OPEN", "APPROVED", "REJECTED", "READY_FOR_CODEX"), "티켓 상태 전이에 사용됩니다."),
                codeGroup("CHANGE_LAYER", "수정 레이어", Arrays.asList("UI", "CSS", "EVENT", "API", "CONTROLLER", "SERVICE", "MAPPER", "SCHEMA", "MENU_AUTH"),
                        "SR 지시 생성 시 선택하는 레이어 그룹입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildWbsManagementPage() {
        Map<String, Object> page = pageOption("wbs-management", "WBS 관리", "/admin/system/wbs-management", "A1900104", "admin");
        page.put("summary", "메뉴별 WBS 인벤토리, 계획/실적 일정 저장, 편차 지표, Codex 작업 지시문, 저장 감사 기록을 운영하고 아직 차단된 SR 직접 연결, bulk update, 감사 export 계약을 구분하는 관리자 화면입니다.");
        page.put("source", "frontend/src/features/wbs-management/WbsManagementMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("wbs-summary-cards", "WBS 요약 카드", "[data-help-id=\"wbs-summary-cards\"]", "WbsSummaryCards", "actions",
                        Collections.emptyList(), "범위, 페이지 메뉴 수, 지연 건수, 정시 완료율, 평균 편차, 예상일정 미입력 수를 한 번에 보여줍니다."),
                surface("wbs-closeout-gate", "WBS 완료 게이트", "[data-help-id=\"wbs-closeout-gate\"]", "WbsCloseoutGate", "content",
                        Collections.emptyList(), "현재 가능한 메뉴 인벤토리, 일정 저장, 편차 산출, Codex 지시문, 저장 감사와 아직 필요한 SR 연결, bulk update, 감사 export를 구분합니다."),
                surface("wbs-action-contract", "WBS 차단 조치 계약", "[data-help-id=\"wbs-action-contract\"] button[disabled]", "WbsActionContract", "actions",
                        Collections.singletonList("wbs-action-contract-blocked"), "SR 티켓 생성/동기화, bulk 일정 업데이트, 감사 증적 export는 백엔드 계약 연결 전까지 비활성화합니다."),
                surface("wbs-menu-tree", "메뉴 트리", "[data-help-id=\"wbs-menu-tree\"]", "WbsMenuTree", "content",
                        Arrays.asList("wbs-menu-scope-change", "wbs-menu-select"), "HOME/ADMIN 트리에서 대상 메뉴를 선택합니다."),
                surface("wbs-execution-table", "실행용 WBS 표", "[data-help-id=\"wbs-execution-table\"]", "WbsExecutionTable", "content",
                        Arrays.asList("wbs-row-select", "wbs-excel-download"), "예상/실적 일정, 상태, 편차, 메타 커버리지를 표로 비교하고 엑셀로 내려받습니다."),
                surface("wbs-editor-panel", "선택 메뉴 계획 편집", "[data-help-id=\"wbs-editor-panel\"]", "WbsEditorPanel", "content",
                        Arrays.asList("wbs-entry-save"), "선택 메뉴의 담당자, 상태, 진행률, 예상/실적 일정, 메모, 추가 지시를 저장합니다."),
                surface("wbs-codex-prompt", "Codex 작업 지시문", "[data-help-id=\"wbs-codex-prompt\"]", "WbsCodexPrompt", "content",
                        Collections.singletonList("wbs-open-codex-request"), "저장된 계획을 기준으로 Codex 지시문을 복사하고 Codex 요청 화면으로 이동합니다.")
        ));
        page.put("events", Arrays.asList(
                event("wbs-menu-scope-change", "WBS 범위 전환", "click", "setMenuType", "[data-help-id=\"wbs-menu-tree\"] .gov-btn",
                        Arrays.asList("admin.wbs-management.page"), "HOME/ADMIN 범위를 바꿔 해당 메뉴 집합을 다시 불러옵니다."),
                event("wbs-menu-select", "WBS 메뉴 선택", "click", "setSelectedMenuCode", "[data-help-id=\"wbs-menu-tree\"] button",
                        Collections.emptyList(), "선택한 메뉴 기준으로 계획 편집기와 Codex 지시문을 동기화합니다."),
                event("wbs-row-select", "WBS 실행 행 선택", "click", "setSelectedMenuCode", "[data-help-id=\"wbs-execution-table\"] tr",
                        Collections.emptyList(), "실행 표에서 메뉴 행을 클릭해 상세 계획을 편집합니다."),
                event("wbs-excel-download", "WBS 엑셀 다운로드", "click", "excelDownloadHref", "[data-help-id=\"wbs-execution-table\"] a",
                        Arrays.asList("admin.wbs-management.excel"), "현재 범위와 필터 기준으로 WBS 엑셀을 내려받습니다."),
                event("wbs-entry-save", "WBS 항목 저장", "click", "handleSave", "[data-help-id=\"wbs-editor-panel\"] .gov-btn-primary",
                        Arrays.asList("admin.wbs-management.entry-save"), "선택 메뉴의 일정/담당/메모/Codex 지시를 저장합니다."),
                event("wbs-open-codex-request", "Codex 요청 화면 열기", "click", "buildLocalizedPath", "[data-help-id=\"wbs-codex-prompt\"] a",
                        Collections.emptyList(), "현재 작성한 지시문을 이어서 Codex 요청 화면에서 실행합니다."),
                event("wbs-action-contract-blocked", "WBS 미구현 조치 차단 상태 표시", "render", "WbsActionContract", "[data-help-id=\"wbs-action-contract\"]",
                        Collections.emptyList(), "SR 직접 연결, bulk update, 감사 export API가 연결되기 전까지 조치를 차단합니다.")
        ));
        page.put("apis", Arrays.asList(
                api("governance-list", "프로젝트 런타임 목록", "GET", "/api/operations/governance/runtime/projects", "PlatformRuntimeGovernanceApiController", "listProjects", "ProjectManifestService", Collections.emptyList(), Collections.emptyList(), "manifest 읽기"),
                api("governance-upgrade", "업그레이드 판별", "GET", "/api/operations/governance/runtime/projects/{id}/upgrades", "PlatformRuntimeGovernanceApiController", "getUpgradeCandidates", "UpgradeGovernanceService", Collections.emptyList(), Collections.emptyList(), "호환성 매트릭스 계산")
        ));
        page.put("schemas", Arrays.asList(
                schema("wbs-management-schema", "WBS 관리 모델", "data/wbs-management/entries.json / COMTNMENUINFO",
                        Arrays.asList("menuType", "menuCode", "owner", "status", "progress", "plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate", "notes", "codexInstruction", "updatedAt"),
                        Arrays.asList("SELECT", "UPSERT", "EXPORT"), "메뉴별 일정 계획과 실행 메모, Codex 지시문 저장소입니다."),
                schema("wbs-management-sr-link-schema", "WBS-SR 연결 모델", "PENDING_WBS_SR_LINK / SR_TICKET_JSONL",
                        Arrays.asList("menuCode", "ticketId", "ticketStatus", "planRunId", "buildRunId", "linkedAt", "syncedAt"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "WBS 행과 SR/Codex 실행 티켓을 직접 연결하기 위한 후속 모델입니다."),
                schema("wbs-management-audit-schema", "WBS 감사 모델", "BUSINESS_AUDIT_LOG / PENDING_WBS_AUDIT_EXPORT",
                        Arrays.asList("auditId", "menuCode", "actionType", "beforePayload", "afterPayload", "actorId", "actorRole", "executedAt", "srTicketId"),
                        Arrays.asList("SELECT", "INSERT", "EXPORT"), "단일 저장 감사는 기록되며, 조회/export 계약은 후속 구현 대상입니다.")
        ));
        page.put("commonCodeGroups", Arrays.asList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A1900104"), "WBS 관리 메뉴 분류입니다."),
                codeGroup("WBS_STATUS", "WBS 상태", Arrays.asList("NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"), "WBS 진행 상태 분류입니다."),
                codeGroup("WBS_ACTION", "WBS 조치 유형", Arrays.asList("ENTRY_SAVE", "EXCEL_EXPORT", "SR_TICKET_LINK", "BULK_UPDATE", "AUDIT_EXPORT"), "WBS 저장, export, 후속 SR/bulk/audit 조치 구분값입니다.")
        ));
        page.put("changeTargets", Arrays.asList(
                changeTarget("wbs-entry-plan", "WBS 단일 계획", Arrays.asList("owner", "status", "progress", "plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate", "notes", "codexInstruction"),
                        "선택 메뉴의 계획/실적 일정과 작업 지시를 저장합니다."),
                changeTarget("wbs-sr-link", "WBS-SR 티켓 연결", Arrays.asList("menuCode", "ticketId", "ticketStatus", "planRunId", "buildRunId"),
                        "후속 구현에서 WBS 행과 SR/Codex 티켓 상태를 연결합니다."),
                changeTarget("wbs-audit-evidence", "WBS 감사 증적", Arrays.asList("beforePayload", "afterPayload", "actorId", "actorRole", "srTicketId"),
                        "저장 감사 기록의 조회/export 범위를 정의합니다.")
        ));
        return page;
    }

    private Map<String, Object> buildNewPage() {
        Map<String, Object> page = pageOption("new-page", "새 페이지", "/admin/system/new-page", "A1900106", "admin");
        page.put("summary", "대상 업무가 정해지기 전에 안전한 기본 골격으로 생성한 관리자 신규 페이지입니다.");
        page.put("source", "frontend/src/features/new-page/NewPageMigrationPage.tsx");
        page.put("surfaces", Arrays.asList(
                surface("new-page-status", "기본 상태 안내", ".gov-card, section", "NewPageStatusNotice", "header",
                        Collections.emptyList(), "이 페이지가 스캐폴드 상태임을 안내합니다."),
                surface("new-page-summary", "기본 메트릭", ".gov-card", "NewPageSummaryCards", "actions",
                        Collections.emptyList(), "기본 경로, 언어 범위, 현재 상태를 요약합니다."),
                surface("new-page-checklist", "후속 구현 체크리스트", ".gov-card", "NewPageStarterChecklist", "content",
                        Collections.emptyList(), "메뉴, API, 권한, 화면 타입 확정 순서를 안내합니다.")
        ));
        page.put("events", Collections.singletonList(
                event("new-page-navigation", "새 페이지 진입", "click", "browser-navigation", "a[href=\"/admin/system/new-page\"]",
                        Collections.emptyList(), "관리자 셸에서 새 페이지 스캐폴드로 이동합니다.")
        ));
        page.put("apis", Collections.singletonList(
                api("admin.new-page.page", "새 페이지 진입", "GET", "/admin/system/new-page",
                        "AdminSystemCodeController.newPage", "React migration redirect",
                        "N/A", Arrays.asList("COMTNMENUINFO", "COMTNMENUFUNCTIONINFO"), Collections.emptyList(),
                        "신규 관리자 페이지 스캐폴드의 React 진입 경로입니다.")
        ));
        page.put("schemas", Collections.singletonList(
                schema("new-page-menu-schema", "새 페이지 메뉴 메타", "COMTNMENUINFO / COMTNMENUFUNCTIONINFO / COMTNAUTHORFUNCTIONRELATE",
                        Arrays.asList("MENU_CODE", "MENU_URL", "FEATURE_CODE", "AUTHOR_CODE"),
                        Arrays.asList("SELECT", "INSERT", "UPDATE"), "새 페이지 메뉴와 VIEW 권한 연결에 필요한 기본 메타데이터입니다.")
        ));
        page.put("commonCodeGroups", Collections.singletonList(
                codeGroup("AMENU1", "관리자 메뉴 코드", Arrays.asList("A1900106"), "새 페이지 메뉴 코드 분류입니다.")
        ));
        page.put("changeTargets", defaultChangeTargets());
        return page;
    }

    private Map<String, Object> buildMenuPermission(String menuCode, String menuLookupUrl, String routePath) throws Exception {
        String resolvedMenuCode = firstNonBlank(menuCode, safeSelectMenuCode(menuLookupUrl), safeSelectMenuCode(routePath));
        String requiredViewFeatureCode = firstNonBlank(
                safeSelectRequiredViewFeatureCode(menuLookupUrl),
                safeSelectRequiredViewFeatureCode(routePath)
        );
        List<String> featureCodes = resolvedMenuCode.isEmpty()
                ? Collections.emptyList()
                : safeList(authGroupManageService.selectFeatureCodesByMenuCode(resolvedMenuCode));

        Set<String> featureCodeSet = new LinkedHashSet<>(featureCodes);
        if (!requiredViewFeatureCode.isEmpty()) {
            featureCodeSet.add(requiredViewFeatureCode);
        }

        List<Map<String, Object>> featureRows = new ArrayList<>();
        for (FeatureCatalogItemVO item : safeFeatureCatalog()) {
            if (item == null) {
                continue;
            }
            if (!resolvedMenuCode.isEmpty() && resolvedMenuCode.equalsIgnoreCase(stringValue(item.getMenuCode()))) {
                featureRows.add(featureRow(item));
                continue;
            }
            if (!requiredViewFeatureCode.isEmpty() && requiredViewFeatureCode.equalsIgnoreCase(stringValue(item.getFeatureCode()))) {
                featureRows.add(featureRow(item));
            }
        }

        Map<String, Object> permission = new LinkedHashMap<>();
        permission.put("menuCode", resolvedMenuCode);
        permission.put("menuLookupUrl", menuLookupUrl);
        permission.put("routePath", routePath);
        permission.put("requiredViewFeatureCode", requiredViewFeatureCode);
        permission.put("featureCodes", new ArrayList<>(featureCodeSet));
        permission.put("featureRows", featureRows);
        permission.put("relationTables", Arrays.asList("COMTNMENUINFO", "COMTNMENUFUNCTIONINFO", "COMTNAUTHORFUNCTIONRELATE"));
        permission.put("resolverNotes", Arrays.asList(
                "메뉴 URL은 COMTNMENUINFO.MENU_URL 기준으로 해석합니다.",
                "VIEW 권한은 AuthGroupManageService.selectRequiredViewFeatureCodeByMenuUrl 로 조회합니다.",
                "실제 요청 차단은 AdminMainAuthInterceptor 의 메뉴/기능코드 판정 흐름과 연결됩니다."
        ));
        return permission;
    }

    private List<Map<String, Object>> defaultChangeTargets() {
        return Arrays.asList(
                changeTarget("ui", "UI 요소 수정", Arrays.asList("selector", "layoutZone", "label", "visibleCondition"),
                        "화면 요소 구조, 라벨, 렌더링 조건을 조정합니다."),
                changeTarget("css", "CSS 매핑 수정", Arrays.asList("className", "spacing", "stateStyle"),
                        "class, spacing token, 상태별 표현을 수정합니다."),
                changeTarget("event", "이벤트 연결 수정", Arrays.asList("eventType", "handler", "triggerSelector"),
                        "클릭/submit/change 이벤트와 프론트 핸들러를 바꿉니다."),
                changeTarget("api", "API 연결 수정", Arrays.asList("method", "endpoint", "payload", "response"),
                        "프론트 API 호출과 DTO 연결을 수정합니다."),
                changeTarget("backend", "컨트롤러/서비스/매퍼 수정", Arrays.asList("controller", "service", "mapperQuery"),
                        "백엔드 호출 체인과 조회/저장 경로를 정리합니다."),
                changeTarget("schema", "스키마/테이블 수정", Arrays.asList("table", "column", "writeType", "audit"),
                        "관련 테이블, 컬럼, 쓰기 유형을 점검합니다."),
                changeTarget("menu-auth", "메뉴/기능권한 수정", Arrays.asList("menuCode", "featureCode", "authorRelation"),
                        "페이지 메뉴 코드, 기능 코드, 권한 연결을 조정합니다."),
                changeTarget("common-code", "공통코드 수정", Arrays.asList("codeId", "code", "label"),
                        "상태코드, 메뉴코드, 분류코드 라벨과 값을 정리합니다.")
        );
    }

    private Map<String, Object> pageOption(String pageId, String label, String routePath, String menuCode, String domainCode) {
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("pageId", pageId);
        page.put("label", label);
        page.put("routePath", routePath);
        page.put("menuCode", menuCode);
        page.put("domainCode", domainCode);
        return page;
    }

    private Map<String, Object> surface(String surfaceId, String label, String selector, String componentId, String layoutZone,
                                        List<String> eventIds, String notes) {
        Map<String, Object> surface = new LinkedHashMap<>();
        surface.put("surfaceId", surfaceId);
        surface.put("label", label);
        surface.put("selector", selector);
        surface.put("componentId", componentId);
        surface.put("layoutZone", layoutZone);
        surface.put("eventIds", eventIds);
        surface.put("notes", notes);
        return surface;
    }

    private Map<String, Object> event(String eventId, String label, String eventType, String frontendFunction,
                                      String triggerSelector, List<String> apiIds, String notes) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", eventId);
        event.put("label", label);
        event.put("eventType", eventType);
        event.put("frontendFunction", frontendFunction);
        event.put("triggerSelector", triggerSelector);
        event.put("apiIds", apiIds);
        event.put("notes", notes);
        event.put("functionInputs", Collections.emptyList());
        event.put("functionOutputs", Collections.emptyList());
        event.put("guardConditions", Collections.emptyList());
        event.put("sideEffects", Collections.emptyList());
        return event;
    }

    private Map<String, Object> api(String apiId, String label, String method, String endpoint,
                                    String controllerAction, String serviceMethod, String mapperQuery,
                                    List<String> relatedTables, List<String> schemaIds, String notes) {
        return api(apiId, label, method, endpoint,
                splitChainValues(controllerAction),
                splitChainValues(serviceMethod),
                splitChainValues(mapperQuery),
                relatedTables, schemaIds, notes);
    }

    private Map<String, Object> api(String apiId, String label, String method, String endpoint,
                                    List<String> controllerActions, List<String> serviceMethods, List<String> mapperQueries,
                                    List<String> relatedTables, List<String> schemaIds, String notes) {
        Map<String, Object> api = new LinkedHashMap<>();
        api.put("apiId", apiId);
        api.put("label", label);
        api.put("method", method);
        api.put("endpoint", endpoint);
        api.put("controllerAction", joinChainValues(controllerActions));
        api.put("serviceMethod", joinChainValues(serviceMethods));
        api.put("mapperQuery", joinChainValues(mapperQueries));
        api.put("controllerActions", controllerActions);
        api.put("serviceMethods", serviceMethods);
        api.put("mapperQueries", mapperQueries);
        api.put("relatedTables", relatedTables);
        api.put("schemaIds", schemaIds);
        api.put("notes", notes);
        api.put("requestFields", Collections.emptyList());
        api.put("responseFields", Collections.emptyList());
        api.put("maskingRules", Collections.emptyList());
        return api;
    }

    private Map<String, Object> routeApi(String apiId, String label, String endpoint, String menuCode) {
        return api(apiId, label, "GET", endpoint,
                Collections.singletonList("RouteForward"),
                Collections.singletonList("React router / server forward"),
                Collections.singletonList("N/A"),
                Collections.singletonList(menuCode), Collections.emptyList(), "화면 이동 경로입니다.");
    }

    private Map<String, Object> pendingApi(String apiId, String label, String method, String endpoint, String notes) {
        return api(apiId, label, method, endpoint,
                Collections.singletonList("PENDING_CONTRACT"),
                Collections.singletonList("PENDING_SERVICE"),
                Collections.singletonList("PENDING_AUDIT_STORAGE"),
                Collections.singletonList("PENDING_BACKEND_ACTION"),
                Collections.emptyList(),
                notes);
    }

    private List<String> splitChainValues(String value) {
        if (value == null) {
            return Collections.emptyList();
        }
        List<String> items = new ArrayList<>();
        for (String token : value.split("\\r?\\n|\\s+/\\s+")) {
            String normalized = normalize(token);
            if (!normalized.isEmpty()) {
                items.add(normalized);
            }
        }
        return items;
    }

    private String joinChainValues(List<String> values) {
        return String.join(" / ", values == null ? Collections.emptyList() : values);
    }

    private Map<String, Object> schema(String schemaId, String label, String tableName, List<String> columns,
                                       List<String> writePatterns, String notes) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("schemaId", schemaId);
        schema.put("label", label);
        schema.put("tableName", tableName);
        schema.put("columns", columns);
        schema.put("writePatterns", writePatterns);
        schema.put("notes", notes);
        return schema;
    }

    private Map<String, Object> codeGroup(String codeGroupId, String label, List<String> values, String notes) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("codeGroupId", codeGroupId);
        group.put("label", label);
        group.put("values", values);
        group.put("notes", notes);
        return group;
    }

    private Map<String, Object> changeTarget(String targetId, String label, List<String> editableFields, String notes) {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("targetId", targetId);
        target.put("label", label);
        target.put("editableFields", editableFields);
        target.put("notes", notes);
        return target;
    }

    private Map<String, Object> featureRow(FeatureCatalogItemVO item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("menuCode", stringValue(item.getMenuCode()));
        row.put("menuNm", stringValue(item.getMenuNm()));
        row.put("menuNmEn", stringValue(item.getMenuNmEn()));
        row.put("menuUrl", stringValue(item.getMenuUrl()));
        row.put("featureCode", stringValue(item.getFeatureCode()));
        row.put("featureNm", stringValue(item.getFeatureNm()));
        row.put("featureNmEn", stringValue(item.getFeatureNmEn()));
        row.put("featureDc", stringValue(item.getFeatureDc()));
        row.put("useAt", stringValue(item.getUseAt()));
        return row;
    }

    private void decoratePageMetadata(String pageId, Map<String, Object> page) {
        List<Map<String, Object>> events = safeMapList(page.get("events"));
        List<Map<String, Object>> apis = safeMapList(page.get("apis"));
        switch (pageId) {
            case "signin-login":
                enrichEvent(events, "signin-login-submit",
                        Arrays.asList(
                                field("userId", "string", true, "form.username", "로그인 아이디"),
                                field("userPw", "password", true, "form.password", "사용자 비밀번호"),
                                field("saveId", "boolean", false, "form.checkbox", "아이디 저장 여부"),
                                field("autoLogin", "boolean", false, "form.checkbox", "자동 로그인 여부")
                        ),
                        Arrays.asList(
                                field("status", "string", true, "json", "로그인 결과 상태"),
                                field("userId", "string", true, "json", "인증된 사용자 아이디"),
                                field("userSe", "string", true, "json", "회원 구분"),
                                field("certified", "boolean", true, "json", "추가 본인인증 필요 여부")
                        ),
                        Arrays.asList("userId 공백 금지", "userPw 공백 금지"),
                        Arrays.asList("로그인 세션 생성", "remember-id/auto-login 쿠키 갱신", "홈 또는 인증선택 화면 이동")
                );
                enrichApi(apis, "signin.login.submit",
                        Arrays.asList(
                                field("userId", "string", true, "body", "로그인 아이디"),
                                field("userPw", "password", true, "body", "로그인 비밀번호"),
                                field("userSe", "string", true, "body", "회원 구분"),
                                field("autoLogin", "boolean", false, "body", "자동 로그인 여부")
                        ),
                        Arrays.asList(
                                field("status", "string", true, "json", "loginSuccess/loginFailure"),
                                field("userId", "string", false, "json", "로그인 성공 사용자 아이디"),
                                field("userSe", "string", false, "json", "회원 구분"),
                                field("certified", "boolean", false, "json", "추가 인증 필요 여부"),
                                field("errors", "string", false, "json", "실패 메시지")
                        ),
                        Arrays.asList(
                                mask("userPw", "drop", "원문 비밀번호 저장 금지"),
                                mask("autoLogin", "allow", "기술 플래그만 저장")
                        )
                );
                break;
            case "signin-find-id":
                enrichEvent(events, "signin-find-id-submit",
                        Arrays.asList(
                                field("applcntNm", "string", true, "form", "신청자 이름"),
                                field("email", "string", true, "form", "이메일 주소"),
                                field("tab", "string", true, "route", "국내/해외 탭"),
                                field("verificationCode", "string", false, "form", "이메일 인증번호")
                        ),
                        Arrays.asList(
                                field("nextRoute", "string", true, "route", "결과 화면 경로")
                        ),
                        Arrays.asList("이름 필수", "이메일 필수"),
                        Arrays.asList("결과 화면으로 query string 이동")
                );
                enrichApi(apis, "signin.find-id.result",
                        Arrays.asList(
                                field("applcntNm", "string", true, "query", "신청자 이름"),
                                field("email", "string", true, "query", "이메일 주소"),
                                field("tab", "string", false, "query", "국내/해외 탭")
                        ),
                        Arrays.asList(
                                field("found", "boolean", true, "json", "조회 성공 여부"),
                                field("maskedId", "string", true, "json", "마스킹된 사용자 아이디"),
                                field("passwordResetUrl", "string", true, "json", "비밀번호 재설정 경로"),
                                field("tab", "string", true, "json", "탭 상태")
                        ),
                        Arrays.asList(
                                mask("maskedId", "partial-mask", "사용자 아이디 일부만 노출"),
                                mask("email", "hash-or-drop", "검색용 이메일 원문 재노출 금지")
                        )
                );
                break;
            case "signin-find-id-result":
                enrichEvent(events, "signin-find-id-result-load",
                        Arrays.asList(
                                field("applcntNm", "string", true, "query", "신청자 이름"),
                                field("email", "string", true, "query", "이메일 주소"),
                                field("tab", "string", false, "query", "국내/해외 탭")
                        ),
                        Arrays.asList(
                                field("found", "boolean", true, "state", "조회 성공 여부"),
                                field("maskedId", "string", true, "state", "마스킹 아이디")
                        ),
                        Collections.emptyList(),
                        Arrays.asList("조회 결과 카드 렌더링")
                );
                break;
            case "signin-find-password":
                enrichEvent(events, "signin-find-password-verify",
                        Arrays.asList(
                                field("userId", "string", true, "form", "사용자 아이디"),
                                field("email", "string", false, "form", "이메일 주소"),
                                field("verificationCode", "string", false, "form", "이메일 인증번호"),
                                field("authMethod", "string", false, "form", "인증 수단")
                        ),
                        Arrays.asList(
                                field("verified", "boolean", true, "state", "본인확인 완료 상태")
                        ),
                        Arrays.asList("userId 필수"),
                        Arrays.asList("재설정 폼 활성화")
                );
                enrichEvent(events, "signin-find-password-reset-submit",
                        Arrays.asList(
                                field("userId", "string", true, "state", "확인 완료된 사용자"),
                                field("password", "password", true, "form", "새 비밀번호"),
                                field("passwordConfirm", "password", true, "form", "비밀번호 확인")
                        ),
                        Arrays.asList(
                                field("nextRoute", "string", true, "route", "완료 화면 경로")
                        ),
                        Arrays.asList("verified 상태여야 함", "password와 passwordConfirm 일치"),
                        Arrays.asList("비밀번호 변경", "완료 화면 이동")
                );
                enrichApi(apis, "signin.find-password.reset",
                        Arrays.asList(
                                field("userId", "string", true, "body", "비밀번호 재설정 대상"),
                                field("password", "password", true, "body", "새 비밀번호"),
                                field("passwordConfirm", "password", true, "body", "새 비밀번호 확인")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "재설정 성공 여부"),
                                field("message", "string", false, "json", "응답 메시지")
                        ),
                        Arrays.asList(
                                mask("password", "drop", "비밀번호 저장 금지"),
                                mask("passwordConfirm", "drop", "비밀번호 확인값 저장 금지")
                        )
                );
                break;
            case "member-edit":
                enrichEvent(events, "member-edit-page-load",
                        Arrays.asList(
                                field("memberId", "string", true, "query", "조회 대상 회원 ID")
                        ),
                        Arrays.asList(
                                field("member", "object", true, "state", "회원 기본 정보"),
                                field("permissionFeatureSections", "array", true, "state", "권한 메뉴/기능 섹션"),
                                field("memberEvidenceFiles", "array", false, "state", "회원 증빙 파일 목록")
                        ),
                        Arrays.asList("memberId 공백 금지"),
                        Arrays.asList("회원 수정 화면 초기 상태 구성")
                );
                enrichEvent(events, "member-edit-feature-toggle",
                        Arrays.asList(
                                field("featureCode", "string", true, "checkbox", "토글 대상 기능 코드")
                        ),
                        Arrays.asList(
                                field("featureCodes", "string[]", true, "state", "현재 선택된 기능 코드 목록")
                        ),
                        Collections.emptyList(),
                        Arrays.asList("회원 개별 권한 선택 상태 갱신")
                );
                enrichEvent(events, "member-edit-save",
                        Arrays.asList(
                                field("memberId", "string", true, "state", "수정 대상 회원 ID"),
                                field("applcntNm", "string", true, "form", "회원명"),
                                field("applcntEmailAdres", "string", true, "form", "이메일"),
                                field("phoneNumber", "string", true, "form", "연락처"),
                                field("entrprsSeCode", "string", true, "form", "회원 유형"),
                                field("entrprsMberSttus", "string", true, "form", "회원 상태"),
                                field("authorCode", "string", false, "form", "기준 권한 롤"),
                                field("featureCodes", "string[]", false, "state", "회원 개별 권한"),
                                field("zip", "string", false, "form", "우편번호"),
                                field("adres", "string", false, "form", "기본주소"),
                                field("detailAdres", "string", false, "form", "상세주소"),
                                field("marketingYn", "string", false, "form", "마케팅 동의"),
                                field("deptNm", "string", false, "form", "부서명")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("memberId", "string", true, "json", "저장 완료 회원 ID")
                        ),
                        Arrays.asList("memberId 필수", "이름 필수", "이메일 필수"),
                        Arrays.asList("회원 기본정보 저장", "회원 권한 override 저장", "성공 메시지 갱신")
                );
                enrichApi(apis, "admin.member.edit.page",
                        Arrays.asList(
                                field("memberId", "string", true, "query", "조회 대상 회원 ID"),
                                field("updated", "string", false, "query", "저장 완료 플래그")
                        ),
                        Arrays.asList(
                                field("member", "object", true, "json", "회원 기본 정보"),
                                field("memberTypeOptions", "array", true, "json", "회원 유형 드롭다운"),
                                field("memberStatusOptions", "array", true, "json", "회원 상태 드롭다운"),
                                field("permissionAuthorGroups", "array", true, "json", "권한 롤 목록"),
                                field("permissionFeatureSections", "array", true, "json", "기능 섹션"),
                                field("memberEvidenceFiles", "array", false, "json", "회원 증빙 파일 목록"),
                                field("canViewMemberEdit", "boolean", true, "json", "조회 권한"),
                                field("canUseMemberSave", "boolean", true, "json", "저장 권한")
                        ),
                        Arrays.asList(
                                mask("applcntEmailAdres", "partial-mask", "관리 화면에는 전체 표시 가능하지만 trace에는 요약 저장"),
                                mask("phoneNumber", "partial-mask", "연락처 원문 저장 최소화")
                        )
                );
                enrichApi(apis, "admin.member.edit.save",
                        Arrays.asList(
                                field("memberId", "string", true, "body", "수정 대상 회원 ID"),
                                field("applcntNm", "string", true, "body", "회원명"),
                                field("applcntEmailAdres", "string", true, "body", "이메일"),
                                field("phoneNumber", "string", true, "body", "연락처"),
                                field("entrprsSeCode", "string", true, "body", "회원 유형"),
                                field("entrprsMberSttus", "string", true, "body", "회원 상태"),
                                field("authorCode", "string", false, "body", "기준 권한 롤"),
                                field("featureCodes", "string[]", false, "body", "개별 기능 권한"),
                                field("zip", "string", false, "body", "우편번호"),
                                field("adres", "string", false, "body", "기본주소"),
                                field("detailAdres", "string", false, "body", "상세주소"),
                                field("marketingYn", "string", false, "body", "마케팅 동의"),
                                field("deptNm", "string", false, "body", "부서명")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("memberId", "string", true, "json", "저장 완료 회원 ID"),
                                field("message", "string", false, "json", "실패 또는 성공 메시지")
                        ),
                        Arrays.asList(
                                mask("applcntEmailAdres", "partial-mask", "이메일 원문 trace 최소화"),
                                mask("phoneNumber", "partial-mask", "전화번호 원문 trace 최소화"),
                                mask("adres", "metadata-only", "상세 주소 전체 원문 저장 금지"),
                                mask("detailAdres", "metadata-only", "상세 주소 전체 원문 저장 금지")
                        )
                );
                break;
            case "company-account":
                enrichEvent(events, "company-account-load",
                        Arrays.asList(
                                field("insttId", "string", false, "form", "조회 대상 기관 ID")
                        ),
                        Arrays.asList(
                                field("companyAccountForm", "object", true, "state", "회원사 수정 기본정보"),
                                field("companyAccountFiles", "array", false, "state", "첨부 파일 목록")
                        ),
                        Collections.emptyList(),
                        Arrays.asList("회원사 수정 payload 재조회")
                );
                enrichEvent(events, "company-account-file-select",
                        Arrays.asList(
                                field("fileUploads", "file[]", false, "file-input", "선택한 신규 첨부 파일")
                        ),
                        Arrays.asList(
                                field("files", "file[]", true, "state", "업로드 예정 파일 목록")
                        ),
                        Arrays.asList("파일당 10MB 이하", "pdf/jpg/jpeg/png만 허용"),
                        Arrays.asList("업로드 예정 파일 목록 갱신")
                );
                enrichEvent(events, "company-account-save",
                        Arrays.asList(
                                field("insttId", "string", false, "state", "수정 대상 기관 ID"),
                                field("membershipType", "string", true, "form", "회원사 유형"),
                                field("agencyName", "string", true, "form", "기관/기업명"),
                                field("representativeName", "string", true, "form", "대표자명"),
                                field("bizRegistrationNumber", "string", true, "form", "사업자등록번호"),
                                field("zipCode", "string", true, "form", "우편번호"),
                                field("companyAddress", "string", true, "form", "기본주소"),
                                field("companyAddressDetail", "string", false, "form", "상세주소"),
                                field("chargerName", "string", true, "form", "담당자명"),
                                field("chargerEmail", "string", true, "form", "담당자 이메일"),
                                field("chargerTel", "string", true, "form", "담당자 연락처"),
                                field("fileUploads", "file[]", false, "state", "신규 첨부 파일")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("insttId", "string", true, "json", "저장 완료 기관 ID")
                        ),
                        Arrays.asList("membershipType 필수", "agencyName 필수", "bizRegistrationNumber 필수"),
                        Arrays.asList("회원사 기본정보 저장", "첨부 파일 저장", "조회 키 갱신")
                );
                enrichApi(apis, "admin.member.company-account.page",
                        Arrays.asList(
                                field("insttId", "string", false, "query", "조회 대상 기관 ID"),
                                field("saved", "string", false, "query", "저장 완료 플래그")
                        ),
                        Arrays.asList(
                                field("companyAccountForm", "object", true, "json", "회원사 수정 기본정보"),
                                field("companyAccountFiles", "array", false, "json", "저장 첨부 목록"),
                                field("canViewCompanyAccount", "boolean", true, "json", "조회 권한"),
                                field("canUseCompanyAccountSave", "boolean", true, "json", "저장 권한"),
                                field("isEditMode", "boolean", true, "json", "수정 모드 여부")
                        ),
                        Arrays.asList(
                                mask("bizrno", "partial-mask", "사업자번호 전체 원문 trace 금지"),
                                mask("chargerEmail", "partial-mask", "담당자 이메일 trace 최소화"),
                                mask("chargerTel", "partial-mask", "담당자 연락처 trace 최소화")
                        )
                );
                enrichApi(apis, "admin.member.company-account.save",
                        Arrays.asList(
                                field("insttId", "string", false, "multipart", "수정 대상 기관 ID"),
                                field("membershipType", "string", true, "multipart", "회원사 유형"),
                                field("agencyName", "string", true, "multipart", "기관/기업명"),
                                field("representativeName", "string", true, "multipart", "대표자명"),
                                field("bizRegistrationNumber", "string", true, "multipart", "사업자등록번호"),
                                field("zipCode", "string", true, "multipart", "우편번호"),
                                field("companyAddress", "string", true, "multipart", "기본주소"),
                                field("companyAddressDetail", "string", false, "multipart", "상세주소"),
                                field("chargerName", "string", true, "multipart", "담당자명"),
                                field("chargerEmail", "string", true, "multipart", "담당자 이메일"),
                                field("chargerTel", "string", true, "multipart", "담당자 연락처"),
                                field("fileUploads", "file[]", false, "multipart", "신규 첨부 파일")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("insttId", "string", true, "json", "저장 완료 기관 ID"),
                                field("message", "string", false, "json", "실패 또는 성공 메시지")
                        ),
                        Arrays.asList(
                                mask("bizRegistrationNumber", "partial-mask", "사업자번호 원문 저장 최소화"),
                                mask("chargerEmail", "partial-mask", "담당자 이메일 trace 최소화"),
                                mask("chargerTel", "partial-mask", "담당자 연락처 trace 최소화"),
                                mask("fileUploads", "metadata-only", "파일 바이트 저장 금지")
                        )
                );
                break;
            case "join-terms":
                enrichEvent(events, "join-terms-submit",
                        Arrays.asList(
                                field("agreeTerms", "boolean", true, "state", "필수 약관 동의"),
                                field("agreePrivacy", "boolean", true, "state", "개인정보 동의"),
                                field("marketingYn", "string", false, "state", "마케팅 동의")
                        ),
                        Arrays.asList(
                                field("step", "string", true, "session", "다음 가입 단계")
                        ),
                        Arrays.asList("필수 약관 2종 동의 필요"),
                        Arrays.asList("가입 step2 세션 저장", "step3 이동")
                );
                enrichApi(apis, "join.step2.save",
                        Arrays.asList(
                                field("marketing_yn", "string", true, "form", "Y/N 마케팅 동의")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("step", "string", false, "json", "현재 단계")
                        ),
                        Collections.emptyList()
                );
                break;
            case "join-auth":
                enrichEvent(events, "join-auth-select-method",
                        Arrays.asList(
                                field("authMethod", "string", true, "click", "선택한 본인확인 수단")
                        ),
                        Arrays.asList(
                                field("step", "string", true, "session", "다음 가입 단계")
                        ),
                        Arrays.asList("동시에 하나의 인증 수단만 처리"),
                        Arrays.asList("가입 step3 세션 저장", "step4 이동")
                );
                enrichApi(apis, "join.step3.save",
                        Arrays.asList(
                                field("auth_method", "string", true, "form", "선택한 인증 수단")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("authMethod", "string", false, "json", "세션 반영 인증 수단")
                        ),
                        Collections.emptyList()
                );
                break;
            case "join-info":
                enrichEvent(events, "join-info-submit",
                        Arrays.asList(
                                field("mberId", "string", true, "form", "가입 아이디"),
                                field("password", "password", true, "form", "가입 비밀번호"),
                                field("mberNm", "string", true, "form", "사용자 이름"),
                                field("insttId", "string", true, "form", "소속 기관 ID"),
                                field("applcntEmailAdres", "string", true, "form", "이메일"),
                                field("fileUploads", "file[]", true, "form", "증빙 파일")
                        ),
                        Arrays.asList(
                                field("mberId", "string", true, "sessionStorage", "완료 화면 표시용 아이디"),
                                field("nextRoute", "string", true, "route", "가입 완료 경로")
                        ),
                        Arrays.asList("아이디 중복 확인 완료", "이메일 중복 확인 완료", "증빙 파일 1건 이상"),
                        Arrays.asList("가입 정보 저장", "첨부 업로드", "step5 이동")
                );
                enrichApi(apis, "join.step4.submit",
                        Arrays.asList(
                                field("mberId", "string", true, "multipart", "가입 아이디"),
                                field("password", "password", true, "multipart", "가입 비밀번호"),
                                field("mberNm", "string", true, "multipart", "신청자명"),
                                field("insttId", "string", true, "multipart", "기관 ID"),
                                field("bizrno", "string", true, "multipart", "사업자등록번호"),
                                field("applcntEmailAdres", "string", true, "multipart", "이메일"),
                                field("fileUploads", "file[]", true, "multipart", "첨부 파일 배열")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "제출 성공 여부"),
                                field("mberId", "string", true, "json", "저장된 사용자 아이디"),
                                field("mberNm", "string", true, "json", "저장된 사용자 이름"),
                                field("insttNm", "string", true, "json", "저장된 기관명")
                        ),
                        Arrays.asList(
                                mask("password", "drop", "비밀번호 저장 금지"),
                                mask("applcntEmailAdres", "partial-mask", "응답/로그 노출 최소화")
                        )
                );
                break;
            case "join-company-register":
                enrichApi(apis, "join.company-register.submit",
                        Arrays.asList(
                                field("membershipType", "string", true, "multipart", "회원사 유형"),
                                field("agencyName", "string", true, "multipart", "기관/기업명"),
                                field("representativeName", "string", true, "multipart", "대표자명"),
                                field("bizRegistrationNumber", "string", true, "multipart", "사업자등록번호"),
                                field("chargerEmail", "string", true, "multipart", "담당자 이메일"),
                                field("fileUploads", "file[]", true, "multipart", "증빙 첨부")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "등록 성공 여부"),
                                field("insttNm", "string", true, "json", "등록 기관명"),
                                field("bizrno", "string", true, "json", "사업자번호"),
                                field("regDate", "string", true, "json", "접수 일시")
                        ),
                        Arrays.asList(
                                mask("chargerEmail", "partial-mask", "운영 조회 외 최소 노출"),
                                mask("fileUploads", "metadata-only", "첨부 원문은 파일 저장소에서만 관리")
                        )
                );
                break;
            case "join-company-status-detail":
                enrichEvent(events, "join-company-status-detail-load",
                        Arrays.asList(
                                field("bizNo", "string", false, "query", "사업자등록번호"),
                                field("appNo", "string", false, "query", "신청번호"),
                                field("repName", "string", true, "query", "대표자명")
                        ),
                        Arrays.asList(
                                field("result", "object", true, "state", "가입 상태 상세"),
                                field("insttFiles", "array", true, "state", "첨부 목록")
                        ),
                        Arrays.asList("bizNo 또는 appNo 중 하나 필요", "repName 필수"),
                        Arrays.asList("상태 타임라인 렌더링", "첨부 다운로드/재신청 액션 노출")
                );
                enrichApi(apis, "join.company-status.detail",
                        Arrays.asList(
                                field("bizNo", "string", false, "query", "사업자등록번호"),
                                field("appNo", "string", false, "query", "신청번호"),
                                field("repName", "string", true, "query", "대표자명")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "조회 성공 여부"),
                                field("result.insttSttus", "string", true, "json", "가입 상태"),
                                field("result.rjctRsn", "string", false, "json", "반려 사유"),
                                field("insttFiles", "array", true, "json", "첨부 목록")
                        ),
                        Arrays.asList(
                                mask("repName", "partial-mask", "검색 입력값 최소 보존"),
                                mask("result.rjctRsn", "allow", "운영 판단 사유로 관리자/본인 조회 허용")
                        )
                );
                break;
            case "join-company-reapply":
                enrichApi(apis, "join.company-reapply.submit",
                        Arrays.asList(
                                field("insttId", "string", true, "multipart", "기관 ID"),
                                field("agencyName", "string", true, "multipart", "기관명"),
                                field("representativeName", "string", true, "multipart", "대표자명"),
                                field("chargerEmail", "string", true, "multipart", "담당자 이메일"),
                                field("fileUploads", "file[]", true, "multipart", "보완 첨부")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "재신청 성공 여부"),
                                field("insttNm", "string", true, "json", "재신청 기관명")
                        ),
                        Arrays.asList(
                                mask("chargerEmail", "partial-mask", "개인정보 최소 노출"),
                                mask("fileUploads", "metadata-only", "첨부는 메타데이터만 추적")
                        )
                );
                break;
            case "mypage":
                enrichEvent(events, "mypage-save",
                        Arrays.asList(
                                field("fullName", "string", true, "form", "사용자 이름"),
                                field("email", "string", true, "form", "이메일"),
                                field("phone", "string", true, "form", "연락처"),
                                field("jobTitle", "string", false, "form", "직책")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "state", "저장 성공 여부"),
                                field("message", "string", false, "state", "저장 결과 메시지")
                        ),
                        Arrays.asList("인증된 사용자만 가능"),
                        Arrays.asList("프로필 정보 갱신", "감사 로그 기록")
                );
                enrichApi(apis, "mypage.save",
                        Arrays.asList(
                                field("fullName", "string", true, "body", "사용자 이름"),
                                field("email", "string", true, "body", "이메일"),
                                field("areaNo", "string", true, "body", "전화 지역번호"),
                                field("middleTelno", "string", true, "body", "전화 중간번호"),
                                field("endTelno", "string", true, "body", "전화 끝번호"),
                                field("jobTitle", "string", false, "body", "직책")
                        ),
                        Arrays.asList(
                                field("success", "boolean", true, "json", "저장 성공 여부"),
                                field("page", "object", false, "json", "갱신된 페이지 데이터")
                        ),
                        Arrays.asList(
                                mask("email", "partial-mask", "개인정보 최소 노출"),
                                mask("middleTelno", "partial-mask", "연락처 일부 마스킹")
                        )
                );
                break;
            default:
                break;
        }
    }

    private void enrichEvent(List<Map<String, Object>> events, String eventId, List<Map<String, Object>> functionInputs,
                             List<Map<String, Object>> functionOutputs, List<String> guardConditions, List<String> sideEffects) {
        for (Map<String, Object> event : events) {
            if (eventId.equals(stringValue(event.get("eventId")))) {
                event.put("functionInputs", functionInputs);
                event.put("functionOutputs", functionOutputs);
                event.put("guardConditions", guardConditions);
                event.put("sideEffects", sideEffects);
                return;
            }
        }
    }

    private void enrichApi(List<Map<String, Object>> apis, String apiId, List<Map<String, Object>> requestFields,
                           List<Map<String, Object>> responseFields, List<Map<String, Object>> maskingRules) {
        for (Map<String, Object> api : apis) {
            if (apiId.equals(stringValue(api.get("apiId")))) {
                api.put("requestFields", requestFields);
                api.put("responseFields", responseFields);
                api.put("maskingRules", maskingRules);
                return;
            }
        }
    }

    private Map<String, Object> field(String fieldId, String type, boolean required, String source, String notes) {
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("fieldId", fieldId);
        field.put("type", type);
        field.put("required", required);
        field.put("source", source);
        field.put("notes", notes);
        return field;
    }

    private Map<String, Object> mask(String fieldId, String strategy, String notes) {
        Map<String, Object> mask = new LinkedHashMap<>();
        mask.put("fieldId", fieldId);
        mask.put("strategy", strategy);
        mask.put("notes", notes);
        return mask;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> safeMapList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<?> source = (List<?>) value;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : source) {
            if (item instanceof Map) {
                result.add((Map<String, Object>) item);
            }
        }
        return result;
    }

    private String resolveMenuLookupUrl(String pageId, String routePath) {
        if (routePath.startsWith("/admin/")) {
            return routePath;
        }
        if (routePath.startsWith("/en/admin/")) {
            return routePath;
        }
        return routePath;
    }

    private List<FeatureCatalogItemVO> safeFeatureCatalog() throws Exception {
        List<FeatureCatalogItemVO> items = authGroupManageService.selectFeatureCatalog();
        return items == null ? Collections.emptyList() : items;
    }

    private List<String> safeList(List<String> values) {
        return values == null ? Collections.emptyList() : values;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        return value instanceof Map ? (Map<String, Object>) value : Collections.emptyMap();
    }

    private int listSize(Object value) {
        return value instanceof List ? ((List<?>) value).size() : 0;
    }

    private int intValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String normalized = stringValue(value);
        if (normalized.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(normalized);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String safeSelectMenuCode(String menuUrl) throws Exception {
        if (normalize(menuUrl).isEmpty()) {
            return "";
        }
        try {
            return stringValue(authGroupManageService.selectMenuCodeByMenuUrl(menuUrl));
        } catch (Exception ignored) {
            return "";
        }
    }

    private String safeSelectRequiredViewFeatureCode(String menuUrl) throws Exception {
        if (normalize(menuUrl).isEmpty()) {
            return "";
        }
        try {
            return stringValue(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(menuUrl));
        } catch (Exception ignored) {
            return "";
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

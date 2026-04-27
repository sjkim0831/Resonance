package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminScreenManagementMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00601";
    private static final String GROUP_NAME = "환경";
    private static final String GROUP_NAME_EN = "Environment";
    private static final String SCREEN_FLOW_MENU_CODE = "A0060120";
    private static final String SCREEN_FLOW_MENU_NAME_KO = "화면 흐름 관리";
    private static final String SCREEN_FLOW_MENU_NAME_EN = "Screen Flow Management";
    private static final String SCREEN_FLOW_MENU_URL = "/admin/system/screen-flow-management";
    private static final String SCREEN_FLOW_MENU_ICON = "account_tree";
    private static final String SCREEN_MENU_ASSIGNMENT_MENU_CODE = "A0060121";
    private static final String SCREEN_MENU_ASSIGNMENT_MENU_NAME_KO = "화면-메뉴 귀속 관리";
    private static final String SCREEN_MENU_ASSIGNMENT_MENU_NAME_EN = "Screen-Menu Assignment Management";
    private static final String SCREEN_MENU_ASSIGNMENT_MENU_URL = "/admin/system/screen-menu-assignment-management";
    private static final String SCREEN_MENU_ASSIGNMENT_MENU_ICON = "device_hub";
    private static final String LEGACY_SCREEN_FLOW_MENU_CODE = "A0060501";
    private static final String LEGACY_SCREEN_MENU_ASSIGNMENT_MENU_CODE = "A0060502";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;
    private final AuthGroupManageService authGroupManageService;
    private final MenuFeatureManageService menuFeatureManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureScreenManagementMenus() {
        cleanupLegacyMenus();
        provisionScreenMenu(
                "BOOTSTRAP-SCREEN-FLOW-MANAGEMENT",
                SCREEN_FLOW_MENU_CODE,
                SCREEN_FLOW_MENU_NAME_KO,
                SCREEN_FLOW_MENU_NAME_EN,
                SCREEN_FLOW_MENU_URL,
                SCREEN_FLOW_MENU_ICON
        );
        provisionScreenMenu(
                "BOOTSTRAP-SCREEN-MENU-ASSIGNMENT-MANAGEMENT",
                SCREEN_MENU_ASSIGNMENT_MENU_CODE,
                SCREEN_MENU_ASSIGNMENT_MENU_NAME_KO,
                SCREEN_MENU_ASSIGNMENT_MENU_NAME_EN,
                SCREEN_MENU_ASSIGNMENT_MENU_URL,
                SCREEN_MENU_ASSIGNMENT_MENU_ICON
        );
    }

    private void cleanupLegacyMenus() {
        cleanupLegacyMenu(LEGACY_SCREEN_FLOW_MENU_CODE);
        cleanupLegacyMenu(LEGACY_SCREEN_MENU_ASSIGNMENT_MENU_CODE);
    }

    private void cleanupLegacyMenu(String menuCode) {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return;
        }
        String featureCode = normalizedMenuCode + "_VIEW";
        try {
            authGroupManageService.deleteAuthorFeatureRelationsByFeatureCode(featureCode);
            menuFeatureManageService.deleteMenuFeature(featureCode);
            adminCodeManageService.deletePageManagement(DOMAIN_CODE, normalizedMenuCode);
            log.info("Legacy screen management menu cleaned up. menuCode={}", normalizedMenuCode);
        } catch (Exception e) {
            log.warn("Failed to clean up legacy screen management menu. menuCode={}", normalizedMenuCode, e);
        }
    }

    private void provisionScreenMenu(String requestId,
                                     String menuCode,
                                     String menuNameKo,
                                     String menuNameEn,
                                     String menuUrl,
                                     String menuIcon) {
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(buildRequest(
                    requestId,
                    menuCode,
                    menuNameKo,
                    menuNameEn,
                    menuUrl,
                    menuIcon
            ));
            adminCodeManageService.updatePageManagement(
                    menuCode,
                    menuNameKo,
                    menuNameEn,
                    menuUrl,
                    menuIcon,
                    "Y",
                    ACTOR_ID
            );
            log.info("Screen management menu provisioned. menuCode={}, created={}, existing={}, skipped={}",
                    menuCode, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision screen management menu. menuCode={}", menuCode, e);
        }
    }

    private CodexProvisionRequest buildRequest(String requestId,
                                               String menuCode,
                                               String menuNameKo,
                                               String menuNameEn,
                                               String menuUrl,
                                               String menuIcon) {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId(requestId);
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(menuUrl);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest(menuCode, menuNameKo, menuNameEn, menuUrl, menuIcon));
        request.setFeatures(Arrays.asList(
                featureRequest(menuCode, menuCode + "_VIEW", menuNameKo + " 조회", "View " + menuNameEn, menuNameEn + " page access")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", menuCode + "_VIEW"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", menuCode + "_VIEW"),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", menuCode + "_VIEW")
        ));
        return request;
    }

    private CodexProvisionRequest.PageRequest pageRequest(String menuCode,
                                                          String menuNameKo,
                                                          String menuNameEn,
                                                          String menuUrl,
                                                          String menuIcon) {
        CodexProvisionRequest.PageRequest page = new CodexProvisionRequest.PageRequest();
        page.setDomainCode(DOMAIN_CODE);
        page.setDomainName(DOMAIN_NAME);
        page.setDomainNameEn(DOMAIN_NAME_EN);
        page.setGroupCode(GROUP_CODE);
        page.setGroupName(GROUP_NAME);
        page.setGroupNameEn(GROUP_NAME_EN);
        page.setCode(menuCode);
        page.setCodeNm(menuNameKo);
        page.setCodeDc(menuNameEn);
        page.setMenuUrl(menuUrl);
        page.setMenuIcon(menuIcon);
        page.setUseAt("Y");
        return page;
    }

    private CodexProvisionRequest.FeatureRequest featureRequest(String menuCode,
                                                                String featureCode,
                                                                String nameKo,
                                                                String nameEn,
                                                                String description) {
        CodexProvisionRequest.FeatureRequest feature = new CodexProvisionRequest.FeatureRequest();
        feature.setMenuCode(menuCode);
        feature.setFeatureCode(featureCode);
        feature.setFeatureNm(nameKo);
        feature.setFeatureNmEn(nameEn);
        feature.setFeatureDc(description);
        feature.setUseAt("Y");
        return feature;
    }

    private CodexProvisionRequest.AuthorRequest authorRequest(String authorCode,
                                                              String authorNm,
                                                              String authorDc,
                                                              String... featureCodes) {
        CodexProvisionRequest.AuthorRequest author = new CodexProvisionRequest.AuthorRequest();
        author.setAuthorCode(authorCode);
        author.setAuthorNm(authorNm);
        author.setAuthorDc(authorDc);
        author.setFeatureCodes(Arrays.asList(featureCodes));
        return author;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }
}

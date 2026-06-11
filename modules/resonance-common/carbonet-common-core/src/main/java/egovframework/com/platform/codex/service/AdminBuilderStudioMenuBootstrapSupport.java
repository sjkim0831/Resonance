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
public class AdminBuilderStudioMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00601";
    private static final String GROUP_NAME = "환경";
    private static final String GROUP_NAME_EN = "Environment";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;
    private final AuthGroupManageService authGroupManageService;
    private final MenuFeatureManageService menuFeatureManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureBuilderStudioMenus() {
        log.info("Provisioning builder studio menus...");

        provisionMenu(
                "BOOTSTRAP-BUILDER-STUDIO",
                "A0060119",
                "빌더 스튜디오",
                "Builder Studio",
                "/admin/system/builder-studio",
                "construction"
        );

        provisionMenu(
                "BOOTSTRAP-COMPONENT-MANAGEMENT",
                "A0060128",
                "컴포넌트 관리",
                "Component Management",
                "/admin/system/component-management",
                "widgets"
        );

        provisionMenu(
                "BOOTSTRAP-THEME-MANAGEMENT-NEW",
                "A0060132",
                "테마 관리(new)",
                "Theme Management",
                "/admin/system/theme-management",
                "palette"
        );

        provisionMenu(
                "BOOTSTRAP-BUILDER-DASHBOARD",
                "A0060133",
                "빌더 대시보드",
                "Builder Dashboard",
                "/admin/system/screen-builder-dashboard",
                "dashboard"
        );

        provisionMenu(
                "BOOTSTRAP-SCREEN-MANAGEMENT",
                "A0060134",
                "화면 관리",
                "Screen Management",
                "/admin/system/screen-management",
                "screen"
        );

        provisionMenu(
                "BOOTSTRAP-PACKAGE-GOVERNANCE",
                "A0060135",
                "패키지 거버넌스",
                "Package Governance",
                "/admin/system/package-governance",
                "inventory"
        );

        log.info("Builder studio menus provisioning completed.");
    }

    private void provisionMenu(String requestId,
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
            log.info("Builder studio menu provisioned. menuCode={}, created={}, existing={}, skipped={}",
                    menuCode, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision builder studio menu. menuCode={}", menuCode, e);
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
}
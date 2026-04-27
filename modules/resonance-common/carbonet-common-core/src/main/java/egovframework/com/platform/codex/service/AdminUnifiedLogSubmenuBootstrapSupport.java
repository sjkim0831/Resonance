package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminUnifiedLogSubmenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00603";
    private static final String GROUP_NAME = "로그";
    private static final String GROUP_NAME_EN = "Logs";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureUnifiedLogSubmenus() {
        for (SubmenuDefinition submenu : submenuDefinitions()) {
            try {
                CodexProvisionResponse response = codexProvisioningService.provision(buildRequest(submenu));
                adminCodeManageService.updatePageManagement(
                        submenu.menuCode,
                        submenu.menuNameKo,
                        submenu.menuNameEn,
                        submenu.menuUrl,
                        submenu.menuIcon,
                        "Y",
                        ACTOR_ID
                );
                log.info("Unified log submenu provisioned. menuCode={}, created={}, existing={}, skipped={}",
                        submenu.menuCode, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
            } catch (Exception e) {
                log.error("Failed to provision unified log submenu. menuCode={}", submenu.menuCode, e);
            }
        }
    }

    private List<SubmenuDefinition> submenuDefinitions() {
        return Arrays.asList(
                new SubmenuDefinition("A0060305", "추적 로그", "Trace Logs", "/admin/system/unified_log/trace", "timeline"),
                new SubmenuDefinition("A0060306", "페이지 이벤트 로그", "Page Event Logs", "/admin/system/unified_log/page-events", "pageview"),
                new SubmenuDefinition("A0060307", "UI 액션 로그", "UI Action Logs", "/admin/system/unified_log/ui-actions", "touch_app"),
                new SubmenuDefinition("A0060308", "API 추적 로그", "API Trace Logs", "/admin/system/unified_log/api-trace", "api"),
                new SubmenuDefinition("A0060309", "UI 오류 로그", "UI Error Logs", "/admin/system/unified_log/ui-errors", "bug_report"),
                new SubmenuDefinition("A0060310", "레이아웃 렌더 로그", "Layout Render Logs", "/admin/system/unified_log/layout-render", "dashboard_customize")
        );
    }

    private CodexProvisionRequest buildRequest(SubmenuDefinition submenu) {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-" + submenu.menuCode);
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(submenu.menuUrl);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest(submenu));
        request.setFeatures(Arrays.asList(
                featureRequest(submenu.menuCode + "_VIEW", submenu.menuNameKo + " 조회", "View " + submenu.menuNameEn, submenu.menuNameEn + " page access")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", submenu.menuCode + "_VIEW"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", submenu.menuCode + "_VIEW")
        ));
        return request;
    }

    private CodexProvisionRequest.PageRequest pageRequest(SubmenuDefinition submenu) {
        CodexProvisionRequest.PageRequest page = new CodexProvisionRequest.PageRequest();
        page.setDomainCode(DOMAIN_CODE);
        page.setDomainName(DOMAIN_NAME);
        page.setDomainNameEn(DOMAIN_NAME_EN);
        page.setGroupCode(GROUP_CODE);
        page.setGroupName(GROUP_NAME);
        page.setGroupNameEn(GROUP_NAME_EN);
        page.setCode(submenu.menuCode);
        page.setCodeNm(submenu.menuNameKo);
        page.setCodeDc(submenu.menuNameEn);
        page.setMenuUrl(submenu.menuUrl);
        page.setMenuIcon(submenu.menuIcon);
        page.setUseAt("Y");
        return page;
    }

    private CodexProvisionRequest.FeatureRequest featureRequest(String featureCode, String nameKo, String nameEn, String description) {
        CodexProvisionRequest.FeatureRequest feature = new CodexProvisionRequest.FeatureRequest();
        feature.setMenuCode(featureCode.substring(0, 8));
        feature.setFeatureCode(featureCode);
        feature.setFeatureNm(nameKo);
        feature.setFeatureNmEn(nameEn);
        feature.setFeatureDc(description);
        feature.setUseAt("Y");
        return feature;
    }

    private CodexProvisionRequest.AuthorRequest authorRequest(String authorCode, String authorNm, String authorDc, String... featureCodes) {
        CodexProvisionRequest.AuthorRequest author = new CodexProvisionRequest.AuthorRequest();
        author.setAuthorCode(authorCode);
        author.setAuthorNm(authorNm);
        author.setAuthorDc(authorDc);
        author.setFeatureCodes(Arrays.asList(featureCodes));
        return author;
    }

    private static final class SubmenuDefinition {
        private final String menuCode;
        private final String menuNameKo;
        private final String menuNameEn;
        private final String menuUrl;
        private final String menuIcon;

        private SubmenuDefinition(String menuCode,
                                  String menuNameKo,
                                  String menuNameEn,
                                  String menuUrl,
                                  String menuIcon) {
            this.menuCode = menuCode;
            this.menuNameKo = menuNameKo;
            this.menuNameEn = menuNameEn;
            this.menuUrl = menuUrl;
            this.menuIcon = menuIcon;
        }
    }
}

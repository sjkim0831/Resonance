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
public class AdminHomeMonitoringMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "H005";
    private static final String DOMAIN_NAME = "모니터링";
    private static final String DOMAIN_NAME_EN = "Monitoring";
    private static final String GROUP_CODE = "H00501";
    private static final String GROUP_NAME = "홈 모니터링";
    private static final String GROUP_NAME_EN = "Home Monitoring";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureHomeMonitoringMenus() {
        for (MenuDefinition menu : menuDefinitions()) {
            try {
                CodexProvisionResponse response = codexProvisioningService.provision(buildRequest(menu));
                adminCodeManageService.updatePageManagement(
                        menu.menuCode,
                        menu.menuNameKo,
                        menu.menuNameEn,
                        menu.menuUrl,
                        menu.menuIcon,
                        "Y",
                        ACTOR_ID
                );
                log.info("Home monitoring menu provisioned. menuCode={}, created={}, existing={}, skipped={}",
                        menu.menuCode, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
            } catch (Exception e) {
                log.error("Failed to provision home monitoring menu. menuCode={}", menu.menuCode, e);
            }
        }
    }

    private List<MenuDefinition> menuDefinitions() {
        return Arrays.asList(
                new MenuDefinition("H0050101", "통합 대시보드", "Unified Dashboard", "/monitoring/dashboard", "dashboard"),
                new MenuDefinition("H0050102", "실시간 모니터링", "Real-time Monitoring", "/monitoring/realtime", "monitoring")
        );
    }

    private CodexProvisionRequest buildRequest(MenuDefinition menu) {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-" + menu.menuCode);
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(menu.menuUrl);
        request.setMenuType("PUBLIC"); // Monitoring pages seem to be public or at least non-admin prefix
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest(menu));
        request.setFeatures(Arrays.asList(
                featureRequest(menu.menuCode + "_VIEW", menu.menuNameKo + " 조회", "View " + menu.menuNameEn, menu.menuNameEn + " page access")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", menu.menuCode + "_VIEW"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", menu.menuCode + "_VIEW"),
                authorRequest("ROLE_USER", "일반 사용자", "General User", menu.menuCode + "_VIEW")
        ));
        return request;
    }

    private CodexProvisionRequest.PageRequest pageRequest(MenuDefinition menu) {
        CodexProvisionRequest.PageRequest page = new CodexProvisionRequest.PageRequest();
        page.setDomainCode(DOMAIN_CODE);
        page.setDomainName(DOMAIN_NAME);
        page.setDomainNameEn(DOMAIN_NAME_EN);
        page.setGroupCode(GROUP_CODE);
        page.setGroupName(GROUP_NAME);
        page.setGroupNameEn(GROUP_NAME_EN);
        page.setCode(menu.menuCode);
        page.setCodeNm(menu.menuNameKo);
        page.setCodeDc(menu.menuNameEn);
        page.setMenuUrl(menu.menuUrl);
        page.setMenuIcon(menu.menuIcon);
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

    private static final class MenuDefinition {
        private final String menuCode;
        private final String menuNameKo;
        private final String menuNameEn;
        private final String menuUrl;
        private final String menuIcon;

        private MenuDefinition(String menuCode,
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

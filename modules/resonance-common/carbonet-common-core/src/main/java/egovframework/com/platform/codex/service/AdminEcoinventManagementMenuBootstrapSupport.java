package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminEcoinventManagementMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A002"; // 배출/인증
    private static final String DOMAIN_NAME = "배출/인증";
    private static final String DOMAIN_NAME_EN = "Emissions & Certification";
    private static final String GROUP_CODE = "A00201";
    private static final String GROUP_NAME = "배출";
    private static final String GROUP_NAME_EN = "Emissions";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @Value("${carbonet.menu.emission.ecoinvent.code:${CARBONET_MENU_EMISSION_ECOINVENT_CODE:A0020113}}")
    private String menuCode;

    @Value("${carbonet.menu.emission.ecoinvent.name-ko:${CARBONET_MENU_EMISSION_ECOINVENT_NAME_KO:ecoinvent 배출계수 관리}}")
    private String menuNameKo;

    @Value("${carbonet.menu.emission.ecoinvent.name-en:${CARBONET_MENU_EMISSION_ECOINVENT_NAME_EN:ecoinvent Emission Factors}}")
    private String menuNameEn;

    @Value("${carbonet.menu.emission.ecoinvent.url:${CARBONET_MENU_EMISSION_ECOINVENT_URL:/admin/emission/ecoinvent}}")
    private String menuUrl;

    @Value("${carbonet.menu.emission.ecoinvent.icon:${CARBONET_MENU_EMISSION_ECOINVENT_ICON:settings_input_composite}}")
    private String menuIcon;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureMenu() {
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(buildRequest());
            adminCodeManageService.updatePageManagement(
                    menuCode,
                    menuNameKo,
                    menuNameEn,
                    menuUrl,
                    menuIcon,
                    "Y",
                    ACTOR_ID
            );
            log.info("Ecoinvent management menu provisioned. created={}, existing={}, skipped={}",
                    response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision Ecoinvent management menu.", e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-ECOINVENT-MANAGEMENT");
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(menuUrl);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest());
        request.setFeatures(Arrays.asList(
                featureRequest(menuCode + "_VIEW", "데이터 조회", "View Data", "View Ecoinvent data catalog"),
                featureRequest(menuCode + "_SYNC", "데이터 동기화", "Sync Data", "Sync data from Ecoinvent API")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                        menuCode + "_VIEW", menuCode + "_SYNC"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                        menuCode + "_VIEW", menuCode + "_SYNC"),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                        menuCode + "_VIEW")
        ));
        return request;
    }

    private CodexProvisionRequest.PageRequest pageRequest() {
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

    private CodexProvisionRequest.FeatureRequest featureRequest(String featureCode, String nameKo, String nameEn, String description) {
        CodexProvisionRequest.FeatureRequest feature = new CodexProvisionRequest.FeatureRequest();
        feature.setMenuCode(menuCode);
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
}

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

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminEmissionGwpValuesMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A002";
    private static final String DOMAIN_NAME = "배출/인증";
    private static final String DOMAIN_NAME_EN = "Emissions & Certification";
    private static final String GROUP_CODE = "A00201";
    private static final String GROUP_NAME = "배출";
    private static final String GROUP_NAME_EN = "Emissions";
    private static final String MENU_CODE = "A0020109";
    private static final String MENU_NAME_KO = "GWP 값 관리";
    private static final String MENU_NAME_EN = "GWP Value Management";
    private static final String MENU_URL = "/admin/emission/gwp-values";
    private static final String MENU_ICON = "table_chart";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureMenu() {
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(buildRequest());
            adminCodeManageService.updatePageManagement(
                    MENU_CODE,
                    MENU_NAME_KO,
                    MENU_NAME_EN,
                    MENU_URL,
                    MENU_ICON,
                    "Y",
                    ACTOR_ID
            );
            log.info("Emission GWP values menu provisioned. created={}, existing={}, skipped={}",
                    response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision emission GWP values menu.", e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-EMISSION-GWP-VALUES");
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(MENU_URL);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest());
        request.setFeatures(Arrays.asList(
                featureRequest(MENU_CODE + "_VIEW", "GWP 값 조회", "View GWP values", "Open the GWP value management catalog"),
                featureRequest(MENU_CODE + "_EDIT", "GWP 값 수정", "Edit GWP values", "Update seeded GWP values and notes"),
                featureRequest(MENU_CODE + "_CREATE", "GWP 값 등록", "Create GWP values", "Add new GWP rows"),
                featureRequest(MENU_CODE + "_DELETE", "GWP 값 삭제", "Delete GWP values", "Delete GWP rows from the working catalog")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                        MENU_CODE + "_VIEW", MENU_CODE + "_EDIT", MENU_CODE + "_CREATE", MENU_CODE + "_DELETE"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_EDIT", MENU_CODE + "_CREATE", MENU_CODE + "_DELETE"),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_EDIT", MENU_CODE + "_CREATE", MENU_CODE + "_DELETE")
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
        page.setCode(MENU_CODE);
        page.setCodeNm(MENU_NAME_KO);
        page.setCodeDc(MENU_NAME_EN);
        page.setMenuUrl(MENU_URL);
        page.setMenuIcon(MENU_ICON);
        page.setUseAt("Y");
        return page;
    }

    private CodexProvisionRequest.FeatureRequest featureRequest(String featureCode, String nameKo, String nameEn, String description) {
        CodexProvisionRequest.FeatureRequest feature = new CodexProvisionRequest.FeatureRequest();
        feature.setMenuCode(MENU_CODE);
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

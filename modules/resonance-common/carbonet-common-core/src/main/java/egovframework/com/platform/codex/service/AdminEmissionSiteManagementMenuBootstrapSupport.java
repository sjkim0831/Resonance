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
public class AdminEmissionSiteManagementMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A002";
    private static final String DOMAIN_NAME = "배출/인증";
    private static final String DOMAIN_NAME_EN = "Emissions & Certification";
    private static final String GROUP_CODE = "A00201";
    private static final String GROUP_NAME = "배출";
    private static final String GROUP_NAME_EN = "Emissions";
    private static final String MENU_CODE = "A0020105";
    private static final String LEGACY_MENU_CODE = "A0080101";
    private static final String MENU_NAME_KO = "배출지 관리";
    private static final String MENU_NAME_EN = "Emission Site Management";
    private static final String MENU_URL = "/admin/emission/site-management";
    private static final String MENU_ICON = "factory";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureEmissionSiteManagementMenu() {
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(buildRequest());
            reconcileExistingMenuMetadata();
            log.info("Emission site management menu provisioned. created={}, existing={}, skipped={}",
                    response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision emission site management menu.", e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-EMISSION-SITE-MANAGEMENT");
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(MENU_URL);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest());
        request.setFeatures(Arrays.asList(
                featureRequest(MENU_CODE + "_VIEW", "배출지 관리 조회", "View Emission Site Management", "Emission site management page access"),
                featureRequest(MENU_CODE + "_REGISTER", "배출지 등록", "Register Emission Site", "Create and register emission sites"),
                featureRequest(MENU_CODE + "_DATA_INPUT", "배출 데이터 입력", "Emission Data Input", "Input emission activity data"),
                featureRequest(MENU_CODE + "_CALCULATION", "산정 로직 등록", "Calculation Logic Registration", "Manage emission calculation logic"),
                featureRequest(MENU_CODE + "_DOCUMENT", "서류 보완 관리", "Document Supplement", "Manage document supplement workflows"),
                featureRequest(MENU_CODE + "_HISTORY", "이력 확인", "History Review", "Review emission site history"),
                featureRequest(MENU_CODE + "_REPORT", "보고서 출력", "Report Export", "Generate and export emission reports"),
                featureRequest(MENU_CODE + "_MANAGE", "배출지 운영 관리", "Emission Site Administration", "Manage emission site administration"),
                featureRequest(MENU_CODE + "_MONITOR", "종합 배출 모니터링 리포트", "Integrated Emission Monitoring Report", "View integrated emission monitoring reports")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                        MENU_CODE + "_VIEW", MENU_CODE + "_REGISTER", MENU_CODE + "_DATA_INPUT",
                        MENU_CODE + "_CALCULATION", MENU_CODE + "_DOCUMENT", MENU_CODE + "_HISTORY",
                        MENU_CODE + "_REPORT", MENU_CODE + "_MANAGE", MENU_CODE + "_MONITOR"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_REGISTER", MENU_CODE + "_DATA_INPUT",
                        MENU_CODE + "_CALCULATION", MENU_CODE + "_DOCUMENT", MENU_CODE + "_HISTORY",
                        MENU_CODE + "_REPORT", MENU_CODE + "_MANAGE", MENU_CODE + "_MONITOR"),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_REGISTER", MENU_CODE + "_DATA_INPUT",
                        MENU_CODE + "_CALCULATION", MENU_CODE + "_DOCUMENT", MENU_CODE + "_HISTORY",
                        MENU_CODE + "_REPORT", MENU_CODE + "_MANAGE", MENU_CODE + "_MONITOR")
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

    private void reconcileExistingMenuMetadata() throws Exception {
        adminCodeManageService.updatePageManagement(
                MENU_CODE,
                MENU_NAME_KO,
                MENU_NAME_EN,
                MENU_URL,
                MENU_ICON,
                "Y",
                ACTOR_ID
        );
        adminCodeManageService.updatePageManagement(
                LEGACY_MENU_CODE,
                MENU_NAME_KO,
                MENU_NAME_EN,
                MENU_URL,
                MENU_ICON,
                "N",
                ACTOR_ID
        );
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

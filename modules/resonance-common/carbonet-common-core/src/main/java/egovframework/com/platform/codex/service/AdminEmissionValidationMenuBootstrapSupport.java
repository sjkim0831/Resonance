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
public class AdminEmissionValidationMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A002";
    private static final String DOMAIN_NAME = "배출/인증";
    private static final String DOMAIN_NAME_EN = "Emissions & Certification";
    private static final String GROUP_CODE = "A00201";
    private static final String GROUP_NAME = "배출";
    private static final String GROUP_NAME_EN = "Emissions";
    private static final String MENU_CODE = "A0020104";
    private static final String MENU_NAME_KO = "검증 관리";
    private static final String MENU_NAME_EN = "Verification Management";
    private static final String MENU_URL = "/admin/emission/validate";
    private static final String MENU_ICON = "verified";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureEmissionValidationMenu() {
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
            log.info("Emission validation menu provisioned. created={}, existing={}, skipped={}",
                    response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision emission validation menu.", e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-EMISSION-VALIDATION");
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(MENU_URL);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest());
        request.setFeatures(Arrays.asList(
                featureRequest(MENU_CODE + "_VIEW", "검증 관리 조회", "View Verification Management", "Open the verification management queue"),
                featureRequest(MENU_CODE + "_ASSIGN", "검증 담당자 배정", "Assign Verifier", "Assign verification owners and queue items"),
                featureRequest(MENU_CODE + "_REVIEW", "검증 검토", "Review Verification", "Review verification evidence and result deltas"),
                featureRequest(MENU_CODE + "_REJECT", "검증 반려", "Reject Verification", "Reject verification with supplement feedback"),
                featureRequest(MENU_CODE + "_APPROVE", "검증 승인", "Approve Verification", "Approve verified emission results"),
                featureRequest(MENU_CODE + "_TRACE", "검증 이력 추적", "Trace Verification History", "Trace verification actions and operator evidence")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                        MENU_CODE + "_VIEW", MENU_CODE + "_ASSIGN", MENU_CODE + "_REVIEW", MENU_CODE + "_REJECT", MENU_CODE + "_APPROVE", MENU_CODE + "_TRACE"),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_ASSIGN", MENU_CODE + "_REVIEW", MENU_CODE + "_REJECT", MENU_CODE + "_APPROVE", MENU_CODE + "_TRACE"),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                        MENU_CODE + "_VIEW", MENU_CODE + "_ASSIGN", MENU_CODE + "_REVIEW", MENU_CODE + "_REJECT", MENU_CODE + "_APPROVE", MENU_CODE + "_TRACE")
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

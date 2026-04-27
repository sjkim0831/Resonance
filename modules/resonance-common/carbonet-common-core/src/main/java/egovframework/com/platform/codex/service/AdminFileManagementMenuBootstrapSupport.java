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
public class AdminFileManagementMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A004";
    private static final String DOMAIN_NAME = "콘텐츠";
    private static final String DOMAIN_NAME_EN = "Content";
    private static final String GROUP_CODE = "A00401";
    private static final String GROUP_NAME = "게시판 관리";
    private static final String GROUP_NAME_EN = "Board Management";
    private static final String MENU_CODE = "A0040104";
    private static final String MENU_NAME_KO = "첨부파일 관리";
    private static final String MENU_NAME_EN = "Attachment Management";
    private static final String MENU_URL = "/admin/content/file";
    private static final String MENU_ICON = "attach_file";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";
    private static final String VIEW_FEATURE_CODE = "ADMIN_" + MENU_CODE + "_VIEW";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureFileManagementMenu() {
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
            log.info("File management menu provisioned. created={}, existing={}, skipped={}",
                    response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision file management menu.", e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-FILE-MANAGEMENT");
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(MENU_URL);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest());
        request.setFeatures(Arrays.asList(
                featureRequest(VIEW_FEATURE_CODE, "첨부파일 관리", "View Attachment Management", "Attachment management page access")
        ));
        request.setAuthors(Arrays.asList(
                authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", VIEW_FEATURE_CODE),
                authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", VIEW_FEATURE_CODE),
                authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", VIEW_FEATURE_CODE),
                authorRequest("ROLE_OPERATION_ADMIN", "운영 관리자", "Operations Administrator", VIEW_FEATURE_CODE)
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

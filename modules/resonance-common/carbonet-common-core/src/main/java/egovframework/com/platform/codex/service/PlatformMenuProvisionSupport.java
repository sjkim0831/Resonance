package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@RequiredArgsConstructor
@Slf4j
public class PlatformMenuProvisionSupport {

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    public void provisionAdminMenu(String logKey,
                                   CodexProvisionRequest request,
                                   String menuCode,
                                   String menuNameKo,
                                   String menuNameEn,
                                   String menuUrl,
                                   String menuIcon,
                                   String actorId) {
        provisionAdminMenu(logKey, request, menuCode, menuNameKo, menuNameEn, menuUrl, menuIcon, actorId, null);
    }

    public void provisionAdminMenu(String logKey,
                                   egovframework.com.feature.admin.dto.request.CodexProvisionRequest request,
                                   String menuCode,
                                   String menuNameKo,
                                   String menuNameEn,
                                   String menuUrl,
                                   String menuIcon,
                                   String actorId) {
        provisionAdminMenu(logKey, toPlatformRequest(request), menuCode, menuNameKo, menuNameEn, menuUrl, menuIcon, actorId, null);
    }

    public void provisionAdminMenu(String logKey,
                                   CodexProvisionRequest request,
                                   String menuCode,
                                   String menuNameKo,
                                   String menuNameEn,
                                   String menuUrl,
                                   String menuIcon,
                                   String actorId,
                                   MenuPostProcessor postProcessor) {
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(request);
            adminCodeManageService.updatePageManagement(
                    menuCode,
                    menuNameKo,
                    menuNameEn,
                    menuUrl,
                    menuIcon,
                    "Y",
                    actorId
            );
            if (postProcessor != null) {
                postProcessor.run(adminCodeManageService);
            }
            log.info("{} provisioned. created={}, existing={}, skipped={}",
                    logKey, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
        } catch (Exception e) {
            log.error("Failed to provision {}.", logKey, e);
        }
    }

    public void provisionAdminMenu(String logKey,
                                   egovframework.com.feature.admin.dto.request.CodexProvisionRequest request,
                                   String menuCode,
                                   String menuNameKo,
                                   String menuNameEn,
                                   String menuUrl,
                                   String menuIcon,
                                   String actorId,
                                   MenuPostProcessor postProcessor) {
        provisionAdminMenu(logKey, toPlatformRequest(request), menuCode, menuNameKo, menuNameEn, menuUrl, menuIcon, actorId, postProcessor);
    }

    public static CodexProvisionRequest adminMenuRequest(String requestId,
                                                         String actorId,
                                                         String targetApiPath,
                                                         CodexProvisionRequest.PageRequest page,
                                                         CodexProvisionRequest.FeatureRequest[] features,
                                                         CodexProvisionRequest.AuthorRequest[] authors) {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId(requestId);
        request.setActorId(actorId);
        request.setTargetApiPath(targetApiPath);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(page);
        request.setFeatures(Arrays.asList(features));
        request.setAuthors(Arrays.asList(authors));
        return request;
    }

    public static CodexProvisionRequest.PageRequest pageRequest(String domainCode,
                                                                String domainName,
                                                                String domainNameEn,
                                                                String groupCode,
                                                                String groupName,
                                                                String groupNameEn,
                                                                String menuCode,
                                                                String menuNameKo,
                                                                String menuNameEn,
                                                                String menuUrl,
                                                                String menuIcon) {
        CodexProvisionRequest.PageRequest page = new CodexProvisionRequest.PageRequest();
        page.setDomainCode(domainCode);
        page.setDomainName(domainName);
        page.setDomainNameEn(domainNameEn);
        page.setGroupCode(groupCode);
        page.setGroupName(groupName);
        page.setGroupNameEn(groupNameEn);
        page.setCode(menuCode);
        page.setCodeNm(menuNameKo);
        page.setCodeDc(menuNameEn);
        page.setMenuUrl(menuUrl);
        page.setMenuIcon(menuIcon);
        page.setUseAt("Y");
        return page;
    }

    public static CodexProvisionRequest.FeatureRequest featureRequest(String menuCode,
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

    public static CodexProvisionRequest.AuthorRequest authorRequest(String authorCode,
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

    private CodexProvisionRequest toPlatformRequest(egovframework.com.feature.admin.dto.request.CodexProvisionRequest request) {
        if (request == null) {
            return null;
        }
        CodexProvisionRequest platformRequest = new CodexProvisionRequest();
        platformRequest.setRequestId(request.getRequestId());
        platformRequest.setActorId(request.getActorId());
        platformRequest.setTargetApiPath(request.getTargetApiPath());
        platformRequest.setCompanyId(request.getCompanyId());
        platformRequest.setInsttId(request.getInsttId());
        platformRequest.setMenuType(request.getMenuType());
        platformRequest.setReloadSecurityMetadata(request.isReloadSecurityMetadata());
        platformRequest.setPage(request.getPage());
        platformRequest.setFeatures(request.getFeatures());
        platformRequest.setAuthors(request.getAuthors());
        platformRequest.setCommonCodeGroups(request.getCommonCodeGroups());
        return platformRequest;
    }

    @FunctionalInterface
    public interface MenuPostProcessor {
        void run(AdminCodeManageService adminCodeManageService) throws Exception;
    }
}

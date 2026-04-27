package egovframework.com.platform.codex.service.impl;

import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.feature.admin.dto.request.AdminMenuFeatureCommandDTO;
import egovframework.com.platform.codex.mapper.AuthGroupManageMapper;
import egovframework.com.platform.codex.mapper.MenuFeatureManageMapper;
import egovframework.com.platform.menu.mapper.MenuInfoMapper;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.governance.mapper.AdminCodeManageMapper;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service("codexProvisioningService")
@RequiredArgsConstructor
@Slf4j
public class CodexProvisioningServiceImpl implements CodexProvisioningService {

    private static final String DEFAULT_ACTOR = "CODEX";
    private static final DateTimeFormatter AUTHOR_DATE_FORMAT = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    private final AdminCodeManageMapper adminCodeManageMapper;
    private final MenuInfoMapper menuInfoMapper;
    private final MenuFeatureManageMapper menuFeatureManageMapper;
    private final AuthGroupManageMapper authGroupManageMapper;

    @Override
    @Transactional
    public CodexProvisionResponse provision(CodexProvisionRequest request) {
        CodexProvisionRequest normalizedRequest = request == null ? new CodexProvisionRequest() : request;
        String menuType = normalizeMenuType(normalizedRequest.getMenuType());
        String codeId = resolveCodeId(menuType);
        String actorId = defaultActor(normalizedRequest.getActorId());

        CodexProvisionResponse response = new CodexProvisionResponse();
        response.setStatus("success");
        response.setRequestId(safeString(normalizedRequest.getRequestId()));
        response.setActorId(actorId);

        ensurePage(codeId, normalizedRequest.getPage(), actorId, response);
        ensureFeatures(codeId, normalizedRequest.getPage(), normalizedRequest.getFeatures(), response);
        ensureCommonCodeGroups(normalizedRequest.getCommonCodeGroups(), actorId, response);
        ensureAuthors(normalizedRequest.getAuthors(), actorId, response);

        log.info("Codex provisioning completed. requestId={}, actorId={}, created={}, existing={}, skipped={}",
                response.getRequestId(), actorId, response.getCreatedCount(), response.getExistingCount(),
                response.getSkippedCount());
        return response;
    }

    @Override
    @Transactional
    public CodexProvisionResponse provision(egovframework.com.feature.admin.dto.request.CodexProvisionRequest request) {
        return provision(toPlatformRequest(request));
    }

    private void ensurePage(String codeId, CodexProvisionRequest.PageRequest page, String actorId,
                            CodexProvisionResponse response) {
        if (page == null) {
            response.addResult("page", "", "SKIPPED", "No page payload was provided.");
            return;
        }

        String pageCode = upper(page.getCode());
        if (pageCode.length() != 8) {
            throw new IllegalArgumentException("Page code must be an 8-character menu code.");
        }

        String domainCode = defaultValue(upper(page.getDomainCode()), pageCode.substring(0, 4));
        String groupCode = defaultValue(upper(page.getGroupCode()), pageCode.substring(0, 6));
        String useAt = normalizeUseAt(page.getUseAt());
        String pageNameKo = required(page.getCodeNm(), "Page name is required.");
        String pageNameEn = defaultValue(page.getCodeDc(), pageNameKo);
        String normalizedMenuUrl = required(normalizeUrl(page.getMenuUrl()), "Page URL is required.");
        String normalizedMenuIcon = defaultValue(page.getMenuIcon(), "description");

        ensureDetailCode(codeId, domainCode, defaultValue(page.getDomainName(), domainCode),
                defaultValue(page.getDomainNameEn(), defaultValue(page.getDomainName(), domainCode)),
                useAt, actorId, "menu-domain", response);
        ensureDetailCode(codeId, groupCode, defaultValue(page.getGroupName(), groupCode),
                defaultValue(page.getGroupNameEn(), defaultValue(page.getGroupName(), groupCode)),
                useAt, actorId, "menu-group", response);
        ensureDetailCode(codeId, pageCode, pageNameKo, pageNameEn,
                useAt, actorId, "page", response);

        if (menuInfoMapper.countMenuInfoByCode(pageCode) > 0) {
            AdminCodeCommandDTO menuParams = new AdminCodeCommandDTO();
            menuParams.setCode(pageCode);
            menuParams.setCodeNm(pageNameKo);
            menuParams.setCodeDc(pageNameEn);
            menuParams.setMenuUrl(normalizedMenuUrl);
            menuParams.setMenuIcon(normalizedMenuIcon);
            menuParams.setUseAt(useAt);
            menuParams.setUpdaterId(actorId);
            adminCodeManageMapper.updatePageManagementNames(menuParams);
            adminCodeManageMapper.updatePageManagementUseAt(menuParams);
            adminCodeManageMapper.updatePageManagementMenu(menuParams);
            response.addResult("menu", pageCode, "EXISTING", "Menu URL metadata already exists and has been synchronized.");
            return;
        }

        AdminCodeCommandDTO menuParams = new AdminCodeCommandDTO();
        menuParams.setCode(pageCode);
        menuParams.setCodeNm(pageNameKo);
        menuParams.setCodeDc(pageNameEn);
        menuParams.setMenuUrl(normalizedMenuUrl);
        menuParams.setMenuIcon(normalizedMenuIcon);
        menuParams.setUseAt(useAt);
        adminCodeManageMapper.insertPageManagementMenu(menuParams);
        response.addResult("menu", pageCode, "CREATED", "Menu URL metadata has been registered.");
    }

    private void ensureFeatures(String codeId, CodexProvisionRequest.PageRequest page,
                                List<CodexProvisionRequest.FeatureRequest> features,
                                CodexProvisionResponse response) {
        if (features == null || features.isEmpty()) {
            response.addResult("feature", "", "SKIPPED", "No feature payload was provided.");
            return;
        }

        String fallbackMenuCode = page == null ? "" : upper(page.getCode());
        for (CodexProvisionRequest.FeatureRequest feature : features) {
            if (feature == null) {
                continue;
            }
            String menuCode = defaultValue(upper(feature.getMenuCode()), fallbackMenuCode);
            String featureCode = upper(feature.getFeatureCode());
            if (menuCode.isEmpty() || featureCode.isEmpty()) {
                throw new IllegalArgumentException("Feature menuCode and featureCode are required.");
            }
            if (adminCodeManageMapper.countDetailCode(detailCountParams(codeId, menuCode)) == 0) {
                throw new IllegalArgumentException("Feature menu code does not exist: " + menuCode);
            }
            if (menuFeatureManageMapper.countFeatureCode(featureCountParams(featureCode)) > 0) {
                response.addResult("feature", featureCode, "EXISTING", "Feature code already exists.");
                continue;
            }

            AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
            params.setMenuCode(menuCode);
            params.setFeatureCode(featureCode);
            params.setFeatureNm(required(feature.getFeatureNm(), "Feature name is required."));
            params.setFeatureNmEn(defaultValue(feature.getFeatureNmEn(),
                    required(feature.getFeatureNm(), "Feature English name is required.")));
            params.setFeatureDc(defaultValue(feature.getFeatureDc(), params.getFeatureNm()));
            params.setUseAt(normalizeUseAt(feature.getUseAt()));
            menuFeatureManageMapper.insertMenuFeature(params);
            response.addResult("feature", featureCode, "CREATED", "Feature code has been registered.");
        }
    }

    private void ensureCommonCodeGroups(List<CodexProvisionRequest.CommonCodeGroupRequest> groups, String actorId,
                                        CodexProvisionResponse response) {
        if (groups == null || groups.isEmpty()) {
            response.addResult("common-code", "", "SKIPPED", "No common code payload was provided.");
            return;
        }

        for (CodexProvisionRequest.CommonCodeGroupRequest group : groups) {
            if (group == null) {
                continue;
            }
            String classCode = upper(group.getClassCode());
            if (!classCode.isEmpty() && adminCodeManageMapper.countClassCode(classCode) == 0) {
                AdminCodeCommandDTO classParams = new AdminCodeCommandDTO();
                classParams.setClCode(classCode);
                classParams.setClCodeNm(defaultValue(group.getClassCodeNm(), classCode));
                classParams.setClCodeDc(defaultValue(group.getClassCodeDc(), classParams.getClCodeNm()));
                classParams.setUseAt(normalizeUseAt(group.getClassUseAt()));
                classParams.setRegisterId(actorId);
                adminCodeManageMapper.insertClassCode(classParams);
                response.addResult("code-class", classCode, "CREATED", "Code class has been registered.");
            } else if (!classCode.isEmpty()) {
                response.addResult("code-class", classCode, "EXISTING", "Code class already exists.");
            }

            String codeId = upper(group.getCodeId());
            if (codeId.isEmpty()) {
                throw new IllegalArgumentException("Common code group codeId is required.");
            }
            if (adminCodeManageMapper.countCommonCode(codeId) == 0) {
                AdminCodeCommandDTO codeParams = new AdminCodeCommandDTO();
                codeParams.setCodeId(codeId);
                codeParams.setCodeIdNm(required(group.getCodeIdNm(), "Common code name is required."));
                codeParams.setCodeIdDc(defaultValue(group.getCodeIdDc(), codeParams.getCodeIdNm()));
                codeParams.setClCode(required(classCode, "Class code is required for common code creation."));
                codeParams.setUseAt(normalizeUseAt(group.getUseAt()));
                codeParams.setRegisterId(actorId);
                adminCodeManageMapper.insertCommonCode(codeParams);
                response.addResult("common-code", codeId, "CREATED", "Common code group has been registered.");
            } else {
                response.addResult("common-code", codeId, "EXISTING", "Common code group already exists.");
            }

            if (group.getDetails() == null || group.getDetails().isEmpty()) {
                continue;
            }
            for (CodexProvisionRequest.CommonCodeDetailRequest detail : group.getDetails()) {
                if (detail == null) {
                    continue;
                }
                String detailCode = upper(detail.getCode());
                if (detailCode.isEmpty()) {
                    throw new IllegalArgumentException("Common code detail code is required.");
                }
                if (adminCodeManageMapper.countDetailCode(detailCountParams(codeId, detailCode)) > 0) {
                    response.addResult("common-code-detail", codeId + ":" + detailCode, "EXISTING",
                            "Common code detail already exists.");
                    continue;
                }
                AdminCodeCommandDTO detailParams = new AdminCodeCommandDTO();
                detailParams.setCodeId(codeId);
                detailParams.setCode(detailCode);
                detailParams.setCodeNm(required(detail.getCodeNm(), "Common code detail name is required."));
                detailParams.setCodeDc(defaultValue(detail.getCodeDc(), detailParams.getCodeNm()));
                detailParams.setUseAt(normalizeUseAt(detail.getUseAt()));
                detailParams.setRegisterId(actorId);
                adminCodeManageMapper.insertDetailCode(detailParams);
                response.addResult("common-code-detail", codeId + ":" + detailCode, "CREATED",
                        "Common code detail has been registered.");
            }
        }
    }

    private void ensureAuthors(List<CodexProvisionRequest.AuthorRequest> authors, String actorId,
                               CodexProvisionResponse response) {
        if (authors == null || authors.isEmpty()) {
            response.addResult("author", "", "SKIPPED", "No author payload was provided.");
            return;
        }

        for (CodexProvisionRequest.AuthorRequest author : authors) {
            if (author == null) {
                continue;
            }
            String authorCode = upper(author.getAuthorCode());
            if (authorCode.isEmpty()) {
                throw new IllegalArgumentException("Author code is required.");
            }
            if (authGroupManageMapper.countAuthorCode(authorCode) == 0) {
                AuthorInfoVO authorInfoVO = new AuthorInfoVO();
                authorInfoVO.setAuthorCode(authorCode);
                authorInfoVO.setAuthorNm(required(author.getAuthorNm(), "Author name is required."));
                authorInfoVO.setAuthorDc(defaultValue(author.getAuthorDc(), authorInfoVO.getAuthorNm()));
                authorInfoVO.setAuthorCreatDe(LocalDate.now().format(AUTHOR_DATE_FORMAT));
                authGroupManageMapper.insertAuthor(authorInfoVO);
                response.addResult("author", authorCode, "CREATED", "Author has been registered.");
            } else {
                response.addResult("author", authorCode, "EXISTING", "Author already exists.");
            }

            if (author.getFeatureCodes() == null || author.getFeatureCodes().isEmpty()) {
                continue;
            }
            for (String featureCodeValue : author.getFeatureCodes()) {
                String featureCode = upper(featureCodeValue);
                if (featureCode.isEmpty()) {
                    continue;
                }
                if (authGroupManageMapper.countAuthorFeaturePermission(authorCode, featureCode) > 0) {
                    response.addResult("author-feature", authorCode + ":" + featureCode, "EXISTING",
                            "Author-feature relation already exists.");
                    continue;
                }
                Map<String, String> params = new HashMap<>();
                params.put("authorCode", authorCode);
                params.put("featureCode", featureCode);
                authGroupManageMapper.insertAuthorFeatureRelation(params);
                response.addResult("author-feature", authorCode + ":" + featureCode, "CREATED",
                        "Author-feature relation has been registered.");
            }
        }
    }

    private void ensureDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt, String actorId,
                                  String category, CodexProvisionResponse response) {
        if (adminCodeManageMapper.countDetailCode(detailCountParams(codeId, code)) > 0) {
            AdminCodeCommandDTO params = new AdminCodeCommandDTO();
            params.setCodeId(codeId);
            params.setCode(code);
            params.setCodeNm(codeNm);
            params.setCodeDc(codeDc);
            params.setUseAt(useAt);
            params.setUpdaterId(actorId);
            adminCodeManageMapper.updateDetailCode(params);
            response.addResult(category, code, "EXISTING", "Menu detail code already exists and has been synchronized.");
            return;
        }
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        params.setCodeNm(codeNm);
        params.setCodeDc(codeDc);
        params.setUseAt(useAt);
        params.setRegisterId(actorId);
        adminCodeManageMapper.insertDetailCode(params);
        response.addResult(category, code, "CREATED", "Menu detail code has been registered.");
    }

    private AdminCodeCommandDTO detailCountParams(String codeId, String code) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        return params;
    }

    private AdminMenuFeatureCommandDTO featureCountParams(String featureCode) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setFeatureCode(featureCode);
        return params;
    }

    private String resolveCodeId(String menuType) {
        return "USER".equals(menuType) ? "HMENU1" : "AMENU1";
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

    private String normalizeMenuType(String value) {
        return "USER".equalsIgnoreCase(safeString(value)) ? "USER" : "ADMIN";
    }

    private String defaultActor(String actorId) {
        String normalized = safeString(actorId);
        return normalized.isEmpty() ? DEFAULT_ACTOR : normalized;
    }

    private String normalizeUseAt(String value) {
        return "N".equalsIgnoreCase(safeString(value)) ? "N" : "Y";
    }

    private String normalizeUrl(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        return normalized.startsWith("/") ? normalized : "/" + normalized;
    }

    private String defaultValue(String value, String fallback) {
        String normalized = safeString(value);
        return normalized.isEmpty() ? safeString(fallback) : normalized;
    }

    private String required(String value, String message) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String upper(String value) {
        return safeString(value).toUpperCase(Locale.ROOT);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

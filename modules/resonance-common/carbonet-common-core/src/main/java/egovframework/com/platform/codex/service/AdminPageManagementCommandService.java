package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.governance.model.vo.PageManagementVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminPageManagementCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminPageManagementCommandService.class);

    private final AdminCodeManageService adminCodeManageService;
    private final MenuFeatureManageService menuFeatureManageService;
    private final AuthGroupManageService authGroupManageService;
    private final CurrentUserContextService currentUserContextService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    public ResponseEntity<Map<String, Object>> updateEnvironmentManagedPage(
            String menuType,
            String code,
            String codeNm,
            String codeDc,
            String menuUrl,
            String menuIcon,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String normalizedName = safeString(codeNm);
        String normalizedNameEn = safeString(codeDc);
        String normalizedUrl = canonicalMenuUrl(menuUrl);
        String normalizedIcon = safeString(menuIcon);
        String normalizedUseAt = normalizeUseAt(useAt);

        Map<String, Object> response = new LinkedHashMap<>();
        String error = validateEnvironmentManagedPageUpdateInput(
                normalizedCode, normalizedName, normalizedNameEn, normalizedUrl, normalizedMenuType, codeId, isEn);
        if (!error.isEmpty()) {
            response.put("success", false);
            response.put("message", error);
            return ResponseEntity.badRequest().body(response);
        }

        try {
            String actorId = resolveActorId(request);
            adminCodeManageService.updatePageManagement(
                    normalizedCode,
                    normalizedName,
                    normalizedNameEn,
                    normalizedUrl,
                    normalizedIcon,
                    normalizedUseAt,
                    actorId.isEmpty() ? "admin" : actorId);
            syncDefaultViewFeatureMetadata(normalizedCode, normalizedUseAt, normalizedMenuType);
        } catch (Exception e) {
            log.error("Failed to update environment managed page. code={}", normalizedCode, e);
            response.put("success", false);
            response.put("message", isEn ? "Failed to update the selected menu." : "선택한 메뉴를 수정하지 못했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }

        response.put("success", true);
        response.put("code", normalizedCode);
        response.put("message", isEn ? "The selected menu has been updated." : "선택한 메뉴를 수정했습니다.");
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Map<String, Object>> environmentManagedPageImpact(
            String menuType,
            String code,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        Map<String, Object> response = new LinkedHashMap<>();

        String error = validateEnvironmentManagedPageDeleteTarget(normalizedCode, codeId, isEn);
        if (!error.isEmpty()) {
            response.put("success", false);
            response.put("message", error);
            return ResponseEntity.badRequest().body(response);
        }

        try {
            String defaultViewFeatureCode = buildDefaultViewFeatureCode(normalizedCode);
            List<String> linkedFeatureCodes = authGroupManageService.selectFeatureCodesByMenuCode(normalizedCode);
            List<String> nonDefaultFeatureCodes = new ArrayList<>();
            for (String featureCode : linkedFeatureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (!normalizedFeatureCode.isEmpty() && !normalizedFeatureCode.equals(defaultViewFeatureCode)) {
                    nonDefaultFeatureCodes.add(normalizedFeatureCode);
                }
            }
            response.put("success", true);
            response.put("code", normalizedCode);
            response.put("defaultViewFeatureCode", defaultViewFeatureCode);
            response.put("linkedFeatureCodes", linkedFeatureCodes);
            response.put("nonDefaultFeatureCodes", nonDefaultFeatureCodes);
            response.put("defaultViewRoleRefCount", authGroupManageService.countAuthorFeatureRelationsByFeatureCode(defaultViewFeatureCode));
            response.put("defaultViewUserOverrideCount", authGroupManageService.countUserFeatureOverridesByFeatureCode(defaultViewFeatureCode));
            response.put("blocked", !nonDefaultFeatureCodes.isEmpty());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to load environment managed page impact. code={}", normalizedCode, e);
            response.put("success", false);
            response.put("message", isEn ? "Failed to load page delete impact." : "페이지 삭제 영향도를 불러오지 못했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }
    }

    public ResponseEntity<Map<String, Object>> deleteEnvironmentManagedPage(
            String menuType,
            String code,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        Map<String, Object> response = new LinkedHashMap<>();

        String error = validateEnvironmentManagedPageDeleteTarget(normalizedCode, codeId, isEn);
        if (!error.isEmpty()) {
            response.put("success", false);
            response.put("message", error);
            return ResponseEntity.badRequest().body(response);
        }

        int defaultViewRoleRefCount = 0;
        int defaultViewUserOverrideCount = 0;
        try {
            List<String> linkedFeatureCodes = authGroupManageService.selectFeatureCodesByMenuCode(normalizedCode);
            String defaultViewFeatureCode = buildDefaultViewFeatureCode(normalizedCode);
            defaultViewRoleRefCount = authGroupManageService.countAuthorFeatureRelationsByFeatureCode(defaultViewFeatureCode);
            defaultViewUserOverrideCount = authGroupManageService.countUserFeatureOverridesByFeatureCode(defaultViewFeatureCode);
            List<String> nonDefaultFeatureCodes = new ArrayList<>();
            for (String featureCode : linkedFeatureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (!normalizedFeatureCode.isEmpty() && !normalizedFeatureCode.equals(defaultViewFeatureCode)) {
                    nonDefaultFeatureCodes.add(normalizedFeatureCode);
                }
            }
            if (!nonDefaultFeatureCodes.isEmpty()) {
                response.put("success", false);
                response.put("message", isEn
                        ? "Delete the page-specific action features first."
                        : "페이지 전용 액션 기능을 먼저 삭제해 주세요.");
                response.put("nonDefaultFeatureCodes", nonDefaultFeatureCodes);
                response.put("defaultViewRoleRefCount", defaultViewRoleRefCount);
                response.put("defaultViewUserOverrideCount", defaultViewUserOverrideCount);
                return ResponseEntity.badRequest().body(response);
            }
            if (linkedFeatureCodes.stream().anyMatch(featureCode -> defaultViewFeatureCode.equalsIgnoreCase(safeString(featureCode)))) {
                deleteFeatureWithAssignments(defaultViewFeatureCode);
            }
            adminCodeManageService.deletePageManagement(codeId, normalizedCode);
        } catch (Exception e) {
            log.error("Failed to delete environment managed page. code={}", normalizedCode, e);
            response.put("success", false);
            response.put("message", isEn ? "Failed to delete the selected page menu." : "선택한 페이지 메뉴 삭제에 실패했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }

        response.put("success", true);
        response.put("code", normalizedCode);
        response.put("defaultViewRoleRefCount", defaultViewRoleRefCount);
        response.put("defaultViewUserOverrideCount", defaultViewUserOverrideCount);
        response.put("message", isEn
                ? "The page menu and default VIEW permission have been deleted."
                : "페이지 메뉴와 기본 VIEW 권한을 삭제했습니다.");
        return ResponseEntity.ok(response);
    }

    public String createPageManagement(
            String menuType,
            String code,
            String codeNm,
            String codeDc,
            String menuUrl,
            String menuIcon,
            String domainCode,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String normalizedName = safeString(codeNm);
        String normalizedNameEn = safeString(codeDc);
        String normalizedUrl = canonicalMenuUrl(menuUrl);
        String normalizedIcon = safeString(menuIcon);
        String normalizedDomainCode = safeString(domainCode).toUpperCase(Locale.ROOT);
        String normalizedUseAt = normalizeUseAt(useAt);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);

        String error = validatePageManagementInput(
                normalizedCode, normalizedName, normalizedNameEn, normalizedUrl, normalizedDomainCode, normalizedMenuType, isEn);
        if (!error.isEmpty()) {
            return redirectPageManagementError(request, locale, normalizedMenuType, null, null, error, null, null);
        }

        try {
            if (adminCodeManageService.countPageManagementByCode(codeId, normalizedCode) > 0) {
                return redirectPageManagementError(request, locale, normalizedMenuType, null, null,
                        isEn ? "The page code already exists." : "이미 등록된 페이지 코드입니다.", null, null);
            }
            adminCodeManageService.insertPageManagement(
                    codeId, normalizedCode, normalizedName, normalizedNameEn, normalizedUrl, normalizedIcon, normalizedUseAt, "admin");
            ensureDefaultViewFeature(normalizedCode, normalizedName, normalizedNameEn, normalizedUseAt);
        } catch (Exception e) {
            log.error("Failed to create page management. code={}", normalizedCode, e);
            return redirectPageManagementError(request, locale, normalizedMenuType, null, null,
                    isEn ? "Failed to register the page." : "페이지 등록에 실패했습니다.", null, null);
        }
        return "redirect:" + adminPrefix(request, locale) + "/system/page-management?menuType=" + normalizedMenuType + "&autoFeature=Y";
    }

    public String updatePageManagement(
            String menuType,
            String code,
            String codeNm,
            String codeDc,
            String menuUrl,
            String menuIcon,
            String useAt,
            String searchKeyword,
            String searchUrl,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String normalizedName = safeString(codeNm);
        String normalizedNameEn = safeString(codeDc);
        String normalizedUrl = canonicalMenuUrl(menuUrl);
        String normalizedIcon = safeString(menuIcon);
        String normalizedUseAt = normalizeUseAt(useAt);
        String normalizedMenuType = normalizeMenuType(menuType);

        if (normalizedCode.isEmpty() || normalizedName.isEmpty() || normalizedNameEn.isEmpty() || normalizedUrl.isEmpty()) {
            return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                    isEn ? "Page code, page names, and URL are required." : "페이지 코드, 페이지명, 영문 페이지명, URL은 필수입니다.", null, null);
        }
        if (!isValidPageManagementUrl(normalizedUrl, normalizedMenuType)) {
            return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                    isEn
                            ? ("USER".equals(normalizedMenuType)
                            ? "Home page URLs must start with /home or /en/home."
                            : "Admin page URLs must start with /admin/ or /en/admin/.")
                            : ("USER".equals(normalizedMenuType)
                            ? "홈 화면 URL은 /home 또는 /en/home 으로 시작해야 합니다."
                            : "관리자 화면 URL은 /admin/ 또는 /en/admin/ 으로 시작해야 합니다."),
                    null, null);
        }

        try {
            adminCodeManageService.updatePageManagement(
                    normalizedCode, normalizedName, normalizedNameEn, normalizedUrl, normalizedIcon, normalizedUseAt, "admin");
            syncDefaultViewFeatureMetadata(normalizedCode, normalizedUseAt, normalizedMenuType);
        } catch (Exception e) {
            log.error("Failed to update page management. code={}", normalizedCode, e);
            return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                    isEn ? "Failed to update the page URL." : "페이지 URL 수정에 실패했습니다.", null, null);
        }
        return "redirect:" + adminPrefix(request, locale) + "/system/page-management?menuType=" + normalizedMenuType
                + "&searchKeyword=" + urlEncode(searchKeyword) + "&searchUrl=" + urlEncode(searchUrl) + "&updated=Y";
    }

    public String deletePageManagement(
            String menuType,
            String code,
            String searchKeyword,
            String searchUrl,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        if (normalizedCode.isEmpty()) {
            return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                    isEn ? "Page code is required." : "페이지 코드를 확인해 주세요.", null, null);
        }

        int defaultViewRoleRefCount = 0;
        int defaultViewUserOverrideCount = 0;
        try {
            List<String> linkedFeatureCodes = authGroupManageService.selectFeatureCodesByMenuCode(normalizedCode);
            String defaultViewFeatureCode = buildDefaultViewFeatureCode(normalizedCode);
            defaultViewRoleRefCount = authGroupManageService.countAuthorFeatureRelationsByFeatureCode(defaultViewFeatureCode);
            defaultViewUserOverrideCount = authGroupManageService.countUserFeatureOverridesByFeatureCode(defaultViewFeatureCode);
            List<String> nonDefaultFeatureCodes = new ArrayList<>();
            for (String featureCode : linkedFeatureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (!normalizedFeatureCode.isEmpty() && !normalizedFeatureCode.equals(defaultViewFeatureCode)) {
                    nonDefaultFeatureCodes.add(normalizedFeatureCode);
                }
            }
            if (!nonDefaultFeatureCodes.isEmpty()) {
                String featureCodeSummary = String.join(", ", nonDefaultFeatureCodes);
                return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                        isEn
                                ? "Delete the page-specific action features first. Remaining features: " + featureCodeSummary
                                + " | Default VIEW cleanup impact: role mappings " + defaultViewRoleRefCount
                                + ", user overrides " + defaultViewUserOverrideCount
                                : "페이지 전용 액션 기능을 먼저 삭제해 주세요. 남아 있는 기능: " + featureCodeSummary
                                + " | 기본 VIEW 정리 영향: 권한그룹 매핑 " + defaultViewRoleRefCount
                                + "건, 사용자 예외권한 " + defaultViewUserOverrideCount + "건",
                        defaultViewRoleRefCount,
                        defaultViewUserOverrideCount);
            }
            if (linkedFeatureCodes.stream().anyMatch(featureCode -> defaultViewFeatureCode.equalsIgnoreCase(safeString(featureCode)))) {
                deleteFeatureWithAssignments(defaultViewFeatureCode);
            }
            adminCodeManageService.deletePageManagement(codeId, normalizedCode);
        } catch (Exception e) {
            log.error("Failed to delete page management. code={}", normalizedCode, e);
            return redirectPageManagementError(request, locale, normalizedMenuType, searchKeyword, searchUrl,
                    isEn ? "Failed to delete the page." : "페이지 삭제에 실패했습니다.", null, null);
        }
        return "redirect:" + adminPrefix(request, locale) + "/system/page-management?menuType=" + normalizedMenuType
                + "&searchKeyword=" + urlEncode(searchKeyword)
                + "&searchUrl=" + urlEncode(searchUrl)
                + "&deleted=Y"
                + "&deletedRoleRefs=" + defaultViewRoleRefCount
                + "&deletedUserOverrides=" + defaultViewUserOverrideCount;
    }

    private String redirectPageManagementError(HttpServletRequest request,
                                               Locale locale,
                                               String menuType,
                                               String searchKeyword,
                                               String searchUrl,
                                               String errorMessage,
                                               Integer deletedRoleRefs,
                                               Integer deletedUserOverrides) {
        StringBuilder redirect = new StringBuilder("redirect:")
                .append(adminPrefix(request, locale))
                .append("/system/page-management?menuType=")
                .append(urlEncode(menuType));
        appendRedirectQuery(redirect, "searchKeyword", searchKeyword);
        appendRedirectQuery(redirect, "searchUrl", searchUrl);
        if (deletedRoleRefs != null) {
            appendRedirectQuery(redirect, "deletedRoleRefs", String.valueOf(deletedRoleRefs));
        }
        if (deletedUserOverrides != null) {
            appendRedirectQuery(redirect, "deletedUserOverrides", String.valueOf(deletedUserOverrides));
        }
        redirect.append("&errorMessage=").append(urlEncode(errorMessage));
        return redirect.toString();
    }

    private void appendRedirectQuery(StringBuilder redirect, String name, String value) {
        String normalizedValue = safeString(value);
        if (!normalizedValue.isEmpty()) {
            redirect.append('&').append(name).append('=').append(urlEncode(normalizedValue));
        }
    }

    private String validatePageManagementInput(String code,
                                               String codeNm,
                                               String codeDc,
                                               String menuUrl,
                                               String domainCode,
                                               String menuType,
                                               boolean isEn) {
        if (code.isEmpty() || codeNm.isEmpty() || codeDc.isEmpty() || menuUrl.isEmpty() || domainCode.isEmpty()) {
            return isEn
                    ? "Page code, page name, English page name, URL, and domain are required."
                    : "페이지 코드, 페이지명, 영문 페이지명, URL, 도메인은 필수입니다.";
        }
        if (!code.startsWith(domainCode)) {
            return isEn
                    ? "The page code must start with the selected domain code."
                    : "페이지 코드는 선택한 도메인 코드로 시작해야 합니다.";
        }
        if (code.length() != 8) {
            return isEn ? "The page code must be 8 characters long." : "페이지 코드는 8자리로 입력해 주세요.";
        }
        if (!isValidPageManagementUrl(menuUrl, menuType)) {
            return isEn
                    ? ("USER".equals(menuType)
                    ? "Home page URLs must start with /home or /en/home."
                    : "Admin page URLs must start with /admin/ or /en/admin/.")
                    : ("USER".equals(menuType)
                    ? "홈 화면 URL은 /home 또는 /en/home 으로 시작해야 합니다."
                    : "관리자 화면 URL은 /admin/ 또는 /en/admin/ 으로 시작해야 합니다.");
        }
        return "";
    }

    private String validateEnvironmentManagedPageUpdateInput(String code,
                                                             String codeNm,
                                                             String codeDc,
                                                             String menuUrl,
                                                             String menuType,
                                                             String codeId,
                                                             boolean isEn) {
        if (code.length() != 8) {
            return isEn ? "Select a valid 8-digit page menu." : "유효한 8자리 페이지 메뉴를 선택해 주세요.";
        }
        if (codeNm.isEmpty() || codeDc.isEmpty() || menuUrl.isEmpty()) {
            return isEn ? "Page names and URL are required." : "페이지명, 영문 페이지명, URL은 필수입니다.";
        }
        if (!isValidPageManagementUrl(menuUrl, menuType)) {
            return isEn
                    ? ("USER".equals(menuType)
                    ? "Home page URLs must start with /home or /en/home."
                    : "Admin page URLs must start with /admin/ or /en/admin/.")
                    : ("USER".equals(menuType)
                    ? "홈 화면 URL은 /home 또는 /en/home 으로 시작해야 합니다."
                    : "관리자 화면 URL은 /admin/ 또는 /en/admin/ 으로 시작해야 합니다.");
        }
        try {
            if (adminCodeManageService.countPageManagementByCode(codeId, code) == 0) {
                return isEn ? "The selected page menu does not exist." : "선택한 페이지 메뉴가 존재하지 않습니다.";
            }
        } catch (Exception e) {
            log.error("Failed to validate environment managed page. code={}", code, e);
            return isEn ? "Failed to validate the selected page menu." : "선택한 페이지 메뉴 검증에 실패했습니다.";
        }
        return "";
    }

    private String validateEnvironmentManagedPageDeleteTarget(String code, String codeId, boolean isEn) {
        if (code.length() != 8) {
            return isEn ? "Only 8-digit page menus can be deleted here." : "이 화면에서는 8자리 페이지 메뉴만 삭제할 수 있습니다.";
        }
        try {
            if (adminCodeManageService.countPageManagementByCode(codeId, code) == 0) {
                return isEn ? "The selected page menu does not exist." : "선택한 페이지 메뉴가 존재하지 않습니다.";
            }
        } catch (Exception e) {
            log.error("Failed to validate environment managed page delete target. code={}", code, e);
            return isEn ? "Failed to validate the selected page menu." : "선택한 페이지 메뉴 검증에 실패했습니다.";
        }
        return "";
    }

    private void ensureDefaultViewFeature(String pageCode, String pageNameKo, String pageNameEn, String useAt) throws Exception {
        String featureCode = buildDefaultViewFeatureCode(pageCode);
        if (featureCode.isEmpty() || menuFeatureManageService.countFeatureCode(featureCode) > 0) {
            return;
        }
        menuFeatureManageService.insertMenuFeature(
                pageCode,
                featureCode,
                buildDefaultViewFeatureName(pageNameKo, false),
                buildDefaultViewFeatureName(pageNameEn, true),
                buildDefaultViewFeatureDescription(pageNameKo, pageNameEn),
                useAt);
    }

    private void syncDefaultViewFeatureMetadata(String pageCode, String useAt, String menuType) throws Exception {
        String featureCode = buildDefaultViewFeatureCode(pageCode);
        if (featureCode.isEmpty() || menuFeatureManageService.countFeatureCode(featureCode) == 0) {
            return;
        }
        String codeId = resolveMenuCodeId(menuType);
        List<PageManagementVO> pageRows = adminCodeManageService.selectPageManagementList(codeId, pageCode, null);
        for (PageManagementVO row : pageRows) {
            if (!pageCode.equalsIgnoreCase(safeString(row.getCode()))) {
                continue;
            }
            menuFeatureManageService.updateMenuFeatureMetadata(
                    featureCode,
                    buildDefaultViewFeatureName(row.getCodeNm(), false),
                    buildDefaultViewFeatureName(row.getCodeDc(), true),
                    buildDefaultViewFeatureDescription(row.getCodeNm(), row.getCodeDc()),
                    useAt);
            return;
        }
    }

    private void deleteFeatureWithAssignments(String featureCode) throws Exception {
        String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
        if (normalizedFeatureCode.isEmpty()) {
            return;
        }
        authGroupManageService.deleteAuthorFeatureRelationsByFeatureCode(normalizedFeatureCode);
        authGroupManageService.deleteUserFeatureOverridesByFeatureCode(normalizedFeatureCode);
        menuFeatureManageService.deleteMenuFeature(normalizedFeatureCode);
    }

    private boolean isValidPageManagementUrl(String menuUrl, String menuType) {
        if ("USER".equals(menuType)) {
            return menuUrl.startsWith("/home")
                    || menuUrl.startsWith("/en/home")
                    || menuUrl.startsWith("/join/")
                    || menuUrl.startsWith("/join/en/")
                    || menuUrl.startsWith("/signin/")
                    || menuUrl.startsWith("/en/signin/")
                    || "/mypage".equals(menuUrl)
                    || "/en/mypage".equals(menuUrl)
                    || "/sitemap".equals(menuUrl)
                    || "/en/sitemap".equals(menuUrl);
        }
        return menuUrl.startsWith("/admin/") || menuUrl.startsWith("/en/admin/");
    }

    private String buildDefaultViewFeatureCode(String pageCode) {
        String normalizedPageCode = safeString(pageCode).toUpperCase(Locale.ROOT);
        return normalizedPageCode.isEmpty() ? "" : normalizedPageCode + "_VIEW";
    }

    private String buildDefaultViewFeatureName(String pageName, boolean english) {
        String normalizedPageName = safeString(pageName);
        if (normalizedPageName.isEmpty()) {
            return english ? "View Page" : "페이지 조회";
        }
        return english ? "View " + normalizedPageName : normalizedPageName + " 조회";
    }

    private String buildDefaultViewFeatureDescription(String pageNameKo, String pageNameEn) {
        String normalizedKo = safeString(pageNameKo);
        String normalizedEn = safeString(pageNameEn);
        if (!normalizedKo.isEmpty() && !normalizedEn.isEmpty()) {
            return normalizedKo + " / " + normalizedEn + " page default VIEW permission";
        }
        if (!normalizedKo.isEmpty()) {
            return normalizedKo + " 페이지 기본 VIEW 권한";
        }
        if (!normalizedEn.isEmpty()) {
            return normalizedEn + " page default VIEW permission";
        }
        return "Default VIEW permission for the page";
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getId").invoke(loginVO);
                    String actorId = value == null ? "" : value.toString();
                    if (!actorId.isEmpty()) {
                        return actorId;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(currentUserContextService.resolve(request).getUserId());
    }

    private String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(safeString(menuType)) ? "USER" : "ADMIN";
    }

    private String resolveMenuCodeId(String menuType) {
        return "USER".equals(menuType) ? "HMENU1" : "AMENU1";
    }

    private String normalizeUseAt(String useAt) {
        String value = safeString(useAt).toUpperCase(Locale.ROOT);
        return "N".equals(value) ? "N" : "Y";
    }

    private String canonicalMenuUrl(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        if (normalized.startsWith("/admin/system/unified_log/")
                || normalized.startsWith("/en/admin/system/unified_log/")) {
            return normalized;
        }
        String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(normalized);
        return canonical.isEmpty() ? normalized : canonical;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}

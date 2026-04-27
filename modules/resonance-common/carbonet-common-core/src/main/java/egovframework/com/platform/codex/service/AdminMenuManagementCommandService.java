package egovframework.com.platform.codex.service;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.common.trace.UiManifestRegistryPort;
import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.governance.model.vo.PageManagementVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import egovframework.com.platform.menu.service.MenuInfoCommandService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMenuManagementCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminMenuManagementCommandService.class);

    private final AdminMenuManagementPageService adminMenuManagementPageService;
    private final AdminCodeManageService adminCodeManageService;
    private final MenuInfoCommandService menuInfoCommandService;
    private final MenuFeatureManageService menuFeatureManageService;
    private final UiManifestRegistryPort uiManifestRegistryPort;
    private final AuditTrailService auditTrailService;
    private final CurrentUserContextService currentUserContextService;
    private final DbChangeCaptureService dbChangeCaptureService;
    private final ObjectMapper objectMapper;

    public ResponseEntity<Map<String, Object>> saveMenuManagementOrder(
            String menuType,
            String orderPayload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        List<MenuInfoDTO> menuRows = adminMenuManagementPageService.loadMenuTreeRowsByMenuType(normalizedMenuType);
        Map<String, Object> response = new LinkedHashMap<>();
        String error = validateMenuOrderPayload(normalizedMenuType, orderPayload, menuRows, isEn);
        if (!error.isEmpty()) {
            response.put("success", false);
            response.put("message", error);
            return ResponseEntity.badRequest().body(response);
        }

        try {
            for (String token : safeString(orderPayload).split(",")) {
                String[] parts = token.split(":");
                if (parts.length != 2) {
                    continue;
                }
                String code = safeString(parts[0]).toUpperCase(Locale.ROOT);
                int sortOrdr = Integer.parseInt(safeString(parts[1]));
                menuInfoCommandService.saveMenuOrder(code, sortOrdr);
            }
            recordMenuManagementAudit(
                    request,
                    normalizedMenuType,
                    "ADMIN-MENU-MANAGEMENT-ORDER-SAVE",
                    normalizedMenuType,
                    "{\"menuType\":\"" + safeJson(normalizedMenuType) + "\"}",
                    "{\"orderPayload\":\"" + safeJson(orderPayload) + "\"}");
        } catch (Exception e) {
            log.error("Failed to save menu order. menuType={}, payload={}", normalizedMenuType, orderPayload, e);
            response.put("success", false);
            response.put("message", isEn ? "Failed to save menu order." : "메뉴 순서 저장에 실패했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }

        response.put("success", true);
        response.put("message", isEn ? "Menu order has been saved." : "메뉴 순서를 저장했습니다.");
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Map<String, Object>> createMenuManagedPage(
            String menuType,
            String parentCode,
            String codeNm,
            String codeDc,
            String menuUrl,
            String menuIcon,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        String normalizedParentCode = safeString(parentCode).toUpperCase(Locale.ROOT);
        String normalizedName = safeString(codeNm);
        String normalizedNameEn = safeString(codeDc);
        String normalizedUrl = canonicalMenuUrl(menuUrl);
        String normalizedIcon = safeString(menuIcon);
        String normalizedUseAt = normalizeUseAt(useAt);

        Map<String, Object> response = new LinkedHashMap<>();
        String validationError = validateMenuManagedPageInput(
                normalizedMenuType,
                codeId,
                normalizedParentCode,
                normalizedName,
                normalizedNameEn,
                normalizedUrl,
                isEn);
        if (!validationError.isEmpty()) {
            response.put("success", false);
            response.put("message", validationError);
            return ResponseEntity.badRequest().body(response);
        }

        String nextPageCode = resolveNextPageCode(normalizedMenuType, normalizedParentCode);
        if (nextPageCode.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn
                    ? "No more page codes are available under the selected group."
                    : "선택한 그룹 메뉴 아래에서 더 이상 사용할 페이지 코드를 만들 수 없습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            String actorId = resolveActorId(request);
            adminCodeManageService.insertPageManagement(
                    codeId,
                    nextPageCode,
                    normalizedName,
                    normalizedNameEn,
                    normalizedUrl,
                    normalizedIcon,
                    normalizedUseAt,
                    actorId.isEmpty() ? "admin" : actorId);
            ensureDefaultViewFeature(nextPageCode, normalizedName, normalizedNameEn, normalizedUseAt);
            menuInfoCommandService.saveMenuOrder(nextPageCode, resolveNextSiblingSortOrder(normalizedMenuType, normalizedParentCode));
            String draftPageId = buildManagedDraftPageId(normalizedUrl, nextPageCode);
            Map<String, Object> draftRegistry = uiManifestRegistryPort.ensureManagedPageDraft(
                    draftPageId,
                    normalizedName,
                    normalizedUrl,
                    nextPageCode,
                    "USER".equals(normalizedMenuType) ? "home" : "admin");
            recordMenuManagementAudit(
                    request,
                    nextPageCode,
                    "ADMIN-MENU-MANAGEMENT-CREATE-PAGE",
                    nextPageCode,
                    "",
                    "{\"menuType\":\"" + safeJson(normalizedMenuType)
                            + "\",\"parentCode\":\"" + safeJson(normalizedParentCode)
                            + "\",\"pageCode\":\"" + safeJson(nextPageCode)
                            + "\",\"menuUrl\":\"" + safeJson(normalizedUrl)
                            + "\"}");
            recordMenuPageDbChange(
                    request,
                    nextPageCode,
                    draftPageId,
                    "INSERT",
                    null,
                    loadExactPageManagementRow(codeId, nextPageCode));
            response.put("draftPageId", draftPageId);
            response.put("manifestRegistry", draftRegistry);
        } catch (Exception e) {
            log.error("Failed to create menu managed page. menuType={}, parentCode={}, menuUrl={}",
                    normalizedMenuType, normalizedParentCode, normalizedUrl, e);
            response.put("success", false);
            response.put("message", isEn
                    ? "Failed to create the page from menu management."
                    : "메뉴 관리에서 페이지를 생성하지 못했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }

        response.put("success", true);
        response.put("createdCode", nextPageCode);
        response.put("message", isEn
                ? "The page, menu metadata, and default VIEW feature have been created."
                : "페이지와 메뉴 메타데이터, 기본 VIEW 기능을 함께 생성했습니다.");
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Map<String, Object>> updateFullStackMenuVisibility(
            String menuType,
            String menuCode,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        String normalizedMenuCode = safeString(menuCode).toUpperCase(Locale.ROOT);
        String normalizedUseAt = normalizeUseAt(useAt);
        Map<String, Object> response = new LinkedHashMap<>();

        if (normalizedMenuCode.length() != 8) {
            response.put("success", false);
            response.put("message", isEn ? "Select a valid 8-digit page menu." : "유효한 8자리 페이지 메뉴를 선택하세요.");
            return ResponseEntity.badRequest().body(response);
        }

        MenuInfoDTO currentRow = adminMenuManagementPageService.loadMenuTreeRowsByMenuType(normalizedMenuType).stream()
                .filter(item -> normalizedMenuCode.equalsIgnoreCase(safeString(item.getCode())))
                .findFirst()
                .orElse(null);
        if (currentRow == null) {
            response.put("success", false);
            response.put("message", isEn ? "Menu code was not found in the selected scope." : "선택한 범위에서 메뉴 코드를 찾지 못했습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        PageManagementVO beforeRow = loadExactPageManagementRow(codeId, normalizedMenuCode);
        try {
            adminCodeManageService.updatePageManagement(
                    normalizedMenuCode,
                    safeString(currentRow.getCodeNm()),
                    safeString(currentRow.getCodeDc()),
                    safeString(currentRow.getMenuUrl()),
                    safeString(currentRow.getMenuIcon()),
                    normalizedUseAt,
                    resolveActorId(request));
            syncDefaultViewFeatureMetadata(normalizedMenuCode, normalizedUseAt, normalizedMenuType);
            recordMenuManagementAudit(
                    request,
                    normalizedMenuCode,
                    "ADMIN-FULL-STACK-MENU-VISIBILITY",
                    normalizedMenuCode,
                    "{\"beforeUseAt\":\"" + safeJson(currentRow.getUseAt()) + "\"}",
                    "{\"afterUseAt\":\"" + safeJson(normalizedUseAt) + "\"}");
            PageManagementVO afterRow = loadExactPageManagementRow(codeId, normalizedMenuCode);
            recordMenuPageDbChange(
                    request,
                    normalizedMenuCode,
                    buildManagedDraftPageId(afterRow == null ? safeString(currentRow.getMenuUrl()) : safeString(afterRow.getMenuUrl()), normalizedMenuCode),
                    "UPDATE",
                    beforeRow,
                    afterRow);
        } catch (Exception e) {
            log.error("Failed to update full-stack menu visibility. menuCode={}, useAt={}", normalizedMenuCode, normalizedUseAt, e);
            response.put("success", false);
            response.put("message", isEn ? "Failed to update menu visibility." : "메뉴 표시 상태 변경에 실패했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }

        response.put("success", true);
        response.put("message", "Y".equalsIgnoreCase(normalizedUseAt)
                ? (isEn ? "The menu is now visible." : "메뉴를 다시 보이도록 변경했습니다.")
                : (isEn ? "The menu is now hidden." : "메뉴를 숨김 처리했습니다."));
        return ResponseEntity.ok(response);
    }

    private String validateMenuOrderPayload(String menuType, String orderPayload, List<MenuInfoDTO> menuRows, boolean isEn) {
        if (safeString(orderPayload).isEmpty()) {
            return isEn ? "Menu order payload is empty." : "메뉴 순서 정보가 없습니다.";
        }
        java.util.Set<String> knownCodes = new java.util.LinkedHashSet<>();
        for (MenuInfoDTO row : menuRows) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (!code.isEmpty()) {
                knownCodes.add(code);
            }
        }
        java.util.Set<String> submittedCodes = new java.util.LinkedHashSet<>();
        for (String token : safeString(orderPayload).split(",")) {
            String[] parts = token.split(":");
            if (parts.length != 2) {
                return isEn ? "Invalid menu order payload." : "메뉴 순서 형식이 올바르지 않습니다.";
            }
            String code = safeString(parts[0]).toUpperCase(Locale.ROOT);
            String orderText = safeString(parts[1]);
            if (code.isEmpty() || !knownCodes.contains(code)) {
                return isEn ? "Unknown menu code exists in the request." : "알 수 없는 메뉴 코드가 포함되어 있습니다.";
            }
            if ("USER".equals(menuType) && !code.startsWith("H")) {
                return isEn ? "Home menu order can only include home menu codes." : "홈 메뉴 정렬에는 홈 메뉴 코드만 포함할 수 있습니다.";
            }
            if ("ADMIN".equals(menuType) && !code.startsWith("A")) {
                return isEn ? "Admin menu order can only include admin menu codes." : "관리자 메뉴 정렬에는 관리자 메뉴 코드만 포함할 수 있습니다.";
            }
            try {
                int order = Integer.parseInt(orderText);
                if (order < 1) {
                    return isEn ? "Menu order must start from 1." : "메뉴 순서는 1 이상이어야 합니다.";
                }
            } catch (NumberFormatException e) {
                return isEn ? "Menu order contains a non-numeric value." : "메뉴 순서에 숫자가 아닌 값이 포함되어 있습니다.";
            }
            submittedCodes.add(code);
        }
        if (!submittedCodes.containsAll(knownCodes) || submittedCodes.size() != knownCodes.size()) {
            return isEn ? "Some menu nodes are missing from the order payload." : "일부 메뉴 노드가 순서 저장 대상에서 누락되었습니다.";
        }
        return "";
    }

    private String validateMenuManagedPageInput(
            String menuType,
            String codeId,
            String parentCode,
            String codeNm,
            String codeDc,
            String menuUrl,
            boolean isEn) {
        if (parentCode.length() != 6) {
            return isEn ? "Please select a valid group menu." : "유효한 그룹 메뉴를 선택해 주세요.";
        }
        boolean parentExists = adminMenuManagementPageService.loadMenuTreeRowsByMenuType(menuType).stream()
                .map(MenuInfoDTO::getCode)
                .map(this::safeString)
                .map(value -> value.toUpperCase(Locale.ROOT))
                .anyMatch(parentCode::equals);
        if (!parentExists) {
            return isEn ? "The selected group menu does not exist." : "선택한 그룹 메뉴가 존재하지 않습니다.";
        }
        String generatedCode = resolveNextPageCode(menuType, parentCode);
        if (generatedCode.isEmpty()) {
            return isEn
                    ? "No more page codes are available under the selected group."
                    : "선택한 그룹 메뉴 아래에서 더 이상 사용할 페이지 코드를 만들 수 없습니다.";
        }
        String baseError = validatePageManagementInput(generatedCode, codeNm, codeDc, menuUrl, parentCode, menuType, isEn);
        if (!baseError.isEmpty()) {
            return baseError;
        }
        if (hasExistingManagedPageUrl(codeId, menuUrl)) {
            return isEn ? "The page URL is already registered." : "이미 등록된 페이지 URL입니다.";
        }
        return "";
    }

    private String validatePageManagementInput(
            String code,
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
            return isEn
                    ? "The page code must be 8 characters long."
                    : "페이지 코드는 8자리로 입력해 주세요.";
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

    private boolean hasExistingManagedPageUrl(String codeId, String menuUrl) {
        String normalizedUrl = canonicalMenuUrl(menuUrl);
        if (normalizedUrl.isEmpty()) {
            return false;
        }
        try {
            List<PageManagementVO> existingRows = adminCodeManageService.selectPageManagementList(codeId, null, normalizedUrl);
            for (PageManagementVO row : existingRows) {
                if (normalizedUrl.equalsIgnoreCase(safeString(row.getMenuUrl()))) {
                    return true;
                }
            }
        } catch (Exception e) {
            log.error("Failed to check existing managed page URL. codeId={}, menuUrl={}", codeId, normalizedUrl, e);
        }
        return false;
    }

    private String resolveNextPageCode(String menuType, String parentCode) {
        if (parentCode.length() != 6) {
            return "";
        }
        int maxSuffix = 0;
        for (MenuInfoDTO row : adminMenuManagementPageService.loadMenuTreeRowsByMenuType(menuType)) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (!code.startsWith(parentCode) || code.length() != 8) {
                continue;
            }
            int suffix = safeParseInt(code.substring(6));
            if (suffix > maxSuffix) {
                maxSuffix = suffix;
            }
        }
        if (maxSuffix >= 99) {
            return "";
        }
        return parentCode + String.format(Locale.ROOT, "%02d", maxSuffix + 1);
    }

    private int resolveNextSiblingSortOrder(String menuType, String parentCode) {
        int maxSortOrdr = 0;
        int siblingCount = 0;
        for (MenuInfoDTO row : adminMenuManagementPageService.loadMenuTreeRowsByMenuType(menuType)) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (!code.startsWith(parentCode) || code.length() != 8) {
                continue;
            }
            siblingCount++;
            maxSortOrdr = Math.max(maxSortOrdr, row.getSortOrdr() == null ? 0 : row.getSortOrdr());
        }
        return Math.max(maxSortOrdr, siblingCount) + 1;
    }

    private void ensureDefaultViewFeature(String pageCode, String pageNameKo, String pageNameEn, String useAt) throws Exception {
        String featureCode = buildDefaultViewFeatureCode(pageCode);
        if (featureCode.isEmpty()) {
            return;
        }
        if (menuFeatureManageService.countFeatureCode(featureCode) > 0) {
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

    private String buildDefaultViewFeatureCode(String pageCode) {
        String normalizedPageCode = safeString(pageCode).toUpperCase(Locale.ROOT);
        if (normalizedPageCode.isEmpty()) {
            return "";
        }
        return normalizedPageCode + "_VIEW";
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

    private void recordMenuManagementAudit(HttpServletRequest request,
                                           String menuCode,
                                           String actionCode,
                                           String entityId,
                                           String beforeSummaryJson,
                                           String afterSummaryJson) {
        try {
            auditTrailService.record(
                    resolveActorId(request),
                    resolveActorRole(request),
                    menuCode,
                    "menu-management",
                    actionCode,
                    "MENU_MANAGEMENT",
                    entityId,
                    "SUCCESS",
                    "",
                    beforeSummaryJson,
                    afterSummaryJson,
                    resolveRequestIp(request),
                    request == null ? "" : safeString(request.getHeader("User-Agent"))
            );
        } catch (Exception e) {
            log.warn("Failed to record menu-management audit. actionCode={}, entityId={}", actionCode, entityId, e);
        }
    }

    private void recordMenuPageDbChange(HttpServletRequest request,
                                        String menuCode,
                                        String pageId,
                                        String changeType,
                                        PageManagementVO before,
                                        PageManagementVO after) {
        try {
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode(menuCode);
            captureRequest.setPageId(pageId);
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(resolveActorId(request));
            captureRequest.setActorRole(resolveActorRole(request));
            captureRequest.setActorScopeId("");
            captureRequest.setTargetTableName("COMTNMENUINFO");
            captureRequest.setTargetPkJson("{\"menuCode\":\"" + safeJson(menuCode) + "\"}");
            captureRequest.setEntityType("PAGE_MENU");
            captureRequest.setEntityId(menuCode);
            captureRequest.setChangeType(changeType);
            captureRequest.setBeforeSummaryJson(writeJson(before));
            captureRequest.setAfterSummaryJson(writeJson(after));
            captureRequest.setChangeSummary(buildMenuPageChangeSummary(changeType, menuCode, before, after));
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("INSERT".equals(changeType) ? "ROW_INSERT" : "ROW_UPSERT");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson("{\"menuCode\":\"" + safeJson(menuCode) + "\"}");
            captureRequest.setPatchPayloadJson(writeJson(after));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("MEDIUM");
            captureRequest.setLogicalObjectId("COMTNMENUINFO:" + menuCode);
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture menu page DB change. menuCode={}, changeType={}", menuCode, changeType, e);
        }
    }

    private PageManagementVO loadExactPageManagementRow(String codeId, String code) {
        try {
            List<PageManagementVO> pageRows = adminCodeManageService.selectPageManagementList(codeId, code, null);
            for (PageManagementVO row : pageRows) {
                if (safeString(code).equalsIgnoreCase(safeString(row.getCode()))) {
                    return row;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load exact page management row. codeId={}, code={}", codeId, code, e);
        }
        return null;
    }

    private String buildMenuPageChangeSummary(String changeType, String menuCode, PageManagementVO before, PageManagementVO after) {
        String targetUrl = after == null ? safeString(before == null ? null : before.getMenuUrl()) : safeString(after.getMenuUrl());
        if ("INSERT".equals(changeType)) {
            return "Menu-managed page created: " + menuCode + " -> " + targetUrl;
        }
        String beforeUseAt = safeString(before == null ? null : before.getUseAt());
        String afterUseAt = safeString(after == null ? null : after.getUseAt());
        return "Menu-managed page updated: " + menuCode + " useAt " + beforeUseAt + " -> " + afterUseAt;
    }

    private String writeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize menu page DB capture payload.", e);
            return "";
        }
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

    private String resolveActorRole(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
                    String actorRole = value == null ? "" : value.toString();
                    if (!actorRole.isEmpty()) {
                        return actorRole;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(currentUserContextService.resolve(request).getAuthorCode());
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }
        return safeString(request.getRemoteAddr());
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

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String canonicalMenuUrl(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(normalized);
        return canonical.isEmpty() ? normalized : canonical;
    }

    private String buildManagedDraftPageId(String menuUrl, String menuCode) {
        String normalizedUrl = safeString(menuUrl).toLowerCase(Locale.ROOT);
        if (!normalizedUrl.isEmpty()) {
            String compact = normalizedUrl
                    .replaceFirst("^/en/", "/")
                    .replaceFirst("^/", "")
                    .replace('/', '-')
                    .replace('_', '-')
                    .replaceAll("[^a-z0-9\\-]", "")
                    .replaceAll("-{2,}", "-");
            if (!compact.isEmpty()) {
                return compact;
            }
        }
        return safeString(menuCode).toLowerCase(Locale.ROOT);
    }

    private int safeParseInt(String value) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String safeJson(String value) {
        return safeString(value).replace("\"", "'");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

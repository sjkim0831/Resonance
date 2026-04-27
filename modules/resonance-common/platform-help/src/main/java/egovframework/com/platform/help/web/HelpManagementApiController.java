package egovframework.com.platform.help.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.help.HelpContentService;
import egovframework.com.common.help.HelpManagementSaveRequest;
import egovframework.com.common.trace.UiManifestRegistryPort;
import egovframework.com.platform.service.audit.AuditTrailPort;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/help-management",
        "/en/api/platform/help-management",
        "/api/admin/help-management",
        "/en/api/admin/help-management",
        "/admin/api/platform/help-management",
        "/en/admin/api/platform/help-management",
        "/admin/api/admin/help-management",
        "/en/admin/api/admin/help-management"
})
public class HelpManagementApiController {

    private final HelpContentService helpContentService;
    private final AuditTrailPort auditTrailPort;
    private final ObjectProvider<Object> screenCommandCenterServiceProvider;
    private final UiManifestRegistryPort uiManifestRegistryPort;
    private final ObjectMapper objectMapper;

    @GetMapping("/page")
    public ResponseEntity<Map<String, Object>> getHelpPage(
            @RequestParam(value = "pageId", required = false) String pageId) {
        return ResponseEntity.ok(helpContentService.getPageHelpForAdmin(pageId));
    }

    @GetMapping("/screen-command/page")
    public ResponseEntity<Map<String, Object>> getScreenCommandPage(
            @RequestParam(value = "pageId", required = false) String pageId) throws Exception {
        return ResponseEntity.ok(invokeScreenCommandPage(pageId));
    }

    @PostMapping("/save")
    public ResponseEntity<Map<String, Object>> saveHelpPage(
            @RequestBody HelpManagementSaveRequest request,
            HttpServletRequest httpServletRequest) {
        Map<String, Object> beforeState = helpContentService.getPageHelpForAdmin(request == null ? "" : request.getPageId());
        helpContentService.savePageHelp(request);
        Map<String, Object> afterState = helpContentService.getPageHelpForAdmin(request == null ? "" : request.getPageId());
        auditTrailPort.record(
                resolveActorId(httpServletRequest),
                resolveActorRole(httpServletRequest),
                "A1900101",
                "help-management",
                "HELP_CONTENT_SAVE",
                "UI_HELP_PAGE",
                safe(request == null ? null : request.getPageId()),
                "SUCCESS",
                "Admin help content saved",
                safeJson(beforeState),
                safeJson(afterState),
                resolveRequestIp(httpServletRequest),
                httpServletRequest == null ? "" : safe(httpServletRequest.getHeader("User-Agent"))
        );
        return ResponseEntity.ok(successResponse(
                "도움말을 저장했습니다.",
                "pageId", request == null ? "" : safe(request.getPageId())));
    }

    @PostMapping("/screen-command/map-menu")
    public ResponseEntity<Map<String, Object>> saveScreenCommandMenuMapping(
            @RequestBody Map<String, Object> requestBody,
            HttpServletRequest httpServletRequest) throws Exception {
        String pageId = safe(asString(requestBody.get("pageId")));
        String menuCode = safe(asString(requestBody.get("menuCode"))).toUpperCase(Locale.ROOT);
        String menuName = safe(asString(requestBody.get("menuName")));
        String menuUrl = safe(asString(requestBody.get("menuUrl")));
        String domainCode = firstNonBlank(safe(asString(requestBody.get("domainCode"))), inferDomainCode(menuUrl, menuCode));
        if (pageId.isEmpty() || menuCode.isEmpty() || menuUrl.isEmpty()) {
            return ResponseEntity.badRequest().body(errorResponse("pageId, menuCode, menuUrl은 필수입니다."));
        }

        Map<String, Object> beforeState = invokeScreenCommandPage(pageId);
        Map<String, Object> page = safeMap(beforeState.get("page"));
        page.putAll(orderedMap(
                "pageId", pageId,
                "label", firstNonBlank(safe(asString(page.get("label"))), menuName, pageId),
                "routePath", menuUrl,
                "menuCode", menuCode,
                "domainCode", domainCode,
                "menuLookupUrl", menuUrl));
        Map<String, Object> registry = uiManifestRegistryPort.syncPageRegistry(page);
        Map<String, Object> afterState = invokeScreenCommandPage(pageId);

        auditTrailPort.record(
                resolveActorId(httpServletRequest),
                resolveActorRole(httpServletRequest),
                menuCode,
                "screen-menu-assignment-management",
                "SCREEN_MENU_MAPPING_SAVE",
                "UI_PAGE_MANIFEST",
                pageId,
                "SUCCESS",
                "Screen command page mapped to menu",
                safeJson(beforeState),
                safeJson(afterState),
                resolveRequestIp(httpServletRequest),
                httpServletRequest == null ? "" : safe(httpServletRequest.getHeader("User-Agent"))
        );
        return ResponseEntity.ok(successResponse(
                "메뉴 귀속을 저장했습니다.",
                "pageId", pageId,
                "menuCode", menuCode,
                "routePath", menuUrl,
                "manifestRegistry", registry));
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return "";
        }
        Object loginVO = session.getAttribute("LoginVO");
        if (loginVO == null) {
            return "";
        }
        try {
            Object value = loginVO.getClass().getMethod("getId").invoke(loginVO);
            return value == null ? "" : value.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveActorRole(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return "";
        }
        Object loginVO = session.getAttribute("LoginVO");
        if (loginVO == null) {
            return "";
        }
        try {
            Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
            return value == null ? "" : value.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safe(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int commaIndex = forwarded.indexOf(',');
            return commaIndex >= 0 ? forwarded.substring(0, commaIndex).trim() : forwarded;
        }
        return safe(request.getRemoteAddr());
    }

    private String safeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> safeMap(Object value) {
        if (value instanceof Map) {
            return new LinkedHashMap<>((Map<String, Object>) value);
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeScreenCommandPage(String pageId) throws Exception {
        Object service = screenCommandCenterServiceProvider.getIfAvailable();
        if (service == null) {
            return new LinkedHashMap<>();
        }
        Object response = service.getClass().getMethod("getScreenCommandPage", String.class).invoke(service, pageId);
        if (response instanceof Map) {
            return new LinkedHashMap<>((Map<String, Object>) response);
        }
        return new LinkedHashMap<>();
    }

    private Map<String, Object> successResponse(String message, Object... fields) {
        Map<String, Object> response = orderedMap(
                "success", true,
                "message", message);
        response.putAll(orderedMap(fields));
        return response;
    }

    private Map<String, Object> errorResponse(String message, Object... fields) {
        Map<String, Object> response = orderedMap(
                "success", false,
                "message", message);
        response.putAll(orderedMap(fields));
        return response;
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }

    private String inferDomainCode(String menuUrl, String menuCode) {
        String normalizedUrl = safe(menuUrl);
        String normalizedCode = safe(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedUrl.startsWith("/admin/") || normalizedUrl.startsWith("/en/admin/") || normalizedCode.startsWith("A")) {
            return "admin";
        }
        return "home";
    }
}

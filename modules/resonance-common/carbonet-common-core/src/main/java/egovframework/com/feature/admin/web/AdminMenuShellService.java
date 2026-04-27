package egovframework.com.feature.admin.web;

import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.home.web.ReactAppViewSupport;
import egovframework.com.platform.read.MenuInfoReadPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMenuShellService {

    private static final Logger log = LoggerFactory.getLogger(AdminMenuShellService.class);

    private final JwtTokenProvider jwtProvider;
    private final MenuInfoReadPort menuInfoReadPort;
    private final ObjectProvider<ReactAppViewSupport> reactAppViewSupportProvider;
    private final AdminReactRouteSupport adminReactRouteSupport;

    public Map<String, Object> buildMenuPlaceholderPayload(
            String requestPath,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        MenuInfoDTO menu = loadMenuByPath(requestPath);
        if (menu != null) {
            populateAdminFallbackPayload(payload, requestPath, isEn, menu);
        }
        return payload;
    }

    public String renderAdminFallback(HttpServletRequest request, Locale locale, Model model) {
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken)) {
            return resolveAdminLoginRedirect(request);
        }
        MenuInfoDTO menu = loadMenuByRequestPath(request);
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        if (menu != null) {
            return reactAppViewSupportProvider.getObject().render(model, "admin-menu-placeholder", isEn, true);
        }
        return reactAppViewSupportProvider.getObject().render(model, "admin-home", isEn, true);
    }

    public String resolveAdminLoginRedirect(HttpServletRequest request) {
        return "redirect:" + (adminReactRouteSupport.isEnglishRequest(request, null)
                ? "/en/admin/login/loginView"
                : "/admin/login/loginView");
    }

    private MenuInfoDTO loadMenuByRequestPath(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String requestUri = request.getRequestURI();
        if (ObjectUtils.isEmpty(requestUri)) {
            return null;
        }
        return loadMenuByPath(requestUri);
    }

    private MenuInfoDTO loadMenuByPath(String requestPath) {
        String normalized = safeString(requestPath);
        if (normalized.isEmpty()) {
            return null;
        }
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        if (normalized.startsWith("/en/")) {
            normalized = normalized.substring(3);
        }
        try {
            MenuInfoDTO menu = menuInfoReadPort.selectMenuDetailByUrl(normalized);
            if (menu == null || ObjectUtils.isEmpty(menu.getCode())) {
                return null;
            }
            return menu;
        } catch (Exception e) {
            log.error("Failed to load fallback admin menu. path={}", normalized, e);
            return null;
        }
    }

    private void populateAdminFallbackPayload(Map<String, Object> target, String requestPath, boolean isEn, MenuInfoDTO menu) {
        target.put("placeholderTitle", isEn ? fallbackLabel(menu.getCodeDc(), menu.getCodeNm()) : fallbackLabel(menu.getCodeNm(), menu.getCodeDc()));
        target.put("placeholderTitleEn", fallbackLabel(menu.getCodeDc(), menu.getCodeNm()));
        target.put("placeholderCode", safeString(menu.getCode()));
        target.put("placeholderUrl", safeString(requestPath));
        target.put("placeholderIcon", safeString(menu.getMenuIcon()).isEmpty() ? "web" : safeString(menu.getMenuIcon()));
    }

    private String fallbackLabel(String primary, String fallback) {
        String value = safeString(primary);
        return value.isEmpty() ? safeString(fallback) : value;
    }

    private String adminPrefix(HttpServletRequest request) {
        return adminReactRouteSupport.isEnglishRequest(request, null) ? "/en/admin" : "/admin";
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

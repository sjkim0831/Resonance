package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminSystemBuilderAccessService {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final CurrentUserContextService currentUserContextService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.isEnglishRequest(request, locale);
    }

    public String extractCurrentUserId(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        return safeString(context.getUserId());
    }

    public String resolveCurrentUserAuthorCode(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        return safeString(context.getAuthorCode());
    }

    public boolean hasGlobalAdminAccess(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        String userId = safeString(context.getUserId());
        String authorCode = safeString(context.getAuthorCode());
        return context.isWebmaster() || adminAuthorityPagePayloadSupport.hasGlobalDeptRoleAccess(userId, authorCode);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

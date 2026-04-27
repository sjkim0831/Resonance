package egovframework.com.feature.admin.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminRequestContextSupport {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final CurrentUserContextService currentUserContextService;

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.isEnglishRequest(request, locale);
    }

    public String extractCurrentUserId(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        return safeString(context.getUserId());
    }

    public void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

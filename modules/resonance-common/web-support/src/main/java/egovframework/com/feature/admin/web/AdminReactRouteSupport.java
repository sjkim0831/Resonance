package egovframework.com.feature.admin.web;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Component
public class AdminReactRouteSupport {

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        String uri = safe(request == null ? null : request.getRequestURI());
        if (uri.startsWith("/en/")) {
            return true;
        }
        String language = safe(request == null ? null : request.getParameter("language"));
        if ("en".equalsIgnoreCase(language)) {
            return true;
        }
        return locale != null && Locale.ENGLISH.getLanguage().equalsIgnoreCase(locale.getLanguage());
    }

    public String forwardAdminRoute(HttpServletRequest request, Locale locale, String route) {
        StringBuilder builder = new StringBuilder(adminAppRouteBase(request, locale, route));
        String query = safe(request == null ? null : request.getQueryString());
        if (!query.isEmpty()) {
            builder.append("&").append(query);
        }
        return builder.toString();
    }

    public String adminAppRouteBase(HttpServletRequest request, Locale locale, String route) {
        StringBuilder builder = new StringBuilder("forward:");
        builder.append(isEnglishRequest(request, locale) ? "/en/admin/app?route=" : "/admin/app?route=");
        builder.append(route == null ? "" : route.replace('-', '_'));
        return builder.toString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}

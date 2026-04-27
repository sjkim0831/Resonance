package egovframework.com.feature.home.web;

import egovframework.com.common.util.ReactPageUrlMapper;

import java.util.Locale;

final class ReactRouteSupport {

    private ReactRouteSupport() {
    }

    static String normalizeViewRoute(String route, boolean admin) {
        String normalized = route == null ? "" : route.trim();
        if (normalized.isEmpty()) {
            return admin ? "auth-group" : "mypage";
        }
        return normalized.replace('_', '-');
    }

    static String normalizeBootstrapRoute(String route) {
        return safe(route).replace('-', '_').toLowerCase(Locale.ROOT);
    }

    static String resolveBootstrapRoute(String route, String requestedPath, boolean admin) {
        String resolvedRoute = normalizeViewRoute(route, admin);
        String normalizedRequestedPath = safe(requestedPath);
        if ("/signin/findId/overseas".equals(normalizedRequestedPath) || "/en/signin/findId/overseas".equals(normalizedRequestedPath)) {
            return "signin_find_id";
        }
        if ("/signin/findPassword/overseas".equals(normalizedRequestedPath) || "/en/signin/findPassword/overseas".equals(normalizedRequestedPath)) {
            return "signin_find_password";
        }
        if (resolvedRoute.isEmpty() || "mypage".equals(resolvedRoute) || "auth-group".equals(resolvedRoute)) {
            String routeByPath = ReactPageUrlMapper.resolveRouteIdForPath(normalizedRequestedPath);
            if (!routeByPath.isBlank()) {
                return routeByPath;
            }
        }
        return resolvedRoute;
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}

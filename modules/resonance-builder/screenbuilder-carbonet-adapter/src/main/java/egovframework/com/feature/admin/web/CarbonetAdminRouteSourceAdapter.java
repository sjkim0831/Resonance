package egovframework.com.feature.admin.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

public class CarbonetAdminRouteSourceAdapter implements CarbonetAdminRouteSource {

    private final AdminReactRouteSupport adminReactRouteSupport;

    public CarbonetAdminRouteSourceAdapter(AdminReactRouteSupport adminReactRouteSupport) {
        this.adminReactRouteSupport = adminReactRouteSupport;
    }

    @Override
    public String forwardAdminRoute(HttpServletRequest request, Locale locale, String route) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, route);
    }
}

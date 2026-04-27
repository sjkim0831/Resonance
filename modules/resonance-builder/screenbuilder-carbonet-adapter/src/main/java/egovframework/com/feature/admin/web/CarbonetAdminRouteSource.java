package egovframework.com.feature.admin.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

public interface CarbonetAdminRouteSource {

    String forwardAdminRoute(HttpServletRequest request, Locale locale, String route);
}

package egovframework.com.platform.observability.web;

import egovframework.com.feature.admin.web.*;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.view.RedirectView;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminExternalConnectionController {

    private final AdminReactRouteSupport adminReactRouteSupport;

    @GetMapping("/external/connection_edit")
    public Object externalConnectionEditPage(HttpServletRequest request, Locale locale) {
        String query = request.getQueryString();
        if (query != null && query.contains("page-data")) {
            String scheme = request.getScheme();
            String serverName = request.getServerName();
            int serverPort = request.getServerPort();
            String contextPath = request.getContextPath();
            String url = scheme + "://" + serverName + (serverPort == 80 || serverPort == 443 ? "" : ":" + serverPort) + contextPath + "/admin/external/connection_edit/page-data";
            if (query != null && !query.isEmpty()) {
                url += "?" + query;
            }
            return new RedirectView(url);
        }
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "external-connection-edit");
    }

    @PostMapping("/external/connection_edit")
    public String externalConnectionEditPagePost(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "external-connection-edit");
    }
}

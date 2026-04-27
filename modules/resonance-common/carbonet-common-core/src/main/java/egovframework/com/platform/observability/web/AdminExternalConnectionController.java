package egovframework.com.platform.observability.web;

import egovframework.com.feature.admin.web.*;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminExternalConnectionController {

    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = "/external/connection_edit", method = { RequestMethod.GET, RequestMethod.POST })
    public String externalConnectionEditPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "external-connection-edit");
    }
}

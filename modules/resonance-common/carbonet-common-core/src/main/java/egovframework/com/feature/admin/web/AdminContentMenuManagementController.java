package egovframework.com.feature.admin.web;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequiredArgsConstructor
public class AdminContentMenuManagementController {

    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/menu"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String menuManagement(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "faq-menu-management");
    }

    @RequestMapping(value = {"/en/admin/content/menu"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String menuManagementEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "faq-menu-management");
    }
}

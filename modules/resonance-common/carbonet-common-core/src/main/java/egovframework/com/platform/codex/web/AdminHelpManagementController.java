package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.*;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminHelpManagementController {

    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = "/system/help-management", method = RequestMethod.GET)
    public String helpManagementPage(HttpServletRequest request, Locale locale, Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "help-management");
    }
}

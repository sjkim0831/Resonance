package egovframework.com.feature.admin.web;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminHomeController {

    private final JwtTokenProvider jwtProvider;
    private final AdminMenuShellService adminMenuShellService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = { "", "/" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String adminMainEntry(HttpServletRequest request, Locale locale) {
        String requestUri = safeString(request == null ? null : request.getRequestURI());
        if ("/admin/".equals(requestUri)) {
            return "redirect:/admin";
        }
        if ("/en/admin/".equals(requestUri)) {
            return "redirect:/en/admin";
        }
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken) || jwtProvider.accessValidateToken(accessToken) != 200) {
            return adminMenuShellService.resolveAdminLoginRedirect(request);
        }
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "admin-home");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

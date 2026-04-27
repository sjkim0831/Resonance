package egovframework.com.common.web;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.feature.home.web.ReactAppViewSupport;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * For unknown SPA routes, serve the shared React shell instead of a directly forwarded static
 * index.html so cache policy and asset versioning stay consistent across admin and app pages.
 */
@Controller
@RequiredArgsConstructor
public class SpaForwardingController {

    private final ReactAppViewSupport reactAppViewSupport;

    @RequestMapping(value = {
            "/",
            "/admin/**",
            "/en/admin/**",
            "/app/**",
            "/en/app/**"
    })
    public String forward(HttpServletRequest request, Model model) {
        String requestPath = request == null || request.getRequestURI() == null ? "/" : request.getRequestURI();
        boolean english = requestPath.startsWith("/en/");
        boolean admin = requestPath.equals("/admin")
                || requestPath.startsWith("/admin/")
                || requestPath.equals("/en/admin")
                || requestPath.startsWith("/en/admin/");
        String route = ReactPageUrlMapper.resolveRouteIdForPath(requestPath);
        if (route == null || route.isBlank()) {
            route = admin ? "admin-home" : "home";
        }
        return reactAppViewSupport.render(model, route, english, admin);
    }
}

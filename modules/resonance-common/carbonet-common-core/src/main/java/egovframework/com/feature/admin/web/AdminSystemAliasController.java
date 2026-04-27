package egovframework.com.feature.admin.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import jakarta.servlet.http.HttpServletRequest;

@Controller
public class AdminSystemAliasController {

    @GetMapping({
            "/system/unified_log",
            "/system/unified_log/trace",
            "/system/unified_log/page-events",
            "/system/unified_log/ui-actions",
            "/system/unified_log/api-trace",
            "/system/unified_log/ui-errors",
            "/system/unified_log/layout-render"
    })
    public String redirectUnifiedLogAliases(HttpServletRequest request) {
        String uri = request == null ? "/system/unified_log" : String.valueOf(request.getRequestURI());
        String query = request == null ? "" : request.getQueryString();
        String target = uri.startsWith("/admin/") ? uri : "/admin" + uri;
        if (query != null && !query.trim().isEmpty()) {
            target += "?" + query.trim();
        }
        return "redirect:" + target;
    }
}

package egovframework.com.platform.hermes.web;

import egovframework.com.platform.hermes.service.HermesWorkflowAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin/system/hermes-workflow", "/en/admin/system/hermes-workflow"})
@RequiredArgsConstructor
public class HermesWorkflowAdminController {

    private final HermesWorkflowAdminService hermesWorkflowAdminService;

    @GetMapping
    public String page(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale);
    }

    @GetMapping("/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> pageData(HttpServletRequest request,
                                                        Locale locale,
                                                        @RequestParam(value = "status", required = false) String status,
                                                        @RequestParam(value = "taskType", required = false) String taskType,
                                                        @RequestParam(value = "keyword", required = false) String keyword) {
        primeCsrfToken(request);
        return ResponseEntity.ok(hermesWorkflowAdminService.buildPage(status, taskType, keyword, isEnglishRequest(request, locale)));
    }

    private void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }

    private String redirectReactMigration(HttpServletRequest request, Locale locale) {
        StringBuilder builder = new StringBuilder("forward:");
        builder.append(isEnglishRequest(request, locale) ? "/en/admin/app?route=" : "/admin/app?route=");
        builder.append("hermes-workflow");
        if (request != null) {
            String query = request.getQueryString();
            if (query != null && !query.isBlank()) {
                builder.append("&").append(query);
            }
        }
        return builder.toString();
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }
}

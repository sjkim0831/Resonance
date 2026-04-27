package egovframework.com.feature.home.web;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateRequest;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateResponse;
import org.springframework.stereotype.Controller;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.view.RedirectView;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.csrf.CsrfToken;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Controller
@RequiredArgsConstructor
public class ReactAppPageController {
    private final ReactAppViewSupport reactAppViewSupport;
    private final ReactBootstrapRequestAdapter reactBootstrapRequestAdapter;

    private Object renderHomeShell(String route, Model model, boolean english) {
        String normalizedRoute = ReactRouteSupport.normalizeViewRoute(route, false);
        if ("mypage".equals(normalizedRoute)) {
            return new RedirectView(english ? "/en/mypage/profile" : "/mypage/profile");
        }
        if ("join-wizard".equals(normalizedRoute)) {
            return new RedirectView(english ? "/join/en/step1" : "/join/step1");
        }
        return reactAppViewSupport.render(model, normalizedRoute, english, false);
    }

    private String renderAdminShell(String route, Model model, boolean english) {
        return reactAppViewSupport.render(model, ReactRouteSupport.normalizeViewRoute(route, true), english, true);
    }

    @GetMapping("/app")
    public Object reactMigration(
            @RequestParam(value = "route", required = false, defaultValue = "mypage") String route,
            Model model) {
        return renderHomeShell(route, model, false);
    }

    @GetMapping("/en/app")
    public Object reactMigrationEn(
            @RequestParam(value = "route", required = false, defaultValue = "mypage") String route,
            Model model) {
        return renderHomeShell(route, model, true);
    }

    @GetMapping("/admin/app")
    public String adminReactMigration(
            @RequestParam(value = "route", required = false, defaultValue = "auth-group") String route,
            Model model) {
        return renderAdminShell(route, model, false);
    }

    @GetMapping("/en/admin/app")
    public String adminReactMigrationEn(
            @RequestParam(value = "route", required = false, defaultValue = "auth-group") String route,
            Model model) {
        return renderAdminShell(route, model, true);
    }

    @GetMapping({
            "/api/app/bootstrap",
            "/en/api/app/bootstrap",
            "/signin/api/app/bootstrap",
            "/en/signin/api/app/bootstrap"
    })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> appBootstrap(
            @RequestParam(value = "route", required = false) String route,
            @RequestParam(value = "path", required = false) String path,
            HttpServletRequest request) {
        return bootstrapResponse(buildBootstrapPayload(route, path, request, false));
    }

    @GetMapping({
            "/api/admin/app/bootstrap",
            "/en/api/admin/app/bootstrap",
            "/admin/api/admin/app/bootstrap",
            "/en/admin/api/admin/app/bootstrap",
            "/admin/login/api/app/bootstrap",
            "/en/admin/login/api/app/bootstrap"
    })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAppBootstrap(
            @RequestParam(value = "route", required = false) String route,
            @RequestParam(value = "path", required = false) String path,
            HttpServletRequest request) {
        return bootstrapResponse(buildBootstrapPayload(route, path, request, true));
    }

    private Map<String, Object> buildBootstrapPayload(String route, String path, HttpServletRequest request, boolean admin) {
        BootstrapGateResponse resolution = reactBootstrapRequestAdapter.resolve(
                new BootstrapGateRequest(
                        buildBootstrapGateContext(request, admin),
                        path,
                        route,
                        admin
                ),
                request == null ? null : request.getRequestURI()
        );

        Map<String, Object> payload = new LinkedHashMap<>(
                reactAppViewSupport.createBootstrapPayload(resolution.resolvedRoute(), isEnglishRequest(request), admin));
        if (request != null) {
            Object csrf = request.getAttribute("_csrf");
            if (csrf instanceof CsrfToken) {
                CsrfToken csrfToken = (CsrfToken) csrf;
                payload.put("csrfToken", csrfToken.getToken());
                payload.put("csrfHeaderName", csrfToken.getHeaderName());
            }
        }
        payload.put("executionGateVersion", resolution.executionGateVersion());
        payload.put("requestedPath", resolution.requestedPath());
        return payload;
    }

    private ExecutionGateRequestContext buildBootstrapGateContext(HttpServletRequest request, boolean admin) {
        return ExecutionGateRequestContext.of(
                null,
                GateActorScope.ANONYMOUS,
                admin ? GateRouteScope.PROJECT_ADMIN : GateRouteScope.HOME,
                "bootstrap.resolve",
                null,
                request == null ? null : request.getHeader("X-Trace-Id"),
                request == null ? null : request.getHeader("X-Request-Id")
        );
    }

    private ResponseEntity<Map<String, Object>> bootstrapResponse(Map<String, Object> payload) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore().mustRevalidate())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(payload);
    }

    private boolean isEnglishRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri != null && uri.startsWith("/en/");
    }
}

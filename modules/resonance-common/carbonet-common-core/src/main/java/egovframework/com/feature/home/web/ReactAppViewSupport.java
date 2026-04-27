package egovframework.com.feature.home.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ReactAppViewSupport {

    @Value("${carbonet.react-app.dev-url:http://127.0.0.1:5173}")
    private String reactAppDevUrl;
    private final ReactAppAssetResolver reactAppAssetResolver;
    private final ReactAppBootstrapService reactAppBootstrapService;

    public ReactAppViewSupport(ReactAppAssetResolver reactAppAssetResolver,
            ReactAppBootstrapService reactAppBootstrapService) {
        this.reactAppAssetResolver = reactAppAssetResolver;
        this.reactAppBootstrapService = reactAppBootstrapService;
    }

    public String render(Model model, String route, boolean en, boolean admin) {
        populate(model, route, en, admin, currentRequest());
        return "forward:/react-shell/index.html";
    }

    public void populate(Model model, String route, boolean en, boolean admin) {
        populate(model, route, en, admin, currentRequest());
    }

    public void populate(Model model, String route, boolean en, boolean admin, HttpServletRequest request) {
        applyNoStoreCacheHeaders(currentResponse());
        applyShellPayload(model, createBootstrapPayload(route, en, admin, request));
    }

    public Map<String, Object> createBootstrapPayload(String route, boolean en, boolean admin) {
        return createBootstrapPayload(route, en, admin, currentRequest());
    }

    public Map<String, Object> createBootstrapPayload(String route, boolean en, boolean admin, HttpServletRequest request) {
        ReactAppAssetResolver.ReactAppAssets assets = reactAppAssetResolver.resolveAssets();
        String jsPath = adaptAssetPath(assets.getJsPath(), admin, en);
        String cssPath = adaptAssetPath(assets.getCssPath(), admin, en);
        Map<String, Object> payload = createShellPayload(route, en, admin, jsPath, cssPath);
        payload.put("reactBootstrapPayload", reactAppBootstrapService.buildBootstrapPayload(route, en, admin, request));
        return payload;
    }

    private Map<String, Object> createShellPayload(String route,
                                                   boolean en,
                                                   boolean admin,
                                                   String jsPath,
                                                   String cssPath) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reactRoute", ReactRouteSupport.normalizeViewRoute(route, admin));
        payload.put("reactLocale", en ? "en" : "ko");
        payload.put("reactAdmin", admin);
        payload.put("reactShellTitle", admin
                ? (en ? "Admin React App" : "관리자 React 앱")
                : (en ? "Home React App" : "홈 React 앱"));
        payload.put("reactShellDescription", en
                ? "This page mounts the React app shell."
                : "이 페이지는 React 앱 셸을 마운트합니다.");
        payload.put("reactAppDevUrl", reactAppDevUrl);
        payload.put("reactAppProdJs", jsPath);
        payload.put("reactAppProdCss", cssPath);
        return payload;
    }

    private void applyShellPayload(Model model, Map<String, Object> payload) {
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            model.addAttribute(entry.getKey(), entry.getValue());
        }
    }

    private HttpServletRequest currentRequest() {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            return ((ServletRequestAttributes) requestAttributes).getRequest();
        }
        return null;
    }

    private HttpServletResponse currentResponse() {
        RequestAttributes requestAttributes = RequestContextHolder.getRequestAttributes();
        if (requestAttributes instanceof ServletRequestAttributes) {
            return ((ServletRequestAttributes) requestAttributes).getResponse();
        }
        return null;
    }

    private void applyNoStoreCacheHeaders(HttpServletResponse response) {
        if (response == null) {
            return;
        }
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        response.setDateHeader(HttpHeaders.EXPIRES, 0);
    }

    private String adaptAssetPath(String path, boolean admin, boolean en) {
        return path == null ? "" : path.trim();
    }
}

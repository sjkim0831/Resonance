package egovframework.com.feature.home.web;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Map;

@Controller
@RequiredArgsConstructor
public class SiteMapPageController {

    private final SiteMapPagePayloadService siteMapPagePayloadService;
    private final ReactAppViewSupport reactAppViewSupport;

    @RequestMapping(value = {"/sitemap", "/en/sitemap"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String sitemap(
            @CookieValue(value = "accessToken", required = false) String accessToken,
            jakarta.servlet.http.HttpServletRequest request,
            Model model) {
        return reactAppViewSupport.render(model, "sitemap", isEnglishRequest(request), false);
    }

    @GetMapping({"/api/sitemap", "/api/en/sitemap"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> sitemapApi(
            @CookieValue(value = "accessToken", required = false) String accessToken,
            jakarta.servlet.http.HttpServletRequest request) {
        return ResponseEntity.ok(siteMapPagePayloadService.buildUserPayload(isEnglishRequest(request), accessToken != null));
    }

    private boolean isEnglishRequest(jakarta.servlet.http.HttpServletRequest request) {
        String uri = request == null ? "" : request.getRequestURI();
        return uri != null && (uri.startsWith("/en/") || uri.startsWith("/api/en/"));
    }
}

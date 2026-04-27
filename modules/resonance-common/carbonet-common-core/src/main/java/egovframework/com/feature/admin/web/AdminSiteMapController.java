package egovframework.com.feature.admin.web;

import egovframework.com.feature.home.web.SiteMapPagePayloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminSiteMapController {

    private final SiteMapPagePayloadService siteMapPagePayloadService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/sitemap"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String sitemap(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "admin-sitemap");
    }

    @RequestMapping(value = {"/en/admin/content/sitemap"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String sitemapEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "admin-sitemap");
    }

    @GetMapping("/admin/api/admin/content/sitemap")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> sitemapApi(HttpServletRequest request) {
        return ResponseEntity.ok(siteMapPagePayloadService.buildAdminPayload(false, request));
    }

    @GetMapping("/en/admin/api/admin/content/sitemap")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> sitemapApiEn(HttpServletRequest request) {
        return ResponseEntity.ok(siteMapPagePayloadService.buildAdminPayload(true, request));
    }
}

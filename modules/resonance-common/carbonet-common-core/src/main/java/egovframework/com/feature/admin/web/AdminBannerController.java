package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.AdminBannerManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminBannerController {

    private final AdminBannerManagementService adminBannerManagementService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/banner_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String bannerList(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "banner-list");
    }

    @RequestMapping(value = {"/en/admin/content/banner_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String bannerListEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "banner-list");
    }

    @RequestMapping(value = {"/admin/content/banner_edit"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String bannerEdit(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "banner-edit");
    }

    @RequestMapping(value = {"/en/admin/content/banner_edit"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String bannerEditEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "banner-edit");
    }

    @GetMapping("/admin/api/admin/content/banner")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> bannerListApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "placement", required = false) String placement,
            @RequestParam(value = "selectedBannerId", required = false) String selectedBannerId) {
        return ResponseEntity.ok(adminBannerManagementService.buildListPayload(
                searchKeyword,
                status,
                placement,
                selectedBannerId,
                false));
    }

    @GetMapping("/en/admin/api/admin/content/banner")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> bannerListApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "placement", required = false) String placement,
            @RequestParam(value = "selectedBannerId", required = false) String selectedBannerId) {
        return ResponseEntity.ok(adminBannerManagementService.buildListPayload(
                searchKeyword,
                status,
                placement,
                selectedBannerId,
                true));
    }

    @GetMapping("/admin/api/admin/content/banner/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> bannerEditApi(
            @RequestParam(value = "bannerId", required = false) String bannerId) {
        return ResponseEntity.ok(adminBannerManagementService.buildEditPayload(bannerId, false));
    }

    @GetMapping("/en/admin/api/admin/content/banner/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> bannerEditApiEn(
            @RequestParam(value = "bannerId", required = false) String bannerId) {
        return ResponseEntity.ok(adminBannerManagementService.buildEditPayload(bannerId, true));
    }

    @PostMapping("/admin/api/admin/content/banner/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveBannerApi(
            @RequestParam(value = "bannerId", required = false) String bannerId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "targetUrl", required = false) String targetUrl,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "startAt", required = false) String startAt,
            @RequestParam(value = "endAt", required = false) String endAt) {
        return ResponseEntity.ok(adminBannerManagementService.saveBanner(
                bannerId,
                title,
                targetUrl,
                status,
                startAt,
                endAt,
                false));
    }

    @PostMapping("/en/admin/api/admin/content/banner/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveBannerApiEn(
            @RequestParam(value = "bannerId", required = false) String bannerId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "targetUrl", required = false) String targetUrl,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "startAt", required = false) String startAt,
            @RequestParam(value = "endAt", required = false) String endAt) {
        return ResponseEntity.ok(adminBannerManagementService.saveBanner(
                bannerId,
                title,
                targetUrl,
                status,
                startAt,
                endAt,
                true));
    }
}

package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.AdminTagManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminTagManagementController {

    private final AdminTagManagementService adminTagManagementService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/tag"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String tagManagement(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "tag-management");
    }

    @RequestMapping(value = {"/en/admin/content/tag"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String tagManagementEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "tag-management");
    }

    @GetMapping("/admin/api/admin/content/tag")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> tagManagementApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(adminTagManagementService.buildPagePayload(searchKeyword, status, false));
    }

    @GetMapping("/en/admin/api/admin/content/tag")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> tagManagementApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(adminTagManagementService.buildPagePayload(searchKeyword, status, true));
    }
}

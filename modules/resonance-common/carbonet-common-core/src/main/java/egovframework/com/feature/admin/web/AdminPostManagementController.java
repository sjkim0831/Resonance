package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.AdminPostManagementService;
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
public class AdminPostManagementController {

    private final AdminPostManagementService adminPostManagementService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/post_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String postManagement(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "post-list");
    }

    @RequestMapping(value = {"/en/admin/content/post_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String postManagementEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "post-list");
    }

    @GetMapping("/admin/api/admin/content/post")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> postManagementApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "selectedPostId", required = false) String selectedPostId) {
        return ResponseEntity.ok(adminPostManagementService.buildPagePayload(searchKeyword, status, category, selectedPostId, false));
    }

    @GetMapping("/en/admin/api/admin/content/post")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> postManagementApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "selectedPostId", required = false) String selectedPostId) {
        return ResponseEntity.ok(adminPostManagementService.buildPagePayload(searchKeyword, status, category, selectedPostId, true));
    }
}

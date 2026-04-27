package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminBoardDistributionSaveRequestDTO;
import egovframework.com.feature.admin.service.AdminBoardDistributionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminBoardController {

    private final AdminBoardDistributionService adminBoardDistributionService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/board_add"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String boardAdd(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "board-add");
    }

    @RequestMapping(value = {"/admin/content/board_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String boardList(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "board-list");
    }

    @RequestMapping(value = {"/en/admin/content/board_add"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String boardAddEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "board-add");
    }

    @RequestMapping(value = {"/en/admin/content/board_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String boardListEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "board-list");
    }

    @GetMapping("/admin/api/admin/content/board/list")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> boardListApi() {
        return ResponseEntity.ok(adminBoardDistributionService.buildListPayload(false));
    }

    @GetMapping("/en/admin/api/admin/content/board/list")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> boardListApiEn() {
        return ResponseEntity.ok(adminBoardDistributionService.buildListPayload(true));
    }

    @GetMapping("/admin/api/admin/content/board/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> boardAddApi() {
        return ResponseEntity.ok(adminBoardDistributionService.buildPagePayload(false));
    }

    @GetMapping("/en/admin/api/admin/content/board/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> boardAddApiEn() {
        return ResponseEntity.ok(adminBoardDistributionService.buildPagePayload(true));
    }

    @PostMapping("/admin/api/admin/content/board/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveBoardAddApi(@RequestBody AdminBoardDistributionSaveRequestDTO request,
                                                               HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(adminBoardDistributionService.saveDraft(request, resolveActorId(httpServletRequest), false));
    }

    @PostMapping("/en/admin/api/admin/content/board/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveBoardAddApiEn(@RequestBody AdminBoardDistributionSaveRequestDTO request,
                                                                 HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(adminBoardDistributionService.saveDraft(request, resolveActorId(httpServletRequest), true));
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return "";
        }
        Object loginVO = session.getAttribute("LoginVO");
        if (loginVO == null) {
            return "";
        }
        try {
            Object value = loginVO.getClass().getMethod("getId").invoke(loginVO);
            return value == null ? "" : value.toString();
        } catch (Exception ignored) {
            return "";
        }
    }
}

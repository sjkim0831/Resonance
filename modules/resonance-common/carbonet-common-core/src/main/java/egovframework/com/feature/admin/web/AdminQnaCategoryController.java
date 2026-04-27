package egovframework.com.feature.admin.web;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.admin.dto.request.AdminQnaCategorySaveRequestDTO;
import egovframework.com.feature.admin.service.AdminQnaCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminQnaCategoryController {

    private static final String MENU_CODE = "A0040302";

    private final AdminQnaCategoryService adminQnaCategoryService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AuditTrailService auditTrailService;

    @RequestMapping(value = {"/admin/content/qna"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String qnaCategory(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "qna-category");
    }

    @RequestMapping(value = {"/en/admin/content/qna"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String qnaCategoryEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "qna-category");
    }

    @GetMapping("/admin/api/admin/content/qna")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> qnaCategoryApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "channel", required = false) String channel,
            @RequestParam(value = "categoryId", required = false) String categoryId) {
        return ResponseEntity.ok(adminQnaCategoryService.buildPagePayload(searchKeyword, useAt, channel, categoryId, false));
    }

    @GetMapping("/en/admin/api/admin/content/qna")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> qnaCategoryApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "channel", required = false) String channel,
            @RequestParam(value = "categoryId", required = false) String categoryId) {
        return ResponseEntity.ok(adminQnaCategoryService.buildPagePayload(searchKeyword, useAt, channel, categoryId, true));
    }

    @PostMapping("/admin/api/admin/content/qna/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveQnaCategoryApi(@RequestBody AdminQnaCategorySaveRequestDTO request,
                                                                  HttpServletRequest httpServletRequest) {
        return save(request, httpServletRequest, false);
    }

    @PostMapping("/en/admin/api/admin/content/qna/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveQnaCategoryApiEn(@RequestBody AdminQnaCategorySaveRequestDTO request,
                                                                    HttpServletRequest httpServletRequest) {
        return save(request, httpServletRequest, true);
    }

    @PostMapping("/admin/api/admin/content/qna/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteQnaCategoryApi(@RequestBody Map<String, String> request,
                                                                    HttpServletRequest httpServletRequest) {
        return delete(request, httpServletRequest, false);
    }

    @PostMapping("/en/admin/api/admin/content/qna/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteQnaCategoryApiEn(@RequestBody Map<String, String> request,
                                                                      HttpServletRequest httpServletRequest) {
        return delete(request, httpServletRequest, true);
    }

    private ResponseEntity<Map<String, Object>> save(AdminQnaCategorySaveRequestDTO request,
                                                     HttpServletRequest httpServletRequest,
                                                     boolean isEn) {
        try {
            Map<String, Object> saved = adminQnaCategoryService.saveCategory(request, resolveActorId(httpServletRequest), isEn);
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    MENU_CODE,
                    "qna-category",
                    "QNA_CATEGORY_SAVE",
                    "QNA_CATEGORY",
                    safe(request == null ? null : request.getCategoryId()),
                    "SUCCESS",
                    isEn ? "Q&A category saved" : "Q&A 분류 저장",
                    "",
                    saved.toString(),
                    resolveRequestIp(httpServletRequest),
                    httpServletRequest == null ? "" : safe(httpServletRequest.getHeader("User-Agent"))
            );
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", safe(e.getMessage()));
            return ResponseEntity.badRequest().body(response);
        }
    }

    private ResponseEntity<Map<String, Object>> delete(Map<String, String> request,
                                                       HttpServletRequest httpServletRequest,
                                                       boolean isEn) {
        try {
            String categoryId = safe(request == null ? null : request.get("categoryId"));
            Map<String, Object> deleted = adminQnaCategoryService.deleteCategory(categoryId, isEn);
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    MENU_CODE,
                    "qna-category",
                    "QNA_CATEGORY_DELETE",
                    "QNA_CATEGORY",
                    categoryId,
                    "SUCCESS",
                    isEn ? "Q&A category deleted" : "Q&A 분류 삭제",
                    "",
                    deleted.toString(),
                    resolveRequestIp(httpServletRequest),
                    httpServletRequest == null ? "" : safe(httpServletRequest.getHeader("User-Agent"))
            );
            return ResponseEntity.ok(deleted);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", safe(e.getMessage()));
            return ResponseEntity.badRequest().body(response);
        }
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

    private String resolveActorRole(HttpServletRequest request) {
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
            Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
            return value == null ? "" : value.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safe(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int commaIndex = forwarded.indexOf(',');
            return commaIndex >= 0 ? forwarded.substring(0, commaIndex).trim() : forwarded;
        }
        return safe(request.getRemoteAddr());
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}

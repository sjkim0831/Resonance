package egovframework.com.feature.admin.web;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.admin.dto.request.AdminPopupEditSaveRequestDTO;
import egovframework.com.feature.admin.service.AdminPopupManagementService;
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
public class AdminPopupController {

    private static final String EDIT_MENU_CODE = "A0040204";

    private final AdminPopupManagementService adminPopupManagementService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AuditTrailService auditTrailService;

    @RequestMapping(value = {"/admin/content/popup_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String popupList(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "popup-list");
    }

    @RequestMapping(value = {"/en/admin/content/popup_list"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String popupListEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "popup-list");
    }

    @RequestMapping(value = {"/admin/content/popup_edit"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String popupEdit(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "popup-edit");
    }

    @RequestMapping(value = {"/en/admin/content/popup_edit"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String popupEditEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "popup-edit");
    }

    @GetMapping("/admin/api/admin/content/popup")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> popupListApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "targetAudience", required = false) String targetAudience,
            @RequestParam(value = "selectedPopupId", required = false) String selectedPopupId) {
        return ResponseEntity.ok(adminPopupManagementService.buildListPayload(searchKeyword, status, targetAudience, selectedPopupId, false));
    }

    @GetMapping("/en/admin/api/admin/content/popup")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> popupListApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "targetAudience", required = false) String targetAudience,
            @RequestParam(value = "selectedPopupId", required = false) String selectedPopupId) {
        return ResponseEntity.ok(adminPopupManagementService.buildListPayload(searchKeyword, status, targetAudience, selectedPopupId, true));
    }

    @GetMapping("/admin/api/admin/content/popup/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> popupEditApi(
            @RequestParam(value = "popupId", required = false) String popupId) {
        return ResponseEntity.ok(adminPopupManagementService.buildEditPayload(popupId, false));
    }

    @GetMapping("/en/admin/api/admin/content/popup/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> popupEditApiEn(
            @RequestParam(value = "popupId", required = false) String popupId) {
        return ResponseEntity.ok(adminPopupManagementService.buildEditPayload(popupId, true));
    }

    @PostMapping("/admin/api/admin/content/popup/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> savePopupApi(@RequestBody AdminPopupEditSaveRequestDTO request,
                                                            HttpServletRequest httpServletRequest) {
        return save(request, httpServletRequest, false);
    }

    @PostMapping("/en/admin/api/admin/content/popup/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> savePopupApiEn(@RequestBody AdminPopupEditSaveRequestDTO request,
                                                              HttpServletRequest httpServletRequest) {
        return save(request, httpServletRequest, true);
    }

    private ResponseEntity<Map<String, Object>> save(AdminPopupEditSaveRequestDTO request,
                                                     HttpServletRequest httpServletRequest,
                                                     boolean isEn) {
        try {
            Map<String, Object> saved = adminPopupManagementService.savePopup(request, resolveActorId(httpServletRequest), isEn);
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    EDIT_MENU_CODE,
                    "popup-edit",
                    "POPUP_SCHEDULE_SAVE",
                    "POPUP",
                    safe(request == null ? null : request.getPopupId()),
                    "SUCCESS",
                    isEn ? "Popup schedule saved" : "팝업 스케줄 저장",
                    "",
                    saved.toString(),
                    resolveRequestIp(httpServletRequest),
                    httpServletRequest == null ? "" : safe(httpServletRequest.getHeader("User-Agent"))
            );
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("saved", false);
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

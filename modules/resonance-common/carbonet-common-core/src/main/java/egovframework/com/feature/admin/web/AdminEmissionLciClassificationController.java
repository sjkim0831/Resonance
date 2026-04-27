package egovframework.com.feature.admin.web;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.admin.dto.request.AdminEmissionLciClassificationSaveRequestDTO;
import egovframework.com.feature.admin.service.AdminEmissionLciClassificationService;
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
@RequestMapping({"/admin/emission", "/en/admin/emission"})
@RequiredArgsConstructor
public class AdminEmissionLciClassificationController {

    private static final String MENU_CODE = "A0020111";

    private final AdminEmissionLciClassificationService adminEmissionLciClassificationService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AuditTrailService auditTrailService;

    @RequestMapping(value = "/lci-classification", method = RequestMethod.GET)
    public String emissionLciClassificationPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-lci-classification");
    }

    @GetMapping("/lci-classification/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionLciClassificationPageApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "level", required = false) String level,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "code", required = false) String code,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminEmissionLciClassificationService.buildPagePayload(
                searchKeyword,
                level,
                useAt,
                code,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @PostMapping("/api/lci-classification/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveEmissionLciClassification(
            @RequestBody AdminEmissionLciClassificationSaveRequestDTO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale);
        try {
            Map<String, Object> saved = adminEmissionLciClassificationService.save(request, resolveActorId(httpServletRequest), isEn);
            String savedCode = safe(String.valueOf(saved.getOrDefault("code", "")));
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    MENU_CODE,
                    "emission-lci-classification",
                    "EMISSION_LCI_CLASSIFICATION_SAVE",
                    "EMISSION_LCI_CLASSIFICATION",
                    savedCode,
                    "SUCCESS",
                    isEn ? "LCI classification saved" : "LCI 분류 저장",
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
        } catch (Exception e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn ? "Failed to save the LCI classification." : "LCI 분류 저장에 실패했습니다.");
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping("/api/lci-classification/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteEmissionLciClassification(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale);
        try {
            String code = safe(request == null ? null : request.get("code"));
            Map<String, Object> deleted = adminEmissionLciClassificationService.delete(code, isEn);
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    MENU_CODE,
                    "emission-lci-classification",
                    "EMISSION_LCI_CLASSIFICATION_DELETE",
                    "EMISSION_LCI_CLASSIFICATION",
                    code,
                    "SUCCESS",
                    isEn ? "LCI classification deleted" : "LCI 분류 삭제",
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
        } catch (Exception e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn ? "Failed to delete the LCI classification." : "LCI 분류 삭제에 실패했습니다.");
            return ResponseEntity.internalServerError().body(response);
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

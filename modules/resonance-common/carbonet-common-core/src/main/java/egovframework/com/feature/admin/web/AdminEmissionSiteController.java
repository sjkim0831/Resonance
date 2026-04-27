package egovframework.com.feature.admin.web;

import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;
import egovframework.com.feature.admin.service.AdminEmissionGwpValueService;
import egovframework.com.feature.admin.service.AdminEmissionManagementService;
import egovframework.com.feature.admin.service.AdminEmissionManagementElementRegistryService;
import egovframework.com.feature.admin.service.EmissionClassificationCatalogService;
import egovframework.com.feature.admin.dto.request.AdminEmissionGwpValueSaveRequestDTO;
import egovframework.com.common.audit.AuditTrailService;
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
public class AdminEmissionSiteController {

    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService;
    private final AdminEmissionGwpValueService adminEmissionGwpValueService;
    private final AdminEmissionManagementService adminEmissionManagementService;
    private final AdminEmissionManagementElementRegistryService adminEmissionManagementElementRegistryService;
    private final EmissionClassificationCatalogService emissionClassificationCatalogService;
    private final AuditTrailService auditTrailService;

    @RequestMapping(value = "/site-management", method = RequestMethod.GET)
    public String emissionSiteManagementPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-site-management");
    }

    @RequestMapping(value = "/management", method = RequestMethod.GET)
    public String emissionManagementPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-management");
    }

    @RequestMapping(value = "/definition-studio", method = RequestMethod.GET)
    public String emissionDefinitionStudioPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-definition-studio");
    }

    @RequestMapping(value = "/gwp-values", method = RequestMethod.GET)
    public String emissionGwpValuesPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-gwp-values");
    }

    @RequestMapping(value = "/survey-admin", method = { RequestMethod.GET, RequestMethod.POST })
    public String emissionSurveyAdminPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-survey-admin");
    }

    @RequestMapping(value = "/survey-admin-data", method = { RequestMethod.GET, RequestMethod.POST })
    public String emissionSurveyAdminDataPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-survey-admin-data");
    }

    @GetMapping("/management/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionManagementPageApi(HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0020107");
        payload.put("menuUrl", isEn ? "/en/admin/emission/management" : "/admin/emission/management");
        payload.put("pageTitle", "배출 변수 관리");
        payload.put("pageTitleEn", "Emission Variable Management");
        payload.put("pageDescription", "카테고리, Tier, 입력 세션, 계산 실행을 관리자 작업공간에서 직접 검증합니다.");
        payload.put("pageDescriptionEn", "Validate category, tier, input session, and calculation execution directly from the admin workspace.");
        payload.putAll(adminEmissionManagementElementRegistryService.buildRegistryPayload(isEn));
        payload.putAll(adminEmissionManagementService.getRolloutStatusSummary());
        payload.putAll(adminEmissionManagementService.getDefinitionScopeSummary());
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        Map<String, Object> definitionStudioPayload = adminEmissionDefinitionStudioService.buildPagePayload(isEn);
        payload.put("definitionDraftRows", definitionStudioPayload.get("definitionRows"));
        payload.put("definitionPolicyOptions", definitionStudioPayload.get("policyOptions"));
        payload.put("selectedDefinitionDraft", definitionStudioPayload.get("selectedDefinition"));
        payload.put("publishedDefinitionRows", adminEmissionDefinitionStudioService.buildPublishedDefinitionRows(isEn));
        payload.put("selectedPublishedDefinition", adminEmissionDefinitionStudioService.findLatestPublishedDefinition(isEn));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/definition-studio/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionDefinitionStudioPageApi(HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        Map<String, Object> payload = new LinkedHashMap<>(adminEmissionDefinitionStudioService.buildPagePayload(isEn));
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/gwp-values/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionGwpValuesPageApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sectionCode", required = false) String sectionCode,
            @RequestParam(value = "rowId", required = false) String rowId,
            @RequestParam(value = "pdfComparePolicy", required = false) String pdfComparePolicy,
            @RequestParam(value = "includePdfCompare", required = false) String includePdfCompare,
            @RequestParam(value = "pdfCompareScope", required = false) String pdfCompareScope,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        Map<String, Object> payload = new LinkedHashMap<>(adminEmissionGwpValueService.buildPagePayload(
                searchKeyword,
                sectionCode,
                rowId,
                pdfComparePolicy,
                parseBooleanParam(includePdfCompare),
                pdfCompareScope,
                isEn));
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/api/gwp-values/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveEmissionGwpValue(
            @RequestBody AdminEmissionGwpValueSaveRequestDTO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale);
        try {
            Map<String, Object> saved = adminEmissionGwpValueService.save(request, resolveActorId(httpServletRequest), isEn);
            String savedRowId = safe(String.valueOf(saved.getOrDefault("rowId", "")));
            String compareMismatchLabels = safe(String.valueOf(saved.getOrDefault("compareMismatchLabels", "")));
            String compareStatusLabel = safe(String.valueOf(saved.getOrDefault("compareStatusLabel", "")));
            String pdfCompareStatusLabel = safe(String.valueOf(saved.getOrDefault("pdfCompareStatusLabel", "")));
            String pdfComparePage = safe(String.valueOf(saved.getOrDefault("pdfComparePage", "")));
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    "A0020109",
                    "emission-gwp-values",
                    "EMISSION_GWP_SAVE",
                    "EMISSION_GWP_VALUE",
                    savedRowId,
                    "SUCCESS",
                    buildGwpSaveAuditReason(isEn, compareStatusLabel, compareMismatchLabels, pdfCompareStatusLabel, pdfComparePage),
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

    @PostMapping("/api/gwp-values/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteEmissionGwpValue(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale);
        try {
            String rowId = safe(request == null ? null : request.get("rowId"));
            Map<String, Object> deleted = adminEmissionGwpValueService.delete(rowId, isEn);
            auditTrailService.record(
                    resolveActorId(httpServletRequest),
                    resolveActorRole(httpServletRequest),
                    "A0020109",
                    "emission-gwp-values",
                    "EMISSION_GWP_DELETE",
                    "EMISSION_GWP_VALUE",
                    rowId,
                    "SUCCESS",
                    isEn ? "GWP value deleted" : "GWP 값 삭제",
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

    @GetMapping("/site-management/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionSiteManagementPageApi(HttpServletRequest request, Locale locale) {
        return ResponseEntity.ok(new LinkedHashMap<>(adminShellBootstrapPageService.buildEmissionSiteManagementPageData(
                adminReactRouteSupport.isEnglishRequest(request, locale))));
    }

    @RequestMapping(value = "/validate", method = RequestMethod.GET)
    public String emissionValidatePage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-validate");
    }

    @GetMapping("/validate/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionValidatePageApi(
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(new LinkedHashMap<>(adminShellBootstrapPageService.buildEmissionValidatePageData(
                request == null ? "" : request.getParameter("pageIndex"),
                request == null ? "" : request.getParameter("resultId"),
                request == null ? "" : request.getParameter("searchKeyword"),
                request == null ? "" : request.getParameter("verificationStatus"),
                request == null ? "" : request.getParameter("priorityFilter"),
                adminReactRouteSupport.isEnglishRequest(request, locale))));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean parseBooleanParam(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return false;
        }
        return "true".equals(normalized)
                || "1".equals(normalized)
                || "y".equals(normalized)
                || "yes".equals(normalized)
                || "on".equals(normalized);
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

    private String buildGwpSaveAuditReason(boolean isEn, String compareStatusLabel, String compareMismatchLabels, String pdfCompareStatusLabel, String pdfComparePage) {
        String base = isEn ? "GWP value saved" : "GWP 값 저장";
        String reason = base;
        if (!compareStatusLabel.isEmpty()) {
            reason = reason + " / " + compareStatusLabel;
        }
        if (!compareMismatchLabels.isEmpty()) {
            reason = reason + " / " + compareMismatchLabels;
        }
        if (!pdfCompareStatusLabel.isEmpty()) {
            reason = reason + " / " + pdfCompareStatusLabel + (pdfComparePage.isEmpty() ? "" : " p." + pdfComparePage);
        }
        return reason;
    }

}

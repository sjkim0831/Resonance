package egovframework.com.feature.admin.web;

import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminEmissionResultController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminEmissionResultPageModelAssembler adminEmissionResultPageModelAssembler;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;

    @RequestMapping(value = "/emission/result_list", method = { RequestMethod.GET, RequestMethod.POST })
    public String emissionResultListPage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "resultStatus", required = false) String resultStatus,
            @RequestParam(value = "verificationStatus", required = false) String verificationStatus,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-result-list");
    }

    @GetMapping("/emission/result_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionResultListPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "resultStatus", required = false) String resultStatus,
            @RequestParam(value = "verificationStatus", required = false) String verificationStatus,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        primeCsrfToken(request);
        ExtendedModelMap model = new ExtendedModelMap();
        adminEmissionResultPageModelAssembler.populateEmissionResultList(
                pageIndexParam,
                searchKeyword,
                resultStatus,
                verificationStatus,
                model,
                isEn);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.putAll(model);
        response.put("isEn", isEn);
        return ResponseEntity.ok(response);
    }

    @RequestMapping(value = "/emission/result_detail", method = { RequestMethod.GET, RequestMethod.POST })
    public String emissionResultDetailPage(
            @RequestParam(value = "resultId", required = false) String resultId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "emission-result-detail");
    }

    @GetMapping("/emission/result_detail/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> emissionResultDetailPageApi(
            @RequestParam(value = "resultId", required = false) String resultId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        primeCsrfToken(request);
        Map<String, Object> response = adminShellBootstrapPageService.buildEmissionResultDetailPageData(resultId, isEn);
        return Boolean.TRUE.equals(response.get("found"))
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(jakarta.servlet.http.HttpServletResponse.SC_NOT_FOUND).body(response);
    }

    private void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }
}

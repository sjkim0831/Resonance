package egovframework.com.feature.admin.web;

import egovframework.com.feature.member.service.MemberConsentHistoryService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminConsentHistoryController {
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final MemberConsentHistoryService memberConsentHistoryService;

    @GetMapping("/system/consent-history")
    public String page(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "consent-history");
    }

    @GetMapping("/system/consent-history/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> pageData(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "consentType", required = false) String consentType,
            @RequestParam(value = "agreed", required = false) String agreed) {
        return ResponseEntity.ok(memberConsentHistoryService.buildAdminPage(keyword, consentType, agreed));
    }
}


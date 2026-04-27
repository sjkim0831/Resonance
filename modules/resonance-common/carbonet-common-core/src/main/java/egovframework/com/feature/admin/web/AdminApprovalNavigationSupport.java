package egovframework.com.feature.admin.web;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminApprovalNavigationSupport {

    private final AdminRequestContextSupport adminRequestContextSupport;

    public String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    public String resolveMemberApprovalBasePath(HttpServletRequest request, Locale locale) {
        String requestUri = safeString(request == null ? null : request.getRequestURI());
        if (requestUri.endsWith("/member/company-approve")) {
            return adminPrefix(request, locale) + "/member/company-approve";
        }
        return adminPrefix(request, locale) + "/member/approve";
    }

    public String resolveMemberApprovalViewName(HttpServletRequest request, boolean isEn) {
        String requestUri = safeString(request == null ? null : request.getRequestURI());
        if (requestUri.endsWith("/member/company-approve")) {
            return isEn ? "egovframework/com/admin/company_approve_en" : "egovframework/com/admin/company_approve";
        }
        return isEn ? "egovframework/com/admin/member_approve_en" : "egovframework/com/admin/member_approve";
    }

    public void appendApprovalRedirectQuery(StringBuilder redirect, String name, String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return;
        }
        redirect.append('&').append(name).append('=').append(urlEncode(normalized));
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

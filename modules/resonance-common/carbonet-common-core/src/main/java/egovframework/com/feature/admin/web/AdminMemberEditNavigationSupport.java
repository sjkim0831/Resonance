package egovframework.com.feature.admin.web;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminMemberEditNavigationSupport {

    private final AdminRequestContextSupport adminRequestContextSupport;

    public String resolveViewName(boolean isEn) {
        return isEn ? "egovframework/com/admin/member_edit_en" : "egovframework/com/admin/member_edit";
    }

    public String resolveSuccessRedirect(HttpServletRequest request, Locale locale, String memberId) {
        return "redirect:" + adminPrefix(request, locale)
                + "/member/edit?memberId=" + urlEncode(memberId) + "&updated=true";
    }

    public String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    public String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

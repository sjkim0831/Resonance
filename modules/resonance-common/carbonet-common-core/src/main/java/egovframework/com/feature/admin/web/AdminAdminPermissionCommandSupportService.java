package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAdminPermissionCommandSupportService {

    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AuditTrailService auditTrailService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale, String language) {
        return adminRequestContextSupport.isEnglishRequest(request, locale)
                || "en".equalsIgnoreCase(safeString(language));
    }

    public String resolveViewName(boolean isEn) {
        return isEn
                ? "egovframework/com/admin/admin_account_en"
                : "egovframework/com/admin/admin_account";
    }

    public String resolveSuccessRedirect(HttpServletRequest request, Locale locale, String emplyrId) {
        return "redirect:" + adminPrefix(request, locale)
                + "/member/admin_account?emplyrId=" + urlEncode(emplyrId) + "&updated=true";
    }

    public void recordAdminPermissionAudit(HttpServletRequest request, String actorId, String emplyrId, String authorCode) {
        try {
            auditTrailService.record(
                    actorId,
                    adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(actorId),
                    "AMENU_ADMIN_PERMISSION",
                    "admin-permission",
                    "ADMIN_PERMISSION_SAVE",
                    "ADMIN",
                    emplyrId,
                    "SUCCESS",
                    "",
                    "{\"emplyrId\":\"" + safeJson(emplyrId) + "\",\"authorCode\":\"" + safeJson(authorCode) + "\"}",
                    "{\"status\":\"SUCCESS\"}",
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record admin permission audit. actorId={}, emplyrId={}", actorId, emplyrId, e);
        }
    }

    public String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    public String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeJson(String value) {
        return safeString(value).replace("\"", "'");
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return ClientIpUtil.getClientIp();
        }
        String forwarded = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int index = forwarded.indexOf(',');
            return index >= 0 ? forwarded.substring(0, index).trim() : forwarded;
        }
        String realIp = safeString(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
        }
        String remoteAddr = safeString(request.getRemoteAddr());
        return remoteAddr.isEmpty() ? ClientIpUtil.getClientIp() : remoteAddr;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }
}

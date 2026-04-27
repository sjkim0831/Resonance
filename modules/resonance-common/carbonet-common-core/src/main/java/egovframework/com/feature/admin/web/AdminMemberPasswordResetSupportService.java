package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminMemberPasswordResetSupportService {

    private final AuditTrailService auditTrailService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminCompanyAccountSupportService adminCompanyAccountSupportService;

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale);
    }

    public String extractCurrentUserId(HttpServletRequest request) {
        return adminRequestContextSupport.extractCurrentUserId(request);
    }

    public String safeString(String value) {
        return adminCompanyAccountSupportService.safeString(value);
    }

    public String resolveClientIp() {
        return safeString(ClientIpUtil.getClientIp());
    }

    public void recordMemberPasswordResetAudit(HttpServletRequest request, String actorId, String memberId) {
        try {
            auditTrailService.record(
                    actorId,
                    adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(actorId),
                    "AMENU_PASSWORD_RESET",
                    "password-reset",
                    "MEMBER_PASSWORD_RESET",
                    "MEMBER",
                    memberId,
                    "SUCCESS",
                    "",
                    "{\"memberId\":\"" + safeJson(memberId) + "\"}",
                    "{\"status\":\"SUCCESS\"}",
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record member password reset audit. actorId={}, memberId={}", actorId, memberId, e);
        }
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
}

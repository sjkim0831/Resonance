package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminMemberEditAuditSupport {

    private final AuditTrailService auditTrailService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public void recordMemberEditAudit(HttpServletRequest request, String actorId, String memberId, String authorCode) {
        try {
            auditTrailService.record(
                    actorId,
                    adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(actorId),
                    "AMENU_MEMBER_EDIT",
                    "member-edit",
                    "MEMBER_EDIT_SAVE",
                    "MEMBER",
                    memberId,
                    "SUCCESS",
                    "",
                    "{\"memberId\":\"" + safeJson(memberId) + "\",\"authorCode\":\"" + safeJson(authorCode) + "\"}",
                    "{\"status\":\"SUCCESS\"}",
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record member edit audit. actorId={}, memberId={}", actorId, memberId, e);
        }
    }

    private String safeJson(String value) {
        return value == null ? "" : value.trim().replace("\"", "'");
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return ClientIpUtil.getClientIp();
        }
        String forwarded = safe(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int index = forwarded.indexOf(',');
            return index >= 0 ? forwarded.substring(0, index).trim() : forwarded;
        }
        String realIp = safe(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
        }
        String remoteAddr = safe(request.getRemoteAddr());
        return remoteAddr.isEmpty() ? ClientIpUtil.getClientIp() : remoteAddr;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}

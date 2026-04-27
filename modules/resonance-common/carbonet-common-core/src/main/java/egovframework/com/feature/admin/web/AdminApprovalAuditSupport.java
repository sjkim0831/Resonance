package egovframework.com.feature.admin.web;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;

@Service
@RequiredArgsConstructor
public class AdminApprovalAuditSupport {

    private static final Logger log = LoggerFactory.getLogger(AdminApprovalAuditSupport.class);

    private final AuditTrailService auditTrailService;

    public void recordApprovalAuditSafely(
            HttpServletRequest request,
            String actorId,
            String actorRole,
            String menuCode,
            String pageId,
            String actionCode,
            String entityType,
            String entityId,
            String resultStatus,
            String beforeSummaryJson,
            String afterSummaryJson) {
        try {
            auditTrailService.record(
                    actorId,
                    actorRole,
                    menuCode,
                    pageId,
                    actionCode,
                    entityType,
                    entityId,
                    resultStatus,
                    "",
                    beforeSummaryJson,
                    afterSummaryJson,
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record approval audit. actorId={}, actionCode={}, entityId={}", actorId, actionCode, entityId, e);
        }
    }

    public String safeJson(String value) {
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

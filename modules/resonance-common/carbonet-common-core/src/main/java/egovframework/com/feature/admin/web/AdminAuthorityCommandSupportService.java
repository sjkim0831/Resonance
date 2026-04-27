package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.platform.governance.model.vo.AuthorRoleProfileVO;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuthorityCommandSupportService {

    private final AuditTrailService auditTrailService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public String extractCurrentUserId(HttpServletRequest request) {
        return adminRequestContextSupport.extractCurrentUserId(request);
    }

    public String resolveCurrentUserAuthorCode(String currentUserId) {
        return adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
    }

    public String safeString(String value) {
        return adminAuthorityPagePayloadSupport.safeValue(value);
    }

    public String safeJson(String value) {
        return safeString(value).replace("\"", "'");
    }

    public Map<String, String> buildAuthorSummary(String authorCode) {
        return adminAuthorityPagePayloadSupport.buildAuthorSummary(authorCode);
    }

    public Map<String, Object> toAuthorRoleProfileMap(AuthorRoleProfileVO profile) {
        return adminAuthorityPagePayloadSupport.toAuthorRoleProfileMap(profile);
    }

    public String buildAuthChangeRedirectUrl(HttpServletRequest request, Locale locale, String emplyrId, String errorCode) {
        StringBuilder redirect = new StringBuilder(adminPrefix(request, locale)).append("/member/auth-change");
        redirect.append("?targetUserId=").append(urlEncode(emplyrId));
        String normalizedErrorCode = safeString(errorCode);
        if (!normalizedErrorCode.isEmpty()) {
            redirect.append("&error=").append(urlEncode(normalizedErrorCode));
        }
        return redirect.toString();
    }

    public String buildDeptRoleRedirectUrl(HttpServletRequest request, Locale locale, String insttId, String errorCode) {
        StringBuilder redirect = new StringBuilder(adminPrefix(request, locale)).append("/member/dept-role-mapping");
        redirect.append("?insttId=").append(urlEncode(insttId));
        String normalizedErrorCode = safeString(errorCode);
        if (!normalizedErrorCode.isEmpty()) {
            redirect.append("&error=").append(urlEncode(normalizedErrorCode));
        }
        return redirect.toString();
    }

    public String buildAuthGroupRedirectUrl(HttpServletRequest request, Locale locale, String authorCode, String roleCategory) {
        return buildAuthGroupRedirectUrl(request, locale, authorCode, roleCategory, null);
    }

    public String buildAuthGroupRedirectUrl(HttpServletRequest request, Locale locale, String authorCode, String roleCategory, String insttId) {
        StringBuilder redirect = new StringBuilder(adminPrefix(request, locale)).append("/member/auth-group");
        boolean hasQuery = false;
        String normalizedAuthorCode = safeString(authorCode);
        if (!normalizedAuthorCode.isEmpty()) {
            redirect.append(hasQuery ? '&' : '?').append("authorCode=").append(urlEncode(normalizedAuthorCode));
            hasQuery = true;
        }
        String normalizedRoleCategory = safeString(roleCategory);
        if (!normalizedRoleCategory.isEmpty()) {
            redirect.append(hasQuery ? '&' : '?').append("roleCategory=").append(urlEncode(normalizedRoleCategory));
            hasQuery = true;
        }
        String normalizedInsttId = safeString(insttId);
        if (!normalizedInsttId.isEmpty()) {
            redirect.append(hasQuery ? '&' : '?').append("insttId=").append(urlEncode(normalizedInsttId));
        }
        return redirect.toString();
    }

    public void recordAdminActionAudit(
            HttpServletRequest request,
            String actorId,
            String actorRole,
            String menuCode,
            String pageId,
            String actionCode,
            String entityType,
            String entityId,
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
                    "SUCCESS",
                    "",
                    beforeSummaryJson,
                    afterSummaryJson,
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record authority admin action audit. actorId={}, actionCode={}, entityId={}", actorId, actionCode, entityId, e);
        }
    }

    public void recordAdminRoleAssignmentAudit(
            HttpServletRequest request,
            String actorId,
            String actorRole,
            String emplyrId,
            Map<String, String> beforeRole,
            Map<String, String> afterRole) {
        Map<String, Object> beforeSummary = new LinkedHashMap<>();
        beforeSummary.put("emplyrId", emplyrId);
        beforeSummary.put("beforeAuthorCode", safeString(beforeRole == null ? null : beforeRole.get("authorCode")));
        beforeSummary.put("beforeAuthorName", safeString(beforeRole == null ? null : beforeRole.get("authorNm")));
        Map<String, Object> afterSummary = new LinkedHashMap<>();
        afterSummary.put("emplyrId", emplyrId);
        afterSummary.put("afterAuthorCode", safeString(afterRole == null ? null : afterRole.get("authorCode")));
        afterSummary.put("afterAuthorName", safeString(afterRole == null ? null : afterRole.get("authorNm")));
        recordAdminActionAudit(
                request,
                actorId,
                actorRole,
                "AMENU_AUTH_CHANGE",
                "auth-change",
                "AUTH_CHANGE_SAVE",
                "EMPLOYEE",
                emplyrId,
                toJsonLike(beforeSummary),
                toJsonLike(afterSummary));
    }

    public String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String toJsonLike(Map<String, Object> values) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(safeJson(entry.getKey())).append('"')
                    .append(':')
                    .append('"').append(safeJson(entry.getValue() == null ? null : String.valueOf(entry.getValue()))).append('"');
        }
        sb.append('}');
        return sb.toString();
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

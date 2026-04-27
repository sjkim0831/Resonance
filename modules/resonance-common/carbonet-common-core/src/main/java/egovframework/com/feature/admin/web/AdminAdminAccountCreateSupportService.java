package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAdminAccountCreateSupportService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final AuthGroupManageService authGroupManageService;
    private final AuditTrailService auditTrailService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public String resolveAdminPresetAuthorCode(String rolePreset) {
        return safeString(defaultAdminPresetAuthorCodes().get(safeString(rolePreset).toUpperCase(Locale.ROOT)));
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = safeString(featureCode).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
    }

    public List<String> loadAuthorFeatureCodes(String authorCode) throws Exception {
        return normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode));
    }

    public Set<String> resolveGrantableFeatureCodeSet(String currentUserId) throws Exception {
        return adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(
                currentUserId,
                "webmaster".equalsIgnoreCase(safeString(currentUserId)));
    }

    public void recordAdminAccountCreateAudit(
            HttpServletRequest request,
            String actorId,
            String adminId,
            String authorCode,
            String insttId) {
        try {
            auditTrailService.record(
                    actorId,
                    adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(actorId),
                    "AMENU_ADMIN_CREATE",
                    "admin-create",
                    "ADMIN_ACCOUNT_CREATE",
                    "ADMIN",
                    adminId,
                    "SUCCESS",
                    "",
                    "{\"adminId\":\"" + safeJson(adminId) + "\",\"authorCode\":\"" + safeJson(authorCode) + "\",\"insttId\":\"" + safeJson(insttId) + "\"}",
                    "{\"status\":\"SUCCESS\"}",
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record admin account create audit. actorId={}, adminId={}", actorId, adminId, e);
        }
    }

    public String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private Map<String, String> defaultAdminPresetAuthorCodes() {
        Map<String, String> presetAuthorCodes = new java.util.LinkedHashMap<>();
        presetAuthorCodes.put("MASTER", ROLE_SYSTEM_MASTER);
        presetAuthorCodes.put("SYSTEM", ROLE_SYSTEM_ADMIN);
        presetAuthorCodes.put("OPERATION", ROLE_OPERATION_ADMIN);
        presetAuthorCodes.put("GENERAL", ROLE_ADMIN);
        return presetAuthorCodes;
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

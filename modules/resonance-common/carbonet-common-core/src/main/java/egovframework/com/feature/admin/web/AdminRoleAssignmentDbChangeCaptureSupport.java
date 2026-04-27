package egovframework.com.feature.admin.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminRoleAssignmentDbChangeCaptureSupport {

    private static final Logger log = LoggerFactory.getLogger(AdminRoleAssignmentDbChangeCaptureSupport.class);

    private final DbChangeCaptureService dbChangeCaptureService;
    private final ObjectMapper objectMapper;

    public void captureAdminRoleAssignment(HttpServletRequest request,
                                           String actorId,
                                           String actorRole,
                                           String actorScopeId,
                                           String targetUserId,
                                           Map<String, ?> beforeSummary,
                                           Map<String, ?> afterSummary,
                                           String menuCode,
                                           String pageId) {
        try {
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode(safeString(menuCode));
            captureRequest.setPageId(safeString(pageId));
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(safeString(actorId));
            captureRequest.setActorRole(safeString(actorRole));
            captureRequest.setActorScopeId(safeString(actorScopeId));
            captureRequest.setTargetTableName("COMTNEMPLYRSCRTYESTBS");
            captureRequest.setTargetPkJson(writeJson(singleKeyMap("userId", targetUserId)));
            captureRequest.setEntityType("ADMIN_ROLE_ASSIGNMENT");
            captureRequest.setEntityId(safeString(targetUserId));
            captureRequest.setChangeType(isEmpty(beforeSummary) ? "INSERT" : "UPDATE");
            captureRequest.setBeforeSummaryJson(writeJson(beforeSummary));
            captureRequest.setAfterSummaryJson(writeJson(afterSummary));
            captureRequest.setChangeSummary(buildAdminRoleAssignmentSummary(targetUserId, beforeSummary, afterSummary));
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("UPSERT_BY_SECURITY_TARGET");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson(writeJson(singleKeyMap("userId", targetUserId)));
            captureRequest.setPatchPayloadJson(writeJson(afterSummary));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("CRITICAL");
            captureRequest.setLogicalObjectId("COMTNEMPLYRSCRTYESTBS:" + safeString(targetUserId));
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture admin role assignment DB change. targetUserId={}", targetUserId, e);
        }
    }

    public void captureEnterpriseUserRoleAssignment(HttpServletRequest request,
                                                    String actorId,
                                                    String actorRole,
                                                    String actorScopeId,
                                                    String insttId,
                                                    String userId,
                                                    UserAuthorityTargetVO before,
                                                    UserAuthorityTargetVO after,
                                                    String menuCode,
                                                    String pageId) {
        try {
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode(safeString(menuCode));
            captureRequest.setPageId(safeString(pageId));
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(safeString(actorId));
            captureRequest.setActorRole(safeString(actorRole));
            captureRequest.setActorScopeId(safeString(actorScopeId));
            captureRequest.setTargetTableName("COMTNEMPLYRSCRTYESTBS");
            captureRequest.setTargetPkJson(writeJson(singleKeyMap("userId", userId)));
            captureRequest.setEntityType("ENTERPRISE_USER_ROLE_ASSIGNMENT");
            captureRequest.setEntityId(safeString(userId));
            captureRequest.setChangeType(before == null ? "INSERT" : "UPDATE");
            captureRequest.setBeforeSummaryJson(writeJson(before));
            captureRequest.setAfterSummaryJson(writeJson(after));
            captureRequest.setChangeSummary(buildEnterpriseUserRoleAssignmentSummary(insttId, userId, before, after));
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("UPSERT_BY_SECURITY_TARGET");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson(writeJson(singleKeyMap("userId", userId)));
            captureRequest.setPatchPayloadJson(writeJson(after));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("CRITICAL");
            captureRequest.setLogicalObjectId("COMTNEMPLYRSCRTYESTBS:" + safeString(userId));
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture enterprise user role assignment DB change. userId={}", userId, e);
        }
    }

    private String buildAdminRoleAssignmentSummary(String targetUserId,
                                                   Map<String, ?> beforeSummary,
                                                   Map<String, ?> afterSummary) {
        String beforeAuthorCode = valueFromMap(beforeSummary, "authorCode");
        String afterAuthorCode = valueFromMap(afterSummary, "authorCode");
        if (beforeAuthorCode.isEmpty()) {
            return "Administrator role assigned: " + targetUserId + " -> " + afterAuthorCode;
        }
        return "Administrator role updated: " + targetUserId + " " + beforeAuthorCode + " -> " + afterAuthorCode;
    }

    private String buildEnterpriseUserRoleAssignmentSummary(String insttId,
                                                            String userId,
                                                            UserAuthorityTargetVO before,
                                                            UserAuthorityTargetVO after) {
        String beforeAuthorCode = before == null ? "" : safeString(before.getAuthorCode());
        String afterAuthorCode = after == null ? "" : safeString(after.getAuthorCode());
        if (beforeAuthorCode.isEmpty()) {
            return "Enterprise user role assigned: " + insttId + "/" + userId + " -> " + afterAuthorCode;
        }
        return "Enterprise user role updated: " + insttId + "/" + userId + " " + beforeAuthorCode + " -> " + afterAuthorCode;
    }

    private Map<String, String> singleKeyMap(String key, String value) {
        Map<String, String> map = new HashMap<>();
        map.put(key, safeString(value));
        return map;
    }

    private String valueFromMap(Map<String, ?> map, String key) {
        if (map == null || map.isEmpty()) {
            return "";
        }
        Object value = map.get(key);
        return value == null ? "" : safeString(String.valueOf(value));
    }

    private boolean isEmpty(Map<String, ?> map) {
        return map == null || map.isEmpty();
    }

    private String writeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize role assignment DB capture payload.", e);
            return "";
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

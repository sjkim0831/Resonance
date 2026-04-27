package egovframework.com.platform.dbchange.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.platform.dbchange.mapper.DbChangeCaptureMapper;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class DbChangeCaptureServiceImpl implements DbChangeCaptureService {

    private final DbChangeCaptureMapper dbChangeCaptureMapper;
    private final ObjectMapper objectMapper;

    public DbChangeCaptureServiceImpl(DbChangeCaptureMapper dbChangeCaptureMapper, ObjectMapper objectMapper) {
        this.dbChangeCaptureMapper = dbChangeCaptureMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public void captureChange(DbChangeCaptureRequest request) {
        if (request == null || safe(request.getTargetTableName()).isEmpty() || safe(request.getChangeType()).isEmpty()) {
            return;
        }
        try {
            String changeLogId = "bcl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
            Map<String, Object> policy = loadPromotionPolicy(request.getTargetTableName());
            String policyCode = safe(policy.get("policyCode"));
            if (policyCode.isEmpty()) {
                policyCode = "BLOCKED";
            }
            String queueDecisionCode = resolveQueueDecisionCode(policyCode);
            String queueId = "";
            if ("AUTO_QUEUE".equals(policyCode)) {
                queueId = createQueue(request, policyCode, changeLogId);
                queueDecisionCode = queueId.isEmpty() ? "QUEUE_FAILED" : "AUTO_QUEUED";
            }

            TraceContext traceContext = TraceContextHolder.get();
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("changeLogId", changeLogId);
            params.put("traceId", traceContext == null ? "" : safe(traceContext.getTraceId()));
            params.put("requestId", traceContext == null ? "" : safe(traceContext.getRequestId()));
            params.put("projectId", defaultIfBlank(request.getProjectId(), "carbonet"));
            params.put("menuCode", safe(request.getMenuCode()));
            params.put("pageId", safe(request.getPageId()));
            params.put("apiPath", safe(request.getApiPath()));
            params.put("httpMethod", safe(request.getHttpMethod()));
            params.put("actorId", defaultIfBlank(request.getActorId(), "system"));
            params.put("actorRole", safe(request.getActorRole()));
            params.put("actorScopeId", safe(request.getActorScopeId()));
            params.put("targetTableName", safe(request.getTargetTableName()).toUpperCase(Locale.ROOT));
            params.put("targetPkJson", buildTargetPkJson(request));
            params.put("entityType", safe(request.getEntityType()));
            params.put("entityId", resolveLogicalObjectId(request));
            params.put("changeType", safe(request.getChangeType()).toUpperCase(Locale.ROOT));
            params.put("beforeSummaryJson", safe(request.getBeforeSummaryJson()));
            params.put("afterSummaryJson", safe(request.getAfterSummaryJson()));
            params.put("changeSummary", safe(request.getChangeSummary()));
            params.put("promotionPolicyCode", policyCode);
            params.put("queueDecisionCode", queueDecisionCode);
            params.put("queueRequestedYn", queueId.isEmpty() ? "N" : "Y");
            params.put("queueId", queueId);
            params.put("approvalRequiredYn", "MANUAL_APPROVAL".equals(policyCode) ? "Y" : "N");
            params.put("approvalStatus", initialApprovalStatus(policyCode, queueId));
            dbChangeCaptureMapper.insertBusinessChangeLog(params);
        } catch (Exception e) {
            log.warn("Failed to capture business change log. table={}, entityId={}",
                    safe(request.getTargetTableName()), safe(request.getEntityId()), e);
        }
    }

    private Map<String, Object> loadPromotionPolicy(String tableName) {
        try {
            Map<String, Object> policy = dbChangeCaptureMapper.selectPromotionPolicyByTableName(
                    safe(tableName).toUpperCase(Locale.ROOT));
            return policy == null ? new LinkedHashMap<String, Object>() : policy;
        } catch (Exception e) {
            log.debug("Promotion policy lookup failed. table={}", tableName, e);
            return new LinkedHashMap<String, Object>();
        }
    }

    private String createQueue(DbChangeCaptureRequest request, String policyCode, String changeLogId) {
        try {
            String queueId = "dbq-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("queueId", queueId);
            params.put("projectId", defaultIfBlank(request.getProjectId(), "carbonet"));
            params.put("sourceChangeIdsJson", jsonArrayOf(changeLogId));
            params.put("targetEnv", defaultIfBlank(request.getTargetEnv(), "REMOTE_MAIN"));
            params.put("patchFormatCode", defaultIfBlank(request.getPatchFormatCode(), "JSON_PATCH"));
            params.put("patchKindCode", defaultIfBlank(request.getPatchKindCode(), "UPSERT_BY_KEY"));
            params.put("targetTableName", safe(request.getTargetTableName()).toUpperCase(Locale.ROOT));
            params.put("targetKeysJson", buildTargetPkJson(request));
            params.put("patchPayloadJson", buildPatchPayloadJson(request));
            params.put("renderedSqlPreview", safe(request.getRenderedSqlPreview()));
            params.put("checksumSha256", sha256(
                    safe(request.getTargetTableName()) + "|" + buildTargetPkJson(request) + "|" + buildPatchPayloadJson(request)));
            params.put("riskLevel", defaultIfBlank(request.getRiskLevel(), "LOW"));
            params.put("approvalStatus", "AUTO_QUEUE".equals(policyCode) ? "APPROVED" : "PENDING");
            params.put("applyStatus", "PENDING");
            params.put("blockReason", "");
            params.put("approvedBy", "AUTO_QUEUE".equals(policyCode) ? defaultIfBlank(request.getActorId(), "system") : "");
            params.put("rejectedBy", "");
            params.put("createdBy", defaultIfBlank(request.getActorId(), "system"));
            params.put("updatedBy", defaultIfBlank(request.getActorId(), "system"));
            dbChangeCaptureMapper.insertDeployableDbPatchQueue(params);
            return queueId;
        } catch (Exception e) {
            log.warn("Failed to create deployable DB patch queue. table={}, entityId={}",
                    safe(request.getTargetTableName()), safe(request.getEntityId()), e);
            return "";
        }
    }

    private String jsonArrayOf(String value) {
        try {
            return objectMapper.writeValueAsString(java.util.Collections.singletonList(safe(value)));
        } catch (Exception ignored) {
            return "[]";
        }
    }

    private String resolveQueueDecisionCode(String policyCode) {
        if ("AUTO_QUEUE".equals(policyCode)) {
            return "AUTO_QUEUED";
        }
        if ("MANUAL_APPROVAL".equals(policyCode)) {
            return "APPROVAL_REQUIRED";
        }
        return "BLOCKED";
    }

    private String initialApprovalStatus(String policyCode, String queueId) {
        if (!queueId.isEmpty()) {
            return "APPROVED";
        }
        if ("MANUAL_APPROVAL".equals(policyCode)) {
            return "PENDING";
        }
        return "";
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(safe(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hashed) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = safe(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private String buildTargetPkJson(DbChangeCaptureRequest request) {
        Map<String, Object> payload = parseJsonMap(request.getTargetPkJson());
        Map<String, Object> renameFrom = parseJsonMap(request.getRenameFromKeyJson());
        Map<String, Object> renameTo = parseJsonMap(request.getRenameToKeyJson());
        if (!renameFrom.isEmpty()) {
            payload.put("__renameFrom", renameFrom);
        }
        if (!renameTo.isEmpty()) {
            payload.put("__renameTo", renameTo);
        }
        payload.put("__logicalObjectId", resolveLogicalObjectId(request));
        payload.put("__sourceEnv", defaultIfBlank(request.getSourceEnv(), defaultIfBlank(request.getTargetEnv(), "LOCAL")));
        payload.put("__baseRevision", resolveBaseRevision(request));
        payload.put("__captureSequence", resolveCaptureSequence(request));
        return jsonOf(payload);
    }

    private String buildPatchPayloadJson(DbChangeCaptureRequest request) {
        String payloadJson = safe(request.getPatchPayloadJson());
        Map<String, Object> payload = parseJsonMap(payloadJson);
        if (!payload.isEmpty()) {
            payload.put("__logicalObjectId", resolveLogicalObjectId(request));
            payload.put("__sourceEnv", defaultIfBlank(request.getSourceEnv(), defaultIfBlank(request.getTargetEnv(), "LOCAL")));
            payload.put("__baseRevision", resolveBaseRevision(request));
            payload.put("__captureSequence", resolveCaptureSequence(request));
            return jsonOf(payload);
        }
        return payloadJson;
    }

    private String resolveLogicalObjectId(DbChangeCaptureRequest request) {
        String logicalObjectId = safe(request.getLogicalObjectId());
        if (!logicalObjectId.isEmpty()) {
            return logicalObjectId;
        }
        String entityId = safe(request.getEntityId());
        if (!entityId.isEmpty()) {
            return entityId;
        }
        return safe(request.getTargetTableName()).toUpperCase(Locale.ROOT) + ":" + sha256(safe(request.getTargetPkJson())).substring(0, 16);
    }

    private String resolveBaseRevision(DbChangeCaptureRequest request) {
        String baseRevision = safe(request.getBaseRevision());
        return baseRevision.isEmpty() ? UUID.randomUUID().toString().replace("-", "") : baseRevision;
    }

    private String resolveCaptureSequence(DbChangeCaptureRequest request) {
        String captureSequence = safe(request.getCaptureSequence());
        return captureSequence.isEmpty() ? UUID.randomUUID().toString().replace("-", "") : captureSequence;
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.trim().isEmpty() || "null".equalsIgnoreCase(json.trim())) {
            return new LinkedHashMap<String, Object>();
        }
        try {
            return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception ignored) {
            return new LinkedHashMap<String, Object>();
        }
    }

    private String jsonOf(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String safe(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof String) {
            return ((String) value).trim();
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return String.valueOf(value).trim();
        }
    }
}

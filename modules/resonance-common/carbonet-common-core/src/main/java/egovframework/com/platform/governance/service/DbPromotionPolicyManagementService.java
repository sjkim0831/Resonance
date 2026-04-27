package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.dbchange.mapper.DbChangeCaptureMapper;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DbPromotionPolicyManagementService {

    
    private static final String PAGE_ID = "db-promotion-policy";
    private static final String MENU_CODE = "ADMIN_SYSTEM_DB_POLICY";
    private static final int RECENT_CHANGE_LIMIT = 80;

    private final DbChangeCaptureMapper dbChangeCaptureMapper;
    private final DbChangeCaptureService dbChangeCaptureService;
    private final ObjectMapper objectMapper;
    private final egovframework.com.common.context.ProjectRuntimeContext projectRuntimeContext;

    public Map<String, Object> buildPageData(boolean isEn) {
        List<Map<String, Object>> policies = dbChangeCaptureMapper.selectAllPromotionPolicies();
        Map<String, Object> recentParams = new LinkedHashMap<String, Object>();
        recentParams.put("projectId", projectRuntimeContext.getProjectId());
        recentParams.put("limit", RECENT_CHANGE_LIMIT);
        List<Map<String, Object>> recentChanges = dbChangeCaptureMapper.selectRecentBusinessChangeLogs(recentParams);

        Map<String, Map<String, Object>> policyByTable = new LinkedHashMap<String, Map<String, Object>>();
        for (Map<String, Object> policy : policies) {
            policyByTable.put(normalizeTableName(policy.get("tableName")), policy);
        }

        Map<String, Integer> changeCountByTable = new LinkedHashMap<String, Integer>();
        Map<String, Map<String, Object>> latestChangeByTable = new LinkedHashMap<String, Map<String, Object>>();
        LinkedHashSet<String> tableOrder = new LinkedHashSet<String>();
        for (Map<String, Object> policy : policies) {
            tableOrder.add(normalizeTableName(policy.get("tableName")));
        }
        for (Map<String, Object> change : recentChanges) {
            String tableName = normalizeTableName(change.get("targetTableName"));
            if (tableName.isEmpty()) {
                continue;
            }
            tableOrder.add(tableName);
            changeCountByTable.put(tableName, changeCountByTable.getOrDefault(tableName, 0) + 1);
            if (!latestChangeByTable.containsKey(tableName)) {
                latestChangeByTable.put(tableName, change);
            }
        }

        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        int blockedCount = 0;
        int manualApprovalCount = 0;
        int autoQueueCount = 0;
        int unregisteredCount = 0;
        for (String tableName : tableOrder) {
            if (tableName.isEmpty()) {
                continue;
            }
            Map<String, Object> policy = policyByTable.get(tableName);
            Map<String, Object> latestChange = latestChangeByTable.get(tableName);
            String policyCode = safe(policy == null ? null : policy.get("policyCode")).toUpperCase(Locale.ROOT);
            if ("BLOCKED".equals(policyCode)) {
                blockedCount++;
            } else if ("MANUAL_APPROVAL".equals(policyCode)) {
                manualApprovalCount++;
            } else if ("AUTO_QUEUE".equals(policyCode)) {
                autoQueueCount++;
            } else {
                unregisteredCount++;
            }
            rows.add(buildCatalogRow(tableName, policy, latestChange, changeCountByTable.getOrDefault(tableName, 0), isEn));
        }

        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("isEn", isEn);
        payload.put("dbPromotionPolicySummary", List.of(
                summaryCard(isEn ? "Tracked Tables" : "표시 테이블", String.valueOf(rows.size()),
                        isEn ? "Policies plus recently captured tables." : "정책 등록 테이블과 최근 변경 포착 테이블 기준입니다."),
                summaryCard(isEn ? "Blocked" : "기본 차단", String.valueOf(blockedCount),
                        isEn ? "Business or sensitive tables kept out of remote promotion." : "업무/민감 테이블은 원격 반영에서 기본 차단합니다."),
                summaryCard(isEn ? "Manual Approval" : "승인 필요", String.valueOf(manualApprovalCount),
                        isEn ? "Metadata tables that still require operator review." : "메타데이터라도 운영자 승인이 필요한 대상입니다."),
                summaryCard(isEn ? "Unregistered" : "미등록", String.valueOf(unregisteredCount),
                        isEn ? "Recently changed tables without explicit policy rows yet." : "최근 변경은 잡혔지만 정책 행이 아직 없는 테이블입니다.")
        ));
        payload.put("dbPromotionPolicyRows", rows);
        payload.put("dbPromotionPolicyRecentChangeRows", buildRecentChangeRows(recentChanges));
        payload.put("dbPromotionPolicyGuidance", List.of(
                guidanceRow(
                        isEn ? "Scope of this catalog" : "카탈로그 범위",
                        isEn ? "Start with policy-registered or recently captured tables. Full physical DB inventory can be added later if needed."
                                : "우선 정책 등록 테이블과 최근 변경 포착 테이블 중심으로 관리합니다. 필요하면 전체 물리 DB 인벤토리 확장은 다음 단계로 분리합니다."),
                guidanceRow(
                        isEn ? "DML vs DDL" : "DML / DDL 해석",
                        isEn ? "DML exception is controlled by promotion policy and change types. DDL should remain review-first unless a later schema-level guardrail is introduced."
                                : "DML 예외는 반영 정책과 change type으로 관리하고, DDL은 스키마 수준 가드레일이 별도로 준비되기 전까지 기본적으로 검토 우선으로 유지합니다."),
                guidanceRow(
                        isEn ? "Generated operator comment" : "운영 코멘트 자동 생성",
                        isEn ? "Use the generated comment as the ticket/PR baseline, then add concrete table-specific rationale."
                                : "자동 생성 코멘트를 티켓/PR 기본 문안으로 쓰고, 실제 테이블 특수 사유만 덧붙이면 됩니다.")
        ));
        return payload;
    }

    public Map<String, Object> save(Map<String, Object> requestBody, String actorId, boolean isEn, HttpServletRequest request) {
        String tableName = normalizeTableName(requestBody == null ? null : requestBody.get("tableName"));
        if (tableName.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Table name is required." : "테이블명을 입력하세요.");
        }

        Map<String, Object> before = dbChangeCaptureMapper.selectPromotionPolicyByTableName(tableName);
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("policyId", safe(before == null ? null : before.get("policyId")).isEmpty() ? "db-policy-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) : safe(before.get("policyId")));
        params.put("tableName", tableName);
        params.put("policyCode", sanitizePolicyCode(requestBody == null ? null : requestBody.get("policyCode")));
        params.put("changeTypesJson", normalizeChangeTypesJson(requestBody == null ? null : requestBody.get("changeTypesInput")));
        params.put("maskingProfileCode", sanitizeOptionalCode(requestBody == null ? null : requestBody.get("maskingProfileCode")));
        params.put("sqlRenderMode", sanitizeOptionalCode(requestBody == null ? null : requestBody.get("sqlRenderMode")));
        params.put("activeYn", "N".equalsIgnoreCase(safe(requestBody == null ? null : requestBody.get("activeYn"))) ? "N" : "Y");
        params.put("policyReason", trimToLength(safe(requestBody == null ? null : requestBody.get("policyReason")), 1000));
        params.put("createdBy", safe(actorId).isEmpty() ? "system" : safe(actorId));
        params.put("updatedBy", safe(actorId).isEmpty() ? "system" : safe(actorId));

        if (before == null || before.isEmpty()) {
            dbChangeCaptureMapper.insertPromotionPolicy(params);
        } else {
            dbChangeCaptureMapper.updatePromotionPolicy(params);
        }

        Map<String, Object> after = dbChangeCaptureMapper.selectPromotionPolicyByTableName(tableName);
        recordPolicyChange(request, safe(actorId).isEmpty() ? "system" : safe(actorId), before, after);

        Map<String, Object> payload = buildPageData(isEn);
        payload.put("dbPromotionPolicyMessage", isEn ? "DB promotion policy saved." : "DB 반영 정책을 저장했습니다.");
        payload.put("dbPromotionPolicySelectedTable", tableName);
        return payload;
    }

    private Map<String, String> buildCatalogRow(String tableName,
                                                Map<String, Object> policy,
                                                Map<String, Object> latestChange,
                                                int recentChangeCount,
                                                boolean isEn) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        String policyCode = safe(policy == null ? null : policy.get("policyCode")).toUpperCase(Locale.ROOT);
        String changeTypesJson = safe(policy == null ? null : policy.get("changeTypesJson"));
        String maskingProfileCode = safe(policy == null ? null : policy.get("maskingProfileCode"));
        String sqlRenderMode = safe(policy == null ? null : policy.get("sqlRenderMode"));
        String activeYn = safe(policy == null ? null : policy.get("activeYn"));
        row.put("policyId", safe(policy == null ? null : policy.get("policyId")));
        row.put("tableName", tableName);
        row.put("policyCode", policyCode);
        row.put("policyLabel", policyLabel(policyCode, isEn));
        row.put("categoryLabel", inferCategoryLabel(tableName, maskingProfileCode, policyCode, isEn));
        row.put("changeTypesJson", changeTypesJson);
        row.put("changeTypesInput", commaSeparatedChangeTypes(changeTypesJson));
        row.put("maskingProfileCode", maskingProfileCode);
        row.put("sqlRenderMode", sqlRenderMode);
        row.put("dmlPolicyLabel", dmlPolicyLabel(policyCode, isEn));
        row.put("ddlPolicyLabel", ddlPolicyLabel(changeTypesJson, sqlRenderMode, isEn));
        row.put("activeYn", activeYn.isEmpty() ? "Y" : activeYn);
        row.put("policyReason", safe(policy == null ? null : policy.get("policyReason")));
        row.put("recentChangeCount", String.valueOf(recentChangeCount));
        row.put("lastCapturedAt", safe(latestChange == null ? null : latestChange.get("capturedAt")));
        row.put("lastChangeType", safe(latestChange == null ? null : latestChange.get("changeType")));
        row.put("lastQueueDecisionCode", safe(latestChange == null ? null : latestChange.get("queueDecisionCode")));
        row.put("lastChangeSummary", safe(latestChange == null ? null : latestChange.get("changeSummary")));
        row.put("statusLabel", policyCode.isEmpty() ? (isEn ? "Unregistered" : "미등록") : (isEn ? "Registered" : "등록"));
        return row;
    }

    private List<Map<String, String>> buildRecentChangeRows(List<Map<String, Object>> recentChanges) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        for (Map<String, Object> change : recentChanges) {
            Map<String, String> row = new LinkedHashMap<String, String>();
            row.put("targetTableName", normalizeTableName(change.get("targetTableName")));
            row.put("changeType", safe(change.get("changeType")));
            row.put("promotionPolicyCode", safe(change.get("promotionPolicyCode")));
            row.put("queueDecisionCode", safe(change.get("queueDecisionCode")));
            row.put("capturedAt", safe(change.get("capturedAt")));
            row.put("actorId", safe(change.get("actorId")));
            row.put("changeSummary", safe(change.get("changeSummary")));
            rows.add(row);
        }
        return rows;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> guidanceRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private void recordPolicyChange(HttpServletRequest request, String actorId, Map<String, Object> before, Map<String, Object> after) {
        try {
            String tableName = normalizeTableName(after == null ? null : after.get("tableName"));
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId(projectRuntimeContext.getProjectId());
            captureRequest.setMenuCode(MENU_CODE);
            captureRequest.setPageId(PAGE_ID);
            captureRequest.setApiPath(request == null ? "" : safe(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safe(request.getMethod()));
            captureRequest.setActorId(actorId);
            captureRequest.setTargetTableName("DB_CHANGE_PROMOTION_POLICY");
            captureRequest.setTargetPkJson(jsonOf(Map.of("TABLE_NAME", tableName)));
            captureRequest.setEntityType("DB_PROMOTION_POLICY");
            captureRequest.setEntityId(tableName);
            captureRequest.setChangeType(before == null || before.isEmpty() ? "INSERT" : "UPDATE");
            captureRequest.setBeforeSummaryJson(jsonOf(before));
            captureRequest.setAfterSummaryJson(jsonOf(after));
            captureRequest.setChangeSummary("DB promotion policy saved for " + tableName);
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("ROW_UPSERT");
            captureRequest.setTargetEnv("REMOTE_MAIN");
            captureRequest.setTargetKeysJson(jsonOf(Map.of("TABLE_NAME", tableName)));
            captureRequest.setPatchPayloadJson(jsonOf(after));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("LOW");
            captureRequest.setLogicalObjectId("DB_CHANGE_PROMOTION_POLICY:" + tableName);
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture DB promotion policy change.", e);
        }
    }

    private String policyLabel(String policyCode, boolean isEn) {
        if ("AUTO_QUEUE".equals(policyCode)) {
            return isEn ? "Auto queue" : "자동 큐";
        }
        if ("MANUAL_APPROVAL".equals(policyCode)) {
            return isEn ? "Manual approval" : "승인 필요";
        }
        if ("BLOCKED".equals(policyCode)) {
            return isEn ? "Blocked" : "차단";
        }
        return isEn ? "Unregistered" : "미등록";
    }

    private String dmlPolicyLabel(String policyCode, boolean isEn) {
        if ("AUTO_QUEUE".equals(policyCode)) {
            return isEn ? "Promotable automatically" : "자동 반영 가능";
        }
        if ("MANUAL_APPROVAL".equals(policyCode)) {
            return isEn ? "Operator approval required" : "운영 승인 후 반영";
        }
        if ("BLOCKED".equals(policyCode)) {
            return isEn ? "Blocked by default" : "기본 차단";
        }
        return isEn ? "No explicit policy yet" : "명시 정책 없음";
    }

    private String ddlPolicyLabel(String changeTypesJson, String sqlRenderMode, boolean isEn) {
        String normalizedTypes = changeTypesJson.toUpperCase(Locale.ROOT);
        String normalizedRenderMode = safe(sqlRenderMode).toUpperCase(Locale.ROOT);
        boolean ddlTracked = normalizedTypes.contains("ALTER")
                || normalizedTypes.contains("DROP")
                || normalizedTypes.contains("CREATE")
                || normalizedTypes.contains("TRUNCATE")
                || normalizedTypes.contains("RENAME")
                || normalizedRenderMode.contains("DDL");
        if (ddlTracked) {
            return isEn ? "Exception review" : "예외 검토";
        }
        if ("NONE".equals(normalizedRenderMode)) {
            return isEn ? "Blocked" : "차단";
        }
        return isEn ? "Review first" : "검토 우선";
    }

    private String inferCategoryLabel(String tableName, String maskingProfileCode, String policyCode, boolean isEn) {
        String upperTable = safe(tableName).toUpperCase(Locale.ROOT);
        String upperMask = safe(maskingProfileCode).toUpperCase(Locale.ROOT);
        if (upperMask.contains("SENSITIVE") || "BLOCKED".equals(policyCode) || upperTable.contains("MBER") || upperTable.contains("EMPLYR")) {
            return isEn ? "Business / sensitive" : "업무 / 민감";
        }
        if (upperTable.startsWith("COMTCCMMN") || upperTable.startsWith("COMTNMENU") || upperTable.contains("AUTHOR") || upperMask.contains("STANDARD_ADMIN")) {
            return isEn ? "Admin metadata" : "관리 메타";
        }
        return isEn ? "Review needed" : "검토 필요";
    }

    private String sanitizePolicyCode(Object value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("AUTO_QUEUE".equals(normalized) || "MANUAL_APPROVAL".equals(normalized)) {
            return normalized;
        }
        return "BLOCKED";
    }

    private String sanitizeOptionalCode(Object value) {
        return trimToLength(safe(value).toUpperCase(Locale.ROOT), 40);
    }

    private String normalizeChangeTypesJson(Object value) {
        List<String> items = new ArrayList<String>();
        for (String raw : splitCommaSeparated(value)) {
            String normalized = raw.toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                items.add(normalized);
            }
        }
        if (items.isEmpty()) {
            items.add("INSERT");
            items.add("UPDATE");
            items.add("DELETE");
        }
        try {
            return objectMapper.writeValueAsString(items);
        } catch (Exception e) {
            return "[\"INSERT\",\"UPDATE\",\"DELETE\"]";
        }
    }

    private List<String> splitCommaSeparated(Object value) {
        List<String> items = new ArrayList<String>();
        for (String token : safe(value).replace("[", "").replace("]", "").replace("\"", "").split(",")) {
            String normalized = token.trim();
            if (!normalized.isEmpty()) {
                items.add(normalized);
            }
        }
        return items;
    }

    private String commaSeparatedChangeTypes(String changeTypesJson) {
        List<String> values = splitCommaSeparated(changeTypesJson);
        return String.join(", ", new LinkedHashSet<String>(values));
    }

    private String normalizeTableName(Object value) {
        return trimToLength(safe(value).toUpperCase(Locale.ROOT), 160);
    }

    private String trimToLength(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String jsonOf(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "";
        }
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

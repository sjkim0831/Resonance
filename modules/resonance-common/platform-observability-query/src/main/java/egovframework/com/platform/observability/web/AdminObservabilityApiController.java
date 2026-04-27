package egovframework.com.platform.observability.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import egovframework.com.feature.admin.dto.request.AdminUnifiedLogSearchRequestDTO;
import egovframework.com.platform.observability.service.ObservabilityQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/observability",
        "/en/api/platform/observability",
        "/api/admin/observability",
        "/en/api/admin/observability",
        "/admin/api/platform/observability",
        "/en/admin/api/platform/observability",
        "/admin/api/admin/observability",
        "/en/admin/api/admin/observability"
})
public class AdminObservabilityApiController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<Map<String, Object>>() {};
    private final ObservabilityQueryService observabilityQueryService;

    @GetMapping("/audit-events")
    public ResponseEntity<Map<String, Object>> searchAuditEvents(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "pageSize", required = false) String pageSizeParam,
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "traceId", required = false) String traceId,
            @RequestParam(value = "actorId", required = false) String actorId,
            @RequestParam(value = "actionCode", required = false) String actionCode,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "resultStatus", required = false) String resultStatus,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword) {
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = parsePositiveInt(pageSizeParam, 10);
        AuditEventSearchVO searchVO = new AuditEventSearchVO();
        searchVO.setFirstIndex(Math.max(pageIndex - 1, 0) * Math.max(pageSize, 1));
        searchVO.setRecordCountPerPage(Math.max(pageSize, 1));
        searchVO.setProjectId(safe(projectId));
        searchVO.setTraceId(safe(traceId));
        searchVO.setActorId(safe(actorId));
        searchVO.setActionCode(safe(actionCode));
        searchVO.setMenuCode(safe(menuCode));
        searchVO.setPageId(safe(pageId));
        searchVO.setResultStatus(safe(resultStatus));
        searchVO.setSearchKeyword(safe(searchKeyword));
        return pagedResponse(
                pageIndex,
                pageSize,
                observabilityQueryService.selectAuditEventCount(searchVO),
                enrichAuditItems(observabilityQueryService.selectAuditEventList(searchVO)));
    }

    @GetMapping("/trace-events")
    public ResponseEntity<Map<String, Object>> searchTraceEvents(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "pageSize", required = false) String pageSizeParam,
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "traceId", required = false) String traceId,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "componentId", required = false) String componentId,
            @RequestParam(value = "functionId", required = false) String functionId,
            @RequestParam(value = "apiId", required = false) String apiId,
            @RequestParam(value = "eventType", required = false) String eventType,
            @RequestParam(value = "resultCode", required = false) String resultCode,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword) {
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = parsePositiveInt(pageSizeParam, 10);
        TraceEventSearchVO searchVO = new TraceEventSearchVO();
        searchVO.setFirstIndex(Math.max(pageIndex - 1, 0) * Math.max(pageSize, 1));
        searchVO.setRecordCountPerPage(Math.max(pageSize, 1));
        searchVO.setProjectId(safe(projectId));
        searchVO.setTraceId(safe(traceId));
        searchVO.setPageId(safe(pageId));
        searchVO.setComponentId(safe(componentId));
        searchVO.setFunctionId(safe(functionId));
        searchVO.setApiId(safe(apiId));
        searchVO.setEventType(safe(eventType));
        searchVO.setResultCode(safe(resultCode));
        searchVO.setSearchKeyword(safe(searchKeyword));
        return pagedResponse(
                pageIndex,
                pageSize,
                observabilityQueryService.selectTraceEventCount(searchVO),
                observabilityQueryService.selectTraceEventList(searchVO));
    }

    @GetMapping("/unified-log")
    public ResponseEntity<Map<String, Object>> searchUnifiedLog(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "pageSize", required = false) String pageSizeParam,
            @RequestParam(value = "tab", required = false) String tab,
            @RequestParam(value = "logType", required = false) String logType,
            @RequestParam(value = "detailType", required = false) String detailType,
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "resultCode", required = false) String resultCode,
            @RequestParam(value = "actorId", required = false) String actorId,
            @RequestParam(value = "actorRole", required = false) String actorRole,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "memberType", required = false) String memberType,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "componentId", required = false) String componentId,
            @RequestParam(value = "functionId", required = false) String functionId,
            @RequestParam(value = "apiId", required = false) String apiId,
            @RequestParam(value = "actionCode", required = false) String actionCode,
            @RequestParam(value = "targetType", required = false) String targetType,
            @RequestParam(value = "targetId", required = false) String targetId,
            @RequestParam(value = "traceId", required = false) String traceId,
            @RequestParam(value = "requestUri", required = false) String requestUri,
            @RequestParam(value = "remoteAddr", required = false) String remoteAddr,
            @RequestParam(value = "fromDate", required = false) String fromDate,
            @RequestParam(value = "toDate", required = false) String toDate,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword) {
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = parsePositiveInt(pageSizeParam, 10);
        AdminUnifiedLogSearchRequestDTO searchDTO = new AdminUnifiedLogSearchRequestDTO();
        searchDTO.setPageIndex(pageIndex);
        searchDTO.setPageSize(pageSize);
        searchDTO.setTab(safe(tab));
        searchDTO.setLogType(safe(logType));
        searchDTO.setDetailType(safe(detailType));
        searchDTO.setProjectId(safe(projectId));
        searchDTO.setResultCode(safe(resultCode));
        searchDTO.setActorId(safe(actorId));
        searchDTO.setActorRole(safe(actorRole));
        searchDTO.setInsttId(safe(insttId));
        searchDTO.setMemberType(safe(memberType));
        searchDTO.setMenuCode(safe(menuCode));
        searchDTO.setPageId(safe(pageId));
        searchDTO.setComponentId(safe(componentId));
        searchDTO.setFunctionId(safe(functionId));
        searchDTO.setApiId(safe(apiId));
        searchDTO.setActionCode(safe(actionCode));
        searchDTO.setTargetType(safe(targetType));
        searchDTO.setTargetId(safe(targetId));
        searchDTO.setTraceId(safe(traceId));
        searchDTO.setRequestUri(safe(requestUri));
        searchDTO.setRemoteAddr(safe(remoteAddr));
        searchDTO.setFromDate(safe(fromDate));
        searchDTO.setToDate(safe(toDate));
        searchDTO.setSearchKeyword(safe(searchKeyword));
        return pagedResponse(
                pageIndex,
                pageSize,
                observabilityQueryService.selectUnifiedLogCount(searchDTO),
                observabilityQueryService.selectUnifiedLogList(searchDTO));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private int parsePositiveInt(String value, int defaultValue) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            return defaultValue;
        }
        try {
            return Math.max(Integer.parseInt(normalized), 1);
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private List<Map<String, Object>> enrichAuditItems(List<AuditEventRecordVO> items) {
        List<Map<String, Object>> enriched = new ArrayList<>();
        if (items == null) {
            return enriched;
        }
        for (AuditEventRecordVO item : items) {
            Map<String, Object> row = OBJECT_MAPPER.convertValue(item, MAP_TYPE);
            Map<String, Object> before = parseSnapshot(item.getBeforeSummaryJson());
            Map<String, Object> after = parseSnapshot(item.getAfterSummaryJson());
            List<Map<String, Object>> changedFields = buildChangedFields(before, after);
            List<String> addedFeatureCodes = buildAddedFeatureCodes(before, after);
            List<String> removedFeatureCodes = buildRemovedFeatureCodes(before, after);
            row.putAll(orderedMap(
                    "changedFields", changedFields,
                    "addedFeatureCodes", addedFeatureCodes,
                    "removedFeatureCodes", removedFeatureCodes,
                    "interpretedDiffSummary", buildInterpretedDiffSummary(changedFields, addedFeatureCodes, removedFeatureCodes)));
            enriched.add(row);
        }
        return enriched;
    }

    private Map<String, Object> parseSnapshot(String json) {
        if (json == null || json.trim().isEmpty()) {
            return emptyObjectMap();
        }
        try {
            Map<String, Object> parsed = OBJECT_MAPPER.readValue(json, MAP_TYPE);
            return parsed == null ? emptyObjectMap() : parsed;
        } catch (Exception ignored) {
            return emptyObjectMap();
        }
    }

    private List<Map<String, Object>> buildChangedFields(Map<String, Object> before, Map<String, Object> after) {
        Set<String> keys = new LinkedHashSet<>();
        keys.addAll(before.keySet());
        keys.addAll(after.keySet());
        List<Map<String, Object>> changed = new ArrayList<>();
        for (String key : keys) {
            Object beforeValue = before.get(key);
            Object afterValue = after.get(key);
            if (Objects.equals(normalizeScalar(beforeValue), normalizeScalar(afterValue))) {
                continue;
            }
            if (isFeatureCollectionKey(key)) {
                continue;
            }
            changed.add(orderedMap(
                    "field", key,
                    "before", normalizeScalar(beforeValue),
                    "after", normalizeScalar(afterValue)));
        }
        return changed;
    }

    private List<String> buildAddedFeatureCodes(Map<String, Object> before, Map<String, Object> after) {
        Set<String> beforeCodes = new LinkedHashSet<>(extractFeatureCodes(before));
        Set<String> afterCodes = new LinkedHashSet<>(extractFeatureCodes(after));
        List<String> added = new ArrayList<>();
        for (String code : afterCodes) {
            if (!beforeCodes.contains(code)) {
                added.add(code);
            }
        }
        return added;
    }

    private List<String> buildRemovedFeatureCodes(Map<String, Object> before, Map<String, Object> after) {
        Set<String> beforeCodes = new LinkedHashSet<>(extractFeatureCodes(before));
        Set<String> afterCodes = new LinkedHashSet<>(extractFeatureCodes(after));
        List<String> removed = new ArrayList<>();
        for (String code : beforeCodes) {
            if (!afterCodes.contains(code)) {
                removed.add(code);
            }
        }
        return removed;
    }

    private List<String> extractFeatureCodes(Object value) {
        List<String> result = new ArrayList<>();
        if (value == null) {
            return result;
        }
        if (value instanceof String) {
            String text = safe((String) value);
            if (!text.isEmpty() && (text.contains("_") || text.startsWith("ROLE_"))) {
                result.add(text);
            }
            return result;
        }
        if (value instanceof Collection<?>) {
            for (Object item : (Collection<?>) value) {
                result.addAll(extractFeatureCodes(item));
            }
            return result;
        }
        if (value instanceof Map<?, ?>) {
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                String key = entry.getKey() == null ? "" : entry.getKey().toString();
                if (isFeatureCollectionKey(key)) {
                    result.addAll(extractFeatureCodes(entry.getValue()));
                }
            }
        }
        return result;
    }

    private boolean isFeatureCollectionKey(String key) {
        return "selectedFeatureCodes".equals(key)
                || "featureCodes".equals(key)
                || "features".equals(key)
                || "grantedFeatures".equals(key)
                || "mappedFeatures".equals(key);
    }

    private Object normalizeScalar(Object value) {
        if (value instanceof Map || value instanceof Collection) {
            return null;
        }
        return value == null ? "" : value;
    }

    private String buildInterpretedDiffSummary(List<Map<String, Object>> changedFields,
                                               List<String> addedFeatureCodes,
                                               List<String> removedFeatureCodes) {
        List<String> parts = new ArrayList<>();
        if (!changedFields.isEmpty()) {
            List<String> labels = new ArrayList<>();
            for (Map<String, Object> field : changedFields) {
                labels.add(String.valueOf(field.get("field")));
                if (labels.size() >= 3) {
                    break;
                }
            }
            parts.add("fields:" + String.join(",", labels) + (changedFields.size() > 3 ? "+" + (changedFields.size() - 3) : ""));
        }
        if (!addedFeatureCodes.isEmpty()) {
            parts.add("added:" + String.join(",", addedFeatureCodes.subList(0, Math.min(3, addedFeatureCodes.size()))) + (addedFeatureCodes.size() > 3 ? "+" + (addedFeatureCodes.size() - 3) : ""));
        }
        if (!removedFeatureCodes.isEmpty()) {
            parts.add("removed:" + String.join(",", removedFeatureCodes.subList(0, Math.min(3, removedFeatureCodes.size()))) + (removedFeatureCodes.size() > 3 ? "+" + (removedFeatureCodes.size() - 3) : ""));
        }
        return String.join(" / ", parts);
    }

    private ResponseEntity<Map<String, Object>> pagedResponse(int pageIndex, int pageSize, int totalCount, Object items) {
        return ResponseEntity.ok(orderedMap(
                "pageIndex", pageIndex,
                "pageSize", pageSize,
                "totalCount", totalCount,
                "items", items));
    }

    private Map<String, Object> emptyObjectMap() {
        return new LinkedHashMap<>();
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }
}

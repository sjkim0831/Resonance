package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.trace.TraceEventRecordVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalLogsPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;
    private final PlatformObservabilityExternalEventSnapshotService externalEventSnapshotService;

    public Map<String, Object> buildExternalLogsPagePayload(boolean isEn) {
        Map<String, Object> connectionPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castStringRowList(connectionPayload.get("externalConnectionRows"));
        List<Map<String, String>> issueRows = castStringRowList(connectionPayload.get("externalConnectionIssueRows"));

        PlatformObservabilityExternalEventSnapshotService.ExternalEventSnapshot snapshot = externalEventSnapshotService.loadSnapshot();
        List<AccessEventRecordVO> accessEvents = snapshot.getAccessEvents();
        List<ErrorEventRecordVO> errorEvents = snapshot.getErrorEvents();
        List<TraceEventRecordVO> traceEvents = snapshot.getTraceEvents();

        List<Map<String, String>> logRows = buildExternalLogRows(accessEvents, errorEvents, traceEvents, isEn);
        List<Map<String, String>> watchRows = connectionRows.stream()
                .filter(row -> {
                    String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
                    return "WARNING".equals(status) || "DEGRADED".equals(status) || "REVIEW".equals(status);
                })
                .limit(8)
                .toList();
        long traceLinkedCount = logRows.stream()
                .filter(row -> !safeString(row.get("traceId")).isEmpty())
                .count();
        long dangerCount = logRows.stream()
                .filter(row -> "DANGER".equalsIgnoreCase(safeString(row.get("severity"))))
                .count();
        long slowCount = accessEvents.stream()
                .filter(item -> item != null && item.getDurationMs() != null && item.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS)
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", dangerCount > 0 ? "REVIEW" : "ACTIVE");
        payload.put("externalLogSummary", List.of(
                summaryMetricRow(
                        isEn ? "Recent Events" : "최근 이벤트",
                        String.valueOf(logRows.size()),
                        isEn ? "Recent external integration access, error, and trace records shown in one queue." : "외부연계 접근, 오류, 추적 이벤트를 하나의 운영 큐로 합쳐 표시합니다.",
                        logRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "High-Risk Events" : "고위험 이벤트",
                        String.valueOf(dangerCount),
                        isEn ? "Errors or failing responses that should be escalated first." : "실패 응답과 오류 이벤트처럼 우선 조치가 필요한 항목 수입니다.",
                        dangerCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Slow Calls" : "지연 호출",
                        String.valueOf(slowCount),
                        isEn ? "Observed integration calls exceeding the slow threshold." : "기준 임계치를 초과한 외부연계 지연 호출 수입니다.",
                        slowCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Trace-Linked" : "추적 연결",
                        String.valueOf(traceLinkedCount),
                        isEn ? "Events carrying a trace id for drill-down into observability or unified log." : "추적 ID가 있어 추적 조회나 통합 로그로 바로 넘길 수 있는 이벤트 수입니다.",
                        "neutral")));
        payload.put("externalLogRows", logRows);
        payload.put("externalLogIssueRows", issueRows);
        payload.put("externalLogConnectionRows", watchRows);
        payload.put("externalLogQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "API Usage" : "API 사용량", localizedAdminPath("/external/usage", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn))));
        payload.put("externalLogGuidance", List.of(
                guidanceRow(
                        isEn ? "Use one trace for one incident" : "한 장애는 한 trace로 묶기",
                        isEn ? "When access, trace, and error records share the same trace id, review them as one incident before retrying." : "접근, 추적, 오류 기록이 같은 trace id를 공유하면 재시도 전에 하나의 장애 단위로 함께 봐야 합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Latency without errors still matters" : "오류 없는 지연도 중요",
                        isEn ? "Sustained slow calls usually precede retries, queue growth, or partner throttling even when status codes stay green." : "상태 코드는 정상이더라도 지연이 누적되면 재시도, 큐 적체, 파트너 제한으로 이어질 수 있습니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Escalate repeated failures by connection" : "연계 단위 반복 실패 우선 조치",
                        isEn ? "If the same connection appears repeatedly, move into usage, sync, and schema screens before widening the blast radius." : "같은 연계가 반복 등장하면 영향 범위를 넓히기 전에 사용량, 동기화, 스키마 화면까지 함께 확인해야 합니다.",
                        "danger")));
        return payload;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> castStringRowList(Object value) {
        if (!(value instanceof List<?>)) {
            return List.of();
        }
        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (!(item instanceof Map<?, ?>)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            ((Map<?, ?>) item).forEach((key, rawValue) -> row.put(safeString(key), safeString(rawValue)));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> buildExternalLogRows(
            List<AccessEventRecordVO> accessEvents,
            List<ErrorEventRecordVO> errorEvents,
            List<TraceEventRecordVO> traceEvents,
            boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (AccessEventRecordVO item : accessEvents) {
            if (item == null) {
                continue;
            }
            int responseStatus = item.getResponseStatus() == null ? 0 : item.getResponseStatus();
            boolean slow = item.getDurationMs() != null && item.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS;
            String severity = responseStatus >= 500 ? "DANGER" : responseStatus >= 400 || slow ? "WARNING" : "NEUTRAL";
            Map<String, String> row = new LinkedHashMap<>();
            row.put("id", firstNonBlank(safeString(item.getEventId()), safeString(item.getTraceId()), safeString(item.getApiId())));
            row.put("occurredAt", safeString(item.getCreatedAt()));
            row.put("logType", "ACCESS");
            row.put("severity", severity);
            row.put("traceId", safeString(item.getTraceId()));
            row.put("apiId", safeString(item.getApiId()));
            row.put("actorId", safeString(item.getActorId()));
            row.put("connectionName", resolveIntegrationConnectionName(safeString(item.getApiId()), normalizePerformanceUri(item.getRequestUri()), isEn));
            row.put("requestUri", normalizePerformanceUri(item.getRequestUri()));
            row.put("status", responseStatus > 0 ? String.valueOf(responseStatus) : (slow ? "SLOW" : "OK"));
            row.put("detail", firstNonBlank(
                    item.getDurationMs() == null ? "" : item.getDurationMs() + "ms",
                    safeString(item.getErrorMessage()),
                    safeString(item.getHttpMethod())));
            row.put("targetRoute", !safeString(item.getApiId()).isEmpty()
                    ? appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", safeString(item.getApiId()))
                    : appendQuery(localizedAdminPath("/system/unified_log", isEn), "traceId", safeString(item.getTraceId())));
            rows.add(row);
        }
        for (ErrorEventRecordVO item : errorEvents) {
            if (item == null) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            row.put("id", firstNonBlank(safeString(item.getErrorId()), safeString(item.getTraceId()), safeString(item.getApiId())));
            row.put("occurredAt", safeString(item.getCreatedAt()));
            row.put("logType", "ERROR");
            row.put("severity", "DANGER");
            row.put("traceId", safeString(item.getTraceId()));
            row.put("apiId", safeString(item.getApiId()));
            row.put("actorId", safeString(item.getActorId()));
            row.put("connectionName", resolveIntegrationConnectionName(safeString(item.getApiId()), normalizePerformanceUri(item.getRequestUri()), isEn));
            row.put("requestUri", normalizePerformanceUri(item.getRequestUri()));
            row.put("status", firstNonBlank(safeString(item.getResultStatus()), safeString(item.getErrorType()), "ERROR"));
            row.put("detail", firstNonBlank(safeString(item.getMessage()), safeString(item.getErrorType()), safeString(item.getSourceType())));
            row.put("targetRoute", !safeString(item.getApiId()).isEmpty()
                    ? appendQuery(localizedAdminPath("/system/error-log", isEn), "apiId", safeString(item.getApiId()))
                    : appendQuery(localizedAdminPath("/system/error-log", isEn), "searchKeyword", safeString(item.getRequestUri())));
            rows.add(row);
        }
        for (TraceEventRecordVO item : traceEvents) {
            if (item == null) {
                continue;
            }
            String resultCode = safeString(item.getResultCode()).toUpperCase(Locale.ROOT);
            String severity = resultCode.contains("FAIL") || resultCode.contains("ERROR")
                    ? "DANGER"
                    : item.getDurationMs() != null && item.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS ? "WARNING" : "NEUTRAL";
            Map<String, String> row = new LinkedHashMap<>();
            row.put("id", firstNonBlank(safeString(item.getEventId()), safeString(item.getTraceId()), safeString(item.getApiId())));
            row.put("occurredAt", safeString(item.getCreatedAt()));
            row.put("logType", "TRACE");
            row.put("severity", severity);
            row.put("traceId", safeString(item.getTraceId()));
            row.put("apiId", safeString(item.getApiId()));
            row.put("actorId", safeString(item.getPageId()));
            row.put("connectionName", resolveIntegrationConnectionName(safeString(item.getApiId()), "", isEn));
            row.put("requestUri", safeString(item.getComponentId()));
            row.put("status", firstNonBlank(safeString(item.getResultCode()), safeString(item.getEventType()), "TRACE"));
            row.put("detail", firstNonBlank(
                    item.getDurationMs() == null ? "" : item.getDurationMs() + "ms",
                    safeString(item.getEventType()),
                    safeString(item.getFunctionId())));
            row.put("targetRoute", appendQuery(localizedAdminPath("/system/unified_log", isEn), "traceId", safeString(item.getTraceId())));
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("occurredAt")), Comparator.reverseOrder()));
        return rows.stream().limit(120).toList();
    }

    private Map<String, String> summaryMetricRow(String title, String value, String description, String tone) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        row.put("tone", tone);
        return row;
    }

    private Map<String, String> quickLinkRow(String label, String targetRoute) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("targetRoute", targetRoute);
        return row;
    }

    private Map<String, String> guidanceRow(String title, String body, String tone) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        row.put("tone", tone);
        return row;
    }

    private String localizedAdminPath(String path, boolean isEn) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private String appendQuery(String path, String key, String value) {
        String normalizedValue = safeString(value);
        if (path == null || path.isEmpty() || key == null || key.isEmpty() || normalizedValue.isEmpty()) {
            return path;
        }
        String separator = path.contains("?") ? "&" : "?";
        return path + separator + key + "=" + normalizedValue;
    }

    private String resolveIntegrationConnectionName(String apiId, String requestUri, boolean isEn) {
        if (!safeString(apiId).isEmpty()) {
            return apiId;
        }
        if (!safeString(requestUri).isEmpty()) {
            String[] segments = requestUri.split("/");
            for (int i = segments.length - 1; i >= 0; i--) {
                String segment = safeString(segments[i]);
                if (!segment.isEmpty()) {
                    return segment.toUpperCase(Locale.ROOT);
                }
            }
        }
        return isEn ? "Observed external integration" : "관측 외부연계";
    }

    private String normalizePerformanceUri(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        int queryIndex = normalized.indexOf('?');
        return queryIndex >= 0 ? normalized.substring(0, queryIndex) : normalized;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!safeString(value).isEmpty()) {
                return safeString(value);
            }
        }
        return "";
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

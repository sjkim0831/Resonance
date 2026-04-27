package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalUsagePayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;
    private final PlatformObservabilityExternalEventSnapshotService externalEventSnapshotService;

    public Map<String, Object> buildExternalUsagePagePayload(boolean isEn) {
        Map<String, Object> connectionPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castStringRowList(connectionPayload.get("externalConnectionRows"));
        PlatformObservabilityExternalEventSnapshotService.ExternalEventSnapshot snapshot = externalEventSnapshotService.loadSnapshot();
        List<AccessEventRecordVO> accessEvents = snapshot.getAccessEvents();
        List<ErrorEventRecordVO> errorEvents = snapshot.getErrorEvents();

        List<Map<String, String>> usageRows = buildExternalUsageRows(connectionRows, isEn);
        List<Map<String, String>> keyRows = buildExternalUsageKeyRows(usageRows);
        List<Map<String, String>> trendRows = buildExternalUsageTrendRows(accessEvents, errorEvents, isEn);
        long highTrafficCount = usageRows.stream()
                .filter(row -> parsePositiveLong(row.get("requestCount"), 0L) >= 1000L)
                .count();
        long errorHeavyCount = usageRows.stream()
                .filter(row -> parsePositiveLong(row.get("errorCount"), 0L) >= 5L)
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", errorHeavyCount > 0 ? "REVIEW" : "ACTIVE");
        payload.put("externalUsageSummary", List.of(
                summaryMetricRow(isEn ? "Active APIs" : "활성 API", String.valueOf(usageRows.size()), isEn ? "Observed integration APIs with current request volume tracking." : "현재 요청량을 추적 중인 외부연계 API 수", usageRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(isEn ? "High Traffic" : "고트래픽", String.valueOf(highTrafficCount), isEn ? "APIs exceeding the normal traffic baseline." : "기준선보다 호출량이 높은 API 수", highTrafficCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(isEn ? "Error Heavy" : "오류 집중", String.valueOf(errorHeavyCount), isEn ? "APIs with repeated error bursts." : "오류가 반복적으로 집중된 API 수", errorHeavyCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(isEn ? "Tracked Consumers" : "소비 시스템", String.valueOf(keyRows.size()), isEn ? "Top consumers or integration owners by observed traffic." : "트래픽 기준 상위 소비 시스템 또는 담당 주체 수", "neutral")));
        payload.put("externalUsageRows", usageRows);
        payload.put("externalUsageKeyRows", keyRows);
        payload.put("externalUsageTrendRows", trendRows);
        payload.put("externalUsageQuickLinks", List.of(
                quickLinkRow(isEn ? "Schema Registry" : "외부 스키마", localizedAdminPath("/external/schema", isEn)),
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                quickLinkRow(isEn ? "Performance" : "성능", localizedAdminPath("/system/performance", isEn))));
        payload.put("externalUsageGuidance", List.of(
                guidanceRow(isEn ? "Traffic spikes need source review" : "트래픽 급증 시 원천 검토", isEn ? "Check upstream rollout, retry loops, and queue replay before scaling traffic allowances." : "호출 허용량 조정보다 먼저 상위 시스템 배포, 재시도 루프, 큐 재처리 여부를 확인합니다.", "warning"),
                guidanceRow(isEn ? "Separate throughput from errors" : "처리량과 오류 분리 확인", isEn ? "High volume alone is not a fault. Prioritize APIs where volume and errors rise together." : "호출량 증가 자체는 장애가 아닙니다. 호출량과 오류가 함께 증가한 API를 우선 확인합니다.", "neutral"),
                guidanceRow(isEn ? "Coordinate consumer changes" : "소비 시스템 변경 연동", isEn ? "If a new consumer appears, confirm scope, key ownership, and schema compatibility before broad rollout." : "새 소비 시스템이 보이면 전체 확산 전에 권한 범위, 키 담당, 스키마 호환성을 먼저 확인합니다.", "danger")));
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

    private List<Map<String, String>> buildExternalUsageRows(List<Map<String, String>> connectionRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> connection : connectionRows) {
            long successCount = parsePositiveLong(connection.get("successCount"), 0L);
            long errorCount = parsePositiveLong(connection.get("errorCount"), 0L);
            long requestCount = Math.max(successCount + errorCount, parsePositiveLong(connection.get("traceCount"), 0L));
            long avgDurationMs = parsePositiveLong(connection.get("avgDurationMs"), 0L);
            double successRate = requestCount <= 0L ? 100D : ((double) successCount * 100D) / (double) requestCount;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionKey", safeString(connection.get("connectionKey")));
            row.put("connectionId", firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId"))));
            row.put("connectionName", safeString(connection.get("connectionName")));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("requestUri", firstNonBlank(safeString(connection.get("requestUri")), safeString(connection.get("endpointUrl"))));
            row.put("authMethod", firstNonBlank(safeString(connection.get("authMethod")), "OBSERVED"));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("requestCount", String.valueOf(requestCount));
            row.put("errorCount", String.valueOf(errorCount));
            row.put("successRate", String.format(Locale.ROOT, "%.1f", successRate));
            row.put("avgDurationMs", String.valueOf(avgDurationMs));
            row.put("avgDurationText", formatDurationMs(avgDurationMs));
            row.put("lastSeenAt", firstNonBlank(safeString(connection.get("lastSeenAt")), "2026-03-30 09:00"));
            row.put("status", firstNonBlank(safeString(connection.get("status")), "HEALTHY"));
            row.put("targetRoute", firstNonBlank(
                    appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", safeString(connection.get("connectionId"))),
                    safeString(connection.get("targetRoute"))));
            rows.add(row);
        }
        rows.sort(Comparator
                .comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("requestCount"), 0L)).reversed()
                .thenComparingDouble((Map<String, String> row) -> parsePercentageValue(row.get("successRate")))
                .thenComparing((Map<String, String> row) -> safeString(row.get("lastSeenAt")), Comparator.reverseOrder()));
        return rows;
    }

    private List<Map<String, String>> buildExternalUsageKeyRows(List<Map<String, String>> usageRows) {
        Map<String, List<Map<String, String>>> rowsByAuthMethod = usageRows.stream()
                .collect(Collectors.groupingBy(row -> firstNonBlank(safeString(row.get("authMethod")), "OBSERVED"), LinkedHashMap::new, Collectors.toList()));
        List<Map<String, String>> rows = new ArrayList<>();
        rowsByAuthMethod.forEach((authMethod, items) -> {
            long requestCount = items.stream().mapToLong(row -> parsePositiveLong(row.get("requestCount"), 0L)).sum();
            long errorCount = items.stream().mapToLong(row -> parsePositiveLong(row.get("errorCount"), 0L)).sum();
            double successRate = requestCount <= 0L ? 100D : ((double) (requestCount - errorCount) * 100D) / (double) requestCount;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("authMethod", authMethod);
            row.put("connectionCount", String.valueOf(items.size()));
            row.put("requestCount", String.valueOf(requestCount));
            row.put("errorCount", String.valueOf(errorCount));
            row.put("successRate", String.format(Locale.ROOT, "%.1f", successRate));
            rows.add(row);
        });
        rows.sort(Comparator.comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("requestCount"), 0L)).reversed());
        return rows;
    }

    private List<Map<String, String>> buildExternalUsageTrendRows(
            List<AccessEventRecordVO> accessEvents,
            List<ErrorEventRecordVO> errorEvents,
            boolean isEn) {
        Map<String, List<AccessEventRecordVO>> accessByDate = accessEvents.stream()
                .collect(Collectors.groupingBy(item -> usageDateKey(item == null ? null : item.getCreatedAt()), LinkedHashMap::new, Collectors.toList()));
        Map<String, List<ErrorEventRecordVO>> errorByDate = errorEvents.stream()
                .collect(Collectors.groupingBy(item -> usageDateKey(item == null ? null : item.getCreatedAt()), LinkedHashMap::new, Collectors.toList()));
        LinkedHashSet<String> dates = new LinkedHashSet<>();
        dates.addAll(accessByDate.keySet());
        dates.addAll(errorByDate.keySet());
        List<Map<String, String>> rows = new ArrayList<>();
        for (String date : dates) {
            if (safeString(date).isEmpty()) {
                continue;
            }
            List<AccessEventRecordVO> accessItems = accessByDate.getOrDefault(date, Collections.emptyList());
            List<ErrorEventRecordVO> errorItems = errorByDate.getOrDefault(date, Collections.emptyList());
            long slowCount = accessItems.stream()
                    .filter(item -> item != null && item.getDurationMs() != null && item.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS)
                    .count();
            String topConnection = accessItems.stream()
                    .collect(Collectors.groupingBy(item -> resolveIntegrationConnectionName(
                            safeString(item == null ? null : item.getApiId()),
                            normalizePerformanceUri(item == null ? null : item.getRequestUri()),
                            isEn), LinkedHashMap::new, Collectors.counting()))
                    .entrySet()
                    .stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("");
            Map<String, String> row = new LinkedHashMap<>();
            row.put("date", date);
            row.put("requestCount", String.valueOf(accessItems.size()));
            row.put("errorCount", String.valueOf(errorItems.size()));
            row.put("slowCount", String.valueOf(slowCount));
            row.put("topConnection", topConnection);
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("date")), Comparator.reverseOrder()));
        return rows.stream().limit(7).collect(Collectors.toList());
    }

    private String usageDateKey(String value) {
        String normalized = safeString(value);
        return normalized.length() >= 10 ? normalized.substring(0, 10) : normalized;
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

    private String formatDurationMs(long durationMs) {
        return durationMs + " ms";
    }

    private double parsePercentageValue(String value) {
        try {
            return Double.parseDouble(safeString(value));
        } catch (NumberFormatException ex) {
            return 0D;
        }
    }

    private long parsePositiveLong(String value, long defaultValue) {
        try {
            return Long.parseLong(safeString(value));
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
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

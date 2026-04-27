package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.feature.admin.service.ExternalConnectionProfileStoreService;
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
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalConnectionListPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalEventSnapshotService externalEventSnapshotService;
    private final ExternalConnectionProfileStoreService externalConnectionProfileStoreService;

    public Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn) {
        PlatformObservabilityExternalEventSnapshotService.ExternalEventSnapshot snapshot = externalEventSnapshotService.loadSnapshot();
        List<AccessEventRecordVO> accessEvents = snapshot.getAccessEvents();
        List<ErrorEventRecordVO> errorEvents = snapshot.getErrorEvents();
        List<TraceEventRecordVO> traceEvents = snapshot.getTraceEvents();

        List<Map<String, String>> connectionRows = mergeExternalConnectionRegistry(
                buildExternalConnectionRows(accessEvents, errorEvents, traceEvents, isEn),
                isEn);
        long unstableCount = connectionRows.stream()
                .filter(row -> !"HEALTHY".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        int avgLatency = connectionRows.isEmpty()
                ? 0
                : (int) Math.round(connectionRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("avgDurationMs"), 0L))
                .average()
                .orElse(0D));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", resolveExternalConnectionOverallStatus(connectionRows));
        payload.put("externalConnectionSummary", List.of(
                summaryMetricRow(
                        isEn ? "Observed Connections" : "관측 연결 수",
                        String.valueOf(connectionRows.size()),
                        isEn ? "Distinct API or endpoint connections observed from recent traces." : "최근 trace 기준으로 관측된 API 또는 엔드포인트 연결 수",
                        connectionRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Registered Profiles" : "등록 프로필 수",
                        String.valueOf(connectionRows.stream()
                                .filter(row -> "Y".equalsIgnoreCase(safeString(row.get("profileRegistered"))))
                                .count()),
                        isEn ? "Connections with saved registry profile data and operations ownership." : "운영 담당과 정책 정보가 저장된 외부연계 프로필 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Unstable Connections" : "불안정 연결",
                        String.valueOf(unstableCount),
                        isEn ? "Connections with repeated errors or slow latency." : "오류 반복 또는 지연이 높은 연결 수",
                        unstableCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Average Latency" : "평균 지연",
                        formatDurationMs(avgLatency),
                        isEn ? "Average response time across observed integration calls." : "관측된 연계 호출 전체 평균 응답시간",
                        avgLatency >= PERFORMANCE_SLOW_THRESHOLD_MS ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Recent API Errors" : "최근 API 오류",
                        String.valueOf(errorEvents.size()),
                        isEn ? "Recent error events linked to external integrations." : "외부연계와 연결된 최근 오류 이벤트 수",
                        errorEvents.size() > 0 ? "danger" : "neutral")));
        payload.put("externalConnectionRows", connectionRows);
        payload.put("externalConnectionIssueRows", buildExternalConnectionIssueRows(accessEvents, errorEvents, isEn));
        payload.put("externalConnectionQuickLinks", List.of(
                quickLinkRow(isEn ? "API Trace Log" : "API 추적 로그", localizedAdminPath("/system/unified_log/api-trace", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)),
                quickLinkRow(isEn ? "IP Whitelist" : "IP 화이트리스트", localizedAdminPath("/system/ip_whitelist", isEn)),
                quickLinkRow(isEn ? "Performance" : "성능", localizedAdminPath("/system/performance", isEn))));
        payload.put("externalConnectionGuidance", List.of(
                guidanceRow(
                        isEn ? "Read by endpoint" : "엔드포인트 기준 해석",
                        isEn ? "Each row merges recent access, trace, and error events by API id or request URI." : "각 행은 API ID 또는 요청 URI 기준으로 최근 access, trace, error 이벤트를 합친 결과입니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "When errors repeat" : "오류 반복 시",
                        isEn ? "Move into API trace log or observability using the linked route and compare response status, traceId, and actor context." : "링크된 화면에서 API trace 로그나 추적 조회로 이동해 response status, traceId, actor 맥락을 함께 비교합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "When access opens externally" : "외부 접근 개방 시",
                        isEn ? "Review whitelist approval and expiration before allowing vendor or partner ingress." : "협력사나 외부 기관 접근 허용 전에는 화이트리스트 승인과 만료 일정을 함께 점검합니다.",
                        "danger")));
        return payload;
    }

    private List<Map<String, String>> mergeExternalConnectionRegistry(List<Map<String, String>> observedRows, boolean isEn) {
        Map<String, Map<String, String>> merged = new LinkedHashMap<>();
        for (Map<String, String> row : observedRows) {
            merged.put(safeString(row.get("connectionKey")), new LinkedHashMap<>(row));
        }
        externalConnectionProfileStoreService.listProfiles().forEach(profile -> {
            Map<String, String> normalizedProfile = normalizeExternalConnectionPayload(profile, isEn);
            String connectionKey = firstNonBlank(
                    safeString(normalizedProfile.get("connectionId")),
                    safeString(normalizedProfile.get("endpointUrl")));
            if (connectionKey.isEmpty()) {
                return;
            }
            Map<String, String> existing = merged.getOrDefault(connectionKey, new LinkedHashMap<>());
            existing.put("connectionKey", connectionKey);
            existing.put("apiId", firstNonBlank(safeString(existing.get("apiId")), safeString(normalizedProfile.get("connectionId"))));
            existing.put("connectionName", safeString(normalizedProfile.get("connectionName")));
            existing.put("requestUri", firstNonBlank(safeString(normalizedProfile.get("endpointUrl")), safeString(existing.get("requestUri"))));
            existing.put("httpMethod", firstNonBlank(safeString(existing.get("httpMethod")), "POST"));
            existing.put("partnerName", safeString(normalizedProfile.get("partnerName")));
            existing.put("protocol", safeString(normalizedProfile.get("protocol")));
            existing.put("authMethod", safeString(normalizedProfile.get("authMethod")));
            existing.put("syncMode", safeString(normalizedProfile.get("syncMode")));
            existing.put("retryPolicy", safeString(normalizedProfile.get("retryPolicy")));
            existing.put("timeoutSeconds", safeString(normalizedProfile.get("timeoutSeconds")));
            existing.put("dataScope", safeString(normalizedProfile.get("dataScope")));
            existing.put("ownerName", safeString(normalizedProfile.get("ownerName")));
            existing.put("ownerContact", safeString(normalizedProfile.get("ownerContact")));
            existing.put("operationStatus", safeString(normalizedProfile.get("operationStatus")));
            existing.put("maintenanceWindow", safeString(normalizedProfile.get("maintenanceWindow")));
            existing.put("notes", safeString(normalizedProfile.get("notes")));
            existing.put("profileRegistered", "Y");
            existing.put("sourceType", safeString(existing.get("lastSeenAt")).isEmpty() ? "PROFILE_ONLY" : "REGISTERED_AND_OBSERVED");
            existing.put("lastSeenAt", firstNonBlank(safeString(existing.get("lastSeenAt")), isEn ? "Not observed yet" : "아직 관측 이력 없음"));
            existing.put("traceCount", firstNonBlank(safeString(existing.get("traceCount")), "0"));
            existing.put("successCount", firstNonBlank(safeString(existing.get("successCount")), "0"));
            existing.put("errorCount", firstNonBlank(safeString(existing.get("errorCount")), "0"));
            existing.put("avgDurationMs", firstNonBlank(safeString(existing.get("avgDurationMs")), "0"));
            if (safeString(existing.get("status")).isEmpty()) {
                existing.put("status", "REVIEW".equalsIgnoreCase(safeString(normalizedProfile.get("operationStatus"))) ? "WARNING" : "HEALTHY");
            }
            existing.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", safeString(normalizedProfile.get("connectionId"))));
            merged.put(connectionKey, existing);
        });
        return new ArrayList<>(merged.values());
    }

    private List<Map<String, String>> buildExternalConnectionRows(List<AccessEventRecordVO> accessEvents,
                                                                  List<ErrorEventRecordVO> errorEvents,
                                                                  List<TraceEventRecordVO> traceEvents,
                                                                  boolean isEn) {
        Map<String, List<AccessEventRecordVO>> accessByConnection = accessEvents.stream()
                .collect(Collectors.groupingBy(this::resolveIntegrationConnectionKey, LinkedHashMap::new, Collectors.toList()));
        Map<String, Long> traceCounts = traceEvents.stream()
                .collect(Collectors.groupingBy(this::resolveIntegrationConnectionKey, LinkedHashMap::new, Collectors.counting()));
        Map<String, List<ErrorEventRecordVO>> errorByConnection = errorEvents.stream()
                .collect(Collectors.groupingBy(this::resolveIntegrationConnectionKey, LinkedHashMap::new, Collectors.toList()));

        LinkedHashSet<String> connectionKeys = new LinkedHashSet<>();
        connectionKeys.addAll(accessByConnection.keySet());
        connectionKeys.addAll(traceCounts.keySet());
        connectionKeys.addAll(errorByConnection.keySet());

        List<Map<String, String>> rows = new ArrayList<>();
        for (String connectionKey : connectionKeys) {
            if (safeString(connectionKey).isEmpty()) {
                continue;
            }
            List<AccessEventRecordVO> events = accessByConnection.getOrDefault(connectionKey, Collections.emptyList());
            List<ErrorEventRecordVO> connectionErrors = errorByConnection.getOrDefault(connectionKey, Collections.emptyList());
            long avgDuration = Math.round(events.stream()
                    .map(AccessEventRecordVO::getDurationMs)
                    .filter(value -> value != null && value > 0)
                    .mapToInt(Integer::intValue)
                    .average()
                    .orElse(0D));
            int maxStatus = events.stream()
                    .map(AccessEventRecordVO::getResponseStatus)
                    .filter(value -> value != null)
                    .mapToInt(Integer::intValue)
                    .max()
                    .orElse(0);
            long errorCount = connectionErrors.size() + events.stream()
                    .filter(item -> item.getResponseStatus() != null && item.getResponseStatus() >= 400)
                    .count();
            long successCount = events.stream()
                    .filter(item -> item.getResponseStatus() != null && item.getResponseStatus() < 400)
                    .count();
            String apiId = firstNonBlank(
                    events.stream().map(AccessEventRecordVO::getApiId).filter(value -> !safeString(value).isEmpty()).findFirst().orElse(""),
                    connectionErrors.stream().map(ErrorEventRecordVO::getApiId).filter(value -> !safeString(value).isEmpty()).findFirst().orElse(""),
                    connectionKey.startsWith("/") ? "" : connectionKey);
            String requestUri = events.stream()
                    .map(AccessEventRecordVO::getRequestUri)
                    .map(this::normalizePerformanceUri)
                    .filter(value -> !value.isEmpty())
                    .findFirst()
                    .orElse(connectionKey.startsWith("/") ? connectionKey : "");
            String method = events.stream()
                    .map(AccessEventRecordVO::getHttpMethod)
                    .map(this::safeString)
                    .filter(value -> !value.isEmpty())
                    .findFirst()
                    .orElse("GET");
            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionKey", connectionKey);
            row.put("apiId", apiId);
            row.put("connectionName", resolveIntegrationConnectionName(apiId, requestUri, isEn));
            row.put("requestUri", requestUri);
            row.put("httpMethod", method);
            row.put("connectionId", apiId);
            row.put("endpointUrl", requestUri);
            row.put("protocol", "REST");
            row.put("authMethod", "OBSERVED");
            row.put("syncMode", "OBSERVED");
            row.put("operationStatus", "HEALTHY".equals(resolveExternalConnectionStatus(avgDuration, errorCount, maxStatus)) ? "ACTIVE" : "REVIEW");
            row.put("ownerName", isEn ? "Integration Team" : "외부연계팀");
            row.put("ownerContact", "integration@carbonet.local");
            row.put("profileRegistered", "N");
            row.put("sourceType", "OBSERVED");
            row.put("traceCount", String.valueOf(traceCounts.getOrDefault(connectionKey, 0L)));
            row.put("successCount", String.valueOf(successCount));
            row.put("errorCount", String.valueOf(errorCount));
            row.put("avgDurationMs", String.valueOf(avgDuration));
            row.put("lastStatus", maxStatus > 0 ? String.valueOf(maxStatus) : "-");
            row.put("lastSeenAt", resolveLatestIntegrationSeenAt(events, connectionErrors));
            row.put("status", resolveExternalConnectionStatus(avgDuration, errorCount, maxStatus));
            row.put("targetRoute", !safeString(apiId).isEmpty()
                    ? appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", apiId)
                    : appendQuery(localizedAdminPath("/system/unified_log", isEn), "searchKeyword", requestUri));
            rows.add(row);
        }
        rows.sort(Comparator
                .comparing((Map<String, String> row) -> statusRank(safeString(row.get("status"))))
                .reversed()
                .thenComparingLong(row -> parsePositiveLong(row.get("errorCount"), 0L)).reversed()
                .thenComparingLong(row -> parsePositiveLong(row.get("avgDurationMs"), 0L)).reversed()
                .thenComparing((Map<String, String> row) -> safeString(row.get("lastSeenAt")), Comparator.reverseOrder()));
        return rows;
    }

    private List<Map<String, String>> buildExternalConnectionIssueRows(List<AccessEventRecordVO> accessEvents,
                                                                       List<ErrorEventRecordVO> errorEvents,
                                                                       boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (ErrorEventRecordVO item : errorEvents.stream()
                .sorted(Comparator.comparing(ErrorEventRecordVO::getCreatedAt, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).reversed())
                .limit(8)
                .collect(Collectors.toList())) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("issueType", "ERROR");
            row.put("occurredAt", safeString(item.getCreatedAt()));
            row.put("connectionName", resolveIntegrationConnectionName(safeString(item.getApiId()), normalizePerformanceUri(item.getRequestUri()), isEn));
            row.put("status", firstNonBlank(safeString(item.getResultStatus()), "ERROR"));
            row.put("detail", firstNonBlank(safeString(item.getMessage()), safeString(item.getRequestUri()), safeString(item.getErrorType())));
            row.put("targetRoute", !safeString(item.getApiId()).isEmpty()
                    ? appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", safeString(item.getApiId()))
                    : appendQuery(localizedAdminPath("/system/error-log", isEn), "searchKeyword", safeString(item.getRequestUri())));
            rows.add(row);
        }
        for (AccessEventRecordVO item : accessEvents.stream()
                .filter(entry -> (entry.getDurationMs() != null && entry.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS)
                        || (entry.getResponseStatus() != null && entry.getResponseStatus() >= 400))
                .sorted(Comparator.comparing(AccessEventRecordVO::getCreatedAt, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).reversed())
                .limit(8)
                .collect(Collectors.toList())) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("issueType", item.getResponseStatus() != null && item.getResponseStatus() >= 400 ? "RESPONSE" : "LATENCY");
            row.put("occurredAt", safeString(item.getCreatedAt()));
            row.put("connectionName", resolveIntegrationConnectionName(safeString(item.getApiId()), normalizePerformanceUri(item.getRequestUri()), isEn));
            row.put("status", item.getResponseStatus() == null ? "" : String.valueOf(item.getResponseStatus()));
            row.put("detail", firstNonBlank(
                    (item.getDurationMs() == null ? "" : item.getDurationMs() + "ms"),
                    safeString(item.getErrorMessage()),
                    normalizePerformanceUri(item.getRequestUri())));
            row.put("targetRoute", !safeString(item.getApiId()).isEmpty()
                    ? appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", safeString(item.getApiId()))
                    : appendQuery(localizedAdminPath("/system/unified_log", isEn), "searchKeyword", normalizePerformanceUri(item.getRequestUri())));
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("occurredAt")), Comparator.reverseOrder()));
        return rows.stream().limit(12).collect(Collectors.toList());
    }

    private Map<String, String> normalizeExternalConnectionPayload(Map<String, String> payload, boolean isEn) {
        Map<String, String> normalized = defaultExternalConnectionProfile(isEn);
        if (payload == null) {
            return normalized;
        }
        normalized.put("connectionName", trimToDefault(payload.get("connectionName"), 120));
        normalized.put("connectionId", trimToDefault(payload.get("connectionId"), 60).toUpperCase(Locale.ROOT));
        normalized.put("partnerName", trimToDefault(payload.get("partnerName"), 120));
        normalized.put("endpointUrl", trimToDefault(payload.get("endpointUrl"), 255));
        normalized.put("protocol", trimToDefault(payload.get("protocol"), 20));
        normalized.put("authMethod", trimToDefault(payload.get("authMethod"), 30));
        normalized.put("syncMode", trimToDefault(payload.get("syncMode"), 30));
        normalized.put("retryPolicy", trimToDefault(payload.get("retryPolicy"), 40));
        normalized.put("timeoutSeconds", trimToDefault(payload.get("timeoutSeconds"), 10));
        normalized.put("dataScope", trimToDefault(payload.get("dataScope"), 200));
        normalized.put("ownerName", trimToDefault(payload.get("ownerName"), 80));
        normalized.put("ownerContact", trimToDefault(payload.get("ownerContact"), 120));
        normalized.put("operationStatus", trimToDefault(payload.get("operationStatus"), 30));
        normalized.put("maintenanceWindow", trimToDefault(payload.get("maintenanceWindow"), 80));
        normalized.put("notes", trimToDefault(payload.get("notes"), 1000));
        return normalized;
    }

    private Map<String, String> defaultExternalConnectionProfile(boolean isEn) {
        Map<String, String> profile = new LinkedHashMap<>();
        profile.put("connectionName", "");
        profile.put("connectionId", "");
        profile.put("partnerName", "");
        profile.put("endpointUrl", "https://");
        profile.put("protocol", "REST");
        profile.put("authMethod", "OAUTH2");
        profile.put("syncMode", "SCHEDULED");
        profile.put("retryPolicy", "EXP_BACKOFF_3");
        profile.put("timeoutSeconds", "30");
        profile.put("dataScope", "");
        profile.put("ownerName", "");
        profile.put("ownerContact", "");
        profile.put("operationStatus", "REVIEW");
        profile.put("maintenanceWindow", "Sun 01:00-02:00");
        profile.put("notes", isEn
                ? "Record token rotation owner, replay policy, and maintenance impact before requesting production approval."
                : "운영 승인 요청 전에 토큰 교체 담당, 재처리 정책, 점검 영향 범위를 먼저 기록합니다.");
        return profile;
    }

    private String trimToDefault(String value, int maxLength) {
        String normalized = safeString(value);
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private String resolveIntegrationConnectionKey(AccessEventRecordVO item) {
        return firstNonBlank(safeString(item == null ? null : item.getApiId()), normalizePerformanceUri(item == null ? null : item.getRequestUri()));
    }

    private String resolveIntegrationConnectionKey(ErrorEventRecordVO item) {
        return firstNonBlank(safeString(item == null ? null : item.getApiId()), normalizePerformanceUri(item == null ? null : item.getRequestUri()));
    }

    private String resolveIntegrationConnectionKey(TraceEventRecordVO item) {
        return firstNonBlank(safeString(item == null ? null : item.getApiId()), safeString(item == null ? null : item.getPageId()));
    }

    private String resolveIntegrationConnectionName(String apiId, String requestUri, boolean isEn) {
        if (!safeString(apiId).isEmpty()) {
            return apiId;
        }
        if (!safeString(requestUri).isEmpty()) {
            return requestUri;
        }
        return isEn ? "External connection" : "외부 연계";
    }

    private String resolveLatestIntegrationSeenAt(List<AccessEventRecordVO> accessEvents, List<ErrorEventRecordVO> errorEvents) {
        return Stream.concat(
                        accessEvents.stream().map(AccessEventRecordVO::getCreatedAt),
                        errorEvents.stream().map(ErrorEventRecordVO::getCreatedAt))
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .max(String.CASE_INSENSITIVE_ORDER)
                .orElse("");
    }

    private String resolveExternalConnectionStatus(long avgDuration, long errorCount, int maxStatus) {
        if (errorCount > 0 || maxStatus >= 500) {
            return "DEGRADED";
        }
        if (avgDuration >= PERFORMANCE_SLOW_THRESHOLD_MS || maxStatus >= 400) {
            return "WARNING";
        }
        return "HEALTHY";
    }

    private String resolveExternalConnectionOverallStatus(List<Map<String, String>> rows) {
        if (rows.stream().anyMatch(row -> "DEGRADED".equalsIgnoreCase(safeString(row.get("status"))))) {
            return "CRITICAL";
        }
        if (rows.stream().anyMatch(row -> "WARNING".equalsIgnoreCase(safeString(row.get("status"))))) {
            return "WARNING";
        }
        return rows.isEmpty() ? "WARNING" : "HEALTHY";
    }

    private int statusRank(String status) {
        switch (safeString(status).toUpperCase(Locale.ROOT)) {
            case "DEGRADED":
                return 3;
            case "WARNING":
                return 2;
            case "HEALTHY":
                return 1;
            default:
                return 0;
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

    private String normalizePerformanceUri(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        int queryIndex = normalized.indexOf('?');
        return queryIndex >= 0 ? normalized.substring(0, queryIndex) : normalized;
    }

    private String formatDurationMs(long value) {
        if (value <= 0L) {
            return "0 ms";
        }
        if (value >= 1000L) {
            return String.format(Locale.ROOT, "%.2f s", value / 1000D);
        }
        return value + " ms";
    }

    private long parsePositiveLong(String value, long defaultValue) {
        try {
            return Long.parseLong(safeString(value));
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
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

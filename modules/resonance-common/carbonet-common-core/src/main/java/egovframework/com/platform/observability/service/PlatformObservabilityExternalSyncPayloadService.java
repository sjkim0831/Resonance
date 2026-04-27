package egovframework.com.platform.observability.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalSyncPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;

    public Map<String, Object> buildExternalSyncPagePayload(boolean isEn) {
        Map<String, Object> connectionPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castStringRowList(connectionPayload.get("externalConnectionRows"));
        List<Map<String, String>> syncRows = buildExternalSyncRows(connectionRows, isEn);
        List<Map<String, String>> queueRows = buildExternalSyncQueueRows(syncRows, isEn);
        List<Map<String, String>> executionRows = buildExternalSyncExecutionRows(syncRows, isEn);
        long scheduledCount = syncRows.stream()
                .filter(row -> !"EVENT".equalsIgnoreCase(safeString(row.get("triggerType"))))
                .count();
        long reviewCount = syncRows.stream()
                .filter(row -> {
                    String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
                    return "REVIEW".equals(status) || "DEGRADED".equals(status) || "DISABLED".equals(status);
                })
                .count();
        long backlogCount = queueRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("backlogCount"), 0L))
                .sum();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("externalSyncSummary", List.of(
                summaryMetricRow(
                        isEn ? "Sync Targets" : "동기화 대상",
                        String.valueOf(syncRows.size()),
                        isEn ? "Registered partner connections tracked for scheduled or event-driven sync." : "정기 또는 이벤트 기반으로 추적 중인 외부 연계 대상 수",
                        syncRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Scheduled Jobs" : "정기 실행 잡",
                        String.valueOf(scheduledCount),
                        isEn ? "Targets using cron-like scheduled pulls or hybrid execution." : "스케줄 수집 또는 혼합형 실행을 사용하는 대상 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Queue Backlog" : "큐 적체",
                        String.valueOf(backlogCount),
                        isEn ? "Pending sync messages waiting for worker consumption." : "워커 소비를 기다리는 동기화 대기 메시지 수",
                        backlogCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Review Required" : "재검토 필요",
                        String.valueOf(reviewCount),
                        isEn ? "Connections with degraded sync health, backlog, or repeated errors." : "동기화 상태 저하, 적체, 반복 오류로 확인이 필요한 연계 수",
                        reviewCount > 0 ? "danger" : "neutral")));
        payload.put("externalSyncRows", syncRows);
        payload.put("externalSyncQueueRows", queueRows);
        payload.put("externalSyncExecutionRows", executionRows);
        payload.put("externalSyncQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Scheduler" : "스케줄러 관리", localizedAdminPath("/system/scheduler", isEn)),
                quickLinkRow(isEn ? "Batch Queue" : "배치 관리", localizedAdminPath("/system/batch", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn))));
        payload.put("externalSyncGuidance", List.of(
                guidanceRow(
                        isEn ? "Scheduled vs event-driven" : "정기 실행과 이벤트 실행",
                        isEn ? "Webhook targets stay event-driven, while scheduled and hybrid targets must keep next-run and backlog together." : "웹훅 대상은 이벤트 기반으로 유지하고, 스케줄/혼합형 대상은 다음 실행 시각과 적체를 함께 점검합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Before manual rerun" : "수동 재실행 전 확인",
                        isEn ? "Confirm retry policy, duplicate guard, and downstream maintenance windows before forcing a replay." : "강제 재실행 전에는 재시도 정책, 중복 방지, 하위 시스템 점검 시간대를 먼저 확인합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "When backlog rises" : "적체 증가 시",
                        isEn ? "Inspect worker ownership and connection-specific errors before scaling consumers or moving queues." : "소비자 증설이나 큐 이동 전에 담당 워커와 연계별 오류 증가 여부를 먼저 확인합니다.",
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

    private List<Map<String, String>> buildExternalSyncRows(List<Map<String, String>> connectionRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> connection : connectionRows) {
            index++;
            String connectionId = firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId")), "SYNC-" + index);
            String syncMode = firstNonBlank(safeString(connection.get("syncMode")), "SCHEDULED");
            String operationStatus = safeString(connection.get("operationStatus")).toUpperCase(Locale.ROOT);
            long errorCount = parsePositiveLong(connection.get("errorCount"), 0L);
            long avgDurationMs = parsePositiveLong(connection.get("avgDurationMs"), 0L);
            long backlogCount = "WEBHOOK".equalsIgnoreCase(syncMode)
                    ? Math.max(0L, errorCount)
                    : Math.max(0L, errorCount * 2L + (avgDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS ? 3L : 0L) + (index % 3L));

            Map<String, String> row = new LinkedHashMap<>();
            row.put("jobId", "EXT-" + String.format(Locale.ROOT, "%03d", index));
            row.put("connectionId", connectionId);
            row.put("connectionName", safeString(connection.get("connectionName")));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("syncMode", syncMode);
            row.put("triggerType", resolveExternalSyncTriggerType(syncMode));
            row.put("schedule", resolveExternalSyncSchedule(syncMode, index, isEn));
            row.put("endpointUrl", safeString(connection.get("endpointUrl")));
            row.put("lastSyncAt", firstNonBlank(safeString(connection.get("lastSeenAt")), "2026-03-30 09:00"));
            row.put("nextSyncAt", resolveExternalSyncNextRun(syncMode, index, isEn));
            row.put("backlogCount", String.valueOf(backlogCount));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("status", resolveExternalSyncStatus(operationStatus, errorCount, backlogCount, avgDurationMs));
            row.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> buildExternalSyncQueueRows(List<Map<String, String>> syncRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> syncRow : syncRows.stream().limit(6).collect(Collectors.toList())) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("queueId", "Q-" + safeString(syncRow.get("jobId")));
            row.put("queueName", safeString(syncRow.get("connectionName")) + " " + (isEn ? "sync queue" : "동기화 큐"));
            row.put("backlogCount", safeString(syncRow.get("backlogCount")));
            row.put("consumerNode", "integration-node-" + ((rows.size() % 3) + 1));
            row.put("lastMessageAt", safeString(syncRow.get("lastSyncAt")));
            row.put("status", safeString(syncRow.get("status")));
            rows.add(row);
        }
        rows.sort(Comparator.comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("backlogCount"), 0L)).reversed());
        return rows;
    }

    private List<Map<String, String>> buildExternalSyncExecutionRows(List<Map<String, String>> syncRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> syncRow : syncRows.stream().limit(8).collect(Collectors.toList())) {
            index++;
            long backlogCount = parsePositiveLong(syncRow.get("backlogCount"), 0L);
            String status = safeString(syncRow.get("status"));
            Map<String, String> row = new LinkedHashMap<>();
            row.put("executedAt", safeString(syncRow.get("lastSyncAt")));
            row.put("jobId", safeString(syncRow.get("jobId")));
            row.put("connectionName", safeString(syncRow.get("connectionName")));
            row.put("triggerType", safeString(syncRow.get("triggerType")));
            row.put("result", "ACTIVE".equalsIgnoreCase(status) ? "SUCCESS" : ("DEGRADED".equalsIgnoreCase(status) ? "REVIEW" : status));
            row.put("duration", (12 + (index * 7)) + "s");
            row.put("message", backlogCount > 0
                    ? (isEn ? "Backlog remained after the last sync window." : "최근 동기화 이후 대기 메시지가 남아 있습니다.")
                    : (isEn ? "Latest sync window completed within policy." : "최근 동기화 주기가 기준 시간 내에 완료되었습니다."));
            rows.add(row);
        }
        return rows;
    }

    private String resolveExternalSyncTriggerType(String syncMode) {
        String normalized = safeString(syncMode).toUpperCase(Locale.ROOT);
        if ("WEBHOOK".equals(normalized)) {
            return "EVENT";
        }
        if ("HYBRID".equals(normalized)) {
            return "HYBRID";
        }
        return "SCHEDULE";
    }

    private String resolveExternalSyncSchedule(String syncMode, int index, boolean isEn) {
        String normalized = safeString(syncMode).toUpperCase(Locale.ROOT);
        if ("WEBHOOK".equals(normalized)) {
            return isEn ? "Webhook / event driven" : "웹훅 / 이벤트 기반";
        }
        if ("HYBRID".equals(normalized)) {
            return "0/" + (15 + (index % 3) * 15) + " * * * * + webhook";
        }
        return "0/" + (10 + (index % 4) * 10) + " * * * *";
    }

    private String resolveExternalSyncNextRun(String syncMode, int index, boolean isEn) {
        String normalized = safeString(syncMode).toUpperCase(Locale.ROOT);
        if ("WEBHOOK".equals(normalized)) {
            return isEn ? "On next event" : "다음 이벤트 수신 시";
        }
        return "2026-03-30 1" + (index % 10) + ":" + String.format(Locale.ROOT, "%02d", (index * 5) % 60);
    }

    private String resolveExternalSyncStatus(String operationStatus, long errorCount, long backlogCount, long avgDurationMs) {
        if ("DISABLED".equalsIgnoreCase(operationStatus)) {
            return "DISABLED";
        }
        if (errorCount >= 3 || backlogCount >= 8 || avgDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS) {
            return "REVIEW";
        }
        if (errorCount > 0 || backlogCount > 0) {
            return "DEGRADED";
        }
        return "ACTIVE";
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

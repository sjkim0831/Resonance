package egovframework.com.platform.observability.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalMonitoringPayloadService {

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;
    private final PlatformObservabilityExternalUsagePayloadService externalUsagePayloadService;
    private final PlatformObservabilityExternalSyncPayloadService externalSyncPayloadService;
    private final PlatformObservabilityExternalWebhooksPayloadService externalWebhooksPayloadService;

    public Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn) {
        List<Map<String, String>> connectionRows = castStringRowList(
                externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn).get("externalConnectionRows"));
        List<Map<String, String>> usageRows = castStringRowList(
                externalUsagePayloadService.buildExternalUsagePagePayload(isEn).get("externalUsageRows"));
        List<Map<String, String>> syncRows = castStringRowList(
                externalSyncPayloadService.buildExternalSyncPagePayload(isEn).get("externalSyncRows"));
        List<Map<String, String>> webhookRows = castStringRowList(
                externalWebhooksPayloadService.buildExternalWebhooksPagePayload("", "ALL", "ALL", isEn).get("externalWebhookRows"));

        List<Map<String, String>> alertRows = buildExternalMonitoringAlertRows(usageRows, syncRows, webhookRows, isEn);
        List<Map<String, String>> monitoringRows = buildExternalMonitoringRows(connectionRows, usageRows, syncRows, alertRows, isEn);
        List<Map<String, String>> timelineRows = buildExternalMonitoringTimelineRows(alertRows, isEn);
        long reviewCount = monitoringRows.stream()
                .filter(row -> {
                    String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
                    return "REVIEW".equals(status) || "DEGRADED".equals(status);
                })
                .count();
        long backlogCount = monitoringRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("backlogCount"), 0L))
                .sum();
        long criticalCount = alertRows.stream()
                .filter(row -> "CRITICAL".equalsIgnoreCase(safeString(row.get("severity"))))
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", criticalCount > 0 ? "DEGRADED" : (reviewCount > 0 ? "REVIEW" : "ACTIVE"));
        payload.put("externalMonitoringSummary", List.of(
                summaryMetricRow(
                        isEn ? "Monitored Connections" : "모니터링 연계",
                        String.valueOf(monitoringRows.size()),
                        isEn ? "Observed partner integrations combined into one monitoring board." : "관측 중인 외부연계를 하나의 운영 보드로 통합한 수",
                        monitoringRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Open Alerts" : "활성 경보",
                        String.valueOf(alertRows.size()),
                        isEn ? "Backlog, delivery, and degradation alerts awaiting follow-up." : "적체, 전달 실패, 상태 저하 신호 중 후속 조치가 필요한 경보 수",
                        alertRows.isEmpty() ? "neutral" : "warning"),
                summaryMetricRow(
                        isEn ? "Review Required" : "재검토 필요",
                        String.valueOf(reviewCount),
                        isEn ? "Connections currently marked review or degraded." : "현재 REVIEW 또는 DEGRADED 상태로 운영 중인 연계 수",
                        reviewCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Queued Backlog" : "누적 적체",
                        String.valueOf(backlogCount),
                        isEn ? "Estimated pending messages across monitored sync queues." : "모니터링 대상 동기화 큐에 남아 있는 추정 대기 메시지 수",
                        backlogCount > 0 ? "warning" : "neutral")));
        payload.put("externalMonitoringRows", monitoringRows);
        payload.put("externalMonitoringAlertRows", alertRows);
        payload.put("externalMonitoringTimelineRows", timelineRows);
        payload.put("externalMonitoringQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Webhook Settings" : "웹훅 설정", localizedAdminPath("/external/webhooks", isEn)),
                quickLinkRow(isEn ? "API Usage" : "API 사용량", localizedAdminPath("/external/usage", isEn))));
        payload.put("externalMonitoringGuidance", List.of(
                guidanceRow(
                        isEn ? "Check cause before rerun" : "재실행 전 원인 확인",
                        isEn ? "Do not force a rerun until backlog cause, duplicate guard, and downstream maintenance windows are confirmed." : "적체 원인, 중복 방지, 하위 시스템 점검 시간을 먼저 확인하기 전에는 강제 재실행하지 않습니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Separate traffic from failure" : "트래픽과 실패를 분리 판단",
                        isEn ? "High traffic alone is not an incident. Escalate when traffic growth and success degradation appear together." : "호출량 증가만으로 장애로 보지 않습니다. 호출량 증가와 성공률 저하가 함께 나타날 때 우선 승격합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Escalate webhook drift early" : "웹훅 이상 조기 승격",
                        isEn ? "If delivery failure or degraded webhook state repeats, move into webhook settings before broadening retries." : "전달 실패나 웹훅 상태 저하가 반복되면 재시도 확대 전 먼저 웹훅 설정 화면에서 기준을 조정합니다.",
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

    private List<Map<String, String>> buildExternalMonitoringRows(
            List<Map<String, String>> connectionRows,
            List<Map<String, String>> usageRows,
            List<Map<String, String>> syncRows,
            List<Map<String, String>> alertRows,
            boolean isEn) {
        Map<String, Map<String, String>> usageByConnectionId = usageRows.stream()
                .collect(Collectors.toMap(row -> safeString(row.get("connectionId")), row -> row, (left, right) -> left, LinkedHashMap::new));
        Map<String, Map<String, String>> syncByConnectionId = syncRows.stream()
                .collect(Collectors.toMap(row -> safeString(row.get("connectionId")), row -> row, (left, right) -> left, LinkedHashMap::new));
        Map<String, List<Map<String, String>>> alertsByConnectionId = alertRows.stream()
                .collect(Collectors.groupingBy(row -> safeString(row.get("connectionId")), LinkedHashMap::new, Collectors.toList()));

        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> connection : connectionRows) {
            String connectionId = firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId")));
            Map<String, String> usage = usageByConnectionId.getOrDefault(connectionId, Collections.emptyMap());
            Map<String, String> sync = syncByConnectionId.getOrDefault(connectionId, Collections.emptyMap());
            List<Map<String, String>> alerts = alertsByConnectionId.getOrDefault(connectionId, Collections.emptyList());
            String status = "ACTIVE";
            for (Map<String, String> alert : alerts) {
                String severity = safeString(alert.get("severity")).toUpperCase(Locale.ROOT);
                if ("CRITICAL".equals(severity)) {
                    status = "DEGRADED";
                    break;
                }
                if ("HIGH".equals(severity) || "MEDIUM".equals(severity)) {
                    status = "REVIEW";
                }
            }

            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionId", connectionId);
            row.put("connectionName", firstNonBlank(safeString(connection.get("connectionName")), connectionId));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("protocol", firstNonBlank(safeString(connection.get("protocol")), safeString(connection.get("connectionType")), "REST"));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("requestCount", firstNonBlank(safeString(usage.get("requestCount")), "0"));
            row.put("successRate", firstNonBlank(safeString(usage.get("successRate")), "100%"));
            row.put("backlogCount", firstNonBlank(safeString(sync.get("backlogCount")), "0"));
            row.put("alertCount", String.valueOf(alerts.size()));
            row.put("topAlertLevel", alerts.isEmpty() ? "NONE" : safeString(alerts.get(0).get("severity")));
            row.put("lastObservedAt", firstNonBlank(
                    safeString(usage.get("lastSeenAt")),
                    safeString(sync.get("lastSyncAt")),
                    safeString(connection.get("lastSeenAt")),
                    "2026-03-30 09:00"));
            row.put("status", status);
            row.put("targetRoute", firstNonBlank(
                    safeString(connection.get("targetRoute")),
                    appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId)));
            rows.add(row);
        }

        rows.sort(Comparator
                .comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("alertCount"), 0L)).reversed()
                .thenComparing(Comparator.comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("backlogCount"), 0L)).reversed())
                .thenComparing(Comparator.comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("requestCount"), 0L)).reversed()));
        return rows;
    }

    private List<Map<String, String>> buildExternalMonitoringAlertRows(
            List<Map<String, String>> usageRows,
            List<Map<String, String>> syncRows,
            List<Map<String, String>> webhookRows,
            boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int sequence = 0;

        for (Map<String, String> row : syncRows) {
            long backlogCount = parsePositiveLong(row.get("backlogCount"), 0L);
            String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
            if (backlogCount >= 10L || "REVIEW".equals(status) || "DEGRADED".equals(status)) {
                sequence++;
                Map<String, String> alert = new LinkedHashMap<>();
                alert.put("alertId", "SYNC-" + sequence);
                alert.put("connectionId", safeString(row.get("connectionId")));
                alert.put("connectionName", safeString(row.get("connectionName")));
                alert.put("severity", backlogCount >= 25L ? "CRITICAL" : (backlogCount >= 10L ? "HIGH" : "MEDIUM"));
                alert.put("title", backlogCount >= 10L
                        ? (isEn ? "Sync backlog exceeded normal threshold." : "동기화 적체가 기준치를 초과했습니다.")
                        : (isEn ? "Sync target needs review." : "동기화 대상 재검토가 필요합니다."));
                alert.put("recommendedAction", isEn
                        ? "Review worker ownership, retry loops, and downstream maintenance windows."
                        : "워커 담당 노드, 재시도 루프, 하위 시스템 점검 시간대를 먼저 확인하세요.");
                alert.put("occurredAt", firstNonBlank(safeString(row.get("lastSyncAt")), "2026-03-30 09:00"));
                alert.put("targetRoute", firstNonBlank(safeString(row.get("targetRoute")), localizedAdminPath("/external/sync", isEn)));
                rows.add(alert);
            }
        }

        for (Map<String, String> row : usageRows) {
            long requestCount = parsePositiveLong(row.get("requestCount"), 0L);
            long errorCount = parsePositiveLong(row.get("errorCount"), 0L);
            String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
            if (errorCount >= 5L || "DEGRADED".equals(status) || "WARNING".equals(status)) {
                sequence++;
                Map<String, String> alert = new LinkedHashMap<>();
                alert.put("alertId", "USAGE-" + sequence);
                alert.put("connectionId", safeString(row.get("connectionId")));
                alert.put("connectionName", safeString(row.get("connectionName")));
                alert.put("severity", errorCount >= 10L ? "CRITICAL" : (requestCount >= 1000L ? "HIGH" : "MEDIUM"));
                alert.put("title", isEn ? "Error-heavy traffic was detected." : "오류가 집중된 호출량이 관측되었습니다.");
                alert.put("recommendedAction", isEn
                        ? "Separate upstream rollout issues from capacity changes before adjusting throughput."
                        : "처리량 조정보다 먼저 상위 시스템 배포 영향과 용량 문제를 분리해서 확인하세요.");
                alert.put("occurredAt", firstNonBlank(safeString(row.get("lastSeenAt")), "2026-03-30 09:00"));
                alert.put("targetRoute", firstNonBlank(safeString(row.get("targetRoute")), localizedAdminPath("/external/usage", isEn)));
                rows.add(alert);
            }
        }

        for (Map<String, String> row : webhookRows) {
            String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
            long failedCount = parsePositiveLong(row.get("failedCount"), 0L);
            if ("REVIEW".equals(status) || "DEGRADED".equals(status) || failedCount > 0L) {
                sequence++;
                Map<String, String> alert = new LinkedHashMap<>();
                alert.put("alertId", "WEBHOOK-" + sequence);
                alert.put("connectionId", safeString(row.get("connectionId")));
                alert.put("connectionName", safeString(row.get("connectionName")));
                alert.put("severity", failedCount >= 3L ? "HIGH" : "MEDIUM");
                alert.put("title", isEn ? "Webhook delivery health needs attention." : "웹훅 전달 상태 점검이 필요합니다.");
                alert.put("recommendedAction", isEn
                        ? "Inspect signature validation, timeout budget, and destination availability."
                        : "서명 검증, 타임아웃 예산, 대상 시스템 가용성을 먼저 점검하세요.");
                alert.put("occurredAt", firstNonBlank(safeString(row.get("lastEventAt")), "2026-03-30 09:00"));
                alert.put("targetRoute", firstNonBlank(safeString(row.get("targetRoute")), localizedAdminPath("/external/webhooks", isEn)));
                rows.add(alert);
            }
        }

        rows.sort(Comparator
                .comparingInt((Map<String, String> row) -> monitoringSeverityRank(safeString(row.get("severity"))))
                .thenComparing((Map<String, String> row) -> safeString(row.get("occurredAt")), Comparator.reverseOrder()));
        return rows;
    }

    private List<Map<String, String>> buildExternalMonitoringTimelineRows(List<Map<String, String>> alertRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> alert : alertRows.stream().limit(8).collect(Collectors.toList())) {
            index++;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("timelineId", "TIMELINE-" + index);
            row.put("occurredAt", firstNonBlank(safeString(alert.get("occurredAt")), "2026-03-30 09:00"));
            row.put("connectionName", safeString(alert.get("connectionName")));
            row.put("summary", firstNonBlank(safeString(alert.get("title")), isEn ? "Monitoring follow-up recorded." : "모니터링 후속 조치 포인트가 기록되었습니다."));
            row.put("targetRoute", safeString(alert.get("targetRoute")));
            rows.add(row);
        }
        if (rows.isEmpty()) {
            Map<String, String> emptyRow = new LinkedHashMap<>();
            emptyRow.put("timelineId", "TIMELINE-1");
            emptyRow.put("occurredAt", "2026-03-30 09:00");
            emptyRow.put("connectionName", isEn ? "All monitored connections" : "전체 모니터링 연계");
            emptyRow.put("summary", isEn ? "No immediate follow-up events were detected." : "즉시 후속 조치가 필요한 이벤트는 감지되지 않았습니다.");
            emptyRow.put("targetRoute", localizedAdminPath("/external/connection_list", isEn));
            rows.add(emptyRow);
        }
        return rows;
    }

    private int monitoringSeverityRank(String severity) {
        String normalized = safeString(severity).toUpperCase(Locale.ROOT);
        if ("CRITICAL".equals(normalized)) {
            return 0;
        }
        if ("HIGH".equals(normalized)) {
            return 1;
        }
        if ("MEDIUM".equals(normalized)) {
            return 2;
        }
        return 3;
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

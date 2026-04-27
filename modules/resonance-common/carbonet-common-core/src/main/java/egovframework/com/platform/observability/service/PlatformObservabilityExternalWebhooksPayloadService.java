package egovframework.com.platform.observability.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalWebhooksPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;

    public Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn) {
        List<Map<String, String>> connectionRows = castStringRowList(
                externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn).get("externalConnectionRows"));
        List<Map<String, String>> webhookRows = filterExternalWebhookRows(
                buildExternalWebhookRows(connectionRows, isEn),
                keyword,
                syncMode,
                status);
        List<Map<String, String>> deliveryRows = filterExternalWebhookDeliveryRows(
                buildExternalWebhookDeliveryRows(webhookRows, isEn),
                keyword,
                status);
        long reviewCount = webhookRows.stream()
                .filter(row -> {
                    String rowStatus = safeString(row.get("status")).toUpperCase(Locale.ROOT);
                    return "REVIEW".equals(rowStatus) || "DEGRADED".equals(rowStatus) || "DISABLED".equals(rowStatus);
                })
                .count();
        long activeCount = webhookRows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long failedDeliveries = deliveryRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("failedCount"), 0L))
                .sum();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("keyword", safeString(keyword));
        payload.put("syncMode", normalizeFilterValue(syncMode));
        payload.put("status", normalizeFilterValue(status));
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("externalWebhookSummary", List.of(
                summaryMetricRow(
                        isEn ? "Webhook Targets" : "웹훅 대상",
                        String.valueOf(webhookRows.size()),
                        isEn ? "Registered endpoints receiving event or hybrid webhook delivery." : "이벤트 또는 혼합형 웹훅 수신 대상으로 관리 중인 연계 수",
                        webhookRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Active Endpoints" : "정상 엔드포인트",
                        String.valueOf(activeCount),
                        isEn ? "Webhook targets currently marked active and deliverable." : "현재 활성 상태로 운영 중인 웹훅 엔드포인트 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Review Required" : "재검토 필요",
                        String.valueOf(reviewCount),
                        isEn ? "Endpoints with repeated failures, disabled signatures, or degraded health." : "반복 실패, 서명 비활성화, 상태 저하로 재검토가 필요한 엔드포인트 수",
                        reviewCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Failed Deliveries" : "실패 전달",
                        String.valueOf(failedDeliveries),
                        isEn ? "Estimated failed webhook deliveries across recent event windows." : "최근 이벤트 구간 기준 추정 웹훅 전달 실패 수",
                        failedDeliveries > 0 ? "warning" : "neutral")));
        payload.put("externalWebhookRows", webhookRows);
        payload.put("externalWebhookDeliveryRows", deliveryRows);
        payload.put("externalWebhookQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                quickLinkRow(isEn ? "Notification Center" : "알림센터", localizedAdminPath("/system/notification", isEn))));
        payload.put("externalWebhookGuidance", List.of(
                guidanceRow(
                        isEn ? "Signature and replay guard" : "서명과 재전송 방지",
                        isEn ? "Keep secret rotation, signature validation, and replay windows aligned before enabling public delivery." : "대외 공개 전에는 시크릿 교체, 서명 검증, 재전송 허용 구간을 함께 맞춰야 합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "When failures rise" : "실패 증가 시",
                        isEn ? "Check destination availability, timeout budget, and payload schema drift before forcing retries." : "재시도 전에 대상 시스템 가용성, 타임아웃 예산, payload 스키마 변경 여부를 먼저 확인합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "During maintenance windows" : "점검 시간대 운영",
                        isEn ? "Use disabled or review state intentionally and document fallback queues or digest notifications." : "점검 시간에는 의도적으로 비활성화 또는 검토 상태를 사용하고 대체 큐나 요약 알림 경로를 함께 기록합니다.",
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

    private List<Map<String, String>> buildExternalWebhookRows(List<Map<String, String>> connectionRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> connection : connectionRows) {
            String normalizedSyncMode = safeString(connection.get("syncMode")).toUpperCase(Locale.ROOT);
            if (!"WEBHOOK".equals(normalizedSyncMode) && !"HYBRID".equals(normalizedSyncMode)) {
                continue;
            }
            index++;
            String connectionId = firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId")), "WEBHOOK-" + index);
            long errorCount = parsePositiveLong(connection.get("errorCount"), 0L);
            long avgDurationMs = parsePositiveLong(connection.get("avgDurationMs"), 0L);
            String operationStatus = safeString(connection.get("operationStatus")).toUpperCase(Locale.ROOT);

            Map<String, String> row = new LinkedHashMap<>();
            row.put("webhookId", "WH-" + String.format(Locale.ROOT, "%03d", index));
            row.put("connectionId", connectionId);
            row.put("connectionName", safeString(connection.get("connectionName")));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("endpointUrl", safeString(connection.get("endpointUrl")));
            row.put("syncMode", normalizedSyncMode);
            row.put("status", resolveExternalSyncStatus(operationStatus, errorCount, Math.max(0L, errorCount), avgDurationMs));
            row.put("signatureStatus", errorCount > 2L ? (isEn ? "Rotate required" : "교체 필요") : (isEn ? "Healthy" : "정상"));
            row.put("lastEventAt", firstNonBlank(safeString(connection.get("lastSeenAt")), "2026-03-30 09:00"));
            row.put("deliveryWindow", firstNonBlank(safeString(connection.get("maintenanceWindow")), isEn ? "24x7 with 5m retry window" : "상시 운영 / 5분 재시도"));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("failedCount", String.valueOf(Math.max(0L, errorCount)));
            row.put("successRate", resolveWebhookSuccessRate(errorCount, avgDurationMs) + "%");
            row.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId));
            rows.add(row);
        }
        if (rows.isEmpty()) {
            Map<String, String> sample = new LinkedHashMap<>();
            sample.put("webhookId", "WH-001");
            sample.put("connectionId", "EXT-WEBHOOK-DEMO");
            sample.put("connectionName", isEn ? "Partner Event Relay" : "파트너 이벤트 릴레이");
            sample.put("partnerName", isEn ? "Demo Agency" : "샘플 기관");
            sample.put("endpointUrl", "https://partner.example.com/webhooks/carbonet");
            sample.put("syncMode", "WEBHOOK");
            sample.put("status", "REVIEW");
            sample.put("signatureStatus", isEn ? "Rotation overdue" : "교체 지연");
            sample.put("lastEventAt", "2026-03-30 09:00");
            sample.put("deliveryWindow", isEn ? "24x7 with manual fallback" : "상시 운영 / 수동 대체");
            sample.put("ownerName", isEn ? "Integration Team" : "외부연계팀");
            sample.put("failedCount", "3");
            sample.put("successRate", "97%");
            sample.put("targetRoute", localizedAdminPath("/external/connection_add", isEn));
            rows.add(sample);
        }
        return rows;
    }

    private List<Map<String, String>> buildExternalWebhookDeliveryRows(List<Map<String, String>> webhookRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> webhook : webhookRows) {
            index++;
            long failedCount = parsePositiveLong(webhook.get("failedCount"), 0L);
            long retriedCount = failedCount == 0L ? 0L : failedCount + (index % 3L);
            Map<String, String> row = new LinkedHashMap<>();
            row.put("deliveryId", "DLV-" + String.format(Locale.ROOT, "%03d", index));
            row.put("connectionName", safeString(webhook.get("connectionName")));
            row.put("eventType", resolveWebhookEventType(index, isEn));
            row.put("retryPolicy", index % 2 == 0 ? "EXP_BACKOFF_5" : "LINEAR_3");
            row.put("timeoutSeconds", String.valueOf(15 + (index % 3) * 5));
            row.put("failedCount", String.valueOf(failedCount));
            row.put("retriedCount", String.valueOf(retriedCount));
            row.put("deadLetterPolicy", index % 2 == 0 ? "DLQ_AFTER_5" : "DIGEST_AFTER_3");
            row.put("lastDeliveryAt", firstNonBlank(safeString(webhook.get("lastEventAt")), "2026-03-30 09:00"));
            row.put("status", safeString(webhook.get("status")));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> filterExternalWebhookRows(List<Map<String, String>> webhookRows, String keyword, String syncMode, String status) {
        String normalizedKeyword = safeString(keyword).trim().toLowerCase(Locale.ROOT);
        String normalizedSyncMode = normalizeFilterValue(syncMode);
        String normalizedStatus = normalizeFilterValue(status);
        return webhookRows.stream()
                .filter(row -> matchesExternalWebhookKeyword(row, normalizedKeyword))
                .filter(row -> "ALL".equals(normalizedSyncMode)
                        || normalizedSyncMode.equals(safeString(row.get("syncMode")).toUpperCase(Locale.ROOT)))
                .filter(row -> "ALL".equals(normalizedStatus)
                        || normalizedStatus.equals(safeString(row.get("status")).toUpperCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }

    private boolean matchesExternalWebhookKeyword(Map<String, String> row, String normalizedKeyword) {
        if (normalizedKeyword.isEmpty()) {
            return true;
        }
        String haystack = String.join(" ",
                safeString(row.get("webhookId")),
                safeString(row.get("connectionId")),
                safeString(row.get("connectionName")),
                safeString(row.get("partnerName")),
                safeString(row.get("endpointUrl")),
                safeString(row.get("ownerName"))).toLowerCase(Locale.ROOT);
        return haystack.contains(normalizedKeyword);
    }

    private List<Map<String, String>> filterExternalWebhookDeliveryRows(List<Map<String, String>> deliveryRows, String keyword, String status) {
        String normalizedKeyword = safeString(keyword).trim().toLowerCase(Locale.ROOT);
        String normalizedStatus = normalizeFilterValue(status);
        return deliveryRows.stream()
                .filter(row -> {
                    if (normalizedKeyword.isEmpty()) {
                        return true;
                    }
                    String haystack = String.join(" ",
                            safeString(row.get("deliveryId")),
                            safeString(row.get("connectionName")),
                            safeString(row.get("eventType"))).toLowerCase(Locale.ROOT);
                    return haystack.contains(normalizedKeyword);
                })
                .filter(row -> "ALL".equals(normalizedStatus)
                        || normalizedStatus.equals(safeString(row.get("status")).toUpperCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }

    private String normalizeFilterValue(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? "ALL" : normalized;
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

    private long resolveWebhookSuccessRate(long errorCount, long avgDurationMs) {
        long penalty = Math.min(18L, errorCount * 3L + (avgDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS ? 4L : 0L));
        return Math.max(81L, 100L - penalty);
    }

    private String resolveWebhookEventType(int index, boolean isEn) {
        switch (index % 4) {
            case 1:
                return isEn ? "Emission result updated" : "배출결과 변경";
            case 2:
                return isEn ? "Approval status changed" : "승인 상태 변경";
            case 3:
                return isEn ? "Member access incident" : "회원 접근 이상";
            default:
                return isEn ? "Batch completion digest" : "배치 완료 요약";
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

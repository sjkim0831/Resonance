package egovframework.com.platform.observability.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalMaintenancePayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;
    private final PlatformObservabilityExternalSyncPayloadService externalSyncPayloadService;

    public Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn) {
        List<Map<String, String>> connectionRows = castStringRowList(
                externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn).get("externalConnectionRows"));
        List<Map<String, String>> syncRows = castStringRowList(
                externalSyncPayloadService.buildExternalSyncPagePayload(isEn).get("externalSyncRows"));
        List<Map<String, String>> webhookRows = buildExternalWebhookRows(connectionRows, isEn);
        List<Map<String, String>> maintenanceRows = buildExternalMaintenanceRows(connectionRows, syncRows, webhookRows, isEn);
        List<Map<String, String>> impactRows = buildExternalMaintenanceImpactRows(maintenanceRows, isEn);
        long blockedCount = maintenanceRows.stream()
                .filter(row -> "BLOCKED".equalsIgnoreCase(safeString(row.get("maintenanceStatus"))))
                .count();
        long dueSoonCount = maintenanceRows.stream()
                .filter(row -> "DUE_SOON".equalsIgnoreCase(safeString(row.get("maintenanceStatus"))))
                .count();
        long webhookImpactCount = maintenanceRows.stream()
                .filter(row -> {
                    String impact = safeString(row.get("impactScope")).toUpperCase(Locale.ROOT);
                    return impact.contains("WEBHOOK") || impact.contains("이벤트");
                })
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("externalMaintenanceSummary", List.of(
                summaryMetricRow(
                        isEn ? "Tracked Windows" : "점검 대상",
                        String.valueOf(maintenanceRows.size()),
                        isEn ? "External connections with maintenance owner, fallback route, and recovery scope." : "점검 담당, 대체 경로, 복구 범위를 함께 추적하는 외부연계 대상 수",
                        maintenanceRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Due Soon" : "임박 점검",
                        String.valueOf(dueSoonCount),
                        isEn ? "Connections approaching the next planned maintenance or requiring pre-window checks." : "다음 점검 창이 임박했거나 사전 점검이 필요한 연계 수",
                        dueSoonCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Blocked" : "차단 상태",
                        String.valueOf(blockedCount),
                        isEn ? "Connections blocked by review state, backlog, or repeated failure signals." : "REVIEW 상태, 적체, 반복 실패 신호로 점검 진행이 막힌 연계 수",
                        blockedCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Webhook Impact" : "웹훅 영향",
                        String.valueOf(webhookImpactCount),
                        isEn ? "Maintenance windows that also affect partner webhook delivery." : "파트너 웹훅 전달까지 함께 영향을 받는 점검 대상 수",
                        webhookImpactCount > 0 ? "warning" : "neutral")));
        payload.put("externalMaintenanceRows", maintenanceRows);
        payload.put("externalMaintenanceImpactRows", impactRows);
        payload.put("externalMaintenanceRunbooks", buildExternalMaintenanceRunbooks(isEn));
        payload.put("externalMaintenanceQuickLinks", List.of(
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Webhooks" : "웹훅 설정", localizedAdminPath("/external/webhooks", isEn)),
                quickLinkRow(isEn ? "Retry Control" : "재시도 관리", localizedAdminPath("/external/retry", isEn)),
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn))));
        payload.put("externalMaintenanceGuidance", List.of(
                guidanceRow(
                        isEn ? "Freeze changes before the window" : "점검 전 변경 동결",
                        isEn ? "Confirm owner, fallback route, and duplicate-guard behavior before moving a connection into maintenance." : "연계를 점검 상태로 전환하기 전에 담당자, 대체 경로, 중복 방지 동작을 먼저 확인합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Watch backlog and event fan-out" : "적체와 이벤트 확산 확인",
                        isEn ? "Hybrid and webhook-linked rows need queue backlog and partner event fan-out reviewed together." : "혼합형과 웹훅 연계는 큐 적체와 파트너 이벤트 확산 범위를 함께 점검해야 합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Recovery proof is required" : "복구 증적 필수",
                        isEn ? "Verify health, next sync time, and partner delivery recovery before closing the maintenance window." : "점검 종료 전에는 상태 복구, 다음 실행 시각, 파트너 전달 회복 여부를 반드시 확인해야 합니다.",
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
            String syncMode = safeString(connection.get("syncMode")).toUpperCase(Locale.ROOT);
            if (!"WEBHOOK".equals(syncMode) && !"HYBRID".equals(syncMode)) {
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
            row.put("syncMode", syncMode);
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

    private List<Map<String, String>> buildExternalMaintenanceRows(
            List<Map<String, String>> connectionRows,
            List<Map<String, String>> syncRows,
            List<Map<String, String>> webhookRows,
            boolean isEn) {
        Map<String, Map<String, String>> syncByConnection = syncRows.stream()
                .collect(Collectors.toMap(row -> safeString(row.get("connectionId")), Function.identity(), (left, right) -> left, LinkedHashMap::new));
        Map<String, Map<String, String>> webhookByConnection = webhookRows.stream()
                .collect(Collectors.toMap(row -> safeString(row.get("connectionId")), Function.identity(), (left, right) -> left, LinkedHashMap::new));
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> connection : connectionRows) {
            index++;
            String connectionId = firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId")), "EXT-MAINT-" + index);
            Map<String, String> syncRow = syncByConnection.getOrDefault(connectionId, Map.of());
            Map<String, String> webhookRow = webhookByConnection.getOrDefault(connectionId, Map.of());
            long backlogCount = parsePositiveLong(syncRow.get("backlogCount"), 0L);
            long errorCount = parsePositiveLong(connection.get("errorCount"), 0L);
            String syncMode = firstNonBlank(safeString(connection.get("syncMode")), safeString(syncRow.get("syncMode")), "SCHEDULED");
            Map<String, String> row = new LinkedHashMap<>();
            row.put("maintenanceId", "MT-" + String.format(Locale.ROOT, "%03d", index));
            row.put("connectionId", connectionId);
            row.put("connectionName", firstNonBlank(safeString(connection.get("connectionName")), connectionId));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("syncMode", syncMode);
            row.put("maintenanceWindow", firstNonBlank(
                    safeString(connection.get("maintenanceWindow")),
                    safeString(webhookRow.get("deliveryWindow")),
                    defaultMaintenanceWindow(index, isEn)));
            row.put("plannedAt", plannedMaintenanceAt(index));
            row.put("fallbackRoute", resolveFallbackRoute(syncMode, !webhookRow.isEmpty(), isEn));
            row.put("impactScope", resolveMaintenanceImpactScope(syncMode, !webhookRow.isEmpty(), backlogCount, isEn));
            row.put("backlogCount", String.valueOf(backlogCount));
            row.put("lastSeenAt", firstNonBlank(safeString(connection.get("lastSeenAt")), safeString(syncRow.get("lastSyncAt"))));
            row.put("maintenanceStatus", resolveMaintenanceStatus(safeString(connection.get("operationStatus")), backlogCount, errorCount, index));
            row.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId));
            rows.add(row);
        }
        rows.sort(Comparator
                .comparing((Map<String, String> row) -> maintenanceStatusRank(safeString(row.get("maintenanceStatus"))))
                .reversed()
                .thenComparing((Map<String, String> row) -> safeString(row.get("plannedAt")))
                .thenComparing((Map<String, String> row) -> safeString(row.get("connectionName"))));
        return rows;
    }

    private List<Map<String, String>> buildExternalMaintenanceImpactRows(List<Map<String, String>> maintenanceRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> maintenanceRow : maintenanceRows.stream().limit(8).toList()) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionName", safeString(maintenanceRow.get("connectionName")));
            row.put("impactScope", safeString(maintenanceRow.get("impactScope")));
            row.put("fallbackRoute", safeString(maintenanceRow.get("fallbackRoute")));
            row.put("operatorAction", operatorActionForMaintenance(safeString(maintenanceRow.get("maintenanceStatus")), isEn));
            row.put("plannedAt", safeString(maintenanceRow.get("plannedAt")));
            row.put("targetRoute", safeString(maintenanceRow.get("targetRoute")));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> buildExternalMaintenanceRunbooks(boolean isEn) {
        return List.of(
                guidanceRow(
                        isEn ? "Pre-window checklist" : "사전 점검 체크리스트",
                        isEn ? "Freeze connection changes, verify owner contact, and confirm whether retries or queues must pause." : "연계 변경을 동결하고 담당자 연락망, 재시도 중지 여부, 큐 정지 여부를 먼저 확인합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "In-window execution" : "점검 중 운영 절차",
                        isEn ? "Route scheduled pulls to maintenance mode, watch backlog growth, and keep partner-facing webhook messaging explicit." : "정기 수집을 점검 상태로 전환하고 적체 증가를 관찰하며 파트너 웹훅 안내를 명확히 유지합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Post-window recovery" : "점검 후 복구 절차",
                        isEn ? "Check the next run time, delivery recovery, and unresolved blocked rows before closing the change ticket." : "다음 실행 시각, 전달 복구 여부, 차단 상태 잔여 건을 확인한 뒤 변경 티켓을 종료합니다.",
                        "danger"));
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

    private String resolveMaintenanceStatus(String operationStatus, long backlogCount, long errorCount, int index) {
        String normalized = safeString(operationStatus).toUpperCase(Locale.ROOT);
        if ("REVIEW".equals(normalized) || backlogCount >= 6L || errorCount >= 4L) {
            return "BLOCKED";
        }
        if (backlogCount > 0L || index % 3 == 0) {
            return "DUE_SOON";
        }
        return "READY";
    }

    private String resolveMaintenanceImpactScope(String syncMode, boolean hasWebhook, long backlogCount, boolean isEn) {
        String normalized = safeString(syncMode).toUpperCase(Locale.ROOT);
        if (hasWebhook || "WEBHOOK".equals(normalized) || "HYBRID".equals(normalized)) {
            return isEn ? "Webhook and partner event delivery" : "웹훅 및 파트너 이벤트 전달";
        }
        if (backlogCount > 0L) {
            return isEn ? "Scheduled pull with queue backlog" : "정기 수집 및 큐 적체 영향";
        }
        return isEn ? "Scheduled sync consumers" : "정기 동기화 소비자";
    }

    private String resolveFallbackRoute(String syncMode, boolean hasWebhook, boolean isEn) {
        String normalized = safeString(syncMode).toUpperCase(Locale.ROOT);
        if (hasWebhook || "WEBHOOK".equals(normalized)) {
            return isEn ? "Digest notification and replay queue" : "요약 알림 및 재처리 큐";
        }
        if ("HYBRID".equals(normalized)) {
            return isEn ? "Batch queue and manual replay" : "배치 큐 및 수동 재실행";
        }
        return isEn ? "Scheduled retry after maintenance" : "점검 후 예약 재시도";
    }

    private String defaultMaintenanceWindow(int index, boolean isEn) {
        switch (index % 3) {
            case 1:
                return isEn ? "Tue 02:00-03:00" : "화 02:00-03:00";
            case 2:
                return isEn ? "Wed 01:00-02:30" : "수 01:00-02:30";
            default:
                return isEn ? "Sun 01:00-02:00" : "일 01:00-02:00";
        }
    }

    private String plannedMaintenanceAt(int index) {
        LocalDateTime plannedAt = LocalDate.now().plusDays((index % 4) + 1L).atTime(1 + (index % 3), 0);
        return plannedAt.withSecond(0).withNano(0).toString().replace('T', ' ');
    }

    private int maintenanceStatusRank(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        if ("BLOCKED".equals(normalized)) {
            return 3;
        }
        if ("DUE_SOON".equals(normalized)) {
            return 2;
        }
        if ("READY".equals(normalized)) {
            return 1;
        }
        return 0;
    }

    private String operatorActionForMaintenance(String status, boolean isEn) {
        String normalized = safeString(status).toUpperCase(Locale.ROOT);
        if ("BLOCKED".equals(normalized)) {
            return isEn ? "Hold release and notify partner owner" : "배포 보류 후 파트너 담당자 통지";
        }
        if ("DUE_SOON".equals(normalized)) {
            return isEn ? "Confirm fallback and operator handoff" : "대체 경로와 운영 인계 확인";
        }
        return isEn ? "Keep monitoring baseline" : "모니터링 기준선 유지";
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

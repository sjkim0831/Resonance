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
public class PlatformObservabilityExternalRetryPayloadService {

    private final PlatformObservabilityExternalSyncPayloadService externalSyncPayloadService;

    public Map<String, Object> buildExternalRetryPagePayload(boolean isEn) {
        List<Map<String, String>> syncRows = castStringRowList(
                externalSyncPayloadService.buildExternalSyncPagePayload(isEn).get("externalSyncRows"));
        List<Map<String, String>> retryRows = buildExternalRetryRows(syncRows, isEn);
        List<Map<String, String>> retryPolicyRows = buildExternalRetryPolicyRows(retryRows, isEn);
        List<Map<String, String>> retryExecutionRows = buildExternalRetryExecutionRows(retryRows, isEn);
        long blockedCount = retryRows.stream()
                .filter(row -> "BLOCKED".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long manualCount = retryRows.stream()
                .filter(row -> "MANUAL".equalsIgnoreCase(safeString(row.get("retryClass"))))
                .count();
        long backlogCount = retryRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("backlogCount"), 0L))
                .sum();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", blockedCount > 0 ? "REVIEW" : "ACTIVE");
        payload.put("externalRetrySummary", List.of(
                summaryMetricRow(
                        isEn ? "Retry Candidates" : "재시도 대상",
                        String.valueOf(retryRows.size()),
                        isEn ? "Connections that currently need replay, deferred processing, or manual review." : "현재 재처리, 지연 처리, 수동 검토가 필요한 외부연계 대상 수",
                        retryRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Manual Approval" : "수동 승인 필요",
                        String.valueOf(manualCount),
                        isEn ? "Targets requiring explicit operator replay rather than immediate automatic retry." : "즉시 자동 재시도 대신 운영자 재실행 판단이 필요한 대상 수",
                        manualCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Queued Backlog" : "대기 적체",
                        String.valueOf(backlogCount),
                        isEn ? "Messages still waiting in retry or replay queues." : "재시도 또는 재처리 큐에 남아 있는 메시지 수",
                        backlogCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Blocked Replays" : "차단 재처리",
                        String.valueOf(blockedCount),
                        isEn ? "Targets blocked by duplicate guard, rate limit, or maintenance windows." : "중복 방지, rate limit, 점검 시간대로 재처리가 차단된 대상 수",
                        blockedCount > 0 ? "danger" : "neutral")));
        payload.put("externalRetryRows", retryRows);
        payload.put("externalRetryPolicyRows", retryPolicyRows);
        payload.put("externalRetryExecutionRows", retryExecutionRows);
        payload.put("externalRetryQuickLinks", List.of(
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Webhook Settings" : "웹훅 설정", localizedAdminPath("/external/webhooks", isEn)),
                quickLinkRow(isEn ? "Batch Queue" : "배치 관리", localizedAdminPath("/system/batch", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn))));
        payload.put("externalRetryGuidance", List.of(
                guidanceRow(
                        isEn ? "Replay is not the first move" : "재처리는 첫 조치가 아님",
                        isEn ? "Confirm root cause, duplicate guard, and downstream maintenance status before increasing replay pressure." : "재처리 강도를 높이기 전에 원인, 중복 방지, 하위 시스템 점검 상태를 먼저 확인합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Blocked means intentional control" : "차단 상태는 의도된 보호 장치",
                        isEn ? "Blocked rows usually mean duplicate windows, rate limits, or maintenance holds are active and should not be bypassed blindly." : "차단 행은 대개 중복 허용 구간, rate limit, 점검 보류가 활성화된 상태이므로 임의 우회를 피해야 합니다.",
                        "danger"),
                guidanceRow(
                        isEn ? "Keep retry policy aligned" : "재시도 정책 정합성 유지",
                        isEn ? "Connection-level retry, webhook delivery retry, and queue replay limits should stay aligned to avoid replay storms." : "연계 단위 재시도, 웹훅 전달 재시도, 큐 재처리 한도를 맞춰야 재처리 폭주를 피할 수 있습니다.",
                        "neutral")));
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

    private List<Map<String, String>> buildExternalRetryRows(List<Map<String, String>> syncRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> syncRow : syncRows) {
            long backlogCount = parsePositiveLong(syncRow.get("backlogCount"), 0L);
            String status = safeString(syncRow.get("status")).toUpperCase(Locale.ROOT);
            if (backlogCount <= 0L && "ACTIVE".equals(status)) {
                continue;
            }
            index++;
            long attemptCount = Math.max(1L, Math.min(5L, backlogCount > 0L ? backlogCount : index));
            long maxAttempts = "WEBHOOK".equalsIgnoreCase(safeString(syncRow.get("syncMode"))) ? 5L : 3L;
            String retryClass = resolveExternalRetryClass(syncRow, backlogCount, status);
            String guardStatus = resolveExternalRetryGuardStatus(backlogCount, status, attemptCount, maxAttempts, isEn);
            Map<String, String> row = new LinkedHashMap<>();
            row.put("queueId", "RQ-" + safeString(syncRow.get("jobId")));
            row.put("jobId", safeString(syncRow.get("jobId")));
            row.put("connectionId", safeString(syncRow.get("connectionId")));
            row.put("connectionName", safeString(syncRow.get("connectionName")));
            row.put("partnerName", safeString(syncRow.get("partnerName")));
            row.put("retryClass", retryClass);
            row.put("retryReason", resolveExternalRetryReason(syncRow, backlogCount, status, isEn));
            row.put("attemptCount", String.valueOf(attemptCount));
            row.put("maxAttempts", String.valueOf(maxAttempts));
            row.put("backlogCount", String.valueOf(backlogCount));
            row.put("guardStatus", guardStatus);
            row.put("nextRetryAt", resolveExternalRetryNextWindow(syncRow, backlogCount, status, index, isEn));
            row.put("ownerName", firstNonBlank(safeString(syncRow.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("status", resolveExternalRetryStatus(backlogCount, status, attemptCount, maxAttempts));
            row.put("targetRoute", safeString(syncRow.get("targetRoute")));
            rows.add(row);
        }
        if (rows.isEmpty() && !syncRows.isEmpty()) {
            Map<String, String> seed = syncRows.get(0);
            Map<String, String> row = new LinkedHashMap<>();
            row.put("queueId", "RQ-" + safeString(seed.get("jobId")));
            row.put("jobId", safeString(seed.get("jobId")));
            row.put("connectionId", safeString(seed.get("connectionId")));
            row.put("connectionName", safeString(seed.get("connectionName")));
            row.put("partnerName", safeString(seed.get("partnerName")));
            row.put("retryClass", "MANUAL");
            row.put("retryReason", isEn ? "Scheduled verification replay" : "정기 검증용 재처리");
            row.put("attemptCount", "1");
            row.put("maxAttempts", "3");
            row.put("backlogCount", "0");
            row.put("guardStatus", isEn ? "Healthy" : "정상");
            row.put("nextRetryAt", isEn ? "On operator approval" : "운영자 승인 시");
            row.put("ownerName", firstNonBlank(safeString(seed.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("status", "ACTIVE");
            row.put("targetRoute", safeString(seed.get("targetRoute")));
            rows.add(row);
        }
        rows.sort(Comparator
                .comparing((Map<String, String> row) -> safeString(row.get("status")))
                .thenComparingLong((Map<String, String> row) -> parsePositiveLong(row.get("backlogCount"), 0L)).reversed());
        return rows.stream().limit(10).collect(Collectors.toList());
    }

    private List<Map<String, String>> buildExternalRetryPolicyRows(List<Map<String, String>> retryRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> retryRow : retryRows) {
            index++;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("queueId", safeString(retryRow.get("queueId")));
            row.put("connectionId", safeString(retryRow.get("connectionId")));
            row.put("connectionName", safeString(retryRow.get("connectionName")));
            row.put("retryPolicy", "MANUAL".equalsIgnoreCase(safeString(retryRow.get("retryClass")))
                    ? "OPERATOR_GATE + EXP_BACKOFF_3"
                    : ("WEBHOOK".equalsIgnoreCase(safeString(retryRow.get("retryClass"))) ? "SIGNATURE_CHECK + LINEAR_5" : "EXP_BACKOFF_3"));
            row.put("guardWindow", (5 + (index % 4) * 5) + (isEn ? " minutes" : "분"));
            row.put("fallbackPolicy", "BLOCKED".equalsIgnoreCase(safeString(retryRow.get("status")))
                    ? (isEn ? "Hold queue + notify owner" : "큐 보류 + 담당자 알림")
                    : (isEn ? "DLQ after limit" : "한도 초과 시 DLQ"));
            row.put("ownerName", safeString(retryRow.get("ownerName")));
            row.put("status", safeString(retryRow.get("status")));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> buildExternalRetryExecutionRows(List<Map<String, String>> retryRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> retryRow : retryRows.stream().limit(8).collect(Collectors.toList())) {
            index++;
            Map<String, String> row = new LinkedHashMap<>();
            row.put("executedAt", resolveExternalRetryExecutedAt(index));
            row.put("jobId", safeString(retryRow.get("jobId")));
            row.put("connectionName", safeString(retryRow.get("connectionName")));
            row.put("result", "BLOCKED".equalsIgnoreCase(safeString(retryRow.get("status")))
                    ? "BLOCKED"
                    : ("REVIEW".equalsIgnoreCase(safeString(retryRow.get("status"))) ? "REVIEW" : "SUCCESS"));
            row.put("duration", (9 + index * 4) + "s");
            row.put("message", "BLOCKED".equalsIgnoreCase(safeString(retryRow.get("status")))
                    ? (isEn ? "Replay stayed blocked by duplicate or maintenance guard." : "중복 또는 점검 보호장치로 재처리가 차단되었습니다.")
                    : (isEn ? "Retry window executed under current queue policy." : "현재 큐 정책에 따라 재처리 구간이 실행되었습니다."));
            rows.add(row);
        }
        return rows;
    }

    private String resolveExternalRetryClass(Map<String, String> syncRow, long backlogCount, String status) {
        String syncMode = safeString(syncRow.get("syncMode")).toUpperCase(Locale.ROOT);
        if ("WEBHOOK".equals(syncMode)) {
            return "WEBHOOK";
        }
        if (backlogCount >= 4L || "REVIEW".equals(status)) {
            return "MANUAL";
        }
        return "AUTO";
    }

    private String resolveExternalRetryReason(Map<String, String> syncRow, long backlogCount, String status, boolean isEn) {
        if (backlogCount >= 8L) {
            return isEn ? "Backlog exceeded the replay baseline." : "적체가 재처리 기준선을 초과했습니다.";
        }
        if ("REVIEW".equals(status)) {
            return isEn ? "Repeated error or latency drift requires operator review." : "반복 오류 또는 지연 증가로 운영 검토가 필요합니다.";
        }
        if ("WEBHOOK".equalsIgnoreCase(safeString(syncRow.get("syncMode")))) {
            return isEn ? "Webhook delivery failure needs guarded replay." : "웹훅 전달 실패로 보호된 재처리가 필요합니다.";
        }
        return isEn ? "Deferred sync window left replayable messages." : "지연된 동기화 구간에 재처리 가능한 메시지가 남아 있습니다.";
    }

    private String resolveExternalRetryGuardStatus(long backlogCount, String status, long attemptCount, long maxAttempts, boolean isEn) {
        if (attemptCount >= maxAttempts) {
            return isEn ? "Attempt limit reached" : "시도 한도 도달";
        }
        if ("REVIEW".equals(status) && backlogCount >= 6L) {
            return isEn ? "Maintenance hold" : "점검 보류";
        }
        if (backlogCount >= 3L) {
            return isEn ? "Duplicate guard active" : "중복 방지 활성";
        }
        return isEn ? "Healthy" : "정상";
    }

    private String resolveExternalRetryNextWindow(Map<String, String> syncRow, long backlogCount, String status, int index, boolean isEn) {
        if ("BLOCKED".equals(resolveExternalRetryStatus(backlogCount, status,
                Math.max(1L, Math.min(5L, backlogCount > 0L ? backlogCount : index)),
                "WEBHOOK".equalsIgnoreCase(safeString(syncRow.get("syncMode"))) ? 5L : 3L))) {
            return isEn ? "After maintenance approval" : "점검 승인 이후";
        }
        if ("WEBHOOK".equalsIgnoreCase(safeString(syncRow.get("syncMode")))) {
            return isEn ? "On next signed delivery window" : "다음 서명 검증 구간";
        }
        return "2026-03-30 1" + (index % 10) + ":" + String.format(Locale.ROOT, "%02d", (index * 7) % 60);
    }

    private String resolveExternalRetryStatus(long backlogCount, String syncStatus, long attemptCount, long maxAttempts) {
        if (attemptCount >= maxAttempts) {
            return "BLOCKED";
        }
        if ("REVIEW".equalsIgnoreCase(syncStatus) || backlogCount >= 5L) {
            return "REVIEW";
        }
        if ("DEGRADED".equalsIgnoreCase(syncStatus) || backlogCount > 0L) {
            return "DEGRADED";
        }
        return "ACTIVE";
    }

    private String resolveExternalRetryExecutedAt(int index) {
        return "2026-03-30 0" + ((index + 1) % 10) + ":" + String.format(Locale.ROOT, "%02d", (index * 11) % 60);
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

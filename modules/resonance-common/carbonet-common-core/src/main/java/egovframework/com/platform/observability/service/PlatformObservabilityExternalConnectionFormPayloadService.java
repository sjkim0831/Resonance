package egovframework.com.platform.observability.service;

import egovframework.com.feature.admin.service.ExternalConnectionProfileStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalConnectionFormPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;
    private final ExternalConnectionProfileStoreService externalConnectionProfileStoreService;

    public Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn) {
        boolean addMode = "add".equalsIgnoreCase(safeString(mode));
        Map<String, Object> listPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castRows(listPayload.get("externalConnectionRows"));
        List<Map<String, String>> issueRows = castRows(listPayload.get("externalConnectionIssueRows"));

        Map<String, String> connectionProfile = addMode
                ? defaultExternalConnectionProfile(isEn)
                : loadExternalConnectionProfile(connectionId, connectionRows, isEn);
        String resolvedConnectionId = safeString(connectionProfile.get("connectionId"));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("mode", addMode ? "add" : "edit");
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("connectionProfile", connectionProfile);
        payload.put("externalConnectionFormSummary", buildExternalConnectionFormSummary(connectionProfile, connectionRows, isEn));
        payload.put("externalConnectionIssueRows", buildExternalConnectionFormIssueRows(issueRows, resolvedConnectionId));
        payload.put("externalConnectionQuickLinks", buildExternalConnectionFormQuickLinks(resolvedConnectionId, isEn));
        payload.put("externalConnectionGuidance", buildExternalConnectionFormGuidance(addMode, isEn));
        return payload;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> castRows(Object value) {
        if (value instanceof List<?>) {
            return (List<Map<String, String>>) value;
        }
        return Collections.emptyList();
    }

    private Map<String, String> loadExternalConnectionProfile(String connectionId,
                                                              List<Map<String, String>> connectionRows,
                                                              boolean isEn) {
        String normalizedConnectionId = safeString(connectionId).toUpperCase(Locale.ROOT);
        Map<String, String> persistedProfile = externalConnectionProfileStoreService.getProfile(normalizedConnectionId);
        if (persistedProfile != null && !persistedProfile.isEmpty()) {
            return new LinkedHashMap<>(persistedProfile);
        }
        if (!normalizedConnectionId.isEmpty()) {
            for (Map<String, String> row : connectionRows) {
                if (matchesExternalConnectionId(row, normalizedConnectionId)) {
                    LinkedHashMap<String, String> observedProfile = new LinkedHashMap<>(defaultExternalConnectionProfile(isEn));
                    observedProfile.putAll(row);
                    observedProfile.put("connectionId", firstNonBlank(
                            safeString(row.get("connectionId")),
                            safeString(row.get("apiId")),
                            normalizedConnectionId));
                    observedProfile.put("endpointUrl", firstNonBlank(
                            safeString(row.get("endpointUrl")),
                            safeString(row.get("requestUri")),
                            safeString(observedProfile.get("endpointUrl"))));
                    return observedProfile;
                }
            }
        }
        LinkedHashMap<String, String> fallback = new LinkedHashMap<>(defaultExternalConnectionProfile(isEn));
        fallback.put("connectionId", normalizedConnectionId);
        return fallback;
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

    private List<Map<String, String>> buildExternalConnectionFormSummary(Map<String, String> profile,
                                                                         List<Map<String, String>> connectionRows,
                                                                         boolean isEn) {
        Map<String, String> matchedRow = connectionRows.stream()
                .filter(row -> matchesExternalConnectionId(row, safeString(profile.get("connectionId"))))
                .findFirst()
                .orElse(Collections.emptyMap());
        String sourceType = firstNonBlank(safeString(profile.get("sourceType")), safeString(matchedRow.get("sourceType")), "REGISTERED");
        String lastSeenAt = firstNonBlank(safeString(profile.get("lastSeenAt")), safeString(matchedRow.get("lastSeenAt")), "-");
        String avgDurationMs = firstNonBlank(safeString(profile.get("avgDurationMs")), safeString(matchedRow.get("avgDurationMs")), "0");
        String traceCount = firstNonBlank(safeString(profile.get("traceCount")), safeString(matchedRow.get("traceCount")), "0");
        String errorCount = firstNonBlank(safeString(profile.get("errorCount")), safeString(matchedRow.get("errorCount")), "0");
        return List.of(
                summaryMetricRow(
                        isEn ? "Profile Source" : "프로필 기준",
                        sourceType,
                        isEn ? "Shows whether the profile comes from observed traffic or saved registry data." : "관측 트래픽 기반인지 저장된 레지스트리 기반인지 표시합니다.",
                        "OBSERVED".equalsIgnoreCase(sourceType) ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Last Seen" : "최근 관측",
                        lastSeenAt,
                        isEn ? "Most recent observed traffic for this connection." : "이 연계의 최근 관측 시각입니다.",
                        "-".equals(lastSeenAt) ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Observed Latency" : "관측 지연",
                        "0".equals(avgDurationMs) ? "-" : formatDurationMs(parsePositiveLong(avgDurationMs, 0L)),
                        isEn ? "Average latency across recent observed requests." : "최근 관측 요청 기준 평균 지연입니다.",
                        parsePositiveLong(avgDurationMs, 0L) >= PERFORMANCE_SLOW_THRESHOLD_MS ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Trace / Errors" : "추적 / 오류",
                        traceCount + " / " + errorCount,
                        isEn ? "Observed trace count and recent error count for this connection." : "이 연계의 관측 추적 수와 최근 오류 수입니다.",
                        parsePositiveLong(errorCount, 0L) > 0L ? "danger" : "neutral"));
    }

    private List<Map<String, String>> buildExternalConnectionFormIssueRows(List<Map<String, String>> issueRows,
                                                                           String connectionId) {
        List<Map<String, String>> matchedRows = issueRows.stream()
                .filter(row -> matchesExternalConnectionId(row, connectionId))
                .limit(5)
                .toList();
        if (!matchedRows.isEmpty()) {
            return matchedRows;
        }
        return issueRows.stream().limit(5).toList();
    }

    private List<Map<String, String>> buildExternalConnectionFormQuickLinks(String connectionId, boolean isEn) {
        String observabilityRoute = safeString(connectionId).isEmpty()
                ? localizedAdminPath("/system/observability", isEn)
                : appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", connectionId);
        return List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Schema Registry" : "스키마 현황", localizedAdminPath("/external/schema", isEn)),
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", observabilityRoute));
    }

    private List<Map<String, String>> buildExternalConnectionFormGuidance(boolean addMode, boolean isEn) {
        return List.of(
                guidanceRow(
                        addMode
                                ? (isEn ? "Register policy before opening traffic" : "트래픽 개방 전 정책 먼저 등록")
                                : (isEn ? "Review recent incidents before editing" : "수정 전에 최근 이슈 먼저 확인"),
                        addMode
                                ? (isEn ? "Capture owner, auth method, retry policy, and maintenance impact before the first live call." : "첫 실호출 전에는 담당자, 인증 방식, 재시도 정책, 점검 영향 범위를 먼저 기록합니다.")
                                : (isEn ? "When errors repeat, compare endpoint, auth, and timeout changes with recent incident history before saving." : "오류가 반복될 때는 저장 전에 최근 이력과 엔드포인트, 인증, timeout 변경을 함께 비교합니다."),
                        "warning"),
                guidanceRow(
                        isEn ? "Keep identifiers stable" : "식별자는 안정적으로 유지",
                        isEn ? "Use a durable connection ID so schema, sync, and observability screens can keep pointing at the same target." : "스키마, 동기화, 추적 화면이 같은 대상을 계속 가리키도록 연계 ID는 안정적으로 유지해야 합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Treat owner contact as runtime metadata" : "담당자 연락처도 런타임 메타데이터",
                        isEn ? "The owner contact should be current enough for retry approvals, outage escalations, and token rotation handoffs." : "담당자 연락처는 재처리 승인, 장애 전파, 토큰 교체 인수인계에 바로 쓸 수 있어야 합니다.",
                        "danger"));
    }

    private boolean matchesExternalConnectionId(Map<String, String> row, String connectionId) {
        String normalizedConnectionId = safeString(connectionId).toUpperCase(Locale.ROOT);
        if (normalizedConnectionId.isEmpty() || row == null || row.isEmpty()) {
            return false;
        }
        return normalizedConnectionId.equalsIgnoreCase(safeString(row.get("connectionId")))
                || normalizedConnectionId.equalsIgnoreCase(safeString(row.get("apiId")))
                || normalizedConnectionId.equalsIgnoreCase(safeString(row.get("connectionKey")));
    }

    private Map<String, String> summaryMetricRow(String label, String value, String description, String tone) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("value", value);
        row.put("description", description);
        row.put("tone", tone);
        return row;
    }

    private Map<String, String> quickLinkRow(String label, String href) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("href", href);
        return row;
    }

    private Map<String, String> guidanceRow(String title, String description, String tone) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("description", description);
        row.put("tone", tone);
        return row;
    }

    private String localizedAdminPath(String path, boolean isEn) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private String appendQuery(String path, String key, String value) {
        if (path == null) {
            return "";
        }
        String normalizedValue = safeString(value);
        if (normalizedValue.isEmpty()) {
            return path;
        }
        String separator = path.contains("?") ? "&" : "?";
        return path + separator + key + "=" + normalizedValue;
    }

    private String formatDurationMs(long durationMs) {
        if (durationMs >= 1000L) {
            return String.format(Locale.ROOT, "%.1fs", durationMs / 1000.0d);
        }
        return durationMs + "ms";
    }

    private long parsePositiveLong(String value, long fallback) {
        try {
            return Long.parseLong(safeString(value));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safeString(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

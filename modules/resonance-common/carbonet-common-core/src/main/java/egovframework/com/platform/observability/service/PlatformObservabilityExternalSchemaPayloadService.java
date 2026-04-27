package egovframework.com.platform.observability.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalSchemaPayloadService {

    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;

    public Map<String, Object> buildExternalSchemaPagePayload(boolean isEn) {
        Map<String, Object> connectionPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castStringRowList(connectionPayload.get("externalConnectionRows"));
        List<Map<String, String>> schemaRows = buildExternalSchemaRows(connectionRows, isEn);
        List<Map<String, String>> reviewRows = buildExternalSchemaReviewRows(schemaRows, isEn);
        long reviewCount = schemaRows.stream()
                .filter(row -> !"ACTIVE".equalsIgnoreCase(safeString(row.get("validationStatus"))))
                .count();
        long piiCount = schemaRows.stream()
                .filter(row -> {
                    String piiLevel = safeString(row.get("piiLevel")).toUpperCase(Locale.ROOT);
                    return "MODERATE".equals(piiLevel) || "HIGH".equals(piiLevel);
                })
                .count();
        long totalColumns = schemaRows.stream()
                .mapToLong(row -> parsePositiveLong(row.get("columnCount"), 0L))
                .sum();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", reviewCount > 0 ? "REVIEW" : "ACTIVE");
        payload.put("externalSchemaSummary", List.of(
                summaryMetricRow(
                        isEn ? "Managed Schemas" : "관리 스키마",
                        String.valueOf(schemaRows.size()),
                        isEn ? "External payload contracts grouped by observed or registered integration connection." : "관측 또는 등록된 외부연계 기준으로 묶은 payload 계약 수",
                        schemaRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Columns Tracked" : "추적 컬럼 수",
                        String.valueOf(totalColumns),
                        isEn ? "Canonical fields tracked for request, response, and sync control payloads." : "요청, 응답, 동기화 제어 payload에 대해 추적 중인 표준 필드 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Review Required" : "검토 필요",
                        String.valueOf(reviewCount),
                        isEn ? "Schemas with unstable source signals, version mismatch, or manual governance follow-up." : "원천 신호 불안정, 버전 차이, 수동 거버넌스 확인이 필요한 스키마 수",
                        reviewCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "PII Aware" : "개인정보 주의",
                        String.valueOf(piiCount),
                        isEn ? "Schemas that include identity or authorization fields and need tighter masking or retention review." : "식별/권한 필드가 포함되어 마스킹·보존 정책 검토가 필요한 스키마 수",
                        piiCount > 0 ? "warning" : "neutral")));
        payload.put("externalSchemaRows", schemaRows);
        payload.put("externalSchemaReviewRows", reviewRows);
        payload.put("externalSchemaQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "Full-Stack Management" : "풀스택 관리", localizedAdminPath("/system/full-stack-management", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn))));
        payload.put("externalSchemaGuidance", List.of(
                guidanceRow(
                        isEn ? "Schema rows are contract views" : "스키마 행은 계약 관점 요약",
                        isEn ? "Each row summarizes the canonical payload boundary for one integration rather than exposing raw request bodies." : "각 행은 개별 연계의 대표 payload 경계를 요약하며 원문 request body를 그대로 노출하지 않습니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Review breaking changes first" : "호환성 변경 우선 검토",
                        isEn ? "If version, required field count, or direction changes, align downstream parser, retry, and queue policy before rollout." : "버전, 필수 필드 수, 송수신 방향이 바뀌면 배포 전 하위 파서, 재시도, 큐 정책을 함께 맞춰야 합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Mask identity-bearing fields" : "식별 필드는 마스킹 우선",
                        isEn ? "Schemas with member, auth, or token semantics need masking, retention, and audit confirmation before wider sharing." : "회원, 인증, 토큰 성격의 필드가 있는 스키마는 공유 확대 전에 마스킹, 보존기간, 감사 근거를 먼저 확인해야 합니다.",
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

    private List<Map<String, String>> buildExternalSchemaRows(List<Map<String, String>> connectionRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int index = 0;
        for (Map<String, String> connection : connectionRows) {
            index++;
            String connectionId = firstNonBlank(safeString(connection.get("connectionId")), safeString(connection.get("apiId")), "EXT-" + index);
            String domain = resolveExternalSchemaDomain(connection);
            List<String> columns = resolveExternalSchemaColumns(connection, domain);
            String validationStatus = resolveExternalSchemaValidationStatus(connection, columns.size());
            String token = sanitizeExternalSchemaToken(connectionId, "EXT_" + index);

            Map<String, String> row = new LinkedHashMap<>();
            row.put("schemaId", token + "_PAYLOAD");
            row.put("connectionId", connectionId);
            row.put("connectionName", firstNonBlank(safeString(connection.get("connectionName")), connectionId));
            row.put("partnerName", safeString(connection.get("partnerName")));
            row.put("domain", domain);
            row.put("tableName", "EXT_" + token + "_PAYLOAD");
            row.put("direction", resolveExternalSchemaDirection(connection));
            row.put("schemaVersion", resolveExternalSchemaVersion(connection));
            row.put("protocol", firstNonBlank(safeString(connection.get("protocol")), "REST"));
            row.put("columnCount", String.valueOf(columns.size()));
            row.put("requiredFieldCount", String.valueOf(Math.max(3, Math.min(columns.size(), 4 + (index % 4)))));
            row.put("columns", String.join(", ", columns));
            row.put("ownerName", firstNonBlank(safeString(connection.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("piiLevel", resolveExternalSchemaPiiLevel(domain, columns));
            row.put("validationStatus", validationStatus);
            row.put("lastSeenAt", firstNonBlank(safeString(connection.get("lastSeenAt")), "2026-03-30 09:00"));
            row.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId));
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("validationStatus")))
                .thenComparing(row -> safeString(row.get("schemaId"))));
        return rows;
    }

    private List<Map<String, String>> buildExternalSchemaReviewRows(List<Map<String, String>> schemaRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> schemaRow : schemaRows) {
            String validationStatus = safeString(schemaRow.get("validationStatus")).toUpperCase(Locale.ROOT);
            String piiLevel = safeString(schemaRow.get("piiLevel")).toUpperCase(Locale.ROOT);
            if ("ACTIVE".equals(validationStatus) && "LOW".equals(piiLevel)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            row.put("schemaId", safeString(schemaRow.get("schemaId")));
            row.put("connectionName", safeString(schemaRow.get("connectionName")));
            row.put("reviewType", "ACTIVE".equals(validationStatus)
                    ? (isEn ? "Masking review" : "마스킹 검토")
                    : (isEn ? "Contract review" : "계약 검토"));
            row.put("reason", "ACTIVE".equals(validationStatus)
                    ? (isEn ? "Identity-bearing fields require masking and retention confirmation." : "식별 필드가 있어 마스킹·보존기간 확인이 필요합니다.")
                    : (isEn ? "Version, required fields, or source stability changed from the normal baseline." : "버전, 필수 필드, 원천 안정성이 기준선과 달라졌습니다."));
            row.put("ownerName", safeString(schemaRow.get("ownerName")));
            row.put("status", "ACTIVE".equals(validationStatus) ? "WATCH" : validationStatus);
            row.put("targetRoute", safeString(schemaRow.get("targetRoute")));
            rows.add(row);
        }
        if (rows.isEmpty()) {
            for (Map<String, String> schemaRow : schemaRows.stream().limit(3).collect(Collectors.toList())) {
                Map<String, String> row = new LinkedHashMap<>();
                row.put("schemaId", safeString(schemaRow.get("schemaId")));
                row.put("connectionName", safeString(schemaRow.get("connectionName")));
                row.put("reviewType", isEn ? "Routine review" : "정기 점검");
                row.put("reason", isEn ? "No immediate drift was detected. Keep version and field ownership current." : "즉시 조치가 필요한 이탈은 없습니다. 버전과 필드 담당 정보만 최신으로 유지하세요.");
                row.put("ownerName", safeString(schemaRow.get("ownerName")));
                row.put("status", "ACTIVE");
                row.put("targetRoute", safeString(schemaRow.get("targetRoute")));
                rows.add(row);
            }
        }
        return rows.stream().limit(8).collect(Collectors.toList());
    }

    private String resolveExternalSchemaDomain(Map<String, String> connection) {
        String haystack = String.join(" ",
                safeString(connection.get("connectionId")),
                safeString(connection.get("connectionName")),
                safeString(connection.get("partnerName")),
                safeString(connection.get("endpointUrl")),
                safeString(connection.get("requestUri")),
                safeString(connection.get("dataScope"))).toLowerCase(Locale.ROOT);
        if (containsAny(haystack, "member", "user", "join", "account", "auth")) {
            return "MEMBER";
        }
        if (containsAny(haystack, "emission", "carbon", "site", "project")) {
            return "EMISSION";
        }
        if (containsAny(haystack, "token", "key", "oauth", "cert")) {
            return "SECURITY";
        }
        if (containsAny(haystack, "batch", "queue", "sync", "schedule", "webhook")) {
            return "OPERATIONS";
        }
        return "COMMON";
    }

    private List<String> resolveExternalSchemaColumns(Map<String, String> connection, String domain) {
        LinkedHashSet<String> columns = new LinkedHashSet<>();
        columns.add("request_id");
        columns.add("partner_code");
        columns.add("sync_at");
        columns.add("status_code");
        String normalizedDomain = safeString(domain).toUpperCase(Locale.ROOT);
        if ("MEMBER".equals(normalizedDomain)) {
            columns.add("member_id");
            columns.add("company_id");
            columns.add("auth_scope");
        } else if ("EMISSION".equals(normalizedDomain)) {
            columns.add("site_id");
            columns.add("project_id");
            columns.add("emission_amount");
        } else if ("SECURITY".equals(normalizedDomain)) {
            columns.add("token_id");
            columns.add("expires_at");
            columns.add("issuer_code");
        } else if ("OPERATIONS".equals(normalizedDomain)) {
            columns.add("job_id");
            columns.add("queue_id");
            columns.add("retry_count");
        } else {
            columns.add("resource_id");
            columns.add("resource_type");
            columns.add("updated_at");
        }
        String protocol = safeString(connection.get("protocol")).toUpperCase(Locale.ROOT);
        if ("SFTP".equals(protocol) || "MQ".equals(protocol)) {
            columns.add("file_sequence");
        } else {
            columns.add("trace_id");
        }
        return new ArrayList<>(columns);
    }

    private String resolveExternalSchemaDirection(Map<String, String> connection) {
        String syncMode = safeString(connection.get("syncMode")).toUpperCase(Locale.ROOT);
        String endpoint = firstNonBlank(safeString(connection.get("endpointUrl")), safeString(connection.get("requestUri"))).toLowerCase(Locale.ROOT);
        if ("WEBHOOK".equals(syncMode) || endpoint.contains("webhook") || endpoint.contains("callback")) {
            return "INBOUND";
        }
        if ("HYBRID".equals(syncMode)) {
            return "BIDIRECTIONAL";
        }
        return "OUTBOUND";
    }

    private String resolveExternalSchemaVersion(Map<String, String> connection) {
        String protocol = safeString(connection.get("protocol")).toUpperCase(Locale.ROOT);
        if ("SOAP".equals(protocol)) {
            return "WSDL-1.0";
        }
        if ("SFTP".equals(protocol) || "MQ".equals(protocol)) {
            return "FLAT-1.0";
        }
        return "REST-2026.03";
    }

    private String resolveExternalSchemaPiiLevel(String domain, List<String> columns) {
        if ("MEMBER".equalsIgnoreCase(domain) || columns.stream().anyMatch(item -> item.contains("auth") || item.contains("token"))) {
            return "HIGH";
        }
        if ("COMMON".equalsIgnoreCase(domain)) {
            return "LOW";
        }
        return "MODERATE";
    }

    private String resolveExternalSchemaValidationStatus(Map<String, String> connection, int columnCount) {
        String operationStatus = safeString(connection.get("operationStatus")).toUpperCase(Locale.ROOT);
        long errorCount = parsePositiveLong(connection.get("errorCount"), 0L);
        long avgDurationMs = parsePositiveLong(connection.get("avgDurationMs"), 0L);
        if ("DISABLED".equals(operationStatus)) {
            return "DISABLED";
        }
        if ("REVIEW".equals(operationStatus) || errorCount >= 3 || avgDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS || columnCount >= 8) {
            return "REVIEW";
        }
        if (errorCount > 0) {
            return "WATCH";
        }
        return "ACTIVE";
    }

    private String sanitizeExternalSchemaToken(String value, String fallback) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        return normalized.isEmpty() ? fallback : normalized;
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) {
                return true;
            }
        }
        return false;
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

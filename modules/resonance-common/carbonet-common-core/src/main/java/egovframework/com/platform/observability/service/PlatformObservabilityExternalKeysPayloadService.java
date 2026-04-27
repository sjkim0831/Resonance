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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalKeysPayloadService {

    private final PlatformObservabilityExternalConnectionListPayloadService externalConnectionListPayloadService;

    public Map<String, Object> buildExternalKeysPagePayload(boolean isEn) {
        Map<String, Object> connectionPayload = externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn);
        List<Map<String, String>> connectionRows = castStringRowList(connectionPayload.get("externalConnectionRows"));
        List<Map<String, String>> keyRows = buildExternalKeyRows(connectionRows, isEn);
        List<Map<String, String>> rotationRows = buildExternalKeyRotationRows(keyRows, isEn);
        long expiringCount = keyRows.stream()
                .filter(row -> {
                    String rotationStatus = safeString(row.get("rotationStatus")).toUpperCase(Locale.ROOT);
                    return "ROTATE_SOON".equals(rotationStatus) || "ROTATE_NOW".equals(rotationStatus) || "EXPIRED".equals(rotationStatus);
                })
                .count();
        long manualCount = keyRows.stream()
                .filter(row -> "MANUAL".equalsIgnoreCase(safeString(row.get("rotationPolicy"))))
                .count();
        long observedOnlyCount = keyRows.stream()
                .filter(row -> "OBSERVED".equalsIgnoreCase(safeString(row.get("authMethod"))))
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("overallStatus", rotationRows.isEmpty() ? "HEALTHY" : safeString(rotationRows.get(0).get("rotationStatus")));
        payload.put("externalKeysSummary", List.of(
                summaryMetricRow(
                        isEn ? "Credential Records" : "인증키 관리 대상",
                        String.valueOf(keyRows.size()),
                        isEn ? "External connection credentials tracked without exposing secret values." : "비밀값 노출 없이 상태 추적 중인 외부 연계 인증키 수",
                        keyRows.isEmpty() ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Rotation Due" : "교체 필요",
                        String.valueOf(expiringCount),
                        isEn ? "Credentials nearing expiry or already outside the rotation window." : "만료 임박 또는 교체 허용 구간을 넘긴 인증키 수",
                        expiringCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Manual Rotation" : "수동 교체",
                        String.valueOf(manualCount),
                        isEn ? "Credentials that require coordinated manual rotation and handoff." : "수동 교체와 운영 인계가 함께 필요한 인증키 수",
                        manualCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Observed Only" : "관측 전용",
                        String.valueOf(observedOnlyCount),
                        isEn ? "Connections seen in logs but not yet registered with explicit credential governance." : "로그에서만 관측되고 아직 명시적 키 거버넌스에 등록되지 않은 연계 수",
                        observedOnlyCount > 0 ? "warning" : "neutral")));
        payload.put("externalKeyRows", keyRows);
        payload.put("externalKeyRotationRows", rotationRows);
        payload.put("externalKeyQuickLinks", List.of(
                quickLinkRow(isEn ? "Connection Registry" : "외부 연계 목록", localizedAdminPath("/external/connection_list", isEn)),
                quickLinkRow(isEn ? "Sync Execution" : "동기화 실행", localizedAdminPath("/external/sync", isEn)),
                quickLinkRow(isEn ? "IP Whitelist" : "IP 화이트리스트", localizedAdminPath("/system/ip_whitelist", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn))));
        payload.put("externalKeyGuidance", List.of(
                guidanceRow(
                        isEn ? "Do not expose secrets" : "비밀값 비노출 원칙",
                        isEn ? "Use this screen for ownership, expiry, and rotation timing only. Actual secrets must remain in secure storage." : "이 화면은 담당자, 만료, 교체 시점만 다룹니다. 실제 비밀값은 별도 안전 저장소에 유지해야 합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "Rotate with downstream windows" : "하위 시스템 점검 시간 연동",
                        isEn ? "Coordinate rotation with downstream maintenance windows and retry policy to avoid replay storms." : "교체 작업은 하위 시스템 점검 시간과 재시도 정책을 함께 확인한 뒤 수행해야 재처리 폭주를 막을 수 있습니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Observed rows need registration" : "관측 전용 행 등록 필요",
                        isEn ? "Observed-only rows should move into the connection registry once owner, auth method, and scope are confirmed." : "관측 전용 행은 담당자, 인증 방식, 권한 범위를 확정한 뒤 연결 레지스트리에 등록해 관리 대상으로 전환해야 합니다.",
                        "danger")));
        return payload;
    }

    private List<Map<String, String>> buildExternalKeyRows(List<Map<String, String>> connectionRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        LocalDate today = LocalDate.now();
        int index = 0;
        for (Map<String, String> connectionRow : connectionRows) {
            String connectionId = firstNonBlank(
                    safeString(connectionRow.get("connectionId")),
                    safeString(connectionRow.get("apiId")),
                    safeString(connectionRow.get("connectionKey")));
            if (connectionId.isEmpty()) {
                continue;
            }
            String authMethod = normalizeExternalAuthMethod(connectionRow.get("authMethod"));
            LocalDate lastRotatedAt = deriveCredentialRotationDate(today, authMethod, index);
            LocalDate expiresAt = deriveCredentialExpiryDate(lastRotatedAt, authMethod, index);
            String rotationStatus = resolveCredentialRotationStatus(expiresAt, today);
            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionId", connectionId);
            row.put("connectionName", firstNonBlank(safeString(connectionRow.get("connectionName")), connectionId));
            row.put("partnerName", safeString(connectionRow.get("partnerName")));
            row.put("credentialLabel", credentialLabel(authMethod, isEn));
            row.put("maskedReference", buildMaskedCredentialReference(connectionId, authMethod, index));
            row.put("authMethod", authMethod);
            row.put("scopeSummary", firstNonBlank(
                    safeString(connectionRow.get("dataScope")),
                    safeString(connectionRow.get("requestUri")),
                    isEn ? "Partner integration scope" : "연계 대상 범위"));
            row.put("lastRotatedAt", lastRotatedAt.toString());
            row.put("expiresAt", expiresAt.toString());
            row.put("rotationStatus", rotationStatus);
            row.put("rotationPolicy", rotationPolicy(authMethod));
            row.put("ownerName", firstNonBlank(safeString(connectionRow.get("ownerName")), isEn ? "Integration Team" : "외부연계팀"));
            row.put("ownerContact", firstNonBlank(safeString(connectionRow.get("ownerContact")), "integration@carbonet.local"));
            row.put("targetRoute", appendQuery(localizedAdminPath("/external/connection_edit", isEn), "connectionId", connectionId));
            rows.add(row);
            index++;
        }
        rows.sort(Comparator
                .comparing((Map<String, String> row) -> credentialRotationRank(safeString(row.get("rotationStatus"))))
                .reversed()
                .thenComparing((Map<String, String> row) -> safeString(row.get("expiresAt")), Comparator.naturalOrder())
                .thenComparing((Map<String, String> row) -> safeString(row.get("connectionName"))));
        return rows;
    }

    private List<Map<String, String>> buildExternalKeyRotationRows(List<Map<String, String>> keyRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> keyRow : keyRows) {
            String rotationStatus = safeString(keyRow.get("rotationStatus"));
            if ("HEALTHY".equalsIgnoreCase(rotationStatus)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            row.put("connectionId", safeString(keyRow.get("connectionId")));
            row.put("connectionName", safeString(keyRow.get("connectionName")));
            row.put("credentialLabel", safeString(keyRow.get("credentialLabel")));
            row.put("rotationWindow", safeString(keyRow.get("expiresAt")));
            row.put("rotationPolicy", safeString(keyRow.get("rotationPolicy")));
            row.put("rotationStatus", rotationStatus);
            row.put("reason", rotationReason(rotationStatus, safeString(keyRow.get("authMethod")), isEn));
            row.put("targetRoute", safeString(keyRow.get("targetRoute")));
            rows.add(row);
        }
        if (rows.isEmpty()) {
            Map<String, String> emptyRow = new LinkedHashMap<>();
            emptyRow.put("connectionId", "STABLE");
            emptyRow.put("connectionName", isEn ? "No immediate rotation blockers" : "즉시 교체가 필요한 항목 없음");
            emptyRow.put("credentialLabel", isEn ? "Monitoring baseline" : "모니터링 기준선");
            emptyRow.put("rotationWindow", LocalDate.now().plusDays(30).toString());
            emptyRow.put("rotationPolicy", "AUTO");
            emptyRow.put("rotationStatus", "HEALTHY");
            emptyRow.put("reason", isEn ? "Current credentials are inside the managed rotation window." : "현재 인증키는 관리 기준 교체 주기 안에 있습니다.");
            emptyRow.put("targetRoute", localizedAdminPath("/external/connection_list", isEn));
            rows.add(emptyRow);
        }
        return rows.stream().limit(8).collect(Collectors.toList());
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

    private String normalizeExternalAuthMethod(String authMethod) {
        String normalized = safeString(authMethod).toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "OBSERVED";
        }
        if ("OAUTH2_CLIENT".equals(normalized)) {
            return "OAUTH2";
        }
        if ("BASIC_AUTH".equals(normalized)) {
            return "BASIC";
        }
        return normalized;
    }

    private LocalDate deriveCredentialRotationDate(LocalDate today, String authMethod, int index) {
        int offset;
        switch (authMethod) {
            case "API_KEY":
                offset = 78 + (index % 3) * 9;
                break;
            case "OAUTH2":
                offset = 52 + (index % 4) * 6;
                break;
            case "MUTUAL_TLS":
                offset = 110 + (index % 2) * 15;
                break;
            case "BASIC":
                offset = 64 + (index % 3) * 7;
                break;
            default:
                offset = 35 + (index % 4) * 5;
                break;
        }
        return today.minusDays(offset);
    }

    private LocalDate deriveCredentialExpiryDate(LocalDate lastRotatedAt, String authMethod, int index) {
        int validDays;
        switch (authMethod) {
            case "API_KEY":
                validDays = 90;
                break;
            case "OAUTH2":
                validDays = 75;
                break;
            case "MUTUAL_TLS":
                validDays = 180;
                break;
            case "BASIC":
                validDays = 60;
                break;
            default:
                validDays = 45;
                break;
        }
        return lastRotatedAt.plusDays(validDays - (index % 3) * 4L);
    }

    private String resolveCredentialRotationStatus(LocalDate expiresAt, LocalDate today) {
        if (expiresAt.isBefore(today)) {
            return "EXPIRED";
        }
        if (!expiresAt.isAfter(today.plusDays(3))) {
            return "ROTATE_NOW";
        }
        if (!expiresAt.isAfter(today.plusDays(14))) {
            return "ROTATE_SOON";
        }
        return "HEALTHY";
    }

    private String credentialLabel(String authMethod, boolean isEn) {
        switch (authMethod) {
            case "API_KEY":
                return isEn ? "API key fingerprint" : "API 키 지문";
            case "OAUTH2":
                return isEn ? "Client secret binding" : "클라이언트 시크릿 바인딩";
            case "MUTUAL_TLS":
                return isEn ? "mTLS certificate pair" : "mTLS 인증서 페어";
            case "BASIC":
                return isEn ? "Basic credential alias" : "Basic 인증 별칭";
            default:
                return isEn ? "Observed credential placeholder" : "관측 전용 인증 placeholder";
        }
    }

    private String buildMaskedCredentialReference(String connectionId, String authMethod, int index) {
        String normalizedConnectionId = connectionId.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        String suffix = normalizedConnectionId.length() <= 4
                ? normalizedConnectionId
                : normalizedConnectionId.substring(normalizedConnectionId.length() - 4);
        return authMethod + "-****-" + String.format(Locale.ROOT, "%02d", (index % 17) + 1) + suffix;
    }

    private String rotationPolicy(String authMethod) {
        switch (authMethod) {
            case "API_KEY":
            case "BASIC":
                return "MANUAL";
            case "OBSERVED":
                return "REVIEW";
            default:
                return "AUTO";
        }
    }

    private int credentialRotationRank(String rotationStatus) {
        switch (safeString(rotationStatus).toUpperCase(Locale.ROOT)) {
            case "EXPIRED":
                return 4;
            case "ROTATE_NOW":
                return 3;
            case "ROTATE_SOON":
                return 2;
            case "HEALTHY":
                return 1;
            default:
                return 0;
        }
    }

    private String rotationReason(String rotationStatus, String authMethod, boolean isEn) {
        switch (safeString(rotationStatus).toUpperCase(Locale.ROOT)) {
            case "EXPIRED":
                return isEn ? "The managed rotation window is already exceeded." : "관리 기준 교체 주기를 이미 초과했습니다.";
            case "ROTATE_NOW":
                return isEn ? "Coordinate immediate rotation before the next downstream window closes." : "다음 하위 시스템 점검 창이 닫히기 전에 즉시 교체를 조율해야 합니다.";
            case "ROTATE_SOON":
                return isEn ? "Prepare owner handoff and secure-store update in this cycle." : "이번 주기 안에 담당자 인계와 안전 저장소 갱신을 준비해야 합니다.";
            default:
                return "OBSERVED".equalsIgnoreCase(authMethod)
                        ? (isEn ? "Observed-only connection needs explicit credential registration." : "관측 전용 연결이라 명시적 인증 등록이 필요합니다.")
                        : (isEn ? "Within the governed rotation baseline." : "관리 기준 교체 주기 안에 있습니다.");
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

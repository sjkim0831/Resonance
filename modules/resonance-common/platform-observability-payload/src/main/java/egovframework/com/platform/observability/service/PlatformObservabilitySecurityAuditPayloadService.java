package egovframework.com.platform.observability.service;

import egovframework.com.platform.observability.model.SecurityAuditSnapshot;
import egovframework.com.platform.service.observability.PlatformObservabilitySummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilitySecurityAuditPayloadService {

    private static final int SECURITY_AUDIT_PAGE_SIZE = 10;

    private final PlatformObservabilitySummaryReadPort adminSummaryReadPort;

    public Map<String, Object> buildSecurityAuditPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String actionType,
            String routeGroup,
            String startDate,
            String endDate,
            String sortKey,
            String sortDirection,
            boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        int pageIndex = parsePageIndex(pageIndexParam);
        String normalizedKeyword = safeString(searchKeyword);
        String normalizedActionType = normalizeSecurityAuditActionType(actionType);
        String normalizedRouteGroup = normalizeSecurityAuditRouteGroup(routeGroup);
        String normalizedStartDate = normalizeSecurityAuditDate(startDate);
        String normalizedEndDate = normalizeSecurityAuditDate(endDate);
        String normalizedSortKey = normalizeSecurityAuditSortKey(sortKey);
        String normalizedSortDirection = normalizeSecurityAuditSortDirection(sortDirection);
        SecurityAuditSnapshot auditSnapshot = adminSummaryReadPort.loadSecurityAuditSnapshot();
        List<Map<String, String>> allRows = adminSummaryReadPort.buildSecurityAuditRows(auditSnapshot.getAuditLogs(), isEn);
        List<Map<String, String>> filteredRows = filterAndSortSecurityAuditRows(
                allRows,
                normalizedKeyword,
                normalizedActionType,
                normalizedRouteGroup,
                normalizedStartDate,
                normalizedEndDate,
                normalizedSortKey,
                normalizedSortDirection);
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) SECURITY_AUDIT_PAGE_SIZE);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int startIndex = Math.max(currentPage - 1, 0) * SECURITY_AUDIT_PAGE_SIZE;
        int endIndex = Math.min(startIndex + SECURITY_AUDIT_PAGE_SIZE, filteredRows.size());
        List<Map<String, String>> pagedRows = startIndex >= endIndex
                ? Collections.emptyList()
                : new ArrayList<>(filteredRows.subList(startIndex, endIndex));

        payload.put("isEn", isEn);
        payload.put("pageIndex", currentPage);
        payload.put("pageSize", SECURITY_AUDIT_PAGE_SIZE);
        payload.put("totalCount", totalCount);
        payload.put("totalPages", totalPages);
        payload.put("searchKeyword", normalizedKeyword);
        payload.put("actionType", normalizedActionType);
        payload.put("routeGroup", normalizedRouteGroup);
        payload.put("startDate", normalizedStartDate);
        payload.put("endDate", normalizedEndDate);
        payload.put("sortKey", normalizedSortKey);
        payload.put("sortDirection", normalizedSortDirection);
        payload.put("filteredBlockedCount", filteredRows.stream().filter(this::isBlockedSecurityAuditRow).count());
        payload.put("filteredAllowedCount", filteredRows.stream().filter(this::isAllowedSecurityAuditRow).count());
        payload.put("filteredUniqueActorCount", filteredRows.stream()
                .map(row -> extractSecurityAuditActorId(safeString(row.get("actor"))))
                .filter(value -> !value.isEmpty())
                .distinct()
                .count());
        payload.put("filteredRouteCount", filteredRows.stream()
                .map(row -> safeString(row.get("target")))
                .filter(value -> !value.isEmpty())
                .distinct()
                .count());
        payload.put("filteredErrorCount", filteredRows.stream().filter(this::isSecurityAuditErrorRow).count());
        payload.put("filteredSlowCount", filteredRows.stream().filter(this::isSecurityAuditSlowRow).count());
        payload.put("filteredRepeatedActorCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> extractSecurityAuditActorId(safeString(row.get("actor")))));
        payload.put("filteredRepeatedTargetCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> safeString(row.get("target"))));
        payload.put("filteredRepeatedRemoteAddrCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> safeString(row.get("remoteAddr"))));
        payload.put("latestSecurityAuditRow", filteredRows.isEmpty() ? null : filteredRows.get(0));
        payload.put("securityAuditSummary", adminSummaryReadPort.getSecurityAuditSummary(auditSnapshot, isEn));
        payload.put("securityAuditRepeatedActors",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> extractSecurityAuditActorId(safeString(row.get("actor"))),
                        isEn ? "Actor" : "수행자"));
        payload.put("securityAuditRepeatedTargets",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> safeString(row.get("target")),
                        isEn ? "Target Route" : "대상 경로"));
        payload.put("securityAuditRepeatedRemoteAddrs",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> safeString(row.get("remoteAddr")),
                        isEn ? "Remote IP" : "원격 IP"));
        payload.put("securityAuditRows", pagedRows);
        return payload;
    }

    public String exportSecurityAuditCsv(
            String searchKeyword,
            String actionType,
            String routeGroup,
            String startDate,
            String endDate,
            String sortKey,
            String sortDirection,
            boolean isEn) {
        SecurityAuditSnapshot auditSnapshot = adminSummaryReadPort.loadSecurityAuditSnapshot();
        List<Map<String, String>> allRows = adminSummaryReadPort.buildSecurityAuditRows(auditSnapshot.getAuditLogs(), isEn);
        List<Map<String, String>> filteredRows = filterAndSortSecurityAuditRows(
                allRows,
                safeString(searchKeyword),
                normalizeSecurityAuditActionType(actionType),
                normalizeSecurityAuditRouteGroup(routeGroup),
                normalizeSecurityAuditDate(startDate),
                normalizeSecurityAuditDate(endDate),
                normalizeSecurityAuditSortKey(sortKey),
                normalizeSecurityAuditSortDirection(sortDirection));
        List<String> lines = new ArrayList<>();
        lines.add(String.join(",",
                csvCell(isEn ? "Audit Time" : "감사 시각"),
                csvCell(isEn ? "Actor" : "수행자"),
                csvCell(isEn ? "Action" : "행위"),
                csvCell(isEn ? "Target Route" : "대상 경로"),
                csvCell(isEn ? "Scope Detail" : "스코프 상세")));
        for (Map<String, String> row : filteredRows) {
            lines.add(String.join(",",
                    csvCell(safeString(row.get("auditAt"))),
                    csvCell(safeString(row.get("actor"))),
                    csvCell(safeString(row.get("action"))),
                    csvCell(safeString(row.get("target"))),
                    csvCell(safeString(row.get("detail")))));
        }
        return String.join("\n", lines);
    }

    private List<Map<String, String>> filterAndSortSecurityAuditRows(
            List<Map<String, String>> rows,
            String searchKeyword,
            String actionType,
            String routeGroup,
            String startDate,
            String endDate,
            String sortKey,
            String sortDirection) {
        List<Map<String, String>> filtered = new ArrayList<>();
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        for (Map<String, String> row : rows) {
            if (!matchesSecurityAuditActionType(row, actionType)) {
                continue;
            }
            if (!matchesSecurityAuditRouteGroup(row, routeGroup)) {
                continue;
            }
            if (!matchesSecurityAuditDateRange(row, startDate, endDate)) {
                continue;
            }
            if (!normalizedKeyword.isEmpty() && !matchesSecurityAuditKeyword(row, normalizedKeyword)) {
                continue;
            }
            filtered.add(new LinkedHashMap<>(row));
        }
        Comparator<Map<String, String>> comparator = securityAuditComparator(sortKey);
        filtered.sort("ASC".equals(sortDirection) ? comparator : comparator.reversed());
        return filtered;
    }

    private Comparator<Map<String, String>> securityAuditComparator(String sortKey) {
        switch (sortKey) {
            case "ACTOR":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> extractSecurityAuditActorId(stringValue(row.get("actor"))),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> stringValue(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "ACTION":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> stringValue(row.get("action")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> stringValue(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "TARGET":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> stringValue(row.get("target")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> stringValue(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "AUDIT_AT":
            default:
                return Comparator.<Map<String, String>, String>comparing(
                                row -> stringValue(row.get("auditAt")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> stringValue(row.get("target")), String.CASE_INSENSITIVE_ORDER);
        }
    }

    private boolean matchesSecurityAuditKeyword(Map<String, String> row, String normalizedKeyword) {
        String actor = safeString(row.get("actor"));
        String target = safeString(row.get("target"));
        String detail = safeString(row.get("detail"));
        String action = safeString(row.get("action"));
        return actor.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || target.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || detail.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || action.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || extractSecurityAuditActorId(actor).toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private boolean matchesSecurityAuditActionType(Map<String, String> row, String actionType) {
        if ("ALL".equals(actionType)) {
            return true;
        }
        if ("BLOCKED".equals(actionType)) {
            return isBlockedSecurityAuditRow(row);
        }
        if ("ALLOWED".equals(actionType)) {
            return isAllowedSecurityAuditRow(row);
        }
        return !isBlockedSecurityAuditRow(row) && !isAllowedSecurityAuditRow(row);
    }

    private boolean matchesSecurityAuditRouteGroup(Map<String, String> row, String routeGroup) {
        if ("ALL".equals(routeGroup)) {
            return true;
        }
        String target = safeString(row.get("target")).toLowerCase(Locale.ROOT);
        if ("BLOCK".equals(routeGroup)) {
            return target.contains("block") || target.contains("deny");
        }
        if ("POLICY".equals(routeGroup)) {
            return target.contains("policy");
        }
        return true;
    }

    private boolean matchesSecurityAuditDateRange(Map<String, String> row, String startDate, String endDate) {
        if (startDate.isEmpty() && endDate.isEmpty()) {
            return true;
        }
        LocalDate auditDate = parseSecurityAuditRowDate(safeString(row.get("auditAt")));
        if (auditDate == null) {
            return true;
        }
        LocalDate start = parseSecurityAuditDate(startDate);
        LocalDate end = parseSecurityAuditDate(endDate);
        if (start != null && auditDate.isBefore(start)) {
            return false;
        }
        if (end != null && auditDate.isAfter(end)) {
            return false;
        }
        return true;
    }

    private boolean isBlockedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("차단") || action.contains("blocked");
    }

    private boolean isAllowedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("허용") || action.contains("allowed");
    }

    private boolean isSecurityAuditErrorRow(Map<String, String> row) {
        int responseStatus = parsePositiveInt(safeString(row.get("responseStatus")), 0);
        return responseStatus >= 400 || !safeString(row.get("errorMessage")).isEmpty();
    }

    private boolean isSecurityAuditSlowRow(Map<String, String> row) {
        long durationMs = parsePositiveLong(safeString(row.get("durationMs")), 0L);
        return durationMs >= 1000L;
    }

    private long countRepeatedSecurityAuditValues(
            List<Map<String, String>> rows,
            Function<Map<String, String>, String> extractor) {
        return rows.stream()
                .map(extractor)
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .values()
                .stream()
                .filter(count -> count > 1)
                .count();
    }

    private List<Map<String, String>> buildRepeatedSecurityAuditRows(
            List<Map<String, String>> rows,
            Function<Map<String, String>, String> extractor,
            String label) {
        return rows.stream()
                .map(extractor)
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .entrySet()
                .stream()
                .filter(entry -> entry.getValue() > 1)
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(Map.Entry.comparingByKey(String.CASE_INSENSITIVE_ORDER)))
                .limit(5)
                .map(entry -> {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("label", label);
                    item.put("value", entry.getKey());
                    item.put("count", String.valueOf(entry.getValue()));
                    return item;
                })
                .collect(Collectors.toList());
    }

    private String extractSecurityAuditActorId(String actor) {
        String normalized = safeString(actor);
        int slashIndex = normalized.indexOf(" / ");
        if (slashIndex >= 0) {
            normalized = normalized.substring(0, slashIndex);
        }
        int typeStart = normalized.indexOf("(");
        if (typeStart >= 0) {
            normalized = normalized.substring(0, typeStart);
        }
        return safeString(normalized);
    }

    private String normalizeSecurityAuditActionType(String actionType) {
        String normalized = safeString(actionType).toUpperCase(Locale.ROOT);
        if ("BLOCKED".equals(normalized) || "ALLOWED".equals(normalized) || "REVIEWED".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeSecurityAuditRouteGroup(String routeGroup) {
        String normalized = safeString(routeGroup).toUpperCase(Locale.ROOT);
        if ("BLOCK".equals(normalized) || "POLICY".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeSecurityAuditSortKey(String sortKey) {
        String normalized = safeString(sortKey).toUpperCase(Locale.ROOT);
        if ("ACTOR".equals(normalized) || "ACTION".equals(normalized) || "TARGET".equals(normalized)) {
            return normalized;
        }
        return "AUDIT_AT";
    }

    private String normalizeSecurityAuditSortDirection(String sortDirection) {
        return "ASC".equalsIgnoreCase(safeString(sortDirection)) ? "ASC" : "DESC";
    }

    private String normalizeSecurityAuditDate(String value) {
        LocalDate parsed = parseSecurityAuditDate(value);
        return parsed == null ? "" : parsed.toString();
    }

    private LocalDate parseSecurityAuditDate(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private LocalDate parseSecurityAuditRowDate(String auditAt) {
        String normalized = safeString(auditAt);
        if (normalized.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(normalized.substring(0, 10));
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private int parsePageIndex(String pageIndexParam) {
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                return Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }

    private int parsePositiveInt(String value, int defaultValue) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private long parsePositiveLong(String value, long defaultValue) {
        try {
            return Long.parseLong(safeString(value));
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private String csvCell(String value) {
        return "\"" + safeString(value).replace("\"", "\"\"") + "\"";
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

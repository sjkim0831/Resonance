package egovframework.com.platform.bootstrap.service;

import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
public class AdminSecurityBootstrapReadService {

    private static final int SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE = 10;

    private final AdminSummaryReadPort adminSummaryReadPort;

    public Map<String, Object> buildSecurityPolicyPageData(boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        String adminPrefix = isEn ? "/en/admin" : "/admin";
        response.put("isEn", isEn);
        response.put("securityPolicySummary", adminSummaryReadPort.getSecurityPolicySummary(isEn));
        response.put("securityPolicyRows", buildSecurityPolicyRows(isEn));
        response.put("securityPolicyPlaybooks", buildSecurityPolicyPlaybooks(isEn));
        response.put("menuPermissionDiagnostics", adminSummaryReadPort.buildMenuPermissionDiagnosticSummary(isEn));
        response.put("menuPermissionDiagnosticSqlDownloadUrl", "/downloads/menu-permission-diagnostics.sql");
        response.put("menuPermissionAuthGroupUrl", adminPrefix + "/auth/group");
        response.put("menuPermissionEnvironmentUrl", adminPrefix + "/system/environment-management");
        return response;
    }

    public Map<String, Object> buildSecurityMonitoringPageData(boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("securityMonitoringCards", adminSummaryReadPort.getSecurityMonitoringCards(isEn));
        response.put("securityMonitoringTargets", adminSummaryReadPort.getSecurityMonitoringTargets(isEn));
        response.put("securityMonitoringIps", adminSummaryReadPort.getSecurityMonitoringIps(isEn));
        response.put("securityMonitoringEvents", adminSummaryReadPort.mergeSecurityMonitoringEventState(adminSummaryReadPort.getSecurityMonitoringEvents(isEn), isEn));
        response.put("securityMonitoringActivityRows", adminSummaryReadPort.getSecurityMonitoringActivityRows(isEn));
        response.put("securityMonitoringBlockCandidates", adminSummaryReadPort.getSecurityMonitoringBlockCandidateRows(isEn));
        return response;
    }

    public Map<String, Object> buildSecurityAuditPageData(
            String pageIndexParam,
            String searchKeyword,
            String actionType,
            String routeGroup,
            String startDate,
            String endDate,
            String sortKey,
            String sortDirection,
            boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        int pageIndex = 1;
        if (!safeString(pageIndexParam).isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }
        String normalizedKeyword = safeString(searchKeyword);
        String normalizedActionType = normalizeSecurityAuditActionType(actionType);
        String normalizedRouteGroup = normalizeSecurityAuditRouteGroup(routeGroup);
        String normalizedSortKey = normalizeSecurityAuditSortKey(sortKey);
        String normalizedSortDirection = normalizeSecurityAuditSortDirection(sortDirection);
        SecurityAuditSnapshot auditSnapshot = adminSummaryReadPort.loadSecurityAuditSnapshot();
        List<Map<String, String>> allRows = adminSummaryReadPort.buildSecurityAuditRows(auditSnapshot.getAuditLogs(), isEn);
        List<Map<String, String>> filteredRows = filterAndSortSecurityAuditRows(
                allRows,
                normalizedKeyword,
                normalizedActionType,
                normalizedRouteGroup,
                normalizedSortKey,
                normalizedSortDirection);
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int startIndex = Math.max(currentPage - 1, 0) * SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE;
        int endIndex = Math.min(startIndex + SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE, filteredRows.size());
        List<Map<String, String>> pagedRows = startIndex >= endIndex
                ? Collections.emptyList()
                : new ArrayList<>(filteredRows.subList(startIndex, endIndex));

        response.put("isEn", isEn);
        response.put("pageIndex", currentPage);
        response.put("pageSize", SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE);
        response.put("totalCount", totalCount);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", normalizedKeyword);
        response.put("actionType", normalizedActionType);
        response.put("routeGroup", normalizedRouteGroup);
        response.put("startDate", safeString(startDate));
        response.put("endDate", safeString(endDate));
        response.put("sortKey", normalizedSortKey);
        response.put("sortDirection", normalizedSortDirection);
        response.put("filteredErrorCount", filteredRows.stream().filter(this::isSecurityAuditErrorRow).count());
        response.put("filteredRepeatedActorCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> extractSecurityAuditActorId(safeString(row.get("actor")))));
        response.put("filteredRepeatedTargetCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> safeString(row.get("target"))));
        response.put("filteredRepeatedRemoteAddrCount",
                countRepeatedSecurityAuditValues(filteredRows, row -> safeString(row.get("remoteAddr"))));
        response.put("filteredSlowCount", filteredRows.stream().filter(this::isSecurityAuditSlowRow).count());
        response.put("securityAuditSummary", adminSummaryReadPort.getSecurityAuditSummary(auditSnapshot, isEn));
        response.put("securityAuditRepeatedActors",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> extractSecurityAuditActorId(safeString(row.get("actor"))),
                        isEn ? "Actor" : "수행자"));
        response.put("securityAuditRepeatedTargets",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> safeString(row.get("target")),
                        isEn ? "Target Route" : "대상 경로"));
        response.put("securityAuditRepeatedRemoteAddrs",
                buildRepeatedSecurityAuditRows(filteredRows,
                        row -> safeString(row.get("remoteAddr")),
                        isEn ? "Remote IP" : "원격 IP"));
        response.put("securityAuditRows", pagedRows);
        return response;
    }

    private List<Map<String, String>> buildSecurityPolicyRows(boolean isEn) {
        return List.of(
                mapOf("policyId", "POL-001", "targetUrl", "/signin/actionLogin", "policyName", isEn ? "User login protection" : "사용자 로그인 보호", "threshold", isEn ? "30 req/min per IP" : "IP당 분당 30회", "burst", isEn ? "5 req / 10 sec" : "10초 5회 burst", "action", isEn ? "Captcha -> 10 min block" : "CAPTCHA -> 10분 차단", "status", "ACTIVE", "updatedAt", "2026-03-12 08:20"),
                mapOf("policyId", "POL-002", "targetUrl", "/admin/login/actionLogin", "policyName", isEn ? "Admin login hardening" : "관리자 로그인 강화", "threshold", isEn ? "10 req/min per IP" : "IP당 분당 10회", "burst", isEn ? "3 req / 10 sec" : "10초 3회 burst", "action", isEn ? "Immediate 30 min block" : "즉시 30분 차단", "status", "ACTIVE", "updatedAt", "2026-03-12 08:25"),
                mapOf("policyId", "POL-003", "targetUrl", "/api/search/**", "policyName", isEn ? "Search API throttle" : "검색 API 제어", "threshold", isEn ? "120 req/min per token" : "토큰당 분당 120회", "burst", isEn ? "20 req / 10 sec" : "10초 20회 burst", "action", isEn ? "429 + alert" : "429 + 알림", "status", "ACTIVE", "updatedAt", "2026-03-11 18:10"));
    }

    private List<Map<String, String>> buildSecurityPolicyPlaybooks(boolean isEn) {
        return List.of(
                mapOf("title", isEn ? "Login attack playbook" : "로그인 공격 플레이북", "body", isEn ? "Raise admin login threshold only after verifying WAF and captcha counters." : "WAF 및 CAPTCHA 지표 확인 후에만 관리자 로그인 임계치를 상향합니다."),
                mapOf("title", isEn ? "Search API degradation" : "검색 API 완화 전략", "body", isEn ? "If 429 spikes persist for over 10 minutes, shift to token-based limits and cache prebuilt queries." : "429 급증이 10분 이상 지속되면 토큰 기준 제한과 캐시 응답으로 전환합니다."),
                mapOf("title", isEn ? "Emergency block release" : "긴급 차단 해제", "body", isEn ? "Release only after verifying owner, CIDR, expiry time, and related gateway policy." : "소유 조직, CIDR, 만료 시각, 게이트웨이 정책 연동을 모두 확인한 뒤 해제합니다."));
    }

    private List<Map<String, String>> filterAndSortSecurityAuditRows(
            List<Map<String, String>> rows,
            String searchKeyword,
            String actionType,
            String routeGroup,
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
                                row -> extractSecurityAuditActorId(safeString(row.get("actor"))),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "ACTION":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("action")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "TARGET":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("target")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "AUDIT_AT":
            default:
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("auditAt")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("target")), String.CASE_INSENSITIVE_ORDER);
        }
    }

    private boolean matchesSecurityAuditKeyword(Map<String, String> row, String normalizedKeyword) {
        String actor = safeString(row.get("actor"));
        return actor.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("target")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("detail")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("action")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
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

    private boolean isBlockedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("차단") || action.contains("blocked");
    }

    private boolean isAllowedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("허용") || action.contains("allowed");
    }

    private boolean isSecurityAuditErrorRow(Map<String, String> row) {
        try {
            return Integer.parseInt(safeString(row.get("responseStatus"))) >= 400 || !safeString(row.get("errorMessage")).isEmpty();
        } catch (NumberFormatException ignored) {
            return !safeString(row.get("errorMessage")).isEmpty();
        }
    }

    private boolean isSecurityAuditSlowRow(Map<String, String> row) {
        try {
            return Long.parseLong(safeString(row.get("durationMs"))) >= 1000L;
        } catch (NumberFormatException ignored) {
            return false;
        }
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
                .map(entry -> mapOf("label", label, "value", entry.getKey(), "count", String.valueOf(entry.getValue())))
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
        return normalized.trim();
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
        return "ASC".equals(safeString(sortDirection).toUpperCase(Locale.ROOT)) ? "ASC" : "DESC";
    }

    private Map<String, String> mapOf(String... values) {
        Map<String, String> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(values[index], values[index + 1]);
        }
        return row;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

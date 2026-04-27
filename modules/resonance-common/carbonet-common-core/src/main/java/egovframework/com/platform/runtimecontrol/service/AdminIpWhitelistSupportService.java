package egovframework.com.platform.runtimecontrol.service;

import egovframework.com.platform.runtimecontrol.service.IpWhitelistPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminIpWhitelistSupportService {

    private final ObjectProvider<IpWhitelistPersistenceService> ipWhitelistPersistenceServiceProvider;

    public Map<String, Object> buildPageData(boolean isEn, String searchIp, String accessScope, String status) {
        String normalizedKeyword = safeString(searchIp).toLowerCase(Locale.ROOT);
        String normalizedScope = safeString(accessScope).toUpperCase(Locale.ROOT);
        String normalizedStatus = safeString(status).toUpperCase(Locale.ROOT);
        List<Map<String, String>> allRows = buildEffectiveIpWhitelistRows();
        List<Map<String, String>> filteredRows = new ArrayList<>();
        for (Map<String, String> row : allRows) {
            if (!normalizedKeyword.isEmpty() && !matchesIpWhitelistKeyword(row, normalizedKeyword)) {
                continue;
            }
            if (!normalizedScope.isEmpty() && !normalizedScope.equalsIgnoreCase(safeString(row.get("accessScope")))) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(safeString(row.get("status")))) {
                continue;
            }
            filteredRows.add(row);
        }

        List<Map<String, String>> allRequests = buildEffectiveIpWhitelistRequests();
        List<Map<String, String>> filteredRequests = new ArrayList<>();
        for (Map<String, String> row : allRequests) {
            if (!matchesIpWhitelistRequestFilter(row, normalizedKeyword, normalizedScope, normalizedStatus)) {
                continue;
            }
            filteredRequests.add(row);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ipWhitelistRows", filteredRows);
        payload.put("ipWhitelistRequestRows", filteredRequests);
        payload.put("searchIp", safeString(searchIp));
        payload.put("accessScope", normalizedScope);
        payload.put("status", normalizedStatus);
        payload.put("ipWhitelistSummary", buildIpWhitelistSummaryCards(isEn, allRows, allRequests));
        return payload;
    }

    public List<Map<String, String>> buildEffectiveIpWhitelistRows() {
        List<Map<String, String>> merged = new ArrayList<>();
        for (Map<String, String> row : defaultIpWhitelistRows()) {
            merged.add(new LinkedHashMap<>(row));
        }
        for (Map<String, String> row : selectIpWhitelistRuleRows()) {
            upsertIpWhitelistRow(merged, row, "ruleId");
        }
        merged.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("updatedAt"))).reversed());
        return merged;
    }

    public List<Map<String, String>> buildEffectiveIpWhitelistRequests() {
        List<Map<String, String>> merged = new ArrayList<>();
        for (Map<String, String> row : defaultIpWhitelistRequests()) {
            merged.add(new LinkedHashMap<>(row));
        }
        for (Map<String, String> row : selectIpWhitelistRequestRows()) {
            upsertIpWhitelistRow(merged, row, "requestId");
        }
        merged.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("requestedAt"))).reversed());
        return merged;
    }

    public Map<String, String> findIpWhitelistRequestById(String requestId) {
        return buildEffectiveIpWhitelistRequests().stream()
                .filter(row -> safeString(requestId).equalsIgnoreCase(safeString(row.get("requestId"))))
                .findFirst()
                .map(LinkedHashMap::new)
                .orElse(null);
    }

    public Map<String, String> findIpWhitelistRuleById(String ruleId) {
        if (safeString(ruleId).isEmpty()) {
            return null;
        }
        return buildEffectiveIpWhitelistRows().stream()
                .filter(row -> safeString(ruleId).equalsIgnoreCase(safeString(row.get("ruleId"))))
                .findFirst()
                .map(LinkedHashMap::new)
                .orElse(null);
    }

    public void saveIpWhitelistRuleRow(Map<String, String> row) {
        IpWhitelistPersistenceService persistenceService = ipWhitelistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            log.warn("IpWhitelistPersistenceService bean is not available. Skipping rule persistence.");
            return;
        }
        persistenceService.saveRuleRow(row);
    }

    public void saveIpWhitelistRequestRow(Map<String, String> row) {
        IpWhitelistPersistenceService persistenceService = ipWhitelistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            log.warn("IpWhitelistPersistenceService bean is not available. Skipping request persistence.");
            return;
        }
        persistenceService.saveRequestRow(row);
    }

    private boolean matchesIpWhitelistKeyword(Map<String, String> row, String keyword) {
        return safeString(row.get("ipAddress")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("description")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("owner")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("memo")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private boolean matchesIpWhitelistRequestFilter(Map<String, String> row, String keyword, String scope, String status) {
        if (!keyword.isEmpty()) {
            String searchable = String.join(" ",
                    safeString(row.get("requestId")),
                    safeString(row.get("ipAddress")),
                    safeString(row.get("accessScope")),
                    safeString(row.get("reason")),
                    safeString(row.get("requester")),
                    safeString(row.get("reviewNote"))).toLowerCase(Locale.ROOT);
            if (!searchable.contains(keyword)) {
                return false;
            }
        }
        if (!scope.isEmpty() && !scope.equalsIgnoreCase(safeString(row.get("accessScope")))) {
            return false;
        }
        if (!status.isEmpty()) {
            String approvalStatus = safeString(row.get("approvalStatus"));
            String approvalStatusEn = approvalStatus.toUpperCase(Locale.ROOT) + " " + safeString(row.get("approvalStatusEn")).toUpperCase(Locale.ROOT);
            if ("ACTIVE".equals(status) && !(approvalStatus.contains("승인") || approvalStatusEn.contains("APPROV"))) {
                return false;
            }
            if ("PENDING".equals(status) && !(approvalStatus.contains("검토") || approvalStatus.contains("대기") || approvalStatusEn.contains("PENDING") || approvalStatusEn.contains("REVIEW"))) {
                return false;
            }
            if ("INACTIVE".equals(status) && !(approvalStatus.contains("반려") || approvalStatusEn.contains("REJECT"))) {
                return false;
            }
        }
        return true;
    }

    private List<Map<String, String>> selectIpWhitelistRuleRows() {
        IpWhitelistPersistenceService persistenceService = ipWhitelistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            return Collections.emptyList();
        }
        return persistenceService.selectRuleRows();
    }

    private List<Map<String, String>> selectIpWhitelistRequestRows() {
        IpWhitelistPersistenceService persistenceService = ipWhitelistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            return Collections.emptyList();
        }
        return persistenceService.selectRequestRows();
    }

    private void upsertIpWhitelistRow(List<Map<String, String>> target, Map<String, String> source, String keyName) {
        String key = safeString(source.get(keyName));
        for (int index = 0; index < target.size(); index++) {
            if (key.equalsIgnoreCase(safeString(target.get(index).get(keyName)))) {
                target.set(index, new LinkedHashMap<>(source));
                return;
            }
        }
        target.add(new LinkedHashMap<>(source));
    }

    private List<Map<String, String>> defaultIpWhitelistRows() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(ipWhitelistRow("WL-001", "203.248.117.0/24", "ADMIN", "운영센터 고정망", "정책관리팀", "ACTIVE", "2026-03-10 09:20", "상시 허용", "Primary office network", "Policy Admin Team", "Always allowed"));
        rows.add(ipWhitelistRow("WL-002", "10.10.20.15", "BATCH", "배치 서버", "플랫폼운영팀", "ACTIVE", "2026-03-09 18:40", "API 연동 전용", "Batch server", "Platform Ops Team", "API integration only"));
        Map<String, String> pendingRule = ipWhitelistRow("WL-003", "175.213.44.82", "ADMIN", "외부 협력사 점검 단말", "보안담당", "PENDING", "2026-03-12 08:50", "2026-03-20까지 임시 허용", "Vendor inspection terminal", "Security Officer", "Temporary access until 2026-03-20");
        pendingRule.put("requestId", "REQ-240312-01");
        pendingRule.put("expiresAt", "2026-03-20 18:00");
        rows.add(pendingRule);
        rows.add(ipWhitelistRow("WL-004", "192.168.0.0/16", "INTERNAL", "사내 VPN 대역", "인프라팀", "INACTIVE", "2026-02-25 14:05", "VPN 정책 재정비 대기", "Internal VPN range", "Infrastructure Team", "Waiting for VPN policy update"));
        return rows;
    }

    private List<Map<String, String>> defaultIpWhitelistRequests() {
        List<Map<String, String>> rows = new ArrayList<>();
        Map<String, String> pending = ipWhitelistRequestRow("REQ-240312-01", "175.213.44.82", "ADMIN", "협력사 취약점 점검", "검토중", "2026-03-12 08:45", "보안담당 김민수", "Vendor security inspection", "Under Review", "Security Officer Minsu Kim");
        pending.put("ruleId", "WL-003");
        pending.put("expiresAt", "2026-03-20 18:00");
        pending.put("memo", "2026-03-20까지 임시 허용");
        pending.put("memoEn", "Temporary access until 2026-03-20");
        rows.add(pending);
        Map<String, String> approved = ipWhitelistRequestRow("REQ-240311-07", "210.96.14.0/24", "API", "관계기관 API 테스트", "승인완료", "2026-03-11 16:10", "플랫폼운영팀 이지훈", "Partner API test", "Approved", "Platform Ops Jihun Lee");
        approved.put("reviewedAt", "2026-03-11 16:40");
        approved.put("reviewedBy", "이지훈");
        approved.put("reviewedByEn", "Jihun Lee");
        rows.add(approved);
        Map<String, String> rejected = ipWhitelistRequestRow("REQ-240307-02", "121.166.77.19", "ADMIN", "퇴사자 계정 사용 종료", "반려", "2026-03-07 11:20", "감사담당 박선영", "User retired", "Rejected", "Audit Officer Sunyoung Park");
        rejected.put("reviewedAt", "2026-03-07 11:45");
        rejected.put("reviewedBy", "보안운영자");
        rejected.put("reviewedByEn", "Security Operator");
        rejected.put("reviewNote", "허용 사유 종료");
        rows.add(rejected);
        return rows;
    }

    private List<Map<String, String>> buildIpWhitelistSummaryCards(boolean isEn,
                                                                   List<Map<String, String>> allRows,
                                                                   List<Map<String, String>> allRequests) {
        long activeCount = allRows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long pendingCount = allRequests.stream()
                .filter(row -> {
                    String approvalStatus = safeString(row.get("approvalStatus"));
                    String approvalStatusEn = safeString(row.get("approvalStatusEn")).toUpperCase(Locale.ROOT);
                    return approvalStatus.contains("검토") || approvalStatus.contains("대기") || approvalStatusEn.contains("PENDING") || approvalStatusEn.contains("REVIEW");
                })
                .count();
        long temporaryCount = allRows.stream()
                .filter(row -> safeString(row.get("memo")).contains("임시") || safeString(row.get("memoEn")).toLowerCase(Locale.ROOT).contains("temporary"))
                .count();
        long scopeCount = allRows.stream()
                .map(row -> safeString(row.get("accessScope")).toUpperCase(Locale.ROOT))
                .filter(value -> !value.isEmpty())
                .distinct()
                .count();
        return List.of(
                metricCard(isEn ? "Active Rules" : "활성 규칙", String.valueOf(activeCount), isEn ? "Rules currently reflected in gateway and admin access." : "게이트웨이와 관리자 접근에 현재 반영 중인 규칙"),
                metricCard(isEn ? "Pending Requests" : "승인 대기", String.valueOf(pendingCount), isEn ? "Temporary access requests waiting for operator review." : "운영 승인 대기 중인 임시 허용 요청"),
                metricCard(isEn ? "Temporary Exceptions" : "임시 예외", String.valueOf(temporaryCount), isEn ? "Rules carrying temporary access conditions." : "임시 허용 조건을 가진 규칙 수"),
                metricCard(isEn ? "Protected Scopes" : "보호 범위", String.valueOf(scopeCount), isEn ? "Access scopes managed in the allowlist console." : "화이트리스트 콘솔에서 관리 중인 접근 범위")
        );
    }

    private Map<String, String> metricCard(String title, String value, String description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", title);
        card.put("value", value);
        card.put("description", description);
        return card;
    }

    private Map<String, String> ipWhitelistRow(
            String ruleId,
            String ipAddress,
            String accessScope,
            String description,
            String owner,
            String status,
            String updatedAt,
            String memo,
            String descriptionEn,
            String ownerEn,
            String memoEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("ruleId", ruleId);
        row.put("ipAddress", ipAddress);
        row.put("accessScope", accessScope);
        row.put("description", description);
        row.put("owner", owner);
        row.put("status", status);
        row.put("updatedAt", updatedAt);
        row.put("memo", memo);
        row.put("descriptionEn", descriptionEn);
        row.put("ownerEn", ownerEn);
        row.put("memoEn", memoEn);
        return row;
    }

    private Map<String, String> ipWhitelistRequestRow(
            String requestId,
            String ipAddress,
            String accessScope,
            String reason,
            String approvalStatus,
            String requestedAt,
            String requester,
            String reasonEn,
            String approvalStatusEn,
            String requesterEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("requestId", requestId);
        row.put("ipAddress", ipAddress);
        row.put("accessScope", accessScope);
        row.put("reason", reason);
        row.put("approvalStatus", approvalStatus);
        row.put("requestedAt", requestedAt);
        row.put("requester", requester);
        row.put("reasonEn", reasonEn);
        row.put("approvalStatusEn", approvalStatusEn);
        row.put("requesterEn", requesterEn);
        return row;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

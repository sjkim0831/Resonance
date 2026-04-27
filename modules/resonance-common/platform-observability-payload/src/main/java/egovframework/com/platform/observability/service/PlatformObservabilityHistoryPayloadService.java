package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.PlatformObservabilityHistoryPagePayloadPort;
import egovframework.com.platform.service.observability.PlatformObservabilitySummaryReadPort;
import egovframework.com.platform.service.observability.history.LoginHistoryDatasetSnapshot;
import egovframework.com.platform.service.observability.history.LoginHistoryRowSnapshot;
import egovframework.com.platform.service.observability.history.PlatformObservabilityHistoryDataPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityHistoryPayloadService implements PlatformObservabilityHistoryPagePayloadPort {

    private final PlatformObservabilityHistoryDataPort platformObservabilityHistoryDataPort;
    private final PlatformObservabilitySummaryReadPort adminSummaryReadPort;

    @Override
    public Map<String, Object> buildSecurityHistoryPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String userSe,
            String insttId,
            String actionStatus,
            HttpServletRequest request,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int pageSize = 10;
        LoginHistoryDatasetSnapshot dataset = platformObservabilityHistoryDataPort.loadBlockedLoginHistoryDataset(
                searchKeyword,
                userSe,
                insttId,
                request);
        List<Map<String, String>> actionRows = new ArrayList<>(adminSummaryReadPort.getSecurityHistoryActionRows(isEn));
        Map<String, Map<String, String>> actionByHistoryKey = new LinkedHashMap<>();
        for (Map<String, String> row : actionRows) {
            String historyKey = safeString(row.get("historyKey"));
            if (historyKey.isEmpty() || actionByHistoryKey.containsKey(historyKey)) {
                continue;
            }
            actionByHistoryKey.put(historyKey, new LinkedHashMap<>(row));
        }
        String normalizedActionStatus = safeString(actionStatus).toUpperCase(Locale.ROOT);
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        Map<String, Map<String, Integer>> relatedCountsByHistoryKey = new LinkedHashMap<>();
        Map<String, Integer> ipCounts = new HashMap<>();
        Map<String, Integer> userCounts = new HashMap<>();
        Map<String, Integer> companyCounts = new HashMap<>();
        Map<String, Integer> userSeSummary = new LinkedHashMap<>();

        for (LoginHistoryRowSnapshot item : dataset.getRows()) {
            String historyKey = safeString(item.getHistId()).isEmpty()
                    ? String.join("|", safeString(item.getUserId()), safeString(item.getLoginIp()), safeString(item.getLoginPnttm()))
                    : safeString(item.getHistId());
            String latestAction = safeString(actionByHistoryKey.getOrDefault(historyKey, Map.of()).get("action")).toUpperCase(Locale.ROOT);
            boolean include = normalizedActionStatus.isEmpty()
                    || ("NONE".equals(normalizedActionStatus) && latestAction.isEmpty())
                    || normalizedActionStatus.equals(latestAction);
            if (!include) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("histId", safeString(item.getHistId()));
            row.put("userId", safeString(item.getUserId()));
            row.put("userNm", safeString(item.getUserNm()));
            row.put("userSe", safeString(item.getUserSe()));
            row.put("loginResult", safeString(item.getLoginResult()));
            row.put("loginIp", safeString(item.getLoginIp()));
            row.put("loginMessage", safeString(item.getLoginMessage()));
            row.put("loginPnttm", safeString(item.getLoginPnttm()));
            row.put("insttId", safeString(item.getInsttId()));
            row.put("companyName", safeString(item.getCompanyName()));
            filteredRows.add(row);
            incrementCount(ipCounts, safeString(item.getLoginIp()));
            incrementCount(userCounts, safeString(item.getUserId()));
            incrementCount(companyCounts, safeString(item.getInsttId()));
            incrementCount(userSeSummary, safeString(item.getUserSe()));
        }

        for (Map<String, Object> row : filteredRows) {
            String rowHistId = safeString(row.get("histId"));
            String rowUserId = safeString(row.get("userId"));
            String rowLoginIp = safeString(row.get("loginIp"));
            String rowLoginPnttm = safeString(row.get("loginPnttm"));
            String rowInsttId = safeString(row.get("insttId"));
            String historyKey = rowHistId.isEmpty() ? String.join("|", rowUserId, rowLoginIp, rowLoginPnttm) : rowHistId;
            Map<String, Integer> related = new LinkedHashMap<>();
            related.put("sameIpCount", ipCounts.getOrDefault(rowLoginIp, 0));
            related.put("sameUserCount", userCounts.getOrDefault(rowUserId, 0));
            related.put("sameCompanyCount", companyCounts.getOrDefault(rowInsttId, 0));
            relatedCountsByHistoryKey.put(historyKey, related);
        }

        int filteredTotalCount = filteredRows.size();
        int totalPages = filteredTotalCount == 0 ? 1 : (int) Math.ceil(filteredTotalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.max(0, Math.min((currentPage - 1) * pageSize, filteredRows.size()));
        int toIndex = Math.max(fromIndex, Math.min(fromIndex + pageSize, filteredRows.size()));
        List<Map<String, Object>> pagedRows = filteredRows.isEmpty()
                ? Collections.emptyList()
                : new ArrayList<>(filteredRows.subList(fromIndex, toIndex));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("loginHistoryList", pagedRows);
        payload.put("totalCount", filteredTotalCount);
        payload.put("pageIndex", currentPage);
        payload.put("pageSize", pageSize);
        payload.put("totalPages", totalPages);
        payload.put("searchKeyword", dataset.getKeyword());
        payload.put("userSe", dataset.getNormalizedUserSe());
        payload.put("loginResult", dataset.getNormalizedLoginResult());
        payload.put("actionStatus", normalizedActionStatus);
        payload.put("companyOptions", dataset.getCompanyOptions());
        payload.put("selectedInsttId", dataset.getSelectedInsttId());
        payload.put("canManageAllCompanies", dataset.isMasterAccess());
        payload.put("securityHistoryActionRows", actionRows);
        payload.put("securityHistoryActionByHistoryKey", actionByHistoryKey);
        payload.put("securityHistoryRelatedCountByHistoryKey", relatedCountsByHistoryKey);
        payload.put("securityHistoryAggregate", Map.of(
                "uniqueIpCount", ipCounts.size(),
                "uniqueUserCount", userCounts.size(),
                "userSeSummary", userSeSummary,
                "filteredTotalCount", filteredTotalCount));
        payload.put("isEn", isEn);
        return payload;
    }

    public Map<String, Object> buildLoginHistoryPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String userSe,
            String loginResult,
            String insttId,
            HttpServletRequest request,
            boolean isEn) {
        return new LinkedHashMap<>(platformObservabilityHistoryDataPort.buildLoginHistoryPagePayload(
                pageIndexParam,
                searchKeyword,
                userSe,
                loginResult,
                insttId,
                request,
                isEn));
    }

    private int parsePageIndex(String pageIndexParam) {
        try {
            int pageIndex = Integer.parseInt(safeString(pageIndexParam));
            return Math.max(pageIndex, 1);
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private void incrementCount(Map<String, Integer> counts, String key) {
        if (key == null || key.isEmpty()) {
            return;
        }
        counts.put(key, counts.getOrDefault(key, 0) + 1);
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}

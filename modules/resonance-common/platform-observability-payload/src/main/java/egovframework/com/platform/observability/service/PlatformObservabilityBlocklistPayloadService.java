package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.PlatformObservabilitySummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityBlocklistPayloadService {

    private final PlatformObservabilitySummaryReadPort adminSummaryReadPort;

    public Map<String, Object> buildBlocklistPagePayload(
            String searchKeyword,
            String blockType,
            String status,
            String source,
            boolean isEn) {
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedBlockType = safeString(blockType).toUpperCase(Locale.ROOT);
        String normalizedStatus = safeString(status).toUpperCase(Locale.ROOT);
        String normalizedSource = safeString(source).toUpperCase(Locale.ROOT);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("searchKeyword", safeString(searchKeyword));
        payload.put("blockType", normalizedBlockType);
        payload.put("status", normalizedStatus);
        payload.put("source", safeString(source));
        payload.put("blocklistSummary", adminSummaryReadPort.getBlocklistSummary(isEn));

        List<Map<String, String>> blocklistRows = new ArrayList<>(adminSummaryReadPort.getBlocklistRows(isEn));
        payload.put("blocklistRows", blocklistRows.stream()
                .filter(row -> matchesBlocklistFilter(row, normalizedKeyword, normalizedBlockType, normalizedStatus, normalizedSource))
                .toList());

        List<Map<String, String>> releaseQueue = new ArrayList<>(adminSummaryReadPort.getBlocklistReleaseQueue(isEn));
        payload.put("blocklistReleaseQueue", releaseQueue.stream()
                .filter(row -> matchesQueueFilter(row, normalizedKeyword, normalizedSource))
                .toList());

        List<Map<String, String>> releaseHistory = new ArrayList<>(adminSummaryReadPort.getBlocklistReleaseHistory(isEn));
        payload.put("blocklistReleaseHistory", releaseHistory.stream()
                .filter(row -> matchesHistoryFilter(row, normalizedKeyword, normalizedSource))
                .toList());
        return payload;
    }

    private boolean matchesBlocklistFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedBlockType,
            String normalizedStatus,
            String normalizedSource) {
        String rowBlockType = safeString(row.get("blockType")).toUpperCase(Locale.ROOT);
        String rowStatus = safeString(row.get("status")).toUpperCase(Locale.ROOT);
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                        safeString(row.get("blockId")),
                        safeString(row.get("target")),
                        safeString(row.get("reason")),
                        safeString(row.get("owner")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesBlockType = normalizedBlockType.isEmpty() || normalizedBlockType.equals(rowBlockType);
        boolean matchesStatus = normalizedStatus.isEmpty() || normalizedStatus.equals(rowStatus);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesBlockType && matchesStatus && matchesSource;
    }

    private boolean matchesQueueFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedSource) {
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                        safeString(row.get("target")),
                        safeString(row.get("condition")),
                        safeString(row.get("releaseAt")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesSource;
    }

    private boolean matchesHistoryFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedSource) {
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                        safeString(row.get("blockId")),
                        safeString(row.get("target")),
                        safeString(row.get("reason")),
                        safeString(row.get("releasedBy")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesSource;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

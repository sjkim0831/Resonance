package egovframework.com.platform.trade.service.impl;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PlatformTradeBootstrapReadService {

    public Map<String, Object> buildTradeListPageData(
            String pageIndexParam,
            String searchKeyword,
            String tradeStatus,
            String settlementStatus,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        String keyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedTradeStatus = safeString(tradeStatus).toUpperCase(Locale.ROOT);
        String normalizedSettlementStatus = safeString(settlementStatus).toUpperCase(Locale.ROOT);

        List<Map<String, String>> allRows = buildTradeListRows(isEn);
        List<Map<String, String>> filteredRows = new ArrayList<>();
        for (Map<String, String> row : allRows) {
            String searchable = String.join(" ",
                    safeString(row.get("tradeId")),
                    safeString(row.get("productType")),
                    safeString(row.get("sellerName")),
                    safeString(row.get("buyerName")),
                    safeString(row.get("contractName"))).toLowerCase(Locale.ROOT);
            String rowTradeStatus = safeString(row.get("tradeStatusCode")).toUpperCase(Locale.ROOT);
            String rowSettlementStatus = safeString(row.get("settlementStatusCode")).toUpperCase(Locale.ROOT);
            boolean matchesKeyword = keyword.isEmpty() || searchable.contains(keyword);
            boolean matchesTradeStatus = normalizedTradeStatus.isEmpty() || normalizedTradeStatus.equals(rowTradeStatus);
            boolean matchesSettlementStatus = normalizedSettlementStatus.isEmpty() || normalizedSettlementStatus.equals(rowSettlementStatus);
            if (matchesKeyword && matchesTradeStatus && matchesSettlementStatus) {
                filteredRows.add(row);
            }
        }

        int pageSize = 10;
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageRows = filteredRows.subList(fromIndex, toIndex);

        long matchingCount = allRows.stream()
                .filter(row -> "MATCHING".equalsIgnoreCase(safeString(row.get("tradeStatusCode"))))
                .count();
        long settlementPendingCount = allRows.stream()
                .filter(row -> "PENDING".equalsIgnoreCase(safeString(row.get("settlementStatusCode"))))
                .count();
        long completedCount = allRows.stream()
                .filter(row -> "COMPLETED".equalsIgnoreCase(safeString(row.get("tradeStatusCode"))))
                .count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("tradeRows", pageRows);
        response.put("totalCount", totalCount);
        response.put("matchingCount", matchingCount);
        response.put("settlementPendingCount", settlementPendingCount);
        response.put("completedCount", completedCount);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("tradeStatus", normalizedTradeStatus);
        response.put("settlementStatus", normalizedSettlementStatus);
        response.put("tradeStatusOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("REQUESTED", isEn ? "Requested" : "요청"),
                option("MATCHING", isEn ? "Matching" : "매칭중"),
                option("APPROVED", isEn ? "Approved" : "승인"),
                option("COMPLETED", isEn ? "Completed" : "완료"),
                option("HOLD", isEn ? "On Hold" : "보류")));
        response.put("settlementStatusOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("PENDING", isEn ? "Pending" : "정산 대기"),
                option("IN_PROGRESS", isEn ? "In Progress" : "정산 진행"),
                option("DONE", isEn ? "Done" : "정산 완료"),
                option("EXCEPTION", isEn ? "Exception" : "예외")));
        response.put("settlementAlerts", List.of(
                mapOf(
                        "title", isEn ? "Pending settlement review" : "정산 대기 거래 점검",
                        "detail", isEn ? "Trades with pending settlement should be reviewed before the daily close window."
                                : "정산 대기 거래는 일 마감 전에 담당자가 우선 점검해야 합니다.",
                        "tone", "warning"),
                mapOf(
                        "title", isEn ? "Exception handling path" : "예외 거래 처리 경로",
                        "detail", isEn ? "Exception trades require operator note and counterparty confirmation."
                                : "예외 거래는 운영 메모와 상대 기관 확인 절차가 필요합니다.",
                        "tone", "info")));
        return response;
    }

    public Map<String, Object> buildTradeStatisticsPageData(
            String pageIndexParam,
            String searchKeyword,
            String periodFilter,
            String tradeType,
            String settlementStatus,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedPeriodFilter = normalizeTradeStatisticsPeriodFilter(periodFilter);
        String normalizedTradeType = safeString(tradeType).toUpperCase(Locale.ROOT);
        String normalizedSettlementStatus = safeString(settlementStatus).toUpperCase(Locale.ROOT);

        List<Map<String, String>> institutionRows = buildTradeStatisticsInstitutionRows(isEn).stream()
                .filter(row -> normalizedTradeType.isEmpty() || normalizedTradeType.equals(safeString(row.get("tradeTypeCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedSettlementStatus.isEmpty() || normalizedSettlementStatus.equals(safeString(row.get("settlementStatusCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedKeyword.isEmpty() || matchesTradeStatisticsKeyword(row, normalizedKeyword))
                .collect(Collectors.toList());
        List<Map<String, String>> monthlyRows = selectTradeStatisticsMonthlyRows(buildTradeStatisticsMonthlyRows(isEn), normalizedPeriodFilter);
        List<Map<String, String>> tradeTypeRows = buildTradeStatisticsTypeRows(isEn).stream()
                .filter(row -> normalizedTradeType.isEmpty() || normalizedTradeType.equals(safeString(row.get("tradeTypeCode")).toUpperCase(Locale.ROOT)))
                .collect(Collectors.toList());

        int pageSize = 6;
        int totalCount = institutionRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageRows = institutionRows.subList(fromIndex, toIndex);

        long totalTradeVolume = sumTradeStatistic(institutionRows, "tradeVolume");
        long totalSettlementAmount = sumTradeStatistic(institutionRows, "settlementAmount");
        long pendingSettlementCount = sumTradeStatistic(institutionRows, "pendingCount");
        long exceptionCount = sumTradeStatistic(institutionRows, "exceptionCount");
        long completedCount = sumTradeStatistic(institutionRows, "completedCount");
        long requestCount = sumTradeStatistic(institutionRows, "requestCount");
        String settlementCompletionRate = requestCount <= 0
                ? "0.0"
                : String.format(Locale.ROOT, "%.1f", (completedCount * 100.0) / requestCount);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("totalCount", totalCount);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("periodFilter", normalizedPeriodFilter);
        response.put("tradeType", normalizedTradeType);
        response.put("settlementStatus", normalizedSettlementStatus);
        response.put("totalTradeVolume", totalTradeVolume);
        response.put("totalSettlementAmount", totalSettlementAmount);
        response.put("pendingSettlementCount", pendingSettlementCount);
        response.put("exceptionCount", exceptionCount);
        response.put("settlementCompletionRate", settlementCompletionRate);
        response.put("avgSettlementDays", formatTradeLeadDays(institutionRows));
        response.put("monthlyRows", monthlyRows);
        response.put("tradeTypeRows", tradeTypeRows);
        response.put("institutionRows", pageRows);
        response.put("alertRows", buildTradeStatisticsAlertRows(isEn));
        return response;
    }

    public Map<String, Object> buildTradeDuplicatePageData(
            String pageIndexParam,
            String searchKeyword,
            String detectionType,
            String reviewStatus,
            String riskLevel,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        String keyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedDetectionType = safeString(detectionType).toUpperCase(Locale.ROOT);
        String normalizedReviewStatus = safeString(reviewStatus).toUpperCase(Locale.ROOT);
        String normalizedRiskLevel = safeString(riskLevel).toUpperCase(Locale.ROOT);

        List<Map<String, String>> allRows = buildTradeDuplicateRows(isEn);
        List<Map<String, String>> filteredRows = new ArrayList<>();
        for (Map<String, String> row : allRows) {
            String searchable = String.join(" ",
                    safeString(row.get("reviewId")),
                    safeString(row.get("tradeId")),
                    safeString(row.get("contractName")),
                    safeString(row.get("sellerName")),
                    safeString(row.get("buyerName")),
                    safeString(row.get("analyst")),
                    safeString(row.get("reason"))).toLowerCase(Locale.ROOT);
            String rowDetectionType = safeString(row.get("detectionTypeCode")).toUpperCase(Locale.ROOT);
            String rowReviewStatus = safeString(row.get("reviewStatusCode")).toUpperCase(Locale.ROOT);
            String rowRiskLevel = safeString(row.get("riskLevelCode")).toUpperCase(Locale.ROOT);
            boolean matchesKeyword = keyword.isEmpty() || searchable.contains(keyword);
            boolean matchesDetectionType = normalizedDetectionType.isEmpty() || normalizedDetectionType.equals(rowDetectionType);
            boolean matchesReviewStatus = normalizedReviewStatus.isEmpty() || normalizedReviewStatus.equals(rowReviewStatus);
            boolean matchesRiskLevel = normalizedRiskLevel.isEmpty() || normalizedRiskLevel.equals(rowRiskLevel);
            if (matchesKeyword && matchesDetectionType && matchesReviewStatus && matchesRiskLevel) {
                filteredRows.add(row);
            }
        }

        int pageSize = 10;
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageRows = filteredRows.subList(fromIndex, toIndex);

        long criticalCount = allRows.stream()
                .filter(row -> "CRITICAL".equalsIgnoreCase(safeString(row.get("riskLevelCode"))))
                .count();
        long reviewCount = allRows.stream()
                .filter(row -> "REVIEW".equalsIgnoreCase(safeString(row.get("reviewStatusCode"))))
                .count();
        long settlementBlockedCount = allRows.stream()
                .filter(row -> "BLOCKED".equalsIgnoreCase(safeString(row.get("reviewStatusCode"))))
                .count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("abnormalTradeRows", pageRows);
        response.put("totalCount", totalCount);
        response.put("criticalCount", criticalCount);
        response.put("reviewCount", reviewCount);
        response.put("settlementBlockedCount", settlementBlockedCount);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("detectionType", normalizedDetectionType);
        response.put("reviewStatus", normalizedReviewStatus);
        response.put("riskLevel", normalizedRiskLevel);
        response.put("lastRefreshedAt", "2026-03-31 09:10");
        response.put("detectionTypeOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("DUPLICATE_PARTY", isEn ? "Duplicate party" : "거래 당사자 중복"),
                option("SPLIT_ORDER", isEn ? "Split order" : "주문 분할"),
                option("SETTLEMENT_GAP", isEn ? "Settlement gap" : "정산 불일치"),
                option("LIMIT_BREACH", isEn ? "Limit breach" : "한도 초과"),
                option("PRICE_OUTLIER", isEn ? "Price outlier" : "가격 이상")));
        response.put("reviewStatusOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("REVIEW", isEn ? "Under review" : "검토 중"),
                option("ESCALATED", isEn ? "Escalated" : "상향 검토"),
                option("BLOCKED", isEn ? "Settlement blocked" : "정산 보류"),
                option("CLEARED", isEn ? "Cleared" : "해소")));
        response.put("riskLevelOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("CRITICAL", isEn ? "Critical" : "치명"),
                option("HIGH", isEn ? "High" : "높음"),
                option("MEDIUM", isEn ? "Medium" : "중간"),
                option("LOW", isEn ? "Low" : "낮음")));
        response.put("escalationAlerts", List.of(
                mapOf(
                        "title", isEn ? "Critical items must stay blocked" : "치명 항목은 차단 유지",
                        "detail", isEn ? "Do not reopen settlement until the ledger mismatch is closed."
                                : "원장 불일치가 닫히기 전까지 정산을 재개하면 안 됩니다.",
                        "tone", "warning"),
                mapOf(
                        "title", isEn ? "Escalated reviews need supervisor sign-off" : "상향 검토는 상급자 승인 필요",
                        "detail", isEn ? "Escalated duplicate-party trades should include the prior-day comparison note."
                                : "상향 검토 건은 전일 거래 비교 메모를 함께 남겨야 합니다.",
                        "tone", "info")));
        return response;
    }

    public List<Map<String, String>> buildTradeListRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(tradeRow("TRD-202603-001", isEn ? "K-ETS Credit" : "배출권", isEn ? "Hanul Steel" : "한울제철",
                isEn ? "Blue Energy" : "블루에너지", isEn ? "Quarterly offset bundle" : "분기 상쇄 배치",
                "12,500 tCO2eq", "KRW 418,000,000", "2026-03-30 09:10", "REQUESTED",
                isEn ? "Requested" : "요청", "PENDING", isEn ? "Pending" : "정산 대기"));
        rows.add(tradeRow("TRD-202603-002", isEn ? "REC Package" : "REC 패키지", isEn ? "Green Grid" : "그린그리드",
                isEn ? "Seoul Mobility" : "서울모빌리티", isEn ? "Scope 2 hedge" : "Scope 2 헤지",
                "8,000 MWh", "KRW 192,000,000", "2026-03-30 08:35", "MATCHING",
                isEn ? "Matching" : "매칭중", "IN_PROGRESS", isEn ? "In Progress" : "정산 진행"));
        rows.add(tradeRow("TRD-202603-003", isEn ? "Voluntary Credit" : "자발적 감축실적", isEn ? "Eco Farm" : "에코팜",
                isEn ? "Carbon Labs" : "카본랩스", isEn ? "Biochar contract" : "바이오차 계약",
                "4,250 tCO2eq", "KRW 87,500,000", "2026-03-29 16:40", "APPROVED",
                isEn ? "Approved" : "승인", "PENDING", isEn ? "Pending" : "정산 대기"));
        rows.add(tradeRow("TRD-202603-004", isEn ? "K-ETS Credit" : "배출권", isEn ? "East Port" : "이스트포트",
                isEn ? "River Cement" : "리버시멘트", isEn ? "March balancing lot" : "3월 밸런싱 물량",
                "15,300 tCO2eq", "KRW 522,400,000", "2026-03-29 15:20", "COMPLETED",
                isEn ? "Completed" : "완료", "DONE", isEn ? "Done" : "정산 완료"));
        rows.add(tradeRow("TRD-202603-005", isEn ? "REC Package" : "REC 패키지", isEn ? "Sun Network" : "선네트워크",
                isEn ? "Urban Data" : "어반데이터", isEn ? "Data center reserve" : "데이터센터 예비물량",
                "6,400 MWh", "KRW 154,000,000", "2026-03-29 11:05", "HOLD",
                isEn ? "On Hold" : "보류", "EXCEPTION", isEn ? "Exception" : "예외"));
        rows.add(tradeRow("TRD-202603-006", isEn ? "Voluntary Credit" : "자발적 감축실적", isEn ? "CCUS Plant A" : "CCUS 플랜트 A",
                isEn ? "Metro Heat" : "메트로히트", isEn ? "Capture storage block" : "포집 저장 블록",
                "10,100 tCO2eq", "KRW 301,000,000", "2026-03-28 17:42", "MATCHING",
                isEn ? "Matching" : "매칭중", "IN_PROGRESS", isEn ? "In Progress" : "정산 진행"));
        rows.add(tradeRow("TRD-202603-007", isEn ? "K-ETS Credit" : "배출권", isEn ? "Nova Chemical" : "노바케미칼",
                isEn ? "Blue Energy" : "블루에너지", isEn ? "Seasonal hedge" : "계절성 헤지",
                "9,900 tCO2eq", "KRW 333,600,000", "2026-03-28 14:10", "REQUESTED",
                isEn ? "Requested" : "요청", "PENDING", isEn ? "Pending" : "정산 대기"));
        rows.add(tradeRow("TRD-202603-008", isEn ? "REC Package" : "REC 패키지", isEn ? "Wind Core" : "윈드코어",
                isEn ? "Harbor Cold Chain" : "하버콜드체인", isEn ? "Cold-chain coverage" : "콜드체인 커버리지",
                "3,200 MWh", "KRW 71,000,000", "2026-03-28 10:32", "COMPLETED",
                isEn ? "Completed" : "완료", "DONE", isEn ? "Done" : "정산 완료"));
        rows.add(tradeRow("TRD-202603-009", isEn ? "Voluntary Credit" : "자발적 감축실적", isEn ? "Forest Link" : "포레스트링크",
                isEn ? "Green Grid" : "그린그리드", isEn ? "Afforestation offset" : "조림 상쇄 거래",
                "5,800 tCO2eq", "KRW 126,000,000", "2026-03-27 18:24", "APPROVED",
                isEn ? "Approved" : "승인", "PENDING", isEn ? "Pending" : "정산 대기"));
        rows.add(tradeRow("TRD-202603-010", isEn ? "K-ETS Credit" : "배출권", isEn ? "River Cement" : "리버시멘트",
                isEn ? "Seoul Mobility" : "서울모빌리티", isEn ? "Compliance shortfall fill" : "의무량 보전 계약",
                "7,700 tCO2eq", "KRW 257,000,000", "2026-03-27 09:08", "COMPLETED",
                isEn ? "Completed" : "완료", "DONE", isEn ? "Done" : "정산 완료"));
        rows.add(tradeRow("TRD-202603-011", isEn ? "REC Package" : "REC 패키지", isEn ? "North Solar" : "노스솔라",
                isEn ? "Metro Heat" : "메트로히트", isEn ? "Heat network mix" : "열공급 믹스 거래",
                "2,850 MWh", "KRW 59,400,000", "2026-03-26 13:46", "MATCHING",
                isEn ? "Matching" : "매칭중", "IN_PROGRESS", isEn ? "In Progress" : "정산 진행"));
        rows.add(tradeRow("TRD-202603-012", isEn ? "Voluntary Credit" : "자발적 감축실적", isEn ? "Eco Farm" : "에코팜",
                isEn ? "Hanul Steel" : "한울제철", isEn ? "Agriculture offset pool" : "농업 상쇄 풀",
                "6,900 tCO2eq", "KRW 143,500,000", "2026-03-25 16:18", "HOLD",
                isEn ? "On Hold" : "보류", "EXCEPTION", isEn ? "Exception" : "예외"));
        return rows;
    }

    private int parsePageIndex(String pageIndexParam) {
        if (safeString(pageIndexParam).isEmpty()) {
            return 1;
        }
        try {
            return Integer.parseInt(pageIndexParam.trim());
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private String normalizeTradeStatisticsPeriodFilter(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        if ("LAST_6_MONTHS".equals(normalized) || "Q1_2026".equals(normalized)) {
            return normalized;
        }
        return "LAST_12_MONTHS";
    }

    private boolean matchesTradeStatisticsKeyword(Map<String, String> row, String normalizedKeyword) {
        return String.join(" ",
                        safeString(row.get("insttId")),
                        safeString(row.get("insttName")),
                        safeString(row.get("counterpartyName")),
                        safeString(row.get("tradeTypeLabel")),
                        safeString(row.get("primaryContractName")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
    }

    private List<Map<String, String>> selectTradeStatisticsMonthlyRows(List<Map<String, String>> sourceRows, String periodFilter) {
        if ("LAST_6_MONTHS".equals(periodFilter)) {
            return sourceRows.subList(Math.max(sourceRows.size() - 6, 0), sourceRows.size());
        }
        if ("Q1_2026".equals(periodFilter)) {
            return sourceRows.subList(Math.max(sourceRows.size() - 3, 0), sourceRows.size());
        }
        return sourceRows;
    }

    private long sumTradeStatistic(List<Map<String, String>> rows, String key) {
        long total = 0L;
        for (Map<String, String> row : rows) {
            String rawValue = safeString(row.get(key)).replace(",", "");
            if (rawValue.isEmpty()) {
                continue;
            }
            try {
                total += Long.parseLong(rawValue);
            } catch (NumberFormatException ignored) {
                // Keep bootstrap screens resilient to malformed seed rows.
            }
        }
        return total;
    }

    private String formatTradeLeadDays(List<Map<String, String>> rows) {
        double totalLeadDays = 0.0;
        int measuredRows = 0;
        for (Map<String, String> row : rows) {
            String rawValue = safeString(row.get("avgSettlementDays")).replace(",", "");
            if (rawValue.isEmpty()) {
                continue;
            }
            try {
                totalLeadDays += Double.parseDouble(rawValue);
                measuredRows += 1;
            } catch (NumberFormatException ignored) {
                // Keep bootstrap screens resilient to malformed seed rows.
            }
        }
        if (measuredRows == 0) {
            return "0.0";
        }
        return String.format(Locale.ROOT, "%.1f", totalLeadDays / measuredRows);
    }

    private List<Map<String, String>> buildTradeStatisticsMonthlyRows(boolean isEn) {
        return List.of(
                mapOf("monthLabel", isEn ? "Apr" : "04월", "tradeVolume", "31800", "settlementAmount", "784000000", "pendingCount", "12", "exceptionCount", "2"),
                mapOf("monthLabel", isEn ? "May" : "05월", "tradeVolume", "33200", "settlementAmount", "826000000", "pendingCount", "11", "exceptionCount", "2"),
                mapOf("monthLabel", isEn ? "Jun" : "06월", "tradeVolume", "34800", "settlementAmount", "874000000", "pendingCount", "13", "exceptionCount", "3"),
                mapOf("monthLabel", isEn ? "Jul" : "07월", "tradeVolume", "36500", "settlementAmount", "915000000", "pendingCount", "14", "exceptionCount", "3"),
                mapOf("monthLabel", isEn ? "Aug" : "08월", "tradeVolume", "38100", "settlementAmount", "963000000", "pendingCount", "15", "exceptionCount", "3"),
                mapOf("monthLabel", isEn ? "Sep" : "09월", "tradeVolume", "39700", "settlementAmount", "1008000000", "pendingCount", "17", "exceptionCount", "4"),
                mapOf("monthLabel", isEn ? "Oct" : "10월", "tradeVolume", "41200", "settlementAmount", "1055000000", "pendingCount", "16", "exceptionCount", "4"),
                mapOf("monthLabel", isEn ? "Nov" : "11월", "tradeVolume", "42600", "settlementAmount", "1094000000", "pendingCount", "18", "exceptionCount", "4"),
                mapOf("monthLabel", isEn ? "Dec" : "12월", "tradeVolume", "44100", "settlementAmount", "1148000000", "pendingCount", "19", "exceptionCount", "5"),
                mapOf("monthLabel", isEn ? "Jan" : "01월", "tradeVolume", "45800", "settlementAmount", "1196000000", "pendingCount", "18", "exceptionCount", "4"),
                mapOf("monthLabel", isEn ? "Feb" : "02월", "tradeVolume", "47200", "settlementAmount", "1232000000", "pendingCount", "20", "exceptionCount", "5"),
                mapOf("monthLabel", isEn ? "Mar" : "03월", "tradeVolume", "48900", "settlementAmount", "1284000000", "pendingCount", "22", "exceptionCount", "6"));
    }

    private List<Map<String, String>> buildTradeStatisticsTypeRows(boolean isEn) {
        return List.of(
                mapOf("tradeTypeCode", "KETS", "tradeTypeLabel", isEn ? "K-ETS Credit" : "배출권", "requestCount", "164", "completedCount", "131", "pendingCount", "18", "exceptionCount", "5", "avgSettlementDays", "2.4", "settlementShare", "45.8"),
                mapOf("tradeTypeCode", "REC", "tradeTypeLabel", isEn ? "REC Package" : "REC 패키지", "requestCount", "118", "completedCount", "89", "pendingCount", "19", "exceptionCount", "4", "avgSettlementDays", "2.8", "settlementShare", "28.6"),
                mapOf("tradeTypeCode", "VOLUNTARY", "tradeTypeLabel", isEn ? "Voluntary Credit" : "자발적 감축실적", "requestCount", "96", "completedCount", "74", "pendingCount", "15", "exceptionCount", "6", "avgSettlementDays", "3.2", "settlementShare", "25.6"));
    }

    private List<Map<String, String>> buildTradeStatisticsInstitutionRows(boolean isEn) {
        return List.of(
                mapOf("insttId", "TRD-STAT-001", "insttName", isEn ? "Blue Energy" : "블루에너지", "counterpartyName", isEn ? "Hanul Steel" : "한울제철", "tradeTypeCode", "KETS", "tradeTypeLabel", isEn ? "K-ETS Credit" : "배출권", "settlementStatusCode", "PENDING", "tradeVolume", "12500", "settlementAmount", "418000000", "requestCount", "18", "completedCount", "12", "pendingCount", "4", "exceptionCount", "0", "avgSettlementDays", "2.6", "lastSettledAt", "2026-03-30 18:10", "primaryContractName", isEn ? "Quarterly offset bundle" : "분기 상쇄 배치", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Blue%20Energy")),
                mapOf("insttId", "TRD-STAT-002", "insttName", isEn ? "Seoul Mobility" : "서울모빌리티", "counterpartyName", isEn ? "Green Grid" : "그린그리드", "tradeTypeCode", "REC", "tradeTypeLabel", isEn ? "REC Package" : "REC 패키지", "settlementStatusCode", "IN_PROGRESS", "tradeVolume", "8000", "settlementAmount", "192000000", "requestCount", "14", "completedCount", "9", "pendingCount", "3", "exceptionCount", "0", "avgSettlementDays", "2.8", "lastSettledAt", "2026-03-30 16:25", "primaryContractName", isEn ? "Scope 2 hedge" : "Scope 2 헤지", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Seoul%20Mobility")),
                mapOf("insttId", "TRD-STAT-003", "insttName", isEn ? "Carbon Labs" : "카본랩스", "counterpartyName", isEn ? "Eco Farm" : "에코팜", "tradeTypeCode", "VOLUNTARY", "tradeTypeLabel", isEn ? "Voluntary Credit" : "자발적 감축실적", "settlementStatusCode", "PENDING", "tradeVolume", "4250", "settlementAmount", "87500000", "requestCount", "11", "completedCount", "7", "pendingCount", "3", "exceptionCount", "0", "avgSettlementDays", "3.1", "lastSettledAt", "2026-03-29 15:40", "primaryContractName", isEn ? "Biochar contract" : "바이오차 계약", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Carbon%20Labs")),
                mapOf("insttId", "TRD-STAT-004", "insttName", isEn ? "River Cement" : "리버시멘트", "counterpartyName", isEn ? "East Port" : "이스트포트", "tradeTypeCode", "KETS", "tradeTypeLabel", isEn ? "K-ETS Credit" : "배출권", "settlementStatusCode", "DONE", "tradeVolume", "15300", "settlementAmount", "522400000", "requestCount", "22", "completedCount", "20", "pendingCount", "1", "exceptionCount", "0", "avgSettlementDays", "2.2", "lastSettledAt", "2026-03-29 14:05", "primaryContractName", isEn ? "March balancing lot" : "3월 밸런싱 물량", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=River%20Cement")),
                mapOf("insttId", "TRD-STAT-005", "insttName", isEn ? "Urban Data" : "어반데이터", "counterpartyName", isEn ? "Sun Network" : "선네트워크", "tradeTypeCode", "REC", "tradeTypeLabel", isEn ? "REC Package" : "REC 패키지", "settlementStatusCode", "EXCEPTION", "tradeVolume", "6400", "settlementAmount", "154000000", "requestCount", "13", "completedCount", "8", "pendingCount", "2", "exceptionCount", "3", "avgSettlementDays", "4.4", "lastSettledAt", "2026-03-28 13:15", "primaryContractName", isEn ? "Data center reserve" : "데이터센터 예비물량", "detailUrl", buildAdminPath(isEn, "/trade/reject?tradeId=TRD-202603-005")),
                mapOf("insttId", "TRD-STAT-006", "insttName", isEn ? "Metro Heat" : "메트로히트", "counterpartyName", isEn ? "CCUS Plant A" : "CCUS 플랜트 A", "tradeTypeCode", "VOLUNTARY", "tradeTypeLabel", isEn ? "Voluntary Credit" : "자발적 감축실적", "settlementStatusCode", "IN_PROGRESS", "tradeVolume", "10100", "settlementAmount", "301000000", "requestCount", "19", "completedCount", "13", "pendingCount", "4", "exceptionCount", "1", "avgSettlementDays", "3.3", "lastSettledAt", "2026-03-28 17:42", "primaryContractName", isEn ? "Capture storage block" : "포집 저장 블록", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Metro%20Heat")),
                mapOf("insttId", "TRD-STAT-007", "insttName", isEn ? "Blue Energy" : "블루에너지", "counterpartyName", isEn ? "Nova Chemical" : "노바케미칼", "tradeTypeCode", "KETS", "tradeTypeLabel", isEn ? "K-ETS Credit" : "배출권", "settlementStatusCode", "PENDING", "tradeVolume", "9900", "settlementAmount", "333600000", "requestCount", "17", "completedCount", "11", "pendingCount", "5", "exceptionCount", "0", "avgSettlementDays", "2.7", "lastSettledAt", "2026-03-28 12:10", "primaryContractName", isEn ? "Seasonal hedge" : "계절성 헤지", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Nova%20Chemical")),
                mapOf("insttId", "TRD-STAT-008", "insttName", isEn ? "Harbor Cold Chain" : "하버콜드체인", "counterpartyName", isEn ? "Wind Core" : "윈드코어", "tradeTypeCode", "REC", "tradeTypeLabel", isEn ? "REC Package" : "REC 패키지", "settlementStatusCode", "DONE", "tradeVolume", "3200", "settlementAmount", "71000000", "requestCount", "9", "completedCount", "8", "pendingCount", "1", "exceptionCount", "0", "avgSettlementDays", "2.0", "lastSettledAt", "2026-03-28 10:32", "primaryContractName", isEn ? "Cold-chain coverage" : "콜드체인 커버리지", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Harbor%20Cold%20Chain")),
                mapOf("insttId", "TRD-STAT-009", "insttName", isEn ? "Green Grid" : "그린그리드", "counterpartyName", isEn ? "Forest Link" : "포레스트링크", "tradeTypeCode", "VOLUNTARY", "tradeTypeLabel", isEn ? "Voluntary Credit" : "자발적 감축실적", "settlementStatusCode", "PENDING", "tradeVolume", "5800", "settlementAmount", "126000000", "requestCount", "12", "completedCount", "9", "pendingCount", "2", "exceptionCount", "0", "avgSettlementDays", "2.9", "lastSettledAt", "2026-03-27 18:24", "primaryContractName", isEn ? "Afforestation offset" : "조림 상쇄 거래", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Green%20Grid")),
                mapOf("insttId", "TRD-STAT-010", "insttName", isEn ? "Seoul Mobility" : "서울모빌리티", "counterpartyName", isEn ? "River Cement" : "리버시멘트", "tradeTypeCode", "KETS", "tradeTypeLabel", isEn ? "K-ETS Credit" : "배출권", "settlementStatusCode", "DONE", "tradeVolume", "7700", "settlementAmount", "257000000", "requestCount", "15", "completedCount", "14", "pendingCount", "1", "exceptionCount", "0", "avgSettlementDays", "2.1", "lastSettledAt", "2026-03-27 09:08", "primaryContractName", isEn ? "Compliance shortfall fill" : "의무량 보전 계약", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Seoul%20Mobility")),
                mapOf("insttId", "TRD-STAT-011", "insttName", isEn ? "Metro Heat" : "메트로히트", "counterpartyName", isEn ? "North Solar" : "노스솔라", "tradeTypeCode", "REC", "tradeTypeLabel", isEn ? "REC Package" : "REC 패키지", "settlementStatusCode", "IN_PROGRESS", "tradeVolume", "2850", "settlementAmount", "59400000", "requestCount", "8", "completedCount", "5", "pendingCount", "2", "exceptionCount", "0", "avgSettlementDays", "3.0", "lastSettledAt", "2026-03-26 13:46", "primaryContractName", isEn ? "Heat network mix" : "열공급 믹스 거래", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=Metro%20Heat")),
                mapOf("insttId", "TRD-STAT-012", "insttName", isEn ? "Hanul Steel" : "한울제철", "counterpartyName", isEn ? "Eco Farm" : "에코팜", "tradeTypeCode", "VOLUNTARY", "tradeTypeLabel", isEn ? "Voluntary Credit" : "자발적 감축실적", "settlementStatusCode", "EXCEPTION", "tradeVolume", "6900", "settlementAmount", "143500000", "requestCount", "10", "completedCount", "4", "pendingCount", "3", "exceptionCount", "2", "avgSettlementDays", "4.1", "lastSettledAt", "2026-03-25 16:18", "primaryContractName", isEn ? "Agriculture offset pool" : "농업 상쇄 풀", "detailUrl", buildAdminPath(isEn, "/trade/reject?tradeId=TRD-202603-012")));
    }

    private List<Map<String, String>> buildTradeStatisticsAlertRows(boolean isEn) {
        return List.of(
                mapOf("title", isEn ? "Pending settlement backlog" : "정산 대기 백로그",
                        "description", isEn ? "Blue Energy and Seoul Mobility hold the largest unsettled queues this week." : "블루에너지와 서울모빌리티의 미정산 큐가 이번 주 가장 큽니다.",
                        "badge", isEn ? "Attention" : "주의",
                        "toneClassName", "bg-amber-100 text-amber-700",
                        "actionLabel", isEn ? "Open trade queue" : "거래 목록 열기",
                        "actionUrl", buildAdminPath(isEn, "/trade/list?settlementStatus=PENDING")),
                mapOf("title", isEn ? "Settlement exceptions concentrated" : "정산 예외 기관 집중",
                        "description", isEn ? "Urban Data and Hanul Steel need operator follow-up for exception resolution." : "어반데이터와 한울제철 건은 예외 해소를 위한 운영자 후속 조치가 필요합니다.",
                        "badge", isEn ? "Action" : "조치",
                        "toneClassName", "bg-rose-100 text-rose-700",
                        "actionLabel", isEn ? "Open exception queue" : "예외 큐 열기",
                        "actionUrl", buildAdminPath(isEn, "/trade/list?settlementStatus=EXCEPTION")),
                mapOf("title", isEn ? "REC settlement pace slowing" : "REC 정산 속도 저하",
                        "description", isEn ? "REC package settlement lead time exceeded the watch line for two consecutive weeks." : "REC 패키지의 정산 소요일이 2주 연속 감시선 이상입니다.",
                        "badge", isEn ? "Watch" : "관찰",
                        "toneClassName", "bg-sky-100 text-sky-700",
                        "actionLabel", isEn ? "Filter REC reports" : "REC 리포트 보기",
                        "actionUrl", buildAdminPath(isEn, "/trade/statistics?tradeType=REC")));
    }

    private List<Map<String, String>> buildTradeDuplicateRows(boolean isEn) {
        return List.of(
                mapOf("reviewId", "TDR-2026-0411", "tradeId", "TRD-202603-005", "contractName", isEn ? "Data center reserve" : "데이터센터 예비물량", "sellerName", isEn ? "Sun Network" : "선네트워크", "buyerName", isEn ? "Urban Data" : "어반데이터", "analyst", isEn ? "Jiwon Park" : "박지원", "reason", isEn ? "Repeated counterparties and settlement gap in the same closing window." : "같은 마감 창구에서 거래 당사자 반복과 정산 불일치가 함께 감지되었습니다.", "detectionTypeCode", "SETTLEMENT_GAP", "detectionTypeLabel", isEn ? "Settlement gap" : "정산 불일치", "reviewStatusCode", "BLOCKED", "reviewStatusLabel", isEn ? "Settlement blocked" : "정산 보류", "riskLevelCode", "CRITICAL", "riskLevelLabel", isEn ? "Critical" : "치명", "detectedAt", "2026-03-31 08:45", "quantity", "6,400 MWh", "amount", "KRW 154,000,000", "investigationSummary", isEn ? "Closing ledger and trade ledger diverged after a duplicate counterparty check." : "중복 상대기관 확인 이후 마감 원장과 거래 원장 값이 어긋났습니다.", "recommendedAction", isEn ? "Keep blocked until ledger sync is complete." : "원장 동기화 완료 전까지 차단을 유지합니다.", "settlementActionLabel", isEn ? "Block settlement batch" : "정산 배치 차단", "detailUrl", buildAdminPath(isEn, "/trade/reject?tradeId=TRD-202603-005")),
                mapOf("reviewId", "TDR-2026-0410", "tradeId", "TRD-202603-007", "contractName", isEn ? "Seasonal hedge" : "계절성 헤지", "sellerName", isEn ? "Nova Chemical" : "노바케미칼", "buyerName", isEn ? "Blue Energy" : "블루에너지", "analyst", isEn ? "Dahye Seo" : "서다혜", "reason", isEn ? "Counterparty overlap with unusual price movement." : "거래 상대 중복과 비정상 가격 편차가 동시에 탐지되었습니다.", "detectionTypeCode", "DUPLICATE_PARTY", "detectionTypeLabel", isEn ? "Duplicate party" : "거래 당사자 중복", "reviewStatusCode", "ESCALATED", "reviewStatusLabel", isEn ? "Escalated" : "상향 검토", "riskLevelCode", "HIGH", "riskLevelLabel", isEn ? "High" : "높음", "detectedAt", "2026-03-31 08:12", "quantity", "9,900 tCO2eq", "amount", "KRW 333,600,000", "investigationSummary", isEn ? "The same counterpart group appeared in a high-premium hedge cluster." : "고프리미엄 헤지 묶음에서 동일 상대기관 그룹이 반복 확인되었습니다.", "recommendedAction", isEn ? "Escalate to supervisor and compare prior-day orders." : "상급자 검토로 전환하고 전일 주문과 대조합니다.", "settlementActionLabel", isEn ? "Supervisor approval required" : "상급자 승인 필요", "detailUrl", buildAdminPath(isEn, "/trade/duplicate?searchKeyword=Nova")),
                mapOf("reviewId", "TDR-2026-0409", "tradeId", "TRD-202603-003", "contractName", isEn ? "Biochar contract" : "바이오차 계약", "sellerName", isEn ? "Eco Farm" : "에코팜", "buyerName", isEn ? "Carbon Labs" : "카본랩스", "analyst", isEn ? "Yuna Choi" : "최유나", "reason", isEn ? "Order split pattern was repeated within the same day." : "동일 일자 내 주문 분할 패턴이 반복 확인되었습니다.", "detectionTypeCode", "SPLIT_ORDER", "detectionTypeLabel", isEn ? "Split order" : "주문 분할", "reviewStatusCode", "REVIEW", "reviewStatusLabel", isEn ? "Under review" : "검토 중", "riskLevelCode", "MEDIUM", "riskLevelLabel", isEn ? "Medium" : "중간", "detectedAt", "2026-03-30 17:40", "quantity", "4,250 tCO2eq", "amount", "KRW 87,500,000", "investigationSummary", isEn ? "Child orders stayed below review threshold but share the same pattern." : "하위 주문이 검토 임계치 이하로 쪼개졌지만 동일 패턴이 반복됩니다.", "recommendedAction", isEn ? "Review trader note and execution policy." : "거래 메모와 실행 정책을 검토합니다.", "settlementActionLabel", isEn ? "Review before settlement" : "정산 전 검토", "detailUrl", buildAdminPath(isEn, "/trade/duplicate?searchKeyword=Eco")),
                mapOf("reviewId", "TDR-2026-0407", "tradeId", "TRD-202603-012", "contractName", isEn ? "Agriculture offset pool" : "농업 상쇄 풀", "sellerName", isEn ? "Eco Farm" : "에코팜", "buyerName", isEn ? "Hanul Steel" : "한울제철", "analyst", isEn ? "Minji Lee" : "이민지", "reason", isEn ? "Trade volume exceeded the configured exposure threshold." : "거래 물량이 설정된 노출 한도를 초과했습니다.", "detectionTypeCode", "LIMIT_BREACH", "detectionTypeLabel", isEn ? "Limit breach" : "한도 초과", "reviewStatusCode", "REVIEW", "reviewStatusLabel", isEn ? "Under review" : "검토 중", "riskLevelCode", "HIGH", "riskLevelLabel", isEn ? "High" : "높음", "detectedAt", "2026-03-30 15:08", "quantity", "6,900 tCO2eq", "amount", "KRW 143,500,000", "investigationSummary", isEn ? "Exposure cap was already near limit from an earlier exception case." : "기존 예외 거래 영향으로 노출 한도가 이미 임계점에 가까웠습니다.", "recommendedAction", isEn ? "Confirm committee override or reject." : "위원회 예외승인 여부를 확인하거나 반려합니다.", "settlementActionLabel", isEn ? "Risk override required" : "리스크 예외승인 필요", "detailUrl", buildAdminPath(isEn, "/trade/reject?tradeId=TRD-202603-012")),
                mapOf("reviewId", "TDR-2026-0405", "tradeId", "TRD-202603-011", "contractName", isEn ? "Heat network mix" : "열공급 믹스 거래", "sellerName", isEn ? "North Solar" : "노스솔라", "buyerName", isEn ? "Metro Heat" : "메트로히트", "analyst", isEn ? "Ara Yun" : "윤아라", "reason", isEn ? "Price outlier flagged against the same-week REC bundle benchmark." : "동주차 REC 묶음 벤치마크 대비 가격 이상이 감지되었습니다.", "detectionTypeCode", "PRICE_OUTLIER", "detectionTypeLabel", isEn ? "Price outlier" : "가격 이상", "reviewStatusCode", "CLEARED", "reviewStatusLabel", isEn ? "Cleared" : "해소", "riskLevelCode", "LOW", "riskLevelLabel", isEn ? "Low" : "낮음", "detectedAt", "2026-03-30 11:26", "quantity", "2,850 MWh", "amount", "KRW 59,400,000", "investigationSummary", isEn ? "Operator note matched a temporary REC market premium and was accepted." : "운영 메모상 일시적 REC 프리미엄 사유가 확인되어 해소 처리되었습니다.", "recommendedAction", isEn ? "Proceed with settlement and keep note attached." : "메모를 첨부한 채 정산을 진행합니다.", "settlementActionLabel", isEn ? "Settlement can proceed" : "정산 진행 가능", "detailUrl", buildAdminPath(isEn, "/trade/list?searchKeyword=North")));
    }

    private Map<String, String> tradeRow(
            String tradeId,
            String productType,
            String sellerName,
            String buyerName,
            String contractName,
            String quantity,
            String amount,
            String requestedAt,
            String tradeStatusCode,
            String tradeStatusLabel,
            String settlementStatusCode,
            String settlementStatusLabel) {
        return mapOf(
                "tradeId", tradeId,
                "productType", productType,
                "sellerName", sellerName,
                "buyerName", buyerName,
                "contractName", contractName,
                "quantity", quantity,
                "amount", amount,
                "requestedAt", requestedAt,
                "tradeStatusCode", tradeStatusCode,
                "tradeStatusLabel", tradeStatusLabel,
                "settlementStatusCode", settlementStatusCode,
                "settlementStatusLabel", settlementStatusLabel);
    }

    private Map<String, String> option(String code, String label) {
        return mapOf("code", code, "label", label);
    }

    private Map<String, String> mapOf(String... values) {
        Map<String, String> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(values[index], values[index + 1]);
        }
        return row;
    }

    private String buildAdminPath(boolean isEn, String path) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

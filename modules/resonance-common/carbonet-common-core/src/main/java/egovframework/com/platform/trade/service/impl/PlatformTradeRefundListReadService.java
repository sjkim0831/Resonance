package egovframework.com.platform.trade.service.impl;

import egovframework.com.platform.trade.service.TradeRefundListReadPort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PlatformTradeRefundListReadService implements TradeRefundListReadPort {

    @Override
    public Map<String, Object> buildRefundListPageData(
            String pageIndexParam,
            String searchKeyword,
            String status,
            String riskLevel,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        String keyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safeString(status).toUpperCase(Locale.ROOT);
        String normalizedRiskLevel = safeString(riskLevel).toUpperCase(Locale.ROOT);

        List<Map<String, String>> allRows = buildRefundListRows(isEn);
        List<Map<String, String>> filteredRows = new ArrayList<>();
        for (Map<String, String> row : allRows) {
            String searchable = String.join(" ",
                    safeString(row.get("refundId")),
                    safeString(row.get("companyName")),
                    safeString(row.get("applicantName")),
                    safeString(row.get("paymentMethodLabel")),
                    safeString(row.get("reasonSummary")),
                    safeString(row.get("accountMasked"))).toLowerCase(Locale.ROOT);
            String rowStatus = safeString(row.get("statusCode")).toUpperCase(Locale.ROOT);
            String rowRiskLevel = safeString(row.get("riskLevelCode")).toUpperCase(Locale.ROOT);
            boolean matchesKeyword = keyword.isEmpty() || searchable.contains(keyword);
            boolean matchesStatus = normalizedStatus.isEmpty() || normalizedStatus.equals(rowStatus);
            boolean matchesRiskLevel = normalizedRiskLevel.isEmpty() || normalizedRiskLevel.equals(rowRiskLevel);
            if (matchesKeyword && matchesStatus && matchesRiskLevel) {
                filteredRows.add(row);
            }
        }

        int pageSize = 8;
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageRows = filteredRows.subList(fromIndex, toIndex);

        long pendingCount = allRows.stream()
                .filter(row -> "RECEIVED".equalsIgnoreCase(safeString(row.get("statusCode")))
                        || "ACCOUNT_REVIEW".equalsIgnoreCase(safeString(row.get("statusCode"))))
                .count();
        long inReviewCount = allRows.stream()
                .filter(row -> "IN_REVIEW".equalsIgnoreCase(safeString(row.get("statusCode"))))
                .count();
        long transferScheduledCount = allRows.stream()
                .filter(row -> "TRANSFER_SCHEDULED".equalsIgnoreCase(safeString(row.get("statusCode"))))
                .count();
        long completedCount = allRows.stream()
                .filter(row -> "COMPLETED".equalsIgnoreCase(safeString(row.get("statusCode"))))
                .count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("refundRows", pageRows);
        response.put("totalCount", totalCount);
        response.put("pendingCount", pendingCount);
        response.put("inReviewCount", inReviewCount);
        response.put("transferScheduledCount", transferScheduledCount);
        response.put("completedCount", completedCount);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("status", normalizedStatus);
        response.put("riskLevel", normalizedRiskLevel);
        response.put("statusOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("RECEIVED", isEn ? "Received" : "접수"),
                option("ACCOUNT_REVIEW", isEn ? "Account Review" : "계좌 검수"),
                option("IN_REVIEW", isEn ? "In Review" : "검토중"),
                option("APPROVED", isEn ? "Approved" : "승인"),
                option("TRANSFER_SCHEDULED", isEn ? "Transfer Scheduled" : "이체 예정"),
                option("COMPLETED", isEn ? "Completed" : "처리 완료"),
                option("REJECTED", isEn ? "Rejected" : "반려")));
        response.put("riskLevelOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("HIGH", isEn ? "High" : "높음"),
                option("MEDIUM", isEn ? "Medium" : "보통"),
                option("LOW", isEn ? "Low" : "낮음")));
        response.put("refundAlerts", List.of(
                mapOf(
                        "title", isEn ? "Same-day transfer cut-off" : "당일 이체 마감 확인",
                        "detail", isEn ? "Approved refunds after 16:00 move to the next business-day transfer batch."
                                : "16시 이후 승인된 환불은 다음 영업일 이체 배치로 이월됩니다.",
                        "tone", "warning"),
                mapOf(
                        "title", isEn ? "Account verification backlog" : "환불 계좌 검수 적체",
                        "detail", isEn ? "Requests missing account-owner validation should stay blocked before approval."
                                : "예금주 검증이 끝나지 않은 요청은 승인 전에 계속 보류해야 합니다.",
                        "tone", "info")));
        return response;
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

    private List<Map<String, String>> buildRefundListRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(refundRow("RFD-202603-031", isEn ? "Hanul Steel" : "한울제철", isEn ? "Kim Minseo" : "김민서",
                isEn ? "Card Refund" : "카드 취소", "Shinhan 123-45****-88", "KRW 1,280,000", "KRW 1,280,000",
                "2026-03-31 15:10", "RECEIVED", isEn ? "Received" : "접수", "HIGH", isEn ? "High" : "높음",
                isEn ? "Duplicate payment detected during invoice closing." : "세금계산서 마감 중 이중 결제가 확인되었습니다.",
                isEn ? "Verify duplicate transaction evidence" : "중복 결제 증빙 확인"));
        rows.add(refundRow("RFD-202603-030", isEn ? "Blue Energy" : "블루에너지", isEn ? "Park Jiwon" : "박지원",
                isEn ? "Bank Transfer" : "계좌 이체", "KB 991-20****-11", "KRW 860,000", "KRW 860,000",
                "2026-03-31 13:42", "ACCOUNT_REVIEW", isEn ? "Account Review" : "계좌 검수", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Refund account was changed after submission." : "신청 후 환불 계좌가 변경되었습니다.",
                isEn ? "Confirm account ownership" : "예금주 확인"));
        rows.add(refundRow("RFD-202603-029", isEn ? "Metro Heat" : "메트로히트", isEn ? "Lee Seojun" : "이서준",
                isEn ? "Card Refund" : "카드 취소", "Hyundai 883-10****-04", "KRW 540,000", "KRW 540,000",
                "2026-03-31 11:05", "IN_REVIEW", isEn ? "In Review" : "검토중", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Service package downgrade before activation." : "서비스 개시 전 상품 등급 하향 요청입니다.",
                isEn ? "Review downgrade effective date" : "등급 변경 적용일 검토"));
        rows.add(refundRow("RFD-202603-028", isEn ? "Green Grid" : "그린그리드", isEn ? "Choi Yena" : "최예나",
                isEn ? "Bank Transfer" : "계좌 이체", "NH 118-77****-90", "KRW 2,140,000", "KRW 1,920,000",
                "2026-03-30 17:26", "APPROVED", isEn ? "Approved" : "승인", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Partial refund after monthly settlement offset." : "월 정산 상계 후 부분 환불 승인 건입니다.",
                isEn ? "Queue next transfer batch" : "다음 이체 배치 편성"));
        rows.add(refundRow("RFD-202603-027", isEn ? "River Cement" : "리버시멘트", isEn ? "Han Jaeho" : "한재호",
                isEn ? "Bank Transfer" : "계좌 이체", "Woori 227-00****-53", "KRW 3,400,000", "KRW 3,400,000",
                "2026-03-30 15:11", "TRANSFER_SCHEDULED", isEn ? "Transfer Scheduled" : "이체 예정", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Approved full refund awaiting treasury batch." : "전액 환불 승인 후 자금 배치 대기 중입니다.",
                isEn ? "Monitor transfer completion" : "이체 완료 모니터링"));
        rows.add(refundRow("RFD-202603-026", isEn ? "Sun Network" : "선네트워크", isEn ? "Jeong Haein" : "정해인",
                isEn ? "Card Refund" : "카드 취소", "Samsung 771-30****-61", "KRW 420,000", "KRW 420,000",
                "2026-03-29 18:08", "COMPLETED", isEn ? "Completed" : "처리 완료", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Cancellation completed with card acquirer." : "카드 매입사 취소 처리가 완료되었습니다.",
                isEn ? "Complete" : "완료"));
        rows.add(refundRow("RFD-202603-025", isEn ? "Carbon Labs" : "카본랩스", isEn ? "Yun Ara" : "윤아라",
                isEn ? "Bank Transfer" : "계좌 이체", "IBK 004-18****-32", "KRW 1,100,000", "KRW 0",
                "2026-03-29 12:14", "REJECTED", isEn ? "Rejected" : "반려", "HIGH", isEn ? "High" : "높음",
                isEn ? "Requested period already consumed by issued certificate." : "발급 완료된 인증서 사용 기간과 중복되어 반려되었습니다.",
                isEn ? "Notify rejection reason" : "반려 사유 안내"));
        rows.add(refundRow("RFD-202603-024", isEn ? "Seoul Mobility" : "서울모빌리티", isEn ? "Kang Doyun" : "강도윤",
                isEn ? "Bank Transfer" : "계좌 이체", "KakaoBank 333-22****-71", "KRW 780,000", "KRW 780,000",
                "2026-03-28 10:22", "IN_REVIEW", isEn ? "In Review" : "검토중", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Support escalation attached for service outage credit." : "서비스 장애 보상 사유로 고객지원 이관 메모가 첨부되었습니다.",
                isEn ? "Validate outage compensation rule" : "장애 보상 기준 확인"));
        rows.add(refundRow("RFD-202603-023", isEn ? "Nova Chemical" : "노바케미칼", isEn ? "Seo Dahye" : "서다혜",
                isEn ? "Card Refund" : "카드 취소", "Lotte 441-90****-15", "KRW 690,000", "KRW 690,000",
                "2026-03-27 16:35", "TRANSFER_SCHEDULED", isEn ? "Transfer Scheduled" : "이체 예정", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Treasury approved same-week refund batch." : "재무팀이 주간 환불 배치를 승인했습니다.",
                isEn ? "Await batch completion" : "배치 완료 대기"));
        return rows;
    }

    private Map<String, String> refundRow(
            String refundId,
            String companyName,
            String applicantName,
            String paymentMethodLabel,
            String accountMasked,
            String requestedAmount,
            String refundableAmount,
            String requestedAt,
            String statusCode,
            String statusLabel,
            String riskLevelCode,
            String riskLevelLabel,
            String reasonSummary,
            String nextActionLabel) {
        return mapOf(
                "refundId", refundId,
                "companyName", companyName,
                "applicantName", applicantName,
                "paymentMethodLabel", paymentMethodLabel,
                "accountMasked", accountMasked,
                "requestedAmount", requestedAmount,
                "refundableAmount", refundableAmount,
                "requestedAt", requestedAt,
                "statusCode", statusCode,
                "statusLabel", statusLabel,
                "riskLevelCode", riskLevelCode,
                "riskLevelLabel", riskLevelLabel,
                "reasonSummary", reasonSummary,
                "nextActionLabel", nextActionLabel);
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

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}

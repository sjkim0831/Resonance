package egovframework.com.platform.trade.service.impl;

import egovframework.com.platform.trade.service.TradeControlPlanePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class PlatformTradeControlPlaneService implements TradeControlPlanePort {

    private final PlatformTradeBootstrapReadService platformTradeBootstrapReadService;
    private final PlatformPaymentBootstrapReadService platformPaymentBootstrapReadService;

    private final Map<String, Map<String, String>> tradeApprovalState = new ConcurrentHashMap<>();

    @Override
    public Map<String, Object> buildTradeListPageData(
            String pageIndexParam,
            String searchKeyword,
            String tradeStatus,
            String settlementStatus,
            boolean isEn) {
        return platformTradeBootstrapReadService.buildTradeListPageData(
                pageIndexParam,
                searchKeyword,
                tradeStatus,
                settlementStatus,
                isEn);
    }

    @Override
    public Map<String, Object> buildTradeStatisticsPageData(
            String pageIndexParam,
            String searchKeyword,
            String periodFilter,
            String tradeType,
            String settlementStatus,
            boolean isEn) {
        return platformTradeBootstrapReadService.buildTradeStatisticsPageData(
                pageIndexParam,
                searchKeyword,
                periodFilter,
                tradeType,
                settlementStatus,
                isEn);
    }

    @Override
    public Map<String, Object> buildTradeDuplicatePageData(
            String pageIndexParam,
            String searchKeyword,
            String detectionType,
            String reviewStatus,
            String riskLevel,
            boolean isEn) {
        return platformTradeBootstrapReadService.buildTradeDuplicatePageData(
                pageIndexParam,
                searchKeyword,
                detectionType,
                reviewStatus,
                riskLevel,
                isEn);
    }

    @Override
    public Map<String, Object> buildSettlementCalendarPageData(
            String pageIndexParam,
            String selectedMonth,
            String searchKeyword,
            String settlementStatus,
            String riskLevel,
            boolean isEn) {
        return platformPaymentBootstrapReadService.buildSettlementCalendarPageData(
                pageIndexParam,
                selectedMonth,
                searchKeyword,
                settlementStatus,
                riskLevel,
                isEn);
    }

    @Override
    public Map<String, Object> buildTradeRejectPageData(String tradeId, String returnUrl, boolean isEn) {
        String normalizedTradeId = safeString(tradeId);
        String normalizedReturnUrl = safeString(returnUrl);
        if (normalizedReturnUrl.isEmpty()) {
            normalizedReturnUrl = buildAdminPath(isEn, "/trade/list");
        }

        Map<String, String> selectedTrade = platformTradeBootstrapReadService.buildTradeListRows(isEn).stream()
                .filter(row -> normalizedTradeId.equalsIgnoreCase(safeString(row.get("tradeId"))))
                .findFirst()
                .orElse(null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("tradeId", normalizedTradeId);
        response.put("returnUrl", normalizedReturnUrl);
        response.put("listUrl", buildAdminPath(isEn, "/trade/list"));
        response.put("found", selectedTrade != null);

        if (selectedTrade == null) {
            response.put("pageError", normalizedTradeId.isEmpty()
                    ? (isEn ? "A trade ID is required to review a rejection case." : "반려 검토를 하려면 거래 ID가 필요합니다.")
                    : (isEn ? "The selected trade could not be found in the current operator queue." : "현재 운영 큐에서 선택한 거래를 찾을 수 없습니다."));
            return response;
        }

        response.putAll(selectedTrade);
        response.put("blockerCount", 3);
        response.put("evidenceCount", 3);
        response.put("historyCount", 4);
        response.put("suggestedReason", isEn ? "Counterparty evidence mismatch" : "상대 기관 증빙 불일치");
        response.put("rejectionChecklist", List.of(
                mapOf(
                        "title", isEn ? "Contract consistency" : "계약 정보 정합성",
                        "detail", isEn ? "Seller and buyer submitted different contract quantities for the same settlement window."
                                : "동일 정산 구간에 대해 매도·매수 기관이 제출한 계약 수량이 서로 다릅니다.",
                        "severity", "high"),
                mapOf(
                        "title", isEn ? "Evidence completeness" : "증빙 첨부 완전성",
                        "detail", isEn ? "Required settlement evidence is missing the counterparty signed attachment."
                                : "필수 정산 증빙 중 상대 기관 서명 첨부가 누락되었습니다.",
                        "severity", "medium"),
                mapOf(
                        "title", isEn ? "Operator handoff" : "운영 인수 조건",
                        "detail", isEn ? "Rejection notice should include the exact resubmission scope and due date."
                                : "반려 통지에는 재제출 범위와 기한을 명확히 적어야 합니다.",
                        "severity", "medium")));
        response.put("rejectionReasons", List.of(
                mapOf("code", "EVIDENCE_GAP", "label", isEn ? "Missing evidence package" : "증빙 누락"),
                mapOf("code", "COUNTERPARTY_MISMATCH", "label", isEn ? "Counterparty mismatch" : "상대 기관 정보 불일치"),
                mapOf("code", "SETTLEMENT_SCOPE", "label", isEn ? "Settlement scope mismatch" : "정산 범위 불일치"),
                mapOf("code", "COMPLIANCE_RISK", "label", isEn ? "Compliance or policy risk" : "준수 정책 위험")));
        response.put("evidenceRows", List.of(
                mapOf("fileName", isEn ? "trade-request-form.pdf" : "거래신청서.pdf", "category", isEn ? "Application" : "신청서", "statusLabel", isEn ? "Submitted" : "제출완료", "owner", selectedTrade.get("sellerName")),
                mapOf("fileName", isEn ? "counterparty-confirmation.pdf" : "상대기관확인서.pdf", "category", isEn ? "Counterparty" : "상대기관 확인", "statusLabel", isEn ? "Missing signature" : "서명 누락", "owner", selectedTrade.get("buyerName")),
                mapOf("fileName", isEn ? "settlement-sheet.xlsx" : "정산내역.xlsx", "category", isEn ? "Settlement" : "정산자료", "statusLabel", isEn ? "Value mismatch" : "수치 불일치", "owner", isEn ? "Operations desk" : "운영 데스크")));
        response.put("historyRows", List.of(
                mapOf("occurredAt", "2026-03-30 09:10", "actor", selectedTrade.get("sellerName"), "actionLabel", isEn ? "Requested trade registration" : "거래 등록 요청", "note", isEn ? "Initial trade request submitted." : "초기 거래 요청이 접수되었습니다."),
                mapOf("occurredAt", "2026-03-30 10:05", "actor", isEn ? "Matching engine" : "매칭 엔진", "actionLabel", isEn ? "Detected mismatch" : "불일치 탐지", "note", isEn ? "Buyer quantity and submitted contract differ." : "매수 기관 수량과 제출 계약서 수치가 다릅니다."),
                mapOf("occurredAt", "2026-03-30 10:40", "actor", isEn ? "Operations desk" : "운영 담당", "actionLabel", isEn ? "Requested resubmission evidence" : "보완 증빙 요청", "note", isEn ? "Counterparty signature was requested." : "상대 기관 서명 보완을 요청했습니다."),
                mapOf("occurredAt", "2026-03-30 13:20", "actor", selectedTrade.get("buyerName"), "actionLabel", isEn ? "Uploaded revised file" : "수정 파일 업로드", "note", isEn ? "Updated file still omits settlement annex." : "수정 파일에도 정산 부속서가 누락되어 있습니다.")));
        response.put("notificationPlan", List.of(
                mapOf("target", selectedTrade.get("sellerName"), "channel", isEn ? "Portal inbox + email" : "포털 알림 + 이메일", "detail", isEn ? "Include resubmission deadline and evidence checklist." : "재제출 기한과 증빙 체크리스트를 함께 안내합니다."),
                mapOf("target", selectedTrade.get("buyerName"), "channel", isEn ? "Portal inbox" : "포털 알림", "detail", isEn ? "Notify counterpart that trade was returned for correction." : "거래가 보완 요청 상태로 전환됐음을 통지합니다."),
                mapOf("target", isEn ? "Settlement desk" : "정산 운영팀", "channel", isEn ? "Internal note" : "내부 메모", "detail", isEn ? "Keep settlement hold until corrected evidence arrives." : "보완 증빙 접수 전까지 정산 보류 상태를 유지합니다.")));
        response.put("quickLinks", List.of(
                mapOf("label", isEn ? "Back to trade list" : "거래 목록으로", "href", buildAdminPath(isEn, "/trade/list")),
                mapOf("label", isEn ? "Open emission validation" : "검증 관리 이동", "href", buildAdminPath(isEn, "/emission/validate")),
                mapOf("label", isEn ? "Open certificate review" : "발급 검토 이동", "href", buildAdminPath(isEn, "/certificate/review"))));
        return response;
    }

    @Override
    public Map<String, Object> buildTradeApprovePageData(
            String pageIndexParam,
            String searchKeyword,
            String approvalStatus,
            String tradeType,
            boolean isEn) {
        int pageIndex = 1;
        if (!safeString(pageIndexParam).isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }

        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedApprovalStatus = safeString(approvalStatus).toUpperCase(Locale.ROOT);
        if (normalizedApprovalStatus.isEmpty()) {
            normalizedApprovalStatus = "PENDING";
        }
        String normalizedTradeType = safeString(tradeType).toUpperCase(Locale.ROOT);

        List<Map<String, String>> allRows = buildTradeApproveRows(isEn);
        List<Map<String, String>> filteredRows = new ArrayList<>();
        for (Map<String, String> row : allRows) {
            String searchable = String.join(" ",
                    safeString(row.get("tradeId")),
                    safeString(row.get("productType")),
                    safeString(row.get("sellerName")),
                    safeString(row.get("buyerName")),
                    safeString(row.get("contractName"))).toLowerCase(Locale.ROOT);
            boolean matchesKeyword = normalizedKeyword.isEmpty() || searchable.contains(normalizedKeyword);
            boolean matchesStatus = "ALL".equals(normalizedApprovalStatus)
                    || normalizedApprovalStatus.equalsIgnoreCase(safeString(row.get("approvalStatusCode")));
            boolean matchesTradeType = normalizedTradeType.isEmpty()
                    || normalizedTradeType.equalsIgnoreCase(safeString(row.get("tradeTypeCode")));
            if (matchesKeyword && matchesStatus && matchesTradeType) {
                filteredRows.add(row);
            }
        }

        int pageSize = 10;
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("approvalRows", filteredRows.subList(fromIndex, toIndex));
        response.put("totalCount", totalCount);
        response.put("pendingCount", countByApprovalStatus(allRows, "PENDING"));
        response.put("approvedCount", countByApprovalStatus(allRows, "APPROVED"));
        response.put("rejectedCount", countByApprovalStatus(allRows, "REJECTED"));
        response.put("holdCount", countByApprovalStatus(allRows, "HOLD"));
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("approvalStatus", normalizedApprovalStatus);
        response.put("tradeType", normalizedTradeType);
        response.put("approvalStatusOptions", List.of(
                option("ALL", isEn ? "All" : "전체"),
                option("PENDING", isEn ? "Pending" : "승인 대기"),
                option("APPROVED", isEn ? "Approved" : "승인 완료"),
                option("REJECTED", isEn ? "Rejected" : "반려"),
                option("HOLD", isEn ? "On Hold" : "보류")));
        response.put("tradeTypeOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("KETS", isEn ? "K-ETS Credit" : "배출권"),
                option("REC", isEn ? "REC Package" : "REC 패키지"),
                option("VOLUNTARY", isEn ? "Voluntary Credit" : "자발적 감축실적")));
        response.put("canViewTradeApprove", true);
        response.put("canUseTradeApproveAction", true);
        return response;
    }

    @Override
    public Map<String, Object> submitTradeApproveAction(Map<String, Object> payload, boolean isEn) {
        String action = stringValue(payload == null ? null : payload.get("action")).toLowerCase(Locale.ROOT);
        String tradeId = stringValue(payload == null ? null : payload.get("tradeId"));
        List<String> selectedIds = normalizeSelectedIds(payload == null ? null : payload.get("selectedIds"), tradeId);
        String rejectReason = stringValue(payload == null ? null : payload.get("rejectReason"));

        Map<String, Object> response = new LinkedHashMap<>();
        if (selectedIds.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Select at least one trade to process." : "처리할 거래를 하나 이상 선택해 주세요.");
            return response;
        }
        boolean approveAction = "approve".equals(action) || "batch_approve".equals(action);
        boolean rejectAction = "reject".equals(action) || "batch_reject".equals(action);
        if (!approveAction && !rejectAction) {
            response.put("success", false);
            response.put("message", isEn ? "The requested trade action is invalid." : "요청한 거래 처리 작업이 올바르지 않습니다.");
            return response;
        }
        if (rejectAction && rejectReason.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Enter a reject reason before submitting rejection." : "반려 처리 전에 반려 사유를 입력해 주세요.");
            return response;
        }

        ensureTradeApprovalState();
        for (String selectedId : selectedIds) {
            Map<String, String> state = tradeApprovalState.computeIfAbsent(selectedId, key -> defaultTradeApprovalState());
            state.put("approvalStatusCode", approveAction ? "APPROVED" : "REJECTED");
            state.put("reviewedAt", "2026-03-31 14:20");
            state.put("reviewerName", isEn ? "Trade Ops Desk" : "거래 운영팀");
            if (approveAction) {
                state.put("rejectReason", "");
            } else {
                state.put("rejectReason", rejectReason);
            }
        }

        response.put("success", true);
        response.put("result", approveAction
                ? (selectedIds.size() > 1 ? "batchApproved" : "approved")
                : (selectedIds.size() > 1 ? "batchRejected" : "rejected"));
        response.put("selectedIds", selectedIds);
        return response;
    }

    @Override
    public Map<String, Object> submitTradeRejectAction(Map<String, Object> payload, boolean isEn) {
        String tradeId = stringValue(payload == null ? null : payload.get("tradeId"));
        String rejectReason = stringValue(payload == null ? null : payload.get("rejectReason"));
        String operatorNote = stringValue(payload == null ? null : payload.get("operatorNote"));

        Map<String, Object> response = new LinkedHashMap<>();
        if (tradeId.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Trade ID is required." : "거래 ID가 필요합니다.");
            return response;
        }
        if (rejectReason.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Select or enter a rejection reason before submitting." : "반려 사유를 선택하거나 입력한 뒤 제출하세요.");
            return response;
        }

        response.put("success", true);
        response.put("tradeId", tradeId);
        response.put("message", isEn
                ? String.format("Trade %s was marked for rejection review. Notify both counterparties with the updated evidence scope.", tradeId)
                : String.format("%s 거래를 반려 검토 상태로 기록했습니다. 양측 기관에 보완 범위를 안내하세요.", tradeId));
        response.put("reviewStatus", "REJECT_RECORDED");
        response.put("rejectReason", rejectReason);
        response.put("operatorNote", operatorNote);
        return response;
    }

    private List<Map<String, String>> buildTradeApproveRows(boolean isEn) {
        ensureTradeApprovalState();
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> baseRow : platformTradeBootstrapReadService.buildTradeListRows(isEn)) {
            Map<String, String> state = tradeApprovalState.computeIfAbsent(
                    safeString(baseRow.get("tradeId")),
                    key -> defaultTradeApprovalState());
            String approvalStatusCode = safeString(state.get("approvalStatusCode"));
            Map<String, String> row = mapOf(
                    "tradeId", safeString(baseRow.get("tradeId")),
                    "tradeTypeCode", inferTradeTypeCode(baseRow),
                    "productType", safeString(baseRow.get("productType")),
                    "sellerName", safeString(baseRow.get("sellerName")),
                    "buyerName", safeString(baseRow.get("buyerName")),
                    "contractName", safeString(baseRow.get("contractName")),
                    "quantity", safeString(baseRow.get("quantity")),
                    "amount", safeString(baseRow.get("amount")),
                    "requestedAt", safeString(baseRow.get("requestedAt")),
                    "settlementStatusCode", safeString(baseRow.get("settlementStatusCode")),
                    "settlementStatusLabel", safeString(baseRow.get("settlementStatusLabel")),
                    "approvalStatusCode", approvalStatusCode,
                    "approvalStatusLabel", approvalStatusLabel(approvalStatusCode, isEn),
                    "reviewedAt", safeString(state.get("reviewedAt")),
                    "reviewerName", safeString(state.get("reviewerName")),
                    "reviewNote", safeString(isEn ? state.get("reviewNoteEn") : state.get("reviewNoteKo")),
                    "rejectReason", safeString(state.get("rejectReason")));
            rows.add(row);
        }
        rows.sort(Comparator.comparing((Map<String, String> row) -> safeString(row.get("requestedAt"))).reversed());
        return rows;
    }

    private void ensureTradeApprovalState() {
        if (!tradeApprovalState.isEmpty()) {
            return;
        }
        tradeApprovalState.put("TRD-202603-001", tradeApprovalState("PENDING", "", "거래 운영팀", "초기 증빙 확인 완료. 상대 기관 응답 대기", "Initial evidence reviewed. Waiting for counterparty confirmation.", ""));
        tradeApprovalState.put("TRD-202603-002", tradeApprovalState("HOLD", "", "거래 운영팀", "정산 연계 상태 점검 필요", "Settlement integration status needs review.", ""));
        tradeApprovalState.put("TRD-202603-003", tradeApprovalState("APPROVED", "2026-03-30 17:20", "Trade Ops Desk", "검토 승인 후 정산 대기 전환", "Approved after review and moved to settlement pending.", ""));
        tradeApprovalState.put("TRD-202603-004", tradeApprovalState("APPROVED", "2026-03-29 18:10", "Trade Ops Desk", "완료 거래로 후속 모니터링만 유지", "Completed trade retained for monitoring only.", ""));
        tradeApprovalState.put("TRD-202603-005", tradeApprovalState("REJECTED", "2026-03-29 13:40", "거래 운영팀", "상대 기관 서명본 누락으로 반려", "Rejected due to missing signed counterpart evidence.", "상대 기관 서명본 누락"));
        tradeApprovalState.put("TRD-202603-006", tradeApprovalState("HOLD", "", "Trade Ops Desk", "매칭 엔진 경고 검토 중", "Matching engine warning under review.", ""));
        tradeApprovalState.put("TRD-202603-007", tradeApprovalState("PENDING", "", "거래 운영팀", "담당자 최종 검토 전", "Awaiting final operator review.", ""));
        tradeApprovalState.put("TRD-202603-008", tradeApprovalState("APPROVED", "2026-03-28 11:50", "Trade Ops Desk", "정산 완료 거래", "Settlement completed trade.", ""));
        tradeApprovalState.put("TRD-202603-009", tradeApprovalState("APPROVED", "2026-03-27 19:00", "거래 운영팀", "조림 상쇄 거래 승인 완료", "Afforestation offset trade approved.", ""));
        tradeApprovalState.put("TRD-202603-010", tradeApprovalState("APPROVED", "2026-03-27 10:10", "Trade Ops Desk", "컴플라이언스 보전 거래 승인", "Compliance fill trade approved.", ""));
        tradeApprovalState.put("TRD-202603-011", tradeApprovalState("PENDING", "", "거래 운영팀", "열공급 믹스 거래 검토 대기", "Heat network mix trade pending review.", ""));
        tradeApprovalState.put("TRD-202603-012", tradeApprovalState("HOLD", "", "Trade Ops Desk", "농업 상쇄 풀 증빙 재확인 필요", "Agriculture offset pool evidence needs recheck.", ""));
    }

    private Map<String, String> tradeApprovalState(
            String approvalStatusCode,
            String reviewedAt,
            String reviewerName,
            String reviewNoteKo,
            String reviewNoteEn,
            String rejectReason) {
        Map<String, String> state = defaultTradeApprovalState();
        state.put("approvalStatusCode", approvalStatusCode);
        state.put("reviewedAt", reviewedAt);
        state.put("reviewerName", reviewerName);
        state.put("reviewNoteKo", reviewNoteKo);
        state.put("reviewNoteEn", reviewNoteEn);
        state.put("reviewNote", reviewNoteKo);
        state.put("rejectReason", rejectReason);
        return state;
    }

    private Map<String, String> defaultTradeApprovalState() {
        return mapOf(
                "approvalStatusCode", "PENDING",
                "reviewedAt", "",
                "reviewerName", "",
                "reviewNoteKo", "",
                "reviewNoteEn", "",
                "reviewNote", "",
                "rejectReason", "");
    }

    private long countByApprovalStatus(List<Map<String, String>> rows, String approvalStatusCode) {
        return rows.stream()
                .filter(row -> approvalStatusCode.equalsIgnoreCase(safeString(row.get("approvalStatusCode"))))
                .count();
    }

    private List<String> normalizeSelectedIds(Object selectedIds, String singleId) {
        List<String> resolved = new ArrayList<>();
        if (selectedIds instanceof List<?>) {
            for (Object value : (List<?>) selectedIds) {
                String normalized = stringValue(value);
                if (!normalized.isEmpty()) {
                    resolved.add(normalized);
                }
            }
        }
        String normalizedSingleId = safeString(singleId);
        if (resolved.isEmpty() && !normalizedSingleId.isEmpty()) {
            resolved.add(normalizedSingleId);
        }
        return resolved;
    }

    private String approvalStatusLabel(String approvalStatusCode, boolean isEn) {
        switch (safeString(approvalStatusCode).toUpperCase(Locale.ROOT)) {
            case "APPROVED":
                return isEn ? "Approved" : "승인 완료";
            case "REJECTED":
                return isEn ? "Rejected" : "반려";
            case "HOLD":
                return isEn ? "On Hold" : "보류";
            default:
                return isEn ? "Pending" : "승인 대기";
        }
    }

    private String inferTradeTypeCode(Map<String, String> row) {
        String productType = safeString(row.get("productType")).toLowerCase(Locale.ROOT);
        if (productType.contains("rec")) {
            return "REC";
        }
        if (productType.contains("voluntary") || productType.contains("자발적")) {
            return "VOLUNTARY";
        }
        return "KETS";
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

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String buildAdminPath(boolean isEn, String path) {
        return (isEn ? "/en/admin" : "/admin") + path;
    }
}

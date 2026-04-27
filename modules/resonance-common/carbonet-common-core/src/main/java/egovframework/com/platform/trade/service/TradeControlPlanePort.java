package egovframework.com.platform.trade.service;

import java.util.Map;

public interface TradeControlPlanePort {

    Map<String, Object> buildTradeListPageData(
            String pageIndexParam,
            String searchKeyword,
            String tradeStatus,
            String settlementStatus,
            boolean isEn);

    Map<String, Object> buildTradeStatisticsPageData(
            String pageIndexParam,
            String searchKeyword,
            String periodFilter,
            String tradeType,
            String settlementStatus,
            boolean isEn);

    Map<String, Object> buildTradeDuplicatePageData(
            String pageIndexParam,
            String searchKeyword,
            String detectionType,
            String reviewStatus,
            String riskLevel,
            boolean isEn);

    Map<String, Object> buildSettlementCalendarPageData(
            String pageIndexParam,
            String selectedMonth,
            String searchKeyword,
            String settlementStatus,
            String riskLevel,
            boolean isEn);

    Map<String, Object> buildTradeRejectPageData(String tradeId, String returnUrl, boolean isEn);

    Map<String, Object> buildTradeApprovePageData(
            String pageIndexParam,
            String searchKeyword,
            String approvalStatus,
            String tradeType,
            boolean isEn);

    Map<String, Object> submitTradeApproveAction(Map<String, Object> payload, boolean isEn);

    Map<String, Object> submitTradeRejectAction(Map<String, Object> payload, boolean isEn);
}

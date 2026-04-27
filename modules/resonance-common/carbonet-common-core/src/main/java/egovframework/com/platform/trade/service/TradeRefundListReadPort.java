package egovframework.com.platform.trade.service;

import java.util.Map;

public interface TradeRefundListReadPort {

    Map<String, Object> buildRefundListPageData(
            String pageIndexParam,
            String searchKeyword,
            String status,
            String riskLevel,
            boolean isEn);
}

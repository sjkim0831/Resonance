package egovframework.com.feature.admin.web;

import egovframework.com.platform.trade.service.TradeRefundListReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminPaymentController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final TradeRefundListReadPort tradeRefundListReadPort;

    @RequestMapping(value = "/payment/refund_list", method = { RequestMethod.GET, RequestMethod.POST })
    public String refundListPage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "riskLevel", required = false) String riskLevel,
            HttpServletRequest request,
            Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "refund-list");
    }

    @GetMapping("/payment/refund_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> refundListPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "riskLevel", required = false) String riskLevel,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(new LinkedHashMap<>(tradeRefundListReadPort.buildRefundListPageData(
                pageIndexParam,
                searchKeyword,
                status,
                riskLevel,
                adminReactRouteSupport.isEnglishRequest(request, locale))));
    }
}

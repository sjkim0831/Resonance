package egovframework.com.feature.home.web;

import egovframework.com.platform.menu.service.AdminMenuTreeService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.feature.admin.web.AdminApprovalController;
import egovframework.com.platform.codex.service.AdminHotPathPagePayloadService;
import egovframework.com.feature.auth.dto.response.FrontendSessionResponseDTO;
import egovframework.com.feature.auth.service.FrontendSessionService;
import egovframework.com.feature.home.service.HomeMenuService;
import egovframework.com.feature.home.service.HomeMypageService;
import egovframework.com.platform.trade.service.TradeRefundListReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReactAppBootstrapService {

    private final FrontendSessionService frontendSessionService;
    private final HomeMenuService homeMenuService;
    private final HomeMypageService homeMypageService;
    private final AdminMenuTreeService adminMenuTreeService;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final AdminHotPathPagePayloadService adminHotPathPagePayloadService;
    private final AdminApprovalController adminApprovalController;
    private final TradeRefundListReadPort tradeRefundListReadPort;

    public Map<String, Object> buildBootstrapPayload(String route, boolean en, boolean admin, HttpServletRequest request) {
        Map<String, Object> payload = createBootstrapPayload();
        FrontendSessionResponseDTO frontendSession = frontendSessionService.buildSession(request);
        putPayload(payload, "frontendSession", frontendSession);

        String normalizedRoute = ReactRouteSupport.normalizeBootstrapRoute(route);
        if (!admin && "home".equals(normalizedRoute)) {
            payload.put("homePayload", createHomeBootstrapPayload(en, frontendSession));
        }
        if (!admin && "mypage".equals(normalizedRoute)) {
            appendHomeMypageBootstrapPayload(payload, en, request);
        }
        if (admin) {
            appendAdminBootstrapPayload(payload, normalizedRoute, en, request, frontendSession);
        }
        return payload;
    }

    private Map<String, Object> createBootstrapPayload() {
        return new LinkedHashMap<>();
    }

    private Map<String, Object> createHomeBootstrapPayload(boolean en, FrontendSessionResponseDTO frontendSession) {
        Map<String, Object> homePayload = createBootstrapPayload();
        putPayload(homePayload, "isLoggedIn", frontendSession.isAuthenticated());
        putPayload(homePayload, "isEn", en);
        putPayload(homePayload, "homeMenu", homeMenuService.getHomeMenu(en));
        return homePayload;
    }

    private void appendHomeMypageBootstrapPayload(Map<String, Object> payload, boolean en, HttpServletRequest request) {
        payload.put("mypagePayload", homeMypageService.buildMypagePayload(en, request));
        payload.put("mypageContext", homeMypageService.buildMypageContext(en, request));
    }

    private void putPayload(Map<String, Object> payload, String key, Object value) {
        payload.put(key, value);
    }

    private void appendAdminBootstrapPayload(Map<String, Object> payload,
                                             String normalizedRoute,
                                             boolean en,
                                             HttpServletRequest request,
                                             FrontendSessionResponseDTO frontendSession) {
        Locale locale = requestLocale(en);
        if (!"admin_login".equals(normalizedRoute) && frontendSession.isAuthenticated()) {
            putPayload(payload, "adminMenuTree", adminMenuTreeService.buildAdminMenuTree(en, request));
        }
        if (appendAdminHotPathPayload(payload, normalizedRoute, request, locale)) {
            return;
        }
        if (appendAdminTradePayload(payload, normalizedRoute, request, en)) {
            return;
        }
        if (appendAdminAuditPayload(payload, normalizedRoute, request, en)) {
            return;
        }
        if (appendAdminEmissionPayload(payload, normalizedRoute, request, en)) {
            return;
        }
        if (appendAdminCertificatePayload(payload, normalizedRoute, request, en, locale)) {
            return;
        }
        if (appendAdminOperationsPayload(payload, normalizedRoute, request, en)) {
            return;
        }
        switch (normalizedRoute) {
            case "admin_home":
                putPayload(payload, "adminHomePageData", adminShellBootstrapPageService.buildAdminHomePageData(en));
                break;
            case "member_stats":
                putPayload(payload, "memberStatsPageData", adminShellBootstrapPageService.buildMemberStatsPageData(en));
                break;
            case "security_policy":
                putPayload(payload, "securityPolicyPageData", adminShellBootstrapPageService.buildSecurityPolicyPageData(en));
                break;
            case "external_monitoring":
                putPayload(payload, "externalMonitoringPageData", adminShellBootstrapPageService.buildExternalMonitoringPageData(en));
                break;
            case "security_monitoring":
                putPayload(payload, "securityMonitoringPageData", adminShellBootstrapPageService.buildSecurityMonitoringPageData(en));
                break;
            default:
                break;
        }
    }

    private boolean appendAdminHotPathPayload(Map<String, Object> payload,
                                              String normalizedRoute,
                                              HttpServletRequest request,
                                              Locale locale) {
        if (request == null) {
            return false;
        }
        switch (normalizedRoute) {
            case "auth_group":
                putPayload(payload, "authGroupPageData", adminHotPathPagePayloadService.buildAuthGroupPagePayload(
                        param(request, "authorCode"),
                        param(request, "roleCategory"),
                        param(request, "insttId"),
                        param(request, "menuCode"),
                        param(request, "featureCode"),
                        param(request, "userSearchKeyword"),
                        request,
                        locale));
                return true;
            case "dept_role":
                putPayload(payload, "deptRolePageData", adminHotPathPagePayloadService.buildDeptRolePagePayload(
                        param(request, "updated"),
                        param(request, "insttId"),
                        param(request, "memberSearchKeyword"),
                        integerParam(request, "memberPageIndex"),
                        param(request, "error"),
                        request,
                        locale));
                return true;
            case "auth_change":
                putPayload(payload, "authChangePageData", adminHotPathPagePayloadService.buildAuthChangePagePayload(
                        param(request, "updated"),
                        param(request, "targetUserId"),
                        param(request, "searchKeyword"),
                        integerParam(request, "pageIndex"),
                        param(request, "error"),
                        request,
                        locale));
                return true;
            case "member_edit":
                putPayload(payload, "memberEditPageData", adminHotPathPagePayloadService.buildMemberEditPagePayload(
                        param(request, "memberId"),
                        param(request, "updated"),
                        request,
                        locale));
                return true;
            default:
                return false;
        }
    }

    private boolean appendAdminTradePayload(Map<String, Object> payload,
                                            String normalizedRoute,
                                            HttpServletRequest request,
                                            boolean en) {
        switch (normalizedRoute) {
            case "trade_list":
                putPayload(payload, "tradeListPageData", adminShellBootstrapPageService.buildTradeListPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "tradeStatus"),
                        param(request, "settlementStatus"),
                        en));
                return true;
            case "trade_statistics":
                putPayload(payload, "tradeStatisticsPageData", adminShellBootstrapPageService.buildTradeStatisticsPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "periodFilter"),
                        param(request, "tradeType"),
                        param(request, "settlementStatus"),
                        en));
                return true;
            case "trade_duplicate":
                putPayload(payload, "tradeDuplicatePageData", adminShellBootstrapPageService.buildTradeDuplicatePageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "detectionType"),
                        param(request, "reviewStatus"),
                        param(request, "riskLevel"),
                        en));
                return true;
            case "trade_approve":
                putPayload(payload, "tradeApprovePageData", adminShellBootstrapPageService.buildTradeApprovePageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "approvalStatus"),
                        param(request, "tradeType"),
                        en));
                return true;
            case "settlement_calendar":
                putPayload(payload, "settlementCalendarPageData", adminShellBootstrapPageService.buildSettlementCalendarPageData(
                        param(request, "pageIndex"),
                        param(request, "selectedMonth"),
                        param(request, "searchKeyword"),
                        param(request, "settlementStatus"),
                        param(request, "riskLevel"),
                        en));
                return true;
            case "refund_list":
                putPayload(payload, "refundListPageData", tradeRefundListReadPort.buildRefundListPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "status"),
                        param(request, "riskLevel"),
                        en));
                return true;
            case "trade_reject":
                putPayload(payload, "tradeRejectPageData", adminShellBootstrapPageService.buildTradeRejectPageData(
                        param(request, "tradeId"),
                        param(request, "returnUrl"),
                        en));
                return true;
            default:
                return false;
        }
    }

    private boolean appendAdminAuditPayload(Map<String, Object> payload,
                                            String normalizedRoute,
                                            HttpServletRequest request,
                                            boolean en) {
        switch (normalizedRoute) {
            case "security_audit":
                putPayload(payload, "securityAuditPageData", adminShellBootstrapPageService.buildSecurityAuditPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "actionType"),
                        param(request, "routeGroup"),
                        param(request, "startDate"),
                        param(request, "endDate"),
                        param(request, "sortKey"),
                        param(request, "sortDirection"),
                        en));
                return true;
            case "certificate_audit_log":
                putPayload(payload, "certificateAuditLogPageData", adminShellBootstrapPageService.buildCertificateAuditLogPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "auditType"),
                        param(request, "status"),
                        param(request, "certificateType"),
                        param(request, "startDate"),
                        param(request, "endDate"),
                        en));
                return true;
            default:
                return false;
        }
    }

    private boolean appendAdminEmissionPayload(Map<String, Object> payload,
                                               String normalizedRoute,
                                               HttpServletRequest request,
                                               boolean en) {
        switch (normalizedRoute) {
            case "emission_result_list":
                putPayload(payload, "emissionResultListPageData", adminShellBootstrapPageService.buildEmissionResultListPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "resultStatus"),
                        param(request, "verificationStatus"),
                        en));
                return true;
            case "emission_result_detail":
                putPayload(payload, "emissionResultDetailPageData", adminShellBootstrapPageService.buildEmissionResultDetailPageData(
                        param(request, "resultId"),
                        en));
                return true;
            case "emission_data_history":
                putPayload(payload, "emissionDataHistoryPageData", adminShellBootstrapPageService.buildEmissionDataHistoryPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "changeType"),
                        param(request, "changeTarget"),
                        en));
                return true;
            case "emission_validate":
                putPayload(payload, "emissionValidatePageData", adminShellBootstrapPageService.buildEmissionValidatePageData(
                        param(request, "pageIndex"),
                        param(request, "resultId"),
                        param(request, "searchKeyword"),
                        param(request, "verificationStatus"),
                        param(request, "priorityFilter"),
                        en));
                return true;
            case "emission_site_management":
                putPayload(payload, "emissionSiteManagementPageData", adminShellBootstrapPageService.buildEmissionSiteManagementPageData(en));
                return true;
            default:
                return false;
        }
    }

    private boolean appendAdminCertificatePayload(Map<String, Object> payload,
                                                  String normalizedRoute,
                                                  HttpServletRequest request,
                                                  boolean en,
                                                  Locale locale) {
        switch (normalizedRoute) {
            case "certificate_statistics":
                putPayload(payload, "certificateStatisticsPageData", adminShellBootstrapPageService.buildCertificateStatisticsPageData(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "periodFilter"),
                        param(request, "certificateType"),
                        param(request, "issuanceStatus"),
                        en));
                return true;
            case "certificate_review":
                putPayload(payload, "certificateReviewPageData", adminApprovalController.buildCertificateReviewPagePayload(
                        param(request, "pageIndex"),
                        param(request, "searchKeyword"),
                        param(request, "status"),
                        param(request, "certificateType"),
                        param(request, "applicationId"),
                        request,
                        locale));
                return true;
            case "certificate_rec_check":
                putPayload(payload, "certificateRecCheckPageData", adminShellBootstrapPageService.buildCertificateRecCheckPageData(en));
                return true;
            default:
                return false;
        }
    }

    private boolean appendAdminOperationsPayload(Map<String, Object> payload,
                                                 String normalizedRoute,
                                                 HttpServletRequest request,
                                                 boolean en) {
        switch (normalizedRoute) {
            case "scheduler_management":
                putPayload(payload, "schedulerManagementPageData", adminShellBootstrapPageService.buildSchedulerPageData(
                        param(request, "jobStatus"),
                        param(request, "executionType"),
                        en));
                return true;
            case "backup_config":
            case "backup_execution":
            case "restore_execution":
            case "version_management":
                putPayload(payload, "backupConfigPageData", adminShellBootstrapPageService.buildBackupConfigPageData(en));
                return true;
            case "new_page":
                putPayload(payload, "newPagePageData", adminShellBootstrapPageService.buildNewPagePageData(en));
                return true;
            default:
                return false;
        }
    }

    private String param(HttpServletRequest request, String name) {
        if (request == null || name == null || name.trim().isEmpty()) {
            return "";
        }
        String value = request.getParameter(name);
        return value == null ? "" : value;
    }

    private Integer integerParam(HttpServletRequest request, String name) {
        String rawValue = param(request, name).trim();
        if (rawValue.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(rawValue);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Locale requestLocale(boolean en) {
        return en ? Locale.ENGLISH : Locale.KOREAN;
    }
}

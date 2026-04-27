package egovframework.com.common.util;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ReactPageUrlMapper {

    private static final Map<String, String> ADMIN_PATH_TO_ROUTE;
    private static final Map<String, String> ADMIN_ROUTE_TO_PATH;
    private static final Map<String, String> HOME_PATH_TO_ROUTE;
    private static final Map<String, String> HOME_ROUTE_TO_PATH;
    private static final Map<String, String> HOME_LOCALIZED_PATHS;

    static {
        Map<String, String> adminPathToRoute = new LinkedHashMap<>();
        Map<String, String> adminRouteToPath = new LinkedHashMap<>();
        Map<String, String> homePathToRoute = new LinkedHashMap<>();
        Map<String, String> homeRouteToPath = new LinkedHashMap<>();
        Map<String, String> homeLocalizedPaths = new LinkedHashMap<>();

        registerAdmin(adminPathToRoute, adminRouteToPath, "admin-home", "/admin/", "/admin", "/admin/");
        registerAdmin(adminPathToRoute, adminRouteToPath, "admin-login", "/admin/login/loginView", "/admin/login/loginView");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-approve", "/admin/member/approve", "/admin/member/approve");
        registerAdmin(adminPathToRoute, adminRouteToPath, "company-approve", "/admin/member/company-approve", "/admin/member/company-approve");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-pending", "/admin/certificate/pending_list", "/admin/certificate/pending_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "virtual-issue", "/admin/payment/virtual_issue", "/admin/payment/virtual_issue");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-edit", "/admin/member/edit", "/admin/member/edit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-detail", "/admin/member/detail", "/admin/member/detail");
        registerAdmin(adminPathToRoute, adminRouteToPath, "password-reset", "/admin/member/reset_password", "/admin/member/reset_password");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-list", "/admin/member/list", "/admin/member/list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-withdrawn", "/admin/member/withdrawn", "/admin/member/withdrawn");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-activate", "/admin/member/activate", "/admin/member/activate");
        registerAdmin(adminPathToRoute, adminRouteToPath, "admin-list", "/admin/member/admin_list", "/admin/member/admin_list", "/admin/member/admin-list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "company-list", "/admin/member/company_list", "/admin/member/company_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "company-detail", "/admin/member/company_detail", "/admin/member/company_detail");
        registerAdmin(adminPathToRoute, adminRouteToPath, "company-account", "/admin/member/company_account", "/admin/member/company_account");
        registerAdmin(adminPathToRoute, adminRouteToPath, "admin-create", "/admin/member/admin_account", "/admin/member/admin_account");
        registerAdmin(adminPathToRoute, adminRouteToPath, "admin-permission", "/admin/member/admin_account/permissions", "/admin/member/admin_account/permissions");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-stats", "/admin/member/stats", "/admin/member/stats");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-register", "/admin/member/register", "/admin/member/register");
        registerAdmin(adminPathToRoute, adminRouteToPath, "trade-list", "/admin/trade/list", "/admin/trade/list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "trade-duplicate", "/admin/trade/duplicate", "/admin/trade/duplicate");
        registerAdmin(adminPathToRoute, adminRouteToPath, "trade-approve", "/admin/trade/approve", "/admin/trade/approve");
        registerAdmin(adminPathToRoute, adminRouteToPath, "settlement-calendar", "/admin/payment/settlement", "/admin/payment/settlement");
        registerAdmin(adminPathToRoute, adminRouteToPath, "refund-list", "/admin/payment/refund_list", "/admin/payment/refund_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "refund-process", "/admin/payment/refund_process", "/admin/payment/refund_process");
        registerAdmin(adminPathToRoute, adminRouteToPath, "trade-reject", "/admin/trade/reject", "/admin/trade/reject");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-review", "/admin/certificate/review", "/admin/certificate/review");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-statistics", "/admin/certificate/statistics", "/admin/certificate/statistics");
        registerAdmin(adminPathToRoute, adminRouteToPath, "auth-group", "/admin/auth/group", "/admin/auth/group", "/admin/member/auth-group", "/admin/system/role");
        registerAdmin(adminPathToRoute, adminRouteToPath, "auth-change", "/admin/member/auth-change", "/admin/member/auth-change", "/admin/system/auth-change");
        registerAdmin(adminPathToRoute, adminRouteToPath, "dept-role", "/admin/member/dept-role-mapping", "/admin/member/dept-role-mapping", "/admin/system/dept-role-mapping");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-result-list", "/admin/emission/result_list", "/admin/emission/result_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-result-detail", "/admin/emission/result_detail", "/admin/emission/result_detail");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-validate", "/admin/emission/validate", "/admin/emission/validate");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-definition-studio", "/admin/emission/definition-studio", "/admin/emission/definition-studio");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-gwp-values", "/admin/emission/gwp-values", "/admin/emission/gwp-values");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-lci-classification", "/admin/emission/lci-classification", "/admin/emission/lci-classification");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-survey-admin", "/admin/emission/survey-admin", "/admin/emission/survey-admin");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-survey-admin-data", "/admin/emission/survey-admin-data", "/admin/emission/survey-admin-data");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-data-history", "/admin/emission/data_history", "/admin/emission/data_history");
        registerAdmin(adminPathToRoute, adminRouteToPath, "emission-site-management", "/admin/emission/site-management", "/admin/emission/site-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-rec-check", "/admin/certificate/rec_check", "/admin/certificate/rec_check");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-objection-list", "/admin/certificate/objection_list", "/admin/certificate/objection_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "certificate-audit-log", "/admin/certificate/audit-log", "/admin/certificate/audit-log");
        registerAdmin(adminPathToRoute, adminRouteToPath, "system-code", "/admin/system/code", "/admin/system/code");
        registerAdmin(adminPathToRoute, adminRouteToPath, "page-management", "/admin/system/page-management", "/admin/system/page-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "function-management", "/admin/system/feature-management", "/admin/system/feature-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "menu-management", "/admin/system/menu", "/admin/system/menu", "/admin/system/menu-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "screen-builder", "/admin/system/screen-builder", "/admin/system/screen-builder");
        registerAdmin(adminPathToRoute, adminRouteToPath, "screen-runtime", "/admin/system/screen-runtime", "/admin/system/screen-runtime");
        registerAdmin(adminPathToRoute, adminRouteToPath, "current-runtime-compare", "/admin/system/current-runtime-compare", "/admin/system/current-runtime-compare");
        registerAdmin(adminPathToRoute, adminRouteToPath, "repair-workbench", "/admin/system/repair-workbench", "/admin/system/repair-workbench");
        registerAdmin(adminPathToRoute, adminRouteToPath, "faq-menu-management", "/admin/content/menu", "/admin/content/menu");
        registerAdmin(adminPathToRoute, adminRouteToPath, "ip-whitelist", "/admin/system/ip_whitelist", "/admin/system/ip_whitelist");
        registerAdmin(adminPathToRoute, adminRouteToPath, "access-history", "/admin/system/access_history", "/admin/system/access_history");
        registerAdmin(adminPathToRoute, adminRouteToPath, "unified-log",
                "/admin/system/unified_log",
                "/admin/system/unified_log",
                "/admin/system/unified_log/trace",
                "/admin/system/unified_log/page-events",
                "/admin/system/unified_log/ui-actions",
                "/admin/system/unified_log/api-trace",
                "/admin/system/unified_log/ui-errors",
                "/admin/system/unified_log/layout-render");
        registerAdmin(adminPathToRoute, adminRouteToPath, "login-history", "/admin/member/login_history", "/admin/member/login_history");
        registerAdmin(adminPathToRoute, adminRouteToPath, "member-security-history", "/admin/member/security", "/admin/member/security");
        registerAdmin(adminPathToRoute, adminRouteToPath, "security-history", "/admin/system/security", "/admin/system/security");
        registerAdmin(adminPathToRoute, adminRouteToPath, "security-policy", "/admin/system/security-policy", "/admin/system/security-policy");
        registerAdmin(adminPathToRoute, adminRouteToPath, "security-monitoring", "/admin/system/security-monitoring", "/admin/system/security-monitoring");
        registerAdmin(adminPathToRoute, adminRouteToPath, "blocklist", "/admin/system/blocklist", "/admin/system/blocklist");
        registerAdmin(adminPathToRoute, adminRouteToPath, "security-audit", "/admin/system/security-audit", "/admin/system/security-audit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "sensor-add", "/admin/monitoring/sensor_add", "/admin/monitoring/sensor_add");
        registerAdmin(adminPathToRoute, adminRouteToPath, "sensor-edit", "/admin/monitoring/sensor_edit", "/admin/monitoring/sensor_edit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "sensor-list", "/admin/monitoring/sensor_list", "/admin/monitoring/sensor_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-connection-list", "/admin/external/connection_list", "/admin/external/connection_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-schema", "/admin/external/schema", "/admin/external/schema");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-keys", "/admin/external/keys", "/admin/external/keys");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-usage", "/admin/external/usage", "/admin/external/usage");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-logs", "/admin/external/logs", "/admin/external/logs");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-webhooks", "/admin/external/webhooks", "/admin/external/webhooks");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-sync", "/admin/external/sync", "/admin/external/sync");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-maintenance", "/admin/external/maintenance", "/admin/external/maintenance");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-retry", "/admin/external/retry", "/admin/external/retry");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-connection-add", "/admin/external/connection_add", "/admin/external/connection_add");
        registerAdmin(adminPathToRoute, adminRouteToPath, "external-connection-edit", "/admin/external/connection_edit", "/admin/external/connection_edit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "batch-management", "/admin/system/batch", "/admin/system/batch");
        registerAdmin(adminPathToRoute, adminRouteToPath, "scheduler-management", "/admin/system/scheduler", "/admin/system/scheduler");
        registerAdmin(adminPathToRoute, adminRouteToPath, "db-promotion-policy", "/admin/system/db-promotion-policy", "/admin/system/db-promotion-policy");
        registerAdmin(adminPathToRoute, adminRouteToPath, "db-sync-deploy", "/admin/system/db-sync-deploy", "/admin/system/db-sync-deploy");
        registerAdmin(adminPathToRoute, adminRouteToPath, "backup-config", "/admin/system/backup", "/admin/system/backup");
        registerAdmin(adminPathToRoute, adminRouteToPath, "backup-execution", "/admin/system/backup", "/admin/system/backup");
        registerAdmin(adminPathToRoute, adminRouteToPath, "restore-execution", "/admin/system/backup", "/admin/system/backup");
        registerAdmin(adminPathToRoute, adminRouteToPath, "package-governance", "/admin/system/package-governance", "/admin/system/package-governance");

        registerAdmin(adminPathToRoute, adminRouteToPath, "version-management", "/admin/system/version", "/admin/system/version");
        registerAdmin(adminPathToRoute, adminRouteToPath, "codex-request", "/admin/system/codex-request", "/admin/system/codex-request");
        registerAdmin(adminPathToRoute, adminRouteToPath, "observability", "/admin/system/observability", "/admin/system/observability");
        registerAdmin(adminPathToRoute, adminRouteToPath, "help-management", "/admin/system/help-management", "/admin/system/help-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "full-stack-management", "/admin/system/full-stack-management", "/admin/system/full-stack-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "infra", "/admin/system/infra", "/admin/system/infra");
        registerAdmin(adminPathToRoute, adminRouteToPath, "platform-studio", "/admin/system/platform-studio", "/admin/system/platform-studio");
        registerAdmin(adminPathToRoute, adminRouteToPath, "screen-elements-management", "/admin/system/screen-elements-management", "/admin/system/screen-elements-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "event-management-console", "/admin/system/event-management-console", "/admin/system/event-management-console");
        registerAdmin(adminPathToRoute, adminRouteToPath, "function-management-console", "/admin/system/function-management-console", "/admin/system/function-management-console");
        registerAdmin(adminPathToRoute, adminRouteToPath, "api-management-console", "/admin/system/api-management-console", "/admin/system/api-management-console");
        registerAdmin(adminPathToRoute, adminRouteToPath, "controller-management-console", "/admin/system/controller-management-console", "/admin/system/controller-management-console");
        registerAdmin(adminPathToRoute, adminRouteToPath, "db-table-management", "/admin/system/db-table-management", "/admin/system/db-table-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "column-management-console", "/admin/system/column-management-console", "/admin/system/column-management-console");
        registerAdmin(adminPathToRoute, adminRouteToPath, "automation-studio", "/admin/system/automation-studio", "/admin/system/automation-studio");
        registerAdmin(adminPathToRoute, adminRouteToPath, "environment-management", "/admin/system/environment-management", "/admin/system/environment-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "asset-inventory", "/admin/system/asset-inventory", "/admin/system/asset-inventory");
        registerAdmin(adminPathToRoute, adminRouteToPath, "asset-detail", "/admin/system/asset-detail", "/admin/system/asset-detail");
        registerAdmin(adminPathToRoute, adminRouteToPath, "asset-impact", "/admin/system/asset-impact", "/admin/system/asset-impact");
        registerAdmin(adminPathToRoute, adminRouteToPath, "asset-lifecycle", "/admin/system/asset-lifecycle", "/admin/system/asset-lifecycle");
        registerAdmin(adminPathToRoute, adminRouteToPath, "asset-gap", "/admin/system/asset-gap", "/admin/system/asset-gap");
        registerAdmin(adminPathToRoute, adminRouteToPath, "verification-center", "/admin/system/verification-center", "/admin/system/verification-center");
        registerAdmin(adminPathToRoute, adminRouteToPath, "verification-assets", "/admin/system/verification-assets", "/admin/system/verification-assets");
        registerAdmin(adminPathToRoute, adminRouteToPath, "screen-flow-management", "/admin/system/screen-flow-management", "/admin/system/screen-flow-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "screen-menu-assignment-management", "/admin/system/screen-menu-assignment-management", "/admin/system/screen-menu-assignment-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "wbs-management", "/admin/system/wbs-management", "/admin/system/wbs-management");
        registerAdmin(adminPathToRoute, adminRouteToPath, "new-page", "/admin/system/new-page", "/admin/system/new-page");
        registerAdmin(adminPathToRoute, adminRouteToPath, "sr-workbench", "/admin/system/sr-workbench", "/admin/system/sr-workbench");
        registerAdmin(adminPathToRoute, adminRouteToPath, "board-list", "/admin/content/board_list", "/admin/content/board_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "board-add", "/admin/content/board_add", "/admin/content/board_add");
        registerAdmin(adminPathToRoute, adminRouteToPath, "post-list", "/admin/content/post_list", "/admin/content/post_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "popup-list", "/admin/content/popup_list", "/admin/content/popup_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "popup-edit", "/admin/content/popup_edit", "/admin/content/popup_edit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "qna-category", "/admin/content/qna", "/admin/content/qna");
        registerAdmin(adminPathToRoute, adminRouteToPath, "faq-management", "/admin/content/faq_list", "/admin/content/faq_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "banner-list", "/admin/content/banner_list", "/admin/content/banner_list");
        registerAdmin(adminPathToRoute, adminRouteToPath, "banner-edit", "/admin/content/banner_edit", "/admin/content/banner_edit");
        registerAdmin(adminPathToRoute, adminRouteToPath, "tag-management", "/admin/content/tag", "/admin/content/tag");
        registerAdmin(adminPathToRoute, adminRouteToPath, "error-log", "/admin/system/error-log", "/admin/system/error-log");

        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "home", "/home", "/en/home", "/home");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage", "/mypage/profile", "/en/mypage/profile", "/mypage", "/mypage/profile");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_notification", "/mypage/notification", "/en/mypage/notification", "/mypage/notification");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_marketing", "/mypage/marketing", "/en/mypage/marketing", "/mypage/marketing");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_company", "/mypage/company", "/en/mypage/company", "/mypage/company");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_password", "/mypage/password", "/en/mypage/password", "/mypage/password");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_login", "/signin/loginView", "/en/signin/loginView", "/signin/loginView");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_auth_choice", "/signin/authChoice", "/en/signin/authChoice", "/signin/authChoice");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_find_id", "/signin/findId", "/en/signin/findId", "/signin/findId", "/signin/findId/overseas");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_find_id_result", "/signin/findId/result", "/en/signin/findId/result", "/signin/findId/result");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_find_password", "/signin/findPassword", "/en/signin/findPassword", "/signin/findPassword", "/signin/findPassword/overseas");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_find_password_result", "/signin/findPassword/result", "/en/signin/findPassword/result", "/signin/findPassword/result");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "signin_forbidden", "/signin/loginForbidden", "/en/signin/loginForbidden", "/signin/loginForbidden");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_wizard", "/join/step1", "/join/en/step1", "/join/step1", "/join/overseas/step1");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_terms", "/join/step2", "/join/en/step2", "/join/step2");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_auth", "/join/step3", "/join/en/step3", "/join/step3");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_info", "/join/step4", "/join/en/step4", "/join/step4");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_complete", "/join/step5", "/join/en/step5", "/join/step5");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_company_register", "/join/companyRegister", "/join/en/companyRegister", "/join/companyRegister");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_company_register_complete", "/join/companyRegisterComplete", "/join/en/companyRegisterComplete", "/join/companyRegisterComplete");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_company_status", "/join/companyJoinStatusSearch", "/join/en/companyJoinStatusSearch", "/join/companyJoinStatusSearch", "/join/companyJoinStatusDetail");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_company_status_guide", "/join/companyJoinStatusGuide", "/join/en/companyJoinStatusGuide", "/join/companyJoinStatusGuide");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "join_company_reapply", "/join/companyReapply", "/join/en/companyReapply", "/join/companyReapply");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "support_faq", "/support/faq", "/en/support/faq", "/support/faq");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_project_list", "/emission/project_list", "/en/emission/project_list", "/emission/project_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_lci", "/emission/lci", "/en/emission/lci", "/emission/lci");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_simulate", "/emission/simulate", "/en/emission/simulate", "/emission/simulate");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_reduction_trend", "/monitoring/reduction_trend", "/en/monitoring/reduction_trend", "/monitoring/reduction_trend");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_statistics", "/monitoring/statistics", "/en/monitoring/statistics", "/monitoring/statistics", "/monitoring/esg");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_share", "/monitoring/share", "/en/monitoring/share", "/monitoring/share");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "co2_production_list", "/co2/production_list", "/en/co2/production_list", "/co2/production_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_dashboard", "/monitoring/dashboard", "/en/monitoring/dashboard", "/monitoring/dashboard");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_realtime", "/monitoring/realtime", "/en/monitoring/realtime", "/monitoring/realtime");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_alerts", "/monitoring/alerts", "/en/monitoring/alerts", "/monitoring/alerts");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_track", "/monitoring/track", "/en/monitoring/track", "/monitoring/track");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "monitoring_export", "/monitoring/export", "/en/monitoring/export", "/monitoring/export");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "co2_integrity", "/co2/integrity", "/en/co2/integrity", "/co2/integrity");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "co2_credit", "/co2/credits", "/en/co2/credits", "/co2/credit", "/co2/credits");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "co2_analysis", "/co2/analysis", "/en/co2/analysis", "/co2/analysis");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "co2_search", "/co2/search", "/en/co2/search", "/co2/search", "/trade/matching");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_buy_request", "/trade/buy_request", "/en/trade/buy_request", "/trade/buy_request");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_complete", "/trade/complete", "/en/trade/complete", "/trade/complete");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_auto_order", "/trade/auto_order", "/en/trade/auto_order", "/trade/auto_order");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_list", "/trade/list", "/en/trade/list", "/trade/list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_market", "/trade/market", "/en/trade/market", "/trade/market");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_report", "/trade/report", "/en/trade/report", "/trade/report");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_sell", "/trade/sell", "/en/trade/sell", "/trade/sell");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "trade_price_alert", "/trade/price_alert", "/en/trade/price_alert", "/trade/price_alert");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_pay", "/payment/pay", "/en/payment/pay", "/payment/pay");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_refund", "/payment/refund", "/en/payment/refund", "/payment/refund");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_refund_account", "/payment/refund_account", "/en/payment/refund_account", "/payment/refund_account", "/payment/refundAccount");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_notify", "/payment/notify", "/en/payment/notify", "/payment/notify");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_home_validate", "/emission/validate", "/en/emission/validate", "/emission/validate");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "certificate_list", "/certificate/list", "/en/certificate/list", "/certificate/list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "certificate_apply", "/certificate/apply", "/en/certificate/apply", "/certificate/apply");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "certificate_report_list", "/certificate/report_list", "/en/certificate/report_list", "/certificate/report_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "certificate_report_form", "/certificate/report_form", "/en/certificate/report_form", "/certificate/report_form");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "certificate_report_edit", "/certificate/report_edit", "/en/certificate/report_edit", "/certificate/report_edit");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_history", "/payment/history", "/en/payment/history", "/payment/history");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_course_list", "/edu/course_list", "/en/edu/course_list", "/edu/course_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_my_course", "/edu/my_course", "/en/edu/my_course", "/edu/my_course");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_progress", "/edu/progress", "/en/edu/progress", "/edu/progress");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_content", "/edu/content", "/en/edu/content", "/edu/content");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_course_detail", "/edu/course_detail", "/en/edu/course_detail", "/edu/course_detail");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_apply", "/edu/apply", "/en/edu/apply", "/edu/apply");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_survey", "/edu/survey", "/en/edu/survey", "/edu/survey");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "edu_certificate", "/edu/certificate", "/en/edu/certificate", "/edu/certificate");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "payment_receipt", "/payment/receipt", "/en/payment/receipt", "/payment/receipt");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "my_inquiry", "/mtn/my_inquiry", "/en/mtn/my_inquiry", "/mtn/my_inquiry");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mtn_status", "/mtn/status", "/en/mtn/status", "/mtn/status");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "support_inquiry", "/support/inquiry", "/en/support/inquiry", "/support/inquiry");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_email", "/mypage/email", "/en/mypage/email", "/mypage/email");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "mypage_staff", "/mypage/staff", "/en/mypage/staff", "/mypage/staff");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "download_list", "/support/download_list", "/en/support/download_list", "/support/download_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "notice_list", "/support/notice_list", "/en/support/notice_list", "/support/notice_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "qna_list", "/support/qna_list", "/en/support/qna_list", "/support/qna_list");

        ADMIN_PATH_TO_ROUTE = Collections.unmodifiableMap(adminPathToRoute);
        ADMIN_ROUTE_TO_PATH = Collections.unmodifiableMap(adminRouteToPath);
        HOME_PATH_TO_ROUTE = Collections.unmodifiableMap(homePathToRoute);
        HOME_ROUTE_TO_PATH = Collections.unmodifiableMap(homeRouteToPath);
        HOME_LOCALIZED_PATHS = Collections.unmodifiableMap(homeLocalizedPaths);
    }

    private ReactPageUrlMapper() {
    }

    public static String toRuntimeUrl(String menuUrl, boolean english) {
        String normalized = normalize(menuUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        if (normalized.startsWith("http://") || normalized.startsWith("https://") || "#".equals(normalized)) {
            return "";
        }

        String querySuffix = "";
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            querySuffix = normalized.substring(queryIndex + 1).trim();
            normalized = normalized.substring(0, queryIndex);
        }
        String path = stripEnglishPrefix(normalized);

        String route = ADMIN_PATH_TO_ROUTE.get(path);
        if (route != null) {
            String localizedPath = english ? localizeAdminPath(ADMIN_ROUTE_TO_PATH.get(route)) : ADMIN_ROUTE_TO_PATH.get(route);
            if (localizedPath.isEmpty()) {
                return "";
            }
            return querySuffix.isEmpty() ? localizedPath : localizedPath + "?" + querySuffix;
        }

        route = resolveHomeRoute(path);
        if (!route.isEmpty()) {
            String localizedPath = english ? localizeHomePath(HOME_ROUTE_TO_PATH.get(route)) : HOME_ROUTE_TO_PATH.get(route);
            if (localizedPath == null || localizedPath.isEmpty()) {
                return "";
            }
            return querySuffix.isEmpty() ? localizedPath : localizedPath + "?" + querySuffix;
        }

        return "";
    }

    public static String toCanonicalMenuUrl(String requestUrl) {
        String normalized = normalize(requestUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        String path = stripEnglishPrefix(normalized);
        if (path.startsWith("/admin/app")) {
            String mapped = ADMIN_ROUTE_TO_PATH.get(extractRoute(path));
            String querySuffix = extractNonRouteQuerySuffix(path);
            if (mapped == null || mapped.isEmpty()) {
                return stripQuery(path);
            }
            return querySuffix.isEmpty() ? mapped : mapped + "?" + querySuffix;
        }
        if (path.startsWith("/app")) {
            String mapped = HOME_ROUTE_TO_PATH.get(extractRoute(path));
            String querySuffix = extractNonRouteQuerySuffix(path);
            if (mapped == null || mapped.isEmpty()) {
                return stripQuery(path);
            }
            return querySuffix.isEmpty() ? mapped : mapped + "?" + querySuffix;
        }
        String querySuffix = extractQuerySuffix(path);
        String basePath = stripQuery(path);

        String adminRoute = ADMIN_PATH_TO_ROUTE.get(basePath);
        if (adminRoute != null && !adminRoute.isEmpty()) {
            String canonical = ADMIN_ROUTE_TO_PATH.get(adminRoute);
            if (canonical != null && !canonical.isEmpty()) {
                return querySuffix.isEmpty() ? canonical : canonical + "?" + querySuffix;
            }
        }

        String homeRoute = HOME_PATH_TO_ROUTE.get(basePath);
        if (homeRoute != null && !homeRoute.isEmpty()) {
            String canonical = HOME_ROUTE_TO_PATH.get(homeRoute);
            if (canonical != null && !canonical.isEmpty()) {
                return querySuffix.isEmpty() ? canonical : canonical + "?" + querySuffix;
            }
        }

        return path;
    }

    public static String resolveRouteIdForPath(String requestUrl) {
        String normalized = normalize(requestUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        String path = stripEnglishPrefix(stripQuery(normalized));
        String adminRoute = ADMIN_PATH_TO_ROUTE.get(path);
        if (adminRoute != null && !adminRoute.isEmpty()) {
            return adminRoute;
        }
        return resolveHomeRoute(path);
    }

    private static String localizeAdminPath(String path) {
        if (path == null || path.isEmpty()) {
            return "";
        }
        if (path.startsWith("/en/")) {
            return path;
        }
        if (path.startsWith("/")) {
            return "/en" + path;
        }
        return "/en/" + path;
    }

    private static String normalizeRouteToken(String route) {
        if (route == null) {
            return "";
        }
        return route.trim().replace('-', '_');
    }

    private static String resolveHomeRoute(String path) {
        if (path == null || path.isEmpty()) {
            return "";
        }
        String route = HOME_PATH_TO_ROUTE.get(path);
        return route == null ? "" : route;
    }

    private static String localizeHomePath(String path) {
        if (path == null || path.isEmpty()) {
            return "";
        }
        String localized = HOME_LOCALIZED_PATHS.get(path);
        return localized == null ? path : localized;
    }

    private static String extractRoute(String value) {
        int queryIndex = value.indexOf('?');
        if (queryIndex < 0 || queryIndex == value.length() - 1) {
            return "";
        }
        String query = value.substring(queryIndex + 1);
        for (String pair : query.split("&")) {
            if (pair.startsWith("route=")) {
                return normalizeRouteToken(pair.substring(6));
            }
        }
        return "";
    }

    private static String stripQuery(String value) {
        int queryIndex = value.indexOf('?');
        return queryIndex >= 0 ? value.substring(0, queryIndex) : value;
    }

    private static String extractQuerySuffix(String value) {
        int queryIndex = value.indexOf('?');
        if (queryIndex < 0 || queryIndex == value.length() - 1) {
            return "";
        }
        return value.substring(queryIndex + 1);
    }

    private static String extractNonRouteQuerySuffix(String value) {
        String query = extractQuerySuffix(value);
        if (query.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (String pair : query.split("&")) {
            if (pair == null || pair.isEmpty() || pair.startsWith("route=")) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('&');
            }
            builder.append(pair);
        }
        return builder.toString();
    }

    private static String stripEnglishPrefix(String value) {
        if (value.startsWith("/join/en/")) {
            return "/join/" + value.substring("/join/en/".length());
        }
        if ("/join/en".equals(value)) {
            return "/join";
        }
        return value.startsWith("/en/") ? value.substring(3) : value;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return "";
        }
        if (!normalized.startsWith("/") && !normalized.startsWith("http://") && !normalized.startsWith("https://")
                && !"#".equals(normalized)) {
            return "/" + normalized;
        }
        return normalized;
    }

    private static void registerAdmin(Map<String, String> pathToRoute,
                                      Map<String, String> routeToPath,
                                      String route,
                                      String canonicalPath,
                                      String... aliasPaths) {
        String normalizedRoute = normalizeRouteToken(route);
        routeToPath.put(normalizedRoute, canonicalPath);
        for (String aliasPath : aliasPaths) {
            pathToRoute.put(aliasPath, normalizedRoute);
        }
    }

    private static void registerHome(Map<String, String> pathToRoute,
                                     Map<String, String> routeToPath,
                                     Map<String, String> localizedPaths,
                                     String route,
                                     String canonicalPath,
                                     String localizedPath,
                                     String... aliasPaths) {
        String normalizedRoute = normalizeRouteToken(route);
        routeToPath.put(normalizedRoute, canonicalPath);
        localizedPaths.put(canonicalPath, localizedPath);
        for (String aliasPath : aliasPaths) {
            pathToRoute.put(aliasPath, normalizedRoute);
        }
    }
}

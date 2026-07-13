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
        registerAdmin(adminPathToRoute, adminRouteToPath, "builder-studio", "/admin/system/builder-studio", "/admin/system/builder-studio");
        registerAdmin(adminPathToRoute, adminRouteToPath, "system-design-governance", "/admin/system/design-governance", "/admin/system/design-governance");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_project_list", "/emission/project_list", "/en/emission/project_list", "/emission/project_list");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_project_create", "/emission/project/create", "/en/emission/project/create", "/emission/project/create");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_project_detail", "/emission/project/detail", "/en/emission/project/detail", "/emission/project/detail");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_my_tasks", "/emission/my-tasks", "/en/emission/my-tasks", "/emission/my-tasks");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_deadline_status", "/emission/deadline-status", "/en/emission/deadline-status", "/emission/deadline-status");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_data_input", "/emission/data_input", "/en/emission/data_input", "/emission/data_input");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_result", "/emission/result", "/en/emission/result", "/emission/result");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_report_submit", "/emission/report_submit", "/en/emission/report_submit", "/emission/report_submit");
        registerHome(homePathToRoute, homeRouteToPath, homeLocalizedPaths, "emission_dashboard", "/emission/dashboard", "/en/emission/dashboard", "/emission/dashboard");
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

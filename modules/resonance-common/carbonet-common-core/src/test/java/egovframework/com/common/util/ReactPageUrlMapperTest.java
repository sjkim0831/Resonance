package egovframework.com.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReactPageUrlMapperTest {

    @Test
    void emissionFamilyMenuUrlsResolveToRuntimeUrls() {
        assertEquals("/admin/emission/result_list",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/result_list", false));
        assertEquals("/admin/emission/result_detail?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/result_detail?resultId=ER-2026-001", false));
        assertEquals("/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate?resultId=ER-2026-001", false));
        assertEquals("/admin/emission/data_history?changeTarget=MONITORING_RULE",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/data_history?changeTarget=MONITORING_RULE", false));
        assertEquals("/admin/emission/site-management",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/site-management", false));
    }

    @Test
    void emissionFamilyMenuUrlsResolveToEnglishRuntimeUrls() {
        assertEquals("/en/admin/emission/result_list",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/result_list", true));
        assertEquals("/en/admin/emission/result_detail?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/result_detail?resultId=ER-2026-001", true));
        assertEquals("/en/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate?resultId=ER-2026-001", true));
        assertEquals("/en/admin/emission/data_history?changeTarget=MONITORING_RULE",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/data_history?changeTarget=MONITORING_RULE", true));
        assertEquals("/en/admin/emission/site-management",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/site-management", true));
    }

    @Test
    void emissionValidateMenuUrlResolvesToRuntimeUrl() {
        assertEquals("/admin/emission/validate",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate", false));
        assertEquals("/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate?resultId=ER-2026-001", false));
    }

    @Test
    void emissionValidateMenuUrlResolvesToEnglishRuntimeUrl() {
        assertEquals("/en/admin/emission/validate",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate", true));
        assertEquals("/en/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toRuntimeUrl("/admin/emission/validate?resultId=ER-2026-001", true));
    }

    @Test
    void emissionValidateRuntimeRouteResolvesBackToCanonicalMenuUrl() {
        assertEquals("/admin/emission/validate",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=emission_validate"));
        assertEquals("/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/emission/validate?resultId=ER-2026-001"));
        assertEquals("/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toCanonicalMenuUrl("/en/admin/emission/validate?resultId=ER-2026-001"));
    }

    @Test
    void emissionFamilyRuntimeRoutesResolveBackToCanonicalMenuUrls() {
        assertEquals("/admin/emission/result_list?resultStatus=REVIEW",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/emission/result_list?resultStatus=REVIEW"));
        assertEquals("/admin/emission/result_detail?resultId=ER-2026-001",
                ReactPageUrlMapper.toCanonicalMenuUrl("/en/admin/emission/result_detail?resultId=ER-2026-001"));
        assertEquals("/admin/emission/validate?resultId=ER-2026-001",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=emission_validate&resultId=ER-2026-001"));
        assertEquals("/admin/emission/data_history?changeTarget=MONITORING_RULE",
                ReactPageUrlMapper.toCanonicalMenuUrl("/en/admin/emission/data_history?changeTarget=MONITORING_RULE"));
        assertEquals("/admin/emission/site-management",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=emission_site_management"));
    }

    @Test
    void menuManagementUsesContentRouteAsCanonicalPathWhileKeepingLegacyAlias() {
        assertEquals("/admin/content/menu",
                ReactPageUrlMapper.toRuntimeUrl("/admin/content/menu", false));
        assertEquals("/en/admin/content/menu",
                ReactPageUrlMapper.toRuntimeUrl("/admin/content/menu", true));
        assertEquals("/admin/system/menu",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=menu-management"));
        assertEquals("/admin/system/menu?menuType=ADMIN",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=menu-management&menuType=ADMIN"));
        assertEquals("/admin/system/menu?menuType=ADMIN",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/system/menu-management?menuType=ADMIN"));
        assertEquals("faq_menu_management",
                ReactPageUrlMapper.resolveRouteIdForPath("/admin/content/menu?menuType=ADMIN"));
        assertEquals("menu_management",
                ReactPageUrlMapper.resolveRouteIdForPath("/admin/system/menu-management?menuType=ADMIN"));
    }

    @Test
    void bannerEditUsesContentRouteAsCanonicalPathAndPreservesBannerId() {
        assertEquals("/admin/content/banner_edit",
                ReactPageUrlMapper.toRuntimeUrl("/admin/content/banner_edit", false));
        assertEquals("/en/admin/content/banner_edit",
                ReactPageUrlMapper.toRuntimeUrl("/admin/content/banner_edit", true));
        assertEquals("/admin/content/banner_edit?bannerId=BNR-240301",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=banner-edit&bannerId=BNR-240301"));
        assertEquals("/admin/content/banner_edit?bannerId=BNR-240301",
                ReactPageUrlMapper.toCanonicalMenuUrl("/en/admin/content/banner_edit?bannerId=BNR-240301"));
        assertEquals("banner_edit",
                ReactPageUrlMapper.resolveRouteIdForPath("/admin/content/banner_edit?bannerId=BNR-240301"));
    }

    @Test
    void homeRuntimeRoutesPreserveNonRouteQueryParametersWhenResolvingCanonicalUrls() {
        assertEquals("/mypage/profile?tab=security",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=mypage&tab=security"));
        assertEquals("/join/companyJoinStatusSearch?bizRegNo=123-45-67890",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=join_company_status&bizRegNo=123-45-67890"));
        assertEquals("/join/companyJoinStatusSearch?bizRegNo=123-45-67890",
                ReactPageUrlMapper.toCanonicalMenuUrl("/en/app?route=join_company_status&bizRegNo=123-45-67890"));
    }

    @Test
    void homeTradeRoutesResolveBetweenPathAndRouteIds() {
        assertEquals("/trade/auto_order",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=trade_auto_order"));
        assertEquals("/en/trade/auto_order",
                ReactPageUrlMapper.toRuntimeUrl("/trade/auto_order", true));
        assertEquals("trade_auto_order",
                ReactPageUrlMapper.resolveRouteIdForPath("/trade/auto_order"));
        assertEquals("trade_complete",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/trade/complete"));
    }

    @Test
    void monitoringRealtimeAliasResolvesToMonitoringDashboardRoute() {
        assertEquals("/monitoring/realtime",
                ReactPageUrlMapper.toRuntimeUrl("/monitoring/realtime", false));
        assertEquals("/en/monitoring/realtime",
                ReactPageUrlMapper.toRuntimeUrl("/monitoring/realtime", true));
        assertEquals("/monitoring/dashboard",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=monitoring_dashboard"));
        assertEquals("monitoring_realtime",
                ReactPageUrlMapper.resolveRouteIdForPath("/monitoring/realtime"));
        assertEquals("monitoring_track",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/monitoring/track"));
    }

    @Test
    void monitoringExportRouteResolvesBetweenPathAndRouteIds() {
        assertEquals("/monitoring/export",
                ReactPageUrlMapper.toRuntimeUrl("/monitoring/export", false));
        assertEquals("/en/monitoring/export",
                ReactPageUrlMapper.toRuntimeUrl("/monitoring/export", true));
        assertEquals("/monitoring/export",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=monitoring_export"));
        assertEquals("monitoring_export",
                ReactPageUrlMapper.resolveRouteIdForPath("/monitoring/export"));
        assertEquals("monitoring_export",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/monitoring/export"));
    }

    @Test
    void runtimeRoutesPreserveMultipleNonRouteQueryParametersRegardlessOfRouteParameterOrder() {
        assertEquals("/admin/emission/validate?resultId=ER-2026-001&pageIndex=2",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?resultId=ER-2026-001&route=emission_validate&pageIndex=2"));
        assertEquals("/mypage/profile?tab=security&panel=alerts",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?tab=security&route=mypage&panel=alerts"));
    }

    @Test
    void runtimeRouteFallbackKeepsShellPathWhenRouteIsUnknownOrMissing() {
        assertEquals("/admin/app",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?route=unknown_route&resultId=ER-2026-001"));
        assertEquals("/admin/app",
                ReactPageUrlMapper.toCanonicalMenuUrl("/admin/app?pageIndex=2"));
        assertEquals("/app",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?route=unknown_route&tab=security"));
        assertEquals("/app",
                ReactPageUrlMapper.toCanonicalMenuUrl("/app?tab=security"));
    }

    @Test
    void toRuntimeUrlReturnsEmptyForUnsupportedOrUnknownTargets() {
        assertEquals("",
                ReactPageUrlMapper.toRuntimeUrl("https://example.com/admin/emission/validate", false));
        assertEquals("",
                ReactPageUrlMapper.toRuntimeUrl("#", false));
        assertEquals("",
                ReactPageUrlMapper.toRuntimeUrl("/admin/unknown/path", false));
    }

    @Test
    void resolveRouteIdForPathIdentifiesAdminHomeAndUnknownPaths() {
        assertEquals("emission_validate",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/admin/emission/validate?resultId=ER-2026-001"));
        assertEquals("mypage",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/mypage?tab=security"));
        assertEquals("",
                ReactPageUrlMapper.resolveRouteIdForPath("/admin/unknown/path?x=1"));
    }
}

package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;

public class CarbonetScreenBuilderRuntimeComparePolicyAdapter implements ScreenBuilderRuntimeComparePolicyPort {

    private static final String LIST_PAGE = "LIST_PAGE";
    private static final String DETAIL_PAGE = "DETAIL_PAGE";
    private static final String REVIEW_PAGE = "REVIEW_PAGE";

    @Override
    public String resolveProjectId() {
        return "carbonet-main";
    }

    @Override
    public String resolveCompareBaseline() {
        return "CURRENT_RUNTIME";
    }

    @Override
    public boolean isAdminSurface(String menuUrl) {
        String normalized = ScreenBuilderAdapterSupport.lowerCaseSafe(menuUrl);
        return normalized.startsWith("/admin") || normalized.startsWith("/en/admin");
    }

    @Override
    public String resolveGuidedStateId(boolean adminSurface) {
        return "guided-build-14-runtime-compare";
    }

    @Override
    public String resolveTemplateLineId(boolean adminSurface) {
        return adminSurface ? "admin-line-02" : "public-line-01";
    }

    @Override
    public String resolveScreenFamilyRuleId(boolean adminSurface, String templateType, String menuUrl) {
        if (adminSurface) {
            if (LIST_PAGE.equalsIgnoreCase(ScreenBuilderAdapterSupport.safe(templateType))) {
                return "ADMIN_LIST";
            }
            if (DETAIL_PAGE.equalsIgnoreCase(ScreenBuilderAdapterSupport.safe(templateType))) {
                return "ADMIN_DETAIL";
            }
            if (REVIEW_PAGE.equalsIgnoreCase(ScreenBuilderAdapterSupport.safe(templateType))) {
                return "ADMIN_LIST_REVIEW";
            }
            return "ADMIN_EDIT";
        }
        String normalized = ScreenBuilderAdapterSupport.lowerCaseSafe(menuUrl);
        if (normalized.contains("/join")) {
            return "PUBLIC_JOIN_STEP";
        }
        return "PUBLIC_HOME";
    }

    @Override
    public String resolveOwnerLane() {
        return "res-verify";
    }

    @Override
    public String resolveSelectedScreenId(String pageId, String menuCode) {
        String normalizedPageId = ScreenBuilderAdapterSupport.safe(pageId);
        if (!normalizedPageId.isEmpty()) {
            return normalizedPageId;
        }
        return ScreenBuilderAdapterSupport.lowerCaseSafe(menuCode);
    }

    @Override
    public String resolveRequestedBy() {
        return "screen-builder-status-summary";
    }

    @Override
    public String resolveRequestedByType() {
        return "SCREEN_BUILDER_QUEUE";
    }

}

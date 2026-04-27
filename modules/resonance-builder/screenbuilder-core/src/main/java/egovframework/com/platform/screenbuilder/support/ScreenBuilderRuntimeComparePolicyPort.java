package egovframework.com.platform.screenbuilder.support;

public interface ScreenBuilderRuntimeComparePolicyPort {

    String resolveProjectId();

    String resolveCompareBaseline();

    boolean isAdminSurface(String menuUrl);

    String resolveGuidedStateId(boolean adminSurface);

    String resolveTemplateLineId(boolean adminSurface);

    String resolveScreenFamilyRuleId(boolean adminSurface, String templateType, String menuUrl);

    String resolveOwnerLane();

    String resolveSelectedScreenId(String pageId, String menuCode);

    String resolveRequestedBy();

    String resolveRequestedByType();
}

package egovframework.com.platform.screenbuilder.runtime.common;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRequestContextPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class PropertyBackedScreenBuilderPolicyAdapter implements
        ScreenBuilderMenuBindingPolicyPort,
        ScreenBuilderArtifactNamingPolicyPort,
        ScreenBuilderRuntimeComparePolicyPort,
        ScreenBuilderRequestContextPolicyPort {

    private static final String LIST_PAGE = "LIST_PAGE";
    private static final String DETAIL_PAGE = "DETAIL_PAGE";
    private static final String REVIEW_PAGE = "REVIEW_PAGE";

    private final ScreenBuilderRuntimeCommonProperties properties;

    public PropertyBackedScreenBuilderPolicyAdapter(ScreenBuilderRuntimeCommonProperties properties) {
        this.properties = properties;
    }

    @Override
    public List<String> getMenuCatalogRoots() {
        return java.util.Collections.singletonList(safe(properties.getMenuRoot()));
    }

    @Override
    public String resolveMenuScope() {
        return safe(properties.getMenuScope());
    }

    @Override
    public String resolveRuntimeClass() {
        return safe(properties.getRuntimeClass());
    }

    @Override
    public String derivePageId(String menuCode, ScreenBuilderMenuDescriptor menu) {
        String menuUrl = menu == null ? "" : safe(menu.getMenuUrl());
        if (!menuUrl.isEmpty()) {
            String normalizedUrl = menuUrl.replaceFirst("^/+", "");
            return normalizedUrl.replace('_', '-').replace('/', '-').toLowerCase(Locale.ROOT);
        }
        return safe(menuCode).replace('_', '-');
    }

    @Override
    public String resolveBuilderId(String menuCode) {
        return safe(properties.getBuilderIdPrefix()) + "-" + safe(menuCode);
    }

    @Override
    public String resolveReleaseUnitId(ScreenBuilderDraftDocumentVO draft, String publishedVersionId) {
        String releaseAnchor = firstNonBlank(
                publishedVersionId,
                draft == null ? null : draft.getVersionId(),
                draft == null ? null : draft.getPageId(),
                draft == null ? null : draft.getMenuCode());
        return safe(properties.getReleaseUnitPrefix()) + "-" + safe(releaseAnchor);
    }

    @Override
    public Map<String, Object> buildArtifactEvidence(
            ScreenBuilderDraftDocumentVO draft,
            String releaseUnitId,
            String publishedVersionId,
            String publishedSavedAt) {
        String normalizedReleaseUnitId = safe(releaseUnitId);
        String normalizedMenuCode = safe(draft == null ? null : draft.getMenuCode());
        Map<String, Object> evidence = new LinkedHashMap<String, Object>();
        evidence.put("artifactSourceSystem", safe(properties.getArtifactSourceSystem()));
        evidence.put("artifactTargetSystem", safe(properties.getArtifactTargetSystem()));
        evidence.put("releaseUnitId", normalizedReleaseUnitId);
        evidence.put("runtimePackageId", safe(properties.getRuntimePackagePrefix()) + "-" + normalizedReleaseUnitId);
        evidence.put("deployTraceId", normalizedReleaseUnitId + "-" + safe(publishedVersionId));
        evidence.put("publishedVersionId", safe(publishedVersionId));
        evidence.put("publishedSavedAt", safe(publishedSavedAt));
        evidence.put("artifactKind", "screen-builder-runtime");
        evidence.put("artifactPathHint", safe(properties.getArtifactPathBase()) + "/" + normalizedReleaseUnitId);
        if (draft != null) {
            evidence.put("pageId", draft.getPageId());
            evidence.put("menuCode", normalizedMenuCode);
        }
        return evidence;
    }

    @Override
    public String resolveProjectId() {
        return safe(properties.getProjectId());
    }

    @Override
    public String resolveCompareBaseline() {
        return safe(properties.getCompareBaseline());
    }

    @Override
    public boolean isAdminSurface(String menuUrl) {
        String normalized = safe(menuUrl).toLowerCase(Locale.ROOT);
        for (String prefix : properties.getAdminPathPrefixes()) {
            if (normalized.startsWith(safe(prefix).toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    @Override
    public String resolveGuidedStateId(boolean adminSurface) {
        return adminSurface ? safe(properties.getAdminGuidedStateId()) : safe(properties.getPublicGuidedStateId());
    }

    @Override
    public String resolveTemplateLineId(boolean adminSurface) {
        return adminSurface ? safe(properties.getAdminTemplateLineId()) : safe(properties.getPublicTemplateLineId());
    }

    @Override
    public String resolveScreenFamilyRuleId(boolean adminSurface, String templateType, String menuUrl) {
        String normalizedTemplateType = safe(templateType).toUpperCase(Locale.ROOT);
        if (adminSurface) {
            if (LIST_PAGE.equals(normalizedTemplateType)) {
                return "ADMIN_LIST";
            }
            if (DETAIL_PAGE.equals(normalizedTemplateType)) {
                return "ADMIN_DETAIL";
            }
            if (REVIEW_PAGE.equals(normalizedTemplateType)) {
                return "ADMIN_REVIEW";
            }
            return "ADMIN_EDIT";
        }
        return "PUBLIC_" + normalizedTemplateType;
    }

    @Override
    public String resolveOwnerLane() {
        return safe(properties.getOwnerLane());
    }

    @Override
    public String resolveSelectedScreenId(String pageId, String menuCode) {
        return firstNonBlank(pageId, menuCode);
    }

    @Override
    public String resolveRequestedBy() {
        return safe(properties.getRequestedBy());
    }

    @Override
    public String resolveRequestedByType() {
        return safe(properties.getRequestedByType());
    }

    @Override
    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (locale != null && "en".equalsIgnoreCase(locale.getLanguage())) {
            return true;
        }
        if (request == null || request.getRequestURI() == null) {
            return false;
        }
        String uri = request.getRequestURI();
        for (String prefix : properties.getEnglishPathPrefixes()) {
            if (uri.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "unknown";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "unknown";
    }

    private String safe(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "unknown";
        }
        return value.trim().replaceAll("[^A-Za-z0-9/_-]+", "-");
    }
}

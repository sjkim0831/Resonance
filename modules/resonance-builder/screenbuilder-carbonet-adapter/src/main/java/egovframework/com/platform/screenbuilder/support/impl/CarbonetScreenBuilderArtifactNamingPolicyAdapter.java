package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public class CarbonetScreenBuilderArtifactNamingPolicyAdapter implements ScreenBuilderArtifactNamingPolicyPort {

    @Override
    public String resolveBuilderId(String menuCode) {
        String normalizedMenuCode = ScreenBuilderAdapterSupport.safe(menuCode);
        return "builder-" + (normalizedMenuCode.isEmpty() ? UUID.randomUUID() : normalizedMenuCode);
    }

    @Override
    public String resolveReleaseUnitId(ScreenBuilderDraftDocumentVO draft, String publishedVersionId) {
        String normalizedPublishedVersionId = ScreenBuilderAdapterSupport.safe(publishedVersionId);
        if (!normalizedPublishedVersionId.isEmpty()) {
            return normalizedPublishedVersionId;
        }
        if (draft != null && !ScreenBuilderAdapterSupport.safe(draft.getVersionId()).isEmpty()) {
            return ScreenBuilderAdapterSupport.safe(draft.getVersionId());
        }
        if (draft != null && !ScreenBuilderAdapterSupport.safe(draft.getPageId()).isEmpty()) {
            return ScreenBuilderAdapterSupport.safe(draft.getPageId());
        }
        return ScreenBuilderAdapterSupport.safe(draft == null ? "" : draft.getMenuCode());
    }

    @Override
    public Map<String, Object> buildArtifactEvidence(
            ScreenBuilderDraftDocumentVO draft,
            String releaseUnitId,
        String publishedVersionId,
        String publishedSavedAt) {
        String menuCode = draft == null ? "" : ScreenBuilderAdapterSupport.safe(draft.getMenuCode());
        String pageId = draft == null ? "" : ScreenBuilderAdapterSupport.safe(draft.getPageId());
        String normalizedReleaseUnitId = ScreenBuilderAdapterSupport.firstNonBlank(
                releaseUnitId,
                pageId,
                menuCode,
                "screen-builder-release");
        String normalizedMenuCode = menuCode.isEmpty() ? "menu" : ScreenBuilderAdapterSupport.lowerCaseSafe(menuCode);
        String normalizedPageId = pageId.isEmpty() ? "page" : ScreenBuilderAdapterSupport.lowerCaseSafe(pageId);
        return ScreenBuilderAdapterSupport.orderedMap(
                "artifactSourceSystem", "carbonet-ops",
                "artifactTargetSystem", "carbonet-general",
                "releaseUnitId", normalizedReleaseUnitId,
                "runtimePackageId", "screen-builder-runtime-" + normalizedMenuCode + "-" + normalizedPageId,
                "deployTraceId", "deploy-" + normalizedReleaseUnitId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-"),
                "publishedVersionId", ScreenBuilderAdapterSupport.safe(publishedVersionId),
                "publishedSavedAt", ScreenBuilderAdapterSupport.safe(publishedSavedAt),
                "artifactKind", "screen-builder-runtime",
                "artifactPathHint", "src/main/resources/static/react-app");
    }
}

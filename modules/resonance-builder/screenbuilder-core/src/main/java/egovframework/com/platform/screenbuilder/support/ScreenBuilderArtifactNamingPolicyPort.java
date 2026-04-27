package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;

import java.util.Map;

public interface ScreenBuilderArtifactNamingPolicyPort {

    String resolveBuilderId(String menuCode);

    String resolveReleaseUnitId(ScreenBuilderDraftDocumentVO draft, String publishedVersionId);

    Map<String, Object> buildArtifactEvidence(
            ScreenBuilderDraftDocumentVO draft,
            String releaseUnitId,
            String publishedVersionId,
            String publishedSavedAt);
}

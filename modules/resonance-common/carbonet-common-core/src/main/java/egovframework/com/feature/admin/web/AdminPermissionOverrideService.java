package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.util.FeatureCodeBitmap;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminPermissionOverrideService {

    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public void savePermissionOverrides(
            String scrtyTargetId,
            String memberTypeCode,
            List<String> baselineFeatureCodes,
            List<String> effectiveFeatureCodes,
            String actorId,
            Set<String> grantableFeatureCodes) throws Exception {
        String normalizedTargetId = adminAuthorityPagePayloadSupport.safeValue(scrtyTargetId);
        if (normalizedTargetId.isEmpty()) {
            throw new IllegalArgumentException("Security target ID is required.");
        }
        Set<String> baseline = new LinkedHashSet<>(baselineFeatureCodes == null
                ? Collections.emptyList()
                : normalizeFeatureCodes(baselineFeatureCodes));
        Set<String> requestedEffective = new LinkedHashSet<>(effectiveFeatureCodes == null
                ? Collections.emptyList()
                : normalizeFeatureCodes(effectiveFeatureCodes));
        Set<String> effective = grantableFeatureCodes == null
                ? requestedEffective
                : mergeManagedFeatureSelection(
                        baseline,
                        resolveEffectiveFeatureCodeSet(normalizedTargetId, baseline),
                        requestedEffective,
                        grantableFeatureCodes);
        List<String> allowFeatureCodes = new ArrayList<>(effective);
        allowFeatureCodes.removeAll(baseline);
        List<String> denyFeatureCodes = new ArrayList<>(baseline);
        denyFeatureCodes.removeAll(effective);
        authGroupManageService.replaceUserFeatureOverrides(
                normalizedTargetId,
                memberTypeCode,
                allowFeatureCodes,
                denyFeatureCodes,
                actorId);
    }

    private Set<String> resolveEffectiveFeatureCodeSet(String scrtyTargetId, Set<String> baselineFeatureCodes) throws Exception {
        Set<String> effective = new LinkedHashSet<>(baselineFeatureCodes == null ? Collections.emptySet() : baselineFeatureCodes);
        if (!adminAuthorityPagePayloadSupport.safeValue(scrtyTargetId).isEmpty()) {
            applyUserFeatureOverrides(effective, authGroupManageService.selectUserFeatureOverrides(scrtyTargetId));
        }
        return effective;
    }

    private void applyUserFeatureOverrides(Set<String> featureCodes, List<UserFeatureOverrideVO> overrides) {
        if (featureCodes == null || overrides == null || overrides.isEmpty()) {
            return;
        }
        for (UserFeatureOverrideVO override : overrides) {
            String featureCode = adminAuthorityPagePayloadSupport.safeValue(override.getFeatureCode()).toUpperCase(java.util.Locale.ROOT);
            if (featureCode.isEmpty()) {
                continue;
            }
            if ("D".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(override.getOverrideType()))) {
                featureCodes.remove(featureCode);
            } else {
                featureCodes.add(featureCode);
            }
        }
    }

    private Set<String> mergeManagedFeatureSelection(
            Set<String> baselineFeatureCodes,
            Set<String> currentEffectiveFeatureCodes,
            Set<String> requestedManagedFeatureCodes,
            Set<String> grantableFeatureCodes) {
        if (grantableFeatureCodes == null) {
            return requestedManagedFeatureCodes == null ? new LinkedHashSet<>() : new LinkedHashSet<>(requestedManagedFeatureCodes);
        }
        Set<String> indexedCodes = new LinkedHashSet<>();
        indexedCodes.addAll(safeSet(baselineFeatureCodes));
        indexedCodes.addAll(safeSet(currentEffectiveFeatureCodes));
        indexedCodes.addAll(safeSet(requestedManagedFeatureCodes));
        indexedCodes.addAll(safeSet(grantableFeatureCodes));
        FeatureCodeBitmap.Index featureBitmapIndex = FeatureCodeBitmap.index(indexedCodes);
        BitSet mergedBitmap = featureBitmapIndex.encode(baselineFeatureCodes);
        BitSet currentEffectiveBitmap = featureBitmapIndex.encode(currentEffectiveFeatureCodes);
        BitSet grantableBitmap = featureBitmapIndex.encode(grantableFeatureCodes);

        mergedBitmap.or(featureBitmapIndex.difference(currentEffectiveBitmap, grantableBitmap));

        BitSet baselineBitmap = featureBitmapIndex.encode(baselineFeatureCodes);
        BitSet unmanagedBaselineRemoved = featureBitmapIndex.difference(baselineBitmap, grantableBitmap);
        unmanagedBaselineRemoved.andNot(currentEffectiveBitmap);
        mergedBitmap.andNot(unmanagedBaselineRemoved);

        mergedBitmap.andNot(grantableBitmap);
        mergedBitmap.or(featureBitmapIndex.intersect(
                featureBitmapIndex.encode(requestedManagedFeatureCodes),
                grantableBitmap));
        return featureBitmapIndex.decode(mergedBitmap);
    }

    private Set<String> safeSet(Set<String> values) {
        return values == null ? Collections.emptySet() : values;
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = adminAuthorityPagePayloadSupport.safeValue(featureCode).toUpperCase(java.util.Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
    }
}

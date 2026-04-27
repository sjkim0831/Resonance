package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminPermissionEditorService {

    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public void populatePermissionEditorModel(
            Model model,
            List<AuthorInfoVO> authorGroups,
            String selectedAuthorCode,
            String scrtyTargetId,
            List<String> effectiveFeatureCodes,
            boolean isEn,
            String currentUserId) throws Exception {
        ensurePermissionEditorDefaults(model, isEn);
        List<AuthorInfoVO> safeAuthorGroups = authorGroups == null ? Collections.emptyList() : authorGroups;
        safeAuthorGroups = adminAuthorityPagePayloadSupport.appendCurrentAuthorGroup(safeAuthorGroups, selectedAuthorCode);
        Set<String> grantableFeatureCodes = adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(
                currentUserId,
                "webmaster".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(currentUserId)));
        List<FeatureCatalogSectionVO> featureSections = adminAuthorityPagePayloadSupport.filterFeatureCatalogSectionsByGrantable(
                adminAuthorityPagePayloadSupport.buildFeatureCatalogSections(authGroupManageService.selectFeatureCatalog(), isEn),
                grantableFeatureCodes);
        String normalizedAuthorCode = normalizeSelectedAuthorCode(selectedAuthorCode, safeAuthorGroups);
        Set<String> baselineFeatureCodes = new LinkedHashSet<>(normalizedAuthorCode.isEmpty()
                ? Collections.emptyList()
                : normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(normalizedAuthorCode)));
        Map<String, List<String>> roleFeatureCodesByAuthorCode = new LinkedHashMap<>();
        for (AuthorInfoVO group : safeAuthorGroups) {
            String authorCode = adminAuthorityPagePayloadSupport.safeValue(group.getAuthorCode()).toUpperCase(Locale.ROOT);
            if (authorCode.isEmpty() || roleFeatureCodesByAuthorCode.containsKey(authorCode)) {
                continue;
            }
            roleFeatureCodesByAuthorCode.put(authorCode, normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode)));
        }

        Set<String> effectiveCodeSet = new LinkedHashSet<>();
        if (effectiveFeatureCodes != null) {
            effectiveCodeSet.addAll(normalizeFeatureCodes(effectiveFeatureCodes));
        } else if (!adminAuthorityPagePayloadSupport.safeValue(scrtyTargetId).isEmpty()) {
            List<UserFeatureOverrideVO> overrides = authGroupManageService.selectUserFeatureOverrides(scrtyTargetId);
            effectiveCodeSet.addAll(baselineFeatureCodes);
            for (UserFeatureOverrideVO override : overrides) {
                String featureCode = adminAuthorityPagePayloadSupport.safeValue(override.getFeatureCode()).toUpperCase(Locale.ROOT);
                if (featureCode.isEmpty()) {
                    continue;
                }
                if ("D".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(override.getOverrideType()))) {
                    effectiveCodeSet.remove(featureCode);
                } else {
                    effectiveCodeSet.add(featureCode);
                }
            }
        } else {
            effectiveCodeSet.addAll(baselineFeatureCodes);
        }

        baselineFeatureCodes = filterFeatureCodeSetByGrantable(baselineFeatureCodes, grantableFeatureCodes);
        effectiveCodeSet = filterFeatureCodeSetByGrantable(effectiveCodeSet, grantableFeatureCodes);

        Set<String> addedFeatureCodes = new LinkedHashSet<>(effectiveCodeSet);
        addedFeatureCodes.removeAll(baselineFeatureCodes);
        Set<String> removedFeatureCodes = new LinkedHashSet<>(baselineFeatureCodes);
        removedFeatureCodes.removeAll(effectiveCodeSet);

        model.addAttribute("permissionAuthorGroups", safeAuthorGroups);
        model.addAttribute("permissionSelectedAuthorCode", normalizedAuthorCode);
        model.addAttribute("permissionSelectedAuthorName", adminAuthorityPagePayloadSupport.resolveSelectedAuthorName(normalizedAuthorCode, safeAuthorGroups));
        model.addAttribute("permissionFeatureSections", featureSections);
        model.addAttribute("permissionBaseFeatureCodes", baselineFeatureCodes);
        model.addAttribute("permissionEffectiveFeatureCodes", effectiveCodeSet);
        model.addAttribute("permissionRoleFeatureCodesByAuthorCode", roleFeatureCodesByAuthorCode);
        model.addAttribute("permissionAddedFeatureCodes", addedFeatureCodes);
        model.addAttribute("permissionRemovedFeatureCodes", removedFeatureCodes);
        model.addAttribute("permissionEffectiveFeatureLabels", buildFeatureDisplayLabels(featureSections, effectiveCodeSet));
        model.addAttribute("permissionFeatureCount", effectiveCodeSet.size());
        model.addAttribute("permissionPageCount", adminAuthorityPagePayloadSupport.countSelectedPageCount(featureSections, new ArrayList<>(effectiveCodeSet)));
    }

    private void ensurePermissionEditorDefaults(Model model, boolean isEn) {
        model.addAttribute("permissionAuthorGroups", Collections.emptyList());
        model.addAttribute("permissionAuthorGroupSections", Collections.emptyList());
        model.addAttribute("permissionSelectedAuthorCode", "");
        model.addAttribute("permissionSelectedAuthorName", "");
        model.addAttribute("permissionSelectedAuthorProfile", Collections.emptyMap());
        model.addAttribute("permissionSelectedFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionRequestedFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionEffectiveFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionEffectiveFeatureLabels", Collections.emptyList());
        model.addAttribute("permissionFeatureSections", Collections.emptyList());
        model.addAttribute("permissionFeatureCount", 0);
        model.addAttribute("permissionPageCount", 0);
        model.addAttribute("permissionFeatureEditorEnabled", false);
        model.addAttribute("permissionEditorError", "");
        model.addAttribute("permissionBaseFeatureCodes", Collections.emptySet());
        model.addAttribute("permissionAddedFeatureCodes", Collections.emptySet());
        model.addAttribute("permissionRemovedFeatureCodes", Collections.emptySet());
        model.addAttribute("permissionEmptyRoleLabel", isEn ? "Select a role" : "권한 롤 선택");
    }

    private String normalizeSelectedAuthorCode(String authorCode, List<AuthorInfoVO> authorGroups) {
        String normalizedAuthorCode = adminAuthorityPagePayloadSupport.safeValue(authorCode).toUpperCase(Locale.ROOT);
        if (normalizedAuthorCode.isEmpty()) {
            return "";
        }
        for (AuthorInfoVO authorGroup : authorGroups) {
            String candidate = adminAuthorityPagePayloadSupport.safeValue(authorGroup == null ? null : authorGroup.getAuthorCode()).toUpperCase(Locale.ROOT);
            if (normalizedAuthorCode.equals(candidate)) {
                return normalizedAuthorCode;
            }
        }
        return "";
    }

    private List<String> buildFeatureDisplayLabels(List<FeatureCatalogSectionVO> featureSections, Set<String> effectiveFeatureCodes) {
        if (featureSections == null || featureSections.isEmpty() || effectiveFeatureCodes == null || effectiveFeatureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, String> featureNameByCode = new LinkedHashMap<>();
        for (FeatureCatalogSectionVO section : featureSections) {
            if (section == null || section.getFeatures() == null) {
                continue;
            }
            for (FeatureCatalogItemVO feature : section.getFeatures()) {
                if (feature == null) {
                    continue;
                }
                String featureCode = adminAuthorityPagePayloadSupport.safeValue(feature.getFeatureCode()).toUpperCase(Locale.ROOT);
                if (featureCode.isEmpty() || featureNameByCode.containsKey(featureCode)) {
                    continue;
                }
                String featureName = adminAuthorityPagePayloadSupport.safeValue(feature.getFeatureNm());
                featureNameByCode.put(featureCode, featureName.isEmpty() ? featureCode : featureName);
            }
        }
        List<String> labels = new ArrayList<>();
        for (String featureCode : effectiveFeatureCodes) {
            String normalizedFeatureCode = adminAuthorityPagePayloadSupport.safeValue(featureCode).toUpperCase(Locale.ROOT);
            if (!normalizedFeatureCode.isEmpty()) {
                labels.add(featureNameByCode.getOrDefault(normalizedFeatureCode, normalizedFeatureCode));
            }
        }
        return labels;
    }

    private Set<String> filterFeatureCodeSetByGrantable(Set<String> featureCodes, Set<String> grantableFeatureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return new LinkedHashSet<>();
        }
        if (grantableFeatureCodes == null) {
            return new LinkedHashSet<>(featureCodes);
        }
        Set<String> filtered = new LinkedHashSet<>(featureCodes);
        filtered.retainAll(grantableFeatureCodes);
        return filtered;
    }

    private List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = adminAuthorityPagePayloadSupport.safeValue(featureCode).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
    }
}

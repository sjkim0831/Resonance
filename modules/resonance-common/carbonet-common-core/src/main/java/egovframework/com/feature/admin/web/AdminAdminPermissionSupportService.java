package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminAdminPermissionSupportService {

    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;

    public String normalizeEmplyrId(String emplyrId) {
        return adminAuthorityPagePayloadSupport.safeValue(emplyrId);
    }

    public String normalizeAuthorCode(String authorCode) {
        return adminAuthorityPagePayloadSupport.safeValue(authorCode).toUpperCase(Locale.ROOT);
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
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

    public String loadAssignedAuthorCode(String emplyrId) throws Exception {
        return adminAuthorityPagePayloadSupport.safeValue(
                authGroupManageService.selectAuthorCodeByUserId(emplyrId)).toUpperCase(Locale.ROOT);
    }

    public List<AuthorInfoVO> loadGrantableAdminAuthorGroups(
            EmplyrInfo adminMember,
            boolean isEn,
            String currentUserId) throws Exception {
        return adminMemberPageModelAssembler.flattenPermissionAuthorGroupSections(
                adminMemberPageModelAssembler.buildAdminPermissionAuthorGroupSections(adminMember, isEn, currentUserId));
    }

    public boolean isGrantableOrCurrentAdminAuthorCode(
            List<AuthorInfoVO> authorGroups,
            String selectedAuthorCode,
            String currentAssignedAuthorCode) {
        return adminAuthorityPagePayloadSupport.isGrantableOrCurrentAuthorCode(
                authorGroups,
                selectedAuthorCode,
                currentAssignedAuthorCode);
    }

    public List<String> loadAuthorFeatureCodes(String authorCode) throws Exception {
        return normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode));
    }

    public void updateAdminRoleAssignment(String emplyrId, String authorCode) throws Exception {
        authGroupManageService.updateAdminRoleAssignment(emplyrId, authorCode);
    }

    public Set<String> resolveGrantableFeatureCodeSet(String currentUserId) throws Exception {
        boolean webmaster = "webmaster".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(currentUserId));
        return adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(currentUserId, webmaster);
    }

    public boolean isWebmaster(String userId) {
        return "webmaster".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(userId));
    }

    public String safeString(String value) {
        return adminAuthorityPagePayloadSupport.safeValue(value);
    }
}

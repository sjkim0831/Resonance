package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminMemberEditSupportService {

    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;
    private final AdminPermissionEditorService adminPermissionEditorService;

    public Set<String> resolveGrantableFeatureCodeSet(String currentUserId) throws Exception {
        return adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(
                currentUserId,
                "webmaster".equalsIgnoreCase(adminAuthorityPagePayloadSupport.safeValue(currentUserId)));
    }

    public String loadCurrentAssignedAuthorCode(String memberId) throws Exception {
        return adminAuthorityPagePayloadSupport.safeValue(
                authGroupManageService.selectEnterpriseAuthorCodeByUserId(memberId)).toUpperCase(Locale.ROOT);
    }

    public List<Map<String, Object>> buildMemberEditAuthorGroupSections(
            EntrprsManageVO member,
            boolean isEn,
            String currentUserId) throws Exception {
        return adminMemberPageModelAssembler.buildMemberEditAuthorGroupSections(member, isEn, currentUserId);
    }

    public List<AuthorInfoVO> flattenPermissionAuthorGroupSections(List<Map<String, Object>> sections) {
        return adminMemberPageModelAssembler.flattenPermissionAuthorGroupSections(sections);
    }

    public List<String> loadAuthorFeatureCodes(String authorCode) throws Exception {
        return normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode));
    }

    public List<String> filterFeatureCodesByGrantable(List<String> featureCodes, Set<String> grantableFeatureCodes) {
        return adminAuthorityPagePayloadSupport.filterFeatureCodesByGrantable(featureCodes, grantableFeatureCodes);
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        java.util.LinkedHashSet<String> normalized = new java.util.LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = adminAuthorityPagePayloadSupport.safeValue(featureCode).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new java.util.ArrayList<>(normalized);
    }

    public void populateFailureModel(
            Model model,
            EntrprsManageVO member,
            boolean isEn,
            String currentUserId,
            String normalizedAuthorCode,
            List<AuthorInfoVO> permissionAuthorGroups,
            List<Map<String, Object>> permissionAuthorGroupSections,
            List<String> normalizedFeatureCodes,
            boolean validationPhase,
            String normalizedMemberId) {
        try {
            adminMemberPageModelAssembler.populateMemberEditModel(model, member, isEn, currentUserId);
            adminPermissionEditorService.populatePermissionEditorModel(
                    model,
                    permissionAuthorGroups,
                    normalizedAuthorCode,
                    adminAuthorityPagePayloadSupport.safeValue(member.getUniqId()),
                    normalizedFeatureCodes,
                    isEn,
                    currentUserId);
            model.addAttribute("permissionAuthorGroupSections", permissionAuthorGroupSections);
        } catch (Exception e) {
            log.error("Failed to populate member edit model ({}). memberId={}",
                    validationPhase ? "validation errors" : "save error",
                    normalizedMemberId,
                    e);
            adminMemberPageModelAssembler.ensureMemberEditDefaults(model, isEn);
        }
    }
}

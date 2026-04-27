package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAdminAccountAccessService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AuthGroupManageService authGroupManageService;
    private final EnterpriseMemberService entrprsManageService;

    public boolean canCreateAdminAccounts(String currentUserId, String currentUserAuthorCode) {
        return authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)
                || canCreateOperationAdminAccounts(currentUserId, currentUserAuthorCode);
    }

    public boolean canCreateAdminRolePreset(String currentUserId, String currentUserAuthorCode, String rolePreset) {
        String normalizedRolePreset = authorityPagePayloadSupport.safeValue(rolePreset).toUpperCase(Locale.ROOT);
        if (normalizedRolePreset.isEmpty()) {
            return false;
        }
        if ("MASTER".equals(normalizedRolePreset)) {
            return "webmaster".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(currentUserId));
        }
        if ("SYSTEM".equals(normalizedRolePreset)) {
            return authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        }
        if ("OPERATION".equals(normalizedRolePreset)) {
            return canCreateOperationAdminAccounts(currentUserId, currentUserAuthorCode);
        }
        return false;
    }

    public boolean canCurrentAdminAccessAdmin(HttpServletRequest request, EmplyrInfo adminMember) {
        if (adminMember == null) {
            return false;
        }
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)) {
            return true;
        }
        if (!authorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode)) {
            return false;
        }
        String targetAdminId = authorityPagePayloadSupport.safeValue(adminMember.getEmplyrId());
        if ("webmaster".equalsIgnoreCase(targetAdminId)) {
            return false;
        }
        String actorInsttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        String targetInsttId = authorityPagePayloadSupport.safeValue(adminMember.getInsttId());
        if (actorInsttId.isEmpty() || !actorInsttId.equals(targetInsttId)) {
            return false;
        }
        try {
            String targetAuthorCode = authorityPagePayloadSupport.safeValue(
                    authGroupManageService.selectAuthorCodeByUserId(targetAdminId)).toUpperCase(Locale.ROOT);
            return !ROLE_SYSTEM_MASTER.equals(targetAuthorCode);
        } catch (Exception e) {
            log.warn("Failed to resolve target admin author code. emplyrId={}", targetAdminId, e);
            return false;
        }
    }

    public InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) {
        String normalizedInsttId = authorityPagePayloadSupport.safeValue(insttId);
        if (normalizedInsttId.isEmpty()) {
            return null;
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            return entrprsManageService.selectInsttInfoForStatus(searchVO);
        } catch (Exception e) {
            log.warn("Failed to load institution info. insttId={}", normalizedInsttId, e);
            return null;
        }
    }

    private boolean canCreateOperationAdminAccounts(String currentUserId, String currentUserAuthorCode) {
        if (authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)) {
            return true;
        }
        String normalizedAuthorCode = authorityPagePayloadSupport.safeValue(currentUserAuthorCode).toUpperCase(Locale.ROOT);
        return ROLE_SYSTEM_ADMIN.equals(normalizedAuthorCode)
                || ROLE_ADMIN.equals(normalizedAuthorCode);
    }
}
